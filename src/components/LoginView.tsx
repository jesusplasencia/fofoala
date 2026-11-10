import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  Loader2,
  Phone,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'
import { type FormEvent, useState } from 'react'
import {
  type AuthSession,
  detectVillaId,
  getVillaDisplayName,
  koloalaApi,
  saveSession,
} from '../lib/api'

interface LoginViewProps {
  onLoginSuccess: (session: AuthSession) => void
}

type LoginStep = 'IDENTIFY_LOT' | 'ACTIVATE_WHATSAPP' | 'ENTER_PASSWORD'

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const villaId = detectVillaId()
  const villaName = getVillaDisplayName(villaId)

  const [step, setStep] = useState<LoginStep>('IDENTIFY_LOT')
  const [username, setUsername] = useState('')
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [maskedPhoneHint, setMaskedPhoneHint] = useState<string | null>(null)
  const [phoneInput, setPhoneInput] = useState('')
  const [password, setPassword] = useState('')
  const [pinSentNotice, setPinSentNotice] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleResetToStep1 = () => {
    setStep('IDENTIFY_LOT')
    setPassword('')
    setPhoneInput('')
    setPinSentNotice(null)
    setError(null)
  }

  // Paso 1: Ingresar solo el Lote (ej. P21) o Usuario (ADMIN / GUARDIA1)
  const handleLookupSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return

    setLoading(true)
    setError(null)
    try {
      const lookup = await koloalaApi.lookupUser(username.trim().toUpperCase(), villaId)
      setUsername(lookup.username)
      setOwnerName(lookup.owner_name)
      setMaskedPhoneHint(lookup.masked_phone_hint)

      if (lookup.status === 'NEEDS_PHONE_ACTIVATION') {
        setStep('ACTIVATE_WHATSAPP')
      } else {
        setStep('ENTER_PASSWORD')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se encontró el lote indicado')
    } finally {
      setLoading(false)
    }
  }

  // Paso 2A (Solo primera vez): Confirmar WhatsApp para recibir el PIN generado en el acto
  const handleActivatePinSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!phoneInput.trim()) return

    setLoading(true)
    setError(null)
    try {
      const res = await koloalaApi.activateLotPin(username, phoneInput.trim(), villaId)
      setPinSentNotice(res.message)
      setStep('ENTER_PASSWORD')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo verificar el número de WhatsApp')
    } finally {
      setLoading(false)
    }
  }

  // Paso 2B: Ingresar el PIN de 8 dígitos o contraseña
  const handlePasswordLoginSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return

    setLoading(true)
    setError(null)
    try {
      const session = await koloalaApi.login(username, password, villaId)
      saveSession(session)
      onLoginSuccess(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-gradient-to-b from-emerald-950 via-emerald-900 to-slate-900">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-emerald-100">
        {/* Cabecera Oficial de la Villa (Fija por Subdominio) */}
        <div className="bg-emerald-900 px-6 py-7 text-white text-center relative">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-800/90 border border-emerald-600/40 mb-3 shadow-inner">
            <ShieldCheck className="w-8 h-8 text-emerald-300" />
          </div>
          <div className="mb-1">
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-800 border border-emerald-600/60 text-[11px] font-black uppercase tracking-widest text-emerald-300">
              PORTAL OFICIAL • {villaId}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1">{villaName}</h1>
          <p className="text-emerald-200 text-sm mt-1">
            Control Inteligente de Garita y Residentes
          </p>
        </div>

        {/* PASO 1: IDENTIFICAR LOTE O USUARIO */}
        {step === 'IDENTIFY_LOT' && (
          <form onSubmit={handleLookupSubmit} className="p-6 sm:p-8 space-y-5">
            {error && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Ingresa tu Manzana y Lote (o Usuario)
              </label>
              <div className="relative">
                <Building2 className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoFocus
                  autoCapitalize="characters"
                  placeholder="Ej. P20, P21 o GUARDIA1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toUpperCase())}
                  className="w-full pl-12 pr-4 py-4 text-lg font-bold tracking-wide bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-extrabold text-lg shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Consultando...
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        )}

        {/* PASO 2A: PRIMER INGRESO DEL VECINO -> CONFIRMAR WHATSAPP Y RECIBIR PIN */}
        {step === 'ACTIVATE_WHATSAPP' && (
          <form onSubmit={handleActivatePinSubmit} className="p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                  Primera Activación • Casa {username}
                </span>
                <strong className="text-sm font-black text-slate-900">
                  {ownerName || `Lote ${username}`}
                </strong>
              </div>
              <button
                type="button"
                onClick={handleResetToStep1}
                className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Cambiar
              </button>
            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Confirma tu número de WhatsApp registrado
              </label>
              {maskedPhoneHint && (
                <p className="text-xs text-slate-500 mb-2">
                  Por seguridad, escribe tu número celular terminado en{' '}
                  <strong className="font-mono text-slate-800">{maskedPhoneHint}</strong> para
                  enviarte tu PIN de 8 dígitos por WhatsApp:
                </p>
              )}
              <div className="relative">
                <Phone className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  autoFocus
                  inputMode="numeric"
                  placeholder="Ej. 987654321"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 text-lg font-bold font-mono tracking-wider bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando PIN por WhatsApp...
                </>
              ) : (
                'Enviar mi PIN por WhatsApp'
              )}
            </button>
          </form>
        )}

        {/* PASO 2B: INGRESAR PIN DE 8 DÍGITOS / CONTRASEÑA */}
        {step === 'ENTER_PASSWORD' && (
          <form onSubmit={handlePasswordLoginSubmit} className="p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Ingresando como
                </span>
                <strong className="text-base font-black text-slate-900">
                  {username} {ownerName ? `• ${ownerName}` : ''}
                </strong>
              </div>
              <button
                type="button"
                onClick={handleResetToStep1}
                className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Cambiar
              </button>
            </div>

            {pinSentNotice && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{pinSentNotice}</span>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                PIN de 8 dígitos / Contraseña
              </label>
              <div className="relative">
                <KeyRound className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 text-lg font-bold tracking-widest bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-extrabold text-lg shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <UserCheck className="w-6 h-6" />
                  Ingresar a {villaName}
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-400 pt-1">
              Tu sesión quedará guardada automáticamente por 30 días en este dispositivo.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
