import { useState, useCallback } from 'react'
import { PrintReceiptData } from '@/lib/printerService'

export interface UsePrinterOptions {
  // Kept for source compatibility. Print jobs are never automatically retried:
  // a timeout may happen after the printer has accepted the job.
  autoRetry?: boolean
  retryCount?: number
}

export const usePrinter = (_options: UsePrinterOptions = {}) => {
  const [isPrinting, setIsPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const [lastPrintedAt, setLastPrintedAt] = useState<Date | null>(null)

  const printReceipt = useCallback(
    async (receiptData: PrintReceiptData) => {
      setIsPrinting(true)
      setPrintError(null)

      try {
        const response = await fetch('https://printer.bossque.my/print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...receiptData, printJobId: receiptData.printJobId || crypto.randomUUID() }),
        });

        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || `Print server HTTP ${response.status}`)
        setLastPrintedAt(new Date())
        setIsPrinting(false)
        return result
      } catch (error) {
        const lastError = error instanceof Error ? error : new Error(String(error))
        setPrintError(lastError.message)
        setIsPrinting(false)
        throw lastError
      }
    },
    []
  )

  const openDrawer = useCallback(async (transactionIds: string[]) => {
    const token = await import('@/lib/firebase').then(({ auth }) => auth.currentUser?.getIdToken())
    if (!token) throw new Error('Cashier authentication is required to open the drawer')
    const response = await fetch('https://printer.bossque.my/drawer/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token}` },
      body: JSON.stringify({ drawerJobId: crypto.randomUUID(), transactionIds }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || `Drawer server HTTP ${response.status}`)
    return result
  }, [])

  const checkPrinterStatus = useCallback(async () => {
    try {
      const response = await fetch(
        'https://printer.bossque.my/status',
        { method: 'GET', cache: 'no-store' }
      )

      if (!response.ok) {
        throw new Error(`Printer status HTTP ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch {
      return null
    }
  }, [])

  return {
    printReceipt,
    openDrawer,
    checkPrinterStatus,
    isPrinting,
    printError,
    lastPrintedAt,
  }
}
