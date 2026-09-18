'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  BarChart3, 
  Settings, 
  Compass,
  Wallet,
  LogOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { LanguageSwitcher } from '@/components/layout/language-switcher'
import { useAuth } from '@/components/auth-provider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useI18n()
  const { user, isAuthenticated, setUser } = useAuth()

  const navItems = [
    { href: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/assets', label: t('nav.assets'), icon: Wallet },
    { href: '/analytics', label: t('nav.analytics'), icon: BarChart3 },
    { href: '/settings', label: t('nav.settings'), icon: Settings },
  ]

  const displayName = user?.name?.trim() || user?.email?.split('@')[0] || ''
  const avatarLetter = displayName.charAt(0).toUpperCase() || 'U'

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      })
    } finally {
      setUser(null)
      router.push('/login')
      router.refresh()
    }
  }

  function renderUserMenu() {
    if (!isAuthenticated || !user) {
      return (
        <>
          <Link href="/login">
            <Button variant="ghost" size="sm">
              {t('nav.login')}
            </Button>
          </Link>
          <Link href="/register" className="hidden md:block">
            <Button size="sm">
              {t('nav.getStarted')}
            </Button>
          </Link>
        </>
      )
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-3 rounded-full border border-border/60 bg-background/80 px-1.5 py-1.5 transition-colors hover:bg-secondary/60 md:px-2.5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-sm font-semibold text-primary md:h-9 md:w-9">
              {avatarLetter}
            </div>
            <div className="hidden max-w-32 flex-col items-start text-left md:flex">
              <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
              <span className="text-xs text-muted-foreground">{t('nav.myAccount')}</span>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col">
            <span className="truncate">{displayName}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="cursor-pointer"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {t('common.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }
          
  // Don't show navbar on auth pages
  if (pathname?.startsWith('/login') || pathname?.startsWith('/register')) {
    return null
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 md:h-16 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary md:h-9 md:w-9">
              <Compass className="h-4 w-4 text-primary-foreground md:h-5 md:w-5" />
            </div>
            <span className="truncate text-base font-semibold tracking-tight md:text-lg">
              {t('common.brand')}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            <LanguageSwitcher />
            {renderUserMenu()}
          </div>
        </div>
      </header>

      <nav
        data-mobile-tabbar
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/40 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="grid h-16 grid-cols-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground active:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
