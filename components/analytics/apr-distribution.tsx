'use client'

import { useMemo } from 'react'
import { useInvestmentStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell
} from 'recharts'

const COLORS = [
  'oklch(0.7 0.15 160)',
  'oklch(0.65 0.18 200)',
  'oklch(0.75 0.12 80)',
  'oklch(0.6 0.2 280)',
  'oklch(0.55 0.2 25)'
]

export function AprDistribution() {
  const allInvestments = useInvestmentStore((state) => state.investments)
  const investments = useMemo(() => allInvestments.filter(i => i.status === 'active'), [allInvestments])
  const { t } = useI18n()

  const chartData = useMemo(() => {
    return investments.map((inv, index) => ({
      name: inv.project,
      expected: inv.expectedApr,
      actual: inv.actualApr,
      color: COLORS[index % COLORS.length]
    }))
  }, [investments])

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg font-medium">{t('analytics.aprComparison')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              layout="vertical"
              margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="oklch(0.3 0 0)" 
                horizontal={false}
              />
              <XAxis 
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'oklch(0.6 0 0)', fontSize: 12 }}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis 
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'oklch(0.6 0 0)', fontSize: 12 }}
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
                  `${value.toFixed(1)}%`,
                  name === 'expected' ? t('analytics.expectedApr') : t('analytics.actualApr')
                ]}
              />
              <Bar dataKey="expected" name="expected" fill="oklch(0.4 0 0)" radius={[0, 4, 4, 0]} barSize={12} />
              <Bar dataKey="actual" name="actual" radius={[0, 4, 4, 0]} barSize={12}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-muted" />
            <span className="text-sm text-muted-foreground">{t('analytics.expected')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">{t('analytics.actual')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
