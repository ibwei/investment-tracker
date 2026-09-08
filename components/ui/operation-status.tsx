'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'

export function OperationStatus({ pending, action = 'saving' }: { pending: boolean; action?: 'saving' | 'ending' | 'deleting' }) {
  const [slow, setSlow] = useState(false)
  const { t } = useI18n()
  useEffect(() => {
    setSlow(false)
    if (!pending) return
    const timer = setTimeout(() => setSlow(true), 3000)
    return () => clearTimeout(timer)
  }, [pending])
  return pending ? <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{t(slow ? 'request.slow' : `request.${action}`)}</p> : null
}

export function LoadingPanel() {
  const { t } = useI18n()
  return <div role="status" aria-busy="true" className="space-y-4 py-6">
    <span className="sr-only">{t('request.loading')}</span>
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map(key => <div key={key} className="h-28 animate-pulse rounded-xl bg-muted" />)}</div>
    <div className="h-64 animate-pulse rounded-xl bg-muted" />
  </div>
}
