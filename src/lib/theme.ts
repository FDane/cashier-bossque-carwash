export type Theme = 'light' | 'dark'

export const getThemeFromStorage = (): Theme => {
  if (typeof window === 'undefined') return 'dark'
  
  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') {
    return stored
  }
  
  // Check system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  
  return 'light'
}

export const setThemeInStorage = (theme: Theme): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('theme', theme)
  }
}

export const applyTheme = (theme: Theme): void => {
  if (typeof document === 'undefined') return
  
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}
