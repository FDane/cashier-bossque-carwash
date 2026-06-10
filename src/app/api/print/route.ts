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
    // Perform a "silent" check. 
    // In a real scenario, you could add logic here to check if the 
    // USB device is actually visible to the OS.
    return NextResponse.json({ 
      success: true,
      status: 'online',
      printer: { connected: true }
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ 
      status: 'Error',
      message: error instanceof Error ? error.message : 'Printer offline'
    }, { status: 500 });
  }
}