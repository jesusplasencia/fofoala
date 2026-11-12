import { ArrowLeft, ArrowRight, Gift, Phone, Smartphone, Store, TreePine } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { type AuthSession, detectVillaId, getVillaDisplayName, koloalaApi, saveSession } from '../lib/api'
import { PasswordInput } from './PasswordInput'
import { Alert, Button, Garland, inputClass, Label, Snowfall } from './ui'

interface LoginViewProps {
  onLoginSuccess: (session: AuthSession) => void
}

type Step = 'IDENTIFY' | 'ACTIVATE' | 'PASSWORD' | 'NO_ACCOUNT'

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const villaId = detectVillaId()
  const villaName = getVillaDisplayName(villaId)

  const [step, setStep] = useState<Step>('IDENTIFY')
  const [username, setUsername] = useState('')
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [phoneInput, setPhoneInput] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setStep('IDENTIFY')
    setPassword('')
    setPhoneInput('')
    setNotice(null)
    setError(null)
  }

  const run = async (fn: () => Promise<void>, fallback: string) => {
    setLoading(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback)
    } finally {
      setLoading(false)
    }
  }

  const handleLookup = (e: FormEvent) => {
    e.preventDefault()
    const value = username.trim().replace(/\s+/g, '').toUpperCase()
    if (!value) return
    run(async () => {
      const lookup = await koloalaApi.lookupUser(value, villaId)
      setUsername(lookup.username)
      setOwnerName(lookup.owner_name)
      if (lookup.status === 'UNREGISTERED_NO_ACCOUNT') {
        setNotice(lookup.message)
        setStep('NO_ACCOUNT')
      } else if (lookup.status === 'NEEDS_PHONE_ACTIVATION') {
        if (/^\d{9}$/.test(lookup.username)) {
          // El usuario YA es su celular: enviamos el PIN directo, sin volver a pedir el número.
          const res = await koloalaApi.activateLotPin(lookup.username, villaId)
          setNotice(res.message)
          setStep('PASSWORD')
        } else {
          setStep('ACTIVATE')
        }
      } else {
        setStep('PASSWORD')
      }
    }, 'No encontramos ese número o usuario')
  }

  const handleActivate = (e: FormEvent) => {
    e.preventDefault()
    if (!phoneInput.trim()) return
    run(async () => {
      const res = await koloalaApi.activateLotPin(username, villaId, phoneInput.trim())
      setNotice(res.message)
      setStep('PASSWORD')
    }, 'No se pudo enviar el PIN por WhatsApp')
  }

  const handleLogin = (e: FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return
    run(async () => {
      const session = await koloalaApi.login(username, password, villaId)
      saveSession(session)
      onLoginSuccess(session)
    }, 'No se pudo iniciar sesión')
  }

  const Who = (
    <div className="flex items-center justify-between bg-pine-50 border-2 border-pine-100 rounded-2xl px-4 py-3">
      <div className="min-w-0">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-pine-700 block">Ingresando como</span>
        <strong className="text-base font-black text-pine-950 truncate block">
          {username} {ownerName ? `• ${ownerName}` : ''}
        </strong>
      </div>
      <button type="button" onClick={reset} className="text-xs font-extrabold text-berry-700 hover:underline flex items-center gap-1 cursor-pointer">
        <ArrowLeft className="w-3.5 h-3.5" />
        Cambiar
      </button>
    </div>
  )

  return (
    <div className="min-h-screen xmas-header flex flex-col justify-center items-center px-4 py-10 relative overflow-hidden">
      <Snowfall flakes={34} />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center text-white mb-5">
          <p className="font-festive text-4xl sm:text-5xl text-gold-300 drop-shadow">¡Felices Fiestas!</p>
          <p className="text-sm text-white/80 font-semibold mt-1">Portal oficial de garita y residentes</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl shadow-black/40 overflow-hidden">
          <div className="bg-berry-600 px-6 pt-6 pb-5 text-white text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/15 border border-gold-300/50 mb-2">
              <TreePine className="w-8 h-8 text-gold-300" />
            </div>
            <span className="block text-[11px] font-black uppercase tracking-[0.2em] text-gold-200">Portal oficial • {villaId}</span>
            <h1 className="text-2xl font-black tracking-tight mt-0.5">{villaName}</h1>
          </div>
          <Garland />

          <div className="p-6 sm:p-7 space-y-5">
            {error && <Alert tone="error">{error}</Alert>}

            {step === 'IDENTIFY' && (
              <form onSubmit={handleLookup} className="space-y-5">
                <div>
                  <Label htmlFor="login-user">Tu número de celular</Label>
                  <div className="relative">
                    <Smartphone className="w-5 h-5 text-pine-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-user"
                      required
                      autoFocus
                      autoComplete="username"
                      inputMode="tel"
                      placeholder="Ej. 916220518"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className={`${inputClass} pl-12 text-lg tracking-wide`}
                    />
                  </div>
                  <p className="text-[11px] text-pine-800/60 font-semibold mt-1.5">Personal de garita: usa tu usuario (ej. GUARDIA1).</p>
                </div>
                <Button type="submit" size="lg" className="w-full" loading={loading}>
                  Continuar
                  {!loading && <ArrowRight className="w-5 h-5" />}
                </Button>
                <a
                  href="/visita"
                  className="flex items-center justify-center gap-2 text-sm font-extrabold text-berry-700 hover:text-berry-800 hover:underline"
                >
                  <Store className="w-4 h-4" />
                  ¿Vienes de visita? Mira qué hay en la villa
                </a>
              </form>
            )}

            {step === 'NO_ACCOUNT' && (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-gold-100 flex items-center justify-center">
                  <Gift className="w-8 h-8 text-berry-600" />
                </div>
                <p className="text-pine-900 font-bold">
                  Este número no tiene cuenta.
                </p>
                <ul className="text-left text-sm font-semibold text-pine-900 space-y-2 bg-gold-50 border-2 border-gold-200 rounded-2xl p-4">
                  <li>🏠 Si visitas una casa, pide a tu anfitrión que te envíe su QR.</li>
                  <li>🪪 Si vas a un negocio o área común, acércate a la garita con tu DNI.</li>
                </ul>
                <a
                  href="/visita"
                  className="block w-full py-3 rounded-2xl bg-pine-50 hover:bg-pine-100 text-pine-800 border border-pine-200 font-extrabold"
                >
                  Ver negocios y áreas de la villa
                </a>
                <button type="button" onClick={reset} className="text-sm font-extrabold text-pine-700 hover:underline cursor-pointer">
                  Probar con otro número
                </button>
              </div>
            )}

            {step === 'ACTIVATE' && (
              <form onSubmit={handleActivate} className="space-y-5">
                {Who}
                <div>
                  <Label htmlFor="login-phone">Confirma tu WhatsApp para recibir tu PIN</Label>
                  <div className="relative">
                    <Phone className="w-5 h-5 text-pine-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-phone"
                      type="tel"
                      required
                      autoFocus
                      inputMode="numeric"
                      placeholder="Ej. 987654321"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className={`${inputClass} pl-12 text-lg font-mono tracking-wider`}
                    />
                  </div>
                </div>
                <Button type="submit" variant="berry" size="lg" className="w-full" loading={loading}>
                  Enviar mi PIN por WhatsApp
                </Button>
              </form>
            )}

            {step === 'PASSWORD' && (
              <form onSubmit={handleLogin} className="space-y-5">
                {Who}
                {notice && <Alert tone="success">{notice}</Alert>}
                <div>
                  <Label htmlFor="login-pin">PIN de WhatsApp o tu contraseña</Label>
                  <PasswordInput
                    id="login-pin"
                    label="PIN o contraseña"
                    value={password}
                    onChange={setPassword}
                    autoPaste
                  />
                  <p className="text-[11px] font-semibold text-pine-800/60 mt-1.5">
                    Copia el PIN del mensaje de WhatsApp y toca la caja: se pega solo.
                  </p>
                </div>
                <Button type="submit" size="lg" className="w-full" loading={loading}>
                  Ingresar a {villaName}
                </Button>
                <p className="text-center text-xs text-pine-800/50 font-semibold">Tu sesión queda guardada 30 días en este dispositivo.</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
