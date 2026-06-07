'use client'

import React, { useMemo, useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import CarEntryIntake from '@/components/CarEntryIntake'
import CashierCheckout from '@/components/CashierCheckout'
import { useTransactions } from '@/hooks/useTransactions'
import { useLanguage } from '@/hooks/useLanguage'
import { 
  ChevronDown, 
  ChevronUp, 
  Wallet, 
  Banknote, 
  Plus, 
  Minus, 
  X, 
  Trash2,
  UserPlus,
  ArrowLeftRight
} from 'lucide-react'
import { listenToTodayAdjustments, addCashAdjustment, deleteCashAdjustment, getStaffList, listenToTodayAttendance, recordStaffAdvance } from '@/lib/firebaseService'
import { showToast } from '@/lib/toast'
import { formatCurrency, getKLDateString } from '@/lib/utils'

export default function Dashboard() {
  const { t, language } = useLanguage()
  const [isCheckoutExpanded, setIsCheckoutExpanded] = useState(false)
  const [isCashDrawerOpen, setIsCashDrawerOpen] = useState(false)
  const [adjustments, setAdjustments] = useState<any[]>([])
  const [showExchangeModal, setShowExchangeModal] = useState(false)
  const [showAdjModal, setShowAdjModal] = useState<'EXPENSE' | 'ADDITION' | null>(null)
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const [staffMap, setStaffMap] = useState<Record<string, any>>({})
  const [attendance, setAttendance] = useState<any[]>([])
  const [adjForm, setAdjForm] = useState({ 
    amount: '', 
    reason: '',
    denominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 } as Record<number, number>
  })
  const [advForm, setAdvForm] = useState({ 
    attendanceId: '', 
    amount: '',
    denominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 } as Record<number, number>
  })
  const [exchangeForm, setExchangeForm] = useState({
    outDenoms: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 } as Record<number, number>,
    inDenoms: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 } as Record<number, number>
  })
  const [loading, setLoading] = useState(false)

  // Listen to PENDING transactions (intake queue)
  const {
    transactions: pendingTransactions,
    loading: pendingLoading,
  } = useTransactions('PENDING')

  // Listen to COMPLETED transactions (past records)
  const { transactions: completedTransactions } = useTransactions('COMPLETED')

  useEffect(() => {
    const unsub = listenToTodayAdjustments(setAdjustments)
    
    // Load staff names and today's attendance
    let unsubAttendance: any
    const setup = async () => {
      const list = await getStaffList()
      const map: Record<string, any> = {}
      list.forEach(s => map[s.id] = s)
      setStaffMap(map)
      
      unsubAttendance = await listenToTodayAttendance(setAttendance)
    }
    setup()

    return () => { unsub(); if (unsubAttendance) unsubAttendance(); }
  }, [])

  // Prevent background scrolling when modals are open
  useEffect(() => {
    if (showAdjModal || showAdvanceModal || showExchangeModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showAdjModal, showAdvanceModal, showExchangeModal])

  // Filter transactions to only include those completed today
  const todayCompleted = useMemo(() => {
    const todayStr = getKLDateString()
    return completedTransactions.filter(trans => {
      // If paidTime is null (pending server sync), assume it's today since it just moved to COMPLETED
      if (!trans.paidTime) return true 
      const paidDate = trans.paidTime instanceof Date ? trans.paidTime : new Date(trans.paidTime)
      return getKLDateString(paidDate) === todayStr
    })
  }, [completedTransactions])

  // Aggregated Cash Breakdown
  const cashBreakdown = useMemo(() => {
    const breakdown: Record<number, number> = { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 }
    let totalCashValue = 0

    todayCompleted.forEach(trans => {
      const denominations = (trans as any).denominations
      const changeDenominations = (trans as any).changeDenominations
      if (trans.paymentMethod === 'CASH' && denominations) {
        Object.entries(denominations).forEach(([bill, count]) => {
          const b = parseInt(bill)
          const c = count as number
          breakdown[b] = (breakdown[b] || 0) + c
          totalCashValue += (b * c)
        })
      }
      if (trans.paymentMethod === 'CASH' && changeDenominations) {
        Object.entries(changeDenominations).forEach(([bill, count]) => {
          const b = parseInt(bill)
          const c = count as number
          breakdown[b] = (breakdown[b] || 0) - c
          totalCashValue -= (b * c)
        })
      }
    })

    let totalAdditions = 0
    let totalExpenses = 0
    adjustments.forEach(adj => {
      const denominations = adj.denominations
      if (denominations) {
        Object.entries(denominations).forEach(([bill, count]) => {
          const b = parseInt(bill)
          const c = count as number
          if (adj.type === 'ADDITION') {
            breakdown[b] = (breakdown[b] || 0) + c
          } else {
            breakdown[b] = (breakdown[b] || 0) - c
          }
        })
      }

      if (adj.type === 'ADDITION') totalAdditions += adj.amount
      else totalExpenses += adj.amount
    })

    const grandTotal = totalCashValue + totalAdditions - totalExpenses

    return { breakdown, totalCashValue, totalAdditions, totalExpenses, grandTotal }
  }, [todayCompleted, adjustments])

  const handleAdjBillClick = (bill: number) => {
    setAdjForm(prev => {
      const newDenoms = { ...prev.denominations, [bill]: (prev.denominations[bill] || 0) + 1 }
      const newAmount = Object.entries(newDenoms).reduce((sum, [b, c]) => sum + (parseInt(b) * c), 0)
      return {
        ...prev,
        denominations: newDenoms,
        amount: newAmount.toString()
      }
    })
  }

  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showAdjModal || !adjForm.amount || !adjForm.reason) return

    try {
      await addCashAdjustment(
        showAdjModal, 
        parseFloat(adjForm.amount), 
        adjForm.reason, 
        adjForm.denominations
      )
      showToast.success(t('common.success' as any))
      setShowAdjModal(null)
      setAdjForm({ 
        amount: '', 
        reason: '', 
        denominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 } 
      })
    } catch {
      showToast.error(t('common.error' as any))
    }
  }

  const exchangeTotals = useMemo(() => {
    const totalOut = Object.entries(exchangeForm.outDenoms).reduce((sum, [b, c]) => sum + (parseInt(b) * c), 0)
    const totalIn = Object.entries(exchangeForm.inDenoms).reduce((sum, [b, c]) => sum + (parseInt(b) * c), 0)
    return { totalOut, totalIn }
  }, [exchangeForm])

  const handleAddExchange = async (e: React.FormEvent) => {
    e.preventDefault()
    const { totalOut, totalIn } = exchangeTotals
    if (totalOut === 0 || totalOut !== totalIn) {
      showToast.error(t('stats.error.match' as any))
      return
    }

    setLoading(true)
    try {
      const combinedDenoms: Record<number, number> = {}
      ;[1, 5, 10, 20, 50, 100].forEach(bill => {
        const net = (exchangeForm.inDenoms[bill] || 0) - (exchangeForm.outDenoms[bill] || 0)
        if (net !== 0) combinedDenoms[bill] = net
      })

      await addCashAdjustment('ADDITION', 0, `Exchanged RM${totalOut}`, combinedDenoms)
      
      showToast.success(t('common.success' as any))
      setShowExchangeModal(false)
      setExchangeForm({
        outDenoms: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
        inDenoms: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 }
      })
    } catch {
      showToast.error(t('common.error' as any))
    } finally {
      setLoading(false)
    }
  }

  const handleAdvBillClick = (bill: number) => {
    setAdvForm(prev => {
      const newDenoms = { ...prev.denominations, [bill]: (prev.denominations[bill] || 0) + 1 }
      const newAmount = Object.entries(newDenoms).reduce((sum, [b, c]) => sum + (parseInt(b) * c), 0)
      return {
        ...prev,
        denominations: newDenoms,
        amount: newAmount.toString()
      }
    })
  }

  const handleAddAdvance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!advForm.attendanceId || !advForm.amount) return
    
    setLoading(true)
    try {
      const att = attendance.find(a => a.id === advForm.attendanceId)
      const staffName = staffMap[att.staffId]?.name || staffMap[att.staffId]?.displayName || 'Staff'
      
      await recordStaffAdvance(
        att.staffId,
        staffName,
        parseFloat(advForm.amount),
        att.id,
        advForm.denominations as any
      )
      
      showToast.success(t('common.success' as any))
      setShowAdvanceModal(false)
      setAdvForm({ 
        attendanceId: '', 
        amount: '',
        denominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 }
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAdjustment = (id: string) => {
    toast((toastItem) => (
      <div className="flex flex-col gap-3 p-1 min-w-[280px]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="font-black text-zinc-900 dark:text-white text-base">
              {language === 'ms' ? 'Padam pelarasan?' : 'Delete adjustment?'}
            </p>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">
              {language === 'ms' ? 'Rekod ini akan dipadamkan dari sistem.' : 'This record will be removed from system.'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-2">
          <button
            onClick={() => toast.dismiss(toastItem.id)}
            className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
          >
            {t('common.cancel' as any)}
          </button>
          <button
            onClick={async () => {
              toast.dismiss(toastItem.id);
              try {
                await deleteCashAdjustment(id);
                showToast.success(t('common.success' as any));
              } catch {
                showToast.error(t('common.error' as any));
              }
            }}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95 uppercase tracking-wider"
          >
            {t('common.delete' as any)}
          </button>
        </div>
      </div>
    ), {
      duration: 6000,
      position: 'top-center',
    });
  };

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-950 dark:text-white transition-colors duration-200">
      {/* Ensure Toaster is present so toast() calls are visible */}
      <Toaster />
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 lg:pb-8">
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

        {/* Mobile Toggle for Cash Drawer */}
        <div className="lg:hidden mt-8 mb-4">
          <button
            onClick={() => setIsCashDrawerOpen(!isCashDrawerOpen)}
            className="w-full flex items-center justify-between p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.5rem] shadow-xl active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-left">
                <span className="block text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                  {t('stats.cashDrawer' as any)}
                </span>
                <span className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  RM {cashBreakdown.grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
            {isCashDrawerOpen ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
          </button>
        </div>

        {/* Cashier Box Breakdown */}
        <div className={`mt-8 lg:mt-12 animate-in fade-in slide-in-from-top-4 duration-500 ${isCashDrawerOpen ? 'block' : 'hidden'} lg:block`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Banknote className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">
                  {t('stats.cashDrawer' as any)}
                </h3>
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest whitespace-nowrap">
                    {t('stats.cashDrawer.total' as any)}: <span className="text-emerald-600 dark:text-emerald-400 font-black ml-1">RM {cashBreakdown.grandTotal.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:flex gap-2">
                    <button 
                      onClick={() => setShowAdjModal('ADDITION')}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" /> {t('stats.addCash' as any)}
                    </button>
                    <button 
                      onClick={() => setShowAdjModal('EXPENSE')}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider shadow-lg shadow-red-500/20 active:scale-95"
                    >
                      <Minus className="w-3.5 h-3.5" /> {t('stats.addExpense' as any)}
                    </button>
                    <button 
                      onClick={() => setShowAdvanceModal(true)}
                      className="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider active:scale-95"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> {t('staff.addAdvance' as any)}
                    </button>
                    <button 
                      onClick={() => setShowExchangeModal(true)}
                      className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider active:scale-95 border border-zinc-300 dark:border-zinc-700"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" /> {t('stats.exchange' as any)}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Detailed Breakdown Tags */}
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex sm:flex-wrap gap-2 mt-2 lg:mt-0">
                <div className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center gap-2 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tight">
                    {t('stats.salesCash' as any)}: 
                    <span className="ml-1 text-zinc-900 dark:text-white">{formatCurrency(cashBreakdown.totalCashValue)}</span>
                  </span>
                </div>
                <div className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center gap-2 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tight">
                    {t('stats.totalAdditions' as any)}: 
                    <span className="ml-1 text-indigo-600 dark:text-indigo-400">+{formatCurrency(cashBreakdown.totalAdditions)}</span>
                  </span>
                </div>
                <div className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center gap-2 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-tight">
                    {t('stats.totalExpenses' as any)}: 
                    <span className="ml-1 text-red-600 dark:text-red-400">-{formatCurrency(cashBreakdown.totalExpenses)}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Bill Grid */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {[1, 5, 10, 20, 50, 100].map((bill) => {
                const count = cashBreakdown.breakdown[bill] || 0
                const colors: Record<number, string> = {
                  1: 'from-blue-500/20 to-blue-600/5 text-blue-600',
                  5: 'from-green-500/20 to-green-600/5 text-green-600',
                  10: 'from-red-500/20 to-red-600/5 text-red-600',
                  20: 'from-orange-500/20 to-orange-600/5 text-orange-600',
                  50: 'from-cyan-500/20 to-cyan-600/5 text-cyan-600',
                  100: 'from-purple-500/20 to-purple-600/5 text-purple-600',
                }
                
                return (
                  <div 
                    key={bill}
                    className={`bg-gradient-to-br ${colors[bill]} border border-white/10 dark:border-white/5 rounded-2xl p-4 sm:p-5 shadow-sm transition-transform hover:scale-[1.02]`}
                  >
                    <div className="flex justify-between items-start mb-3 sm:mb-4">
                      <span className="text-xs sm:text-sm font-black opacity-60 uppercase">RM{bill}</span>
                      <div className="px-2 py-1 rounded-md bg-white/40 dark:bg-black/20 text-[10px] font-black">
                        x{count}
                      </div>
                    </div>
                    <div className="text-2xl font-black">
                      RM {(bill * count).toFixed(0)}
                    </div>
                    <div className="mt-1 text-[10px] font-bold opacity-50 uppercase tracking-tighter">
                      Subtotal
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Adjustments Log */}
            <div className="lg:col-span-1">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                {t('stats.adjustments' as any)}
              </h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {adjustments.length === 0 ? (
                  <div className="text-center py-12 opacity-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                    <p className="text-sm font-medium text-zinc-500">{t('stats.noAdjustments' as any)}</p>
                  </div>
                ) : (
                  adjustments.map((adj) => (
                    <div key={adj.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${adj.type === 'ADDITION' ? 'bg-blue-500/10 text-blue-600' : 'bg-red-500/10 text-red-600'}`}>
                          {adj.type === 'ADDITION' ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-zinc-900 dark:text-white">{adj.reason}</div>
                          <div className="text-[10px] text-zinc-500 uppercase font-bold">
                            {adj.timestamp?.toDate ? adj.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`text-sm font-black ${adj.type === 'ADDITION' ? 'text-blue-600' : 'text-red-600'}`}>
                          {adj.type === 'ADDITION' ? '+' : '-'} {formatCurrency(adj.amount)}
                        </div>
                        <button 
                          onClick={() => handleDeleteAdjustment(adj.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      {/* Adjustment Modal */}
      {showAdjModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleAddAdjustment} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                {showAdjModal === 'ADDITION' ? t('stats.addCash' as any) : t('stats.addExpense' as any)}
              </h3>
              <button type="button" onClick={() => setShowAdjModal(null)} className="p-2 text-zinc-400 hover:text-white"><X /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">{t('stats.amount' as any)}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-lg font-bold cursor-not-allowed opacity-70"
                  value={adjForm.amount}
                  readOnly
                  placeholder="0.00"
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">
                    {t('payment.changeBills' as any)}
                  </label>
                  <button
                    type="button"
                    onClick={() => setAdjForm(prev => ({ ...prev, amount: '', denominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 } }))}
                    className="text-[10px] font-bold text-blue-600 uppercase"
                  >
                    {t('payment.clearCash' as any)}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 5, 10, 20, 50, 100].map((bill) => {
                    const count = adjForm.denominations[bill] || 0
                    const colors: Record<number, string> = {
                      1: 'border-blue-500/30 text-blue-600',
                      5: 'border-green-500/30 text-green-600',
                      10: 'border-red-500/30 text-red-600',
                      20: 'border-orange-500/30 text-orange-600',
                      50: 'border-cyan-500/30 text-cyan-600',
                      100: 'border-purple-500/30 text-purple-600',
                    }
                    return (
                      <button
                        key={bill}
                        type="button"
                        onClick={() => handleAdjBillClick(bill)}
                        className={`relative py-3 rounded-xl border-2 font-black transition-all active:scale-95 ${
                          count > 0 ? colors[bill] + ' bg-zinc-50 dark:bg-zinc-800' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400'
                        }`}
                      >
                        RM{bill}
                        {count > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-900 text-white text-[10px] rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900">
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">{t('stats.reason' as any)}</label>
                <input
                  type="text"
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold"
                  value={adjForm.reason}
                  onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
                  placeholder={showAdjModal === 'ADDITION' ? 'e.g., Starting Float' : 'e.g., Buy Soap'}
                />
              </div>
            </div>
            <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 flex gap-3">
              <button type="button" onClick={() => setShowAdjModal(null)} className="flex-1 py-3 font-bold text-zinc-500">{t('common.cancel' as any)}</button>
              <button 
                type="submit" 
                className={`flex-[2] py-3 rounded-xl font-bold text-white shadow-lg ${showAdjModal === 'ADDITION' ? 'bg-blue-600 shadow-blue-500/20' : 'bg-red-600 shadow-red-500/20'}`}
              >
                {t('common.confirm' as any)}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cash Exchange Modal */}
      {showExchangeModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleAddExchange} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-2xl shadow-2xl animate-in zoom-in duration-200 my-auto">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-500" /> {t('stats.exchangeBills' as any)}
              </h3>
              <button type="button" onClick={() => setShowExchangeModal(false)} className="p-2 text-zinc-400 hover:text-white"><X /></button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Giving Out */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-black text-red-500 uppercase tracking-widest">{t('stats.givingOut' as any)}</label>
                  <span className="text-lg font-black text-red-600">RM {exchangeTotals.totalOut}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 5, 10, 20, 50, 100].map((bill) => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => setExchangeForm(p => ({ ...p, outDenoms: { ...p.outDenoms, [bill]: (p.outDenoms[bill] || 0) + 1 } }))}
                      className={`relative py-3 rounded-xl border-2 font-black transition-all active:scale-95 ${exchangeForm.outDenoms[bill] > 0 ? 'border-red-500/50 bg-red-500/5 text-red-600' : 'border-zinc-100 dark:border-zinc-800 text-zinc-400'}`}
                    >
                      RM{bill}
                      {exchangeForm.outDenoms[bill] > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[10px] rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900">{exchangeForm.outDenoms[bill]}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Taking In */}
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-black text-emerald-500 uppercase tracking-widest">{t('stats.takingIn' as any)}</label>
                  <span className="text-lg font-black text-emerald-600">RM {exchangeTotals.totalIn}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 5, 10, 20, 50, 100].map((bill) => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => setExchangeForm(p => ({ ...p, inDenoms: { ...p.inDenoms, [bill]: (p.inDenoms[bill] || 0) + 1 } }))}
                      className={`relative py-3 rounded-xl border-2 font-black transition-all active:scale-95 ${exchangeForm.inDenoms[bill] > 0 ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-600' : 'border-zinc-100 dark:border-zinc-800 text-zinc-400'}`}
                    >
                      RM{bill}
                      {exchangeForm.inDenoms[bill] > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-600 text-white text-[10px] rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900">{exchangeForm.inDenoms[bill]}</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/50 flex flex-col gap-4">
               <div className={`text-center p-3 rounded-xl text-xs font-bold ${exchangeTotals.totalOut === exchangeTotals.totalIn && exchangeTotals.totalOut > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                  {exchangeTotals.totalOut === exchangeTotals.totalIn && exchangeTotals.totalOut > 0 
                    ? t('stats.matchSuccess' as any) 
                    : `${t('stats.difference' as any)} ${Math.abs(exchangeTotals.totalOut - exchangeTotals.totalIn).toFixed(2)}`}
               </div>
               <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setExchangeForm({ outDenoms: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 }, inDenoms: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 } })} 
                  className="flex-1 py-3 font-bold text-zinc-500"
                >
                  {t('stats.reset' as any)}
                </button>
                <button 
                  type="submit" 
                  disabled={exchangeTotals.totalOut === 0 || exchangeTotals.totalOut !== exchangeTotals.totalIn || loading}
                  className="flex-[2] py-3 bg-blue-600 disabled:opacity-50 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20"
                >
                  {loading ? t('common.loading' as any) : t('stats.confirmExchange' as any)}
                </button>
               </div>
            </div>
          </form>
        </div>
      )}

      {/* Staff Advance Modal */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleAddAdvance} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{t('staff.addAdvance' as any)}</h3>
              <button type="button" onClick={() => setShowAdvanceModal(false)} className="p-2 text-zinc-400 hover:text-white"><X /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">{t('staff.name' as any)}</label>
                <select
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold"
                  value={advForm.attendanceId}
                  onChange={(e) => setAdvForm({ ...advForm, attendanceId: e.target.value })}
                >
                  <option value="">Select Staff</option>
                  {attendance.map((row) => (
                    <option key={row.id} value={row.id}>
                      {staffMap[row.staffId]?.name || staffMap[row.staffId]?.displayName || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">
                    {t('payment.changeBills' as any)}
                  </label>
                  <button
                    type="button"
                    onClick={() => setAdvForm(prev => ({ ...prev, amount: '', denominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 } }))}
                    className="text-[10px] font-bold text-blue-600 uppercase"
                  >
                    {t('payment.clearCash' as any)}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 5, 10, 20, 50, 100].map((bill) => {
                    const count = advForm.denominations[bill] || 0
                    const colors: Record<number, string> = {
                      1: 'border-blue-500/30 text-blue-600',
                      5: 'border-green-500/30 text-green-600',
                      10: 'border-red-500/30 text-red-600',
                      20: 'border-orange-500/30 text-orange-600',
                      50: 'border-cyan-500/30 text-cyan-600',
                      100: 'border-purple-500/30 text-purple-600',
                    }
                    return (
                      <button
                        key={bill}
                        type="button"
                        onClick={() => handleAdvBillClick(bill)}
                        className={`relative py-3 rounded-xl border-2 font-black transition-all active:scale-95 ${
                          count > 0 ? colors[bill] + ' bg-zinc-50 dark:bg-zinc-800' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400'
                        }`}
                      >
                        RM{bill}
                        {count > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-900 text-white text-[10px] rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900">
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">{t('stats.amount' as any)}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-lg font-bold cursor-not-allowed opacity-70"
                  value={advForm.amount}
                  readOnly
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 flex gap-3">
              <button type="button" onClick={() => setShowAdvanceModal(false)} className="flex-1 py-3 font-bold text-zinc-500" disabled={loading}>{t('common.cancel' as any)}</button>
              <button 
                type="submit" 
                disabled={loading}
                className="flex-[2] py-3 bg-blue-600 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                {loading ? 'Processing...' : t('common.confirm' as any)}
              </button>
            </div>
          </form>
        </div>
      )}

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