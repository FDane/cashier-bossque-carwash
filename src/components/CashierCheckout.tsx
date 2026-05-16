'use client'

import React, { useState, useMemo } from 'react'
import {
  Search,
  CreditCard,
  Wallet,
  X,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Transaction, PaymentMethod } from '@/types'
import { useLanguage } from '@/hooks/useLanguage'
import { completeTransaction, updateDailyStats } from '@/lib/firebaseService'
import { showToast } from '@/lib/toast'
import { formatCurrency, formatTime } from '@/lib/utils'

interface CashierCheckoutProps {
  pendingTransactions: Transaction[]
  loading: boolean
}

const SERVICE_CATEGORIES = {
  exterior: { ms: 'Luar', en: 'Exterior' },
  interior: { ms: 'Dalam', en: 'Interior' },
  engine: { ms: 'Enjin', en: 'Engine' },
}

interface CheckoutModalData {
  transaction: Transaction | null
  paymentMethod: PaymentMethod
  cashReceived: number
}

export default function CashierCheckout({
  pendingTransactions,
  loading: transactionsLoading,
}: CashierCheckoutProps) {
  const { t, language } = useLanguage()
  const [searchQuery, setSearchQuery] = useState('')
  const [checkoutModal, setCheckoutModal] = useState<CheckoutModalData>({
    transaction: null,
    paymentMethod: null,
    cashReceived: 0,
  })
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Local filtering: No extra Firebase cost
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return pendingTransactions
    const query = searchQuery.toLowerCase()
    return pendingTransactions.filter((t) =>
      t.plateNumber.toLowerCase().includes(query)
    )
  }, [pendingTransactions, searchQuery, language])

  // Calculate balance in real-time
  const balance = useMemo(() => {
    if (!checkoutModal.transaction || checkoutModal.paymentMethod !== 'CASH') {
      return 0
    }
    return checkoutModal.cashReceived - checkoutModal.transaction.computedPrice
  }, [checkoutModal.transaction, checkoutModal.paymentMethod, checkoutModal.cashReceived, language])

  const handleCardClick = (transaction: Transaction) => {
    setCheckoutModal({
      transaction,
      paymentMethod: null,
      cashReceived: 0,
    })
  }

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setCheckoutModal({
      ...checkoutModal,
      paymentMethod: method,
      cashReceived: 0,
    })
  }

  const handleCashReceivedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0
    setCheckoutModal({
      ...checkoutModal,
      cashReceived: value,
    })
  }

  const handleCheckout = async () => {
    if (!checkoutModal.transaction || !checkoutModal.paymentMethod) {
      showToast.warning(t('payment.error.invalidCash' as any))
      return
    }

    // Validate cash amount if payment is CASH
    if (
      checkoutModal.paymentMethod === 'CASH' &&
      checkoutModal.cashReceived < checkoutModal.transaction.computedPrice
    ) {
      showToast.error(t('payment.error.invalidCash' as any))
      return
    }

    setProcessingId(checkoutModal.transaction.id)

    try {
      // Update transaction status to COMPLETED
      await completeTransaction(
        checkoutModal.transaction.id,
        checkoutModal.paymentMethod,
        checkoutModal.cashReceived,
        checkoutModal.transaction.computedPrice
      )

      // Update daily stats with revenue and car level
      await updateDailyStats(
        checkoutModal.paymentMethod,
        checkoutModal.transaction.computedPrice,
        pendingTransactions.length
      )

      showToast.success(t('payment.success' as any))

      // Close modal and reset state
      setCheckoutModal({
        transaction: null,
        paymentMethod: null,
        cashReceived: 0,
      })
    } catch (error) {
      console.error('Error processing checkout:', error)
      showToast.error(t('payment.error' as any))
    } finally {
      setProcessingId(null)
    }
  }

  const closeModal = () => {
    setCheckoutModal({
      transaction: null,
      paymentMethod: null,
      cashReceived: 0,
    })
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header with Search - No longer sticky for better mobile space */}
      <div className="z-40 pt-4 pb-6 bg-transparent transition-all duration-300">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-premium-lg overflow-hidden">
          <div className="p-6 sm:p-8 border-b border-zinc-100 dark:border-zinc-800/50">
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">
              {t('cashier.title' as any)}
            </h2>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                {t('cashier.queueCount' as any)} {pendingTransactions.length}
              </span>
            </div>
          </div>
          
          <div className="p-6 sm:p-8 bg-zinc-50/50 dark:bg-zinc-800/20">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder={t('cashier.search' as any)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-14 pr-6 py-4 sm:py-5 text-xl text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Queue Status */}
      {transactionsLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        </div>
      )}

      {!transactionsLoading && pendingTransactions.length === 0 && (
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-500 text-lg font-medium">{t('cashier.emptyQueue' as any)}</p>
        </div>
      )}

      {!transactionsLoading && pendingTransactions.length > 0 && filteredTransactions.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-500 text-lg font-medium">
            {t('cashier.noResults' as any)} "{searchQuery}"
          </p>
        </div>
      )}

      {!transactionsLoading && filteredTransactions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {filteredTransactions.map((transaction) => (
            <button
              key={transaction.id}
              onClick={() => handleCardClick(transaction)}
              className="text-left group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 rounded-2xl p-5 sm:p-7 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 transform hover:-translate-y-1"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-zinc-500 text-xs uppercase font-semibold mb-1">
                    {t('payment.plateNumber' as any)}
                  </div>
                  <div className="text-zinc-900 dark:text-white text-2xl sm:text-3xl font-bold font-mono tracking-wider">
                    {transaction.plateNumber}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-blue-400 transition" />
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-base">
                  <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                    {transaction.brand} {transaction.model}
                  </span>
                  <span className="text-zinc-500 text-xs">{t(`color.${transaction.color}` as any)}</span>
                </div>

                {/* Service Tags */}
                <div className="flex gap-2 flex-wrap mt-3">
                  {transaction.services.exterior && (
                    <span className="px-3 py-1 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 text-xs rounded-full font-bold">
                      {SERVICE_CATEGORIES.exterior[language as 'en' | 'ms']}
                    </span>
                  )}
                  {transaction.services.interior && (
                    <span className="px-3 py-1 bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-300 text-xs rounded-full font-bold">
                      {SERVICE_CATEGORIES.interior[language as 'en' | 'ms']}
                    </span>
                  )}
                  {transaction.services.engine && (
                    <span className="px-3 py-1 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 text-xs rounded-full font-bold">
                      {SERVICE_CATEGORIES.engine[language as 'en' | 'ms']}
                    </span>
                  )}
                </div>
              </div>

              {/* Time & Price */}
              <div className="border-t border-zinc-700 pt-3 flex justify-between items-end">
                <div className="text-xs text-zinc-500 font-medium">
                  {formatTime(transaction.checkInTime)}
                </div>
                <div className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400">
                  {formatCurrency(transaction.computedPrice)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutModal.transaction && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-[2.5rem] sm:rounded-3xl w-full sm:w-full sm:max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 px-6 sm:px-8 py-5 flex justify-between items-center">
              <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
                {t('payment.title' as any)}
              </h3>
              <button
                onClick={closeModal}
                className="text-zinc-400 hover:text-white transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-8 space-y-6 sm:space-y-8">
              {/* Transaction Info */}
              <div className="bg-blue-500/5 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-5 sm:p-6">
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-zinc-400 uppercase font-semibold mb-1">
                      {t('payment.plateNumber' as any)}
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white font-mono tracking-widest">
                      {checkoutModal.transaction.plateNumber}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400 uppercase font-semibold mb-1">
                      {t('payment.carDetails' as any)}
                    </div>
                    <div className="text-sm text-zinc-300">
                      {checkoutModal.transaction.brand} {checkoutModal.transaction.model} • {t(`color.${checkoutModal.transaction.color}` as any)}
                    </div>
                  </div>
                  <div className="border-t border-zinc-700 pt-3">
                    <div className="text-sm text-zinc-500 uppercase font-bold mb-1">
                      {t('payment.totalAmount' as any)}
                    </div>
                    <div className="text-3xl sm:text-4xl font-black text-blue-600 dark:text-blue-400">
                      {formatCurrency(checkoutModal.transaction.computedPrice)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-3">
                  {t('payment.paymentMethod' as any)} *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Cash Button */}
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodSelect('CASH')}
                    className={`p-4 rounded-lg border-2 font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                      checkoutModal.paymentMethod === 'CASH'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-blue-500'
                    }`}
                  >
                    <Wallet className="w-5 h-5" />
                    {t('payment.cash' as any)}
                  </button>

                  {/* Online Button */}
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodSelect('ONLINE')}
                    className={`p-4 rounded-lg border-2 font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                      checkoutModal.paymentMethod === 'ONLINE'
                        ? 'bg-green-600 border-green-500 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-green-500'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    {t('payment.online' as any)}
                  </button>
                </div>
              </div>

              {/* Cash Calculator - Only for CASH payment */}
              {checkoutModal.paymentMethod === 'CASH' && (
                <div className="space-y-4 bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
                  <div>
                    <label className="block text-sm font-semibold text-zinc-300 mb-2">
                      {t('payment.cashReceived' as any)}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={checkoutModal.cashReceived || ''}
                      onChange={handleCashReceivedChange}
                      placeholder="0.00"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white text-xl font-semibold placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>

                  {/* Balance Display */}
                  <div
                    className={`border-2 rounded-lg p-4 ${
                      balance < 0
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-green-500 bg-green-500/10'
                    }`}
                  >
                    <div className="text-xs text-zinc-400 uppercase font-semibold mb-1">
                      {t('payment.balance' as any)}
                    </div>
                    <div
                      className={`text-2xl font-bold ${
                        balance < 0 ? 'text-red-400' : 'text-green-400'
                      }`}
                    >
                      {formatCurrency(Math.abs(balance))}
                    {balance < 0 ? ` ${t('payment.shortage' as any)}` : ` ${t('payment.surplus' as any)}`}
                    </div>
                  </div>

                  {/* Error Message */}
                  {balance < 0 && (
                    <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                      <AlertCircle className="w-4 h-4" />
                      {t('payment.error.invalidCash' as any)}
                    </div>
                  )}
                </div>
              )}

              {/* QR Display - For Online Payment */}
              {checkoutModal.paymentMethod === 'ONLINE' && (
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 text-center">
                  <div className="w-32 h-32 bg-white mx-auto mb-4 rounded-lg flex items-center justify-center">
                    <div className="text-xs text-zinc-400">{t('payment.qrPlaceholder' as any)}</div>
                  </div>
                  <p className="text-zinc-400 text-sm">
                    {t('payment.qrInstruction' as any)}
                  </p>
                  <p className="text-white font-semibold mt-2">
                    {formatCurrency(checkoutModal.transaction.computedPrice)}
                  </p>
                </div>
              )}

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={
                  processingId !== null ||
                  !checkoutModal.paymentMethod ||
                  (checkoutModal.paymentMethod === 'CASH' && balance < 0)
                }
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed text-white font-bold py-5 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 text-xl shadow-lg shadow-green-500/20"
              >
                {processingId ? <Loader2 className="w-6 h-6 animate-spin" /> : null}
                <span>{t('payment.checkout' as any)}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
