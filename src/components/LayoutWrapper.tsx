'use client'

import { usePathname } from 'next/navigation'
import AppHeader from './AppHeader'
import { CashierAuthProvider } from './CashierAuthProvider'
import CashierLayout from './CashierLayout'

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isKiosk = pathname === '/kiosk'

  // Kiosk mode: No header, no container padding, pure black background for OLED tablets
  if (isKiosk) {
    return <div className="fixed inset-0 bg-zinc-50 overflow-hidden">{children}</div>
  }

  return (
    <CashierAuthProvider>
      <AppHeader />
      <div className="w-full">
        <CashierLayout>{children}</CashierLayout>
      </div>
    </CashierAuthProvider>
  )
}