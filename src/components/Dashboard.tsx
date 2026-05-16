'use client'

import React, { useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { Globe, Menu, X } from 'lucide-react'
import CarEntryIntake from '@/components/CarEntryIntake'
import CashierCheckout from '@/components/CashierCheckout'
import ThemeSwitcher from '@/components/ThemeSwitcher'
import { useLanguage } from '@/hooks/useLanguage'
import { useTransactions } from '@/hooks/useTransactions'

export default function Dashboard() {
  const { language, toggleLanguage, t } = useLanguage()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Listen to PENDING transactions (intake queue)
  const {
    transactions: pendingTransactions,
    loading: pendingLoading,
    error: pendingError,
  } = useTransactions('PENDING')

  // Listen to COMPLETED transactions (past records)
  const {
    transactions: completedTransactions,
    error: completedError,
  } = useTransactions('COMPLETED')

  useEffect(() => {
    if (pendingError) {
      console.error('Error loading pending transactions:', pendingError)
    }
    if (completedError) {
      console.error('Error loading completed transactions:', completedError)
    }
  }, [pendingError, completedError])

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-950 dark:text-white transition-colors duration-200">
      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
        }}
      />

      {/* Header */}
      <header className="z-40 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center font-bold text-lg text-white">
                BC
              </div>
              <div>
                <h1 className="text-xl font-bold text-zinc-950 dark:text-white">{t('header.title' as any)}</h1>
                <p className="text-xs text-gray-600 dark:text-zinc-500">{t('header.dashboard' as any)}</p>
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              {/* Theme Switcher */}
              <ThemeSwitcher />

              {/* Language Toggle */}
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition text-sm font-medium text-zinc-950 dark:text-white border border-gray-300 dark:border-zinc-600"
                title="Toggle Language"
              >
                <Globe className="w-4 h-4" />
                <span>{language.toUpperCase()}</span>
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 rounded-lg bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition text-zinc-950 dark:text-white border border-gray-300 dark:border-zinc-600"
              >
                {sidebarOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Two-Phase Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Phase 1: Car Entry Intake (Left Column) */}
          <div className="lg:col-span-1">
            <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block`}>
              <CarEntryIntake />
            </div>
          </div>

          {/* Phase 2: Cashier Checkout (Center/Right Columns) */}
          <div className="lg:col-span-2">
            <CashierCheckout
              pendingTransactions={pendingTransactions}
              loading={pendingLoading}
            />
          </div>
        </div>

        {/* Stats Row - Optional */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'stats.totalQueue', value: pendingTransactions.length, bgColor: 'bg-blue-50 dark:bg-blue-900/20', borderColor: 'border-blue-200 dark:border-blue-700/50', textColor: 'text-blue-600 dark:text-blue-400' },
            {
              label: 'stats.completedToday',
              value: completedTransactions.length,
              bgColor: 'bg-green-50 dark:bg-green-900/20',
              borderColor: 'border-green-200 dark:border-green-700/50',
              textColor: 'text-green-600 dark:text-green-400',
            },
            {
              label: 'stats.totalRevenue',
              value: `RM ${(
                completedTransactions.reduce((sum, t) => sum + t.computedPrice, 0)
              ).toFixed(2)}`,
              bgColor: 'bg-amber-50 dark:bg-amber-900/20',
              borderColor: 'border-amber-200 dark:border-amber-700/50',
              textColor: 'text-amber-600 dark:text-amber-400',
            },
            {
              label: 'stats.avgPerCar',
              value:
                completedTransactions.length > 0
                  ? `RM ${(
                      completedTransactions.reduce((sum, t) => sum + t.computedPrice, 0) /
                      completedTransactions.length
                    ).toFixed(2)}`
                  : 'N/A',
              bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
              borderColor: 'border-indigo-200 dark:border-indigo-700/50',
              textColor: 'text-indigo-600 dark:text-indigo-400',
            },
          ].map((stat, idx) => (
            <div
              key={idx}
              className={`${stat.bgColor} border ${stat.borderColor} rounded-lg p-4 transition-colors duration-200`}
            >
              <div className="text-xs text-gray-600 dark:text-gray-400 uppercase font-semibold mb-1">
                {t(stat.label as any)}
              </div>
              <div className={`text-2xl font-bold ${stat.textColor}`}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-zinc-800 mt-12 py-6 px-4 transition-colors duration-200">
        <div className="max-w-7xl mx-auto text-center text-gray-600 dark:text-zinc-500 text-sm">
          <p>© 2024 Bossque Carwash Management System. Built with Next.js & Firebase.</p>
        </div>
      </footer>
    </div>
  )
}
