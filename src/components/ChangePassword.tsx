import { useMutation } from '@tanstack/react-query'
import { KeyRound, X } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { koloalaApi } from '../lib/api'
import { PasswordInput } from './PasswordInput'
import { Alert, Button, errorMessage, Label } from './ui'

/** Botón de la cabecera que abre el cambio de contraseña (8 a 64 caracteres, no solo números). */
export function ChangePasswordButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 cursor-pointer"
        aria-label="Cambiar contraseña"
        title="Cambiar contraseña"
      >
        <KeyRound className="w-4 h-4 text-gold-300" />
      </button>
      {open && <ChangePasswordModal onClose={() => setOpen(false)} />}
    </>
  )
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const mut = useMutation({ mutationFn: () => koloalaApi.changePassword(current, next) })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const tooShort = next.length > 0 && next.length < 8
  const mismatch = confirm.length > 0 && confirm !== next
  const valid = current.length >= 4 && next.length >= 8 && next.length <= 64 && next === confirm

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (valid) mut.mutate()
  }

  return (
    <div className="fixed inset-0 z-50 bg-pine-950/60 flex items-end sm:items-center justify-center p-4 text-pine-950" role="dialog" aria-modal="true" aria-labelledby="cp-title">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="cp-title" className="text-lg font-black">Cambiar contraseña</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-pine-50 cursor-pointer" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        {mut.isSuccess ? (
          <>
            <Alert tone="success">¡Listo! Desde ahora ingresa con tu nueva contraseña.</Alert>
            <Button className="w-full" onClick={onClose}>
              Cerrar
            </Button>
          </>
        ) : (
          <>
            {mut.isError && <Alert tone="error">{errorMessage(mut.error, 'No se pudo cambiar')}</Alert>}
            <div>
              <Label htmlFor="cp-current">Contraseña o PIN actual</Label>
              <PasswordInput id="cp-current" label="Contraseña actual" value={current} onChange={setCurrent} autoFocus />
            </div>
            <div>
              <Label htmlFor="cp-new">Nueva contraseña</Label>
              <PasswordInput id="cp-new" label="Nueva contraseña" value={next} onChange={setNext} autoComplete="new-password" />
              <p className={`text-[11px] font-extrabold mt-1.5 ${tooShort ? 'text-berry-700' : 'text-pine-800/60'}`}>
                {next.length}/64 • mínimo 8 caracteres. Puedes usar letras, números, símbolos o una frase.
              </p>
            </div>
            <div>
              <Label htmlFor="cp-confirm">Repite la nueva contraseña</Label>
              <PasswordInput id="cp-confirm" label="Confirmar contraseña" value={confirm} onChange={setConfirm} autoComplete="new-password" />
              {mismatch && <p className="text-[11px] font-extrabold text-berry-700 mt-1.5">No coincide con la nueva contraseña.</p>}
            </div>
            <Button type="submit" className="w-full" size="lg" loading={mut.isPending} disabled={!valid}>
              Guardar contraseña
            </Button>
          </>
        )}
      </form>
    </div>
  )
}
