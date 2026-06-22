"use client"

import React, { useState } from 'react'
import { CashierAuthContext } from './CashierAuthProvider'
import { useLanguage } from '@/hooks/useLanguage'

const DIGITS = ['1','2','3','4','5','6','7','8','9','0']

export default function PinPadUI() {
  const ctx = React.useContext(CashierAuthContext) as any
  const [pin, setPin] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const { t} = useLanguage()

  if (!ctx) return null

  function press(d: string) {
    if (pin.length >= 4) return
    setPin((p) => p + d)
    setError(null)
  }

  function backspace() {
    setPin((p) => p.slice(0, -1))
    setError(null)
  }

  async function submit() {
    if (pin.length !== 4) {
      setError(t('pinPad.longPinError' as any))
      return
    }
    if (!ctx) {
      setError(t('pinPad.authUnavailable' as any))
      return
    }
    const ok = await ctx.unlock(pin)
    if (!ok) {
      setError(t('pinPad.incorrectPin' as any))
      setPin('')
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white/80 dark:bg-zinc-900/80 rounded-lg p-6 shadow-lg">
        <h3 className="text-center text-lg font-semibold mb-4">{t('pinPad.title' as any) || 'Masukkan PIN'}</h3>

        <div className="flex justify-center mb-4">
          {[0,1,2,3].map((i) => (
            <div key={i} className="w-10 h-10 mx-1 bg-zinc-100 dark:bg-zinc-800 rounded flex items-center justify-center text-xl">
              {pin[i] ? '•' : ''}
            </div>
          ))}
        </div>

        {error && <div className="text-center text-sm text-red-600 mb-2">{error}</div>}

        <div className="grid grid-cols-3 gap-3">
          {DIGITS.slice(0,9).map((d) => (
            <button key={d} onClick={() => press(d)} className="py-4 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 active:scale-95">{d}</button>
          ))}

          <button onClick={backspace} className="py-4 rounded bg-zinc-200 dark:bg-zinc-800">Del</button>
          <button onClick={() => press('0')} className="py-4 rounded bg-zinc-200 dark:bg-zinc-800">0</button>
          <button onClick={submit} className="py-4 rounded bg-blue-600 text-white">OK</button>
        </div>
      </div>
    </div>
  )
}
