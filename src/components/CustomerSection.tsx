"use client"
import React, { useState } from 'react'
import { 
  UserPlus, 
  Search, 
  History, 
  Phone, 
  User, 
  Car, 
  Loader2,
  ArrowRight,
  UserCircle,
  Plus
} from 'lucide-react'
import { 
  addCustomer, 
  getCustomerByPlate, 
  getCustomerPastOrdersByPlate 
} from '@/lib/firebaseService'
import { useLanguage } from '@/hooks/useLanguage'
import { showToast } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils'

export default function CustomerSection() {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [plate, setPlate] = useState('')
  const [searchPlate, setSearchPlate] = useState('')
  const [customer, setCustomer] = useState<any | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  async function handleAddCustomer() {
    if (!name) {
      showToast.error(t('common.error' as any))
      return
    }
    setLoading(true)
    try {
      await addCustomer({ name, phone, plate })
      setName('')
      setPhone('')
      setPlate('')
      showToast.success(t('customer.addSuccess' as any))
    } catch (e) {
      showToast.error(t('common.error' as any))
    } finally {
      setLoading(false)
    }
  }

  async function handleSearch() {
    if (!searchPlate) return
    setSearching(true)
    try {
      const cust = await getCustomerByPlate(searchPlate)
      setCustomer(cust)
      const past = await getCustomerPastOrdersByPlate(searchPlate)
      setOrders(past)
      if (!cust) showToast.warning(t('cashier.noResults' as any))
    } catch (e) {
      showToast.error(t('common.error' as any))
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <UserCircle className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
          {t('customer.title' as any)}
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Add Customer Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-premium-lg">
          <div className="flex items-center gap-3 mb-6">
            <UserPlus className="w-5 h-5 text-blue-500" />
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{t('customer.addTitle' as any)}</h3>
          </div>
          
          <div className="space-y-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input 
                placeholder={t('customer.name' as any)} 
                value={name} 
                onChange={(e)=>setName(e.target.value)} 
                className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input 
                  placeholder={t('customer.phone' as any)} 
                  value={phone} 
                  onChange={(e)=>setPhone(e.target.value)} 
                  className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
                />
              </div>
              <div className="relative">
                <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input 
                  placeholder={t('customer.plate' as any)} 
                  value={plate} 
                  onChange={(e)=>setPlate(e.target.value.toUpperCase())} 
                  className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-mono font-bold" 
                />
              </div>
            </div>

            <button 
              className="w-full mt-2 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={handleAddCustomer}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
              {t('staff.addAdvance' as any)}
            </button>
          </div>
        </div>

        {/* Search Customer Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-premium-lg flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <Search className="w-5 h-5 text-blue-500" />
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{t('customer.searchTitle' as any)}</h3>
          </div>
          
          <div className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input 
                placeholder={t('customer.searchPlaceholder' as any)} 
                value={searchPlate} 
                onChange={(e)=>setSearchPlate(e.target.value.toUpperCase())} 
                className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-mono font-bold" 
              />
            </div>
            <button 
              className="px-6 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold rounded-2xl hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
              onClick={handleSearch}
              disabled={searching}
            >
              {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
            </button>
          </div>

          {customer && (
            <div className="flex-1 p-5 bg-blue-500/5 border border-blue-500/10 rounded-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">{t('payment.carDetails' as any)}</h4>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">{customer.name}</p>
                </div>
                <div className="px-3 py-1 bg-blue-500/10 rounded-full text-[10px] font-bold text-blue-600 uppercase">
                  Active Member
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-zinc-500 mb-0.5">{t('customer.phone' as any)}</p>
                  <p className="font-bold text-zinc-900 dark:text-zinc-200">{customer.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-zinc-500 mb-0.5">{t('customer.plate' as any)}</p>
                  <p className="font-bold text-zinc-900 dark:text-zinc-200">{(customer.plates||[]).join(', ')}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Past Orders Section */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-premium-lg">
        <div className="flex items-center gap-3 mb-6">
          <History className="w-5 h-5 text-blue-500" />
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{t('customer.pastOrders' as any)}</h3>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-700">
            <p className="text-zinc-500 font-medium">{t('customer.noOrders' as any)}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-separate" style={{ borderSpacing: '0 8px' }}>
              <thead>
                <tr>
                  <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('customer.plate' as any)}</th>
                  <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('payment.totalAmount' as any)}</th>
                  <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">Status</th>
                  <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('staff.checkIn' as any)}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o=> (
                  <tr key={o.id} className="group bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                    <td className="py-4 px-4 rounded-l-2xl font-mono font-bold text-zinc-900 dark:text-white">{o.plateNumber}</td>
                    <td className="py-4 px-4 font-bold text-blue-600 dark:text-blue-400">{formatCurrency(o.computedPrice)}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        o.status === 'COMPLETED' ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'
                      }`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 rounded-r-2xl text-sm text-zinc-500">
                      {o.checkInTime?.toDate ? o.checkInTime.toDate().toLocaleString() : String(o.checkInTime)}
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
