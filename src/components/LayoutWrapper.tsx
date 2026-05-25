'use client'

import { usePathname } from 'next/navigation'
import AppHeader from './AppHeader'

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isKiosk = pathname === '/kiosk'

  // Kiosk mode: No header, no container padding, pure black background for OLED tablets
  if (isKiosk) {
    return <div className="fixed inset-0 bg-black overflow-hidden">{children}</div>
  }

  return (
    <>
      <AppHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </>
  )
}