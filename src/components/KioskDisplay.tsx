'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Car, Sparkles, Zap, Shield, CheckCircle2, Clock, CreditCard, Banknote, Tag, Package, Loader } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { db } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'

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

// ─── Local popup phase state (runs on kiosk only, not synced) ─────────────────
// 'payment'   → show cash/QR popup with "Transaksi Diproses"
// 'confirmed' → show full-screen "Transaksi Diterima" overlay
// null        → no overlay
type PopupPhase = 'payment' | 'confirmed' | null

const IDLE_TIMEOUT_MS = 45_000   // 45 s of no Firestore updates → go idle
const PROCESSING_MS = 2_500    // "Transaksi Diproses" shown for 2.5 s after payment popup opens
const CONFIRMED_MS = 4_000    // "Transaksi Diterima" shown for 4 s before going idle

const COLOR_MAP: Record<string, string> = {
  Black: '#1a1a1a', White: '#f5f5f5', Silver: '#c0c0c0', Gray: '#808080',
  Blue: '#2563eb', Red: '#dc2626', Gold: '#d97706', Beige: '#d4b896',
  Green: '#16a34a', Orange: '#ea580c', Purple: '#9333ea', Yellow: '#eab308',
  Pink: '#ec4899', Brown: '#92400e', Turquoise: '#0d9488',
}

const fmt = (n: number) =>
  'RM ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

function formatTime(t: any): string {
  const d = t?.toDate ? t.toDate() : (t instanceof Date ? t : new Date(t))
  return d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', hour12: true })
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
    setState(next)
    if (next.stage !== 'idle') {
      idleTimer.current = setTimeout(() => {
        setState(s => ({ ...s, stage: 'idle' }))
      }, IDLE_TIMEOUT_MS)
    }
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'kiosk_state'), (snapshot) => {
      if (snapshot.exists()) resetIdle(snapshot.data() as KioskState)
    })
    return () => {
      unsub()
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [resetIdle])

  return state
}

export function broadcastKioskState(state: KioskState) {
  try { localStorage.setItem('kiosk_state', JSON.stringify(state)) } catch { }
}

// ─── Car SVG ──────────────────────────────────────────────────────────────────
function CarSilhouette({ color = '#2563eb' }: { color?: string }) {
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
}

// ─── Idle Screen ──────────────────────────────────────────────────────────────
function IdleScreen() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const timeStr = time.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', hour12: true })

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-zinc-950">
      <div className="idle-bg absolute inset-0" />
      <div className="absolute inset-0 opacity-5"
        style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />
      <div className="relative z-10 flex flex-col items-center gap-8 text-center px-8">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Bossque Carwash Logo" width={44} height={44} className="rounded-xl object-contain" />
          <h1 className="text-left font-black text-5xl tracking-widest text-white uppercase" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
            CARWASH <span style={{ color: '#818cf8' }}>BOSSQUE</span>
          </h1>
        </div>
        <div className="text-white leading-none" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '160px', letterSpacing: '-4px' }}>
          {timeStr}
        </div>
        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">
          Selamat Datang • Sila Tunggu Sebentar
        </p>
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        .idle-bg { background: #09090b; animation: idlePulse 10s ease-in-out infinite; }
        @keyframes idlePulse { 0%,100%{background-color:#09090b} 50%{background-color:#0f0f1a} }
      `}</style>
    </div>
  )
}

// ─── Payment Popup ─────────────────────────────────────────────────────────────
// Shows inside the overlay. phase = 'payment' means "Transaksi Diproses" banner
// is visible at the top; once phase flips to 'confirmed' this whole popup is gone.
function PaymentPopup({
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

  if (paymentMethod === 'CASH') {
    return (
      <div className="flex flex-col items-center gap-8 border border-white/10 bg-zinc-900"
        style={{ padding: 48, borderRadius: 48, maxWidth: '95%', width: 560, boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}
      >
        {/* Method badge */}
        <div className="flex items-center gap-3 px-7 py-3" style={{ background: 'rgba(16,185,129,0.12)', borderRadius: 100 }}>
          <Banknote className="w-7 h-7 text-emerald-400" />
          <span className="font-black text-emerald-400 uppercase tracking-widest text-xl">{t('payment.cash')}</span>
        </div>

        {/* "Transaksi Diproses" status badge */}
        <div
          className="flex items-center gap-3 px-5 py-2.5 w-full justify-center"
          style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 16 }}
        >
          {isProcessing
            ? <><span className="spin-icon"><Loader className="w-4 h-4 text-amber-400" /></span>
              <span className="text-amber-400 font-black text-sm uppercase tracking-widest">Transaksi Diproses...</span></>
            : <><CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-black text-sm uppercase tracking-widest">Transaksi Diterima</span></>
          }
        </div>

        {/* Amounts */}
        <div className="text-center w-full flex flex-col gap-5">
          <div>
            <span className="block text-zinc-400 text-xs font-black uppercase tracking-widest mb-2">{t('payment.totalAmount')}</span>
            <div className="text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 100, lineHeight: 1 }}>
              {fmt(totalAmount)}
            </div>
          </div>
          {cashReceived > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-7 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 text-xs font-black uppercase tracking-widest">{t('payment.amountReceived')}</span>
                <span className="text-emerald-400 font-black text-2xl">{fmt(cashReceived)}</span>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 text-xs font-black uppercase tracking-widest">{t('payment.balance')}</span>
                <span className="font-black text-2xl" style={{ color: balance >= 0 ? '#60a5fa' : '#fb7185' }}>
                  {balance >= 0 ? fmt(balance) : '...'}
                </span>
              </div>
            </div>
          )}
        </div>
        <p className="text-center text-zinc-500 font-bold text-base">Sila berikan wang tunai kepada juruwang.</p>
      </div>
    )
  }

  // ONLINE / QR
  return (
    <div className="flex flex-col items-center gap-6 border border-white/10 bg-zinc-900"
      style={{ padding: 48, borderRadius: 48, maxWidth: '95%', width: 520, boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}
    >
      {/* Method badge */}
      <div className="flex items-center gap-3 px-7 py-3" style={{ background: 'rgba(79,70,229,0.12)', borderRadius: 100 }}>
        <CreditCard className="w-7 h-7 text-indigo-400" />
        <span className="font-black text-indigo-400 uppercase tracking-widest text-xl">{t('payment.online')}</span>
      </div>

      {/* "Transaksi Diproses" status badge */}
      <div
        className="flex items-center gap-3 px-5 py-2.5 w-full justify-center"
        style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 16 }}
      >
        {isProcessing
          ? <><span className="spin-icon"><Loader className="w-4 h-4 text-amber-400" /></span>
            <span className="text-amber-400 font-black text-sm uppercase tracking-widest">Transaksi Diproses...</span></>
          : <><CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 font-black text-sm uppercase tracking-widest">Transaksi Diterima</span></>
        }
      </div>

      {/* QR code */}
      <div className="bg-white p-4" style={{ width: 280, height: 280, borderRadius: 28 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/qr-payment.png"
          alt="Scan to Pay"
          className="w-full h-full object-contain"
          onError={(e) => { (e.target as HTMLImageElement).src = 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=BossqueCarwash' }}
        />
      </div>
      <p className="text-center text-zinc-400 font-bold text-lg" style={{ maxWidth: 340, lineHeight: 1.4 }}>
        {t('payment.qrInstruction')}
      </p>
      <div className="text-indigo-400 font-black" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 60, letterSpacing: 2 }}>
        {fmt(totalAmount)}
      </div>
    </div>
  )
}

// ─── Confirmed Overlay ─────────────────────────────────────────────────────────
// Full-screen green overlay shown after payment popup, before going idle.
// Shows a countdown so customers know how long it'll stay up.
function ConfirmedOverlay({ totalAmount, onDone }: { totalAmount: number; onDone: () => void }) {
  const [countdown, setCountdown] = useState(Math.round(CONFIRMED_MS / 1000))

  useEffect(() => {
    // Count down every second
    const ticker = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(ticker); return 0 }
        return c - 1
      })
    }, 1000)
    // Trigger onDone after full duration
    const done = setTimeout(onDone, CONFIRMED_MS)
    return () => { clearInterval(ticker); clearTimeout(done) }
  }, [onDone])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10"
      style={{ background: 'rgba(0,0,0,0.95)' }}
    >
      {/* Big check icon */}
      <div
        className="flex items-center justify-center"
        style={{ width: 120, height: 120, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '2px solid rgba(16,185,129,0.3)' }}
      >
        <CheckCircle2 className="text-emerald-400" style={{ width: 64, height: 64 }} />
      </div>

      {/* Status text */}
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="flex items-center gap-3 px-8 py-3"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 100 }}
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-emerald-400 font-black text-lg uppercase tracking-widest">Transaksi Diterima</span>
        </div>

        <div className="text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 80, lineHeight: 1 }}>
          {fmt(totalAmount)}
        </div>

        <p className="text-emerald-300 font-bold text-2xl">Terima kasih! Sila datang lagi 🚗</p>
        <p className="text-zinc-600 font-bold text-sm uppercase tracking-widest">
          Paparan akan dikosongkan dalam {countdown}s
        </p>
      </div>

      {/* Countdown bar */}
      <div className="w-64 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-400 rounded-full countdown-bar"
          style={{ animationDuration: `${CONFIRMED_MS}ms` }}
        />
      </div>
    </div>
  )
}

// ─── Active Checkout Screen ───────────────────────────────────────────────────
function CheckoutScreen({ state }: { state: KioskState }) {
  const { t } = useLanguage()
  const { transactions, selectedAddons, miscCharges, paymentMethod, cashReceived, totalAmount, balance, stage } = state
  const primaryTx = transactions[0]
  const isMulti = transactions.length > 1
  const carColor = COLOR_MAP[primaryTx?.color || ''] || '#2563eb'
  const activeServices = Object.entries(primaryTx?.services || {}).filter(([, v]) => v).map(([k]) => k)

  const SERVICE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    exterior: { label: t('intake.services.exterior'), icon: <Sparkles className="w-4 h-4" />, color: '#3b82f6' },
    interior: { label: t('intake.services.interior'), icon: <Shield className="w-4 h-4" />, color: '#8b5cf6' },
    engine: { label: t('intake.services.engine'), icon: <Zap className="w-4 h-4" />, color: '#f59e0b' },
  }

  // ── Total change flash ──
  const [prevTotal, setPrevTotal] = useState(totalAmount)
  const [totalChanged, setTotalChanged] = useState(false)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;

    if (totalAmount !== prevTotal) {
      setTotalChanged(true)
      setPrevTotal(totalAmount)
      t = setTimeout(() => setTotalChanged(false), 600)
    }

    // This is now executed unconditionally on every path
    return () => {
      if (t) clearTimeout(t)
    }
  }, [totalAmount, prevTotal])

  // ── Popup phase state ──────────────────────────────────────────────────────
  // Tracks the local popup flow independent of Firestore stage.
  // When stage goes to 'payment': show popup with "Diproses" for PROCESSING_MS,
  // then flip to "Diterima" label. When stage goes to 'confirmed': jump straight
  // to the ConfirmedOverlay then idle.
  const [popupPhase, setPopupPhase] = useState<PopupPhase>(null)
  const popupTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearPopupTimers = () => {
    popupTimers.current.forEach(clearTimeout)
    popupTimers.current = []
  }

  useEffect(() => {
    if (stage === 'payment' && paymentMethod) {
      // Show payment popup immediately with "Diproses"
      setPopupPhase('payment')
      clearPopupTimers()
      // After PROCESSING_MS, switch label to "Diterima" (still showing popup)
      const t1 = setTimeout(() => {
        setPopupPhase('confirmed')
        // Popup stays a little longer before ConfirmedOverlay takes over
        // (ConfirmedOverlay is triggered when Firestore stage = 'confirmed')
      }, PROCESSING_MS)
      popupTimers.current.push(t1)
    } else if (stage === 'confirmed') {
      // CashierCheckout set stage to confirmed — jump straight to full overlay
      clearPopupTimers()
      setPopupPhase('confirmed')
    } else if (stage === 'idle') {
      clearPopupTimers()
      setPopupPhase(null)
    } else {
      // selecting / addons
      clearPopupTimers()
      setPopupPhase(null)
    }
    return clearPopupTimers
  }, [stage, paymentMethod])

  // When ConfirmedOverlay's countdown ends, go to idle locally
  const handleConfirmedDone = useCallback(() => {
    setPopupPhase(null)
    // The Firestore idle timeout will also fire, but this cleans up the UI faster
  }, [])

  // Show ConfirmedOverlay when:
  // - Firestore stage is 'confirmed', OR
  // - popup went through 'payment' → 'confirmed' locally and cashier already confirmed
  const showConfirmedOverlay = stage === 'confirmed' && popupPhase === 'confirmed'
  const showPaymentPopup = paymentMethod !== null && popupPhase === 'payment' && stage === 'payment'
  // Show popup with "Diterima" label while waiting for Firestore 'confirmed'
  const showPaymentPopupConfirming = paymentMethod !== null && popupPhase === 'confirmed' && stage === 'payment'

  return (
    <div className="w-full h-full flex flex-row bg-black overflow-hidden" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── LEFT PANEL ─────────────────────────────────────────────── */}
      <div className="w-2/5 h-full flex flex-col border-r border-white/10 bg-black overflow-hidden p-7">
        {primaryTx?.imageUrl ? (
          <div className="w-full h-full overflow-hidden border-8 border-white"
            style={{ borderRadius: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={primaryTx.imageUrl} alt="Vehicle" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <CarSilhouette color={carColor} />
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────── */}
      <div className="w-3/5 h-full flex flex-col bg-zinc-950 overflow-hidden">

        {/* Header */}
        <div className="px-8 py-5 flex items-center gap-5 border-b border-white/5 bg-black">
          <div className="w-12 h-12 flex items-center justify-center flex-shrink-0"
            style={{ borderRadius: 14, background: 'linear-gradient(135deg,#2563eb,#7c3aed)' }}
          >
            <Car className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white leading-none mb-1 truncate"
              style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 46, letterSpacing: 3 }}
            >
              {isMulti ? transactions.map(tx => tx.plateNumber).join(' · ') : primaryTx?.plateNumber}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">
                {!isMulti ? `${primaryTx?.brand} ${primaryTx?.model}` : `${transactions.length} ${t('payment.batch')}`}
              </span>
              <span className="w-1 h-1 rounded-full bg-zinc-600 inline-block" />
              <span className="flex items-center gap-1 text-emerald-400 text-xs font-black uppercase tracking-wider">
                <span className="live-dot w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                Live
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
          {!isMulti && primaryTx && (
            <div className="grid grid-cols-4 gap-2 mb-2">
              <InfoTile label={t('priceBook.brand')} value={primaryTx.brand || '—'} />
              <InfoTile label={t('priceBook.model')} value={primaryTx.model || '—'} />
              <InfoTile label={t('intake.color')} value={t(`color.${primaryTx.color}` as any) || '—'} accent={carColor} />
              <InfoTile label={t('staff.checkIn')} value={formatTime(primaryTx.checkInTime)} />
            </div>
          )}

          {activeServices.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {activeServices.map(svc => {
                const s = SERVICE_LABELS[svc]
                return (
                  <div key={svc} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border"
                    style={{ color: s.color, borderColor: s.color + '44', background: s.color + '11' }}
                  >
                    <span className="flex">{s.icon}</span>{s.label}
                  </div>
                )
              })}
            </div>
          )}

          <SectionHeader icon={<Car className="w-4 h-4" />} label={t('intake.services')} />
          {transactions.map(tx => (
            <LineItem
              key={tx.id}
              label={`${tx.brand} ${tx.model} – ${activeServices.map(s => SERVICE_LABELS[s]?.label).join(', ') || t('intake.services')}`}
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

          <div className="h-px bg-white/5 my-2" />

          {/* Grand Total */}
          <div
            className="flex items-center justify-between p-6 rounded-3xl border border-white/10 bg-zinc-900 shadow-xl"
            style={{ transition: 'transform 0.3s, opacity 0.3s', transform: totalChanged ? 'scale(1.03)' : 'scale(1)', opacity: totalChanged ? 0.8 : 1 }}
          >
            <div>
              <span className="block text-zinc-500 text-xs font-black uppercase tracking-widest mb-1">{t('payment.totalAmount')}</span>
              <p className="text-zinc-400 text-sm font-bold">
                {t('payment.totalCars')} {transactions.length}
                {selectedAddons.length > 0 ? ` + ${selectedAddons.length} item` : ''}
              </p>
            </div>
            <div className="text-white" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 68 }}>
              {fmt(totalAmount)}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-white/5 bg-black flex items-center gap-2">
          <Clock className="w-3 h-3 text-zinc-600" />
          <span className="text-zinc-600 text-xs font-black uppercase tracking-widest">
            {new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </span>
        </div>
      </div>

      {/* ── PAYMENT POPUP (Diproses / Diterima label) ───────────────── */}
      {(showPaymentPopup || showPaymentPopupConfirming) && paymentMethod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.92)' }}>
          <PaymentPopup
            paymentMethod={paymentMethod}
            totalAmount={totalAmount}
            cashReceived={cashReceived}
            balance={balance}
            phase={popupPhase}
          />
        </div>
      )}

      {/* ── CONFIRMED OVERLAY (full-screen, with countdown) ─────────── */}
      {showConfirmedOverlay && (
        <ConfirmedOverlay totalAmount={totalAmount} onDone={handleConfirmedDone} />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;700;800;900&display=swap');

        .live-dot { animation: livePulse 2s ease-in-out infinite; }
        @keyframes livePulse { 0%,100%{opacity:0.5} 50%{opacity:1} }

        /* Spinning loader icon — CSS only */
        .spin-icon { display:inline-flex; animation: spin 1s linear infinite; }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

        /* Countdown progress bar — shrinks from 100% to 0% */
        .countdown-bar { animation: shrink linear forwards; }
        @keyframes shrink { from{width:100%} to{width:0%} }

        ::-webkit-scrollbar       { width: 4px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
      `}</style>
    </div>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────
function InfoTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-zinc-900 rounded-2xl p-3 border border-white/5">
      <span className="block text-zinc-500 text-xs font-black uppercase tracking-widest mb-1">{label}</span>
      <div className="text-white font-extrabold text-base flex items-center gap-1.5 truncate">
        {accent && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/10" style={{ background: accent }} />}
        {value}
      </div>
    </div>
  )
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mt-4 mb-1">
      <span className="text-zinc-500">{icon}</span>
      <span className="text-zinc-500 text-xs font-black uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  )
}

function LineItem({ label, sublabel, amount, accent, delay }: {
  label: string; sublabel?: string; amount: number; accent?: boolean; delay?: number
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 rounded-2xl bg-zinc-900/60 border border-white/5"
      style={{ transition: 'opacity 0.3s', transitionDelay: `${(delay || 0) * 80}ms` }}
    >
      <div className="min-w-0 mr-4">
        <span className="text-zinc-200 font-bold text-sm block truncate">{label}</span>
        {sublabel && <span className="text-zinc-500 text-xs font-bold mt-0.5 uppercase tracking-wider block">{sublabel}</span>}
      </div>
      <div className="font-black text-lg flex-shrink-0 tabular-nums" style={{ color: accent ? '#818cf8' : '#d4d4d8' }}>
        {fmt(amount)}
      </div>
    </div>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function KioskDisplay() {
  const state = useKioskState()
  return (
    <div className="w-screen h-screen overflow-hidden bg-zinc-950">
      {state.stage === 'idle' || state.transactions.length === 0
        ? <IdleScreen />
        : <CheckoutScreen state={state} />
      }
    </div>
  )
}