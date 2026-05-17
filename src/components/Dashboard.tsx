'use client'

import React, { useState } from 'react'
import CarEntryIntake from '@/components/CarEntryIntake'
import CashierCheckout from '@/components/CashierCheckout'
import { useTransactions } from '@/hooks/useTransactions'
import { useLanguage } from '@/hooks/useLanguage'
import { ChevronDown, ChevronUp, Wallet } from 'lucide-react'

export default function Dashboard() {
  const { t } = useLanguage()
  const [isCheckoutExpanded, setIsCheckoutExpanded] = useState(false)

  // Listen to PENDING transactions (intake queue)
  const {
    transactions: pendingTransactions,
    loading: pendingLoading,
  } = useTransactions('PENDING')

  // Listen to COMPLETED transactions (past records)
  const { transactions: completedTransactions } = useTransactions('COMPLETED')

      {/* Header is provided by AppHeader in layout */}
      return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-950 dark:text-white transition-colors duration-200">

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Two-Phase Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Phase 1: Car Entry Intake (Left Column) */}
          <div className="lg:col-span-1">
            <CarEntryIntake />
          </div>

          {/* Phase 2: Cashier Checkout (Center/Right Columns) */}
          <div className="lg:col-span-2">
            {/* Mobile Toggle for Checkout - Collapsed by Default for better Focus on Intake */}
            <div className="lg:hidden mb-4">
              <button
                onClick={() => setIsCheckoutExpanded(!isCheckoutExpanded)}
                className="w-full flex items-center justify-between p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] shadow-xl active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-left">
                    <span className="block text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                      {t('cashier.title' as any)}
                    </span>
                    <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">
                      {pendingTransactions.length} {t('cashier.queue' as any)}
                    </span>
                  </div>
                </div>
                {isCheckoutExpanded ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
              </button>
            </div>

            <div className={`${isCheckoutExpanded ? 'block' : 'hidden'} lg:block animate-in fade-in slide-in-from-top-2 duration-300`}>
              <CashierCheckout
                pendingTransactions={pendingTransactions}
                loading={pendingLoading}
              />
            </div>
          </div>
        </div>

        {/* Stats Row - Optional */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: (t('stats.totalQueue' as any)), value: pendingTransactions.length, bgColor: 'bg-blue-50 dark:bg-blue-900/20', borderColor: 'border-blue-200 dark:border-blue-700/50', textColor: 'text-blue-600 dark:text-blue-400' },
            {
              label: (t('stats.completedToday' as any)),
              value: completedTransactions.length,
              bgColor: 'bg-green-50 dark:bg-green-900/20',
              borderColor: 'border-green-200 dark:border-green-700/50',
              textColor: 'text-green-600 dark:text-green-400',
            },
            {
              label: (t('stats.totalRevenue' as any)),
              value: `RM ${(
                completedTransactions.reduce((sum, t) => sum + t.computedPrice, 0)
              ).toFixed(2)}`,
              bgColor: 'bg-amber-50 dark:bg-amber-900/20',
              borderColor: 'border-amber-200 dark:border-amber-700/50',
              textColor: 'text-amber-600 dark:text-amber-400',
            },
            {
              label: (t('stats.avgPerCar' as any)),
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
                {stat.label}
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
          <p>
            © 2024 {t('app.footer' as any) || 'Bossque Carwash Management System. Built with Next.js & Firebase.'}
          </p>
        </div>
      </footer>
    </div>
  )
}
