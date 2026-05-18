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
} from 'lucide-react'
import { Transaction, PaymentMethod } from '@/types'
import { useLanguage } from '@/hooks/useLanguage'
import { 
  completeTransaction, 
  updateDailyStats, 
  deleteTransaction, 
  updateTransaction, 
  uploadImageToFirebase,
  listenToFullPriceBook
} from '@/lib/firebaseService'
import { showToast } from '@/lib/toast'
import { formatCurrency, formatTime } from '@/lib/utils'

import { resizeImage } from '@/lib/imageUtils' // Import image utility
interface CashierCheckoutProps {
  pendingTransactions: Transaction[]
  loading: boolean
}

const SERVICE_CATEGORIES = {
  exterior: { ms: 'Luar', en: 'Exterior' },
  interior: { ms: 'Dalam', en: 'Interior' },
  engine: { ms: 'Enjin', en: 'Engine' },
}

const RETAIL_ITEMS = [
  { id: 'microfiber', name: 'Microfiber Cloth', price: 10 },
  { id: 'fragrance', name: 'Dwangi Fragrance', price: 11 },
  { id: 'tyreshine', name: 'Tyre Shine (Bottle)', price: 25 },
  { id: 'wiper', name: 'Wiper Fluid', price: 8 },
]

interface SelectedAddon {
  id: string
  name: string
  price: number
  quantity: number
}

interface CheckoutModalData {
  transaction: Transaction | null
  paymentMethod: PaymentMethod
  cashReceived: number
  selectedAddons: SelectedAddon[]
  cashDenominations: Record<number, number>
  changeDenominations: Record<number, number>
}

export default function CashierCheckout({
  pendingTransactions,
  loading: transactionsLoading,
}: CashierCheckoutProps) {
  const { t, language } = useLanguage()
  const [searchQuery, setSearchQuery] = useState('')
  const [priceBook, setPriceBook] = useState<any[]>([])
  const [checkoutModal, setCheckoutModal] = useState<CheckoutModalData>({
    transaction: null,
    paymentMethod: null,
    cashReceived: 0,
    selectedAddons: [],
    cashDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
    changeDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
  })
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [checkoutImagePreviewUrl, setCheckoutImagePreviewUrl] = useState<string | null>(null)

  // State for viewing image in a modal
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null)
  const checkoutImageInputRef = React.useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsub = listenToFullPriceBook((items) => {
      setPriceBook(items)
    })
    return () => unsub()
  }, [])

  // Local filtering: No extra Firebase cost
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return pendingTransactions
    const query = searchQuery.toLowerCase()
    return pendingTransactions.filter((t) =>
      t.plateNumber.toLowerCase().includes(query)
    )
  }, [pendingTransactions, searchQuery])

  // Calculate total with addons
  const totalWithAddons = useMemo(() => {
    if (!checkoutModal.transaction) return 0
    const addonsTotal = checkoutModal.selectedAddons.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )
    return checkoutModal.transaction.computedPrice + addonsTotal
  }, [checkoutModal.transaction, checkoutModal.selectedAddons])

  // Calculate balance in real-time
  const balance = useMemo(() => {
    if (!checkoutModal.transaction || checkoutModal.paymentMethod !== 'CASH') {
      return 0
    }
    return checkoutModal.cashReceived - totalWithAddons
  }, [
    checkoutModal.transaction,
    checkoutModal.paymentMethod,
    checkoutModal.cashReceived,
    totalWithAddons,
  ])

  const handleCardClick = (transaction: Transaction) => {
    setCheckoutModal({
      transaction,
      paymentMethod: null,
      cashReceived: 0,
      selectedAddons: [],
      cashDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
      changeDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
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

  const handleCashReceivedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0
    setCheckoutModal({
      ...checkoutModal,
      cashReceived: value,
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

  const handleEditClick = (transaction: Transaction) => {
    setEditingTransaction({ ...transaction })
  }

  const handleCheckoutImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && checkoutModal.transaction) {
      setProcessingId(checkoutModal.transaction.id)
      try {
        const compressedImageFile = await resizeImage(file)
        const { imageUrl, imagePath } = await uploadImageToFirebase(
          compressedImageFile,
          checkoutModal.transaction.id,
          checkoutModal.transaction.plateNumber,
          checkoutModal.transaction.imagePath || undefined
        )

        await updateTransaction(checkoutModal.transaction.id, { imageUrl, imagePath })

        setCheckoutModal((prev) =>
          prev.transaction
            ? {
                ...prev,
                transaction: {
                  ...prev.transaction,
                  imageUrl,
                  imagePath,
                },
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
    if (!checkoutModal.transaction || !checkoutModal.paymentMethod) {
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

    setProcessingId(checkoutModal.transaction.id)

    try {
      // Update transaction status to COMPLETED
      await completeTransaction(
        checkoutModal.transaction.id,
        checkoutModal.paymentMethod,
        checkoutModal.cashReceived,
        totalWithAddons,
        checkoutModal.selectedAddons,
        checkoutModal.cashDenominations,
        checkoutModal.changeDenominations
      )

      // Update daily stats with revenue and car level
      await updateDailyStats(
        checkoutModal.paymentMethod,
        totalWithAddons,
        pendingTransactions.length,
        checkoutModal.cashDenominations,
        checkoutModal.changeDenominations
      )

      showToast.success(t('payment.success' as any))

      // Close modal and reset state
      setCheckoutModal({
        transaction: null,
        paymentMethod: null,
        cashReceived: 0,
        selectedAddons: [],
        cashDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
        changeDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
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
      transaction: null,
      paymentMethod: null,
      cashReceived: 0,
      selectedAddons: [],
      cashDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
      changeDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
    })
  }

  const totalChangeValue = useMemo(() => {
    return Object.entries(checkoutModal.changeDenominations).reduce(
      (sum, [bill, count]) => sum + parseInt(bill) * count,
      0
    )
  }, [checkoutModal.changeDenominations])

  const isChangeIncomplete = balance > 0 && totalChangeValue !== balance

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
          {filteredTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className="relative text-left group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 rounded-2xl p-5 sm:p-7 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 transform hover:-translate-y-1"
            >
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-zinc-500 text-xs uppercase font-semibold">
                    {t('payment.plateNumber' as any)}
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
          ))}
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutModal.transaction && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-[2.5rem] sm:rounded-3xl w-full sm:w-full sm:max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-300">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 px-6 sm:px-8 py-5 flex justify-between items-center">
              <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
                {t('payment.title' as any)}
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
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-zinc-400 uppercase font-semibold mb-1">
                      {t('payment.plateNumber' as any)}
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white font-mono tracking-widest">
                      {checkoutModal.transaction.plateNumber}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400 uppercase font-semibold mb-1">
                      {t('payment.carDetails' as any)}
                    </div>
                    <div className="text-sm text-zinc-300">
                      {checkoutModal.transaction.brand} {checkoutModal.transaction.model} • {t(`color.${checkoutModal.transaction.color}` as any)}
                    </div>
                  </div>

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
                        {checkoutModal.transaction.imageUrl ? (t('payment.changePhoto' as any) || 'Change Photo') : (t('payment.uploadPhoto' as any) || 'Upload Photo')}
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
                    {checkoutModal.transaction.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setViewingImageUrl(checkoutModal.transaction?.imageUrl || null)}
                        className="mt-3 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {t('payment.viewUploadedPhoto' as any) || 'View uploaded photo'}
                      </button>
                    )}
                    {checkoutImagePreviewUrl && !checkoutModal.transaction.imageUrl && (
                      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                        {t('payment.photoSelectedNote' as any) || 'A new photo is ready to upload.'}
                      </p>
                    )}
                  </div>

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
                  {RETAIL_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleAddAddon(item)}
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
                      onChange={handleCashReceivedChange}
                      placeholder="0.00"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white text-xl font-semibold placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>

                  {/* Quick Cash Buttons */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {[1, 5, 10, 20, 50, 100].map((amt) => (
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
                        className="py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-300 font-bold hover:bg-zinc-700 hover:text-white active:scale-95 transition-all text-xs"
                      >
                        +RM{amt}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCheckoutModal(prev => ({ ...prev, cashReceived: totalWithAddons }))}
                      className="flex-1 py-3 bg-blue-600/20 border border-blue-500/50 text-blue-400 rounded-xl font-bold hover:bg-blue-600/30 transition-all text-xs uppercase tracking-wider"
                    >
                      {t('payment.exactAmount' as any)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCheckoutModal(prev => ({ 
                        ...prev, 
                        cashReceived: 0,
                        cashDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 },
                        changeDenominations: { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 }
                      }))}
                      className="px-6 py-3 bg-zinc-800 border border-zinc-700 text-zinc-500 rounded-xl font-bold hover:bg-zinc-700 transition-all text-xs uppercase tracking-wider"
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
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
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
            
            <div className="p-6 space-y-6">
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
