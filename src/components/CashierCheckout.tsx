'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  Search,
  CreditCard,
  Wallet,
  X,
  ChevronRight,
  Loader2,
  AlertCircle,
  Plus,
  Camera,
  Minus,
  ShoppingBag,
  Edit,
  Trash2,
  Image as ImageIcon,
  PlusCircle,
  User,
  Palette,
} from 'lucide-react'
import { Transaction, PaymentMethod } from '@/types'
import { useLanguage } from '@/hooks/useLanguage'
import { 
  completeTransaction, 
  updateDailyStats, 
  deleteTransaction, 
  updateTransaction, 
  uploadImageToFirebase,
  listenToFullPriceBook,
  listenToRetailItems,
  updateInventoryQuantity,
  getCustomerByPlate,
} from '@/lib/firebaseService'
import { showToast } from '@/lib/toast'
import { formatCurrency, formatTime } from '@/lib/utils'
import { pushKioskState } from '@/lib/kioskBridge'
import { resizeImage } from '@/lib/imageUtils' // Import image utility
import { useRouter } from 'next/navigation'

interface CashierCheckoutProps {
  pendingTransactions: Transaction[]
  loading: boolean
}

const SERVICE_CATEGORIES = {
  exterior: { ms: 'Luar', en: 'Exterior' },
  interior: { ms: 'Dalam', en: 'Interior' },
  engine: { ms: 'Enjin', en: 'Engine' },
}

const CAR_COLORS = [
  'Black',
  'White',
  'Silver',
  'Gray',
  'Blue',
  'Red',
  'Gold',
  'Beige',
  'Green',
  'Orange',
  'Purple',
  'Yellow',
  'Pink',
  'Brown',
  'Turquoise',
]

interface SelectedAddon {
  id: string
  name: string
  price: number
  quantity: number
}

interface CheckoutModalData {
  transactions: Transaction[]
  paymentMethod: PaymentMethod
  cashReceived: number
  selectedAddons: SelectedAddon[]
  miscCharges: { name: string; price: number }[]
  cashDenominations: Record<number, number>
  changeDenominations: Record<number, number>
  notes: string
}

export default function CashierCheckout({
  pendingTransactions,
  loading: transactionsLoading,
}: CashierCheckoutProps) {
  const { t, language } = useLanguage()
  const [searchQuery, setSearchQuery] = useState('')
  const [priceBook, setPriceBook] = useState<any[]>([])
  const [retailItems, setRetailItems] = useState<any[]>([])
  const [checkoutModal, setCheckoutModal] = useState<CheckoutModalData>({
    transactions: [],
    paymentMethod: null,
    cashReceived: 0,
    selectedAddons: [],
    miscCharges: [],
    cashDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
    changeDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
    notes: '',
  })
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [checkoutImagePreviewUrl, setCheckoutImagePreviewUrl] = useState<string | null>(null)

  const router = useRouter()

  // State for Manual/Misc charge form
  const [miscForm, setMiscForm] = useState({ name: '', price: '' })

  // State for viewing image in a modal
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null)
  const checkoutImageInputRef = React.useRef<HTMLInputElement>(null)
  const editImageInputRef = React.useRef<HTMLInputElement>(null)

  // State to store customer data for each plate number
  const [transactionCustomers, setTransactionCustomers] = useState<Record<string, any>>({});

  // Effect to fetch customer data for pending transactions
  useEffect(() => {
    const fetchCustomersForTransactions = async () => {
      const uniquePlates = Array.from(new Set(pendingTransactions.map(t => t.plateNumber)));
      const customerPromises = uniquePlates.map(async (plate) => {
        const customer = await getCustomerByPlate(plate);
        return { plate, customer };
      });

      const results = await Promise.all(customerPromises);
      const customerMap: Record<string, any> = {};
      results.forEach(({ plate, customer }) => {
        if (customer) {
          customerMap[plate] = customer;
        }
      });
      setTransactionCustomers(customerMap);
    };

    if (pendingTransactions.length > 0) {
      fetchCustomersForTransactions();
    } else {
      setTransactionCustomers({}); // Clear if no pending transactions
    }
  }, [pendingTransactions]);

  useEffect(() => {
    const unsubPrice = listenToFullPriceBook((items) => {
      setPriceBook(items)
    })
    const unsubRetail = listenToRetailItems((items) => {
      setRetailItems(items)
    })
    return () => { unsubPrice(); unsubRetail(); }
  }, [])

  // Prevent background scrolling when modals are open
  useEffect(() => {
    if (checkoutModal.transactions.length > 0 || editingTransaction || viewingImageUrl) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [checkoutModal.transactions, editingTransaction, viewingImageUrl])

  // Local filtering: No extra Firebase cost
  const filteredTransactions = useMemo(() => {
    let result = [...pendingTransactions]
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter((t) => {
        const plateMatch = t.plateNumber.toLowerCase().includes(query)
        const customerMatch = transactionCustomers[t.plateNumber]?.name?.toLowerCase().includes(query)
        return plateMatch || customerMatch
      })
    }
    // Sort: oldest transaction on top (ascending order of checkInTime)
    return result.sort((a, b) => 
      new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
    )
  }, [pendingTransactions, searchQuery, transactionCustomers])

  // Calculate total with addons
  const totalWithAddons = useMemo(() => {
    if (checkoutModal.transactions.length === 0) return 0
    
    const baseTotal = checkoutModal.transactions.reduce((sum, t) => sum + t.computedPrice, 0)
    const addonsTotal = checkoutModal.selectedAddons.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )
    const miscTotal = checkoutModal.miscCharges.reduce(
      (sum, item) => sum + item.price,
      0
    )
    return baseTotal + addonsTotal + miscTotal
  }, [checkoutModal.transactions, checkoutModal.selectedAddons, checkoutModal.miscCharges])

  // Calculate total for batch selection
  const selectionTotal = useMemo(() => {
    return pendingTransactions
      .filter(t => selectedIds.includes(t.id))
      .reduce((sum, t) => sum + t.computedPrice, 0)
  }, [pendingTransactions, selectedIds])

  // Calculate balance in real-time
  const balance = useMemo(() => {
    if (checkoutModal.transactions.length === 0 || checkoutModal.paymentMethod !== 'CASH') {
      return 0
    }
    return checkoutModal.cashReceived - totalWithAddons
  }, [
    checkoutModal.transactions,
    checkoutModal.paymentMethod,
    checkoutModal.cashReceived,
    totalWithAddons,
  ])

  const handleCardClick = (transaction: Transaction) => {
    if (selectedIds.length > 0) {
      toggleSelection(transaction.id)
    } else {
      setCheckoutModal({
        transactions: [transaction],
        paymentMethod: null,
        cashReceived: 0,
        selectedAddons: [],
        miscCharges: [],
        cashDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
        changeDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
        notes: (transaction as any).notes || '',
      })
    }
  }

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleBatchCheckout = () => {
    const selected = pendingTransactions.filter(t => selectedIds.includes(t.id))
    if (selected.length === 0) return
    
    setCheckoutModal({
      transactions: selected,
      paymentMethod: null,
      cashReceived: 0,
      selectedAddons: [],
      miscCharges: [],
      cashDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
      changeDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
      notes: '',
    })
  }

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setCheckoutModal({
      ...checkoutModal,
      paymentMethod: method,
      cashReceived: 0,
      cashDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
      changeDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
    })
  }


  const handleAddAddon = (item: { id: string; name: string; price: number }) => {
    setCheckoutModal((prev) => {
      const existing = prev.selectedAddons.find((a) => a.id === item.id)
      if (existing) {
        return {
          ...prev,
          selectedAddons: prev.selectedAddons.map((a) =>
            a.id === item.id ? { ...a, quantity: a.quantity + 1 } : a
          ),
        }
      }
      return {
        ...prev,
        selectedAddons: [...prev.selectedAddons, { ...item, quantity: 1 }],
      }
    })
  }

  const handleUpdateAddonQty = (id: string, delta: number) => {
    setCheckoutModal((prev) => ({
      ...prev,
      selectedAddons: prev.selectedAddons
        .map((a) => (a.id === id ? { ...a, quantity: Math.max(0, a.quantity + delta) } : a))
        .filter((a) => a.quantity > 0),
    }))
  }

  const handleAddMiscCharge = () => {
    const price = parseFloat(miscForm.price)
    if (!miscForm.name || isNaN(price)) return

    setCheckoutModal(prev => ({
      ...prev,
      miscCharges: [...prev.miscCharges, { name: miscForm.name, price }]
    }))
    setMiscForm({ name: '', price: '' })
  }

  const handleRemoveMiscCharge = (index: number) => {
    setCheckoutModal(prev => ({
      ...prev,
      miscCharges: prev.miscCharges.filter((_, i) => i !== index)
    }))
  }

  const handleEditClick = (transaction: Transaction) => {
    setEditingTransaction({ ...transaction })
  }

  const handleCheckoutImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && checkoutModal.transactions.length === 1) {
      const targetTrans = checkoutModal.transactions[0]
      setProcessingId(targetTrans.id)
      try {
        const compressedImageFile = await resizeImage(file)
        const { imageUrl, imagePath } = await uploadImageToFirebase(
          compressedImageFile,
          targetTrans.id,
          targetTrans.plateNumber,
          targetTrans.imagePath || undefined
        )

        await updateTransaction(targetTrans.id, { imageUrl, imagePath })

        setCheckoutModal((prev) =>
          prev.transactions.length > 0
            ? {
                ...prev,
                transactions: prev.transactions.map(t => t.id === targetTrans.id ? { ...t, imageUrl, imagePath } : t)
              }
            : prev
        )
        setCheckoutImagePreviewUrl(URL.createObjectURL(compressedImageFile))
        showToast.success(t('payment.imageUploadSuccess' as any) || 'Image uploaded successfully')
      } catch (error) {
        console.error('Error uploading checkout image:', error)
        showToast.error(t('payment.imageUploadError' as any) || 'Failed to upload image')
      } finally {
        setProcessingId(null)
        if (checkoutImageInputRef.current) checkoutImageInputRef.current.value = ''
      }
    }
  }

  const handleEditImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && editingTransaction) {
      setProcessingId(editingTransaction.id)
      try {
        const compressedImageFile = await resizeImage(file)
        const { imageUrl, imagePath } = await uploadImageToFirebase(
          compressedImageFile,
          editingTransaction.id,
          editingTransaction.plateNumber,
          editingTransaction.imagePath || undefined
        )

        await updateTransaction(editingTransaction.id, { imageUrl, imagePath })

        setEditingTransaction({
          ...editingTransaction,
          imageUrl,
          imagePath
        })
        showToast.success(t('payment.imageUploadSuccess' as any) || 'Image uploaded successfully')
      } catch (error) {
        console.error('Error uploading edit image:', error)
        showToast.error(t('payment.imageUploadError' as any) || 'Failed to upload image')
      } finally {
        setProcessingId(null)
        if (editImageInputRef.current) editImageInputRef.current.value = ''
      }
    }
  }

  const triggerCheckoutImageCapture = () => {
    checkoutImageInputRef.current?.click()
  }

  const handleDelete = async (id: string, imagePath?: string | null) => {
    if (window.confirm(t('cashier.confirmDelete' as any) || 'Are you sure you want to remove this car?')) {
      try {
        await deleteTransaction(id, imagePath ?? undefined)
        showToast.success(t('cashier.deleteSuccess' as any) || 'Car removed from queue')
      } catch {
        showToast.error(t('common.error' as any) || 'Error removing car')
      }
    }
  }

  const calculatePrice = (brand: string, model: string, services: any) => {
    const selectedModelData = priceBook.find(
      it => it.brand === brand && it.model === model
    )

    if (!selectedModelData) return 0

    const { exterior, interior, engine } = services

    if (!exterior && !interior && !engine) return 0

    if (interior && !exterior && !engine) {
      return selectedModelData.vaccuum_price || 0
    }

    let total = 0
    if (exterior && interior) {
      total = selectedModelData.interior_price || 0
    } else if (exterior && !interior) {
      total = selectedModelData.exterior_price || 0
    } else if (!exterior && interior) {
      total = selectedModelData.vaccuum_price || 0
    }

    if (engine) {
      total += selectedModelData.engine_price || 0
    }

    return total
  }

  const handleUpdate = async () => {
    if (!editingTransaction) return
    try {
      await updateTransaction(editingTransaction.id, editingTransaction)
      showToast.success(t('cashier.updateSuccess' as any) || 'Car updated successfully')
      setEditingTransaction(null)
    } catch {
      showToast.error(t('common.error' as any) || 'Error updating car')
    }
  }

  const handleCheckout = async () => {
    if (checkoutModal.transactions.length === 0 || !checkoutModal.paymentMethod) {
      showToast.warning(t('payment.error.invalidCash' as any))
      return
    }

    // Validate cash amount if payment is CASH
    if (
      checkoutModal.paymentMethod === 'CASH' &&
      checkoutModal.cashReceived < totalWithAddons
    ) {
      showToast.error(t('payment.error.invalidCash' as any))
      return
    }

    setProcessingId('BATCH_PROCESSING')

    try {
    
      // Merge retail addons and misc charges for the database
      const retailAndMisc = [
        ...checkoutModal.selectedAddons,
        ...checkoutModal.miscCharges.map(m => ({ 
          id: `misc_${Date.now()}_${m.name}`, 
          name: m.name, 
          price: m.price, 
          quantity: 1 
        }))
      ]

      // Decrement inventory for selected retail addons
      for (const addon of checkoutModal.selectedAddons) {
        await updateInventoryQuantity(addon.id, -addon.quantity)
      }

      // Process each transaction
      for (let i = 0; i < checkoutModal.transactions.length; i++) {
        const trans = checkoutModal.transactions[i];
        
        // We attribute the retail/misc extras only to the FIRST car in the batch
        // so the total money across all individual records matches the cash drawer.
        const itemAddons = i === 0 ? retailAndMisc : [];
        const itemTotal = trans.computedPrice + itemAddons.reduce((s, a) => s + (a.price * a.quantity), 0);

        await completeTransaction(
          trans.id,
          checkoutModal.paymentMethod,
          itemTotal, // Set individual cashReceived to match car price + attributed extras
          itemTotal,
          itemAddons,
          i === 0 ? checkoutModal.cashDenominations : {},
          i === 0 ? checkoutModal.changeDenominations : {}
        );
      }

      // Update daily stats with revenue and car level
      await updateDailyStats(
        checkoutModal.paymentMethod,
        totalWithAddons,
        checkoutModal.transactions.length,
        checkoutModal.cashDenominations,
        checkoutModal.changeDenominations
      )

      showToast.success(t('payment.success' as any))
      setSelectedIds([])

      // Close modal and reset state
      setCheckoutModal({
        transactions: [],
        paymentMethod: null,
        cashReceived: 0,
        selectedAddons: [],
        miscCharges: [],
        cashDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
        changeDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
        notes: '',
      })
    } catch (error) {
      console.error('Error processing checkout:', error)
      showToast.error(t('payment.error' as any))
    } finally {
      setProcessingId(null)
    }
  }

  const closeModal = () => {
    setCheckoutModal({
      transactions: [],
      paymentMethod: null,
      cashReceived: 0,
      selectedAddons: [],
      miscCharges: [],
      cashDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
      changeDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
      notes: '',
    })
  }

  // 1. Move all Memos to be defined first
  const totalChangeValue = useMemo(() => {
    return Object.entries(checkoutModal.changeDenominations).reduce(
      (sum, [bill, count]) => sum + parseInt(bill) * count,
      0
    )
  }, [checkoutModal.changeDenominations])

  const isChangeIncomplete = balance > 0 && totalChangeValue !== balance

  // 2. Define the Kiosk Sync Effect LAST, after all computed values are ready
  useEffect(() => {
    if (checkoutModal.transactions.length === 0) {
      pushKioskState({
        stage: 'idle',
        transactions: [],
        paymentMethod: null,
        cashReceived: 0,
        selectedAddons: [],
        miscCharges: [],
        totalAmount: 0,
        balance: 0,
      })
      return
    }
    pushKioskState({
      stage: checkoutModal.paymentMethod ? 'payment'
           : checkoutModal.selectedAddons.length ? 'addons'
           : 'selecting',
      transactions: checkoutModal.transactions.map(t => ({
        id: t.id,
        plateNumber: t.plateNumber,
        brand: t.brand,
        model: t.model,
        color: t.color,
        services: t.services,
        computedPrice: t.computedPrice,
        imageUrl: t.imageUrl,
      checkInTime: t.checkInTime instanceof Date ? t.checkInTime : new Date(t.checkInTime).toISOString()
    })),
    paymentMethod: checkoutModal.paymentMethod,
    cashReceived: checkoutModal.cashReceived,
    selectedAddons: checkoutModal.selectedAddons,
    miscCharges: checkoutModal.miscCharges,
    totalAmount: totalWithAddons,
    balance,
  })
}, [checkoutModal, totalWithAddons, balance])

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header with Search - No longer sticky for better mobile space */}
      <div className="pt-2 pb-4 sm:pt-4 sm:pb-6 bg-transparent transition-all duration-300">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-premium-lg overflow-hidden">
          <div className="p-5 sm:p-8 border-b border-zinc-100 dark:border-zinc-800/50">
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">
              {t('cashier.title' as any)}
            </h2>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                {t('cashier.queueCount' as any)} {pendingTransactions.length}
              </span>
            </div>
          </div>
          
          <div className="p-5 sm:p-8 bg-zinc-50/50 dark:bg-zinc-800/20">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder={t('cashier.search' as any)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl pl-14 pr-6 py-4 sm:py-5 text-xl text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Batch Selection Actions */}
      {selectedIds.length > 0 && (
        <div className="sticky top-24 z-30 flex items-center justify-between p-4 bg-blue-600 text-white rounded-[2rem] shadow-xl shadow-blue-500/30 animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <span className="bg-white text-blue-600 w-8 h-8 rounded-full flex items-center justify-center font-black">
              {selectedIds.length}
            </span>
            <div>
              <span className="block font-black text-sm uppercase tracking-tight">{t('cashier.selected' as any)}</span>
              <span className="block text-xs font-bold text-blue-100">{t('payment.total:' as any)} {formatCurrency(selectionTotal)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setSelectedIds([])} className="px-4 py-2 bg-blue-500 hover:bg-blue-700 rounded-xl font-bold transition-colors text-sm">{t('common.cancel' as any)}</button>
            <button onClick={handleBatchCheckout} className="px-6 py-2 bg-white text-blue-600 hover:bg-blue-50 rounded-xl font-black transition-all flex items-center gap-2 shadow-lg">{t('common.confirm')} <ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Queue Status */}
      {transactionsLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        </div>
      )}

      {!transactionsLoading && pendingTransactions.length === 0 && (
        <div className="text-center py-16">
          <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-500 text-lg font-medium">{t('cashier.emptyQueue' as any)}</p>
        </div>
      )}

      {!transactionsLoading && pendingTransactions.length > 0 && filteredTransactions.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-500 text-lg font-medium">
            {t('cashier.noResults' as any)} &quot;{searchQuery}&quot;
          </p>
        </div>
      )}

      {!transactionsLoading && filteredTransactions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {filteredTransactions.map((transaction) => {
            const isSelected = selectedIds.includes(transaction.id)
            return (
            <div
              key={transaction.id}
              className={`relative text-left group bg-white dark:bg-zinc-900 border-2 rounded-2xl p-5 sm:p-7 transition-all duration-300 hover:shadow-xl transform hover:-translate-y-1 ${
                isSelected 
                  ? 'border-blue-600 bg-blue-50/30 dark:bg-blue-900/10 shadow-lg shadow-blue-500/5' 
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-blue-500/50'
              }`}
            >
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelection(transaction.id);
                      }}
                      className="w-5 h-5 rounded-md border-2 border-zinc-300 dark:border-zinc-700 accent-blue-600 cursor-pointer transition-all"
                    />
                    <div className="text-zinc-500 text-xs uppercase font-semibold">
                      {t('payment.plateNumber' as any)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleEditClick(transaction)}
                      className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                      title="Edit car"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(transaction.id, transaction.imagePath)}
                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Remove car"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {transaction.imageUrl && (
                      <button
                        onClick={() => setViewingImageUrl(transaction.imageUrl || null)}
                        className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                        title="View car photo"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                    )}
                    <ChevronRight className="w-5 h-5 text-zinc-600" />
                  </div>
                </div>

                <div 
                  className="cursor-pointer"
                  onClick={() => handleCardClick(transaction)}
                >
                  <div className="text-zinc-900 dark:text-white text-2xl sm:text-3xl font-bold font-mono tracking-wider">
                    {transaction.plateNumber}
                  </div>
                  {transactionCustomers[transaction.plateNumber] && (
                    <div className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                      <User className="w-3.5 h-3.5" /> {transactionCustomers[transaction.plateNumber].name}
                    </div>
                  )}
                </div>
              </div>

              <div 
                className="cursor-pointer"
                onClick={() => handleCardClick(transaction)}
              >
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-base">
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">
                      {transaction.brand} {transaction.model}
                    </span>
                    <span className="text-zinc-500 text-xs">{t(`color.${transaction.color}` as any)}</span>
                  </div>

                  {/* Service Tags */}
                  <div className="flex gap-2 flex-wrap mt-3">
                    {transaction.services.exterior && (
                      <span className="px-3 py-1 bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 text-xs rounded-full font-bold">
                        {SERVICE_CATEGORIES.exterior[language as 'en' | 'ms']}
                      </span>
                    )}
                    {transaction.services.interior && (
                      <span className="px-3 py-1 bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-300 text-xs rounded-full font-bold">
                        {SERVICE_CATEGORIES.interior[language as 'en' | 'ms']}
                      </span>
                    )}
                    {transaction.services.engine && (
                      <span className="px-3 py-1 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 text-xs rounded-full font-bold">
                        {SERVICE_CATEGORIES.engine[language as 'en' | 'ms']}
                      </span>
                    )}
                  </div>
                </div>

                {/* Display Notes if any */}
                {(transaction as any).notes && (
                  <div className="mb-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-xs text-amber-600 dark:text-amber-400 italic">
                    &quot;{(transaction as any).notes}&quot;
                  </div>
                )}

                {/* Time & Price */}
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 flex justify-between items-end">
                  <div className="text-xs text-zinc-500 font-medium">
                    {formatTime(transaction.checkInTime)}
                  </div>
                  <div className="text-lg sm:text-xl font-black text-blue-600 dark:text-blue-400">
                    {formatCurrency(transaction.computedPrice)}
                  </div>
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutModal.transactions.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-[2.5rem] sm:rounded-3xl w-full sm:w-full sm:max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 px-6 sm:px-8 py-5 flex justify-between items-center">
              <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
                {t('payment.title' as any)}
                {checkoutModal.transactions.length > 1 && ` (Batch of ${checkoutModal.transactions.length})`}
              </h3>
              <button
                onClick={closeModal}
                className="text-zinc-400 hover:text-white transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-8 space-y-6 sm:space-y-8">
              {/* Transaction Info */}
              <div className="bg-blue-500/5 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl p-5 sm:p-6">
                <div className="space-y-4">
                  {/* Multi-vehicle summary list */}
                  <div className="space-y-2 mb-4">
                    {checkoutModal.transactions.map(t => (
                      <div key={t.id} className="flex justify-between items-center bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-blue-500/10">
                        <div className="font-mono font-bold text-zinc-900 dark:text-white">{t.plateNumber}</div>
                        <div className="text-sm font-black text-blue-600 dark:text-blue-400">{formatCurrency(t.computedPrice)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Customer display (if single car or same customer) */}
                  <div className="flex items-center justify-between py-2 border-y border-blue-500/10">
                    <span className="text-xs text-zinc-400 font-bold uppercase">{t('customer.name' as any)}</span>
                    {checkoutModal.transactions.length === 1 && (
                      transactionCustomers[checkoutModal.transactions[0].plateNumber] ? (
                        <div className="text-sm font-bold text-blue-600">{transactionCustomers[checkoutModal.transactions[0].plateNumber].name}</div>
                      ) : ( 
                        <button
                          onClick={() => router.push('/customers')}
                          className="text-xs font-bold text-zinc-400 hover:text-blue-500 flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> {t('common.add' as any)}
                        </button>
                      )
                    )}
                    {checkoutModal.transactions.length > 1 && <span className="text-sm font-bold text-zinc-500">Group Payment</span>}
                  </div>

                  {/* Image capture only available for single vehicle checkout in batch */}
                  {checkoutModal.transactions.length === 1 && (
                  <div className="mt-4 rounded-3xl border border-zinc-200 dark:border-zinc-700 p-4 bg-zinc-50 dark:bg-zinc-900/50">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-zinc-400 uppercase font-semibold mb-1">
                          {t('payment.vehiclePhoto' as any) || 'Vehicle Photo (optional)'}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {t('payment.vehiclePhotoNote' as any) || 'Upload or update the vehicle photo if available.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={triggerCheckoutImageCapture}
                        className="inline-flex items-center gap-2 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
                      >
                        <Camera className="w-4 h-4" />
                        {checkoutModal.transactions[0].imageUrl ? (t('payment.changePhoto' as any) || 'Change Photo') : (t('payment.uploadPhoto' as any) || 'Upload Photo')}
                      </button>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      ref={checkoutImageInputRef}
                      onChange={handleCheckoutImageCapture}
                      className="hidden"
                    />
                    {checkoutModal.transactions[0].imageUrl && (
                      <button
                        type="button"
                        onClick={() => setViewingImageUrl(checkoutModal.transactions[0].imageUrl || null)}
                        className="mt-3 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {t('payment.viewUploadedPhoto' as any) || 'View uploaded photo'}
                      </button>
                    )}
                    {checkoutImagePreviewUrl && !checkoutModal.transactions[0].imageUrl && (
                      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                        {t('payment.photoSelectedNote' as any) || 'A new photo is ready to upload.'}
                      </p>
                    )}
                  </div>
                  )}

                  <div className="border-t border-zinc-700 pt-3">
                    <div className="text-sm text-zinc-500 uppercase font-bold mb-1">
                      {t('payment.totalAmount' as any)}
                    </div>
                    <div className="text-3xl sm:text-4xl font-black text-blue-600 dark:text-blue-400">
                      {formatCurrency(totalWithAddons)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-300">
                  {t('common.notes' as any) || 'Notes'}
                </label>
                <textarea
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-900 dark:text-white"
                  rows={2}
                  value={checkoutModal.notes}
                  onChange={(e) => setCheckoutModal({...checkoutModal, notes: e.target.value})}
                  placeholder={t('common.notesPlaceholder' as any) || 'Add notes for this transaction...'}
                />
              </div>

              {/* Add-ons Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-300">
                    {t('cashier.retailAddons' as any) || 'Retail Add-ons'}
                  </label>
                  <ShoppingBag className="w-4 h-4 text-zinc-500" />
                </div>
                
                {/* Available Items */}
                <div className="flex flex-wrap gap-2">
                  {retailItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleAddAddon({ id: item.id, name: item.name, price: item.price })}
                      className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-3 h-3" />
                      {item.name} ({formatCurrency(item.price)})
                    </button>
                  ))}
                </div>

                {/* Selected Items List */}
                {checkoutModal.selectedAddons.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {checkoutModal.selectedAddons.map((addon) => (
                      <div key={addon.id} className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
                        <div>
                          <div className="text-sm font-medium text-zinc-900 dark:text-white">{addon.name}</div>
                          <div className="text-xs text-zinc-500">{formatCurrency(addon.price)} / unit</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleUpdateAddonQty(addon.id, -1)}
                            className="p-1 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-sm font-bold text-zinc-900 dark:text-white w-4 text-center">{addon.quantity}</span>
                          <button
                            onClick={() => handleUpdateAddonQty(addon.id, 1)}
                            className="p-1 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-green-500/20 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Miscellaneous/Manual Charges */}
              <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-300">
                  {t('cashier.miscCharges' as any)}
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder={t('stats.reason' as any)}
                    value={miscForm.name}
                    onChange={e => setMiscForm({...miscForm, name: e.target.value})}
                    className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-white"
                  />
                  <input 
                    type="number"
                    placeholder={t('inventory.price' as any)}
                    value={miscForm.price}
                    onChange={e => setMiscForm({...miscForm, price: e.target.value})}
                    className="w-24 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-white"
                  />
                  <button 
                    onClick={handleAddMiscCharge}
                    className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    <PlusCircle className="w-6 h-6" />
                  </button>
                </div>

                {/* Misc Charges List */}
                {checkoutModal.miscCharges.length > 0 && (
                  <div className="space-y-2">
                    {checkoutModal.miscCharges.map((misc, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-700/50">
                        <div>
                          <div className="text-sm font-medium text-zinc-900 dark:text-white">{misc.name}</div>
                          <div className="text-xs text-blue-500 font-bold">{formatCurrency(misc.price)}</div>
                        </div>
                        <button
                          onClick={() => handleRemoveMiscCharge(idx)}
                          className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payment Method Selection */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-3">
                  {t('payment.paymentMethod' as any)} *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Cash Button */}
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodSelect('CASH')}
                    className={`p-4 rounded-lg border-2 font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                      checkoutModal.paymentMethod === 'CASH'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-blue-500'
                    }`}
                  >
                    <Wallet className="w-5 h-5" />
                    {t('payment.cash' as any)}
                  </button>

                  {/* Online Button */}
                  <button
                    type="button"
                    onClick={() => handlePaymentMethodSelect('ONLINE')}
                    className={`p-4 rounded-lg border-2 font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                      checkoutModal.paymentMethod === 'ONLINE'
                        ? 'bg-green-600 border-green-500 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-green-500'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    {t('payment.online' as any)}
                  </button>
                </div>
              </div>

              {/* Cash Calculator - Only for CASH payment */}
              {checkoutModal.paymentMethod === 'CASH' && (
                <div className="space-y-4 bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
                  <div>
                    <label className="block text-sm font-semibold text-zinc-300 mb-2">
                      {t('payment.cashReceived' as any)}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={checkoutModal.cashReceived || ''}
                      readOnly
                      placeholder="0.00"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white text-xl font-semibold placeholder-zinc-500 focus:outline-none cursor-not-allowed opacity-70"
                    />
                  </div>

                  {/* Quick Cash Buttons */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {[1, 5, 10, 20, 50, 100].map((amt) => {
                      const count = checkoutModal.cashDenominations[amt] || 0
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCheckoutModal(prev => ({
                            ...prev,
                            cashReceived: (prev.cashReceived || 0) + amt,
                            cashDenominations: {
                              ...prev.cashDenominations,
                              [amt]: (prev.cashDenominations[amt] || 0) + 1
                            }
                          }))}
                          className={`relative py-2.5 rounded-xl border font-bold active:scale-95 transition-all text-xs ${
                            count > 0 
                              ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
                              : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                          }`}
                        >
                          +RM{amt}
                          {count > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-900 text-white text-[10px] rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 shadow-sm">
                              {count}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCheckoutModal(prev => ({ 
                        ...prev, 
                        cashReceived: 0,
                        cashDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
                        changeDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 }
                      }))}
                      className="w-full py-3 bg-zinc-800 border border-zinc-700 text-zinc-500 rounded-xl font-bold hover:bg-zinc-700 transition-all text-xs uppercase tracking-wider"
                    >
                      {t('payment.clearCash' as any)}
                    </button>
                  </div>

                  {/* Balance Display */}
                  <div
                    className={`border-2 rounded-lg p-4 ${
                      balance < 0
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-green-500 bg-green-500/10'
                    }`}
                  >
                    <div className="text-xs text-zinc-400 uppercase font-semibold mb-1">
                      {t('payment.balance' as any)}
                    </div>
                    <div
                      className={`text-2xl font-bold ${
                        balance < 0 ? 'text-red-400' : 'text-green-400'
                      }`}
                    >
                      {formatCurrency(Math.abs(balance))}
                    {balance < 0 ? ` ${t('payment.shortage' as any)}` : ` ${t('payment.surplus' as any)}`}
                    </div>
                  </div>

                  {/* Error Message */}
                  {balance < 0 && (
                    <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                      <AlertCircle className="w-4 h-4" />
                      {t('payment.error.invalidCash' as any)}
                    </div>
                  )}
                </div>
              )}

              {/* Change Denominations Selector - Only when balance exists */}
              {checkoutModal.paymentMethod === 'CASH' && balance > 0 && (
                <div className="space-y-4 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700 rounded-2xl p-4">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">
                      {t('payment.changeBills' as any)}
                    </label>
                    <span className={`text-xs font-black px-2 py-0.5 rounded ${isChangeIncomplete ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                      {formatCurrency(totalChangeValue)} / {formatCurrency(balance)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {[1, 5, 10, 20, 50, 100].map((amt) => {
                      const count = checkoutModal.changeDenominations[amt] || 0
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCheckoutModal(prev => ({
                            ...prev,
                            changeDenominations: {
                              ...prev.changeDenominations,
                              [amt]: (prev.changeDenominations[amt] || 0) + 1
                            }
                          }))}
                          className={`relative py-2.5 rounded-xl border font-bold transition-all text-xs ${
                            count > 0 ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500'
                          }`}
                        >
                          RM{amt}
                          {count > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-[10px] rounded-full flex items-center justify-center border border-white dark:border-zinc-900">{count}</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* QR Display - For Online Payment */}
              {checkoutModal.paymentMethod === 'ONLINE' && (
                <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 text-center">
                  <div className="w-32 h-32 bg-white mx-auto mb-4 rounded-lg flex items-center justify-center">
                    <div className="text-xs text-zinc-400">{t('payment.qrPlaceholder' as any)}</div>
                  </div>
                  <p className="text-zinc-400 text-sm">
                    {t('payment.qrInstruction' as any)}
                  </p>
                  <p className="text-white font-semibold mt-2">
                    {formatCurrency(totalWithAddons)}
                  </p>
                </div>
              )}

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={
                  processingId !== null ||
                  !checkoutModal.paymentMethod ||
                  (checkoutModal.paymentMethod === 'CASH' && balance < 0) ||
                  isChangeIncomplete
                }
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed text-white font-bold py-5 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 text-xl shadow-lg shadow-green-500/20"
              >
                {processingId ? <Loader2 className="w-6 h-6 animate-spin" /> : null}
                <span>{t('payment.checkout' as any)}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{t('cashier.editTitle' as any) || 'Edit Car Details'}</h3>
              <button
                onClick={() => setEditingTransaction(null)}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-500 mb-1 uppercase tracking-wider">{t('intake.plateNumber' as any)}</label>
                  <input
                    type="text"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-lg font-mono font-bold uppercase"
                    value={editingTransaction.plateNumber}
                    onChange={(e) => setEditingTransaction({...editingTransaction, plateNumber: e.target.value.toUpperCase()})}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-zinc-500 mb-1 uppercase tracking-wider">{t('intake.brand' as any)}</label>
                    <select
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold appearance-none cursor-pointer"
                      value={editingTransaction.brand}
                      onChange={(e) => {
                        const brand = e.target.value
                        const modelsForBrand = priceBook.filter(it => it.brand === brand)
                        const firstModel = modelsForBrand[0]?.model || ''
                        const newPrice = calculatePrice(brand, firstModel, editingTransaction.services)
                        setEditingTransaction({
                          ...editingTransaction,
                          brand,
                          model: firstModel,
                          computedPrice: newPrice
                        })
                      }}
                    >
                      <option value="">{t('intake.brand.placeholder' as any)}</option>
                      {Array.from(new Set(priceBook.map(it => it.brand))).sort().map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-zinc-500 mb-1 uppercase tracking-wider">{t('intake.model' as any)}</label>
                    <select
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-bold appearance-none cursor-pointer"
                      value={editingTransaction.model}
                      onChange={(e) => {
                        const model = e.target.value
                        const newPrice = calculatePrice(editingTransaction.brand, model, editingTransaction.services)
                        setEditingTransaction({
                          ...editingTransaction,
                          model,
                          computedPrice: newPrice
                        })
                      }}
                    >
                      <option value="">{t('intake.model.placeholder' as any)}</option>
                      {priceBook
                        .filter(it => it.brand === editingTransaction.brand)
                        .map(it => it.model)
                        .sort()
                        .map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))
                      }
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-500 mb-2 uppercase tracking-wider">{t('intake.services' as any)}</label>
                  <div className="flex flex-wrap gap-3">
                    {(['exterior', 'interior', 'engine'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          const newServices = { ...editingTransaction.services, [s]: !editingTransaction.services[s] }
                          const newPrice = calculatePrice(editingTransaction.brand, editingTransaction.model, newServices)
                          setEditingTransaction({
                            ...editingTransaction,
                            services: newServices,
                            computedPrice: newPrice
                          })
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                          editingTransaction.services[s]
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-zinc-100 dark:bg-zinc-800 border-transparent text-zinc-500'
                        }`}
                      >
                        {SERVICE_CATEGORIES[s][language as 'en' | 'ms']}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Selection */}
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">
                    <Palette className="w-3.5 h-3.5" />
                    {t('intake.color' as any)}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CAR_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditingTransaction({ ...editingTransaction, color })}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${
                          editingTransaction.color === color 
                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-md' 
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-transparent hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        {t(`color.${color}` as any)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image Section in Edit Modal */}
                <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-900/50">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">
                        {t('payment.vehiclePhoto' as any) || 'Vehicle Photo'}
                      </div>
                      <p className="text-[10px] text-zinc-500 font-bold leading-tight">
                        {t('payment.vehiclePhotoNote' as any) || 'Upload or update vehicle photo.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={processingId === editingTransaction.id}
                      onClick={() => editImageInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200 hover:border-blue-500 transition-all disabled:opacity-50"
                    >
                      {processingId === editingTransaction.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Camera className="w-3.5 h-3.5" />
                      )}
                      {editingTransaction.imageUrl ? (t('payment.changePhoto' as any) || 'Change') : (t('payment.uploadPhoto' as any) || 'Upload')}
                    </button>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={editImageInputRef}
                    onChange={handleEditImageCapture}
                    className="hidden"
                  />
                  {editingTransaction.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setViewingImageUrl(editingTransaction.imageUrl || null)}
                      className="mt-3 text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:underline text-left block"
                    >
                      {t('payment.viewUploadedPhoto' as any) || 'View photo'}
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-zinc-500 mb-1 uppercase tracking-wider">{t('common.notes' as any) || 'Notes'}</label>
                  <textarea
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm"
                    rows={3}
                    value={(editingTransaction as any).notes || ''}
                    onChange={(e) => setEditingTransaction({...editingTransaction, notes: e.target.value})}
                    placeholder={t('common.notesPlaceholder' as any) || 'Add any internal notes here...'}
                  />
                </div>

                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-zinc-500 uppercase tracking-widest">{t('payment.totalAmount' as any)}</span>
                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                      {formatCurrency(editingTransaction.computedPrice)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 flex gap-3">
              <button
                onClick={() => setEditingTransaction(null)}
                className="flex-1 py-4 text-zinc-600 dark:text-zinc-400 font-bold hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                {t('common.cancel' as any) || 'Cancel'}
              </button>
              <button
                onClick={handleUpdate}
                className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-blue-500/20"
              >
                {t('common.save' as any) || 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewingImageUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
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
              <img src={viewingImageUrl} alt="Vehicle Photo" className="w-full h-auto rounded-xl" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
