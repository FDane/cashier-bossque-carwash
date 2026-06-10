import { NextRequest, NextResponse } from 'next/server'
import { executePrintJob } from '@/lib/printerService' // Assuming this is your path

export async function POST(request: NextRequest) {
  try {
    // 1. Get the JSON payload sent from usePrinter.ts
    const data = await request.json()

    // 2. Send it to our service to be printed
    await executePrintJob(data)

    // 3. Return success to the frontend
    return NextResponse.json(
      {
        success: true,
        message: 'Receipt printed successfully',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Print error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to print receipt',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Trigger a diagnostic test print
    await executePrintJob({
      plateNumber: "DIAGNOSTIC",
      brand: "SYSTEM",
      model: "TEST",
      color: "N/A",
      services: { exterior: true, interior: true },
      basePrice: 0,
      addons: [],
      miscCharges: [],
      paymentMethod: "CASH",
      totalAmount: 0,
      transactionId: "TEST-MODE",
      notes: "Printer Diagnostic Connection Successful"
    });

    return NextResponse.json({ 
      status: 'Printer API is online',
      diagnostic: 'Test print sent'
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ 
      status: 'Error',
      message: error instanceof Error ? error.message : 'Printer offline'
    }, { status: 500 });
  }
}