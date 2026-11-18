import { useEffect, useRef, useState } from 'react'
import { BarcodeDetector as ZXingDetector, prepareZXingModule } from 'barcode-detector/ponyfill'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

// El lector se sirve desde nuestra propia web (funciona sin depender de un CDN)
prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
  },
})

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'] as const

interface Detector { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> }

/** Android/Chrome trae lector nativo (más rápido); iPhone usa el lector WebAssembly */
async function createDetector(): Promise<Detector> {
  const Native = (globalThis as unknown as { BarcodeDetector?: { new (o: unknown): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats()
      if (supported.includes('ean_13')) return new Native({ formats: FORMATS.filter((f) => supported.includes(f)) })
    } catch { /* usamos el de respaldo */ }
  }
  return new ZXingDetector({ formats: [...FORMATS] })
}

interface Props {
  onDetected: (code: string) => void
  onClose: () => void
  title?: string
}

export default function BarcodeScanner({ onDetected, onClose, title = 'Escanea el código de barras' }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const [torch, setTorch] = useState<boolean | null>(null) // null = no disponible
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const doneRef = useRef(false)
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected

  useEffect(() => {
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    let last = 0

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador no permite usar la cámara. Abre la app con https:// o escribe el código abajo.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
      } catch {
        setError('No hay permiso para usar la cámara. Actívalo en los ajustes del navegador o escribe el código abajo.')
        return
      }
      if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }
      const track = stream.getVideoTracks()[0]
      trackRef.current = track
      const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean }
      if (caps.torch) setTorch(false)

      const video = videoRef.current!
      video.srcObject = stream
      await video.play().catch(() => {})
      const detector = await createDetector()

      const tick = async (t: number) => {
        if (stopped || doneRef.current) return
        if (t - last > 180 && video.readyState >= 2) {
          last = t
          try {
            const codes = await detector.detect(video)
            const code = codes.find((c) => /^\d{6,14}$/.test(c.rawValue) || c.rawValue.length >= 4)?.rawValue
            if (code && !doneRef.current) {
              doneRef.current = true
              navigator.vibrate?.(60)
              onDetectedRef.current(code)
              return
            }
          } catch { /* fotograma ilegible: seguimos */ }
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    start()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function toggleTorch() {
    const track = trackRef.current
    if (!track || torch === null) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] })
      setTorch(!torch)
    } catch { setTorch(null) }
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault()
    const code = manual.replace(/\s/g, '')
    if (code.length >= 4 && !doneRef.current) {
      doneRef.current = true
      onDetected(code)
    }
  }

  return (
    <div className="scanner" role="dialog" aria-modal="true">
      <div className="scanner-top">
        <button className="icon-btn light" onClick={onClose} aria-label="Cerrar">✕</button>
        <span>{title}</span>
        {torch !== null ? (
          <button className="icon-btn light" onClick={toggleTorch} aria-label="Linterna">{torch ? '🔦' : '💡'}</button>
        ) : <span style={{ width: 44 }} />}
      </div>
      <div className="scanner-view">
        {error ? <p className="scanner-error">{error}</p> : (
          <>
            <video ref={videoRef} playsInline muted />
            <div className="scanner-frame"><div className="scanner-line" /></div>
          </>
        )}
      </div>
      <form className="scanner-manual" onSubmit={submitManual}>
        <input
          inputMode="numeric"
          placeholder="…o escribe el código"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <button className="btn primary" type="submit" disabled={manual.replace(/\s/g, '').length < 4}>OK</button>
      </form>
    </div>
  )
}
