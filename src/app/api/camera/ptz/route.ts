// app/api/camera/ptz/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { OnvifDevice } from 'node-onvif'

const CAMERA_IP   = process.env.CAMERA_IP       ?? '192.168.1.100'
const CAMERA_PORT = process.env.CAMERA_PORT     ?? '80'
const CAMERA_USER = process.env.CAMERA_USER     ?? 'admin'
const CAMERA_PASS = process.env.CAMERA_PASSWORD ?? 'password'

const SPEED = { x: 0.5, y: 0.5 }

let cachedDevice: any = null

async function getDevice(): Promise<any> {
  if (cachedDevice) return cachedDevice
  const device = new OnvifDevice({
    xaddr: `http://${CAMERA_IP}:${CAMERA_PORT}/onvif/device_service`,
    user:  CAMERA_USER,
    pass:  CAMERA_PASS,
  })
  await device.init()
  cachedDevice = device
  return device
}

export async function POST(req: NextRequest) {
  try {
    const { command } = await req.json()
    const device = await getDevice()
    const ptz    = device.services.ptz

    if (!ptz) {
      return NextResponse.json({ error: 'Camera does not support PTZ' }, { status: 400 })
    }

    const profiles     = device.getProfileList()
    const profileToken = profiles[0]?.token
    if (!profileToken) {
      return NextResponse.json({ error: 'No media profile found' }, { status: 500 })
    }

    if (command === 'stop') {
      await ptz.stop({ ProfileToken: profileToken, PanTilt: true, Zoom: false })
      return NextResponse.json({ success: true })
    }

    // node-onvif Velocity is a flat { x, y, z } — plain JS numbers, no nesting
    const velocity: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }

    switch (command) {
      case 'up':    velocity.y =  SPEED.y; break
      case 'down':  velocity.y = -SPEED.y; break
      case 'left':  velocity.x = -SPEED.x; break
      case 'right': velocity.x =  SPEED.x; break
      default:
        return NextResponse.json({ error: `Unknown command: ${command}` }, { status: 400 })
    }

    await ptz.continuousMove({
      ProfileToken: profileToken,
      Velocity:     velocity,
      Timeout:      1,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PTZ API Error]:', err)
    cachedDevice = null
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'PTZ command failed', details: message }, { status: 500 })
  }
}