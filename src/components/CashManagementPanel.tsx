'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Calculator, Clock3, Minus, Plus, ShieldCheck, UserPlus, Users, WalletCards } from 'lucide-react'
import type { TranslationKey } from '@/i18n/translations'
import type { CashCount } from '@/types'
import { formatCurrency, getKLDateString } from '@/lib/utils'

type Translate = (key: TranslationKey) => string

interface CashManagementPanelProps {
  t: Translate
  language: 'en' | 'ms'
  cashierName: string
  cashierProfileImage?: string
  checkedInStaff?: Array<{ id: string; name?: string; displayName?: string; profileImage?: string }>
  selectedCashierId?: string
  onCashierChange?: (staffId: string) => void
  latestCashCount: CashCount | null
  cashCounts?: CashCount[]
  loading: boolean
  error: boolean
  adjustments?: any[]
  compact?: boolean
  onCount: () => void
  onCashIn?: () => void
  onCashOut?: () => void
  onAdvance?: () => void
  onExchange?: () => void
}

function toDate(value: any): Date | null {
  if (!value) return null
  const date = value.toDate ? value.toDate() : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export default function CashManagementPanel({
  t, language, cashierName, cashierProfileImage, checkedInStaff = [], selectedCashierId = '', onCashierChange, latestCashCount, cashCounts = [], loading, error, adjustments = [], compact = false,
  onCount, onCashIn, onCashOut, onAdvance, onExchange,
}: CashManagementPanelProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const status = useMemo(() => {
    const createdAt = toDate(latestCashCount?.createdAt)
    const isToday = createdAt && getKLDateString(createdAt) === getKLDateString(new Date(now))
    if (!createdAt || !isToday) return { key: 'first' as const, minutes: null, createdAt }
    const minutes = Math.max(0, Math.floor((now - createdAt.getTime()) / 60_000))
    return { key: minutes < 45 ? 'current' as const : minutes < 60 ? 'soon' as const : 'due' as const, minutes, createdAt }
  }, [latestCashCount, now])

  const statusStyle = {
    current: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    soon: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    due: 'bg-red-500/10 text-red-700 dark:text-red-300',
    first: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  }[status.key]
  const statusLabel = t(`cashManagement.status.${status.key}` as TranslationKey)
  const locale = language === 'ms' ? 'ms-MY' : 'en-MY'
  const relative = status.minutes === null
    ? t('cashManagement.noCounts')
    : status.minutes < 1
      ? t('cashManagement.justSubmitted')
      : status.minutes < 60
        ? `${status.minutes} ${t('cashManagement.minutesAgo')}`
        : `${Math.floor(status.minutes / 60)}${t('cashManagement.hourShort')} ${status.minutes % 60}${t('cashManagement.minuteShort')} ${t('cashManagement.ago')}`

  const identity = (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{t('cashManagement.currentCashier')}</div>
      {loading ? <div className="mt-3 flex animate-pulse items-center gap-3"><div className="h-10 w-10 rounded-xl bg-zinc-200 dark:bg-zinc-800" /><div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800" /></div> : (
        <div className="mt-3 flex items-center gap-3">
          {cashierProfileImage ? <img src={cashierProfileImage} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-800"><Users className="h-5 w-5 text-zinc-500" /></div>}
          <div><div className="font-bold text-zinc-900 dark:text-white">{cashierName}</div><div className="text-xs text-zinc-500">{t('cashManagement.cashierRole')}</div></div>
        </div>
      )}
      {onCashierChange && checkedInStaff.length > 0 && <label className="mt-4 block text-xs font-semibold text-zinc-500">
        {t('cashManagement.selectCashier')}
        <select value={selectedCashierId} onChange={(event) => onCashierChange(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white">
          <option value="">{t('cashManagement.useSignedInCashier')}</option>
          {checkedInStaff.map((staff) => <option key={staff.id} value={staff.id}>{staff.name || staff.displayName || staff.id}</option>)}
        </select>
      </label>}
    </div>
  )

  return (
    <div className={`flex w-full flex-col ${compact ? 'gap-3' : 'gap-5 animate-in fade-in slide-in-from-top-4 duration-500'}`}>
      {!compact && <div className="flex items-center gap-3"><div className="rounded-xl bg-zinc-900 p-2.5 dark:bg-zinc-100"><WalletCards className="h-5 w-5 text-white dark:text-zinc-900" /></div><h3 className="text-xl font-bold text-zinc-900 dark:text-white">{t('cashManagement.title')}</h3></div>}

      <div className="rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-200/70 dark:bg-indigo-950/30 dark:ring-indigo-800/60">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-indigo-600 p-2 text-white"><ShieldCheck className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-950 dark:text-indigo-100">{t('cashManagement.blindCount')}</p><span className="rounded-full bg-indigo-600/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-300"><span className="mr-1">●</span>{t('cashManagement.active')}</span></div><p className="mt-2 text-xs leading-5 text-indigo-800/80 dark:text-indigo-200/70">{t('cashManagement.blindDescription')}</p></div>
        </div>
      </div>

      {identity}

      <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="flex items-center justify-between gap-3"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{t('cashManagement.countStatus')}</div>{!loading && <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${statusStyle}`}><span className="mr-1">●</span>{statusLabel}</span>}</div>
        {loading ? <div className="mt-4 space-y-3 animate-pulse"><div className="h-7 w-32 rounded bg-zinc-200 dark:bg-zinc-800" /><div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-800" /></div> : error ? <div className="mt-4"><p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{t('cashManagement.loadError')}</p><p className="mt-1 text-xs text-zinc-500">{t('cashManagement.canStillCount')}</p></div> : (
          <div className="mt-4">
            {latestCashCount ? <><div className="text-sm font-bold text-zinc-900 dark:text-white">{t('cashManagement.countSubmitted')}</div><div className="mt-2 flex items-center gap-2 text-xs text-zinc-500"><Clock3 className="h-3.5 w-3.5" /><span>{status.createdAt ? status.createdAt.toLocaleTimeString(locale, { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: '2-digit' }) : t('cashManagement.justSubmitted')} · {relative}</span></div><div className="mt-1 text-xs text-zinc-500">{t('cashManagement.submittedBy')} <span className="font-semibold text-zinc-700 dark:text-zinc-300">{latestCashCount.cashierName}</span></div>{status.createdAt && <div className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800"><span className="font-semibold text-zinc-700 dark:text-zinc-300">{status.key === 'due' ? t('cashManagement.recommendedDue') : t('cashManagement.nextRecommended')}</span><br />{new Date(status.createdAt.getTime() + 3_600_000).toLocaleTimeString(locale, { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: '2-digit' })}</div>}</> : <><p className="text-sm font-bold text-zinc-900 dark:text-white">{t('cashManagement.firstRequired')}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{t('cashManagement.firstDescription')}</p></>}
          </div>
        )}
        <button onClick={onCount} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-zinc-800 active:scale-[0.99] dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"><Calculator className="h-5 w-5" />{latestCashCount ? t('cashManagement.countNow') : t('cashManagement.startCount')}</button>
      </div>

      {cashCounts.length > 0 && <div className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
        <div className="mb-3 flex items-center justify-between"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{t('cashManagement.todayActivity')}</div><span className="rounded-full bg-zinc-100 px-2 py-1 text-[9px] font-black text-zinc-500 dark:bg-zinc-800">{cashCounts.length}</span></div>
        <div className="max-h-48 space-y-2 overflow-y-auto pr-1 custom-scrollbar">{cashCounts.map((count) => { const createdAt = toDate(count.createdAt); return <div key={count.id} className="flex items-center justify-between rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60"><div><div className="text-xs font-bold text-zinc-900 dark:text-white">{count.cashierName}</div><div className="text-[10px] text-zinc-500">{createdAt?.toLocaleTimeString(locale, { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', minute: '2-digit' }) || t('cashManagement.justSubmitted')}</div></div><div className="text-sm font-black text-zinc-900 dark:text-white">{formatCurrency(count.countedTotal)}</div></div> })}</div>
      </div>}

      {!compact && <>
        <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200 dark:bg-zinc-900/50 dark:ring-zinc-800"><div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{t('cashManagement.routine')}</div><p className="mt-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t('cashManagement.updateHourly')}</p><p className="mt-1 text-xs leading-5 text-zinc-500">{t('cashManagement.routineDescription')}</p></div>
        <div><div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{t('cashManagement.operations')}</div><div className="grid grid-cols-2 gap-2.5">
          <OperationButton icon={Plus} label={t('stats.addCash')} onClick={onCashIn} />
          <OperationButton icon={Minus} label={t('stats.addExpense')} onClick={onCashOut} />
          <OperationButton icon={UserPlus} label={t('staff.addAdvance')} onClick={onAdvance} />
          <OperationButton icon={ArrowLeftRight} label={t('stats.exchange')} onClick={onExchange} />
        </div></div>
        <div><h3 className="mb-3 text-sm font-bold text-zinc-900 dark:text-white">{t('stats.adjustments')}</h3><div className="max-h-[400px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">{adjustments.length === 0 ? <div className="rounded-2xl bg-white py-8 text-center text-xs text-zinc-400 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">{t('stats.noAdjustments')}</div> : adjustments.map((adj) => <div key={adj.id} className="flex items-center justify-between rounded-xl bg-white p-3 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"><div className="min-w-0"><div className="truncate text-sm font-bold text-zinc-900 dark:text-white">{adj.reason}</div><div className="text-[10px] font-bold uppercase text-zinc-400">{adj.timestamp?.toDate ? adj.timestamp.toDate().toLocaleTimeString(locale, { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit' }) : ''}</div></div><div className={`ml-3 text-sm font-black ${adj.type === 'ADDITION' ? 'text-blue-600' : 'text-red-600'}`}>{adj.type === 'ADDITION' ? '+' : '-'} {formatCurrency(adj.amount)}</div></div>)}</div></div>
      </>}
    </div>
  )
}

function OperationButton({ icon: Icon, label, onClick }: { icon: typeof Plus; label: string; onClick?: () => void }) {
  return <button onClick={onClick} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 text-[10px] font-black uppercase tracking-wider text-zinc-700 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 active:scale-[0.99] dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800 dark:hover:bg-zinc-800"><Icon className="h-4 w-4" />{label}</button>
}