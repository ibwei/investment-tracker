'use client'

import { useMemo } from 'react'
import { useInvestmentStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { buildProjectedPortfolioSeries } from '@/lib/analytics'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export function EarningsChart() {
  const investments = useInvestmentStore((state) => state.investments)
  const { t, formatDisplayCurrency, locale, timezone } = useI18n()

  const chartData = useMemo(
    () => buildProjectedPortfolioSeries(investments, locale, timezone, 90),
    [investments, locale, timezone],
  )

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg font-medium">{t('analytics.projectedIncomeTrend')}</CardTitle>
        <CardDescription>{t('analytics.projectedIncomeTrendDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] min-h-0 min-w-0 sm:h-[360px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                minTickGap={24}
                tick={{ fill: 'oklch(0.6 0 0)', fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                width={84}
                tick={{ fill: 'oklch(0.6 0 0)', fontSize: 12 }}
                tickFormatter={(value) => formatDisplayCurrency(value, 0)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'oklch(0.15 0.005 260)',
                  border: '1px solid oklch(0.25 0.005 260)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  color: 'oklch(0.95 0 0)',
                }}
                labelStyle={{ color: 'oklch(0.95 0 0)', marginBottom: '4px' }}
                itemStyle={{ color: 'oklch(0.9 0 0)' }}
                formatter={(value: number, name: string) => {
                  const labelMap: Record<string, string> = {
                    daily: t('analytics.dailyProjected'),
                    weekly: t('analytics.weeklyProjected'),
                    monthly: t('analytics.monthlyProjected'),
                  }

                  return [formatDisplayCurrency(value), labelMap[name] ?? name]
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={24}
                formatter={(value) => {
                  const labelMap: Record<string, string> = {
                    daily: t('analytics.dailyProjected'),
                    weekly: t('analytics.weeklyProjected'),
                    monthly: t('analytics.monthlyProjected'),
                  }

                  return (
                    <span style={{ color: 'oklch(0.6 0 0)', fontSize: '12px' }}>
                      {labelMap[value] ?? value}
                    </span>
                  )
                }}
              />
              <Line
                type="monotone"
                dataKey="daily"
                name="daily"
                stroke="oklch(0.7 0.15 160)"
                strokeWidth={2.25}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="weekly"
                name="weekly"
                stroke="oklch(0.65 0.18 200)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="monthly"
                name="monthly"
                stroke="oklch(0.75 0.12 80)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
