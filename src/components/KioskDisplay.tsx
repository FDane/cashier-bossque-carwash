'use client'

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo
} from 'react'
import {
  Car, Sparkles, Zap, Shield, CheckCircle2, Clock,
  CreditCard, Banknote, Tag, Package, Loader,
} from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { db } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import { Bebas_Neue, DM_Sans } from 'next/font/google'

// Configure the fonts
const bebasNeue = Bebas_Neue({ 
  weight: '400', 
  subsets: ['latin'], 
  variable: '--font-bebas' 
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans'
})

// ─── Types ────────────────────────────────────────────────────────────────────
interface Transaction {
  id: string
  plateNumber: string
  brand: string
  model: string
  color?: string
  computedPrice: number
  services: { exterior?: boolean; interior?: boolean; engine?: boolean }
  imageUrl?: string | null
  checkInTime: string | Date
}

interface SelectedAddon {
  id: string
  name: string
  price: number
  quantity: number
}

interface MiscCharge {
  name: string
  price: number
}

interface KioskState {
  transactions: Transaction[]
  paymentMethod: 'CASH' | 'ONLINE' | null
  cashReceived: number
  selectedAddons: SelectedAddon[]
  miscCharges: MiscCharge[]
  totalAmount: number
  balance: number
  stage: 'idle' | 'selecting' | 'addons' | 'payment' | 'confirmed'
}

type PopupPhase = 'payment' | 'confirmed' | null

// ─── Constants ────────────────────────────────────────────────────────────────
const IDLE_TIMEOUT_MS = 45_000
const PROCESSING_MS = 2_500
const CONFIRMED_MS = 4_000

const COLOR_MAP: Record<string, string> = {
  Black: '#1a1a1a', White: '#f5f5f5', Silver: '#c0c0c0', Gray: '#808080',
  Blue: '#2563eb', Red: '#dc2626', Gold: '#d97706', Beige: '#d4b896',
  Green: '#16a34a', Orange: '#ea580c', Purple: '#9333ea', Yellow: '#eab308',
  Pink: '#ec4899', Brown: '#92400e', Turquoise: '#0d9488',
}

const SERVICE_CONFIG = {
  exterior: { color: '#3b82f6', icon: <Sparkles className="w-4 h-4" /> },
  interior: { color: '#8b5cf6', icon: <Shield className="w-4 h-4" /> },
  engine: { color: '#f59e0b', icon: <Zap className="w-4 h-4" /> },
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  'RM ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

function formatTime(t: any): string {
  const d = t?.toDate ? t.toDate() : (t instanceof Date ? t : new Date(t))
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function kioskStateChanged(prev: KioskState, next: KioskState): boolean {
  if (prev.stage !== next.stage) return true
  if (prev.totalAmount !== next.totalAmount) return true
  if (prev.paymentMethod !== next.paymentMethod) return true
  if (prev.cashReceived !== next.cashReceived) return true
  if (prev.balance !== next.balance) return true
  if (prev.transactions.length !== next.transactions.length) return true
  if (prev.selectedAddons.length !== next.selectedAddons.length) return true
  if (prev.miscCharges.length !== next.miscCharges.length) return true
  for (let i = 0; i < next.transactions.length; i++) {
    const a = prev.transactions[i], b = next.transactions[i]
    if (!a || a.id !== b.id || a.computedPrice !== b.computedPrice) return true
  }
  return false
}

// ─── Kiosk State Hook ─────────────────────────────────────────────────────────
function useKioskState() {
  const [state, setState] = useState<KioskState>({
    transactions: [], paymentMethod: null, cashReceived: 0,
    selectedAddons: [], miscCharges: [], totalAmount: 0, balance: 0,
    stage: 'idle',
  })
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetIdle = useCallback((next: KioskState) => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    setState(prev => {
      if (!kioskStateChanged(prev, next)) return prev
      return next
    })
    if (next.stage !== 'idle') {
      idleTimer.current = setTimeout(() => {
        setState(s => ({ ...s, stage: 'idle' }))
      }, IDLE_TIMEOUT_MS)
    }
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'kiosk_state'), snapshot => {
      if (snapshot.exists()) resetIdle(snapshot.data() as KioskState)
    })
    return () => {
      unsub()
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [resetIdle])

  return state
}

// ─── Car SVG ──────────────────────────────────────────────────────────────────
const CarSilhouette = memo(function CarSilhouette({ color = '#2563eb' }: { color?: string }) {
  return (
    <svg viewBox="0 0 320 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <ellipse cx="160" cy="128" rx="130" ry="10" fill="rgba(0,0,0,0.25)" />
      <path d="M28 100 Q28 115 48 118 L272 118 Q292 115 292 100 L292 82 L28 82 Z" fill={color} />
      <path d="M90 82 Q100 50 120 42 L200 42 Q220 50 230 82 Z" fill={color} />
      <path d="M104 80 Q110 57 125 50 L160 50 L160 80 Z" fill="#bae6fd" opacity="0.85" />
      <path d="M165 50 L200 50 Q215 57 218 80 L165 80 Z" fill="#bae6fd" opacity="0.85" />
      <line x1="162" y1="50" x2="162" y2="80" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
      <rect x="28" y="90" width="40" height="10" rx="4" fill={color} opacity="0.7" />
      <rect x="252" y="90" width="40" height="10" rx="4" fill={color} opacity="0.7" />
      <rect x="30" y="84" width="28" height="8" rx="4" fill="#fef9c3" opacity="0.95" />
      <rect x="262" y="84" width="28" height="8" rx="4" fill="#fca5a5" opacity="0.8" />
      <circle cx="82" cy="116" r="20" fill="#111" />
      <circle cx="82" cy="116" r="12" fill="#374151" />
      <circle cx="82" cy="116" r="5" fill="#9ca3af" />
      <circle cx="238" cy="116" r="20" fill="#111" />
      <circle cx="238" cy="116" r="12" fill="#374151" />
      <circle cx="238" cy="116" r="5" fill="#9ca3af" />
      <line x1="162" y1="82" x2="162" y2="118" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      <path d="M95 65 Q140 55 210 65" stroke="rgba(255,255,255,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
})

const FooterClock = memo(function FooterClock() {
  const [timeStr, setTimeStr] = useState('')

  useEffect(() => {
    const tick = () => setTimeStr(
      new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    )
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="px-8 py-4 border-t border-zinc-100 bg-zinc-50 flex items-center gap-2">
      <Clock className="w-3 h-3 text-zinc-400" />
      <span className="text-zinc-400 text-xs font-black uppercase tracking-widest">
        {timeStr || '--:--'}
      </span>
    </div>
  )
})

function IdleScreen() {
  const [mounted, setMounted] = useState(false)
  const [time, setTime] = useState<Date | null>(null)

  useEffect(() => {
    setMounted(true)
    const update = () => setTime(new Date())
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  const timeStr = (mounted && time)
    ? time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
    : ''
  const dateStr = (mounted && time)
    ? time.toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-zinc-50">
      <div className="idle-bg absolute inset-0" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(#000000 1.5px, transparent 1.5px)', backgroundSize: '40px 40px' }}
      />
      <div className="relative z-10 flex flex-col items-center gap-8 text-center px-8">
        <div className="flex flex-col items-center gap-6">
          <img
            src="/logo.png"
            alt="Bossque Carwash Logo"
            width={120}
            height={120}
            className="rounded-2xl object-contain shadow-2xl"
            loading="eager"
            fetchPriority="high"
          />
          <h1
            className="text-center font-black text-6xl tracking-widest text-zinc-900 uppercase"
            style={{ fontFamily: "var(--font-bebas, 'Bebas Neue', sans-serif)" }}
          >
            CARWASH <span className="text-blue-600">BOSSQUE</span>
          </h1>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div
            className="text-zinc-900 leading-none"
            style={{
              fontFamily: "var(--font-bebas, 'Bebas Neue', sans-serif)",
              fontSize: '140px',
              letterSpacing: '-4px',
            }}
            suppressHydrationWarning
          >
            {timeStr}
          </div>
          <p
            className="text-indigo-600 font-bold text-3xl uppercase tracking-widest"
            style={{ fontFamily: "var(--font-bebas, 'Bebas Neue', sans-serif)" }}
            suppressHydrationWarning
          >
            {dateStr}
          </p>
        </div>
        <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest">
          Selamat Datang • Sila Tunggu Sebentar
        </p>
      </div>
      <style>{`
        .idle-bg {
          background: #f9fafb;
          animation: idlePulse 10s ease-in-out infinite;
        }
        @keyframes idlePulse {
          0%, 100% { background-color: #f9fafb; }
          50%       { background-color: #f3f4f6; }
        }
      `}</style>
    </div>
  )
}

// ─── Payment Popup ─────────────────────────────────────────────────────────────
const PaymentPopup = memo(function PaymentPopup({
  paymentMethod, totalAmount, cashReceived, balance, phase,
}: {
  paymentMethod: 'CASH' | 'ONLINE'
  totalAmount: number
  cashReceived: number
  balance: number
  phase: PopupPhase
}) {
  const { t } = useLanguage()
  const isProcessing = phase === 'payment'

  const statusBadge = (
    <div
      className="flex items-center gap-3 px-5 py-2.5 w-full justify-center rounded-2xl"
      style={{
        background: 'rgba(251,191,36,0.10)',
        border: '1px solid rgba(251,191,36,0.25)',
      }}
    >
      {isProcessing
        ? <>
          <span className="spin-icon"><Loader className="w-4 h-4 text-amber-400" /></span>
          <span className="text-amber-500 font-black text-sm uppercase tracking-widest">Transaksi Diproses...</span>
        </>
        : <>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="text-emerald-600 font-black text-sm uppercase tracking-widest">Transaksi Diterima</span>
        </>
      }
    </div>
  )

  if (paymentMethod === 'CASH') {
    return (
      <div className="flex flex-col items-center gap-6 p-10 w-full max-w-md">
        <div
          className="flex items-center gap-3 px-7 py-3 rounded-full"
          style={{ background: 'rgba(16,185,129,0.1)' }}
        >
          <Banknote className="w-7 h-7 text-emerald-500" />
          <span className="font-black text-emerald-700 uppercase tracking-widest text-xl">{t('payment.cash')}</span>
        </div>

        {statusBadge}

        <div className="text-center w-full flex flex-col gap-6 mt-4">
          <div>
            <span className="block text-zinc-400 text-sm font-black uppercase tracking-widest mb-1">
              {t('payment.totalAmount')}
            </span>
            <div
              className="text-zinc-900"
              style={{ fontFamily: "var(--font-bebas, 'Bebas Neue', sans-serif)", fontSize: 80, lineHeight: 1 }}
            >
              {fmt(totalAmount)}
            </div>
          </div>
          {cashReceived > 0 && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-3xl p-6 flex flex-col gap-4 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 text-xs font-black uppercase tracking-widest">
                  {t('payment.amountReceived')}
                </span>
                <span className="text-emerald-600 font-black text-2xl">{fmt(cashReceived)}</span>
              </div>
              <div className="h-px bg-zinc-200" />
              <div className="flex justify-between items-center">
                <span className="text-zinc-500 text-xs font-black uppercase tracking-widest">
                  {t('payment.balance')}
                </span>
                <span
                  className="font-black text-3xl"
                  style={{ color: balance >= 0 ? '#3b82f6' : '#ef4444' }}
                >
                  {balance >= 0 ? fmt(balance) : '...'}
                </span>
              </div>
            </div>
          )}
        </div>
        <p className="text-center text-zinc-500 font-bold mt-4">Sila berikan wang tunai kepada juruwang.</p>
      </div>
    )
  }

  // ONLINE / QR
  return (
    <div className="flex flex-col items-center gap-6 p-8 w-full max-w-md">
      <div
        className="flex items-center gap-3 px-7 py-3 rounded-full"
        style={{ background: 'rgba(79,70,229,0.1)' }}
      >
        <CreditCard className="w-7 h-7 text-indigo-500" />
        <span className="font-black text-indigo-700 uppercase tracking-widest text-xl">{t('payment.online')}</span>
      </div>

      {statusBadge}

      <div className="bg-white p-4 border border-zinc-200 shadow-sm rounded-3xl" style={{ width: 260, height: 260 }}>
        <img
          src="/qr-payment.png"
          alt="Scan to Pay"
          className="w-full h-full object-contain"
          loading="eager"
          onError={e => {
            ; (e.target as HTMLImageElement).src =
              'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=BossqueCarwash'
          }}
        />
      </div>

      <div className="text-center mt-2">
        <p className="text-zinc-500 font-bold mb-2">{t('payment.qrInstruction')}</p>
        <div
          className="text-indigo-600 font-black"
          style={{ fontFamily: "var(--font-bebas, 'Bebas Neue', sans-serif)", fontSize: 60 }}
        >
          {fmt(totalAmount)}
        </div>
      </div>
    </div>
  )
})

const CarCollage = memo(function CarCollage({
  transactions,
  fallbackColor,
}: {
  transactions: Transaction[]
  fallbackColor: string
}) {
  const images = transactions.map(tx => ({
    url: tx.imageUrl ?? null,
    plate: tx.plateNumber,
  }))

  const hasAnyImage = images.some(img => img.url)

  if (!hasAnyImage) {
    return (
      <div className="flex-1 h-full flex items-center justify-center p-8 bg-[#18181b] rounded-3xl shadow-inner">
        <CarSilhouette color={fallbackColor} />
      </div>
    )
  }

  const count = images.length

  const getGridLayout = () => {
    if (count === 1) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }
    if (count === 2) return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr' }
    if (count === 3) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1.2fr 1fr' }
    return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }
  }

  const cells = images.slice(0, 4)

  return (
    <div
      className="w-full h-full overflow-hidden"
      style={{
        display: 'grid',
        gap: '4px',
        borderRadius: 24,
        background: '#000',
        border: '4px solid #18181b',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        ...getGridLayout()
      }}
    >
      {cells.map((img, i) => {
        const isFeaturedRow3Car = count === 3 && i === 0
        return (
          <CollageCell
            key={img.plate}
            url={img.url}
            plate={img.plate}
            style={{ gridColumn: isFeaturedRow3Car ? 'span 2' : undefined }}
          />
        )
      })}
    </div>
  )
})

const CollageCell = memo(function CollageCell({
  url, plate, style,
}: {
  url: string | null; plate: string; style?: React.CSSProperties
}) {
  const [imgLoaded, setImgLoaded] = useState(false)

  return (
    <div
      style={{
        overflow: 'hidden',
        position: 'relative',
        background: '#18181b', // Premium dark background for "contain" images
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {url ? (
        <>
          {/* Loading Shimmer (Skeleton) */}
          {!imgLoaded && (
            <div className="absolute inset-0 bg-zinc-800 animate-pulse flex items-center justify-center">
               <Loader className="w-8 h-8 text-zinc-600 animate-spin" />
            </div>
          )}
          <img
            src={url}
            alt={plate}
            onLoad={() => setImgLoaded(true)}
            // Changed to contain: prevents portrait/landscape cropping
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain', 
              opacity: imgLoaded ? 1 : 0, 
              transition: 'opacity 0.4s ease' 
            }}
          />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
          <Car className="w-8 h-8 text-zinc-600" />
        </div>
      )}

      {/* Solid label (no blur) for performance */}
      {url && (
        <div className="absolute bottom-4 left-4 bg-zinc-900/90 px-3 py-1.5 rounded-lg border border-white/10 shadow-lg">
          <span className="text-white text-xs font-black tracking-widest uppercase">
            {plate}
          </span>
        </div>
      )}
    </div>
  )
})

// ─── Confirmed Overlay ─────────────────────────────────────────────────────────
const ConfirmedOverlay = memo(function ConfirmedOverlay({
  totalAmount, onDone,
}: {
  totalAmount: number; onDone: () => void
}) {
  const [, setCountdown] = useState(Math.round(CONFIRMED_MS / 1000))

  useEffect(() => {
    const ticker = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(ticker); return 0 }
        return c - 1
      })
    }, 1000)
    const done = setTimeout(onDone, CONFIRMED_MS)
    return () => { clearInterval(ticker); clearTimeout(done) }
  }, [onDone])

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-8">
      <div
        className="flex items-center justify-center rounded-full"
        style={{
          width: 100, height: 100,
          background: 'rgba(16,185,129,0.1)',
        }}
      >
        <CheckCircle2 className="text-emerald-500" style={{ width: 50, height: 50 }} />
      </div>

      <div className="flex flex-col items-center gap-4 text-center">
        <h2 className="text-emerald-600 font-black text-2xl uppercase tracking-widest">Transaksi Selesai</h2>
        <div
          className="text-zinc-900"
          style={{ fontFamily: "var(--font-bebas, 'Bebas Neue', sans-serif)", fontSize: 80, lineHeight: 1 }}
        >
          {fmt(totalAmount)}
        </div>
        <p className="text-zinc-500 font-bold mt-2 text-lg">Terima kasih! Sila datang lagi 🚗</p>
      </div>

      <div className="w-64 h-1.5 bg-zinc-100 rounded-full overflow-hidden mt-6">
        <div
          className="h-full bg-emerald-400 rounded-full countdown-bar"
          style={{ animationDuration: `${CONFIRMED_MS}ms` }}
        />
      </div>
    </div>
  )
})

// ─── Helper sub-components ───────────────────────────────────────
const InfoTile = memo(function InfoTile({
  label, value, accent,
}: {
  label: string; value: string; accent?: string
}) {
  return (
    <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
      <span className="block text-zinc-400 text-xs font-black uppercase tracking-widest mb-1.5">{label}</span>
      <div className="text-zinc-800 font-bold text-base flex items-center gap-2 truncate">
        {accent && (
          <div
            className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm"
            style={{ background: accent }}
          />
        )}
        {value}
      </div>
    </div>
  )
})

const SectionHeader = memo(function SectionHeader({
  icon, label,
}: {
  icon: React.ReactNode; label: string
}) {
  return (
    <div className="flex items-center gap-3 mt-6 mb-2">
      <span className="text-zinc-400">{icon}</span>
      <span className="text-zinc-400 text-xs font-black uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-zinc-100" />
    </div>
  )
})

const LineItem = memo(function LineItem({
  label, sublabel, amount, accent
}: {
  label: string; sublabel?: string; amount: number; accent?: boolean; delay?: number
}) {
  return (
    <div
      className="flex items-center justify-between px-5 py-4 rounded-2xl bg-white border border-zinc-100 shadow-sm"
    >
      <div className="min-w-0 mr-4">
        <span className="text-zinc-800 font-bold text-sm block truncate">{label}</span>
        {sublabel && (
          <span className="text-zinc-400 text-xs font-bold mt-1 uppercase tracking-wider block">
            {sublabel}
          </span>
        )}
      </div>
      <div
        className="font-black text-lg flex-shrink-0 tabular-nums"
        style={{ color: accent ? '#3b82f6' : '#27272a' }}
      >
        {fmt(amount)}
      </div>
    </div>
  )
})

// ─── Active Checkout Screen ───────────────────────────────────────────────────
function CheckoutScreen({ state }: { state: KioskState }) {
  const { t } = useLanguage()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const {
    transactions, selectedAddons, miscCharges,
    paymentMethod, cashReceived, totalAmount, balance, stage,
  } = state

  const primaryTx = transactions[0]
  const isMulti = transactions.length > 1
  const carColor = COLOR_MAP[primaryTx?.color || ''] || '#2563eb'

  const activeServices = useMemo(
    () => Object.entries(primaryTx?.services || {}).filter(([, v]) => v).map(([k]) => k),
    [primaryTx?.services]
  )

  const SERVICE_LABELS = useMemo(() => ({
    exterior: { ...SERVICE_CONFIG.exterior, label: t('intake.services.exterior') },
    interior: { ...SERVICE_CONFIG.interior, label: t('intake.services.interior') },
    engine: { ...SERVICE_CONFIG.engine, label: t('intake.services.engine') },
  }), [t])

  const [prevTotal, setPrevTotal] = useState(totalAmount)
  const [totalChanged, setTotalChanged] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if (totalAmount !== prevTotal) {
      setTotalChanged(true)
      setPrevTotal(totalAmount)
      timer = setTimeout(() => setTotalChanged(false), 400)
    }
    return () => { if (timer) clearTimeout(timer) }
  }, [totalAmount, prevTotal])

  const [popupPhase, setPopupPhase] = useState<PopupPhase>(null)
  const popupTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearPopupTimers = useCallback(() => {
    popupTimers.current.forEach(clearTimeout)
    popupTimers.current = []
  }, [])

  useEffect(() => {
    if (stage === 'payment' && paymentMethod) {
      setPopupPhase('payment')
      clearPopupTimers()
      const t1 = setTimeout(() => setPopupPhase('confirmed'), PROCESSING_MS)
      popupTimers.current.push(t1)
    } else if (stage === 'confirmed') {
      clearPopupTimers()
      setPopupPhase('confirmed')
    } else {
      clearPopupTimers()
      setPopupPhase(null)
    }
    return clearPopupTimers
  }, [stage, paymentMethod, clearPopupTimers])

  const handleConfirmedDone = useCallback(() => {
    setPopupPhase(null)
  }, [])

  const showConfirmedOverlay = stage === 'confirmed' && popupPhase === 'confirmed'
  const showPaymentPopup = paymentMethod !== null && popupPhase === 'payment' && stage === 'payment'
  const showPaymentPopupConfirming = paymentMethod !== null && popupPhase === 'confirmed' && stage === 'payment'

  return (
    <div
      className="w-full h-full flex flex-row bg-zinc-50 overflow-hidden"
      style={{ fontFamily: "var(--font-dm-sans, 'DM Sans', system-ui, sans-serif)" }}
    >
      {/* ── LEFT PANEL (Always visible!) ───────────────────────────────── */}
      <div className="w-[45%] max-w-[600px] h-full flex flex-col p-6 bg-zinc-100 border-r border-zinc-200">
        <CarCollage transactions={transactions} fallbackColor={carColor} />
      </div>

      {/* ── RIGHT PANEL (Contains the receipt and overlays) ────────────── */}
      <div className="flex-1 h-full flex flex-col relative bg-white overflow-hidden shadow-[-10px_0_30px_rgba(0,0,0,0.03)] z-10">
        
        {/* Header */}
        <div className="px-8 py-6 flex items-center gap-5 border-b border-zinc-100 bg-white z-20">
          <div
            className="w-14 h-14 flex items-center justify-center flex-shrink-0 rounded-2xl shadow-sm"
            style={{ background: 'linear-gradient(135deg, #18181b, #3f3f46)' }}
          >
            <Car className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-zinc-900 leading-none mb-2 truncate"
              style={{ fontFamily: "var(--font-bebas, 'Bebas Neue', sans-serif)", fontSize: 46, letterSpacing: 2 }}
            >
              {isMulti
                ? transactions.map(tx => tx.plateNumber).join(' · ')
                : primaryTx?.plateNumber}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-zinc-500 text-xs font-bold uppercase tracking-wider">
                {!isMulti
                  ? `${primaryTx?.brand} ${primaryTx?.model}`
                  : `${transactions.length} ${t('payment.batch')}`}
              </span>
              <span className="w-1 h-1 rounded-full bg-zinc-300 inline-block" />
              <span className="flex items-center gap-1.5 text-emerald-500 text-xs font-black uppercase tracking-wider">
                <span className="live-dot w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Live
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Receipt Area */}
        <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-2 relative">
          {!isMulti && primaryTx && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <InfoTile label={t('priceBook.brand')} value={primaryTx.brand || '—'} />
              <InfoTile label={t('priceBook.model')} value={primaryTx.model || '—'} />
              <InfoTile label={t('intake.color')} value={t(`color.${primaryTx.color}` as any) || '—'} accent={carColor} />
              <InfoTile label={t('staff.checkIn')} value={formatTime(primaryTx.checkInTime)} />
            </div>
          )}

          {activeServices.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {activeServices.map(svc => {
                const s = SERVICE_LABELS[svc as keyof typeof SERVICE_LABELS]
                if (!s) return null
                return (
                  <div
                    key={svc}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black border bg-white shadow-sm"
                    style={{ color: s.color, borderColor: s.color + '33' }}
                  >
                    {s.icon}{s.label}
                  </div>
                )
              })}
            </div>
          )}

          <SectionHeader icon={<Car className="w-4 h-4" />} label={t('intake.services')} />
          {transactions.map(tx => (
            <LineItem
              key={tx.id}
              label={`${tx.brand} ${tx.model} – ${activeServices.map(s => SERVICE_LABELS[s as keyof typeof SERVICE_LABELS]?.label).join(', ') || t('intake.services')}`}
              sublabel={isMulti ? tx.plateNumber : undefined}
              amount={tx.computedPrice}
            />
          ))}

          {selectedAddons.length > 0 && (
            <>
              <SectionHeader icon={<Package className="w-4 h-4" />} label={t('cashier.retailAddons')} />
              {selectedAddons.map((a, i) => (
                <LineItem key={a.id} label={a.name} sublabel={a.quantity > 1 ? `x${a.quantity}` : undefined} amount={a.price * a.quantity} accent delay={i} />
              ))}
            </>
          )}

          {miscCharges.length > 0 && (
            <>
              <SectionHeader icon={<Tag className="w-4 h-4" />} label={t('cashier.miscCharges')} />
              {miscCharges.map((m, i) => (
                <LineItem key={i} label={m.name} amount={m.price} delay={i} />
              ))}
            </>
          )}
          <div className="h-6 flex-shrink-0" />
        </div>

        {/* Grand Total Footer */}
        <div
          className="px-8 py-6 border-t border-zinc-100 bg-white z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]"
          style={{
            transition: 'transform 0.2s ease',
            transform: totalChanged ? 'scale(1.01)' : 'scale(1)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-zinc-400 text-xs font-black uppercase tracking-widest mb-1.5">
                {t('payment.totalAmount')}
              </span>
              <p className="text-zinc-600 text-sm font-bold">
                {transactions.length} Kenderaan
                {selectedAddons.length > 0 ? ` + ${selectedAddons.length} Item` : ''}
              </p>
            </div>
            <div
              className="text-zinc-900"
              style={{ fontFamily: "var(--font-bebas, 'Bebas Neue', sans-serif)", fontSize: 64 }}
            >
              {fmt(totalAmount)}
            </div>
          </div>
        </div>

        {mounted && <FooterClock />}

        {/* ── PAYMENT POPUP & CONFIRMED OVERLAY (Scoped to Right Panel!) ─── */}
        {((showPaymentPopup || showPaymentPopupConfirming) && paymentMethod) && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm">
            <PaymentPopup
              paymentMethod={paymentMethod} totalAmount={totalAmount}
              cashReceived={cashReceived} balance={balance} phase={popupPhase}
            />
          </div>
        )}

        {showConfirmedOverlay && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/95 backdrop-blur-sm">
             <ConfirmedOverlay totalAmount={totalAmount} onDone={handleConfirmedDone} />
          </div>
        )}
      </div>

      <style>{`
        .live-dot   { animation: livePulse 2s ease-in-out infinite; }
        @keyframes livePulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
        .spin-icon  { display:inline-flex; animation: spin 1s linear infinite; }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .countdown-bar { animation: shrink linear forwards; }
        @keyframes shrink { from{width:100%} to{width:0%} }
        ::-webkit-scrollbar       { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(0,0,0,0.02); }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }
      `}</style>
    </div>
  )
}

export default function KioskDisplay() {
  const state = useKioskState()
  return (
    <div className={`${bebasNeue.variable} ${dmSans.variable} w-screen h-screen overflow-hidden bg-zinc-50`}>
      {state.stage === 'idle' || state.transactions.length === 0
        ? <IdleScreen />
        : <CheckoutScreen state={state} />}
    </div>
  )
}