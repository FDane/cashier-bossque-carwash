"use client"

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { CashierAuthDoc } from '@/types'

interface CashierAuthContext {
  isUnlocked: boolean
  unlock: (pin: string) => Promise<boolean>
  lock: () => void
}

const CashierAuthContext = createContext<CashierAuthContext | undefined>(undefined)

export function useCashierAuth() {
  const ctx = useContext(CashierAuthContext)
  if (!ctx) throw new Error('useCashierAuth must be used within CashierAuthProvider')
  return ctx
}

export function CashierAuthProvider({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false)
  const activePinRef = useRef<string | null>(null)
  const prevPinRef = useRef<string | null>(null)
  const initialLoadedRef = useRef<boolean>(false)

  useEffect(() => {
    const ref = doc(db, 'settings', 'cashierAuth')
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? (snap.data() as CashierAuthDoc) : null
      const activePin = data?.activePin ?? null

      // If there's a previous value and it changed, immediately lock and remove persisted session
      if (prevPinRef.current !== null && activePin !== prevPinRef.current) {
        setIsUnlocked(false)
        deleteCookie('cashier_unlocked_until')
      }

      prevPinRef.current = activePin
      activePinRef.current = activePin

      // On initial load, allow a persisted unlocked cookie to restore session
      if (!initialLoadedRef.current) {
        initialLoadedRef.current = true
        const until = Number(getCookie('cashier_unlocked_until')) || 0
        if (until && until > Date.now() && activePin !== null) {
          setIsUnlocked(true)
        }
      }
    })

    return () => unsub()
  }, [])

  async function unlock(pin: string) {
    const current = activePinRef.current
    if (!current) return false
    if (pin === current) {
      setIsUnlocked(true)
      // Persist unlocked session until end of day on this device (cookie)
      const until = getEndOfDayTimestamp()
      setCookie('cashier_unlocked_until', String(until), { expires: new Date(until) })
      return true
    }
    return false
  }

  function lock() {
    setIsUnlocked(false)
    deleteCookie('cashier_unlocked_until')
  }

  // --- Simple cookie helpers (no external deps) ---
  function setCookie(name: string, value: string, opts: { expires?: Date } = {}) {
    let cookie = `${name}=${encodeURIComponent(value)}; path=/;`
    if (opts.expires) cookie += ` expires=${opts.expires.toUTCString()};`
    // Do not set Secure here to avoid local dev issues; production can set it via server if needed
    cookie += ' SameSite=Lax;'
    document.cookie = cookie
  }

  function getCookie(name: string) {
    if (typeof document === 'undefined') return null
    const m = document.cookie.match('(?:^|; )' + name + '=([^;]*)')
    return m ? decodeURIComponent(m[1]) : null
  }

  function deleteCookie(name: string) {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax;`
  }

  function getEndOfDayTimestamp() {
    const now = new Date()
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    return end.getTime()
  }

  return (
    <CashierAuthContext.Provider value={{ isUnlocked, unlock, lock }}>
      {children}
    </CashierAuthContext.Provider>
  )
}

export { CashierAuthContext }
