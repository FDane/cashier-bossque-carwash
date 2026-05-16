'use client'

import React, { useState, useMemo } from 'react'
import {
  Plus,
  Loader2,
  Check,
} from 'lucide-react'
import { CarService, IntakeFormData } from '@/types'
import { useLanguage } from '@/hooks/useLanguage'
import { createTransaction } from '@/lib/firebaseService'
import { showToast } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils'

interface CarEntryIntakeProps {
  onTransactionAdded?: (transaction: any) => void
}

// Sample car brands and models
const CAR_BRANDS: Record<string, string[]> = {
  Toyota: ['Camry', 'Vios', 'Corolla', 'Fortuner', 'Yaris'],
  Honda: ['Civic', 'Accord', 'CR-V', 'Jazz', 'HR-V'],
  Proton: ['X50', 'X70', 'Persona', 'Saga', 'Iriz'],
  Perodua: ['Myvi', 'Alza', 'Axia', 'Ativa', 'Aruz'],
  BMW: ['3 Series', '5 Series', 'X5', 'X7'],
  Mercedes: ['C-Class', 'E-Class', 'GLE', 'GLC'],
  Other: ['Other Brand'],
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

// Price structure: brand -> service -> price (in RM)
const PRICING_TABLE: Record<string, Record<string, number>> = {
  exterior: { standard: 20, premium: 35 },
  interior: { standard: 25, premium: 40 },
  engine: { standard: 15, premium: 25 },
}

const SERVICE_CATEGORIES = {
  exterior: { ms: 'Luar', en: 'Exterior' },
  interior: { ms: 'Dalam', en: 'Interior' },
  engine: { ms: 'Enjin', en: 'Engine' },
}

export default function CarEntryIntake({ onTransactionAdded }: CarEntryIntakeProps) {
  const { t, language } = useLanguage()
  const [loading, setLoading] = useState(false)
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

  // Calculate estimated price based on selected services
  const estimatedPrice = useMemo(() => {
    let price = 0
    if (formData.services.exterior) price += PRICING_TABLE.exterior.standard
    if (formData.services.interior) price += PRICING_TABLE.interior.standard
    if (formData.services.engine) price += PRICING_TABLE.engine.standard
    return price
  }, [formData.services])

  // Get models for selected brand
  const availableModels = useMemo(() => {
    return formData.brand && CAR_BRANDS[formData.brand]
      ? CAR_BRANDS[formData.brand]
      : []
  }, [formData.brand])

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
    <div className="bg-white dark:bg-zinc-900/80 backdrop-blur-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 sm:p-8 shadow-premium-lg transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
          <Plus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">{t('intake.title' as any)}</h2>
          <p className="text-gray-600 dark:text-zinc-400 text-sm">{t('intake.subtitle' as any)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Plate Number Input */}
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
            {t('intake.plateNumber' as any)} *
          </label>
          <input
            type="text"
            value={formData.plateNumber}
            onChange={handlePlateNumberChange}
            placeholder={t('intake.plateNumber.placeholder' as any)}
            className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3.5 text-xl font-mono font-bold placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-zinc-900 dark:text-white transition-all duration-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
            {t('intake.brand' as any)} *
          </label>
          <select
            value={formData.brand}
            onChange={(e) => handleBrandChange(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
          >
            <option value="">{t('intake.brand.placeholder' as any)}</option>
            {Object.keys(CAR_BRANDS).map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </div>

        {/* Models Dropdown */}
        {availableModels.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
              {t('intake.model' as any)}
            </label>
            <select
              value={selectedModels[0] || ''}
              onChange={(e) => setSelectedModels([e.target.value])}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            >
              <option value="">{t('intake.model.placeholder' as any)}</option>
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Color Selection */}
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-2">
            {t('intake.color' as any)}
          </label>
          <select
            value={formData.color}
            onChange={(e) => handleColorChange(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
          >
            <option value="">{t('intake.color.placeholder' as any)}</option>
            {CAR_COLORS.map((color) => (
              <option key={color} value={color}>
                {t(`color.${color}` as any)}
              </option>
            ))}
          </select>
        </div>

        {/* Service Types - Toggle Switches */}
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-3">
            {t('intake.services' as any)} *
          </label>
          <div className="space-y-3">
            {(
              Object.keys(SERVICE_CATEGORIES) as Array<keyof typeof SERVICE_CATEGORIES>
            ).map((service) => (
              <label
                key={service}
                className="flex items-center gap-3 cursor-pointer p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all"
              >
                <input
                  type="checkbox"
                  checked={formData.services[service]}
                  onChange={() => handleServiceChange(service)}
                  className="w-5 h-5 rounded-md accent-blue-500 cursor-pointer"
                />
                <span className="text-zinc-900 dark:text-zinc-100 font-medium flex-1">
                  {SERVICE_CATEGORIES[service][language as 'en' | 'ms']}
                </span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  +{formatCurrency(PRICING_TABLE[service].standard)}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Estimated Price Display */}
        <div className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent dark:from-blue-500/20 dark:to-zinc-800/50 border border-blue-200/50 dark:border-blue-500/20 rounded-2xl p-5 transition-all">
          <div className="flex justify-between items-center">
            <span className="text-zinc-600 dark:text-zinc-400 font-medium">
              {t('intake.price' as any)}
            </span>
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(estimatedPrice)}
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/20 active:scale-[0.98] disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-lg shadow-md shadow-blue-500/10"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          <span>{t('intake.addQueue' as any)}</span>
        </button>
      </form>
    </div>
  )
}
