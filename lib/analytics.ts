import type { Investment } from '@/lib/types'
import { formatInAppTimeZone, parseAppDate, startOfAppDay, toAppDateKey } from '@/lib/time'

const DAY_MS = 1000 * 60 * 60 * 24

function startOfDay(date: Date, timeZone: string) {
  const start = startOfAppDay(date, timeZone)
  return start ? start.toDate() : date
}

function parseDate(value: string, timeZone: string) {
  const parsed = parseAppDate(value, timeZone)
  return parsed ? startOfDay(parsed.toDate(), timeZone) : null
}

function isInvestmentActiveOnDate(investment: Investment, date: Date, timeZone: string) {
  const startDate = parseDate(investment.startDate, timeZone)
  if (!startDate || startDate.getTime() > date.getTime()) {
    return false
  }

  if (investment.status === 'active') {
    return true
  }

  const endDate = parseDate(investment.endDate || investment.startDate, timeZone)
  return endDate ? endDate.getTime() >= date.getTime() : false
}

export function buildProjectedPortfolioSeries(
  investments: Investment[],
  locale: 'en' | 'zh',
  timeZone: string,
  days = 90,
) {
  const today = startOfDay(new Date(), timeZone)
  let cumulativeIncome = 0

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today.getTime() - (days - index - 1) * DAY_MS)
    let daily = 0
    let weekly = 0
    let monthly = 0
    let principal = 0
    let activeCount = 0

    investments.forEach((investment) => {
      if (!isInvestmentActiveOnDate(investment, date, timeZone)) {
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
      isoDate: toAppDateKey(date, timeZone),
      label: formatInAppTimeZone(date, locale === 'zh' ? 'zh-CN' : 'en-US', {
        month: 'short',
        day: 'numeric',
      }, timeZone),
      daily,
      weekly,
      monthly,
      principal,
      activeCount,
      cumulativeIncome,
    }
  })
}
