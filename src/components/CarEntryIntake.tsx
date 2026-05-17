'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  Plus,
  Loader2,
  Check,
  Car,
  Sparkles,
  Zap,
  Palette,
  ChevronDown
} from 'lucide-react'
import { CarService, IntakeFormData } from '@/types'
import { useLanguage } from '@/hooks/useLanguage'
import { createTransaction, listenToFullPriceBook } from '@/lib/firebaseService'
import { showToast } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils'

interface CarEntryIntakeProps {
  onTransactionAdded?: (transaction: any) => void
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
]

const SERVICE_CATEGORIES = {
  exterior: { ms: 'Luar', en: 'Exterior' },
  interior: { ms: 'Dalam', en: 'Interior' },
  engine: { ms: 'Enjin', en: 'Engine' },
}

export default function CarEntryIntake({ onTransactionAdded }: CarEntryIntakeProps) {
  const { t, language } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [priceBook, setPriceBook] = useState<any[]>([])
  const [formData, setFormData] = useState<IntakeFormData>({
    plateNumber: '',
    brand: '',
    color: '',
    services: {
      exterior: false,
      interior: false,
      engine: false,
    },
  })

  const [selectedModels, setSelectedModels] = useState<string[]>([])

  // Load Price Book from Firebase
  useEffect(() => {
    const unsub = listenToFullPriceBook((items) => {
      setPriceBook(items)
    })
    return () => unsub()
  }, [])

  // Get unique brands from price book
  const availableBrands = useMemo(() => {
    const brands = priceBook.map(item => item.brand)
    return Array.from(new Set(brands)).sort()
  }, [priceBook])

  // Get models for selected brand from price book
  const availableModels = useMemo(() => {
    if (!formData.brand) return []
    return priceBook
      .filter(item => item.brand === formData.brand)
      .map(item => item.model)
      .sort()
  }, [formData.brand, priceBook])

  // Calculate estimated price based on selected services
  const estimatedPrice = useMemo(() => {
    const selectedModelData = priceBook.find(
      it => it.brand === formData.brand && it.model === selectedModels[0]
    )

    if (!selectedModelData) return 0

    const { exterior, interior, engine } = formData.services

    // Rule: If all three checkboxes are unchecked, total price is 0
    if (!exterior && !interior && !engine) return 0

    // Rule: Vacuum Only Case (Engine=F, Exterior=F, Interior=T)
    if (interior && !exterior && !engine) {
      return selectedModelData.vaccuum_price || 0
    }

    let total = 0

    // Rule: Full Package Wash (Exterior + Interior)
    if (exterior && interior) {
      total = selectedModelData.interior_price || 0
    } 
    // Rule: Exterior Only Wash (Exterior=T, Interior=F)
    else if (exterior && !interior) {
      total = selectedModelData.exterior_price || 0
    }
    // Edge Case: Interior + Engine (No Exterior) - Treat Interior as Vacuum base
    else if (!exterior && interior) {
      total = selectedModelData.vaccuum_price || 0
    }

    // Add Engine price if checked
    if (engine) {
      total += selectedModelData.engine_price || 0
    }

    return total
  }, [formData.services, formData.brand, selectedModels, priceBook])

  const handlePlateNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      plateNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9\s]/g, ''),
    })
  }

  const handleBrandChange = (brand: string) => {
    setFormData({
      ...formData,
      brand,
    })
    setSelectedModels([])
  }

  const handleColorChange = (color: string) => {
    setFormData({
      ...formData,
      color,
    })
  }

  const handleServiceChange = (service: keyof CarService) => {
    setFormData({
      ...formData,
      services: {
        ...formData.services,
        [service]: !formData.services[service],
      },
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.plateNumber.trim()) {
      showToast.error(t('intake.error.plateRequired' as any))
      return
    }

    if (!formData.brand) {
      showToast.error(t('intake.error.brandRequired' as any))
      return
    }

    if (estimatedPrice === 0) {
      showToast.error(t('intake.error.priceZero' as any))
      return
    }

    setLoading(true)

    try {
      const transactionId = await createTransaction(
        formData.plateNumber,
        formData.brand,
        selectedModels[0] || 'Unknown',
        formData.color || 'Unknown',
        formData.services,
        estimatedPrice
      )

      showToast.success(t('intake.success' as any))

      // Reset form
      setFormData({
        plateNumber: '',
        brand: '',
        color: '',
        services: {
          exterior: false,
          interior: false,
          engine: false,
        },
      })

      onTransactionAdded?.({
        id: transactionId,
        plateNumber: formData.plateNumber,
        brand: formData.brand,
        model: selectedModels[0] || '',
        computedPrice: estimatedPrice,
      })
    } catch (error) {
      console.error('Error creating transaction:', error)
      showToast.error(t('payment.error' as any))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative bg-white dark:bg-zinc-900/90 sm:backdrop-blur-xl rounded-[2rem] border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-2xl transition-all duration-300 mt-4 sm:mt-0 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Car className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">{t('intake.title' as any)}</h2>
          <p className="text-gray-600 dark:text-zinc-400 text-sm">{t('intake.subtitle' as any)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Plate Number Input */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">
            {t('intake.plateNumber' as any)}
          </label>
          <input
            type="text"
            value={formData.plateNumber}
            onChange={handlePlateNumberChange}
            placeholder={t('intake.plateNumber.placeholder' as any)}
            className="w-full bg-zinc-100 dark:bg-zinc-800/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 rounded-2xl px-5 py-4 text-2xl font-mono font-black placeholder-zinc-400 dark:placeholder-zinc-600 text-zinc-900 dark:text-white transition-all outline-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">
            {t('intake.brand' as any)}
          </label>
          <div className="relative">
            <select
              value={formData.brand}
              onChange={(e) => handleBrandChange(e.target.value)}
              className="w-full appearance-none bg-zinc-100 dark:bg-zinc-800/50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-5 py-3.5 text-zinc-900 dark:text-white font-bold outline-none transition-all"
            >
              <option value="">{t('intake.brand.placeholder' as any)}</option>
              {availableBrands.map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">
            {t('intake.model' as any)}
          </label>
          <div className="relative">
            <select
              disabled={!formData.brand}
              value={selectedModels[0] || ''}
              onChange={(e) => setSelectedModels([e.target.value])}
              className="w-full appearance-none bg-zinc-100 dark:bg-zinc-800/50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-5 py-3.5 text-zinc-900 dark:text-white font-bold outline-none transition-all disabled:opacity-50"
            >
              <option value="">{t('intake.model.placeholder' as any)}</option>
              {availableModels.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
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
                onClick={() => handleColorChange(color)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${
                  formData.color === color 
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-md' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-transparent hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                {t(`color.${color}` as any)}
              </button>
            ))}
          </div>
        </div>

        {/* Service Types - Toggle Switches */}
        <div className="space-y-3">
          <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">
            {t('intake.services' as any)} *
          </label>
          <div className="grid grid-cols-1 gap-3">
            {(
              Object.keys(SERVICE_CATEGORIES) as Array<keyof typeof SERVICE_CATEGORIES>
            ).map((service) => {
              const selectedModelData = priceBook.find(
                it => it.brand === formData.brand && it.model === selectedModels[0]
              )
              const isSelected = formData.services[service]
              
              let displayPrice = 0
              if (selectedModelData) {
                if (service === 'exterior') displayPrice = selectedModelData.exterior_price
                if (service === 'engine') displayPrice = selectedModelData.engine_price
                if (service === 'interior') {
                  displayPrice = formData.services.exterior 
                    ? selectedModelData.interior_price 
                    : selectedModelData.vaccuum_price
                }
              }

              const Icon = service === 'exterior' ? Car : service === 'interior' ? Sparkles : Zap

              return (
                <button
                  key={service}
                  type="button"
                  onClick={() => handleServiceChange(service)}
                  className={`group flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 text-left ${
                    isSelected 
                      ? 'bg-blue-600/10 border-blue-600 dark:bg-blue-500/10 dark:border-blue-500' 
                      : 'bg-zinc-100 dark:bg-zinc-800/50 border-transparent hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className={`text-sm font-bold uppercase tracking-tight ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {SERVICE_CATEGORIES[service][language as 'en' | 'ms']}
                      {service === 'interior' && formData.services.exterior && (
                        <span className="ml-2 text-[10px] opacity-60 lowercase font-normal italic">(Package)</span>
                      )}
                    </div>
                    <div className="text-zinc-900 dark:text-white text-lg font-black leading-tight">
                      {displayPrice > 0 ? formatCurrency(displayPrice) : '--'}
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-zinc-300 dark:border-zinc-700'
                  }`}>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[4]" />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Estimated Price Display */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 rounded-3xl p-6 shadow-xl shadow-blue-500/20 transition-all">
          <div className="flex justify-between items-center">
            <span className="text-blue-100 font-bold uppercase tracking-widest text-xs">
              {t('intake.price' as any)}
            </span>
            <span className="text-3xl font-black text-white">
              {formatCurrency(estimatedPrice)}
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 active:scale-[0.98] disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed font-black py-5 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 text-xl shadow-xl"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
          <span className="uppercase tracking-widest">{t('intake.addQueue' as any)}</span>
        </button>
      </form>
    </div>
  )
}
