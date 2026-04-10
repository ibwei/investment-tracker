'use client'

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface PortfolioSnapshot {
  snapshotDate: string
  totalPrincipal: number
  totalIncomeDaily: number
  totalIncomeWeekly: number
  totalIncomeMonthly: number
  totalIncomeYearly: number
  cumulativeIncome: number
  activeInvestmentCount: number
}

export function RealSnapshotTrend() {
  const { t, formatDisplayCurrency, locale } = useI18n()
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCapturing, setIsCapturing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function loadSnapshots() {
    setIsLoading(true)

    try {
      const response = await fetch('/api/analytics/snapshots?days=90', {
        method: 'GET',
        cache: 'no-store',
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load snapshots.')
      }

      setSnapshots(payload.snapshots ?? [])
      setErrorMessage('')
    } catch (error: any) {
      setErrorMessage(error?.message ?? 'Failed to load snapshots.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSnapshots()
  }, [])

  async function handleCapture() {
    setIsCapturing(true)

    try {
      const response = await fetch('/api/analytics/snapshots', {
        method: 'POST',
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to capture snapshot.')
      }

      await loadSnapshots()
    } catch (error: any) {
      setErrorMessage(error?.message ?? 'Failed to capture snapshot.')
    } finally {
      setIsCapturing(false)
    }
  }

  const chartData = useMemo(
    () =>
      snapshots.map((snapshot) => ({
        ...snapshot,
        label: new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
          month: 'short',
          day: 'numeric',
        }).format(new Date(`${snapshot.snapshotDate}T12:00:00`)),
      })),
    [locale, snapshots],
  )

  const latestSnapshot = snapshots[snapshots.length - 1]

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <CardTitle className="text-lg font-medium">{t('analytics.snapshotTrend')}</CardTitle>
          <CardDescription>{t('analytics.snapshotTrendDescription')}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleCapture} loading={isCapturing}>
          {t('analytics.captureSnapshot')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {errorMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        {latestSnapshot ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-border/60 bg-background/60 p-4">
              <p className="text-sm text-muted-foreground">{t('analytics.latestSnapshotDaily')}</p>
              <p className="mt-1 text-xl font-semibold">
                {formatDisplayCurrency(latestSnapshot.totalIncomeDaily)}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-4">
              <p className="text-sm text-muted-foreground">{t('analytics.latestSnapshotWeekly')}</p>
              <p className="mt-1 text-xl font-semibold">
                {formatDisplayCurrency(latestSnapshot.totalIncomeWeekly)}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-4">
              <p className="text-sm text-muted-foreground">{t('analytics.latestSnapshotMonthly')}</p>
              <p className="mt-1 text-xl font-semibold">
                {formatDisplayCurrency(latestSnapshot.totalIncomeMonthly)}
              </p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 p-4">
              <p className="text-sm text-muted-foreground">{t('analytics.latestSnapshotCumulative')}</p>
              <p className="mt-1 text-xl font-semibold">
                {formatDisplayCurrency(latestSnapshot.cumulativeIncome)}
              </p>
            </div>
          </div>
        ) : null}

        {chartData.length > 0 ? (
          <div className="h-[320px] sm:h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
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
                      totalIncomeDaily: t('analytics.snapshotDaily'),
                      totalIncomeWeekly: t('analytics.snapshotWeekly'),
                      totalIncomeMonthly: t('analytics.snapshotMonthly'),
                      cumulativeIncome: t('analytics.snapshotCumulative'),
                    }

                    return [formatDisplayCurrency(value), labelMap[name] ?? name]
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={24}
                  formatter={(value) => {
                    const labelMap: Record<string, string> = {
                      totalIncomeDaily: t('analytics.snapshotDaily'),
                      totalIncomeWeekly: t('analytics.snapshotWeekly'),
                      totalIncomeMonthly: t('analytics.snapshotMonthly'),
                      cumulativeIncome: t('analytics.snapshotCumulative'),
                    }

                    return (
                      <span style={{ color: 'oklch(0.6 0 0)', fontSize: '12px' }}>
                        {labelMap[value] ?? value}
                      </span>
                    )
                  }}
                />
                <Line
                  yAxisId="income"
                  type="monotone"
                  dataKey="totalIncomeDaily"
                  stroke="oklch(0.7 0.15 160)"
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="income"
                  type="monotone"
                  dataKey="totalIncomeWeekly"
                  stroke="oklch(0.65 0.18 200)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="income"
                  type="monotone"
                  dataKey="totalIncomeMonthly"
                  stroke="oklch(0.75 0.12 80)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="cumulative"
                  type="monotone"
                  dataKey="cumulativeIncome"
                  stroke="oklch(0.72 0.16 20)"
                  strokeWidth={1.75}
                  strokeDasharray="6 6"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/70 bg-background/40 px-4 py-8 text-center">
            <p className="text-sm font-medium">
              {isLoading ? t('analytics.loadingSnapshots') : t('analytics.noSnapshotData')}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {isLoading
                ? t('analytics.loadingSnapshotsDescription')
                : t('analytics.noSnapshotDataDescription')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
