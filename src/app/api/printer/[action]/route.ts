
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const ACTION_PATHS: Record<string, string> = {
  print: '/print',
  drawer: '/drawer/open',
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> }
) {
  const { action } = await context.params
  const endpoint = ACTION_PATHS[action]

  if (!endpoint) {
    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 404 }
    )
  }

  // IMPORTANT:
  // This route must only be reachable by authorized
  // cashier devices. Apply access controls before
  // enabling it in production.

  const apiKey = process.env.PRINTER_API_SECRET
  const serverUrl = process.env.PRINTER_SERVER_URL

  if (!apiKey || !serverUrl) {
    return NextResponse.json(
      { success: false, error: 'Printer server not configured' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()

    const response = await fetch(
      `${serverUrl.replace(/\/$/, '')}${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Printer-Key': apiKey,
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      }
    )

    const result = await response.json().catch(() => ({
      success: false,
      error: 'Invalid printer response',
    }))

    return NextResponse.json(result, {
      status: response.status,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Printer proxy error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Printer request failed or outcome uncertain',
      },
      { status: 502 }
    )
  }
}
