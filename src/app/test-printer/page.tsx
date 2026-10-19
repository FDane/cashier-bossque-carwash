'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Printer, RefreshCw, ShieldCheck, Users, Wallet } from 'lucide-react'
import { usePrinter } from '@/hooks/usePrinter'
import type { PrintReceiptData } from '@/lib/printerService'

type TestStatus = 'idle' | 'checking' | 'printing' | 'success' | 'error' | 'uncertain'

const jobId = () => `TEST-${crypto.randomUUID()}`

export default function PrinterTestPage() {
  const { printReceipt, checkPrinterStatus, isPrinting } = usePrinter()
  const [status, setStatus] = useState<TestStatus>('idle')
  const [message, setMessage] = useState('')
  const [lastJobId, setLastJobId] = useState('')
  const [printerReport, setPrinterReport] = useState<{ connected: boolean; status?: string } | null>(null)

  const receipt = (paymentMethod: 'CASH' | 'ONLINE', printJobId: string): PrintReceiptData => ({
    transactionId: `TEST-${paymentMethod}-${Date.now()}`,
    printJobId,
    plateNumber: 'TEST 1234',
    brand: 'Perodua',
    model: 'Viva',
    color: 'Silver',
    services: { exterior: true, interior: true, engine: false },
    basePrice: 15,
    addons: [{ name: 'Tyre Shine', price: 3, quantity: 1 }],
    miscCharges: [],
    paymentMethod,
    cashReceived: paymentMethod === 'CASH' ? 50 : undefined,
    change: paymentMethod === 'CASH' ? 32 : undefined,
    totalAmount: 18,
    notes: paymentMethod === 'CASH'
      ? 'Printer test: cash payment. Drawer should open once.'
      : 'Printer test: online payment. Drawer must remain closed.',
  })

  const batchReceipt = (printJobId: string): PrintReceiptData => ({
    transactionId: `TEST-BATCH-${Date.now()}`,
    printJobId,
    plateNumber: 'TEST 1111, TEST 2222, TEST 3333',
    brand: '', model: '', color: '',
    services: { exterior: false, interior: false, engine: false },
    basePrice: 0,
    addons: [{ name: 'Wax Premium', price: 5, quantity: 1 }],
    miscCharges: [
      { name: 'TEST 1111 (Viva)|Cucian Luar Dalam', price: 24 },
      { name: 'TEST 2222 (Vios)|Cucian Luar', price: 18 },
      { name: 'TEST 3333 (City)|Cucian Luar Dalam Enjin', price: 35 },
    ],
    paymentMethod: 'CASH',
    cashReceived: 100,
    change: 18,
    totalAmount: 82,
    notes: 'Printer test: three-car batch. Drawer should open once.',
  })

  const runPrint = async (kind: 'online' | 'cash' | 'batch') => {
    if (isPrinting) return
    const printJobId = jobId()
    setLastJobId(printJobId)
    setStatus('printing')
    setMessage('Sending one job to the Windows spooler. Do not click again if it takes time.')
    try {
      await printReceipt(kind === 'batch' ? batchReceipt(printJobId) : receipt(kind === 'cash' ? 'CASH' : 'ONLINE', printJobId))
      setStatus('success')
      setMessage(kind === 'online' ? 'Receipt accepted. The cash drawer should stay closed.' : 'Receipt accepted. Verify the paper and drawer physically.')
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Unknown printer error'
      const uncertain = /timeout|abort|network|fetch|HTTP 5/i.test(text)
      setStatus(uncertain ? 'uncertain' : 'error')
      setMessage(uncertain ? `${text} The job may already have reached the printer. Do not retry automatically; inspect the printer first.` : text)
    }
  }

  const checkStatus = async () => {
    setStatus('checking')
    setMessage('Checking the print server and Windows spooler...')
    const result = await checkPrinterStatus()
    if (result?.printer) {
      setPrinterReport(result.printer)
      setStatus('success')
      setMessage(result.printer.connected ? 'Windows reports the printer queue is ready.' : 'Windows reports the printer is not ready.')
    } else {
      setStatus('error')
      setMessage('Could not verify the printer status.')
    }
  }

  const busy = status === 'printing' || status === 'checking'

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 font-sans text-zinc-950 dark:bg-zinc-950 dark:text-white sm:px-6">
      <section className="mx-auto max-w-2xl rounded-[2rem] bg-white p-6 shadow-xl dark:bg-zinc-900 sm:p-10">
        <div className="mb-8 flex items-start gap-4">
          <div className="rounded-2xl bg-blue-600 p-3 text-white"><Printer /></div>
          <div><h1 className="text-2xl font-black">Real-life printer test</h1><p className="mt-1 text-sm text-zinc-500">Uses the same receipt endpoint and idempotent job behavior as checkout.</p></div>
        </div>
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="flex gap-2 font-bold"><AlertTriangle className="h-4 w-4 shrink-0" /> Hardware warning</div>
          <p className="mt-1">Cash tests pulse the drawer. A timeout may still mean the printer accepted the job, so inspect before trying again.</p>
        </div>
        <div className="grid gap-3">
          <button onClick={checkStatus} disabled={busy} className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 px-4 py-3 font-bold hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">{status === 'checking' ? <Loader2 className="animate-spin" /> : <RefreshCw />} Check Windows Printer Status</button>
          <button onClick={() => void runPrint('online')} disabled={busy} className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 font-bold text-white hover:bg-blue-700 disabled:opacity-50"><ShieldCheck /> Test Online Receipt (Drawer Closed)</button>
          <button onClick={() => void runPrint('cash')} disabled={busy} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-4 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"><Wallet /> Test Cash Receipt + Drawer</button>
          <button onClick={() => void runPrint('batch')} disabled={busy} className="flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-4 font-bold text-white hover:bg-violet-700 disabled:opacity-50"><Users /> Test Three-Car Batch + One Drawer Pulse</button>
        </div>
        {printerReport && <p className="mt-5 text-center text-xs text-zinc-500">Windows: {printerReport.status || 'Unknown'} · Connected: {printerReport.connected ? 'yes' : 'no'}</p>}
        <div className="mt-6 min-h-20 rounded-2xl bg-zinc-50 p-4 text-center text-sm dark:bg-zinc-800/60">
          {status === 'printing' || status === 'checking' ? <Loader2 className="mx-auto mb-2 animate-spin text-blue-500" /> : status === 'success' ? <CheckCircle2 className="mx-auto mb-2 text-emerald-500" /> : status === 'uncertain' ? <Clock3 className="mx-auto mb-2 text-amber-500" /> : null}
          <p>{message || 'Ready for a controlled test.'}</p>
          {lastJobId && <p className="mt-2 break-all text-[10px] text-zinc-400">Job: {lastJobId}</p>}
        </div>
        <p className="mt-6 text-center text-xs text-zinc-400">A successful response confirms command acceptance, not physical paper output.</p>
      </section>
    </main>
  )
}