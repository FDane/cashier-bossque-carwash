"use client"
import React, { useEffect, useState, useMemo } from 'react'
import { 
  Tag, 
  Plus, 
  Search, 
  Trash2, 
  Loader2, 
} from 'lucide-react'
import { 
  listenToFullPriceBook, 
  addPriceBookItem, 
  deletePriceBookItem 
} from '@/lib/firebaseService'
import { useLanguage } from '@/hooks/useLanguage'
import { showToast } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils'

export default function PriceBookManagement() {
  const { t } = useLanguage()
  const [items, setItems] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [newItem, setNewItem] = useState({ brand: '', model: '', price: 0 })

  useEffect(() => {
    const unsub = listenToFullPriceBook((data) => setItems(data))
    return () => unsub && unsub()
  }, [])

  const filteredItems = useMemo(() => {
    return items.filter(it => 
      it.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      it.model.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [items, searchTerm])

  async function handleAdd() {
    if (!newItem.brand || !newItem.model) return
    setLoading(true)
    try {
      await addPriceBookItem(newItem)
      setNewItem({ brand: '', model: '', price: 0 })
      showToast.success(t('common.success' as any))
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (window.confirm(t('cashier.confirmDelete' as any))) {
      await deletePriceBookItem(id)
      showToast.success(t('common.success' as any))
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Tag className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
          {t('priceBook.title' as any)}
        </h2>
      </div>

      {/* Add Section */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-premium-lg grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase mb-2 ml-1">{t('priceBook.brand' as any)}</label>
          <input 
            value={newItem.brand} 
            onChange={e => setNewItem({...newItem, brand: e.target.value})}
            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase mb-2 ml-1">{t('priceBook.model' as any)}</label>
          <input 
            value={newItem.model} 
            onChange={e => setNewItem({...newItem, model: e.target.value})}
            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-500 uppercase mb-2 ml-1">{t('priceBook.price' as any)}</label>
          <input 
            type="number"
            value={newItem.price || ''} 
            onChange={e => setNewItem({...newItem, price: parseFloat(e.target.value || '0')})}
            className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3"
          />
        </div>
        <button 
          onClick={handleAdd}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          {t('common.add' as any)}
        </button>
      </div>

      {/* List Section */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-premium-lg overflow-hidden">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input 
              placeholder={t('inventory.search' as any)}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-auto border-separate" style={{ borderSpacing: '0 8px' }}>
            <thead>
              <tr>
                <th className="text-left px-8 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('priceBook.brand' as any)}</th>
                <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('priceBook.model' as any)}</th>
                <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('priceBook.price' as any)}</th>
                <th className="text-right px-8 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('staff.actions' as any)}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it) => (
                <tr key={it.id} className="bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100 transition-colors">
                  <td className="py-4 px-8 rounded-l-2xl font-bold">{it.brand}</td>
                  <td className="py-4 px-4">{it.model}</td>
                  <td className="py-4 px-4 font-mono font-bold text-blue-600">{formatCurrency(it.price)}</td>
                  <td className="py-4 px-8 rounded-r-2xl text-right">
                    <button onClick={() => handleDelete(it.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
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