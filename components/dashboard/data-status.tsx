'use client'

import { useEffect } from 'react'
import { useInvestmentStore } from '@/lib/store'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

export function InvestmentDataStatus() {
  const { t } = useI18n()
  const isLoading = useInvestmentStore(state => state.isLoading)
  const error = useInvestmentStore(state => state.errorMessage || state.refreshError)
  const uncertainIds = useInvestmentStore(state => state.uncertainIds)
  const updatedAt = useInvestmentStore(state => state.updatedAt)
  const initialize = useInvestmentStore(state => state.initialize)
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void initialize() }
    window.addEventListener('online', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('online', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [initialize])
  return <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground" aria-live="polite">
    {error || uncertainIds.length ? <span role="alert">{t(uncertainIds.length ? 'request.uncertain' : error)}</span> : null}
    {updatedAt ? <span>{t('request.updated', { time: new Date(updatedAt).toLocaleTimeString() })}</span> : null}
    <Button variant="ghost" size="sm" loading={isLoading} onClick={() => void initialize({ force: true })}>{t(isLoading ? 'request.refreshing' : 'request.refresh')}</Button>
    {uncertainIds.length && !isLoading && updatedAt ? <Button variant="outline" size="sm" onClick={() => useInvestmentStore.setState({ uncertainIds: [], errorMessage: '' })}>{t('request.checked')}</Button> : null}
  </div>
}
