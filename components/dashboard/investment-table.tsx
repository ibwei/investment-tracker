'use client'

import { useEffect, useMemo, useState } from 'react'
import { useInvestmentStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import type { EndInvestmentData, Investment, SortField, SortDirection } from '@/lib/types'
import {
  calculateHoldingDays,
  roundNumber,
  toDateTimeValue,
} from '@/lib/calculations'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import {
  ArrowUpDown,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Trash2,
  StopCircle,
  ChevronUp,
  ChevronDown
} from 'lucide-react'
import { cn } from '@/lib/utils'

const typeColors: Record<string, string> = {
  interest: 'bg-chart-1/20 text-chart-1 border-chart-1/30',
  lp: 'bg-chart-2/20 text-chart-2 border-chart-2/30',
  lending: 'bg-chart-3/20 text-chart-3 border-chart-3/30',
  cedefi: 'bg-chart-4/20 text-chart-4 border-chart-4/30'
}

const statusColors: Record<string, string> = {
  active: 'bg-success/20 text-success border-success/30',
  ended: 'bg-muted text-muted-foreground border-border',
  early_ended: 'bg-warning/20 text-warning border-warning/30',
  deleted: 'bg-destructive/20 text-destructive border-destructive/30'
}

interface SortableHeaderProps {
  field: SortField
  children: React.ReactNode
  currentField: SortField
  direction: SortDirection
  onSort: (field: SortField) => void
}

function SortableHeader({ field, children, currentField, direction, onSort }: SortableHeaderProps) {
  const isActive = currentField === field
  
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 hover:bg-transparent"
      onClick={() => onSort(field)}
    >
      {children}
      {isActive ? (
        direction === 'asc' ? (
          <ChevronUp className="ml-1 h-4 w-4" />
        ) : (
          <ChevronDown className="ml-1 h-4 w-4" />
        )
      ) : (
        <ArrowUpDown className="ml-1 h-4 w-4 opacity-50" />
      )}
    </Button>
  )
}

interface InvestmentTableProps {
  onEdit: (investment: Investment) => void
}

interface EndDialogState {
  investment: Investment
  endDate: string
  actualApr: string
  totalIncome: string
  remark: string
  syncSource: 'apr' | 'income'
}

function formatInputNumber(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
}

function parseOptionalNumber(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    return undefined
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

function calculateDerivedIncome(amount: number, actualApr: number, holdingDays: number) {
  if (amount <= 0 || actualApr < 0 || holdingDays <= 0) {
    return 0
  }

  return roundNumber((amount * actualApr / 100 / 365) * holdingDays)
}

function calculateDerivedApr(amount: number, totalIncome: number, holdingDays: number) {
  if (amount <= 0 || totalIncome < 0 || holdingDays <= 0) {
    return 0
  }

  return roundNumber((totalIncome / amount) * (365 / holdingDays) * 100)
}

function buildEndDialogState(investment: Investment): EndDialogState {
  const endDate = toDateTimeValue(new Date())
  const totalIncome = formatInputNumber(investment.totalIncome)
  const actualApr = formatInputNumber(investment.actualApr)

  return {
    investment,
    endDate,
    actualApr,
    totalIncome,
    remark: investment.remark ?? '',
    syncSource: 'income',
  }
}

function isHistoricalInvestment(status: Investment['status']) {
  return status === 'ended' || status === 'early_ended'
}

function isActiveInvestment(status: Investment['status']) {
  return status === 'active'
}

export function InvestmentTable({ onEdit }: InvestmentTableProps) {
  const allInvestments = useInvestmentStore((state) => state.investments)
  const filters = useInvestmentStore((state) => state.filters)
  const sortField = useInvestmentStore((state) => state.sortField)
  const sortDirection = useInvestmentStore((state) => state.sortDirection)
  const setSort = useInvestmentStore((state) => state.setSort)
  const deleteInvestment = useInvestmentStore((state) => state.deleteInvestment)
  const endInvestment = useInvestmentStore((state) => state.endInvestment)
  const {
    t,
    formatCurrency,
    formatDate,
    getDeleteConfirmationKeyword,
    getStatusLabel,
    getTypeLabel,
  } = useI18n()

  const investments = useMemo(() => {
    let filtered = [...allInvestments].filter((investment) => !investment.isDeleted)
    
    // Apply filters
    if (filters.search) {
      const search = filters.search.toLowerCase()
      filtered = filtered.filter((investment) =>
        [investment.project, investment.name, investment.remark]
          .join(' ')
          .toLowerCase()
          .includes(search)
      )
    }
    if (filters.project) {
      filtered = filtered.filter(i => i.project.toLowerCase().includes(filters.project!.toLowerCase()))
    }
    if (filters.type && filters.type !== 'all') {
      filtered = filtered.filter(i => i.type === filters.type)
    }
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(i => i.status === filters.status)
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal)
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      
      return 0
    })
    
    return filtered
  }, [allInvestments, filters, sortField, sortDirection])

  const [deleteDialog, setDeleteDialog] = useState<Investment | null>(null)
  const [endDialog, setEndDialog] = useState<EndDialogState | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const deleteConfirmationKeyword = getDeleteConfirmationKeyword()
  const activeInvestments = useMemo(
    () => investments.filter((investment) => isActiveInvestment(investment.status)),
    [investments],
  )
  const historicalInvestments = useMemo(
    () => investments.filter((investment) => isHistoricalInvestment(investment.status)),
    [investments],
  )

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSort(field, sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(field, 'desc')
    }
  }

  const handleDelete = () => {
    if (deleteDialog && deleteConfirm === deleteConfirmationKeyword) {
      void deleteInvestment(deleteDialog.id)
      setDeleteDialog(null)
      setDeleteConfirm('')
    }
  }

  const handleEnd = () => {
    if (endDialog) {
      const payload: EndInvestmentData = {
        endDate: endDialog.endDate,
        actualApr: parseOptionalNumber(endDialog.actualApr),
        totalIncome: parseOptionalNumber(endDialog.totalIncome),
        remark: endDialog.remark.trim(),
      }

      void endInvestment(endDialog.investment.id, payload)
      setEndDialog(null)
    }
  }

  const syncEndDialogFromApr = (current: EndDialogState, actualAprValue: string, endDate = current.endDate) => {
    const holdingDays = calculateHoldingDays({
      startTime: current.investment.startDate,
      endTime: endDate,
      status: 'EARLY_ENDED',
    })
    const parsedApr = parseOptionalNumber(actualAprValue)

    return {
      ...current,
      endDate,
      actualApr: actualAprValue,
      totalIncome:
        parsedApr === undefined
          ? ''
          : String(calculateDerivedIncome(current.investment.amount, parsedApr, holdingDays)),
      syncSource: 'apr' as const,
    }
  }

  const syncEndDialogFromIncome = (current: EndDialogState, totalIncomeValue: string, endDate = current.endDate) => {
    const holdingDays = calculateHoldingDays({
      startTime: current.investment.startDate,
      endTime: endDate,
      status: 'EARLY_ENDED',
    })
    const parsedIncome = parseOptionalNumber(totalIncomeValue)

    return {
      ...current,
      endDate,
      totalIncome: totalIncomeValue,
      actualApr:
        parsedIncome === undefined
          ? ''
          : String(calculateDerivedApr(current.investment.amount, parsedIncome, holdingDays)),
      syncSource: 'income' as const,
    }
  }

  const endHoldingDays = endDialog
    ? calculateHoldingDays({
        startTime: endDialog.investment.startDate,
        endTime: endDialog.endDate,
        status: 'EARLY_ENDED',
      })
    : 0
  const endAprValue = endDialog ? parseOptionalNumber(endDialog.actualApr) ?? 0 : 0
  const endDailyIncome = endDialog
    ? roundNumber((endDialog.investment.amount * endAprValue) / 100 / 365)
    : 0

  useEffect(() => {
    if (!endDialog) {
      return
    }

    if (endDialog.syncSource === 'apr' && endDialog.actualApr.trim()) {
      setEndDialog((current) =>
        current ? syncEndDialogFromApr(current, current.actualApr, current.endDate) : current,
      )
      return
    }

    if (endDialog.totalIncome.trim()) {
      setEndDialog((current) =>
        current ? syncEndDialogFromIncome(current, current.totalIncome, current.endDate) : current,
      )
    }
  }, [endDialog?.endDate])

  const renderNameCell = (investment: Investment, options?: { showTimelineInline?: boolean; showSettlementInline?: boolean }) => (
    <div className="flex flex-col">
      <span>{investment.name}</span>
      {investment.remark && investment.status === 'active' ? (
        <span className="text-xs text-muted-foreground truncate max-w-[120px]">
          {investment.remark}
        </span>
      ) : null}
      {options?.showTimelineInline && isHistoricalInvestment(investment.status) ? (
        <span className="text-xs text-muted-foreground xl:hidden">
          {formatDate(investment.startDate)} {'->'} {formatDate(investment.endDate)}
        </span>
      ) : null}
      {options?.showSettlementInline && isHistoricalInvestment(investment.status) ? (
        investment.status === 'early_ended' ? (
          <span className="text-xs text-muted-foreground 2xl:hidden">
            {t('table.earlyExitRemark')}: {investment.remark || t('table.noRemark')}
          </span>
        ) : investment.remark ? (
          <span className="text-xs text-muted-foreground 2xl:hidden">
            {t('form.remark')}: {investment.remark}
          </span>
        ) : null
      ) : null}
    </div>
  )

  const renderActionCell = (investment: Investment) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(investment)}>
          <Pencil className="mr-2 h-4 w-4" />
          {t('common.edit')}
        </DropdownMenuItem>
        {investment.status === 'active' && (
          <DropdownMenuItem onClick={() => setEndDialog(buildEndDialogState(investment))}>
            <StopCircle className="mr-2 h-4 w-4" />
            {t('table.endInvestmentEarly')}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setDeleteDialog(investment)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t('common.delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <>
      <div className="space-y-6">
        <Card className="gap-0 overflow-hidden border-border/50 bg-card/30 backdrop-blur-sm">
          <CardHeader className="border-b border-border/40">
            <CardTitle>{t('table.activeInvestments')}</CardTitle>
            <CardDescription>{t('table.activeInvestmentsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="w-[140px]">
                      <SortableHeader
                        field="project"
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      >
                        {t('common.project')}
                      </SortableHeader>
                    </TableHead>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('common.type')}</TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        field="amount"
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      >
                        {t('common.amount')}
                      </SortableHeader>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        field="expectedApr"
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      >
                        {t('common.expected')}
                      </SortableHeader>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        field="actualApr"
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      >
                        {t('common.actual')}
                      </SortableHeader>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        field="dailyIncome"
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      >
                        {t('common.daily')}
                      </SortableHeader>
                    </TableHead>
                    <TableHead className="text-right hidden lg:table-cell">{t('common.weekly')}</TableHead>
                    <TableHead className="text-right hidden xl:table-cell">{t('common.monthly')}</TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        field="totalIncome"
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      >
                        {t('common.total')}
                      </SortableHeader>
                    </TableHead>
                    <TableHead className="hidden xl:table-cell">{t('table.startDate')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeInvestments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="h-24 text-center text-muted-foreground">
                        {t('table.noActiveInvestments')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    activeInvestments.map((investment) => (
                      <TableRow key={investment.id} className="border-border/30 hover:bg-secondary/30">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {investment.project}
                            {investment.url && (
                              <a
                                href={investment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={t('table.openLink')}
                                className="text-muted-foreground hover:text-primary"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{renderNameCell(investment)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('capitalize', typeColors[investment.type])}>
                            {getTypeLabel(investment.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(investment.amount)}</TableCell>
                        <TableCell className="text-right font-mono">{investment.expectedApr.toFixed(1)}%</TableCell>
                        <TableCell className="text-right font-mono">
                          <span className={cn(investment.actualApr >= investment.expectedApr ? 'text-success' : 'text-warning')}>
                            {investment.actualApr.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-success">
                          {formatCurrency(investment.dailyIncome)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-success hidden lg:table-cell">
                          {formatCurrency(investment.weeklyIncome)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-success hidden xl:table-cell">
                          {formatCurrency(investment.monthlyIncome)}
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(investment.totalIncome)}</TableCell>
                        <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                          {formatDate(investment.startDate)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('capitalize', statusColors[investment.status])}>
                            {getStatusLabel(investment.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{renderActionCell(investment)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 overflow-hidden border-border/50 bg-card/30 backdrop-blur-sm">
          <CardHeader className="border-b border-border/40">
            <CardTitle>{t('table.historyInvestments')}</CardTitle>
            <CardDescription>{t('table.historyInvestmentsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="w-[140px]">
                      <SortableHeader
                        field="project"
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      >
                        {t('common.project')}
                      </SortableHeader>
                    </TableHead>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('common.type')}</TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        field="amount"
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      >
                        {t('common.amount')}
                      </SortableHeader>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        field="expectedApr"
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      >
                        {t('common.expected')}
                      </SortableHeader>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        field="actualApr"
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      >
                        {t('common.actual')}
                      </SortableHeader>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortableHeader
                        field="totalIncome"
                        currentField={sortField}
                        direction={sortDirection}
                        onSort={handleSort}
                      >
                        {t('common.total')}
                      </SortableHeader>
                    </TableHead>
                    <TableHead className="hidden xl:table-cell">{t('table.timeline')}</TableHead>
                    <TableHead className="hidden 2xl:table-cell">{t('table.settlement')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historicalInvestments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                        {t('table.noHistoryInvestments')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    historicalInvestments.map((investment) => (
                      <TableRow key={investment.id} className="border-border/30 hover:bg-secondary/30">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {investment.project}
                            {investment.url && (
                              <a
                                href={investment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={t('table.openLink')}
                                className="text-muted-foreground hover:text-primary"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{renderNameCell(investment, { showTimelineInline: true, showSettlementInline: true })}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('capitalize', typeColors[investment.type])}>
                            {getTypeLabel(investment.type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(investment.amount)}</TableCell>
                        <TableCell className="text-right font-mono">{investment.expectedApr.toFixed(1)}%</TableCell>
                        <TableCell className="text-right font-mono">
                          <span className={cn(investment.actualApr >= investment.expectedApr ? 'text-success' : 'text-warning')}>
                            {investment.actualApr.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <div className="flex flex-col items-end">
                            <span>{formatCurrency(investment.totalIncome)}</span>
                            <span className="text-xs text-muted-foreground">{t('table.finalSettlement')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <div className="flex min-w-[176px] flex-col text-xs">
                            <span>{t('table.startDate')}: {formatDate(investment.startDate)}</span>
                            <span className="text-muted-foreground">{t('table.endDate')}: {formatDate(investment.endDate)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden 2xl:table-cell">
                          <div className="flex min-w-[220px] flex-col gap-1 text-xs">
                            <span className="font-medium text-foreground">
                              {t('table.finalSettlement')}: {formatCurrency(investment.totalIncome)}
                            </span>
                            {investment.status === 'early_ended' ? (
                              <span className="text-muted-foreground">
                                {t('table.earlyExitRemark')}: {investment.remark || t('table.noRemark')}
                              </span>
                            ) : investment.remark ? (
                              <span className="text-muted-foreground">
                                {t('form.remark')}: {investment.remark}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">{t('table.noRemark')}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('capitalize', statusColors[investment.status])}>
                            {getStatusLabel(investment.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>{renderActionCell(investment)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={() => {
        setDeleteDialog(null)
        setDeleteConfirm('')
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('table.deleteInvestment')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {t('table.deleteDescription', {
                  project: deleteDialog?.project ?? '',
                  name: deleteDialog?.name ?? '',
                }).split(`${deleteDialog?.project ?? ''} - ${deleteDialog?.name ?? ''}`)[0]}
                <strong>{deleteDialog?.project} - {deleteDialog?.name}</strong>
                {t('table.deleteDescription', {
                  project: deleteDialog?.project ?? '',
                  name: deleteDialog?.name ?? '',
                }).split(`${deleteDialog?.project ?? ''} - ${deleteDialog?.name ?? ''}`)[1] ?? ''}
              </p>
              <p>
                {t('table.deleteAmount', {
                  amount: deleteDialog ? formatCurrency(deleteDialog.amount) : '',
                }).split(deleteDialog ? formatCurrency(deleteDialog.amount) : '')[0]}
                <strong>{deleteDialog && formatCurrency(deleteDialog.amount)}</strong>
              </p>
              <p className="text-destructive">
                {t('table.deletePermanent')}
              </p>
              <div className="pt-2">
                <label className="text-sm font-medium">
                  {t('table.typeDeleteToConfirm', {
                    keyword: deleteConfirmationKeyword,
                  })}
                </label>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={deleteConfirmationKeyword}
                  className="mt-2"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteConfirm !== deleteConfirmationKeyword}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!endDialog} onOpenChange={(open) => !open && setEndDialog(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{t('table.endInvestmentEarly')}</DialogTitle>
            <DialogDescription className="space-y-2">
              <p>
                {t('table.endDescription', {
                  project: endDialog?.investment.project ?? '',
                  name: endDialog?.investment.name ?? '',
                })}
              </p>
              <p>{t('table.endHint')}</p>
            </DialogDescription>
          </DialogHeader>

          {endDialog ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-sm">
                <div className="font-medium">
                  {endDialog.investment.project} · {endDialog.investment.name}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {t('table.originalEndDate', {
                    date: formatDate(endDialog.investment.endDate),
                  })}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {t('table.holdingDays', { days: endHoldingDays })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="finish-date">{t('table.finishDate')}</Label>
                  <DateTimePicker
                    value={endDialog.endDate}
                    onChange={(nextValue) =>
                      setEndDialog((current) => {
                        if (!current) {
                          return current
                        }

                        return current.syncSource === 'apr'
                          ? syncEndDialogFromApr(current, current.actualApr, nextValue)
                          : syncEndDialogFromIncome(current, current.totalIncome, nextValue)
                      })
                    }
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="finish-apr">{t('table.actualAprLabel')}</Label>
                  <Input
                    id="finish-apr"
                    type="number"
                    min="0"
                    step="0.01"
                    value={endDialog.actualApr}
                    onChange={(event) =>
                      setEndDialog((current) =>
                        current ? syncEndDialogFromApr(current, event.target.value) : current,
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">{t('table.actualAprHint')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="finish-income">{t('table.finalIncome')}</Label>
                  <Input
                    id="finish-income"
                    type="number"
                    step="0.01"
                    value={endDialog.totalIncome}
                    onChange={(event) =>
                      setEndDialog((current) =>
                        current ? syncEndDialogFromIncome(current, event.target.value) : current,
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">{t('table.finalIncomeHint')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="finish-remark">{t('form.remark')}</Label>
                  <Input
                    id="finish-remark"
                    value={endDialog.remark}
                    onChange={(event) =>
                      setEndDialog((current) =>
                        current
                          ? {
                              ...current,
                              remark: event.target.value,
                            }
                          : current,
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('table.projectedDailyIncome', {
                      amount: formatCurrency(endDailyIncome),
                    })}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEndDialog(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleEnd}>
              {t('table.saveFinishChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
