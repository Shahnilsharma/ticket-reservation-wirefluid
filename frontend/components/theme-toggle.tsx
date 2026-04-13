'use client'

import { useEffect, useState } from 'react'
import { MoonStar, SunMedium } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === 'dark'

  if (!mounted) {
    return null
  }

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'fixed bottom-5 right-5 z-[90] inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-xl backdrop-blur-xl transition-all',
        'border-white/10 bg-white/75 text-slate-900 hover:-translate-y-0.5 hover:shadow-2xl dark:border-emerald-500/10 dark:bg-slate-950/70 dark:text-slate-100',
      )}
    >
      <span className={cn('flex h-8 w-8 items-center justify-center rounded-full transition-colors', isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-900 text-white')}>
        {isDark ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
      </span>
      <span className="hidden sm:inline">{isDark ? 'Dark mode' : 'Light mode'}</span>
    </button>
  )
}