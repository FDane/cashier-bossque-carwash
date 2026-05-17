"use client"
import React, { useEffect, useState, useMemo } from 'react'
import {
  listenToInventory,
  addInventoryItem,
  updateInventoryQuantity,
  updateInventoryItem,
  decrementInventoryByOne,
  getLowStockItems,
  deleteInventoryItem,
} from '@/lib/firebaseService'
import { showToast } from '@/lib/toast'
import { useLanguage } from '@/hooks/useLanguage'
import { 
  Package, 
  Plus, 
  Minus, 
  Edit, 
  Trash2, 
  Search, 
  AlertTriangle, 
  Loader2,
  Tag,
  Hash,
  PlusCircle
} from 'lucide-react'

export default function InventoryManagement() {
  const { t } = useLanguage()
  const [items, setItems] = useState<any[]>([])
  const [newItem, setNewItem] = useState({ name: '', category: '', quantity: 0, lowStockThreshold: 5 })
  const [lowStock, setLowStock] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const unsub = listenToInventory((rows) => setItems(rows))
    ;(async () => {
      const low = await getLowStockItems()
      setLowStock(low)
      if (low.length > 0) {
        low.forEach((it) => showToast.warning(`${it.name} low on stock (${it.quantity})`))
      }
    })()
    return () => unsub && unsub()
  }, [])

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [items, searchTerm])

  async function handleAdd() {
    if (!newItem.name) {
      showToast.error(t('common.error' as any))
      return
    }
    setLoading(true)
    try {
      await addInventoryItem(newItem)
      setNewItem({ name: '', category: '', quantity: 0, lowStockThreshold: 5 })
      showToast.success(t('inventory.addSuccess' as any))
    } catch {
      showToast.error(t('common.error' as any))
    } finally {
      setLoading(false)
    }
  }

  async function handleInc(id: string) {
    await updateInventoryQuantity(id, 1)
    const low = await getLowStockItems()
    setLowStock(low)
  }

  async function handleDec(id: string) {
    await decrementInventoryByOne(id)
    const low = await getLowStockItems()
    setLowStock(low)
    const item = low.find((i) => i.id === id)
    if (item) showToast.warning(`${item.name} low on stock (${item.quantity})`)
  }

  async function handleUpdate(id: string, field: string, value: any) {
    await updateInventoryItem(id, { [field]: value })
    const low = await getLowStockItems()
    setLowStock(low)
  }

  async function handleDelete(id: string) {
    if (window.confirm(t('inventory.deleteConfirm' as any))) {
      try {
        await deleteInventoryItem(id)
        showToast.success(t('common.success' as any))
      } catch {
        showToast.error(t('common.error' as any))
      }
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Package className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
          {t('inventory.title' as any)}
        </h2>
      </div>

      {/* Add Item Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-premium-lg">
        <div className="flex items-center gap-3 mb-6">
          <PlusCircle className="w-5 h-5 text-blue-500" />
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{t('inventory.addTitle' as any)}</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input 
              placeholder={t('inventory.name' as any)} 
              value={newItem.name} 
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
            />
          </div>
          <div className="relative">
            <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input 
              placeholder={t('inventory.category' as any)} 
              value={newItem.category} 
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
            />
          </div>
          <div className="relative">
            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input 
              type="number"
              placeholder={t('inventory.quantity' as any)} 
              value={newItem.quantity || ''} 
              onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value || '0') })}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
            />
          </div>
        </div>
        <button 
          className="w-full mt-4 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
          onClick={handleAdd}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          {t('common.add' as any)}
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4 text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest text-xs">
            <AlertTriangle className="w-4 h-4" />
            {t('inventory.lowStock' as any)}
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((it) => (
              <div key={it.id} className="px-4 py-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl text-sm font-bold border border-amber-500/20">
                {it.name} <span className="mx-2 opacity-50">|</span> {it.quantity}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Inventory Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-premium-lg overflow-hidden">
        <div className="p-6 sm:p-8 bg-zinc-50/50 dark:bg-zinc-800/20 border-b border-zinc-100 dark:border-zinc-800/50">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder={t('inventory.search' as any)}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-14 pr-6 py-4 text-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-auto border-separate" style={{ borderSpacing: '0 8px' }}>
            <thead>
              <tr>
                <th className="text-left px-8 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('inventory.name' as any)}</th>
                <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('inventory.category' as any)}</th>
                <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('inventory.quantity' as any)}</th>
                <th className="text-right px-8 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('staff.actions' as any)}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it) => (
                <tr key={it.id} className="group bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="py-5 px-8 rounded-l-2xl font-bold text-zinc-900 dark:text-white">{it.name}</td>
                  <td className="py-5 px-4">
                    <span className="px-3 py-1 bg-zinc-200 dark:bg-zinc-700 rounded-full text-[10px] font-black uppercase text-zinc-600 dark:text-zinc-400">
                      {it.category}
                    </span>
                  </td>
                  <td className="py-5 px-4 font-mono font-bold text-lg text-zinc-900 dark:text-white">
                    <div className="flex items-center gap-3">
                      {it.quantity}
                      {(it.quantity <= (it.lowStockThreshold ?? 5)) && (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                  </td>
                  <td className="py-5 px-8 rounded-r-2xl text-right">
                    <div className="flex justify-end items-center gap-2">
                      <button onClick={() => handleInc(it.id)} className="p-2 text-zinc-400 hover:text-green-500 hover:bg-green-500/10 rounded-lg transition-all">
                        <Plus className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDec(it.id)} className="p-2 text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all">
                        <Minus className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleUpdate(it.id, 'category', prompt('Category', it.category) || it.category)} className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(it.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all">
                        <Trash2 className="w-4 h-4" />
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
