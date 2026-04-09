'use client'

import { useState, useMemo } from 'react'
import { useInvestmentStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import type { Investment, SortField, SortDirection } from '@/lib/types'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  const [endDialog, setEndDialog] = useState<Investment | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const deleteConfirmationKeyword = getDeleteConfirmationKeyword()

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
      void endInvestment(endDialog.id)
      setEndDialog(null)
    }
  }

  return (
    <>
      <div className="rounded-lg border border-border/50 bg-card/30 backdrop-blur-sm">
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
                <TableHead>{t('common.status')}</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {investments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                    {t('table.noInvestmentsFound')}
                  </TableCell>
                </TableRow>
              ) : (
                investments.map((investment) => (
                  <TableRow
                    key={investment.id}
                    className="border-border/30 hover:bg-secondary/30"
                  >
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
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{investment.name}</span>
                        {investment.remark && (
                          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                            {investment.remark}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn('capitalize', typeColors[investment.type])}
                      >
                        {getTypeLabel(investment.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(investment.amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {investment.expectedApr.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={cn(
                        investment.actualApr >= investment.expectedApr 
                          ? 'text-success' 
                          : 'text-warning'
                      )}>
                        {investment.actualApr.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-success">
                      {investment.status === 'active' ? formatCurrency(investment.dailyIncome) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-success hidden lg:table-cell">
                      {investment.status === 'active' ? formatCurrency(investment.weeklyIncome) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-success hidden xl:table-cell">
                      {investment.status === 'active' ? formatCurrency(investment.monthlyIncome) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(investment.totalIncome)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn('capitalize', statusColors[investment.status])}
                      >
                        {getStatusLabel(investment.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
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
                            <DropdownMenuItem onClick={() => setEndDialog(investment)}>
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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

      {/* End Early Dialog */}
      <AlertDialog open={!!endDialog} onOpenChange={() => setEndDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('table.endInvestmentEarly')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {t('table.endDescription', {
                  project: endDialog?.project ?? '',
                  name: endDialog?.name ?? '',
                }).split(`${endDialog?.project ?? ''} - ${endDialog?.name ?? ''}`)[0]}
                <strong>{endDialog?.project} - {endDialog?.name}</strong>
                {t('table.endDescription', {
                  project: endDialog?.project ?? '',
                  name: endDialog?.name ?? '',
                }).split(`${endDialog?.project ?? ''} - ${endDialog?.name ?? ''}`)[1] ?? ''}
              </p>
              <p>
                {t('table.originalEndDate', {
                  date: endDialog ? formatDate(endDialog.endDate) : '',
                }).split(endDialog ? formatDate(endDialog.endDate) : '')[0]}
                <strong>{endDialog && formatDate(endDialog.endDate)}</strong>
              </p>
              <p className="text-muted-foreground">
                {t('table.endHint')}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleEnd}>
              {t('table.endInvestment')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
