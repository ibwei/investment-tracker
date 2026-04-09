'use client'

import { useMemo } from 'react'
import { useInvestmentStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { Card, CardContent } from '@/components/ui/card'
import { 
  TrendingUp, 
  Wallet, 
  Clock, 
  Percent 
} from 'lucide-react'

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

export function StatsCards() {
  const investments = useInvestmentStore((state) => state.investments)
  const { t, formatCurrency } = useI18n()
  
  const stats = useMemo(() => {
    const activeInvestments = investments.filter(i => i.status === 'active')
    const totalInvestment = activeInvestments.reduce((sum, i) => sum + i.amount, 0)
    const totalDailyIncome = activeInvestments.reduce((sum, i) => sum + i.dailyIncome, 0)
    const totalWeeklyIncome = activeInvestments.reduce((sum, i) => sum + i.weeklyIncome, 0)
    const totalMonthlyIncome = activeInvestments.reduce((sum, i) => sum + i.monthlyIncome, 0)
    const totalYearlyIncome = activeInvestments.reduce((sum, i) => sum + i.yearlyIncome, 0)
    const averageApr = activeInvestments.length > 0
      ? activeInvestments.reduce((sum, i) => sum + i.actualApr, 0) / activeInvestments.length
      : 0
    
    return {
      totalInvestment,
      totalDailyIncome,
      totalWeeklyIncome,
      totalMonthlyIncome,
      totalYearlyIncome,
      averageApr,
      activeCount: activeInvestments.length,
      totalCount: investments.length
    }
  }, [investments])

  const cards = [
    {
      title: t('stats.totalInvestment'),
      value: formatCurrency(stats.totalInvestment),
      icon: Wallet,
      description: t('stats.activePositions', { count: stats.activeCount }),
      trend: null
    },
    {
      title: t('stats.dailyIncome'),
      value: formatCurrency(stats.totalDailyIncome),
      icon: TrendingUp,
      description: t('stats.weeklyIncome', {
        value: formatCurrency(stats.totalWeeklyIncome),
      }),
      trend: 'up' as const
    },
    {
      title: t('stats.monthlyIncome'),
      value: formatCurrency(stats.totalMonthlyIncome),
      icon: Clock,
      description: t('stats.yearlyIncome', {
        value: formatCurrency(stats.totalYearlyIncome),
      }),
      trend: 'up' as const
    },
    {
      title: t('stats.averageApr'),
      value: formatPercent(stats.averageApr),
      icon: Percent,
      description: t('stats.acrossAllPositions'),
      trend: null
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
                <p className="text-2xl font-semibold tracking-tight">
                  {card.value}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {card.trend === 'up' && (
                    <span className="text-success">+</span>
                  )}
                  {card.description}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <card.icon className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
