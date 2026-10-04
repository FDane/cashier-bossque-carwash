'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import CarEntryIntake from '@/components/CarEntryIntake'
import CashierCheckout from '@/components/CashierCheckout'
import CashManagementPanel from '@/components/CashManagementPanel'
import { useTransactions } from '@/hooks/useTransactions'
import { useLanguage } from '@/hooks/useLanguage'
import { useSystemStatus } from '@/hooks/useSystemStatus'
import { 
  Wallet, 
  X, 
  Printer,
  Monitor,
  RefreshCw,
  Car,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeftRight,
} from 'lucide-react'
import { listenToTodayAdjustments, addCashAdjustment, getStaffList, listenToTodayAttendance, recordStaffAdvance, listenToLatestCashCount, submitCashCount } from '@/lib/firebaseService'
import { showToast } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import type { CashCount, CashDenominations } from '@/types'

type TabState = 'intake' | 'cashier'
const EMPTY_DENOMINATIONS: CashDenominations = { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 }
const BILLS = [100, 50, 20, 10, 5, 1] as const

export default function Dashboard() {
  const { t, language } = useLanguage()
  const { printerOnline, kioskOnline, checkPrinter, checkKiosk } = useSystemStatus()
  const [activeTab, setActiveTab] = useState<TabState>('intake')
  const [isCarEntryOpen, setIsCarEntryOpen] = useState(true)
  
  const [adjustments, setAdjustments] = useState<any[]>([])
  const [showExchangeModal, setShowExchangeModal] = useState(false)
  const [showAdjModal, setShowAdjModal] = useState<'EXPENSE' | 'ADDITION' | null>(null)
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const [showCashCountModal, setShowCashCountModal] = useState(false)
  const [latestCashCount, setLatestCashCount] = useState<CashCount | null>(null)
  const [cashCountLoading, setCashCountLoading] = useState(true)
  const [cashCountError, setCashCountError] = useState(false)
  const [cashCountDenominations, setCashCountDenominations] = useState<CashDenominations>({ ...EMPTY_DENOMINATIONS })
  const [cashCountSaving, setCashCountSaving] = useState(false)
  const [cashierIdentity, setCashierIdentity] = useState<{ uid: string | null; name: string | null }>({ uid: null, name: null })
  const [selectedCashierId, setSelectedCashierId] = useState('')
  const [cashierLoading, setCashierLoading] = useState(true)
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

  const checkedInStaff = useMemo(() => attendance
    .filter((row) => !row.clockOutTime)
    .map((row) => ({ id: row.staffId, ...staffMap[row.staffId] }))
    .filter((staff, index, list) => list.findIndex((item) => item.id === staff.id) === index), [attendance, staffMap])
  const defaultCashier = checkedInStaff.find((staff) => staff.role === 'CASHIER' || staff.isCashier)
  const activeCashier = checkedInStaff.find((staff) => staff.id === selectedCashierId) || defaultCashier
  const activeCashierIdentity = {
    uid: activeCashier?.id || cashierIdentity.uid,
    name: activeCashier?.name || activeCashier?.displayName || cashierIdentity.name,
  }

  // Listen to PENDING transactions (intake queue)
  const {
    transactions: pendingTransactions,
    loading: pendingLoading,
  } = useTransactions('PENDING')

  useEffect(() => {
    const unsub = listenToTodayAdjustments(setAdjustments)
    const unsubCashCount = listenToLatestCashCount(
      (count) => { setLatestCashCount(count); setCashCountLoading(false); setCashCountError(false) },
      () => { setCashCountLoading(false); setCashCountError(true) },
    )
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCashierIdentity({ uid: user?.uid ?? null, name: user?.displayName || user?.email || null })
      setCashierLoading(false)
    })
    
    let unsubAttendance: any
    const setup = async () => {
      const list = await getStaffList()
      const map: Record<string, any> = {}
      list.forEach(s => map[s.id] = s)
      setStaffMap(map)
      unsubAttendance = await listenToTodayAttendance(setAttendance)
    }
    setup()

    return () => { unsub(); unsubCashCount(); unsubAuth(); if (unsubAttendance) unsubAttendance(); }
  }, [])

  // Prevent background scrolling when modals are open
  useEffect(() => {
    if (showAdjModal || showAdvanceModal || showExchangeModal || showCashCountModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [showAdjModal, showAdvanceModal, showExchangeModal, showCashCountModal])

  const countedTotal = useMemo(() => Object.entries(cashCountDenominations).reduce(
    (sum, [bill, quantity]) => sum + Number(bill) * quantity,
    0
  ), [cashCountDenominations])

  const updateCashCount = (bill: keyof CashDenominations, delta: number) => {
    setCashCountDenominations((current) => ({
      ...current,
      [bill]: Math.max(0, current[bill] + delta),
    }))
  }

  const handleSubmitCashCount = async (event: React.FormEvent) => {
    event.preventDefault()
    if (cashCountSaving) return
    setCashCountSaving(true)
    try {
      await submitCashCount({
        shiftId: null,
        terminalId: null,
        cashierId: activeCashierIdentity.uid,
        cashierName: activeCashierIdentity.name || t('cashManagement.cashierRole'),
        denominations: cashCountDenominations,
      })
      showToast.success(t('cashManagement.countSubmitted'))
      setCashCountDenominations({ ...EMPTY_DENOMINATIONS })
    } catch {
      showToast.error(t('cashManagement.countError'))
    } finally {
      setCashCountSaving(false)
    }
  }

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

  const StatusBadge = ({ online }: { online: boolean | null }) => {
    if (online === null) return (
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 animate-pulse" />
        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Checking</span>
      </div>
    )
    if (online) return (
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">Online</span>
      </div>
    )
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
        <span className="text-[10px] font-black text-red-600 dark:text-red-500 uppercase tracking-widest">Offline</span>
      </div>
    )
  }

  const openCashCount = () => {
    setShowCashCountModal(true)
  }

  const renderCashManagement = () => (
    <CashManagementPanel
      t={t}
      language={language}
      cashierName={activeCashierIdentity.name || t('cashManagement.cashierRole')}
      checkedInStaff={checkedInStaff}
      selectedCashierId={selectedCashierId || defaultCashier?.id || ''}
      onCashierChange={setSelectedCashierId}
      latestCashCount={latestCashCount}
      loading={cashCountLoading || cashierLoading}
      error={cashCountError}
      adjustments={adjustments}
      onCount={openCashCount}
      onCashIn={() => setShowAdjModal('ADDITION')}
      onCashOut={() => setShowAdjModal('EXPENSE')}
      onAdvance={() => setShowAdvanceModal(true)}
      onExchange={() => setShowExchangeModal(true)}
    />
  )

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-950 dark:text-white transition-colors duration-200">
      <Toaster />

      {/* System Status Bar */}
      <div className="hidden sm:block w-full bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800/50 px-4 sm:px-6 py-2 transition-colors duration-200">
        <div className="w-full flex items-center justify-end gap-8">
          <button
            onClick={checkPrinter}
            title={t('status.refreshPrinter' as any)}
            className="flex items-center gap-3 group hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <Printer className="w-3.5 h-3.5 text-zinc-400 group-hover:text-blue-500 transition-colors" />
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('common.printer' as any)}</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge online={printerOnline} />
              <RefreshCw className="w-2.5 h-2.5 text-zinc-300 dark:text-zinc-700 group-hover:rotate-180 transition-all duration-500" />
            </div>
          </button>

          <div className="w-px h-3 bg-zinc-200 dark:bg-zinc-800" />

          <button
            onClick={checkKiosk}
            title={t('status.refreshKiosk' as any)}
            className="flex items-center gap-3 group hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <Monitor className="w-3.5 h-3.5 text-zinc-400 group-hover:text-blue-500 transition-colors" />
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('common.kiosk' as any)}</span>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge online={kioskOnline} />
              <RefreshCw className="w-2.5 h-2.5 text-zinc-300 dark:text-zinc-700 group-hover:rotate-180 transition-all duration-500" />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Tab Navigation */}
      <div className="lg:hidden sticky top-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800 p-2">
        <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('intake')}
            className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all ${
              activeTab === 'intake' 
                ? 'bg-white dark:bg-zinc-800 shadow-sm text-blue-600 dark:text-blue-400' 
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Car className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-black uppercase tracking-tight">{t('intake.title' as any) || 'Rekod'}</span>
          </button>
          
          <button
            onClick={() => setActiveTab('cashier')}
            className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all ${
              activeTab === 'cashier' 
                ? 'bg-white dark:bg-zinc-800 shadow-sm text-green-600 dark:text-green-400' 
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <div className="relative">
              <Wallet className="w-5 h-5 mb-1" />
              {pendingTransactions.length > 0 && (
                <span className="absolute -top-1 -right-2 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {pendingTransactions.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-black uppercase tracking-tight">{t('cashier.title' as any) || 'Cashier'}</span>
          </button>
        </div>
      </div>

      <main className="w-full px-4 sm:px-6 py-4 sm:py-8 pb-32 lg:pb-8">
        
        {/* MOBILE VIEW */}
        <div className="block lg:hidden">
          {activeTab === 'intake' && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
              <CarEntryIntake />
            </div>
          )}
          {activeTab === 'cashier' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="mb-5"><CashManagementPanel t={t} language={language} cashierName={activeCashierIdentity.name || t('cashManagement.cashierRole')} checkedInStaff={checkedInStaff} selectedCashierId={selectedCashierId || defaultCashier?.id || ''} onCashierChange={setSelectedCashierId} latestCashCount={latestCashCount} loading={cashCountLoading || cashierLoading} error={cashCountError} onCount={openCashCount} compact /></div>
              <CashierCheckout
                pendingTransactions={pendingTransactions}
                loading={pendingLoading}
                printerOnline={printerOnline ?? false}
              />
            </div>
          )}
        </div>

        {/* DESKTOP VIEW - Full Screen 3 Column Layout */}
        <div className="hidden lg:flex flex-row gap-6 items-start">
          {/* Column 1: Rekod Kenderaan (Collapsible) */}
          <div className={`transition-all duration-300 ease-in-out shrink-0 relative ${isCarEntryOpen ? 'w-full lg:w-[400px] xl:w-[450px] opacity-100' : 'w-0 opacity-0 overflow-hidden hidden'}`}>
            <div className="absolute -right-4 top-2 z-10 hidden lg:block">
               {/* Spacer to avoid absolute button overflow cutoff, button moved out */}
            </div>
            {isCarEntryOpen && (
              <div className="bg-blue-50/60 dark:bg-blue-500/[0.05] border border-blue-100 dark:border-blue-900/30 rounded-[2.25rem] p-3 sm:p-4">
                <CarEntryIntake />
              </div>
            )}
          </div>

          {/* Toggle Button for Desktop */}
          <div className="hidden lg:flex items-start pt-2">
            <button 
              onClick={() => setIsCarEntryOpen(!isCarEntryOpen)}
              className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-500"
              title={isCarEntryOpen ? "Close Rekod Kenderaan" : "Open Rekod Kenderaan"}
            >
              {isCarEntryOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </button>
          </div>

          {/* Column 2: Cashier (~60% width) */}
          <div className="flex-[6_6_0%] min-w-[360px]">
            <div className="bg-zinc-50/70 dark:bg-zinc-900/40 border border-zinc-200/70 dark:border-zinc-800/60 rounded-[2.25rem] p-3 sm:p-4">
              <CashierCheckout
                pendingTransactions={pendingTransactions}
                loading={pendingLoading}
                printerOnline={printerOnline ?? false}
                isSidebarOpen={isCarEntryOpen}
              />
            </div>
          </div>

          {/* Column 3: Cash Management (~40% width) */}
          <div className="flex-[4_4_0%] min-w-[320px] max-w-[460px]">
            <div className="bg-emerald-50/50 dark:bg-emerald-500/[0.04] border border-emerald-100 dark:border-emerald-900/30 rounded-[2.25rem] p-3 sm:p-4 lg:sticky lg:top-6">
              {renderCashManagement()}
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

      {/* Blind Cash Count Modal */}
      {showCashCountModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSubmitCashCount} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in duration-200 my-auto">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{t('cashManagement.countTitle')}</h3>
                <p className="mt-1 text-xs text-zinc-500">{t('cashManagement.countInstruction')}</p>
              </div>
              <button type="button" onClick={() => setShowCashCountModal(false)} className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-white" aria-label={t('common.close')}>
                <X />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {BILLS.map((bill) => (
                <div key={bill} className="p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-zinc-900 dark:text-white">RM{bill}</span>
                    <span className="text-xs font-bold text-zinc-500">{formatCurrency(bill * cashCountDenominations[bill])}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => updateCashCount(bill, -1)} className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 font-black" aria-label={`${t('cashManagement.decrease')} RM${bill}`}>−</button>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={cashCountDenominations[bill]}
                      onChange={(event) => setCashCountDenominations((current) => ({ ...current, [bill]: Math.max(0, Math.floor(Number(event.target.value) || 0)) }))}
                      className="min-w-0 flex-1 h-10 text-center font-black bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                      aria-label={`${t('cashManagement.quantity')} RM${bill}`}
                    />
                    <button type="button" onClick={() => updateCashCount(bill, 1)} className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black" aria-label={`${t('cashManagement.increase')} RM${bill}`}>+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">{t('cashManagement.countedTotal')}</span>
                <span className="text-2xl font-black text-emerald-600">{formatCurrency(countedTotal)}</span>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCashCountModal(false)} className="flex-1 py-3 font-bold text-zinc-500" disabled={cashCountSaving}>{t('common.cancel')}</button>
                <button type="submit" disabled={cashCountSaving} className="flex-[2] py-3 bg-emerald-600 rounded-xl font-bold text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50">
                  {cashCountSaving ? t('common.loading') : t('cashManagement.submitCount')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-zinc-800 mt-12 py-6 px-4 transition-colors duration-200">
        <div className="w-full text-center text-gray-600 dark:text-zinc-500 text-sm">
          <p>
            © 2024 {t('app.footer' as any) || 'Bossque Carwash Management System. Built with Next.js & Firebase.'}
          </p>
        </div>
      </footer>
    </div>
  )
}