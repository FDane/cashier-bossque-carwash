/**
 * kioskBridge.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Call `pushKioskState(...)` from CashierCheckout whenever the checkout state
 * changes. KioskDisplay (open in a separate browser tab/window on your second
 * monitor) picks this up via BroadcastChannel (instant, same-origin) with a
 * localStorage fallback (500 ms polling).
 *
 * HOW TO USE IN CashierCheckout.tsx
 * ─────────────────────────────────
 * 1. Import:
 *    import { pushKioskState } from '@/lib/kioskBridge'
 *
 * 2. Add a useEffect that fires whenever checkout state changes:
 *
 *    useEffect(() => {
 *      const txs = checkoutModal.transactions
 *      if (txs.length === 0) {
 *        pushKioskState({ stage: 'idle', transactions: [], ... })
 *        return
 *      }
 *      const base = txs.reduce((s, t) => s + t.computedPrice, 0)
 *      const addonsTotal = checkoutModal.selectedAddons.reduce((s, a) => s + a.price * a.quantity, 0)
 *      const miscTotal   = checkoutModal.miscCharges.reduce((s, m) => s + m.price, 0)
 *      const total = base + addonsTotal + miscTotal
 *
 *      pushKioskState({
 *        stage: checkoutModal.paymentMethod ? 'payment' : checkoutModal.selectedAddons.length > 0 ? 'addons' : 'selecting',
 *        transactions: txs,
 *        paymentMethod: checkoutModal.paymentMethod,
 *        cashReceived: checkoutModal.cashReceived,
 *        selectedAddons: checkoutModal.selectedAddons,
 *        miscCharges: checkoutModal.miscCharges,
 *        totalAmount: total,
 *        balance: checkoutModal.paymentMethod === 'CASH' ? checkoutModal.cashReceived - total : 0,
 *      })
 *    }, [checkoutModal])
 *
 * 3. After a successful completeTransaction(), call:
 *    pushKioskState({ stage: 'confirmed', ... })
 *    Then after 5 seconds reset to idle:
 *    setTimeout(() => pushKioskState({ stage: 'idle', transactions: [], ... }), 5000)
 *
 * 4. Navigate to /kiosk on the second screen tab. Done! ✅
 */

export type PaymentMethod = 'CASH' | 'ONLINE' | null

export interface KioskState {
  transactions: {
    id: string
    plateNumber: string
    brand: string
    model: string
    color?: string
    computedPrice: number
    services: { exterior?: boolean; interior?: boolean; engine?: boolean }
    imageUrl?: string | null
    checkInTime: string | Date
  }[]
  paymentMethod: PaymentMethod
  cashReceived: number
  selectedAddons: { id: string; name: string; price: number; quantity: number }[]
  miscCharges: { name: string; price: number }[]
  totalAmount: number
  balance: number
  stage: 'idle' | 'selecting' | 'addons' | 'payment' | 'confirmed'
}

let _bc: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null
  if (!_bc) {
    try { _bc = new BroadcastChannel('kiosk_state') } catch { return null }
  }
  return _bc
}

export function pushKioskState(state: KioskState): void {
  const serialized = JSON.stringify(state)
  // BroadcastChannel (instant cross-tab)
  try { getChannel()?.postMessage(state) } catch {}
  // localStorage (polling fallback for older browsers / different origins)
  try { localStorage.setItem('kiosk_state', serialized) } catch {}
}

export function clearKioskState(): void {
  pushKioskState({
    transactions: [], paymentMethod: null, cashReceived: 0,
    selectedAddons: [], miscCharges: [], totalAmount: 0, balance: 0,
    stage: 'idle',
  })
}