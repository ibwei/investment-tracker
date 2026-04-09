'use client'

import { useMemo } from 'react'
import { useInvestmentStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export function EarningsChart() {
  const allInvestments = useInvestmentStore((state) => state.investments)
  const investments = useMemo(() => allInvestments.filter(i => i.status === 'active'), [allInvestments])
  const { t, formatCurrency, locale } = useI18n()

  const chartData = useMemo(() => {
    // Generate last 12 months of projected earnings data
    const months = []
    const now = new Date()
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'short' })
      
      // Calculate cumulative earnings for each month
      let monthlyEarnings = 0
      let cumulativeEarnings = 0
      
      investments.forEach(inv => {
        const startDate = new Date(inv.startDate)
        if (startDate <= date) {
          monthlyEarnings += inv.monthlyIncome
          const monthsActive = Math.max(0, 
            (date.getFullYear() - startDate.getFullYear()) * 12 + 
            (date.getMonth() - startDate.getMonth())
          )
          cumulativeEarnings += inv.monthlyIncome * monthsActive
        }
      })
      
      months.push({
        month: monthName,
        earnings: Math.round(monthlyEarnings),
        cumulative: Math.round(cumulativeEarnings),
      })
    }
    
    return months
  }, [investments])

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg font-medium">{t('analytics.earningsOverview')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] sm:h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.7 0.15 160)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="oklch(0.7 0.15 160)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.65 0.18 200)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="oklch(0.65 0.18 200)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="oklch(0.3 0 0)" 
                vertical={false}
              />
              <XAxis 
                dataKey="month" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'oklch(0.6 0 0)', fontSize: 12 }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'oklch(0.6 0 0)', fontSize: 12 }}
                tickFormatter={(value) => formatCurrency(value, 'USD', 0)}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'oklch(0.15 0.005 260)',
                  border: '1px solid oklch(0.25 0.005 260)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: 'oklch(0.95 0 0)', marginBottom: '4px' }}
                formatter={(value: number, name: string) => [
                  formatCurrency(value, 'USD', 0),
                  name === 'earnings' ? t('analytics.monthly') : t('analytics.cumulative')
                ]}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="oklch(0.65 0.18 200)"
                strokeWidth={2}
                fill="url(#cumulativeGradient)"
              />
              <Area
                type="monotone"
                dataKey="earnings"
                stroke="oklch(0.7 0.15 160)"
                strokeWidth={2}
                fill="url(#earningsGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">{t('analytics.monthlyEarnings')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-chart-2" />
            <span className="text-sm text-muted-foreground">{t('analytics.cumulative')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
