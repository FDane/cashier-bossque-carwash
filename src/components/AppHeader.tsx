"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { 
  Globe, 
  Menu, 
  X, 
  Home, 
  Users, 
  Box, 
  History, 
  UserCircle
} from 'lucide-react'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import { useLanguage } from '@/hooks/useLanguage'

export default function AppHeader() {
  const { t, language, toggleLanguage } = useLanguage()
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  const navLinks = [
    { href: '/', label: t('nav.home' as any) || 'Home', icon: Home },
    { href: '/staff', label: t('nav.staff' as any) || 'Staff', icon: Users },
    { href: '/inventory', label: t('nav.inventory' as any) || 'Inventory', icon: Box },
    { href: '/past-cars', label: t('nav.pastCars' as any) || 'Past Cars', icon: History },
    { href: '/customers', label: t('nav.customers' as any) || 'Customers', icon: UserCircle },
  ]

  const isActive = (path: string) => pathname === path

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-zinc-800 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link href="/" className="flex items-center gap-3 group transition-transform hover:scale-[1.02] active:scale-95">
            <Image
              src="/logo.png"
              alt="Bossque Carwash Logo"
              width={44}
              height={44}
              priority
              className="rounded-xl shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all object-contain"
            />
            <div className="hidden sm:block">
              <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight leading-none mb-1">
                Bossque <span className="text-blue-600 dark:text-blue-400">Carwash</span>
              </h1>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">
                {t('app.subtitle' as any) || 'Management System'}
              </p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 bg-zinc-100/50 dark:bg-zinc-800/50 p-1 rounded-2xl border border-zinc-200/50 dark:border-zinc-700/50">
            {navLinks.map((link) => {
              const active = isActive(link.href)
              const Icon = link.icon
              return (
                <Link 
                  key={link.href} 
                  href={link.href} 
                  className={`
                    flex items-center gap-2 text-sm px-4 py-2 rounded-xl transition-all duration-200
                    ${active 
                      ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm font-bold' 
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-white/50 dark:hover:bg-zinc-900/50'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 ${active ? 'animate-in zoom-in' : ''}`} />
                  {link.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block h-6 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1" />
            <ThemeSwitcher />

            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-blue-500 transition-all text-sm font-bold text-zinc-700 dark:text-zinc-300 shadow-sm"
              title="Toggle Language"
            >
              <Globe className="w-4 h-4 text-blue-500" />
              <span className="min-w-[20px]">{language.toUpperCase()}</span>
            </button>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-100 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl py-4 px-4 space-y-1.5 animate-in slide-in-from-top duration-300 shadow-2xl overflow-hidden rounded-b-3xl">
          {navLinks.map((link) => {
            const active = isActive(link.href)
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-4 px-4 py-3.5 text-base font-bold rounded-2xl transition-all
                  ${active 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 translate-x-1' 
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }
                `}
              >
                <div className={`p-2 rounded-lg ${active ? 'bg-white/20' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {link.label}
              </Link>
            )
          })}
        </div>
      )}
    </header>
  )
}
