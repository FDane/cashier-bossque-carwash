"use client"
import React, { useEffect, useState } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { 
  Users, 
  LogOut, 
  Clock, 
  CheckCircle2,
  ImageIcon,
  X,
} from 'lucide-react'
import {
  listenToTodayAttendance,
  getStaffList,
  clockOutAttendance,
} from '@/lib/firebaseService'
import { showToast } from '@/lib/toast'

interface AttendanceRow {
  id: string
  staffId: string
  date: string
  clockInTime: any
  clockOutTime?: any
  createdAt?: any
  moneyAdvance?: number
  imageUrl?: string
  imagePath?: string
}

export default function StaffManagement() {
  const { t } = useLanguage()
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [staffMap, setStaffMap] = useState<Record<string, any>>({})
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [selectAll, setSelectAll] = useState(false)
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null)

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
        
        // Sort data by clockInTime ascending (earliest first)
        const sortedData = [...data].sort((a, b) => {
          const timeA = a.clockInTime?.toDate ? a.clockInTime.toDate().getTime() : new Date(a.clockInTime || 0).getTime();
          const timeB = b.clockInTime?.toDate ? b.clockInTime.toDate().getTime() : new Date(b.clockInTime || 0).getTime();
          return timeA - timeB;
        });

        setRows(sortedData)
        const sel: Record<string, boolean> = {}
        sortedData.forEach((r: any) => (sel[r.id] = false))
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

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (viewingImageUrl) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [viewingImageUrl])

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
    const selectedIds = rows
      .filter(r => selected[r.id])
      .map(r => r.id)

    if (selectedIds.length === 0) return

    if (window.confirm(t('staff.clockOutConfirm' as any) || 'Clock out selected staff?')) {
      try {
        await Promise.all(selectedIds.map(id => clockOutAttendance(id)))
        showToast.success(t('staff.clockOutSuccess' as any))
        
        // Reset selection for the records we just updated
        const newSel = { ...selected }
        selectedIds.forEach(id => newSel[id] = false)
        setSelected(newSel)
      } catch (err) {
        console.error('Clock out error:', err)
        showToast.error(t('staff.clockOutError' as any))
      }
    }
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

        <div className="flex items-center justify-between sm:justify-start gap-3 bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm w-full sm:w-auto">
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
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.length === 0 && (
            <div className="py-12 text-center text-zinc-500 dark:text-zinc-400 font-medium">
              {t('staff.noClockInYet' as any)}
            </div>
          )}
          {rows.map((r) => (
            <div 
              key={r.id} 
              className={`p-4 flex items-start gap-4 transition-colors ${selected[r.id] ? 'bg-blue-500/5' : 'active:bg-zinc-50 dark:active:bg-zinc-800/50'}`}
              onClick={() => toggleSelect(r.id)}
            >
              <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={!!selected[r.id]}
                  onChange={() => toggleSelect(r.id)}
                  className="w-6 h-6 rounded-md accent-blue-600 cursor-pointer"
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  {r.imageUrl ? (
                    <img 
                      src={r.imageUrl} 
                      alt="" 
                      className="w-12 h-12 rounded-2xl object-cover border-2 border-zinc-100 dark:border-zinc-800 shadow-sm"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border-2 border-zinc-100 dark:border-zinc-800 shadow-sm">
                      <ImageIcon className="w-5 h-5 text-zinc-400" />
                    </div>
                  )}
                  <div className="truncate">
                    <div className="font-black text-zinc-900 dark:text-white truncate">
                      {staffMap[r.staffId]?.name || staffMap[r.staffId]?.displayName || r.staffId}
                    </div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      ID: {r.staffId.slice(-6)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter mb-1">{t('staff.checkIn' as any)}</div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 font-mono">
                      <Clock className="w-3 h-3 text-blue-500" />
                      {r.clockInTime?.toDate ? r.clockInTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </div>
                  </div>
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter mb-1">{t('staff.checkOut' as any)}</div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300 font-mono">
                      {r.clockOutTime ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                          {r.clockOutTime.toDate ? r.clockOutTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                        </>
                      ) : (
                        <span className="text-[9px] text-amber-600 dark:text-amber-400 font-black uppercase bg-amber-500/10 px-1.5 py-0.5 rounded">Active</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full table-auto border-separate" style={{ borderSpacing: '0 8px' }}>
            {rows.length === 0 && (
              <caption className="py-12 text-center text-zinc-500 dark:text-zinc-400 text-lg font-medium">
                {t('staff.noClockInYet' as any)}
              </caption>
            )}
            <thead>
              <tr>
                <th className="px-6 py-4"></th>
                <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('staff.image' as any)} / {t('staff.name' as any)}</th>
                <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('staff.checkIn' as any)}</th>
                <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('staff.checkOut' as any)}</th>
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
                    {r.imageUrl ? (
                      <img 
                        src={r.imageUrl} 
                        alt="" 
                        className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-800 shadow-sm cursor-pointer hover:scale-110 transition-transform"
                        onClick={() => setViewingImageUrl(r.imageUrl || null)}
                      />
                    ) : staffMap[r.staffId]?.imageUrl ? (
                      <img 
                        src={staffMap[r.staffId].imageUrl} 
                        alt="" 
                        className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-800 shadow-sm opacity-50"
                        title="Profile picture (No clock-in photo)"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shadow-sm">
                        <ImageIcon className="w-4 h-4 text-zinc-400" />
                      </div>
                    )}
                    {staffMap[r.staffId]?.name || staffMap[r.staffId]?.displayName || r.staffId} {/* Prioritize 'name', then 'displayName' */}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 font-mono">
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                    {r.clockInTime?.toDate 
                      ? r.clockInTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                      : (r.clockInTime ? 'Loading...' : '--:--')}
                  </div>
                </td>
                <td className="py-4 px-4 rounded-r-2xl">
                  {r.clockOutTime ? (
                    <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 font-mono">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      {r.clockOutTime.toDate 
                        ? r.clockOutTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                        : '...'}
                    </div>
                  ) : (
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 text-[10px] font-black rounded-full uppercase">Active</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>

      {/* Image Viewer Modal */}
      {viewingImageUrl && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewingImageUrl(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Clock-in Photo</h3>
              <button
                onClick={() => setViewingImageUrl(null)}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4">
              <img src={viewingImageUrl} alt="Staff Clock-in" className="w-full h-auto rounded-xl shadow-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
