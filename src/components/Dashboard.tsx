'use client'

import React, { useMemo, useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import CarEntryIntake from '@/components/CarEntryIntake'
import CashierCheckout from '@/components/CashierCheckout'
import { useTransactions } from '@/hooks/useTransactions'
import { useLanguage } from '@/hooks/useLanguage'
import { useSystemStatus } from '@/hooks/useSystemStatus'
import { 
  Wallet, 
  Banknote, 
  Plus, 
  Minus, 
  X, 
  Trash2,
  UserPlus,
  ArrowLeftRight,
  Printer,
  Monitor,
  RefreshCw,
  LayoutDashboard
} from 'lucide-react'
import { listenToTodayAdjustments, addCashAdjustment, deleteCashAdjustment, getStaffList, listenToTodayAttendance, recordStaffAdvance } from '@/lib/firebaseService'
import { showToast } from '@/lib/toast'
import { formatCurrency, getKLDateString } from '@/lib/utils'

export default function Dashboard() {
  const { t, language } = useLanguage()
  const { printerOnline, kioskOnline, checkPrinter, checkKiosk } = useSystemStatus()
  
  // Mobile pane view state
  const [activePane, setActivePane] = useState<'INTAKE' | 'QUEUE' | 'CASH'>('QUEUE')
  
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

  const StatusBadge = ({ online }: { online: boolean | null }) => {
    if (online === null) return (
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 animate-pulse" />
        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Checking</span>
      </div>
    )
    if (online) return (
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">Online</span>
      </div>
    )
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
        <span className="text-[10px] font-black text-red-600 dark:text-red-500 uppercase tracking-widest">Offline</span>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-surface-a0 text-zinc-950 dark:text-zinc-50 overflow-hidden font-sans">
      <Toaster />

      {/* System Status Bar */}
      <div className="flex-none border-b border-surface-a20 bg-surface-a0 px-4 sm:px-6 py-2.5 flex items-center justify-between lg:justify-end gap-6 z-10 relative">
        <div className="lg:hidden flex gap-4">
          <button 
            onClick={() => setActivePane('INTAKE')}
            className={`text-xs font-bold uppercase tracking-wider px-2 py-1 border-b-2 ${activePane === 'INTAKE' ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white' : 'border-transparent text-zinc-400'}`}
          >
            {t('intake.title' as any)}
          </button>
          <button 
            onClick={() => setActivePane('QUEUE')}
            className={`text-xs font-bold uppercase tracking-wider px-2 py-1 border-b-2 ${activePane === 'QUEUE' ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white' : 'border-transparent text-zinc-400'}`}
          >
            Queue ({pendingTransactions.length})
          </button>
          <button 
            onClick={() => setActivePane('CASH')}
            className={`text-xs font-bold uppercase tracking-wider px-2 py-1 border-b-2 ${activePane === 'CASH' ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white' : 'border-transparent text-zinc-400'}`}
          >
            Drawer
          </button>
        </div>
        
        <div className="flex items-center gap-6 ml-auto">
          <button
            onClick={checkPrinter}
            title={t('status.refreshPrinter' as any)}
            className="flex items-center gap-3 group hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <Printer className="w-3.5 h-3.5 text-zinc-400 group-hover:text-blue-500 transition-colors" />
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest hidden sm:inline">{t('common.printer' as any)}</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge online={printerOnline} />
              <RefreshCw className="w-2.5 h-2.5 text-zinc-400 group-hover:rotate-180 transition-all duration-500" />
            </div>
          </button>

          <div className="w-px h-3 bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />

          <button
            onClick={checkKiosk}
            title={t('status.refreshKiosk' as any)}
            className="flex items-center gap-3 group hover:opacity-80 transition-opacity hidden sm:flex"
          >
            <div className="flex items-center gap-2">
              <Monitor className="w-3.5 h-3.5 text-zinc-400 group-hover:text-blue-500 transition-colors" />
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('common.kiosk' as any)}</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge online={kioskOnline} />
              <RefreshCw className="w-2.5 h-2.5 text-zinc-400 group-hover:rotate-180 transition-all duration-500" />
            </div>
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 p-4 lg:p-6 overflow-hidden">
        
        {/* Pane 1: Intake (Col 1-3) */}
        <div className={`lg:col-span-3 border border-surface-a20 rounded-2xl bg-surface-a10 flex flex-col h-full overflow-hidden ${activePane === 'INTAKE' ? 'block' : 'hidden lg:flex'}`}>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <CarEntryIntake />
          </div>
        </div>

        {/* Pane 2: Queue (Col 4-9) */}
        <div className={`lg:col-span-6 border border-surface-a20 rounded-2xl bg-surface-a10 flex flex-col h-full overflow-hidden ${activePane === 'QUEUE' ? 'block' : 'hidden lg:flex'}`}>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <CashierCheckout
              pendingTransactions={pendingTransactions}
              loading={pendingLoading}
              printerOnline={printerOnline ?? false}
            />
          </div>
        </div>

        {/* Pane 3: Cash Drawer (Col 10-12) */}
        <div className={`lg:col-span-3 border border-surface-a20 rounded-2xl bg-surface-a10 flex flex-col h-full overflow-hidden ${activePane === 'CASH' ? 'block' : 'hidden lg:flex'}`}>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <div className="flex flex-col gap-6">
              
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Banknote className="w-5 h-5 text-zinc-900 dark:text-white" />
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                    {t('stats.cashDrawer' as any)}
                  </h3>
                </div>
                
                <div className="bg-surface-tonal border border-surface-a20 rounded-xl p-4 mt-2 mb-2">
                  <div className="text-3xl font-black text-success-a0">
                    RM {cashBreakdown.grandTotal.toFixed(2)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setShowAdjModal('ADDITION')}
                    className="px-3 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 transition flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t('stats.addCash' as any)}
                  </button>
                  <button 
                    onClick={() => setShowAdjModal('EXPENSE')}
                    className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900 transition flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider"
                  >
                    <Minus className="w-3.5 h-3.5" /> {t('stats.addExpense' as any)}
                  </button>
                  <button 
                    onClick={() => setShowAdvanceModal(true)}
                    className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900 transition flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> {t('staff.addAdvance' as any)}
                  </button>
                  <button 
                    onClick={() => setShowExchangeModal(true)}
                    className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900 transition flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-wider"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" /> {t('stats.exchange' as any)}
                  </button>
                </div>

                <div className="space-y-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-zinc-500">{t('stats.salesCash' as any)}</span>
                    <span className="font-bold text-zinc-900 dark:text-white">{formatCurrency(cashBreakdown.totalCashValue)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-zinc-500">{t('stats.totalAdditions' as any)}</span>
                    <span className="font-bold text-zinc-900 dark:text-white">+{formatCurrency(cashBreakdown.totalAdditions)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-zinc-500">{t('stats.totalExpenses' as any)}</span>
                    <span className="font-bold text-zinc-900 dark:text-white">-{formatCurrency(cashBreakdown.totalExpenses)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                {[1, 5, 10, 20, 50, 100].map((bill) => {
                  const count = cashBreakdown.breakdown[bill] || 0
                  return (
                    <div 
                      key={bill}
                      className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-black text-zinc-500 uppercase">RM{bill}</span>
                        <div className="text-[10px] font-bold text-zinc-400">x{count}</div>
                      </div>
                      <div className="text-lg font-black text-zinc-900 dark:text-white">
                        RM {(bill * count).toFixed(0)}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-3 uppercase tracking-wider">
                  {t('stats.adjustments' as any)}
                </h3>
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {adjustments.length === 0 ? (
                    <div className="text-xs font-medium text-zinc-500 py-4">No adjustments today</div>
                  ) : (
                    adjustments.map((adj) => (
                      <div key={adj.id} className="border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-2 flex items-start justify-between group">
                        <div>
                          <div className="text-xs font-bold text-zinc-900 dark:text-white">{adj.reason}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            {adj.timestamp?.toDate ? adj.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`text-xs font-black ${adj.type === 'ADDITION' ? 'text-zinc-900 dark:text-white' : 'text-zinc-500'}`}>
                            {adj.type === 'ADDITION' ? '+' : '-'} {formatCurrency(adj.amount)}
                          </div>
                          <button 
                            onClick={() => handleDeleteAdjustment(adj.id)}
                            className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
            </div>
          </div>
        </div>
      </main>

      {/* Adjustment Modal */}
      {showAdjModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <form onSubmit={handleAddAdjustment} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-md shadow-2xl">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                {showAdjModal === 'ADDITION' ? t('stats.addCash' as any) : t('stats.addExpense' as any)}
              </h3>
              <button type="button" onClick={() => setShowAdjModal(null)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">{t('stats.amount' as any)}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-lg font-mono font-bold cursor-not-allowed opacity-70 outline-none"
                  value={adjForm.amount}
                  readOnly
                  placeholder="0.00"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    {t('payment.changeBills' as any)}
                  </label>
                  <button
                    type="button"
                    onClick={() => setAdjForm(prev => ({ ...prev, amount: '', denominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 } }))}
                    className="text-[10px] font-bold text-zinc-900 dark:text-white uppercase tracking-wider"
                  >
                    {t('payment.clearCash' as any)}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 5, 10, 20, 50, 100].map((bill) => {
                    const count = adjForm.denominations[bill] || 0
                    return (
                      <button
                        key={bill}
                        type="button"
                        onClick={() => handleAdjBillClick(bill)}
                        className={`relative py-3 border font-black transition-all ${
                          count > 0 ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white' : 'bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-400'
                        }`}
                      >
                        RM{bill}
                        {count > 0 && (
                          <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">{t('stats.reason' as any)}</label>
                <input
                  type="text"
                  required
                  className="w-full bg-transparent border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm font-bold outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
                  value={adjForm.reason}
                  onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
                  placeholder={showAdjModal === 'ADDITION' ? 'e.g., Starting Float' : 'e.g., Buy Soap'}
                />
              </div>
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 bg-zinc-50 dark:bg-zinc-900/50">
              <button type="button" onClick={() => setShowAdjModal(null)} className="flex-1 py-3 font-bold text-zinc-500 text-sm uppercase tracking-wider">{t('common.cancel' as any)}</button>
              <button 
                type="submit" 
                className="flex-1 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-sm uppercase tracking-wider"
              >
                {t('common.confirm' as any)}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cash Exchange Modal */}
      {showExchangeModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <form onSubmit={handleAddExchange} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl shadow-2xl">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4" /> {t('stats.exchangeBills' as any)}
              </h3>
              <button type="button" onClick={() => setShowExchangeModal(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Giving Out */}
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('stats.givingOut' as any)}</label>
                  <span className="text-lg font-mono font-black text-zinc-900 dark:text-white">RM {exchangeTotals.totalOut}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 5, 10, 20, 50, 100].map((bill) => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => setExchangeForm(p => ({ ...p, outDenoms: { ...p.outDenoms, [bill]: (p.outDenoms[bill] || 0) + 1 } }))}
                      className={`relative py-3 border font-black transition-all ${exchangeForm.outDenoms[bill] > 0 ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-400'}`}
                    >
                      RM{bill}
                      {exchangeForm.outDenoms[bill] > 0 && <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{exchangeForm.outDenoms[bill]}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Taking In */}
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('stats.takingIn' as any)}</label>
                  <span className="text-lg font-mono font-black text-zinc-900 dark:text-white">RM {exchangeTotals.totalIn}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 5, 10, 20, 50, 100].map((bill) => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => setExchangeForm(p => ({ ...p, inDenoms: { ...p.inDenoms, [bill]: (p.inDenoms[bill] || 0) + 1 } }))}
                      className={`relative py-3 border font-black transition-all ${exchangeForm.inDenoms[bill] > 0 ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-400'}`}
                    >
                      RM{bill}
                      {exchangeForm.inDenoms[bill] > 0 && <span className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">{exchangeForm.inDenoms[bill]}</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col gap-4">
               <div className={`p-3 text-xs font-bold uppercase tracking-wider text-center border ${exchangeTotals.totalOut === exchangeTotals.totalIn && exchangeTotals.totalOut > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'}`}>
                  {exchangeTotals.totalOut === exchangeTotals.totalIn && exchangeTotals.totalOut > 0 
                    ? t('stats.matchSuccess' as any) 
                    : `${t('stats.difference' as any)} ${Math.abs(exchangeTotals.totalOut - exchangeTotals.totalIn).toFixed(2)}`}
               </div>
               <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setExchangeForm({ outDenoms: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 }, inDenoms: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 } })} 
                  className="flex-1 py-3 font-bold text-zinc-500 text-sm uppercase tracking-wider"
                >
                  {t('stats.reset' as any)}
                </button>
                <button 
                  type="submit" 
                  disabled={exchangeTotals.totalOut === 0 || exchangeTotals.totalOut !== exchangeTotals.totalIn || loading}
                  className="flex-1 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 disabled:opacity-50 font-bold text-sm uppercase tracking-wider"
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
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <form onSubmit={handleAddAdvance} className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-md shadow-2xl">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-wider">{t('staff.addAdvance' as any)}</h3>
              <button type="button" onClick={() => setShowAdvanceModal(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">{t('staff.name' as any)}</label>
                <select
                  required
                  className="w-full bg-transparent border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm font-bold outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
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

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    {t('payment.changeBills' as any)}
                  </label>
                  <button
                    type="button"
                    onClick={() => setAdvForm(prev => ({ ...prev, amount: '', denominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 } }))}
                    className="text-[10px] font-bold text-zinc-900 dark:text-white uppercase tracking-wider"
                  >
                    {t('payment.clearCash' as any)}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 5, 10, 20, 50, 100].map((bill) => {
                    const count = advForm.denominations[bill] || 0
                    return (
                      <button
                        key={bill}
                        type="button"
                        onClick={() => handleAdvBillClick(bill)}
                        className={`relative py-3 border font-black transition-all ${
                          count > 0 ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white' : 'bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-400'
                        }`}
                      >
                        RM{bill}
                        {count > 0 && (
                          <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">{t('stats.amount' as any)}</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-lg font-mono font-bold cursor-not-allowed opacity-70 outline-none"
                  value={advForm.amount}
                  readOnly
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 bg-zinc-50 dark:bg-zinc-900/50">
              <button type="button" onClick={() => setShowAdvanceModal(false)} className="flex-1 py-3 font-bold text-zinc-500 text-sm uppercase tracking-wider" disabled={loading}>{t('common.cancel' as any)}</button>
              <button 
                type="submit" 
                disabled={loading}
                className="flex-1 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 disabled:opacity-50 font-bold text-sm uppercase tracking-wider"
              >
                {loading ? 'Processing...' : t('common.confirm' as any)}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
