'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { getInvestmentRepository } from '@/lib/storage/repositories'
import { STORAGE_MODES } from '@/lib/storage-mode'
import { useAppStore } from '@/store/app-store'
import { previewInvestments } from '@/lib/preview-data'
import type {
  EndInvestmentData,
  FilterOptions,
  Investment,
  InvestmentFormData,
  InvestmentStatus,
  InvestmentType,
  SortDirection,
  SortField,
} from '@/lib/types'

const TYPE_MAP: Record<string, InvestmentType> = {
  interest: 'interest',
  lp: 'lp',
  lending: 'lending',
  cedefi: 'cedefi',
}

const STATUS_MAP: Record<string, InvestmentStatus> = {
  ongoing: 'active',
  active: 'active',
  ended: 'ended',
  early_ended: 'early_ended',
  deleted: 'deleted',
}

const DEFAULT_FILTERS: FilterOptions = {
  project: '',
  type: 'all',
  status: 'all',
  search: '',
}

function normalizeType(type: string): InvestmentType {
  return TYPE_MAP[String(type ?? '').trim().toLowerCase()] ?? 'cedefi'
}

function normalizeStatus(status: string): InvestmentStatus {
  return STATUS_MAP[String(status ?? '').trim().toLowerCase()] ?? 'active'
}

function mapTypeToRepository(type: InvestmentType): string {
  switch (type) {
    case 'interest':
      return 'Interest'
    case 'lp':
      return 'LP'
    case 'lending':
      return 'Lending'
    default:
      return 'CeDeFi'
  }
}

function mapStatusToRepository(status: InvestmentStatus): string {
  switch (status) {
    case 'active':
      return 'ONGOING'
    case 'ended':
      return 'ENDED'
    case 'early_ended':
      return 'EARLY_ENDED'
    default:
      return 'EARLY_ENDED'
  }
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function mapSnapshot(snapshot: any): Investment[] {
  return (snapshot?.records ?? []).map((record: any) => ({
    id: String(record.id),
    project: record.project ?? '',
    name: record.assetName ?? record.name ?? '',
    url: record.url ?? '',
    type: normalizeType(record.type),
    amount: toNumber(record.metrics?.amount ?? record.amount),
    currency: record.currency ?? 'USD',
    description: record.allocationNote ?? '',
    startDate: record.startTime ?? '',
    endDate: record.endTime ?? '',
    actualDays: toNumber(record.metrics?.holdingDays),
    remark: record.remark ?? '',
    expectedApr: toNumber(record.metrics?.expectedApr ?? record.aprExpected),
    actualApr: toNumber(record.metrics?.actualApr ?? record.aprActual),
    totalIncome: toNumber(record.metrics?.totalIncome ?? record.incomeTotal),
    dailyIncome: toNumber(record.metrics?.dailyIncome ?? record.incomeDaily),
    weeklyIncome: toNumber(record.metrics?.weeklyIncome ?? record.incomeWeekly),
    monthlyIncome: toNumber(record.metrics?.monthlyIncome ?? record.incomeMonthly),
    yearlyIncome: toNumber(record.metrics?.yearlyIncome ?? record.incomeYearly),
    status: normalizeStatus(record.status),
    isDeleted: Boolean(record.isDeleted),
    createdAt: record.createdAt ?? new Date().toISOString(),
  }))
}

function mapFormToPayload(data: InvestmentFormData, currentStatus: InvestmentStatus = 'active') {
  return {
    project: data.project,
    assetName: data.name,
    url: data.url || '',
    type: mapTypeToRepository(data.type),
    amount: data.amount,
    currency: data.currency,
    allocationNote: data.description,
    startTime: data.startDate,
    endTime: data.endDate,
    aprExpected: data.expectedApr,
    aprActual: data.actualApr ?? null,
    incomeTotal: data.expectedIncome ?? null,
    status: mapStatusToRepository(currentStatus),
    remark: data.remark,
  }
}

function getRepository() {
  const storageMode = useAppStore.getState().storageMode ?? STORAGE_MODES.REMOTE
  return getInvestmentRepository(storageMode)
}

interface InvestmentStore {
  investments: Investment[]
  isPreviewMode: boolean
  filters: FilterOptions
  sortField: SortField
  sortDirection: SortDirection
  isLoading: boolean
  errorMessage: string
  hasInitialized: boolean
  initialize: (options?: { preview?: boolean }) => Promise<void>
  addInvestment: (data: InvestmentFormData) => Promise<void>
  updateInvestment: (id: string, data: Partial<InvestmentFormData>) => Promise<void>
  deleteInvestment: (id: string) => Promise<void>
  restoreInvestment: (id: string) => Promise<void>
  endInvestment: (id: string, data: EndInvestmentData) => Promise<void>
  clearAllData: () => Promise<void>
  setFilters: (filters: Partial<FilterOptions>) => void
  setSort: (field: SortField, direction: SortDirection) => void
  getFilteredInvestments: () => Investment[]
  getActiveInvestments: () => Investment[]
  getHistoryInvestments: () => Investment[]
}

export const useInvestmentStore = create<InvestmentStore>()(
  persist(
    (set, get) => ({
      investments: [],
      isPreviewMode: false,
      filters: DEFAULT_FILTERS,
      sortField: 'startDate',
      sortDirection: 'desc',
      isLoading: false,
      errorMessage: '',
      hasInitialized: false,

      initialize: async (options = {}) => {
        if (options.preview) {
          set({
            investments: previewInvestments,
            isPreviewMode: true,
            isLoading: false,
            errorMessage: '',
            hasInitialized: true,
          })
          return
        }

        set({ isLoading: true, errorMessage: '' })
        try {
          const snapshot = await getRepository().getSnapshot()
          set({
            investments: mapSnapshot(snapshot),
            isPreviewMode: false,
            isLoading: false,
            hasInitialized: true,
          })
        } catch (error: any) {
          set({
            isPreviewMode: false,
            isLoading: false,
            hasInitialized: true,
            errorMessage: error?.message ?? 'Failed to load investments.',
          })
        }
      },

      addInvestment: async (data) => {
        if (get().isPreviewMode) {
          return
        }

        set({ isLoading: true, errorMessage: '' })
        try {
          const snapshot = await getRepository().create(mapFormToPayload(data))
          set({
            investments: mapSnapshot(snapshot),
            filters: DEFAULT_FILTERS,
            isLoading: false,
          })
        } catch (error: any) {
          set({
            isLoading: false,
            errorMessage: error?.message ?? 'Failed to create investment.',
          })
          throw error
        }
      },

      updateInvestment: async (id, data) => {
        if (get().isPreviewMode) {
          return
        }

        const current = get().investments.find((investment) => investment.id === id)
        if (!current) {
          return
        }

        const nextData: InvestmentFormData = {
          project: data.project ?? current.project,
          name: data.name ?? current.name,
          url: data.url ?? current.url,
          type: data.type ?? current.type,
          amount: data.amount ?? current.amount,
          currency: data.currency ?? current.currency,
          description: data.description ?? current.description,
          startDate: data.startDate ?? current.startDate,
          endDate: data.endDate ?? current.endDate,
          remark: data.remark ?? current.remark,
          expectedApr: data.expectedApr ?? current.expectedApr,
          actualApr: data.actualApr ?? current.actualApr,
          expectedIncome: data.expectedIncome ?? current.totalIncome,
        }

        set({ isLoading: true, errorMessage: '' })
        try {
          const snapshot = await getRepository().update(
            id,
            mapFormToPayload(nextData, current.status),
          )
          set({ investments: mapSnapshot(snapshot), isLoading: false })
        } catch (error: any) {
          set({
            isLoading: false,
            errorMessage: error?.message ?? 'Failed to update investment.',
          })
          throw error
        }
      },

      deleteInvestment: async (id) => {
        if (get().isPreviewMode) {
          return
        }

        set({ isLoading: true, errorMessage: '' })
        try {
          const snapshot = await getRepository().remove(id, 'DELETE')
          set({ investments: mapSnapshot(snapshot), isLoading: false })
        } catch (error: any) {
          set({
            isLoading: false,
            errorMessage: error?.message ?? 'Failed to delete investment.',
          })
          throw error
        }
      },

      restoreInvestment: async () => {
        await get().initialize({ preview: get().isPreviewMode })
      },

      endInvestment: async (id, data) => {
        if (get().isPreviewMode) {
          return
        }

        const current = get().investments.find((investment) => investment.id === id)
        if (!current) {
          return
        }

        set({ isLoading: true, errorMessage: '' })
        try {
          const snapshot = await getRepository().earlyClose(id, {
            status: mapStatusToRepository('early_ended'),
            endTime: data.endDate,
            incomeTotal: data.totalIncome ?? current.totalIncome,
            aprActual: data.actualApr ?? current.actualApr,
            remark: data.remark ?? current.remark,
          })
          set({ investments: mapSnapshot(snapshot), isLoading: false })
        } catch (error: any) {
          set({
            isLoading: false,
            errorMessage: error?.message ?? 'Failed to end investment.',
          })
          throw error
        }
      },

      clearAllData: async () => {
        if (get().isPreviewMode) {
          set({
            investments: previewInvestments,
            isPreviewMode: true,
            isLoading: false,
            errorMessage: '',
          })
          return
        }

        set({ isLoading: true, errorMessage: '' })
        try {
          const snapshot = await getRepository().clearAll()
          set({ investments: mapSnapshot(snapshot), isLoading: false })
        } catch (error: any) {
          set({
            isLoading: false,
            errorMessage: error?.message ?? 'Failed to clear data.',
          })
          throw error
        }
      },

      setFilters: (filters) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }))
      },

      setSort: (field, direction) => {
        set({ sortField: field, sortDirection: direction })
      },

      getFilteredInvestments: () => {
        const { investments, filters, sortField, sortDirection } = get()

        const filtered = investments.filter((investment) => {
          if (investment.isDeleted) {
            return false
          }

          if (
            filters.search &&
            ![
              investment.project,
              investment.name,
              investment.remark,
            ]
              .join(' ')
              .toLowerCase()
              .includes(filters.search.toLowerCase())
          ) {
            return false
          }

          if (filters.project && investment.project !== filters.project) {
            return false
          }

          if (filters.type !== 'all' && investment.type !== filters.type) {
            return false
          }

          if (filters.status !== 'all' && investment.status !== filters.status) {
            return false
          }

          return true
        })

        filtered.sort((a, b) => {
          const aValue = a[sortField]
          const bValue = b[sortField]

          if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortDirection === 'asc'
              ? aValue.localeCompare(bValue)
              : bValue.localeCompare(aValue)
          }

          return sortDirection === 'asc'
            ? Number(aValue) - Number(bValue)
            : Number(bValue) - Number(aValue)
        })

        return filtered
      },

      getActiveInvestments: () =>
        get().investments.filter(
          (investment) => !investment.isDeleted && investment.status === 'active',
        ),

      getHistoryInvestments: () =>
        get().investments.filter(
          (investment) =>
            !investment.isDeleted &&
            (investment.status === 'ended' || investment.status === 'early_ended'),
        ),
    }),
    {
      name: 'earn-compass-ui-store',
      partialize: (state) => ({
        filters: state.filters,
        sortField: state.sortField,
        sortDirection: state.sortDirection,
      }),
    },
  ),
)
