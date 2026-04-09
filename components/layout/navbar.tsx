'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  BarChart3, 
  Settings, 
  Compass,
  Menu,
  LogOut,
  User,
  X
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const { t } = useI18n()
  const { user, isAuthenticated, setUser } = useAuth()

  const navItems = [
    { href: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
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
      setMobileOpen(false)
      router.push('/login')
      router.refresh()
    }
  }

  function renderUserMenu() {
    if (!isAuthenticated || !user) {
      return (
        <>
          <Link href="/login" className="hidden md:block">
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
            className="hidden items-center gap-3 rounded-full border border-border/60 bg-background/80 px-2.5 py-1.5 transition-colors hover:bg-secondary/60 md:flex"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-sm font-semibold text-primary">
              {avatarLetter}
            </div>
            <div className="flex max-w-32 flex-col items-start text-left">
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
          <DropdownMenuItem asChild>
            <Link href="/settings" className="cursor-pointer">
              <User className="h-4 w-4" />
              {t('common.profile')}
            </Link>
          </DropdownMenuItem>
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
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Compass className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
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

        <div className="flex items-center gap-3">
          <LanguageSwitcher className="hidden md:inline-flex" />
          {renderUserMenu()}
          
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileOpen && (
        <div className="border-t border-border/40 bg-background md:hidden">
          <nav className="flex flex-col p-4">
            <LanguageSwitcher className="mb-4 inline-flex self-start" />
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
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
            <div className="mt-4 border-t border-border/40 pt-4">
              {isAuthenticated && user ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 px-3 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-sm font-semibold text-primary">
                      {avatarLetter}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{displayName}</div>
                      <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                  <Link href="/settings" onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      <User className="h-4 w-4" />
                      {t('common.profile')}
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    {t('common.logout')}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      {t('nav.login')}
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full">
                      {t('nav.getStarted')}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
