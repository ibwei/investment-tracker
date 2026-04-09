import type { Investment } from '@/lib/types'

const DAY_MS = 1000 * 60 * 60 * 24

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
}

function parseDate(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed)
}

function isInvestmentActiveOnDate(investment: Investment, date: Date) {
  const startDate = parseDate(investment.startDate)
  if (!startDate || startDate.getTime() > date.getTime()) {
    return false
  }

  if (investment.status === 'active') {
    return true
  }

  const endDate = parseDate(investment.endDate || investment.startDate)
  return endDate ? endDate.getTime() >= date.getTime() : false
}

export function buildProjectedPortfolioSeries(
  investments: Investment[],
  locale: 'en' | 'zh',
  days = 90,
) {
  const today = startOfDay(new Date())
  let cumulativeIncome = 0

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today.getTime() - (days - index - 1) * DAY_MS)
    let daily = 0
    let weekly = 0
    let monthly = 0
    let principal = 0
    let activeCount = 0

    investments.forEach((investment) => {
      if (!isInvestmentActiveOnDate(investment, date)) {
        return
      }

      daily += investment.dailyIncome
      weekly += investment.weeklyIncome
      monthly += investment.monthlyIncome
      principal += investment.amount
      activeCount += 1
    })

    cumulativeIncome += daily

    return {
      isoDate: date.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
        month: 'short',
        day: 'numeric',
      }).format(date),
      daily,
      weekly,
      monthly,
      principal,
      activeCount,
      cumulativeIncome,
    }
  })
}
