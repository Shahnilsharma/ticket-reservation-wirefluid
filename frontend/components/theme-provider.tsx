'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  useTheme,
  type ThemeProviderProps,
} from 'next-themes'

function ThemeClassSync() {
  const { theme, resolvedTheme } = useTheme()

  React.useEffect(() => {
    const effectiveTheme = (theme === 'system' ? resolvedTheme : theme) ?? 'light'
    const root = document.documentElement

    // Keep root classes deterministic to prevent mixed light/dark rendering.
    root.classList.remove('light', 'dark')
    root.classList.add(effectiveTheme)
    root.style.colorScheme = effectiveTheme
  }, [theme, resolvedTheme])

  return null
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      themes={["light", "dark"]}
      storageKey="wirefluid-theme-v2"
      disableTransitionOnChange
      {...props}
    >
      <ThemeClassSync />
      {children}
    </NextThemesProvider>
  )
}
