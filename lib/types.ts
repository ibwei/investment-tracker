export type InvestmentType = 'interest' | 'lp' | 'lending' | 'cedefi'

export type InvestmentStatus = 'active' | 'ended' | 'early_ended' | 'deleted'

export interface Investment {
  id: string
  project: string
  name: string
  url: string
  type: InvestmentType
  amount: number
  currency: string
  description: string
  startDate: string
  endDate: string
  actualDays: number
  remark: string
  expectedApr: number
  actualApr: number
  totalIncome: number
  dailyIncome: number
  weeklyIncome: number
  monthlyIncome: number
  yearlyIncome: number
  status: InvestmentStatus
  isDeleted: boolean
  createdAt: string
}

export interface InvestmentFormData {
  project: string
  name: string
  url: string
  type: InvestmentType
  amount: number
  currency: string
  description: string
  startDate: string
  endDate: string
  remark: string
  expectedApr: number
  actualApr?: number
}

export interface EarningsStats {
  totalInvestment: number
  totalDailyIncome: number
  totalWeeklyIncome: number
  totalMonthlyIncome: number
  totalYearlyIncome: number
  totalIncome: number
  averageApr: number
  activeCount: number
}

export type SortField = 'project' | 'amount' | 'expectedApr' | 'actualApr' | 'dailyIncome' | 'totalIncome' | 'startDate' | 'endDate'
export type SortDirection = 'asc' | 'desc'

export interface FilterOptions {
  project: string
  type: InvestmentType | 'all'
  status: InvestmentStatus | 'all'
  search: string
}

export interface AuthUser {
  id: number
  email: string
  name: string | null
  role: string
  status: string
  storageMode: string
  createdAt: string
  updatedAt: string
}
