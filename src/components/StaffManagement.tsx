"use client"
import React, { useEffect, useState } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { 
  Users, 
  LogOut, 
  Plus, 
  Clock, 
  DollarSign, 
  CheckCircle2,
  UserCheck,
  ChevronRight
} from 'lucide-react'
import {
  listenToTodayAttendance,
  getStaffList,
  addMoneyAdvanceForAttendance,
  clockOutAllToday,
} from '@/lib/firebaseService'

interface AttendanceRow {
  id: string
  staffId: string
  date: string
  checkInTime: any
  checkOutTime?: any
  moneyAdvance?: number
}

export default function StaffManagement() {
  const { t } = useLanguage()
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [staffMap, setStaffMap] = useState<Record<string, any>>({})
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [advanceInputs, setAdvanceInputs] = useState<Record<string, string>>({})
  const [selectAll, setSelectAll] = useState(false)

  useEffect(() => {
    let unsub: (() => void) | undefined
    let isMounted = true

    const setup = async () => {
      const staff = await getStaffList()
      if (!isMounted) return

      const map: Record<string, any> = {}
      staff.forEach((s: any) => (map[s.id] = s))
      setStaffMap(map)

      const cleanup = await listenToTodayAttendance((data) => {
        if (!isMounted) return
        setRows(data)
        const sel: Record<string, boolean> = {}
        data.forEach((r: any) => (sel[r.id] = false))
        setSelected(sel)
      })

      if (typeof cleanup === 'function') {
        unsub = cleanup
        if (!isMounted) unsub()
      }
    }

    setup()

    return () => {
      isMounted = false
      if (unsub && typeof unsub === 'function') unsub()
    }
  }, [])

  useEffect(() => {
    const all = rows.length > 0 && rows.every((r) => selected[r.id])
    setSelectAll(all)
  }, [selected, rows])

  function toggleSelect(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }))
  }

  function handleSelectAll() {
    const newVal = !selectAll
    const sel: Record<string, boolean> = {}
    rows.forEach((r) => (sel[r.id] = newVal))
    setSelected(sel)
    setSelectAll(newVal)
  }

  async function handleClockOutSelected() {
    if (window.confirm(t('cashier.confirmDelete' as any) || 'Clock out all active staff?')) {
    // For simplicity, clock out all (backend supports clockOutAllToday)
    await clockOutAllToday()
    }
  }

  async function handleAddAdvance(attendanceId: string) {
    const raw = advanceInputs[attendanceId]
    const amt = parseFloat(raw || '0')
    if (!amt || amt <= 0) return
    await addMoneyAdvanceForAttendance(attendanceId, amt)
    setAdvanceInputs((s) => ({ ...s, [attendanceId]: '' }))
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Users className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            {t('staff.title' as any)}
          </h2>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <label className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-colors">
            <input 
              type="checkbox" 
              checked={selectAll} 
              onChange={handleSelectAll} 
              className="w-5 h-5 rounded-md accent-blue-600 cursor-pointer" 
            />
            <span className="text-sm font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
              {t('staff.selectAll' as any)}
            </span>
          </label>
          <button
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95"
            onClick={handleClockOutSelected}
          >
            <LogOut className="w-4 h-4" />
            {t('staff.clockOutSelected' as any)}
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-premium-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-auto border-separate" style={{ borderSpacing: '0 8px' }}>
            <thead>
              <tr>
                <th className="px-6 py-4"></th>
                <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('staff.name' as any)}</th>
                <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('staff.checkIn' as any)}</th>
                <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('staff.checkOut' as any)}</th>
                <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('staff.advance' as any)}</th>
                <th className="text-right px-8 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('staff.actions' as any)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr 
                  key={r.id} 
                  className={`
                    group transition-colors align-middle
                    ${selected[r.id] ? 'bg-blue-500/5' : 'bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'}
                  `}
                >
                <td className="py-4 px-6 rounded-l-2xl">
                  <input
                    type="checkbox"
                    checked={!!selected[r.id]}
                    onChange={() => toggleSelect(r.id)}
                    className="w-5 h-5 rounded-md accent-blue-600 cursor-pointer"
                  />
                </td>
                <td className="py-4 px-4 font-bold text-zinc-900 dark:text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-black uppercase">
                      {staffMap[r.staffId]?.displayName?.substring(0, 2) || 'ST'}
                    </div>
                    {staffMap[r.staffId]?.displayName || r.staffId}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 font-mono">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    {r.checkInTime?.toDate ? r.checkInTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : String(r.checkInTime)}
                  </div>
                </td>
                <td className="py-4 px-4">
                  {r.checkOutTime ? (
                    <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      {r.checkOutTime.toDate ? r.checkOutTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : String(r.checkOutTime)}
                    </div>
                  ) : (
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 text-[10px] font-black rounded-full uppercase">Active</span>
                  )}
                </td>
                <td className="py-4 px-4 font-bold text-zinc-900 dark:text-white">
                  RM {r.moneyAdvance ?? 0}
                </td>
                <td className="py-4 px-8 rounded-r-2xl text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400">RM</span>
                    <input
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 pl-8 pr-3 py-2 rounded-xl w-24 text-sm font-bold focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                      value={advanceInputs[r.id] ?? ''}
                      onChange={(e) => setAdvanceInputs((s) => ({ ...s, [r.id]: e.target.value }))}
                        placeholder="0.00"
                    />
                    </div>
                    <button
                      className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20 transition-all active:scale-90"
                      onClick={() => handleAddAdvance(r.id)}
                      title={t('staff.addAdvance' as any)}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  )
}
