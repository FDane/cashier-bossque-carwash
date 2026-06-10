import { useState, useEffect } from 'react'

export function useSystemStatus() {
  const [printerOnline, setPrinterOnline] = useState<boolean | null>(null)
  const [kioskOnline, setKioskOnline] = useState<boolean | null>(null)

  const checkPrinter = async () => {
    try {
      const res = await fetch('https://printer.bossque.my/', {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      })
      setPrinterOnline(res.ok)
    } catch {
      setPrinterOnline(false)
    }
  }

  const checkKiosk = async () => {
    try {
      const res = await fetch('/api/kiosk-health', {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      })
      setKioskOnline(res.ok)
    } catch {
      setKioskOnline(false)
    }
  }

  useEffect(() => {
    checkPrinter()
    checkKiosk()
    const interval = setInterval(() => {
      checkPrinter()
      checkKiosk()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return { printerOnline, kioskOnline, checkPrinter, checkKiosk }
}