'use client'

import { useMemo } from 'react'
import { useInvestmentStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { buildProjectedPortfolioSeries } from '@/lib/analytics'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export function PortfolioIncomeVolatility() {
  const investments = useInvestmentStore((state) => state.investments)
  const { t, formatDisplayCurrency, locale } = useI18n()

  const chartData = useMemo(
    () => buildProjectedPortfolioSeries(investments, locale, 90),
    [investments, locale],
  )

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg font-medium">{t('analytics.portfolioIncomeVolatility')}</CardTitle>
        <CardDescription>{t('analytics.portfolioIncomeVolatilityDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] sm:h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="portfolioDailyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.7 0.15 160)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="oklch(0.7 0.15 160)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.3 0 0)" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                minTickGap={24}
                tick={{ fill: 'oklch(0.6 0 0)', fontSize: 12 }}
              />
              <YAxis
                yAxisId="income"
                axisLine={false}
                tickLine={false}
                width={84}
                tick={{ fill: 'oklch(0.6 0 0)', fontSize: 12 }}
                tickFormatter={(value) => formatDisplayCurrency(value, 0)}
              />
              <YAxis
                yAxisId="cumulative"
                orientation="right"
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
                }}
                labelStyle={{ color: 'oklch(0.95 0 0)', marginBottom: '4px' }}
                formatter={(value: number, name: string) => {
                  const labelMap: Record<string, string> = {
                    daily: t('analytics.dailyPortfolioIncome'),
                    cumulativeIncome: t('analytics.cumulativeProjectedIncome'),
                    principal: t('analytics.activeCapital'),
                  }

                  return [formatDisplayCurrency(value), labelMap[name] ?? name]
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={24}
                formatter={(value) => {
                  const labelMap: Record<string, string> = {
                    daily: t('analytics.dailyPortfolioIncome'),
                    cumulativeIncome: t('analytics.cumulativeProjectedIncome'),
                    principal: t('analytics.activeCapital'),
                  }

                  return (
                    <span style={{ color: 'oklch(0.6 0 0)', fontSize: '12px' }}>
                      {labelMap[value] ?? value}
                    </span>
                  )
                }}
              />
              <Area
                yAxisId="income"
                type="monotone"
                dataKey="daily"
                name="daily"
                stroke="oklch(0.7 0.15 160)"
                strokeWidth={2.25}
                fill="url(#portfolioDailyGradient)"
              />
              <Line
                yAxisId="cumulative"
                type="monotone"
                dataKey="cumulativeIncome"
                name="cumulativeIncome"
                stroke="oklch(0.65 0.18 200)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                yAxisId="cumulative"
                type="monotone"
                dataKey="principal"
                name="principal"
                stroke="oklch(0.75 0.12 80)"
                strokeWidth={1.75}
                strokeDasharray="6 6"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
