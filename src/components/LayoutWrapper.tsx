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
      <div className="flex flex-col h-[100dvh] overflow-hidden">
        <AppHeader />
        <div className={pathname === '/' ? "flex-1 min-h-0 overflow-hidden" : "flex-1 overflow-y-auto w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
          <CashierLayout>{children}</CashierLayout>
        </div>
      </div>
    </CashierAuthProvider>
  )
}