"use client"
import React, { useState, useEffect, useMemo } from 'react'
import { 
  UserPlus, 
  Search, 
  History, 
  Phone, 
  User, 
  Car, 
  Loader2,
  UserCircle, 
  X,
  PlusCircle,
  Trash2,
  Plus,
  Edit,
} from 'lucide-react'
import { 
  addCustomer, 
  getCustomerPastOrdersByPlate,
  listenToCustomers,
  updateCustomer,
  deleteCustomer
} from '@/lib/firebaseService'
import { useLanguage } from '@/hooks/useLanguage'
import { showToast } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils'

export default function CustomerSection() {
  const { t } = useLanguage()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [plates, setPlates] = useState<string[]>([''])
  const [searchQuery, setSearchQuery] = useState('')
  const [allCustomers, setAllCustomers] = useState<any[]>([])
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)
  const [pastOrders, setPastOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null)

  async function handleAddCustomer() {
    const validPlates = plates.filter(p => p.trim() !== '')
    if (!name || validPlates.length === 0) {
      showToast.error(t('common.error' as any))
      return
    }
    setLoading(true)
    try {
      await addCustomer({ name, phone, plates: validPlates })
      setName('')
      setPhone('')
      setPlates([''])
      setIsAddModalOpen(false)
      showToast.success(t('customer.addSuccess' as any))
    } catch {
      showToast.error(t('common.error' as any))
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateCustomer() {
    if (!editingCustomer) return
    const validPlates = plates.filter(p => p.trim() !== '')
    if (!name || validPlates.length === 0) {
      showToast.error(t('common.error' as any))
      return
    }
    setLoading(true)
    try {
      await updateCustomer(editingCustomer.id, { name, phone, plates: validPlates })
      setName('')
      setPhone('')
      setPlates([''])
      setEditingCustomer(null)
      setIsAddModalOpen(false) // Close the modal if it was used for editing
      showToast.success(t('common.save' as any))
      // Re-select the customer to refresh details and past orders
      if (selectedCustomer && selectedCustomer.id === editingCustomer.id) {
        handleSelectCustomer({ ...editingCustomer, name, phone, plates: validPlates })
      }
    } catch {
      showToast.error(t('common.error' as any))
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteCustomer(id: string) {
    if (window.confirm(t('inventory.deleteConfirm' as any))) {
      try {
        await deleteCustomer(id)
        showToast.success(t('common.success' as any))
        if (selectedCustomer?.id === id) {
          setSelectedCustomer(null)
        }
      } catch {
        showToast.error(t('common.error' as any))
      }
    }
  }

  useEffect(() => {
    const unsub = listenToCustomers(setAllCustomers)
    return () => unsub()
  }, [])

  // Prevent background scrolling when modals are open
  useEffect(() => {
    if (isAddModalOpen || viewingImageUrl) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isAddModalOpen, viewingImageUrl])

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toUpperCase().trim()
    if (!q) return allCustomers
    return allCustomers.filter(c => 
      c.name.toUpperCase().includes(q) || 
      (c.phone && c.phone.includes(q)) ||
      (c.plates && c.plates.some((p: string) => p.includes(q)))
    )
  }, [allCustomers, searchQuery])

  async function handleSelectCustomer(cust: any) {
    setSelectedCustomer(cust)
    setSearching(true)
    try {
      if (cust) {
        const allOrders = await Promise.all(
          cust.plates.map((p: string) => getCustomerPastOrdersByPlate(p))
        )
        // Flatten and sort by check-in time
        const flattened = allOrders.flat().sort((a, b) => {
          const timeA = a.checkInTime?.toDate?.() || new Date(a.checkInTime)
          const timeB = b.checkInTime?.toDate?.() || new Date(b.checkInTime)
          return timeB.getTime() - timeA.getTime()
        })
        setPastOrders(flattened)
      }
    } catch {
      showToast.error(t('common.error' as any))
    } finally {
      setSearching(false)
    }
  }

  const handleAddPlateField = () => setPlates([...plates, ''])
  const handleRemovePlateField = (index: number) => {
    const newPlates = [...plates]
    newPlates.splice(index, 1)
    setPlates(newPlates)
  }
  const handlePlateChange = (index: number, val: string) => {
    const newPlates = [...plates]
    newPlates[index] = val.toUpperCase()
    setPlates(newPlates)
  }

  const openEditModal = (customer: any) => {
    setEditingCustomer(customer)
    setName(customer.name)
    setPhone(customer.phone || '')
    setPlates(customer.plates || [''])
    setIsAddModalOpen(true)
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <UserCircle className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            {t('customer.title' as any)}
          </h2>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          {t('customer.addTitle' as any)}
        </button>
      </div>

      {/* Add Customer Modal */}
      {isAddModalOpen && ( // This modal is now reused for both Add and Edit
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <UserPlus className="w-5 h-5 text-blue-500" />
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{t('customer.addTitle' as any)}</h3>
              </div>
              <button onClick={() => {
                setIsAddModalOpen(false); setEditingCustomer(null); setName(''); setPhone(''); setPlates(['']);
              }} className="p-2 text-zinc-400 hover:text-white"><X /></button>

            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
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
                
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input 
                    placeholder={t('customer.phone' as any)} 
                    value={phone} 
                    onChange={(e)=>setPhone(e.target.value)} 
                    className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all" 
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">{t('customer.plate' as any)}</label>
                  {plates.map((p, idx) => (
                    <div key={idx} className="flex gap-2">
                      <div className="relative flex-1">
                        <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                        <input 
                          placeholder={t('customer.plate' as any)} 
                          value={p} 
                          onChange={(e)=>handlePlateChange(idx, e.target.value)} 
                          className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-mono font-bold" 
                        />
                      </div>
                      {plates.length > 1 && (
                        <button onClick={() => handleRemovePlateField(idx)} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button 
                    type="button"
                    onClick={handleAddPlateField}
                    className="w-full py-3 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-2xl text-zinc-500 hover:text-blue-500 hover:border-blue-500 transition-all flex items-center justify-center gap-2 text-sm font-bold"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Add Another Plate
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 flex gap-3">
              <button onClick={() => {
                setIsAddModalOpen(false); setEditingCustomer(null); setName(''); setPhone(''); setPlates(['']);
              }} className="flex-1 py-4 font-bold text-zinc-500">{t('common.cancel' as any)}</button>
              <button 
                onClick={editingCustomer ? handleUpdateCustomer : handleAddCustomer}
                disabled={loading}
                className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                {editingCustomer ? t('common.save' as any) : t('common.confirm' as any)}

              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Section */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-premium-lg">
        <div className="flex items-center gap-3 mb-6">
          <Search className="w-5 h-5 text-blue-500" />
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{t('customer.searchTitle' as any)}</h3>
        </div>
        
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-400" />
          <input 
            placeholder={t('customer.searchPlaceholder' as any)} 
            value={searchQuery} 
            onChange={(e)=>setSearchQuery(e.target.value)} 
            className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-12 pr-4 py-5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-bold text-xl" 
          />
        </div>
      </div>

      {!selectedCustomer && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {filteredCustomers.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
              <p className="text-zinc-500 font-medium">{t('cashier.noResults' as any)}</p>
            </div>
          ) : (
            filteredCustomers.map(cust => (
              <div 
                key={cust.id}
                className="relative flex flex-col text-left p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl hover:border-blue-500 transition-all group overflow-hidden cursor-pointer"
              >
                <div onClick={() => handleSelectCustomer(cust)}>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-zinc-900 dark:text-white">{cust.name}</h4>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{cust.phone || 'No phone'}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1.5">
                    {cust.plates?.slice(0, 3).map((p: string) => (
                      <span key={p} className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-lg font-mono text-[10px] font-black text-zinc-600 dark:text-zinc-400">
                        {p}
                      </span>
                    ))}
                    {cust.plates?.length > 3 && (
                      <span className="text-[10px] font-bold text-zinc-400 px-1">+{cust.plates.length - 3} more</span>
                    )}
                  </div>
                </div>
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => openEditModal(cust)} className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-full"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => handleDeleteCustomer(cust.id)} className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-full"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {selectedCustomer && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-top-4 duration-500">
          <div className="col-span-full">
            <button 
              onClick={() => setSelectedCustomer(null)}
              className="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors mb-2"
            >
              <X className="w-4 h-4" />
              Back to list
            </button>
          </div>
          {/* Left: Customer Profile & Registered Cars & Edit Button */}
          <div className="lg:col-span-1 space-y-6">
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => openEditModal(selectedCustomer)} 
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 text-sm"
              >
                <Edit className="w-4 h-4" /> {t('common.edit' as any)}
              </button>
              <button 
                onClick={() => handleDeleteCustomer(selectedCustomer.id)} 
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95 text-sm"
              ><Trash2 className="w-4 h-4" /> {t('common.delete' as any)}</button>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-premium-lg">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
                  {searching ? <Loader2 className="w-8 h-8 animate-spin" /> : <User className="w-8 h-8" />}
                </div>
                <div>
                  <h4 className="text-2xl font-black text-zinc-900 dark:text-white leading-tight">{selectedCustomer.name}</h4>
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mt-1">Loyalty Member</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  <Phone className="w-5 h-5 text-zinc-400" />
                  <div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('customer.phone' as any)}</p>
                    <p className="font-bold text-zinc-900 dark:text-white">{selectedCustomer.phone || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h5 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  Registered Vehicles
                </h5>
                <div className="flex flex-wrap gap-2">
                  {selectedCustomer.plates.map((p: string) => (
                    <div key={p} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl font-mono font-bold text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700">
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Past Orders history */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-premium-lg min-h-full">
              <div className="flex items-center gap-3 mb-6">
                <History className="w-5 h-5 text-blue-500" />
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{t('customer.pastOrders' as any)}</h3>
              </div>

              {pastOrders.length === 0 ? (
                <div className="text-center py-20 bg-zinc-50/50 dark:bg-zinc-800/30 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  <History className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                  <p className="text-zinc-500 font-medium">{t('customer.noOrders' as any)}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pastOrders.map(o => (
                    <div key={o.id} className="group flex items-center justify-between p-5 bg-zinc-50/50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-800 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all">
                      <div className="flex items-center gap-4">
                        {o.imageUrl ? (
                          <img 
                            src={o.imageUrl} 
                            alt="" 
                            className="w-12 h-12 rounded-xl object-cover shadow-sm cursor-pointer hover:scale-105 transition-transform" 
                            onClick={() => setViewingImageUrl(o.imageUrl)}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 font-mono font-black">
                            {o.plateNumber.slice(-1)}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-lg text-zinc-900 dark:text-white">{o.plateNumber}</span>
                            <span className="px-2 py-0.5 bg-green-500/10 text-green-600 text-[10px] font-black uppercase rounded">{o.status}</span>
                          </div>
                          <div className="text-xs text-zinc-500 font-medium mt-0.5">
                            {o.checkInTime?.toDate ? o.checkInTime.toDate().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : String(o.checkInTime)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-blue-600 dark:text-blue-400">{formatCurrency(o.computedPrice)}</div>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{o.paymentMethod || 'Paid'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewingImageUrl && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewingImageUrl(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{t('intake.image' as any)}</h3>
              <button
                onClick={() => setViewingImageUrl(null)}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4">
              <img src={viewingImageUrl} alt="Vehicle" className="w-full h-auto rounded-xl shadow-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
