'use client'

import React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

export default function ThemeSwitcher() {
  const { theme, toggleTheme, mounted } = useTheme()

  if (!mounted) {
    return (
      <div className="w-10 h-10 rounded-xl bg-surface-a10 border border-surface-a20 animate-pulse" />
    )
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center w-10 h-10 rounded-xl bg-surface-a0 hover:bg-surface-tonal transition-colors border border-surface-a20 hover:border-primary-a0 text-zinc-500 hover:text-primary-a0"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 text-warning-a0" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  )
}
