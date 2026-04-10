'use client'

import { useMemo } from 'react'
import { useInvestmentStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts'

const COLORS = [
  'oklch(0.7 0.15 160)',
  'oklch(0.65 0.18 200)',
  'oklch(0.75 0.12 80)',
  'oklch(0.6 0.2 280)',
  'oklch(0.55 0.2 25)'
]

export function ProjectBreakdown() {
  const allInvestments = useInvestmentStore((state) => state.investments)
  const investments = useMemo(() => allInvestments.filter(i => i.status === 'active'), [allInvestments])
  const { t, formatDisplayCurrency } = useI18n()

  const chartData = useMemo(() => {
    const projectTotals = new Map<string, number>()
    
    investments.forEach(inv => {
      const current = projectTotals.get(inv.project) || 0
      projectTotals.set(inv.project, current + inv.amount)
    })

    return Array.from(projectTotals.entries()).map(([name, value]) => ({
      name,
      value
    }))
  }, [investments])

  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg font-medium">{t('analytics.portfolioAllocation')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'oklch(0.15 0.005 260)',
                  border: '1px solid oklch(0.25 0.005 260)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                formatter={(value: number) => [
                  formatDisplayCurrency(value, 0),
                  t('analytics.amount')
                ]}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value, entry) => (
                  <span style={{ color: 'oklch(0.6 0 0)', fontSize: '12px' }}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-center">
          <p className="text-sm text-muted-foreground">{t('analytics.totalInvested')}</p>
          <p className="text-2xl font-semibold">{formatDisplayCurrency(total, 0)}</p>
        </div>
      </CardContent>
    </Card>
  )
}
