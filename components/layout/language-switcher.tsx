'use client'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface LanguageSwitcherProps {
  className?: string
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, setLocale } = useI18n()

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-border/50 bg-secondary/30 p-1',
        className,
      )}
    >
      <Button
        type="button"
        variant={locale === 'en' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 px-3 text-xs"
        onClick={() => setLocale('en')}
      >
        EN
      </Button>
      <Button
        type="button"
        variant={locale === 'zh' ? 'secondary' : 'ghost'}
        size="sm"
        className="h-8 px-3 text-xs"
        onClick={() => setLocale('zh')}
      >
        中
      </Button>
    </div>
  )
}
