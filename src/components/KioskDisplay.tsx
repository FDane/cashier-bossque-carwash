'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Car, Sparkles, Zap, Shield, CheckCircle2, Clock, CreditCard, Banknote, Tag, Package, Loader2 } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import Image from 'next/image'
import { db } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'

// ─── Types (mirror from your actual types) ────────────────────────────────────
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

// ─── Kiosk State (broadcast from CashierCheckout via localStorage / BroadcastChannel) ────
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

const IDLE_TIMEOUT_MS = 45_000 // 45 s of no updates → go idle

const COLOR_MAP: Record<string, string> = {
  Black: '#1a1a1a', White: '#f5f5f5', Silver: '#c0c0c0', Gray: '#808080',
  Blue: '#2563eb', Red: '#dc2626', Gold: '#d97706', Beige: '#d4b896',
  Green: '#16a34a', Orange: '#ea580c', Purple: '#9333ea', Yellow: '#eab308',
  Pink: '#ec4899', Brown: '#92400e', Turquoise: '#0d9488',
}

const fmt = (n: number) =>
  'RM ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
    // ── BroadcastChannel (same-origin cross-tab) ──────────────────────────
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel('kiosk_state')
      bc.onmessage = (e: MessageEvent<KioskState>) => resetIdle(e.data)
    } catch { }
    
    // ── Firestore Sync (Real-time cross-device) ──────────────────────────
    const unsub = onSnapshot(doc(db, 'settings', 'kiosk_state'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as KioskState
        resetIdle(data)
      }
    })

    return () => {
      bc?.close()
      unsub()
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
  }, [resetIdle])

  return state
}

// ── Export helper so CashierCheckout can call this ───────────────────────────
export function broadcastKioskState(state: KioskState) {
  try { new BroadcastChannel('kiosk_state').postMessage(state) } catch { }
  try { localStorage.setItem('kiosk_state', JSON.stringify(state)) } catch { }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CarSilhouette({ color = '#2563eb' }: { color?: string }) {
  return (
    <svg viewBox="0 0 320 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-3xl">
      <defs>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="glassGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      {/* Shadow */}
      <ellipse cx="160" cy="128" rx="130" ry="10" fill="rgba(0,0,0,0.25)" />
      {/* Body */}
      <path d="M28 100 Q28 115 48 118 L272 118 Q292 115 292 100 L292 82 L28 82 Z" fill="url(#bodyGrad)" />
      {/* Roof */}
      <path d="M90 82 Q100 50 120 42 L200 42 Q220 50 230 82 Z" fill="url(#bodyGrad)" filter="url(#glow)" />
      {/* Windows */}
      <path d="M104 80 Q110 57 125 50 L160 50 L160 80 Z" fill="url(#glassGrad)" opacity="0.85" />
      <path d="M165 50 L200 50 Q215 57 218 80 L165 80 Z" fill="url(#glassGrad)" opacity="0.85" />
      {/* Window divider */}
      <line x1="162" y1="50" x2="162" y2="80" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
      {/* Front/back detail */}
      <rect x="28" y="90" width="40" height="10" rx="4" fill={color} opacity="0.7" />
      <rect x="252" y="90" width="40" height="10" rx="4" fill={color} opacity="0.7" />
      {/* Headlights */}
      <rect x="30" y="84" width="28" height="8" rx="4" fill="#fef9c3" opacity="0.95" />
      <rect x="262" y="84" width="28" height="8" rx="4" fill="#fca5a5" opacity="0.8" />
      {/* Wheels */}
      <circle cx="82" cy="116" r="20" fill="#111" />
      <circle cx="82" cy="116" r="12" fill="#374151" />
      <circle cx="82" cy="116" r="5" fill="#9ca3af" />
      <circle cx="238" cy="116" r="20" fill="#111" />
      <circle cx="238" cy="116" r="12" fill="#374151" />
      <circle cx="238" cy="116" r="5" fill="#9ca3af" />
      {/* Door line */}
      <line x1="162" y1="82" x2="162" y2="118" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      {/* Highlight */}
      <path d="M95 65 Q140 55 210 65" stroke="rgba(255,255,255,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// ─── Idle Screen ──────────────────────────────────────────────────────────────
function IdleScreen() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true
      videoRef.current.play().catch(() => { })
    }
  }, [])

  const timeStr = time.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', hour12: true })

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-zinc-950">
      {/* Subtle background video/gradient */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover opacity-40"
        loop muted playsInline autoPlay
        src="/kiosk-idle.mp4"
        onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none' }}
      />

      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(79,70,229,0.15)_0%,transparent_70%)] animate-[breathe_8s_ease-in-out_infinite]" />

      <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:80px_80px]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-12 text-center px-8">
        <div className="flex items-center gap-3 mb-2">
          <Image
            src="/logo.png"
            alt="Bossque Carwash Logo"
            width={44}
            height={44}
            priority
            className="rounded-xl shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all object-contain"
          />
          <h1 className="text-left font-black text-5xl tracking-[0.1em] text-white uppercase font-bebas">
            CARWASH <span className="text-indigo-400">BOSSQUE</span>
          </h1>
        </div>

        <div className="font-bebas text-[180px] text-white tracking-tighter leading-none drop-shadow-2xl">
          {timeStr}
        </div>
      </div>

      <style>{`
        @keyframes breathe { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.08);opacity:0.7} }
        @keyframes pulse { 0%,100%{opacity:0.2} 50%{opacity:1} }
        @keyframes glowPulse { 0%,100%{box-shadow:0 0 20px rgba(37,99,235,0.3)} 50%{box-shadow:0 0 50px rgba(37,99,235,0.7)} }
      `}</style>
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

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'row',
      background: '#0a0a0a', fontFamily: "'DM Sans', system-ui, sans-serif",
      overflow: 'hidden', position: 'relative',
    }}>

      {/* ── LEFT PANEL – Car Image (Framed) ─────────────────────────── */}
      <div style={{
        width: '40%', height: '100%', display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.1)',
        background: '#000',
        position: 'relative', overflow: 'hidden',
        padding: '30px',
      }}>
        {primaryTx?.imageUrl ? (
          <div style={{
            width: '100%', height: '100%', borderRadius: '40px',
            overflow: 'hidden', border: '12px solid #fff',
            boxShadow: '0 30px 60px rgba(0,0,0,0.8)',
            animation: 'fadeIn 0.8s ease-out',
          }}>
            <img
              src={primaryTx.imageUrl}
              alt="Vehicle"
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
              }}
            />
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', background: 'rgba(0,0,0,0.02)' }}>
            <CarSilhouette color={carColor} />
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL – Pricing & Details ─────────────────────────── */}
      <div style={{
        width: '60%', height: '100%', display: 'flex', flexDirection: 'column',
        background: '#09090b', overflow: 'hidden',
      }}>
        {/* Car Detail Header */}
        <div style={{
          padding: '24px 32px', display: 'flex', alignItems: 'center', gap: 20,
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: '#000000',
        }}>
          <div style={{
            width: 50, height: 50, borderRadius: 14,
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(37,99,235,0.2)',
          }}>
            <Car style={{ width: 24, height: 24, color: '#fff' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Bebas Neue', monospace", fontSize: 48, letterSpacing: 4,
              color: '#ffffff', lineHeight: 1, marginBottom: 4
            }}>
              {isMulti ? transactions.map(t => t.plateNumber).join(' · ') : primaryTx?.plateNumber}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ color: '#a1a1aa', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                {!isMulti ? `${primaryTx?.brand} ${primaryTx?.model}` : `${transactions.length} ${t('payment.batch')}`}
              </div>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#3f3f46' }} />
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                color: '#22c55e', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'glowPulse 2s infinite' }} />
                Live
              </div>
            </div>
          </div>
        </div>

        {/* Main Details Area */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Car details grid on right */}
          {!isMulti && primaryTx && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
              <InfoTile label={t('priceBook.brand')} value={primaryTx.brand || '—'} />
              <InfoTile label={t('priceBook.model')} value={primaryTx.model || '—'} />
              <InfoTile label={t('intake.color')} value={t(`color.${primaryTx.color}` as any) || '—'} accent={carColor} />
              <InfoTile label={t('staff.checkIn')} value={formatTime(primaryTx.checkInTime)} />
            </div>
          )}

          {/* Services Tags */}
          {activeServices.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {activeServices.map((svc, _i) => {
                const s = SERVICE_LABELS[svc]
                return (
                  <div key={svc} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: `${s.color}10`, border: `1px solid ${s.color}33`,
                    borderRadius: 100, padding: '6px 14px',
                  }}>
                    <span style={{ color: s.color, display: 'flex' }}>{s.icon}</span>
                    <span style={{ color: s.color, fontSize: 13, fontWeight: 700 }}>{s.label}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Base services */}
          <SectionHeader icon={<Car className="w-4 h-4" />} label={t('intake.services')} />
          {transactions.map((tx) => (
            <LineItem
              key={tx.id}
              label={`${tx.brand} ${tx.model} – ${activeServices.map(s => SERVICE_LABELS[s]?.label).join(', ') || t('intake.services')}`}
              sublabel={isMulti ? tx.plateNumber : undefined}
              amount={tx.computedPrice}
            />
          ))}

          {/* Addons */}
          {selectedAddons.length > 0 && (
            <>
              <SectionHeader icon={<Package className="w-4 h-4" />} label={t('cashier.retailAddons')} highlight />
              {selectedAddons.map((a, i) => (
                <LineItem
                  key={a.id}
                  label={a.name}
                  sublabel={a.quantity > 1 ? `x${a.quantity}` : undefined}
                  amount={a.price * a.quantity}
                  accent
                  animate={i}
                />
              ))}
            </>
          )}

          {/* Misc charges */}
          {miscCharges.length > 0 && (
            <>
              <SectionHeader icon={<Tag className="w-4 h-4" />} label={t('cashier.miscCharges')} />
              {miscCharges.map((m, i) => (
                <LineItem key={i} label={m.name} amount={m.price} animate={i} />
              ))}
            </>
          )}

          <div className="h-px bg-white/5 my-4 mx-4" />

          {/* Grand Total Card */}
          <div className={`mt-auto
            bg-zinc-900 border border-white/10 rounded-3xl p-8 flex items-center justify-between shadow-2xl
            transition-all duration-300 ${totalChanged ? 'scale-105 opacity-80' : 'scale-100'}
          `} style={{ flexShrink: 0 }}>
            <div>
              <span className="block text-zinc-500 text-xs font-black uppercase tracking-widest mb-1">{t('payment.totalAmount')}</span>
              <p className="text-zinc-400 text-sm font-bold">
                {t('payment.totalCars')} {transactions.length} {selectedAddons.length > 0 ? `+ ${selectedAddons.length} item` : ''}
              </p>
            </div>
            <div className="font-bebas text-7xl text-white">
              {fmt(totalAmount)}
            </div>
          </div>

          {/* Confirmed */}
          {stage === 'confirmed' && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-10 text-center animate-in slide-in-from-bottom-8">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-emerald-400 font-black text-3xl">{t('payment.success')}</h3>
              <p className="text-emerald-400/60 font-bold mt-2">Terima kasih! Sila datang lagi 🚗</p>
            </div>
          )}
        </div>

        <div className="px-8 py-5 border-t border-white/5 bg-black flex items-center justify-between">
          <div className="text-zinc-500 text-xs font-black uppercase tracking-widest flex items-center gap-2">
            <Clock style={{ width: 12, height: 12 }} />
            {new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </div>
        </div>

        {/* Cash Popup Overlay */}
        {paymentMethod === 'CASH' && stage === 'payment' && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{
              background: '#18181b', padding: '48px', borderRadius: '56px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px',
              boxShadow: '0 40px 80px -15px rgba(0,0,0,0.6)',
              maxWidth: '95%', width: '560px', border: '1px solid rgba(255,255,255,0.1)',
              animation: 'slideUp 0.5s ease-out'
            }}>
              <div style={{ background: 'rgba(16,185,129,0.1)', padding: '14px 28px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Banknote className="w-8 h-8 text-emerald-400" />
                <span style={{ fontWeight: 900, color: '#34d399', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '24px' }}>{t('payment.cash')}</span>
              </div>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px', textAlign: 'center' }}>
                <div>
                  <span style={{ display: 'block', color: '#a1a1aa', fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>{t('payment.totalAmount')}</span>
                  <div style={{ fontSize: '110px', fontWeight: 900, color: '#fff', fontFamily: "'Bebas Neue', sans-serif", lineHeight: 1 }}>{fmt(totalAmount)}</div>
                </div>
                {cashReceived > 0 && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '32px', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                      <span style={{ color: '#a1a1aa', fontWeight: 800, textTransform: 'uppercase', fontSize: '12px' }}>{t('payment.amountReceived')}</span>
                      <span style={{ color: '#34d399', fontWeight: 900, fontSize: '24px' }}>{fmt(cashReceived)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                      <span style={{ color: '#a1a1aa', fontWeight: 800, textTransform: 'uppercase', fontSize: '12px' }}>{t('payment.balance')}</span>
                      <span style={{ color: balance >= 0 ? '#60a5fa' : '#fb7185', fontWeight: 900, fontSize: '24px' }}>{balance >= 0 ? fmt(balance) : '...'}</span>
                    </div>
                  </div>
                )}
              </div>
              <p style={{ textAlign: 'center', color: '#71717a', fontWeight: 700, fontSize: '16px', maxWidth: '350px' }}>
                {'Sila berikan wang tunai kepada juruwang.'}
              </p>
            </div>
          </div>
        )}

        {/* QR Popup Overlay */}
        {paymentMethod === 'ONLINE' && stage === 'payment' && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{
              background: '#18181b', padding: '48px', borderRadius: '56px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px',
              boxShadow: '0 40px 80px -15px rgba(0,0,0,0.6)',
              maxWidth: '95%', width: '520px', border: '1px solid rgba(255,255,255,0.1)',
              animation: 'slideUp 0.5s ease-out'
            }}>
              <div style={{ background: 'rgba(79,70,229,0.1)', padding: '14px 28px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CreditCard className="w-8 h-8 text-indigo-400" />
                <span style={{ fontWeight: 900, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '24px' }}>{t('payment.online')}</span>
              </div>
              <div style={{ width: '340px', height: '340px', padding: '16px', background: 'white', borderRadius: '40px', border: '3px solid #f1f5f9', boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.05)' }}>
                <img
                  src="/qr-payment.png"
                  alt="Scan to Pay"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://api.qrserver.com/v1/create-qr-code/?size=340x340&data=BossqueCarwash' }}
                />
              </div>
              <p style={{ textAlign: 'center', color: '#a1a1aa', fontWeight: 800, fontSize: '20px', maxWidth: '350px', lineHeight: '1.4' }}>{t('payment.qrInstruction')}</p>
              <div style={{ fontSize: '64px', fontWeight: 900, color: '#818cf8', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '2px' }}>{fmt(totalAmount)}</div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes pulse { 0%,100%{opacity:0.2} 50%{opacity:1} }
        @keyframes slideUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes glowPulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes countUp { 0%{transform:scale(1.05);opacity:0.7} 100%{transform:scale(1);opacity:1} }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>
    </div>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────

function InfoTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-zinc-900 rounded-2xl p-4 border border-white/5 shadow-sm">
      <span className="block text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-1.5">{label}</span>
      <div className={`text-white font-extrabold text-lg flex items-center gap-2`}>
        {accent && <div className="w-3 h-3 rounded-full border border-white/10" style={{ background: accent }} />}
        {value}
      </div>
    </div>
  )
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-3 mt-6 mb-2">
      <span className="text-slate-400">{icon}</span>
      <span className="text-slate-500 text-xs font-black uppercase tracking-[0.2em]">{label}</span>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  )
}

function LineItem({ label, sublabel, amount, accent, animate }: { label: string; sublabel?: string; amount: number; accent?: boolean; animate?: number }) {
  return (
    <div className={`flex items-center justify-between p-5 rounded-2xl bg-zinc-900/50 border border-white/5 shadow-sm animate-in slide-in-from-bottom-2 duration-300`} style={{ animationDelay: `${(animate || 0) * 0.1}s` }}>
      <div>
        <span className="text-zinc-200 font-bold text-base">{label}</span>
        {sublabel && <span className="block text-zinc-500 text-xs font-bold mt-1 uppercase tracking-wider">{sublabel}</span>}
      </div>
      <div className={`font-black text-lg tabular-nums ${accent ? 'text-indigo-400' : 'text-zinc-300'}`}>
        {fmt(amount)}
      </div>
    </div>
  )
}
function formatTime(t: any): string {
  const d = t?.toDate ? t.toDate() : (t instanceof Date ? t : new Date(t))
  return d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', hour12: true })
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