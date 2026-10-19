import { useCallback, useEffect, useRef, useState } from 'react'

export type PrinterStatus = 'ONLINE' | 'UNSTABLE' | 'OFFLINE' | 'CHECKING'
const FAILURE_THRESHOLD = 3
const STATUS_TIMEOUT_MS = 9000

export function useSystemStatus() {
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>('CHECKING')
  const [printerOnline, setPrinterOnline] = useState<boolean | null>(null)
  const [lastPrinterSuccess, setLastPrinterSuccess] = useState<Date | null>(null)
  const [kioskOnline, setKioskOnline] = useState<boolean | null>(null)
  const printerFailures = useRef(0)
  const printerRequest = useRef<AbortController | null>(null)
  const printerRequestRunning = useRef(false)
  const mounted = useRef(true)

  const checkPrinter = useCallback(async () => {
    if (printerRequestRunning.current) return
    printerRequestRunning.current = true
    const controller = new AbortController()
    printerRequest.current = controller
    const timeout = window.setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS)
    try {
      const res = await fetch('https://printer.bossque.my/status', { method: 'GET', cache: 'no-store', signal: controller.signal })
      const data = await res.json()
      if (!res.ok || data.printer?.connected !== true || data.printer?.status?.toLowerCase() !== 'normal') {
        throw new Error(data.printer?.message || `Printer status HTTP ${res.status}`)
      }
      if (!mounted.current) return
      printerFailures.current = 0
      setPrinterOnline(true)
      setPrinterStatus('ONLINE')
      setLastPrinterSuccess(new Date())
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return
      printerFailures.current += 1
      setPrinterOnline(false)
      setPrinterStatus(printerFailures.current >= FAILURE_THRESHOLD ? 'OFFLINE' : 'UNSTABLE')
      console.error('Printer health check failed:', error)
    } finally {
      window.clearTimeout(timeout)
      printerRequestRunning.current = false
      if (printerRequest.current === controller) printerRequest.current = null
    }
  }, [])

  const checkKiosk = useCallback(async () => {
    try {
      const res = await fetch('/api/kiosk-health', { method: 'GET', signal: AbortSignal.timeout(9000), cache: 'no-store' })
      if (mounted.current) setKioskOnline(res.ok)
    } catch {
      if (mounted.current) setKioskOnline(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    void checkPrinter()
    void checkKiosk()
    const interval = window.setInterval(() => { void checkPrinter(); void checkKiosk() }, 30000)
    return () => { mounted.current = false; window.clearInterval(interval); printerRequest.current?.abort() }
  }, [checkPrinter, checkKiosk])

  return { printerOnline, printerStatus, lastPrinterSuccess, kioskOnline, checkPrinter, checkKiosk }
}