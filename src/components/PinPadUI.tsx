"use client"

import React, { useState } from 'react'
import { CashierAuthContext } from './CashierAuthProvider'
import { useLanguage } from '@/hooks/useLanguage'

const DIGITS = ['1','2','3','4','5','6','7','8','9','0']

export default function PinPadUI() {
  const ctx = React.useContext(CashierAuthContext) as any
  const [pin, setPin] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const { t } = useLanguage()

  if (!ctx) return null

  function press(d: string) {
    if (isSubmitting || pin.length >= 4) return 
    setPin((p) => p + d)
    setError(null)
  }

  function backspace() {
    if (isSubmitting) return 
    setPin((p) => p.slice(0, -1))
    setError(null)
  }

  async function submit() {
    if (isSubmitting) return 
    
    if (pin.length !== 4) {
      setError(t('pinPad.longPinError' as any))
      return
    }
    if (!ctx) {
      setError(t('pinPad.authUnavailable' as any))
      return
    }

    setIsSubmitting(true)
    setError(null) 

    try {
      await new Promise((resolve) => setTimeout(resolve, 800))

      const ok = await ctx.unlock(pin)
      if (!ok) {
        setError(t('pinPad.incorrectPin' as any))
        setPin('')
        setIsSubmitting(false) 
      }
    } catch (err) {
      setError('An error occurred during authentication.' + (err instanceof Error ? ` ${err.message}` : ''))
      setIsSubmitting(false)
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
            <button 
              key={d} 
              onClick={() => press(d)} 
              disabled={isSubmitting}
              className="py-4 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              {d}
            </button>
          ))}

          <button 
            onClick={backspace} 
            disabled={isSubmitting}
            className="py-4 rounded bg-zinc-200 dark:bg-zinc-800 disabled:opacity-50"
          >
            Del
          </button>
          
          <button 
            onClick={() => press('0')} 
            disabled={isSubmitting}
            className="py-4 rounded bg-zinc-200 dark:bg-zinc-800 disabled:opacity-50"
          >
            0
          </button>
          
          <button 
            onClick={submit} 
            disabled={isSubmitting || pin.length !== 4}
            className="py-4 rounded bg-blue-600 text-white flex items-center justify-center font-medium transition hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              'OK'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}