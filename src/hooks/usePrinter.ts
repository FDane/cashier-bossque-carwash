
'use client'

import { useState, useCallback, useRef } from 'react'
import type { PrintReceiptData } from '@/lib/printerService'

// ==========================================
// CONFIGURATION
// ==========================================

const PRINT_API = '/api/printer/print'
const DRAWER_API = '/api/printer/drawer'
const STATUS_API = 'https://printer.bossque.my/status'

const STATUS_TIMEOUT_MS = 12000

export interface UsePrinterOptions {
  // Kept for compatibility with existing components.
  // Hardware commands must never be automatically retried.
  autoRetry?: boolean
  retryCount?: number
}

interface PrinterApiResponse {
  success: boolean
  error?: string
  message?: string
  printJobId?: string
  drawerJobId?: string
  duplicate?: boolean
  alreadyOpened?: boolean
  drawerCommandSent?: boolean
  status?: string
}

interface PrinterStatusResponse {
  ok: boolean
  service?: string
  printer?: {
    connected: boolean
    name?: string
    driver?: string
    port?: string
    status?: string
    message?: string
  }
  timestamp?: string
  latencyMs?: number
  cached?: boolean
}

export const usePrinter = (_options: UsePrinterOptions = {}) => {
  const [isPrinting, setIsPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const [lastPrintedAt, setLastPrintedAt] = useState<Date | null>(null)

  // Prevent multiple simultaneous print commands
  // from this component instance.
  const printingRef = useRef(false)

  // ==========================================
  // PRINT RECEIPT
  // ==========================================

  const printReceipt = useCallback(
    async (receiptData: PrintReceiptData): Promise<PrinterApiResponse> => {
      if (printingRef.current) {
        throw new Error('A print request is already processing')
      }

      printingRef.current = true
      setIsPrinting(true)
      setPrintError(null)

      try {
        const printJobId =
          receiptData.printJobId || crypto.randomUUID()

        const response = await fetch(PRINT_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...receiptData,
            printJobId,
          }),
          cache: 'no-store',
        })

        const result: PrinterApiResponse =
          await response.json().catch(() => ({
            success: false,
            error: 'Invalid printer server response',
          }))

        if (!response.ok || result.success !== true) {
          throw new Error(
            result.error ||
            `Print server HTTP ${response.status}`
          )
        }

        setLastPrintedAt(new Date())

        return result
      } catch (error) {
        const lastError =
          error instanceof Error
            ? error
            : new Error(String(error))

        setPrintError(lastError.message)

        throw lastError
      } finally {
        printingRef.current = false
        setIsPrinting(false)
      }
    },
    []
  )

  // ==========================================
  // OPEN CASH DRAWER
  // ==========================================

  // transactionIds must contain actual POS
  // transaction IDs, not generated drawer job IDs.
  //
  // Optional drawerJobId allows callers to preserve
  // the same ID when inspecting uncertain outcomes.

  const openDrawer = useCallback(
    async (
      transactionIds: string[],
      drawerJobId?: string
    ): Promise<PrinterApiResponse> => {
      if (
        !Array.isArray(transactionIds) ||
        transactionIds.length === 0
      ) {
        throw new Error(
          'At least one transaction ID is required'
        )
      }

      const jobId = drawerJobId || crypto.randomUUID()

      const response = await fetch(DRAWER_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          drawerJobId: jobId,
          transactionIds,
        }),
        cache: 'no-store',
      })

      const result: PrinterApiResponse =
        await response.json().catch(() => ({
          success: false,
          error: 'Invalid cash drawer server response',
        }))

      if (!response.ok || result.success !== true) {
        throw new Error(
          result.error ||
          `Drawer server HTTP ${response.status}`
        )
      }

      return result
    },
    []
  )

  // ==========================================
  // CHECK PRINTER STATUS
  // ==========================================

  const checkPrinterStatus =
    useCallback(async (): Promise<PrinterStatusResponse | null> => {
      try {
        const response = await fetch(STATUS_API, {
          method: 'GET',
          cache: 'no-store',
          signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
        })

        const result: PrinterStatusResponse =
          await response.json()

        if (!response.ok || result.ok !== true) {
          throw new Error(
            result.printer?.message ||
            `Printer status HTTP ${response.status}`
          )
        }

        return result
      } catch (error) {
        console.error(
          '[PRINTER STATUS] Check failed:',
          error
        )

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
