'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { getInvestmentRepository } from '@/lib/storage/repositories'
import { STORAGE_MODES } from '@/lib/storage-mode'
import { useAppStore } from '@/store/app-store'
import { FRESHNESS_MS, RequestError } from '@/lib/client-request'
import { remoteInvestmentRepository } from '@/lib/storage/repositories/remote-investment-repository'
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

let latestInitializationRequest = 0
let readController: AbortController | undefined
let readPromise: Promise<void> | undefined
let reconciliationNeeded = false
let refreshTimer: ReturnType<typeof setTimeout> | undefined
const mutationControllers = new Map<string, AbortController>()

function cancelRequests() {
  latestInitializationRequest += 1
  readController?.abort()
  readPromise = undefined
  clearTimeout(refreshTimer)
  mutationControllers.forEach(controller => controller.abort())
  mutationControllers.clear()
  reconciliationNeeded = false
}

async function runMutation(set: any, get: () => InvestmentStore, key: string, task: (repository: any, options: any) => Promise<any>) {
  const state = get()
  if (state.isPreviewMode || state.scope === 'guest') throw new Error('preview.readOnlyHint')
  if (state.pendingIds.includes(key) || state.pendingIds.includes('*') || (key === '*' && state.pendingIds.length)) throw new Error('request.pending')
  if (state.uncertainIds.includes(key) || state.uncertainIds.includes('*') || (key === '*' && state.uncertainIds.length)) throw new Error('request.uncertain')
  const scope = state.scope
  const controller = new AbortController()
  mutationControllers.set(key, controller)
  latestInitializationRequest += 1
  readController?.abort()
  readPromise = undefined
  clearTimeout(refreshTimer)
  set({ pendingIds: [...state.pendingIds, key], errorMessage: '', refreshError: '', isLoading: false })
  let shouldRefresh = false
  try {
    const repository = getRepository()
    const response = await task(repository, { compact: repository === remoteInvestmentRepository, signal: controller.signal })
    if (get().scope !== scope || controller.signal.aborted) throw new Error('request.sessionChanged')
    shouldRefresh = true
    set((current: InvestmentStore) => {
      let investments = current.investments
      if (response.cleared) investments = []
      else if (response.removedId != null) investments = investments.filter(item => item.id !== String(response.removedId))
      else if (response.record) {
        const [record] = mapSnapshot({ records: [response.record] })
        investments = current.investments.some(item => item.id === record.id)
          ? current.investments.map(item => item.id === record.id ? record : item)
          : [record, ...current.investments]
      } else investments = mapSnapshot(response)
      return { investments, hasInitialized: true, updatedAt: Date.now(), changedId: response.record ? String(response.record.id) : null, changedAt: Date.now(), ...(key === 'create' ? { filters: DEFAULT_FILTERS } : {}) }
    })
  } catch (error) {
    if (get().scope !== scope || controller.signal.aborted) throw new Error('request.sessionChanged')
    if (get().scope === scope && !controller.signal.aborted) {
      const uncertain = error instanceof RequestError && error.uncertain
      shouldRefresh = uncertain
      set({ errorMessage: uncertain ? 'request.uncertain' : (error as Error).message, uncertainIds: uncertain ? [...get().uncertainIds, key] : get().uncertainIds })
    }
    throw error
  } finally {
    if (mutationControllers.get(key) === controller) mutationControllers.delete(key)
    if (get().scope === scope && !controller.signal.aborted) {
      set({ pendingIds: get().pendingIds.filter(id => id !== key) })
      reconciliationNeeded = reconciliationNeeded || shouldRefresh
      if (reconciliationNeeded && !get().pendingIds.length) refreshTimer = setTimeout(() => { reconciliationNeeded = false; void get().initialize({ force: true }) }, 150)
    }
  }
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
  scope: string
  updatedAt: number
  pendingIds: string[]
  uncertainIds: string[]
  refreshError: string
  changedId: string | null
  changedAt: number
  resetScope: (scope: string) => void
  hydrate: (scope: string, snapshot: any, startedAt: number) => void
  initialize: (options?: { preview?: boolean; userId?: number; force?: boolean }) => Promise<void>
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

      scope: 'guest',
      updatedAt: 0,
      pendingIds: [],
      uncertainIds: [],
      refreshError: '',
      changedId: null,
      changedAt: 0,

      resetScope: (scope) => {
        if (get().scope === scope) return
        cancelRequests()
        set({ scope, investments: [], hasInitialized: false, isPreviewMode: scope === 'guest', isLoading: false, updatedAt: 0, errorMessage: '', refreshError: '', pendingIds: [], uncertainIds: [], changedId: null })
      },
      hydrate: (scope, snapshot, startedAt) => {
        get().resetScope(scope)
        if (get().updatedAt > startedAt || get().pendingIds.length || get().hasInitialized) return
        latestInitializationRequest += 1
        readController?.abort()
        readPromise = undefined
        set({ investments: mapSnapshot(snapshot), hasInitialized: true, updatedAt: Date.now(), isLoading: false, isPreviewMode: false, errorMessage: '' })
      },
      initialize: async (options = {}) => {
        const scope = options.preview ? 'guest' : options.userId ? `user:${options.userId}` : get().scope
        get().resetScope(scope)
        if (scope === 'guest') {
          set({ investments: previewInvestments, isPreviewMode: true, isLoading: false, errorMessage: '', hasInitialized: true })
          return
        }
        if (get().pendingIds.length) return
        if (readPromise) return readPromise
        if (!options.force && get().hasInitialized && Date.now() - get().updatedAt < FRESHNESS_MS) return
        const requestId = ++latestInitializationRequest
        const controller = new AbortController()
        readController = controller
        set({ isLoading: true, errorMessage: '', refreshError: '' })
        const promise = (async () => {
          try {
            const repository = getRepository()
            const snapshot = await (repository === remoteInvestmentRepository
              ? repository.getSnapshot({ compact: true, signal: controller.signal })
              : repository.getSnapshot())
            if (controller.signal.aborted || requestId !== latestInitializationRequest || scope !== get().scope) return
            set({ investments: mapSnapshot(snapshot), isPreviewMode: false, isLoading: false, hasInitialized: true, updatedAt: Date.now(), refreshError: '' })
          } catch (error: any) {
            if (controller.signal.aborted || requestId !== latestInitializationRequest || scope !== get().scope) return
            set({ isLoading: false, ...(get().hasInitialized ? { refreshError: 'request.refreshFailed' } : { errorMessage: error?.message ?? 'request.failed' }) })
          } finally {
            if (requestId === latestInitializationRequest) readPromise = undefined
          }
        })()
        readPromise = promise
        return promise
      },
      addInvestment: (data) => runMutation(set, get, 'create', (repository, options) => repository.create(mapFormToPayload(data), options)),
      updateInvestment: (id, data) => runMutation(set, get, id, (repository, options) => {
        const current = get().investments.find(item => item.id === id)
        if (!current) throw new Error('Record not found.')
        const nextData = { ...current, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value != null)), expectedIncome: data.expectedIncome } as InvestmentFormData
        return repository.update(id, mapFormToPayload(nextData, current.status), options)
      }),
      deleteInvestment: (id) => runMutation(set, get, id, (repository, options) => repository.remove(id, 'DELETE', options)),
      restoreInvestment: async () => { await get().initialize({ force: true }) },
      endInvestment: (id, data) => runMutation(set, get, id, (repository, options) => {
        const current = get().investments.find(item => item.id === id)
        if (!current) throw new Error('Record not found.')
        return repository.earlyClose(id, {
          status: mapStatusToRepository('early_ended'), endTime: data.endDate,
          incomeTotal: data.totalIncome ?? current.totalIncome,
          aprActual: data.actualApr ?? current.actualApr,
          remark: data.remark ?? current.remark,
        }, options)
      }),
      clearAllData: () => runMutation(set, get, '*', (repository, options) => repository.clearAll(options)),

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
