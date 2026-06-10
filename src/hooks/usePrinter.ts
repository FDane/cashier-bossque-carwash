import { useState, useCallback } from 'react'
import { PrintReceiptData } from '@/lib/printerService'

export interface UsePrinterOptions {
  autoRetry?: boolean
  retryCount?: number
}

export const usePrinter = (options: UsePrinterOptions = {}) => {
  const [isPrinting, setIsPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const [lastPrintedAt, setLastPrintedAt] = useState<Date | null>(null)

  const printReceipt = useCallback(
    async (receiptData: PrintReceiptData) => {
      setIsPrinting(true)
      setPrintError(null)

      let lastError: Error | null = null

      for (let attempt = 0; attempt < (options.retryCount || 1); attempt++) {
        try {
          const response = await fetch('https://printer.bossque.my/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(receiptData),
          });

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to print receipt')
          }

          const result = await response.json()
          console.log('Print successful:', result)
          setLastPrintedAt(new Date())
          setIsPrinting(false)
          return result

        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          console.error(`Print attempt ${attempt + 1} failed:`, lastError.message)

          if (attempt < (options.retryCount || 1) - 1) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
      }

      setPrintError(lastError?.message || 'Failed to print receipt')
      setIsPrinting(false)
      throw lastError
    },
    [options]
  )

  const checkPrinterStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/print', { method: 'GET' })
      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error checking printer status:', error)
      return null
    }
  }, [])

  return {
    printReceipt,
    checkPrinterStatus,
    isPrinting,
    printError,
    lastPrintedAt,
  }
}
