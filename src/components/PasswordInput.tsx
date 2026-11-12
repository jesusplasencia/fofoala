import { ClipboardPaste, Eye, EyeOff, KeyRound } from 'lucide-react'
import { useRef, useState } from 'react'
import { inputClass } from './ui'

/**
 * Extrae la contraseña de lo copiado:
 * - Si es un mensaje (tiene espacios/saltos) con un bloque de 8 dígitos (PIN de WhatsApp), toma ese bloque.
 * - Si no, pega el texto completo recortado (contraseñas propias con letras/símbolos).
 */
function extractFromClipboard(raw: string): string {
  const text = raw.trim()
  if (/\s/.test(text)) {
    const pin = text.match(/(?<!\d)\d{8}(?!\d)/)
    if (pin) return pin[0]
  }
  return text.slice(0, 64)
}

interface Props {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
  autoComplete?: 'current-password' | 'new-password'
  autoPaste?: boolean
  label: string
}

export function PasswordInput({ id, value, onChange, placeholder = '••••••••', autoFocus, autoComplete = 'current-password', autoPaste, label }: Props) {
  const [visible, setVisible] = useState(false)
  const [pasted, setPasted] = useState(false)
  const triedRef = useRef(false)

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const pwd = extractFromClipboard(text)
      if (pwd) {
        onChange(pwd)
        setPasted(true)
      }
    } catch {
      // el navegador no dio permiso: el usuario puede pegar a mano o con el botón
    }
  }

  return (
    <div>
      <div className="relative">
        <KeyRound className="w-5 h-5 text-pine-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-label={label}
          required
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={64}
          placeholder={placeholder}
          value={value}
          onFocus={() => {
            if (autoPaste && !value && !triedRef.current) {
              triedRef.current = true
              pasteFromClipboard()
            }
          }}
          onChange={(e) => {
            onChange(e.target.value)
            setPasted(false)
          }}
          className={`${inputClass} pl-12 pr-24 text-lg ${visible ? 'font-mono text-pine-600 tracking-wide' : 'tracking-widest'}`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            type="button"
            onClick={pasteFromClipboard}
            className="p-2 rounded-xl text-pine-700 hover:bg-pine-50 cursor-pointer"
            aria-label="Pegar desde el portapapeles"
            title="Pegar"
          >
            <ClipboardPaste className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className={`p-2 rounded-xl hover:bg-pine-50 cursor-pointer ${visible ? 'text-pine-600' : 'text-pine-800/50'}`}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={visible}
          >
            {visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {pasted && (
        <p className="text-[11px] font-extrabold text-pine-600 mt-1.5" role="status">
          Pegado desde el portapapeles. Revísalo y corrígelo si hace falta.
        </p>
      )}
    </div>
  )
}
