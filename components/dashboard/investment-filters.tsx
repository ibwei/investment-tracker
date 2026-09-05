'use client'

import { useInvestmentStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Filter } from 'lucide-react'

export function InvestmentFilters() {
  const investments = useInvestmentStore((state) => state.investments)
  const filters = useInvestmentStore((state) => state.filters)
  const setFilters = useInvestmentStore((state) => state.setFilters)
  const { t, getTypeLabel, getStatusLabel } = useI18n()

  const projects = [...new Set(investments.filter(i => !i.isDeleted).map(i => i.project))]

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('filters.searchInvestments')}
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        
        <Select
          value={filters.project || 'all'}
          onValueChange={(value) => setFilters({ project: value === 'all' ? '' : value })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('filters.projectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allProjects')}</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project} value={project}>
                {project}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.type}
          onValueChange={(value) => setFilters({ type: value as typeof filters.type })}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t('filters.typePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allTypes')}</SelectItem>
            <SelectItem value="interest">{getTypeLabel('interest')}</SelectItem>
            <SelectItem value="lp">{getTypeLabel('lp')}</SelectItem>
            <SelectItem value="lending">{getTypeLabel('lending')}</SelectItem>
            <SelectItem value="cedefi">{getTypeLabel('cedefi')}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) => setFilters({ status: value as typeof filters.status })}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t('filters.statusPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allStatus')}</SelectItem>
            <SelectItem value="active">{getStatusLabel('active')}</SelectItem>
            <SelectItem value="ended">{getStatusLabel('ended')}</SelectItem>
            <SelectItem value="early_ended">{getStatusLabel('early_ended')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
