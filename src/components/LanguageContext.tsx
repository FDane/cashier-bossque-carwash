'use client'

import React, { createContext, useState, ReactNode } from 'react'
import { Language, TranslationKey, translations } from '@/i18n/translations'

interface LanguageContextType {
  language: Language
  toggleLanguage: () => void
  t: (key: TranslationKey) => string
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('ms')

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'ms' : 'en'))
  }

  const t = (key: TranslationKey): string => {
    const translation = translations[language][key as keyof typeof translations.en]
    return (translation as string) || (translations.en[key as keyof typeof translations.en] as string) || key
  }

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}