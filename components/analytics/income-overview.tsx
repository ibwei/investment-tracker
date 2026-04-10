'use client'

import { useMemo } from 'react'
import { useInvestmentStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { Card, CardContent } from '@/components/ui/card'
import { 
  CalendarDays, 
  CalendarRange, 
  Calendar,
  CalendarClock
} from 'lucide-react'

export function IncomeOverview() {
  const investments = useInvestmentStore((state) => state.investments)
  const { t, formatDisplayCurrency } = useI18n()
  
  const stats = useMemo(() => {
    const activeInvestments = investments.filter(i => i.status === 'active')
    return {
      totalDailyIncome: activeInvestments.reduce((sum, i) => sum + i.dailyIncome, 0),
      totalWeeklyIncome: activeInvestments.reduce((sum, i) => sum + i.weeklyIncome, 0),
      totalMonthlyIncome: activeInvestments.reduce((sum, i) => sum + i.monthlyIncome, 0),
      totalYearlyIncome: activeInvestments.reduce((sum, i) => sum + i.yearlyIncome, 0),
    }
  }, [investments])

  const cards = [
    {
      title: t('analytics.dailyIncome'),
      value: formatDisplayCurrency(stats.totalDailyIncome),
      icon: CalendarDays,
      color: 'text-chart-1',
      bgColor: 'bg-chart-1/10'
    },
    {
      title: t('analytics.weeklyIncome'),
      value: formatDisplayCurrency(stats.totalWeeklyIncome),
      icon: CalendarRange,
      color: 'text-chart-2',
      bgColor: 'bg-chart-2/10'
    },
    {
      title: t('analytics.monthlyIncome'),
      value: formatDisplayCurrency(stats.totalMonthlyIncome),
      icon: Calendar,
      color: 'text-chart-3',
      bgColor: 'bg-chart-3/10'
    },
    {
      title: t('analytics.yearlyIncome'),
      value: formatDisplayCurrency(stats.totalYearlyIncome),
      icon: CalendarClock,
      color: 'text-chart-4',
      bgColor: 'bg-chart-4/10'
    }
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </p>
                <p className={`text-2xl font-semibold tracking-tight ${card.color}`}>
                  {card.value}
                </p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
