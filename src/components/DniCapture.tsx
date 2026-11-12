import { Camera, Loader2, ScanText, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { type DniData, parseDniMrz } from '../lib/mrz'
import { Alert, Button } from './ui'

interface Props {
  onResult: (data: DniData) => void
  onClose: () => void
}

/**
 * Cámara dentro de la app para fotografiar el REVERSO del DNI.
 * La imagen solo vive en memoria mientras se lee (OCR en el teléfono) y luego se descarta:
 * nunca se sube al servidor ni se guarda en la galería.
 */
export function DniCapture({ onResult, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<'starting' | 'ready' | 'reading' | 'error'>('starting')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  useEffect(() => {
    let cancelled = false
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        setStatus('ready')
      })
      .catch(() => {
        setStatus('error')
        setError('No se pudo abrir la cámara. Da permiso al navegador o escribe los datos a mano.')
      })
    return () => {
      cancelled = true
      stop()
    }
  }, [])

  const capture = async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    setStatus('reading')
    setError(null)
    setProgress(0)

    // Recortamos la franja inferior (donde está la zona MRZ <<<), en escala de grises y con contraste.
    const vw = video.videoWidth
    const vh = video.videoHeight
    const cropY = Math.round(vh * 0.5)
    const cropH = vh - cropY
    const scale = Math.min(2, 1600 / vw)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(vw * scale)
    canvas.height = Math.round(cropH * scale)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.filter = 'grayscale(1) contrast(1.8) brightness(1.1)'
    ctx.drawImage(video, 0, cropY, vw, cropH, 0, 0, canvas.width, canvas.height)

    try {
      const { createWorker, PSM } = await import('tesseract.js')
      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100))
        },
      })
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      })
      const { data } = await worker.recognize(canvas)
      await worker.terminate()
      const parsed = parseDniMrz(data.text)
      if (!parsed || !parsed.doc_number || !parsed.last_names) {
        setStatus('ready')
        setError('No pudimos leer el DNI. Acerca el reverso, evita reflejos y vuelve a intentar, o escribe los datos.')
        return
      }
      stop()
      onResult(parsed)
    } catch {
      setStatus('ready')
      setError('No se pudo procesar la foto. Intenta de nuevo o escribe los datos a mano.')
    } finally {
      // Descartamos la imagen de inmediato
      canvas.width = 0
      canvas.height = 0
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" role="dialog" aria-modal="true" aria-label="Fotografiar reverso del DNI">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-extrabold flex items-center gap-2">
          <ScanText className="w-5 h-5 text-gold-300" /> Reverso del DNI
        </span>
        <button
          type="button"
          onClick={() => {
            stop()
            onClose()
          }}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 cursor-pointer"
          aria-label="Cerrar cámara"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
          <div className="w-full max-w-md aspect-[1.58] rounded-2xl border-4 border-gold-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] relative">
            <div className="absolute inset-x-3 bottom-3 h-[38%] rounded-lg border-2 border-dashed border-pine-300 flex items-end justify-center pb-1">
              <span className="text-[11px] font-black text-pine-200 bg-black/50 px-2 rounded">Las 3 líneas con &lt;&lt;&lt; aquí</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 bg-pine-950">
        {error && <Alert tone="warn">{error}</Alert>}
        <p className="text-center text-xs font-semibold text-white/70">
          La foto se lee en este teléfono y se descarta. No se guarda ni se envía.
        </p>
        <Button size="lg" variant="gold" className="w-full" onClick={capture} disabled={status !== 'ready'}>
          {status === 'reading' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Leyendo… {progress}%
            </>
          ) : (
            <>
              <Camera className="w-5 h-5" /> Capturar y leer
            </>
          )}
        </Button>
      </div>
    </div>,
    document.body,
  )
}
