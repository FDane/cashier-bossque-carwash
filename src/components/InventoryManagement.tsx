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
  PlusCircle,
  X
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function InventoryManagement() {
  const { t } = useLanguage()
  const [items, setItems] = useState<any[]>([])
  const [newItem, setNewItem] = useState({ 
    name: '', 
    category: '', 
    quantity: 0, 
    reorderLevel: 3,
    cost: 0,
    price: 0,
    supplier: '',
    unit: ''
  })
  const [lowStock, setLowStock] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)

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

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (editingItem) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [editingItem])

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
      setNewItem({ 
        name: '', 
        category: '', 
        quantity: 0, 
        reorderLevel: 3,
        cost: 0,
        price: 0,
        supplier: '',
        unit: ''
      })
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

  async function handleSaveEdit() {
    if (!editingItem || !editingItem.name) {
      showToast.error(t('common.error' as any))
      return
    }
    setLoading(true)
    try {
      const { id, ...data } = editingItem
      await updateInventoryItem(id, data)
      setEditingItem(null)
      showToast.success(t('common.success' as any))
    } catch {
      showToast.error(t('common.error' as any))
    } finally {
      setLoading(false)
    }
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
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input 
              placeholder={t('inventory.name' as any)} 
              value={newItem.name} 
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
            />
          </div>
          <div>
            <select 
              value={newItem.category}
              onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-bold"
            >
              <option value="">{t('inventory.category' as any)}</option>
              <option value="retailItem">Retail Item</option>
              <option value="supplies">Supplies</option>
            </select>
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
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">RM</span>
            <input 
              type="number"
              placeholder={t('inventory.cost' as any)} 
              value={newItem.cost || ''} 
              onChange={(e) => setNewItem({ ...newItem, cost: parseFloat(e.target.value || '0') })}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
            />
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">RM</span>
            <input 
              type="number"
              placeholder={t('inventory.price' as any)} 
              value={newItem.price || ''} 
              onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value || '0') })}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
            />
          </div>
          <div className="relative">
            <input 
              placeholder={t('inventory.supplier' as any)} 
              value={newItem.supplier} 
              onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
            />
          </div>
          <div className="relative">
            <input 
              placeholder={t('inventory.unit' as any)} 
              value={newItem.unit} 
              onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
            />
          </div>
          <div className="relative">
            <input 
              type="number"
              placeholder={t('inventory.reorderLevel' as any)} 
              value={newItem.reorderLevel || ''} 
              onChange={(e) => setNewItem({ ...newItem, reorderLevel: parseInt(e.target.value || '0') })}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
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
                <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('inventory.category' as any)} / {t('inventory.supplier' as any)}</th>
                <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('inventory.price' as any)}</th>
                <th className="text-left px-4 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('inventory.quantity' as any)}</th>
                <th className="text-right px-8 text-xs font-black text-zinc-500 uppercase tracking-widest">{t('staff.actions' as any)}</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it) => (
                <tr key={it.id} className="group bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="py-5 px-8 rounded-l-2xl">
                    <div className="font-bold text-zinc-900 dark:text-white">{it.name}</div>
                    <div className="text-[10px] text-zinc-500 font-medium">{it.unit || 'No unit'}</div>
                  </td>
                  <td className="py-5 px-4">
                    <div className="flex flex-col gap-1">
                      <span className="w-fit px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 rounded text-[10px] font-black uppercase text-zinc-600 dark:text-zinc-400">
                        {it.category}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase">{it.supplier}</span>
                    </div>
                  </td>
                  <td className="py-5 px-4">
                    <div className="text-sm font-bold text-zinc-900 dark:text-white">{formatCurrency(it.price)}</div>
                    <div className="text-[10px] text-zinc-500">{t('inventory.cost' as any)}: {formatCurrency(it.cost)}</div>
                  </td>
                  <td className="py-5 px-4 font-mono font-bold text-lg text-zinc-900 dark:text-white">
                    <div className="flex items-center gap-3">
                      {it.quantity}
                      {(it.quantity <= (it.reorderLevel ?? 3)) && (
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
                      <button onClick={() => setEditingItem({ ...it })} className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all">
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

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingItem(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-500" />
                {t('inventory.editTitle' as any)}
              </h3>
              <button onClick={() => setEditingItem(null)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 block">{t('inventory.name' as any)}</label>
                  <input 
                    value={editingItem.name} 
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 block">{t('inventory.category' as any)}</label>
                  <select 
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-bold"
                  >
                    <option value="retailItem">Retail Item</option>
                    <option value="supplies">Supplies</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 block">{t('inventory.unit' as any)}</label>
                  <input 
                    placeholder="e.g. Bottle, Pcs, Box"
                    value={editingItem.unit} 
                    onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 block">{t('inventory.cost' as any)}</label>
                  <input 
                    type="number"
                    value={editingItem.cost} 
                    onChange={(e) => setEditingItem({ ...editingItem, cost: parseFloat(e.target.value || '0') })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 block">{t('inventory.price' as any)}</label>
                  <input 
                    type="number"
                    value={editingItem.price} 
                    onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value || '0') })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 block">{t('inventory.quantity' as any)}</label>
                  <input 
                    type="number"
                    value={editingItem.quantity} 
                    onChange={(e) => setEditingItem({ ...editingItem, quantity: parseInt(e.target.value || '0') })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 block">{t('inventory.reorderLevel' as any)}</label>
                  <input 
                    type="number"
                    value={editingItem.reorderLevel} 
                    onChange={(e) => setEditingItem({ ...editingItem, reorderLevel: parseInt(e.target.value || '0') })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1.5 block">{t('inventory.supplier' as any)}</label>
                  <input 
                    value={editingItem.supplier} 
                    onChange={(e) => setEditingItem({ ...editingItem, supplier: e.target.value })}
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
                  />
                </div>
              </div>
              <button 
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
                onClick={handleSaveEdit}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5 rotate-45" />}
                {t('common.save' as any)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
