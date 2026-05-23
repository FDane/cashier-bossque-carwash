"use client"
import React, { useState, useEffect, useMemo } from 'react'
import { 
  getPastTransactions 
} from '@/lib/firebaseService'
import { useLanguage } from '@/hooks/useLanguage'
import { 
  History, 
  Search, 
  Car, 
  Loader2, 
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Image as ImageIcon
} from 'lucide-react'
import { formatCurrency, getKLDateString } from '@/lib/utils'

export default function PastCarSearch() {
  const { t } = useLanguage()
  const [plate, setPlate] = useState('')
  const [selectedDate, setSelectedDate] = useState(getKLDateString())
  const [searchMode, setSearchMode] = useState<'DATE' | 'GLOBAL'>('DATE')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [viewLimit, setViewLimit] = useState(10)
  const [firstDoc, setFirstDoc] = useState<any>(null)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null)

  const calculateTotal = (r: any) => {
    let total = r.computedPrice || 0;
    if (Array.isArray(r.addons)) {
      r.addons.forEach((addon: any) => {
        total += (addon.price || 0) * (addon.quantity || 1);
      });
    }
    return total;
  };

  useEffect(() => {
    if (searchMode === 'DATE') { // For DATE mode, perform regular paginated search
      handleSearch();
    } 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewLimit, selectedDate, searchMode]);

  // Debounced effect for Global Search (letter by letter server search)
  useEffect(() => {
    if (searchMode !== 'GLOBAL') return;

    const timer = setTimeout(() => {
      // For global search with a plate, we want to fetch ALL prefix-matching records
      // to allow client-side substring filtering across the entire result set.
      handleSearch(undefined, true); 
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plate, searchMode, viewLimit])

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (selectedTransaction) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [selectedTransaction])

  // Dynamic Client-side Filtering
  const filteredResults = useMemo(() => {
    const search = plate.trim().toUpperCase()
    // We filter locally so that "letter-by-letter" works for substrings (e.g. "2" in the middle of a plate)
    if (!search) return results // If no search term, show all fetched results
    return results.filter(r => 
      r.plateNumber?.toUpperCase().includes(search)
    )
  }, [results, plate])

  async function handleSearch(direction?: 'next' | 'prev', fetchAllGlobal?: boolean) {
    setLoading(true)
    try {
      let queryPlate: string | undefined = undefined;
      let queryDate: string | undefined = undefined;
      let queryLimit: number | undefined = viewLimit; // Default to viewLimit
      let queryStartAfter: any = direction === 'next' ? lastDoc : undefined;
      let queryEndBefore: any = direction === 'prev' ? firstDoc : undefined;

      if (searchMode === 'GLOBAL') {
        queryPlate = plate.trim() !== '' ? plate : undefined;
        // If we are in GLOBAL mode and have a plate, and fetchAllGlobal is true,
        // we want to fetch ALL prefix matches. So, we explicitly set pagination parameters to undefined.
        if (queryPlate && fetchAllGlobal) {
          queryLimit = undefined; // Signal to getPastTransactions to fetch all
          queryStartAfter = undefined;
          queryEndBefore = undefined;
        }
      } else { // DATE mode
        queryDate = selectedDate || undefined;
      }

      // IMPORTANT: getPastTransactions (in firebaseService.ts) must be able to handle:
      // 1. queryLimit = undefined (meaning no limit for global plate search)
      // 2. plateNumber filter as a prefix search (e.g., where('plateNumber', '>=', plate) and where('plateNumber', '<=', plate + '\uf8ff'))
      // 3. Conditional orderBy based on whether plateNumber is present (e.g., orderBy('plateNumber') for global, orderBy('checkInTime') for date).
      const snapshot = await getPastTransactions(
        queryLimit, 
        queryPlate,
        queryStartAfter, 
        queryEndBefore,  
        queryDate
      );

      const rows = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      setResults(rows)
      
      // Update pagination state only if we are actually paginating (i.e., not global plate search fetching all)
      if (searchMode === 'DATE' || (searchMode === 'GLOBAL' && !queryPlate)) { 
        setFirstDoc(snapshot.docs[0])
        setLastDoc(snapshot.docs[snapshot.docs.length - 1])
        if (direction === 'next') setCurrentPage(p => p + 1)
        else if (direction === 'prev') setCurrentPage(p => Math.max(1, p - 1))
        else setCurrentPage(1)
      } else {
        // For global plate search (fetching all prefix matches), reset pagination state
        setFirstDoc(null);
        setLastDoc(null);
        setCurrentPage(1);
      }
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

      {/* Search Mode Toggles */}
      <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl w-fit">
        <button 
          onClick={() => { setSearchMode('DATE'); setResults([]); setPlate(''); }}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${searchMode === 'DATE' ? 'bg-white dark:bg-zinc-900 text-blue-600 shadow-sm' : 'text-zinc-500'}`}
        >
          {t('pastCars.byDate' as any)}
        </button>
        <button 
          onClick={() => { setSearchMode('GLOBAL'); setResults([]); setPlate(''); }}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${searchMode === 'GLOBAL' ? 'bg-white dark:bg-zinc-900 text-blue-600 shadow-sm' : 'text-zinc-500'}`}
        >
          {t('pastCars.global' as any)}
        </button>
      </div>

      {/* Search Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-premium-lg">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Plate Number Input */}
          {searchMode === 'GLOBAL' && (
            <div className="relative flex-[2]">
              <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder={t('pastCars.search' as any)}
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-14 pr-6 py-4 text-xl font-mono font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm"
              />
            </div>
          )} 
          {searchMode === 'DATE' && (
            <div className="relative flex-1">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm cursor-pointer"
              />
            </div>
          )}
          <button 
            className={`px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 ${searchMode === 'GLOBAL' && plate.trim() !== '' ? 'flex-1' : ''}`}
            onClick={() => handleSearch()}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
            <span className="sm:hidden lg:inline">{t('pastCars.search' as any)}</span>
          </button>
        </div>
      </div>

      {/* Results Container */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-premium-lg overflow-hidden">
        {filteredResults.length === 0 ? (
          <div className="text-center py-20">
            <Search className="w-12 h-12 text-zinc-600 mx-auto mb-4 opacity-20" />
            <p className="text-zinc-500 text-lg font-medium">{t('cashier.noResults' as any)}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-separate" style={{ borderSpacing: '0 8px' }}>
              <thead>
                <tr>
                  <th className="text-left px-8 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('staff.image' as any)}</th>
                  <th className="text-left px-8 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('intake.plateNumber' as any)}</th>
                  <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('intake.services' as any)}</th>
                  <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('payment.amountReceived' as any)}</th>
                  <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('payment.paymentMethod' as any)}</th>
                  <th className="text-left px-8 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('staff.checkIn' as any)}</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r) => (
                  <tr 
                    key={r.id} 
                    onClick={() => setSelectedTransaction(r)}
                    className="group bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    <td className="py-5 px-8 rounded-l-2xl">
                      {r.imageUrl ? (
                        <img 
                          src={r.imageUrl} 
                          alt="" 
                          className="w-12 h-12 rounded-xl object-cover shadow-sm" 
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}
                    </td>
                    <td className="py-5 px-8">
                      <div className="font-mono font-bold text-xl text-zinc-900 dark:text-white leading-tight">{r.plateNumber}</div>
                      <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">
                        {r.brand} {r.model}
                      </div>
                    </td>
                    <td className="py-5 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {['exterior', 'interior', 'engine'].map((serviceKey) => (
                          r.services?.[serviceKey] && (
                            <span key={serviceKey} className="px-2.5 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase rounded-lg border border-blue-500/10">
                              {t(`intake.services.${serviceKey}` as any)}
                            </span>
                          )
                        ))}
                      </div>
                    </td>
                    <td className="py-5 px-4 font-bold text-zinc-900 dark:text-white">
                      {formatCurrency(calculateTotal(r))}
                    </td>
                    <td className="py-5 px-4">
                      {r.paymentMethod && (
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          r.paymentMethod === 'CASH' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-indigo-500/10 text-indigo-600'
                        }`}>
                          {r.paymentMethod}
                        </span>
                      )}
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

            {/* Pagination Footer */}
            {/* Only show pagination controls if not in global plate search mode (where all are fetched) */}
            {!(searchMode === 'GLOBAL' && plate.trim() !== '') && (
              <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-500 font-medium">{t('common.itemsPerPage' as any) || 'Items per page:'}</span>
                  <select
                    value={viewLimit}
                    onChange={(e) => setViewLimit(parseInt(e.target.value))}
                    className="bg-zinc-100 dark:bg-zinc-800 border-none rounded-lg px-3 py-1 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleSearch('prev')}
                    disabled={loading || currentPage === 1}
                    className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 disabled:opacity-30 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-bold text-zinc-900 dark:text-white">
                    {t('common.page' as any) || 'Page'} {currentPage}
                  </span>
                  <button
                    onClick={() => handleSearch('next')}
                    disabled={loading || results.length < viewLimit}
                    className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 disabled:opacity-30 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4" onClick={() => setSelectedTransaction(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-zinc-900 dark:text-white leading-tight">
                  {selectedTransaction.plateNumber}
                </h3>
                <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest mt-1">
                  {selectedTransaction.brand} {selectedTransaction.model}
                </p>
              </div>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 sm:p-8 space-y-8">
              {selectedTransaction.imageUrl && (
                <div className="relative rounded-2xl overflow-hidden shadow-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 flex justify-center">
                  <img 
                    src={selectedTransaction.imageUrl} 
                    alt="Vehicle" 
                    className="w-full h-auto max-h-[500px] object-contain"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">{t('staff.checkIn' as any)}</p>
                  <div className="flex flex-col text-zinc-900 dark:text-white">
                    <span className="font-bold flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-500" />
                      {selectedTransaction.checkInTime?.toDate ? selectedTransaction.checkInTime.toDate().toLocaleDateString() : ''}
                    </span>
                    <span className="text-sm font-medium opacity-60 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      {selectedTransaction.checkInTime?.toDate ? selectedTransaction.checkInTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">{t('payment.paymentMethod' as any)}</p>
                  <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    selectedTransaction.paymentMethod === 'CASH' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-indigo-500/10 text-indigo-600'
                  }`}>
                    {selectedTransaction.paymentMethod || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">{t('intake.services' as any)}</p>
                  <div className="flex flex-wrap gap-2">
                    {['exterior', 'interior', 'engine'].map((serviceKey) => (
                      selectedTransaction.services?.[serviceKey] && (
                        <span key={serviceKey} className="px-3 py-1.5 bg-blue-50 dark:bg-blue-500/5 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-xl border border-blue-100 dark:border-blue-500/10">
                          {t(`intake.services.${serviceKey}` as any)}
                        </span>
                      )
                    ))}
                  </div>
                </div>

                {Array.isArray(selectedTransaction.addons) && selectedTransaction.addons.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Add-ons</p>
                    <div className="space-y-2">
                      {selectedTransaction.addons.map((addon: any, idx: number) => (
                        <div key={addon.id || idx} className="flex justify-between items-center p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 capitalize">{addon.name}</span>
                            {(addon.quantity || 1) > 1 && (
                              <span className="text-[10px] text-zinc-500 font-medium">
                                {addon.quantity} × {formatCurrency(addon.price)}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-black text-zinc-900 dark:text-white">
                            {formatCurrency((addon.price || 0) * (addon.quantity || 1))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{t('payment.total:' as any) || 'Total Amount'}</span>
                  <span className="text-3xl font-black text-blue-600 dark:text-blue-400">
                    {formatCurrency(calculateTotal(selectedTransaction))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
