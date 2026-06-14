// CameraModal.tsx — WebRTC direct peer connection for sub-second latency PTZ
'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import {
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, Aperture, X, Loader2, Wifi, WifiOff,
} from 'lucide-react'

interface CameraModalProps {
  onClose: () => void
  onCapture: (file: File) => void
}

// MediaMTX WebRTC API base — uses the same host as your stream
// In production, set NEXT_PUBLIC_MEDIAMTX_URL to your Cloudflared tunnel base URL
// e.g. https://your-tunnel.trycloudflare.com
const MEDIAMTX_BASE = process.env.NEXT_PUBLIC_MEDIAMTX_URL ?? 'http://localhost:8889'
const STREAM_PATH   = process.env.NEXT_PUBLIC_CAMERA_PATH   ?? 'camera'

async function sendPTZ(command: string) {
  await fetch('https://printer.bossque.my/api/ptz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  })
}

// ─── MediaMTX WHEP WebRTC helper ─────────────────────────────────────────────
// MediaMTX exposes a WHEP endpoint at /<path>/whep
// We do the SDP offer/answer exchange to get a real peer connection.
async function startWebRTC(
  videoEl: HTMLVideoElement,
  onStatusChange: (s: 'connecting' | 'connected' | 'failed') => void
): Promise<RTCPeerConnection> {
  onStatusChange('connecting')

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  })

  // We only want to receive video (and optionally audio)
  pc.addTransceiver('video', { direction: 'recvonly' })
  pc.addTransceiver('audio', { direction: 'recvonly' })

  pc.ontrack = (evt) => {
    if (evt.track.kind === 'video') {
      videoEl.srcObject = evt.streams[0]
    }
  }

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected') onStatusChange('connected')
    if (pc.connectionState === 'failed')    onStatusChange('failed')
  }

  // Create offer
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)

  // Wait for ICE gathering to complete (keeps things simple vs. trickle ICE)
  await new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') { resolve(); return }
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') resolve()
    }
    // Fallback timeout — send what we have after 3 s
    setTimeout(resolve, 3000)
  })

  // Send SDP offer to MediaMTX WHEP endpoint
  const whepUrl = `${MEDIAMTX_BASE}/${STREAM_PATH}/whep`
  const res = await fetch(whepUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/sdp' },
    body: pc.localDescription!.sdp,
  })

  if (!res.ok) throw new Error(`WHEP offer rejected: ${res.status}`)

  const answerSdp = await res.text()
  await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

  return pc
}

export default function CameraModal({ onClose, onCapture }: CameraModalProps) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const pcRef       = useRef<RTCPeerConnection | null>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)

  const [status,    setStatus]    = useState<'connecting' | 'connected' | 'failed'>('connecting')
  const [capturing, setCapturing] = useState(false)
  const [captured,  setCaptured]  = useState(false)

  // ─── Digital zoom ─────────────────────────────────────────────────────────
  // zoomLevel: 1.0 = no zoom, 4.0 = 4× crop
  const MIN_ZOOM = 1.0
  const MAX_ZOOM = 4.0
  const ZOOM_STEP = 0.5
  const [zoomLevel, setZoomLevel] = useState(1.0)

  const zoomIn  = useCallback(() => setZoomLevel(z => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(1))), [])
  const zoomOut = useCallback(() => setZoomLevel(z => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(1))), [])

  // ─── Start WebRTC on mount, tear down on unmount ──────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let cancelled = false

    startWebRTC(video, setStatus)
      .then((pc) => { if (!cancelled) pcRef.current = pc })
      .catch((err) => {
        console.error('[WebRTC] Failed to connect:', err)
        if (!cancelled) setStatus('failed')
      })

    return () => {
      cancelled = true
      pcRef.current?.close()
      pcRef.current = null
    }
  }, [])

  // ─── PTZ ─────────────────────────────────────────────────────────────────
  const handlePTZStart = useCallback((direction: string) => { sendPTZ(direction) }, [])
  const handlePTZStop  = useCallback(() => { sendPTZ('stop') }, [])

  // ─── Snapshot — grab the live <video> frame directly via canvas ───────────
  // This is instant and requires no round-trip to the camera.
  const handleCapture = useCallback(async () => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    setCapturing(true)
    try {
      const vw = video.videoWidth  || 1280
      const vh = video.videoHeight || 720

      // Compute cropped source rect based on current digital zoom
      const cropW = vw / zoomLevel
      const cropH = vh / zoomLevel
      const cropX = (vw - cropW) / 2
      const cropY = (vh - cropH) / 2

      // Output canvas keeps full native resolution
      canvas.width  = vw
      canvas.height = vh
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, vw, vh)

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
          'image/jpeg',
          0.92
        )
      )

      const file = new File([blob], `cctv-capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
      onCapture(file)
      setCaptured(true)
      setTimeout(() => setCaptured(false), 2000)
    } catch (err) {
      console.error('[Snapshot] Error:', err)
      // Fall back to server-side ONVIF snapshot — pass zoomLevel so the
      // server can apply the same centred crop via sharp before returning.
      try {
        const res = await fetch('/api/camera/snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zoomLevel }),
        })
        if (!res.ok) throw new Error('Server snapshot failed')
        const blob = await res.blob()
        const file = new File([blob], `cctv-capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
        onCapture(file)
        setCaptured(true)
        setTimeout(() => setCaptured(false), 2000)
      } catch (fallbackErr) {
        console.error('[Snapshot fallback] Error:', fallbackErr)
      }
    } finally {
      setCapturing(false)
    }
  }, [onCapture, zoomLevel])

  // ─── PTZ button ───────────────────────────────────────────────────────────
  const PTZBtn = ({
    direction, children, className = '',
  }: { direction: string; children: React.ReactNode; className?: string }) => (
    <button
      type="button"
      onPointerDown={() => handlePTZStart(direction)}
      onPointerUp={handlePTZStop}
      onPointerLeave={handlePTZStop}
      className={`flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 text-white rounded-xl p-3 select-none transition-colors touch-none ${className}`}
    >
      {children}
    </button>
  )

  // ─── Connection badge ──────────────────────────────────────────────────────
  const StatusBadge = () => {
    const map = {
      connecting: { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: 'Menyambung…',  cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      connected:  { icon: <Wifi    className="w-3 h-3" />,              label: 'Langsung',      cls: 'bg-green-500/20  text-green-400  border-green-500/30'  },
      failed:     { icon: <WifiOff className="w-3 h-3" />,              label: 'Tiada Isyarat', cls: 'bg-red-500/20    text-red-400    border-red-500/30'    },
    }
    const s = map[status]
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[11px] font-semibold ${s.cls}`}>
        {s.icon}{s.label}
      </span>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-3xl p-6 w-full max-w-2xl border border-zinc-700 shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-white font-bold text-lg">Paparan Langsung Kamera</h3>
            <StatusBadge />
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live WebRTC Video */}
        <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden mb-3 relative ring-1 ring-zinc-700" style={{ isolation: 'isolate' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain transition-transform duration-150"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
          />

          {/* Connecting overlay */}
          {status === 'connecting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
              <span className="text-zinc-400 text-sm">Menyambung ke kamera…</span>
            </div>
          )}

          {/* Failed overlay */}
          {status === 'failed' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
              <WifiOff className="w-8 h-8 text-red-400" />
              <span className="text-zinc-400 text-sm">Gagal menyambung ke kamera</span>
              <button
                type="button"
                onClick={() => { window.location.reload() }}
                className="mt-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded-xl transition-colors"
              >
                Cuba Semula
              </button>
            </div>
          )}

          {/* Capture flash */}
          {captured && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/20 rounded-2xl pointer-events-none">
              <span className="text-white font-black text-xl drop-shadow">📸 Gambar Diambil!</span>
            </div>
          )}
        </div>

        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Arahan — above the controls */}
        <div className="mb-3 px-1 text-zinc-500 text-xs leading-relaxed grid grid-cols-3 gap-x-4">
          <p><span className="text-zinc-300 font-semibold">Tahan</span> mana-mana arah untuk pan/tilt berterusan — lepas untuk berhenti.</p>
          <p><span className="text-zinc-300 font-semibold">Tengah</span> untuk ambil gambar dari siaran langsung.</p>
          <p><span className="text-zinc-300 font-semibold">+/−</span> zum digital sehingga 4× — gambar akan dipotong mengikut zum.</p>
        </div>

        {/* Controls */}
        <div className="flex gap-4 items-center">

          {/* D-Pad */}
          <div className="grid grid-cols-3 gap-1.5 flex-shrink-0">
            <div />
            <PTZBtn direction="up"><ChevronUp className="w-5 h-5" /></PTZBtn>
            <div />

            <PTZBtn direction="left"><ChevronLeft className="w-5 h-5" /></PTZBtn>

            {/* Centre: Capture */}
            <button
              type="button"
              onClick={handleCapture}
              disabled={capturing || status !== 'connected'}
              className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl p-3 transition-colors shadow-lg shadow-blue-500/30"
              title="Ambil gambar"
            >
              {capturing
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <Aperture className="w-5 h-5" />
              }
            </button>

            <PTZBtn direction="right"><ChevronRight className="w-5 h-5" /></PTZBtn>

            <div />
            <PTZBtn direction="down"><ChevronDown className="w-5 h-5" /></PTZBtn>
            <div />
          </div>

          {/* Digital zoom column */}
          <div className="flex flex-col gap-1.5 flex-shrink-0 items-center">
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoomLevel >= MAX_ZOOM}
              className="flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl p-3 select-none transition-colors"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <span className="text-zinc-400 text-[11px] font-mono font-semibold tabular-nums">
              {zoomLevel.toFixed(1)}×
            </span>
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoomLevel <= MIN_ZOOM}
              className="flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl p-3 select-none transition-colors"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
          </div>

          {/* Spacer so controls stay left-aligned */}
          <div className="flex-1" />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors text-sm font-semibold"
        >
          Tutup
        </button>
      </div>
    </div>
  )
}