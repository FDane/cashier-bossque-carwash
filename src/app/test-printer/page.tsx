'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { usePrinter } from '@/hooks/usePrinter'

export default function PrinterTestPage() {
  const { printReceipt } = usePrinter()
  const [status, setStatus] = useState<'idle' | 'printing' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleTestPrint = async (type: 'simple' | 'full') => {
    setStatus('printing')
    setErrorMessage('')

    try {
      const testData = {
        transactionId: `TEST-${Math.floor(Math.random() * 10000)}`,
        plateNumber: type === 'simple' ? 'TEST-PING' : 'VBA 1234',
        brand: 'Perodua',
        model: 'Viva',
        color: 'Silver',
        services: {
          exterior: true,
          interior: type === 'full',
        },
        basePrice: type === 'simple' ? 0 : 15.00,
        addons: type === 'full' ? [{ name: 'Tyre Shine', price: 3.00, quantity: 1 }] : [],
        miscCharges: [],
        paymentMethod: 'CASH' as const,
        cashReceived: 20.00,
        change: 2.00,
        totalAmount: type === 'simple' ? 0 : 18.00,
        notes: type === 'simple' ? 'Hardware connection test successful.' : 'Full receipt layout test.',
      }

      await printReceipt(testData)
      
      setStatus('success')
      setTimeout(() => setStatus('idle'), 4000)

    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-100 to-zinc-200 p-6 flex flex-col items-center justify-center font-sans">
      
      {/* Main Card container */}
      <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl w-full max-w-md border border-zinc-100">
        
        {/* Header Section with Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-24 h-24 mb-4 relative rounded-2xl overflow-hidden bg-zinc-50 border border-zinc-100 shadow-inner flex items-center justify-center">
            {/* Note: Ensure public/logo.png exists. 
              We use object-contain so it fits perfectly without cropping.
            */}
            <Image 
              src="/logo.png" 
              alt="Carwash Bossque Logo" 
              fill
              className="object-contain p-2"
              priority
            />
          </div>
          <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">
            Hardware Diagnostics
          </h1>
          <p className="text-zinc-500 text-sm mt-2 leading-relaxed">
            Send test payloads directly to the local POS-58 printer. Database saves are disabled for these tests.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <button
            onClick={() => handleTestPrint('simple')}
            disabled={status === 'printing'}
            className="w-full bg-white border-2 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-semibold py-3.5 px-4 rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Quick Connection Test
          </button>

          <button
            onClick={() => handleTestPrint('full')}
            disabled={status === 'printing'}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-4 rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Print Full Dummy Receipt
          </button>
        </div>

        {/* Status Feedback Area */}
        <div className="mt-8 h-16 flex items-center justify-center">
          {status === 'idle' && (
            <span className="text-zinc-400 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Printer service standing by
            </span>
          )}

          {status === 'printing' && (
            <div className="text-blue-600 font-medium text-sm flex items-center gap-3 bg-blue-50 px-4 py-2 rounded-full border border-blue-100">
              <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending job to Windows Spooler...
            </div>
          )}
          
          {status === 'success' && (
            <div className="text-emerald-700 font-medium text-sm bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Print job sent successfully!
            </div>
          )}

          {status === 'error' && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-xl border border-red-200 w-full animate-in fade-in slide-in-from-bottom-2 text-center">
              <span className="font-semibold block mb-1">Failed to Print</span>
              {errorMessage}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}