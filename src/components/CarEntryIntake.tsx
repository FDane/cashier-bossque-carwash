'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Plus,
  Loader2, Monitor, Camera,
  Check,
  Car,
  Sparkles,
  Zap,
  Palette,
  ChevronDown,
  ScanLine,
  AlertCircle,
} from 'lucide-react'
import { CarService, IntakeFormData } from '@/types'
import { useLanguage } from '@/hooks/useLanguage'
import { createTransaction, listenToFullPriceBook, uploadImageToFirebase, updateTransaction } from '@/lib/firebaseService'
import { showToast } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils'
import { resizeImage } from '@/lib/imageUtils'
import CameraModal from './CameraModal'

interface CarEntryIntakeProps {
  onTransactionAdded?: (transaction: any) => void
}

const CAR_COLORS = [
  'Black', 'White', 'Silver', 'Gray', 'Blue', 'Red', 'Gold', 'Beige',
  'Green', 'Orange', 'Purple', 'Yellow', 'Pink', 'Brown', 'Turquoise',
]

const SERVICE_CATEGORIES = {
  exterior: { ms: 'Luar', en: 'Exterior' },
  interior: { ms: 'Dalam', en: 'Interior' },
  engine: { ms: 'Enjin', en: 'Engine' },
}

/** Returns the promo price for a service if the vehicle has an active promotion
 *  and a promo price was set for that service; otherwise falls back to the normal price. */
function getServicePrice(item: any, normalKey: string, promoKey: string): number {
  if (!item) return 0
  if (item.promo_active && item[promoKey] > 0) return item[promoKey]
  return item[normalKey] || 0
}

export default function CarEntryIntake({ onTransactionAdded }: CarEntryIntakeProps) {
  const [isDesktop, setIsDesktop] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const { t, language } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [priceBook, setPriceBook] = useState<any[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState<IntakeFormData>({
    plateNumber: '',
    brand: '',
    color: '',
    services: { exterior: false, interior: false, engine: false },
  })
  const [selectedModels, setSelectedModels] = useState<string[]>([])

  // ─── Gemini AI state ────────────────────────────────────────────────────────
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiDetected, setAiDetected] = useState(false)

  // Load Price Book from Firebase
  useEffect(() => {
    const unsub = listenToFullPriceBook((items) => setPriceBook(items))
    return () => unsub()
  }, [])

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ─── Gemini AI Analysis ─────────────────────────────────────────────────────

  const analyzeCarWithGemini = useCallback(async (file: File, brands: string[]) => {
    setAiLoading(true)
    setAiError(null)
    setAiDetected(false)

    try {
      // 1. Correctly compress the image
      const compressed = await resizeImage(file)

      // 2. Convert the COMPRESSED file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = () => reject(new Error('Failed to read image file'))
        reader.readAsDataURL(compressed) // 🔗 FIXED: Reading 'compressed' now!
      })

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64,
          mimeType: compressed.type || 'image/jpeg',
          availableColors: CAR_COLORS,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error ?? `Server error ${response.status}`)
      }

      const parsed = await response.json()
      // parsed = { plateNumber, brand, model, color }

      // Auto-fill plate + color (always safe to fill)
      setFormData(prev => ({
        ...prev,
        plateNumber: parsed.plateNumber
          ? parsed.plateNumber.toUpperCase().replace(/[^A-Z0-9\s]/g, '')
          : prev.plateNumber,
        color: parsed.color && CAR_COLORS.includes(parsed.color) ? parsed.color : prev.color,
        // Only set brand if it exists in the price book
        brand: parsed.brand && brands.includes(parsed.brand) ? parsed.brand : prev.brand,
      }))

      // Auto-select model only when brand also matched
      if (parsed.model && parsed.brand && brands.includes(parsed.brand)) {
        const matchedModels = priceBook
          .filter(i => i.brand === parsed.brand)
          .map(i => i.model as string)
        const matchedModel = matchedModels.find(
          m => m.toLowerCase() === parsed.model.toLowerCase()
        )
        if (matchedModel) setSelectedModels([matchedModel])
      }

      setAiDetected(true)
      showToast.success(t('intake.aiDetected' as any))
    } catch (err: any) {
      console.error('Gemini error:', err)
      setAiError(err.message ?? 'Could not detect car details. Please fill the form manually.')
    } finally {
      setAiLoading(false)
    }
  }, [priceBook])

  // ─── Image helpers ──────────────────────────────────────────────────────────

  const applyImage = (file: File) => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
    setAiDetected(false)
    setAiError(null)
    analyzeCarWithGemini(file, availableBrands)
  }

  /** Called by the hidden <input type="file"> — mobile path */
  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      applyImage(file)
    } else {
      setImagePreviewUrl(null)
      setImageFile(null)
    }
  }

  /** Called by CameraModal with the CCTV snapshot File — desktop path */
  const handleCCTVCapture = (file: File) => {
    applyImage(file)
    setShowCamera(false)
  }

  const triggerImageCapture = () => fileInputRef.current?.click()

  const handleRemovePhoto = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImagePreviewUrl(null)
    setImageFile(null)
    setAiDetected(false)
    setAiError(null)
  }

  // ─── Price book derived state ───────────────────────────────────────────────

  const availableBrands = useMemo(() => {
    return Array.from(new Set(priceBook.map(i => i.brand))).sort() as string[]
  }, [priceBook])

  const availableModels = useMemo(() => {
    if (!formData.brand) return []
    return priceBook.filter(i => i.brand === formData.brand).map(i => i.model).sort()
  }, [formData.brand, priceBook])

  const estimatedPrice = useMemo(() => {
    const selectedModelData = priceBook.find(
      it => it.brand === formData.brand && it.model === selectedModels[0]
    )
    if (!selectedModelData) return 0
    const { exterior, interior, engine } = formData.services
    if (!exterior && !interior && !engine) return 0
    if (interior && !exterior && !engine) return getServicePrice(selectedModelData, 'vaccuum_price', 'promo_vaccuum_price')

    let total = 0
    if (exterior && interior) total = getServicePrice(selectedModelData, 'interior_price', 'promo_interior_price')
    else if (exterior && !interior) total = getServicePrice(selectedModelData, 'exterior_price', 'promo_exterior_price')
    else if (!exterior && interior) total = getServicePrice(selectedModelData, 'vaccuum_price', 'promo_vaccuum_price')
    if (engine) total += getServicePrice(selectedModelData, 'engine_price', 'promo_engine_price')
    return total
  }, [formData.services, formData.brand, selectedModels, priceBook])

  // ─── Form handlers ──────────────────────────────────────────────────────────

  const handlePlateNumberChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData({ ...formData, plateNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9\s]/g, '') })

  const handleBrandChange = (brand: string) => {
    setFormData({ ...formData, brand })
    setSelectedModels([])
  }

  const handleColorChange = (color: string) => setFormData({ ...formData, color })
  const handleServiceChange = (service: keyof CarService) =>
    setFormData({ ...formData, services: { ...formData.services, [service]: !formData.services[service] } })

  // ─── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.plateNumber.trim()) { showToast.error(t('intake.error.plateRequired' as any)); return }
    if (!formData.brand) { showToast.error(t('intake.error.brandRequired' as any)); return }
    if (estimatedPrice === 0) { showToast.error(t('intake.error.priceZero' as any)); return }

    setLoading(true)
    try {
      const formattedPlate = formData.plateNumber
        .trim().toUpperCase()
        .replace(/\s+/g, '')
        .replace(/([A-Z]+)(\d+)/g, '$1 $2')
        .replace(/(\d+)([A-Z]+)/g, '$1 $2')

      const transactionId = await createTransaction(
        formattedPlate, formData.brand,
        selectedModels[0] || 'Unknown', formData.color || 'Unknown',
        formData.services, estimatedPrice
      )

      if (imageFile) {
        try {
          const compressed = await resizeImage(imageFile)
          const { imageUrl, imagePath } = await uploadImageToFirebase(compressed, transactionId, formattedPlate)
          await updateTransaction(transactionId, { imageUrl, imagePath })
        } catch (uploadError) {
          console.error('Error uploading transaction image:', uploadError)
          showToast.warning(t('intake.imageUploadFailed' as any))
        }
      }

      showToast.success(t('intake.success' as any))

      setFormData({ plateNumber: '', brand: '', color: '', services: { exterior: false, interior: false, engine: false } })
      setSelectedModels([])
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
      setImageFile(null)
      setImagePreviewUrl(null)
      setAiDetected(false)
      setAiError(null)

      onTransactionAdded?.({ id: transactionId, plateNumber: formattedPlate, brand: formData.brand, model: selectedModels[0] || '', computedPrice: estimatedPrice })
    } catch (error) {
      console.error('Error creating transaction:', error)
      showToast.error(t('payment.error' as any))
    } finally {
      setLoading(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div className="w-10 h-10 bg-zinc-900 dark:bg-white flex items-center justify-center">
          <Car className="w-5 h-5 text-white dark:text-zinc-900" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-wider">{t('intake.title' as any)}</h2>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest">{t('intake.subtitle' as any)}</p>
        </div>
      </div>

      {/* Hidden file input — used only on mobile */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleImageCapture}
      />

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Image Capture Section (moved to TOP) ─────────────────────────── */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">
            <ScanLine className="w-3.5 h-3.5" />
            {t('intake.aiScan' as any)}
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={triggerImageCapture}
              disabled={aiLoading}
              className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all disabled:opacity-60 disabled:cursor-not-allowed ${imagePreviewUrl
                  ? 'bg-blue-600/10 border-blue-600 text-blue-600'
                  : 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700 text-zinc-500'
                }`}
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-semibold">{t('intake.scanningAILabel' as any)}</span>
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  <span>{imagePreviewUrl ? t('intake.changePhoto' as any) : t('intake.uploadPhoto' as any)}</span>
                </>
              )}
            </button>

            {/* Desktop-only CCTV monitor button */}
            {isDesktop && (
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                disabled={aiLoading}
                className="px-4 py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('intake.liveCCTVMonitor' as any)}
              >
                <Monitor className="w-6 h-6" />
              </button>
            )}

            {/* Re-scan button — appears after image is captured */}
            {imageFile && !aiLoading && (
              <button
                type="button"
                onClick={() => analyzeCarWithGemini(imageFile, availableBrands)}
                className="px-4 py-4 bg-blue-600 text-white rounded-2xl hover:opacity-90 transition-all shadow-lg"
                title={t('intake.rescanAI' as any)}
              >
                <Sparkles className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Image preview */}
          {imagePreviewUrl && (
            <div className="relative rounded-2xl overflow-hidden border-2 border-blue-500">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreviewUrl} alt="Preview" className="w-full object-cover max-h-48" />

              {/* Remove button */}
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
                title={t('intake.removePhoto' as any)}
              >
                ✕
              </button>

              {/* AI scanning overlay */}
              {aiLoading && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                  <div className="relative">
                    <ScanLine className="w-10 h-10 text-blue-400 animate-pulse" />
                  </div>
                  <span className="text-white text-sm font-bold tracking-widest uppercase">{t('intake.scanningAILabel' as any)}</span>
                </div>
              )}
            </div>
          )}

          {/* AI success banner */}
          {aiDetected && !aiLoading && (
            <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl px-4 py-3 text-green-700 dark:text-green-400 text-sm font-medium">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{t('intake.aiDetected' as any)}</span>
            </div>
          )}

          {/* AI error banner */}
          {aiError && !aiLoading && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{aiError}</span>
            </div>
          )}
        </div>

        {/* ── Plate Number ──────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">
            {t('intake.plateNumber' as any)}
          </label>
          <input
            type="text"
            value={formData.plateNumber}
            onChange={handlePlateNumberChange}
            placeholder={t('intake.plateNumber.placeholder' as any)}
            className="w-full bg-surface-a0 border border-surface-a20 focus:bg-surface-tonal focus:border-primary-a0 rounded-xl px-5 py-4 text-3xl font-mono font-black placeholder-zinc-300 dark:placeholder-zinc-700 text-zinc-900 dark:text-white transition-colors outline-none"
          />
        </div>

        {/* ── Brand ─────────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">
            {t('intake.brand' as any)}
          </label>
          <div className="relative">
            <select
              value={formData.brand}
              onChange={(e) => handleBrandChange(e.target.value)}
              className="w-full appearance-none bg-surface-a0 border border-surface-a20 focus:bg-surface-tonal focus:border-primary-a0 rounded-xl px-5 py-4 text-zinc-900 dark:text-white font-bold outline-none transition-colors"
            >
              <option value="">{t('intake.brand.placeholder' as any)}</option>
              {availableBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        {/* ── Model ─────────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
            {t('intake.model' as any)}
            {priceBook.find(it => it.brand === formData.brand && it.model === selectedModels[0])?.promo_active && (
              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 normal-case">
                {t('priceBook.promo' as any) || 'Promo'}
              </span>
            )}
          </label>
          <div className="relative">
            <select
              disabled={!formData.brand}
              value={selectedModels[0] || ''}
              onChange={(e) => setSelectedModels([e.target.value])}
              className="w-full appearance-none bg-surface-a0 border border-surface-a20 focus:bg-surface-tonal focus:border-primary-a0 rounded-xl px-5 py-4 text-zinc-900 dark:text-white font-bold outline-none transition-colors disabled:opacity-50"
            >
              <option value="">{t('intake.model.placeholder' as any)}</option>
              {availableModels.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        {/* ── Color ─────────────────────────────────────────────────────────── */}
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
                className={`px-4 py-3 text-xs font-bold transition-colors rounded-xl border ${formData.color === color
                    ? 'bg-primary-a0 text-white border-primary-a0'
                    : 'bg-surface-a0 text-zinc-500 border-surface-a20 hover:border-primary-a0 hover:text-primary-a0'
                  }`}
              >
                {t(`color.${color}` as any)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Services ──────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">
            {t('intake.services' as any)} *
          </label>
          <div className="grid grid-cols-1 gap-3">
            {(Object.keys(SERVICE_CATEGORIES) as Array<keyof typeof SERVICE_CATEGORIES>).map((service) => {
              const selectedModelData = priceBook.find(it => it.brand === formData.brand && it.model === selectedModels[0])
              const isSelected = formData.services[service]
              let displayPrice = 0
              let normalPrice = 0
              if (selectedModelData) {
                if (service === 'exterior') {
                  normalPrice = selectedModelData.exterior_price
                  displayPrice = getServicePrice(selectedModelData, 'exterior_price', 'promo_exterior_price')
                }
                if (service === 'engine') {
                  normalPrice = selectedModelData.engine_price
                  displayPrice = getServicePrice(selectedModelData, 'engine_price', 'promo_engine_price')
                }
                if (service === 'interior') {
                  normalPrice = formData.services.exterior ? selectedModelData.interior_price : selectedModelData.vaccuum_price
                  displayPrice = formData.services.exterior
                    ? getServicePrice(selectedModelData, 'interior_price', 'promo_interior_price')
                    : getServicePrice(selectedModelData, 'vaccuum_price', 'promo_vaccuum_price')
                }
              }
              const isPromo = selectedModelData?.promo_active && displayPrice > 0 && displayPrice < normalPrice
              const Icon = service === 'exterior' ? Car : service === 'interior' ? Sparkles : Zap
              return (
                <button
                  key={service}
                  type="button"
                  onClick={() => handleServiceChange(service)}
                  className={`group flex items-center gap-4 p-4 border rounded-xl transition-colors text-left ${isSelected
                      ? 'bg-surface-tonal border-primary-a0'
                      : 'bg-surface-a0 border-surface-a20 hover:border-primary-a0'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isSelected ? 'bg-primary-a0 text-white' : 'bg-surface-a10 text-zinc-400'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className={`text-sm font-bold uppercase tracking-tight flex items-center gap-1.5 ${isSelected ? 'text-primary-a0' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {SERVICE_CATEGORIES[service][language as 'en' | 'ms']}
                      {service === 'interior' && formData.services.exterior && (
                        <span className="ml-2 text-[10px] opacity-60 lowercase font-normal italic">(Package)</span>
                      )}
                      {isPromo && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {t('priceBook.promo' as any) || 'Promo'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isPromo ? (
                        <>
                          <span className="text-zinc-400 dark:text-zinc-600 text-sm font-bold line-through">{formatCurrency(normalPrice)}</span>
                          <span className="text-amber-600 dark:text-amber-400 text-lg font-black leading-tight">{formatCurrency(displayPrice)}</span>
                        </>
                      ) : (
                        <span className="text-zinc-900 dark:text-white text-lg font-black leading-tight">
                          {displayPrice > 0 ? formatCurrency(displayPrice) : '--'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary-a0 border-primary-a0' : 'border-surface-a20'}`}>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[4]" />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Price & Submit ────────────────────────────────────────────────── */}
        <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 font-black uppercase tracking-widest text-xs">{t('intake.price' as any)}</span>
            <span className="text-3xl font-mono font-black text-zinc-900 dark:text-white">{formatCurrency(estimatedPrice)}</span>
          </div>

          <div className="flex gap-3">
            {/* Mobile-only secondary Camera Button */}
            <button
              type="button"
              onClick={triggerImageCapture}
              disabled={aiLoading}
              className={`relative p-4 rounded-2xl border-2 transition-all sm:hidden flex items-center justify-center disabled:opacity-50 ${imagePreviewUrl
                  ? 'bg-blue-600/10 border-blue-600 text-blue-600'
                  : 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700 text-zinc-500'
                }`}
            >
              {aiLoading
                ? <Loader2 className="w-6 h-6 animate-spin" />
                : <Camera className="w-6 h-6" />
              }
              {imagePreviewUrl && !aiLoading && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full border-2 border-white dark:border-zinc-900 shadow-sm" />
              )}
            </button>

            <button
              type="submit"
              disabled={loading || aiLoading}
              className="flex-1 bg-primary-a0 text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-bold py-5 px-6 transition-colors flex items-center justify-center gap-3 text-lg uppercase tracking-wider"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
              <span>{t('intake.addQueue' as any)}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Desktop CCTV Modal */}
      {showCamera && (
        <CameraModal
          onClose={() => setShowCamera(false)}
          onCapture={handleCCTVCapture}
        />
      )}
    </div>
  )
}