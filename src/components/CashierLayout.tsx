"use client"

import React from 'react'
import { CashierAuthContext } from './CashierAuthProvider'
import PinPadUI from './PinPadUI'

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  // If context is not available, render children (safe fallback)
  const ctx = React.useContext(CashierAuthContext)
  if (!ctx) return <>{children}</>

  if (!ctx.isUnlocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <PinPadUI />
      </div>
    )
  }

  return <>{children}</>
}
