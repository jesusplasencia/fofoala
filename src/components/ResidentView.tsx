import { useMutation } from '@tanstack/react-query'
import {
  ArrowLeft,
  Bike,
  CarTaxiFront,
  Check,
  Clock,
  Copy,
  Download,
  Home,
  Loader2,
  LogOut,
  PlusCircle,
  Share2,
  Sparkles,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import {
  type AuthSession,
  type GuestPassResponse,
  koloalaApi,
  type PassType,
} from '../lib/api'
import { generatePassCardBlob, generateQrDataUrl } from '../lib/passCard'

interface ResidentViewProps {
  session: AuthSession
  onLogout: () => void
}

const PASS_OPTIONS: Array<{
  type: PassType
  title: string
  subtitle: string
  ttlText: string
  icon: typeof Bike
  colorClass: string
}> = [
  {
    type: 'DELIVERY',
    title: 'Pedir Delivery',
    subtitle: 'PedidosYa, Rappi, Gas o Farmacia',
    ttlText: 'Válido por 45 minutos',
    icon: Bike,
    colorClass: 'from-amber-500 to-orange-600 shadow-orange-500/20',
  },
  {
    type: 'TAXI',
    title: 'Viene un Taxi',
    subtitle: 'Uber, InDrive, Cabify o Movilidad',
    ttlText: 'Válido por 30 minutos',
    icon: CarTaxiFront,
    colorClass: 'from-sky-500 to-blue-600 shadow-blue-500/20',
  },
  {
    type: 'GUEST',
    title: 'Invitado / Visita',
    subtitle: 'Familiar, amistad o técnico a domicilio',
    ttlText: 'Válido por 8 horas',
    icon: Users,
    colorClass: 'from-emerald-600 to-teal-700 shadow-emerald-600/20',
  },
]

export function ResidentView({ session, onLogout }: ResidentViewProps) {
  const [visitorNote, setVisitorNote] = useState('')
  const [activePass, setActivePass] = useState<GuestPassResponse | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [sharingImage, setSharingImage] = useState(false)

  const createPassMutation = useMutation({
    mutationFn: (passType: PassType) => koloalaApi.createPass(passType, visitorNote),
    onSuccess: async (data) => {
      setActivePass(data)
      setCopied(false)
      setDownloaded(false)
      const qrUrl = await generateQrDataUrl(data)
      setQrDataUrl(qrUrl)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
  })

  const handleBackToMain = () => {
    setActivePass(null)
    setQrDataUrl(null)
    setVisitorNote('')
    createPassMutation.reset()
  }

  const handleCopyCode = async () => {
    if (!activePass) return
    await navigator.clipboard.writeText(activePass.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleDownloadQrCard = async () => {
    if (!activePass) return
    const blob = await generatePassCardBlob(activePass)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Pase-${activePass.villa_id}-${activePass.lot_id}-${activePass.code}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 3000)
  }

  const handleSharePassWithQr = async () => {
    if (!activePass) return
    setSharingImage(true)
    try {
      const typeLabel =
        activePass.pass_type === 'DELIVERY'
          ? 'Delivery'
          : activePass.pass_type === 'TAXI'
            ? 'Taxi'
            : 'Visita'
      const text =
        `Hola, te comparto tu pase QR de ingreso a *${activePass.villa_id}* (Casa *${activePass.lot_id}*):\n\n` +
        `🔑 Código de Garita: *${activePass.code}*\n` +
        `📌 Tipo: ${typeLabel}\n` +
        `🪪 Muestra este QR y tu DNI en garita al ingresar.`

      const blob = await generatePassCardBlob(activePass)
      const fileName = `Pase-${activePass.villa_id}-${activePass.lot_id}-${activePass.code}.png`
      const file = new File([blob], fileName, { type: 'image/png' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Pase ${activePass.villa_id} - Casa ${activePass.lot_id}`,
          text,
          files: [file],
        })
        return
      }

      await handleDownloadQrCard()
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    } catch {
      // ignore cancelled share sheet
    } finally {
      setSharingImage(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      {/* Header Residente (El botón de la casa también lleva siempre a la vista Principal) */}
      <header className="bg-emerald-900 text-white px-5 pt-6 pb-8 rounded-b-3xl shadow-lg">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={handleBackToMain}
            className="flex items-center gap-3 text-left group cursor-pointer"
            title="Ir a la pantalla principal"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-800 group-hover:bg-emerald-700 border border-emerald-600/50 flex items-center justify-center transition-colors">
              <Home className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                {session.villa_id} • Residente
              </span>
              <h1 className="text-2xl font-black tracking-tight">
                Casa {session.lot_id || session.username}
              </h1>
            </div>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="p-2.5 rounded-xl bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 -mt-4 space-y-5">
        {activePass ? (
          /* =====================================================================
             VISTA 2 (EXCLUSIVA Y MINIMALISTA): PASE QR ACTIVO GENERADO
             No muestra el formulario ni los botones de abajo al hacer scroll.
             ===================================================================== */
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xl border-2 border-emerald-500">
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
                <Sparkles className="w-3.5 h-3.5" />
                PASE QR ACTIVO ({activePass.pass_type})
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                Expira{' '}
                {new Date(activePass.expires_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            {qrDataUrl && (
              <div className="my-3 flex flex-col items-center justify-center bg-slate-50 border-2 border-dashed border-emerald-200 rounded-2xl p-4">
                <img
                  src={qrDataUrl}
                  alt={`QR Pase ${activePass.code}`}
                  className="w-52 h-52 rounded-xl shadow-sm bg-white p-2"
                />
                <span className="text-[11px] font-bold text-slate-500 mt-2">
                  Escaneable en Garita {activePass.villa_id} • Casa {activePass.lot_id}
                </span>
              </div>
            )}

            <div className="my-3 py-3.5 px-4 rounded-2xl bg-slate-900 text-white text-center">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
                Código de Respaldo Manual
              </div>
              <div className="text-4xl font-black tracking-[0.25em] pl-3 text-emerald-400 font-mono">
                {activePass.code}
              </div>
              {activePass.visitor_info && (
                <p className="text-xs text-slate-300 mt-1 font-medium">
                  Nota: {activePass.visitor_info}
                </p>
              )}
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={sharingImage}
                onClick={handleSharePassWithQr}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                {sharingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                Compartir Imagen QR (WhatsApp / Taxi / Visita)
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadQrCard}
                  className="py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {downloaded ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      ¡Guardado!
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-emerald-400" />
                      Guardar QR en Teléfono
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="py-3 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      ¡Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar Código
                    </>
                  )}
                </button>
              </div>

              {/* Botón limpio para volver a la Principal y generar otro QR */}
              <div className="pt-2 border-t border-slate-100 mt-3">
                <button
                  type="button"
                  onClick={handleBackToMain}
                  className="w-full py-3.5 px-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 text-emerald-700" />
                  Ir a Principal / Generar otro Pase QR
                  <PlusCircle className="w-4 h-4 text-emerald-700" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* =====================================================================
             VISTA 1 (PRINCIPAL): NOTA OPCIONAL + LOS 3 BOTONES GIGANTES
             ===================================================================== */
          <>
            {createPassMutation.isError && (
              <div className="bg-red-50 border-2 border-red-300 text-red-800 rounded-2xl p-4 text-sm font-semibold">
                {createPassMutation.error instanceof Error
                  ? createPassMutation.error.message
                  : 'No se pudo generar el pase.'}
              </div>
            )}

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Nota opcional (Empresa o Nombre del visitante)
              </label>
              <input
                type="text"
                maxLength={80}
                placeholder="Ej. PedidosYa, Uber, Tío Carlos..."
                value={visitorNote}
                onChange={(e) => setVisitorNote(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="space-y-3.5">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 px-1">
                Toca una opción para generar tu Pase QR al instante:
              </h2>

              {PASS_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const isPending =
                  createPassMutation.isPending && createPassMutation.variables === opt.type
                return (
                  <button
                    key={opt.type}
                    type="button"
                    disabled={createPassMutation.isPending}
                    onClick={() => createPassMutation.mutate(opt.type)}
                    className={`w-full p-5 rounded-3xl bg-gradient-to-r ${opt.colorClass} text-white shadow-lg active:scale-[0.98] transition-all flex items-center gap-4 text-left disabled:opacity-60 cursor-pointer`}
                  >
                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                      {isPending ? (
                        <Loader2 className="w-8 h-8 animate-spin" />
                      ) : (
                        <Icon className="w-8 h-8" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-xl font-black tracking-tight">{opt.title}</div>
                      <div className="text-white/90 text-xs font-medium mt-0.5">{opt.subtitle}</div>
                      <div className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-black/20 text-[11px] font-bold">
                        ⏱ {opt.ttlText}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
