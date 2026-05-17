"use client"
import React, { useState, useMemo } from 'react'
import { 
  getTransactionsByPlate 
} from '@/lib/firebaseService'
import { useLanguage } from '@/hooks/useLanguage'
import { 
  History, 
  Search, 
  Car, 
  Loader2, 
  ArrowRight,
  Calendar,
  CreditCard,
  Clock
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function PastCarSearch() {
  const { t } = useLanguage()
  const [plate, setPlate] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  async function handleSearch() {
    if (!plate) return
    setLoading(true)
    try {
    const rows = await getTransactionsByPlate(plate)
    setResults(rows)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <History className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
          {t('pastCars.title' as any)}
        </h2>
      </div>

      {/* Search Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-premium-lg">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder={t('pastCars.search' as any)}
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-14 pr-6 py-4 text-xl font-mono font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm"
            />
          </div>
          <button 
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
            <span className="sm:hidden lg:inline">{t('pastCars.search' as any)}</span>
          </button>
        </div>
      </div>

      {/* Results Container */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-premium-lg overflow-hidden">
        {results.length === 0 ? (
          <div className="text-center py-20">
            <Search className="w-12 h-12 text-zinc-600 mx-auto mb-4 opacity-20" />
            <p className="text-zinc-500 text-lg font-medium">{t('cashier.noResults' as any)}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-separate" style={{ borderSpacing: '0 8px' }}>
              <thead>
                <tr>
                  <th className="text-left px-8 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('intake.plateNumber' as any)}</th>
                  <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('intake.services' as any)}</th>
                  <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('payment.totalAmount' as any)}</th>
                  <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">Status</th>
                  <th className="text-left px-8 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('staff.checkIn' as any)}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="group bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="py-5 px-8 rounded-l-2xl font-mono font-bold text-xl text-zinc-900 dark:text-white">
                      {r.plateNumber}
                    </td>
                    <td className="py-5 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(r.services || {}).filter(([,v])=>v).map(([k])=>(
                          <span key={k} className="px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase rounded-lg border border-blue-500/10">
                            {t(`intake.services.${k}` as any)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-5 px-4 font-bold text-zinc-900 dark:text-white">
                      {formatCurrency(r.computedPrice)}
                    </td>
                    <td className="py-5 px-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        r.status === 'COMPLETED' ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-5 px-8 rounded-r-2xl text-sm text-zinc-500 font-medium">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {r.checkInTime?.toDate ? r.checkInTime.toDate().toLocaleDateString() : ''}
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] opacity-60">
                          <Clock className="w-3 h-3" />
                          {r.checkInTime?.toDate ? r.checkInTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : String(r.checkInTime)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
