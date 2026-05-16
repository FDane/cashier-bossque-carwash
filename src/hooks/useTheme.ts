import { useState, useEffect, useCallback } from 'react'
import { Theme, getThemeFromStorage, setThemeInStorage, applyTheme } from '@/lib/theme'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  // Initialize theme on mount
  useEffect(() => {
    const storedTheme = getThemeFromStorage()
    setThemeState(storedTheme)
    applyTheme(storedTheme)
    setMounted(true)
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    setThemeInStorage(newTheme)
    applyTheme(newTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return {
    theme,
    setTheme,
    toggleTheme,
    mounted,
  }
}
