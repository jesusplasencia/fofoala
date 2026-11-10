import { useMutation } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CarFront,
  CheckCircle2,
  IdCard,
  KeySquare,
  Loader2,
  LogOut,
  RotateCcw,
  Shield,
  XCircle,
} from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import {
  type AuthSession,
  koloalaApi,
  type PassVerificationResponse,
} from '../lib/api'
import { extractPassCodeFromScannedText } from '../lib/passCard'

interface GuardViewProps {
  session: AuthSession
  onLogout: () => void
}

export function GuardView({ session, onLogout }: GuardViewProps) {
  const [code, setCode] = useState('')
  const [dni, setDni] = useState('')
  const [plate, setPlate] = useState('')
  const [result, setResult] = useState<PassVerificationResponse | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const dniInputRef = useRef<HTMLInputElement | null>(null)

  const verifyMutation = useMutation({
    mutationFn: () => koloalaApi.verifyPass(code, dni, plate),
    onSuccess: (data) => {
      setResult(data)
    },
  })

  const stopCameraScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop()
        }
        scannerRef.current.clear()
      } catch {
        // ignore stop errors
      }
      scannerRef.current = null
    }
    setScannerOpen(false)
  }

  const startCameraScanner = async () => {
    setCameraError(null)
    setScannerOpen(true)

    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode('koloala-qr-reader')
        scannerRef.current = html5QrCode
        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: { width: 230, height: 230 },
          },
          async (decodedText) => {
            const parsedCode = extractPassCodeFromScannedText(decodedText)
            if (parsedCode.length === 6) {
              setCode(parsedCode)
              await stopCameraScanner()
              setTimeout(() => dniInputRef.current?.focus(), 100)
            }
          },
          () => {
            // frame scan miss
          },
        )
      } catch {
        setCameraError(
          'No se pudo abrir la cámara. Asegúrate de dar permiso de cámara al navegador o escribe los 6 dígitos manualmente.',
        )
        setScannerOpen(false)
      }
    }, 80)
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (code.trim().length !== 6 || dni.trim().length < 8) return
    verifyMutation.mutate()
  }

  const handleClearForNext = () => {
    setCode('')
    setDni('')
    setPlate('')
    setResult(null)
    verifyMutation.reset()
  }

  const isMissingPlateWarning =
    result && !result.authorized && result.message.toUpperCase().includes('FALTA PLACA')

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-12">
      {/* Cabecera de Garita de Alto Contraste */}
      <header className="bg-slate-950 border-b border-slate-800 px-5 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400">
                GARITA OFICIAL • {session.villa_id}
              </span>
              <h1 className="text-lg font-black">Vigilante: {session.username}</h1>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-5 space-y-5">
        {/* SEMÁFORO DE RESULTADO DE GARITA */}
        {result && (
          <div
            className={`rounded-3xl p-6 border-4 shadow-2xl transition-all ${
              result.authorized
                ? 'bg-emerald-950 border-emerald-400 text-emerald-50'
                : isMissingPlateWarning
                  ? 'bg-amber-950 border-amber-400 text-amber-50'
                  : 'bg-red-950 border-red-500 text-red-50'
            }`}
          >
            <div className="flex items-start gap-4">
              {result.authorized ? (
                <CheckCircle2 className="w-14 h-14 text-emerald-400 shrink-0" />
              ) : isMissingPlateWarning ? (
                <AlertTriangle className="w-14 h-14 text-amber-400 shrink-0" />
              ) : (
                <XCircle className="w-14 h-14 text-red-400 shrink-0" />
              )}

              <div className="flex-1">
                <div className="text-xs font-black uppercase tracking-widest opacity-80">
                  {result.authorized
                    ? 'PASE VÁLIDO • ABRIR TRANQUERA'
                    : isMissingPlateWarning
                      ? 'RETENER VEHÍCULO • COMPLETAR PLACA ABAJO'
                      : 'ACCESO DENEGADO • NO ABRIR'}
                </div>
                <h2 className="text-xl font-black mt-1 leading-snug">{result.message}</h2>

                {result.lot_id && (
                  <div className="mt-4 pt-3 border-t border-white/15 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-xs opacity-70 block">Destino:</span>
                      <strong className="text-lg font-black">
                        {result.villa_id}-{result.lot_id}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs opacity-70 block">Familia / Propietario:</span>
                      <strong className="font-bold">{result.owner_name || 'Registrado'}</strong>
                    </div>
                    {result.checked_in_dni && (
                      <div>
                        <span className="text-xs opacity-70 block">DNI Registrado:</span>
                        <strong className="font-mono">{result.checked_in_dni}</strong>
                      </div>
                    )}
                    {result.checked_in_plate && (
                      <div>
                        <span className="text-xs opacity-70 block">Placa Registrada:</span>
                        <strong className="font-mono">{result.checked_in_plate}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {result.authorized && (
              <button
                type="button"
                onClick={handleClearForNext}
                className="mt-5 w-full py-3.5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-black text-base flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" />
                Listo — Siguiente Vehículo / Visita
              </button>
            )}
          </div>
        )}

        {verifyMutation.isError && (
          <div className="p-4 rounded-2xl bg-red-900/60 border-2 border-red-400 text-red-100 font-bold text-sm">
            {verifyMutation.error instanceof Error
              ? verifyMutation.error.message
              : 'Error al verificar el código'}
          </div>
        )}

        {cameraError && (
          <div className="p-4 rounded-2xl bg-amber-900/60 border border-amber-400 text-amber-100 text-xs font-semibold">
            {cameraError}
          </div>
        )}

        {/* Visor de Cámara Lector QR para Garita */}
        {scannerOpen && (
          <div className="bg-slate-950 border-2 border-emerald-400 rounded-3xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Apunta la cámara al QR del visitante / conductor
              </span>
              <button
                type="button"
                onClick={stopCameraScanner}
                className="px-3 py-1 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <CameraOff className="w-3.5 h-3.5" />
                Cerrar Cámara
              </button>
            </div>
            <div
              id="koloala-qr-reader"
              className="w-full overflow-hidden rounded-2xl bg-black min-h-[250px]"
            />
          </div>
        )}

        {/* Formulario de Control de Garita */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-800/90 border border-slate-700 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl"
        >
          {/* Botón grande de Escanear QR con Cámara */}
          {!scannerOpen && (
            <button
              type="button"
              onClick={startCameraScanner}
              className="w-full py-4 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Camera className="w-6 h-6" />
              ESCANEAR QR CON CÁMARA
            </button>
          )}

          {/* 1. Código de 6 caracteres (se llena solo al escanear el QR o a mano) */}
          <div>
            <label className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-400 mb-2">
              <KeySquare className="w-4 h-4" />
              1. Código de Pase (Se llena al escanear QR o manual)
            </label>
            <input
              type="text"
              required
              maxLength={6}
              autoCapitalize="characters"
              placeholder="EJ: 9X4K2M"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
              className="w-full py-4 px-4 text-center text-3xl font-black tracking-[0.3em] font-mono uppercase rounded-2xl bg-slate-950 border-2 border-slate-600 focus:border-emerald-400 focus:outline-none text-white"
            />
          </div>

          {/* 2. DNI Obligatorio */}
          <div>
            <label className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-sky-400 mb-2">
              <IdCard className="w-4 h-4" />
              2. DNI o Carnet del Visitante / Motorizado (Obligatorio)
            </label>
            <input
              ref={dniInputRef}
              type="text"
              required
              inputMode="numeric"
              minLength={8}
              maxLength={12}
              placeholder="Ej. 45891230"
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/[^0-9A-Za-z]/g, ''))}
              className="w-full py-3.5 px-4 text-xl font-bold font-mono rounded-2xl bg-slate-950 border-2 border-slate-600 focus:border-sky-400 focus:outline-none text-white"
            />
          </div>

          {/* 3. Placa del Vehículo */}
          <div>
            <label className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-400 mb-2">
              <CarFront className="w-4 h-4" />
              3. Placa del Vehículo (Obligatorio en Taxi y Delivery)
            </label>
            <input
              type="text"
              maxLength={10}
              autoCapitalize="characters"
              placeholder="Ej. ABC-123 (Dejar vacío si entra a pie)"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              className="w-full py-3.5 px-4 text-xl font-bold font-mono uppercase rounded-2xl bg-slate-950 border-2 border-slate-600 focus:border-amber-400 focus:outline-none text-white"
            />
          </div>

          <div className="pt-1 flex gap-3">
            <button
              type="button"
              onClick={handleClearForNext}
              className="px-4 py-4 rounded-2xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-sm cursor-pointer"
            >
              Limpiar
            </button>

            <button
              type="submit"
              disabled={verifyMutation.isPending || code.length !== 6 || dni.length < 8}
              className="flex-1 py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-black text-lg shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {verifyMutation.isPending ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Verificando...
                </>
              ) : (
                'VERIFICAR INGRESO'
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
