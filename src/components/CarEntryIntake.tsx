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
    if (interior && !exterior && !engine) return selectedModelData.vaccuum_price || 0

    let total = 0
    if (exterior && interior) total = selectedModelData.interior_price || 0
    else if (exterior && !interior) total = selectedModelData.exterior_price || 0
    else if (!exterior && interior) total = selectedModelData.vaccuum_price || 0
    if (engine) total += selectedModelData.engine_price || 0
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
            className="w-full bg-zinc-100 dark:bg-zinc-800/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 rounded-2xl px-5 py-4 text-2xl font-mono font-black placeholder-zinc-400 dark:placeholder-zinc-600 text-zinc-900 dark:text-white transition-all outline-none"
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
              className="w-full appearance-none bg-zinc-100 dark:bg-zinc-800/50 border-2 border-transparent focus:border-blue-500 rounded-2xl px-5 py-3.5 text-zinc-900 dark:text-white font-bold outline-none transition-all"
            >
              <option value="">{t('intake.brand.placeholder' as any)}</option>
              {availableBrands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        {/* ── Model ─────────────────────────────────────────────────────────── */}
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
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${formData.color === color
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-md'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-transparent hover:border-zinc-300 dark:hover:border-zinc-700'
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
              if (selectedModelData) {
                if (service === 'exterior') displayPrice = selectedModelData.exterior_price
                if (service === 'engine') displayPrice = selectedModelData.engine_price
                if (service === 'interior') displayPrice = formData.services.exterior ? selectedModelData.interior_price : selectedModelData.vaccuum_price
              }
              const Icon = service === 'exterior' ? Car : service === 'interior' ? Sparkles : Zap
              return (
                <button
                  key={service}
                  type="button"
                  onClick={() => handleServiceChange(service)}
                  className={`group flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 text-left ${isSelected
                      ? 'bg-blue-600/10 border-blue-600 dark:bg-blue-500/10 dark:border-blue-500'
                      : 'bg-zinc-100 dark:bg-zinc-800/50 border-transparent hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'}`}>
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
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-zinc-300 dark:border-zinc-700'}`}>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[4]" />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Price & Submit — floating on mobile ───────────────────────────── */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-lg border-t border-zinc-200 dark:border-zinc-800 sm:relative sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:border-none z-50 space-y-3">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 rounded-3xl p-5 sm:p-6 shadow-xl shadow-blue-500/20 transition-all">
            <div className="flex justify-between items-center">
              <span className="text-blue-100 font-bold uppercase tracking-widest text-xs">{t('intake.price' as any)}</span>
              <span className="text-2xl sm:text-3xl font-black text-white">{formatCurrency(estimatedPrice)}</span>
            </div>
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
              className="flex-1 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 active:scale-[0.98] disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed font-black py-4 sm:py-5 px-6 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 text-lg sm:text-xl shadow-xl"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
              <span className="uppercase tracking-widest">{t('intake.addQueue' as any)}</span>
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