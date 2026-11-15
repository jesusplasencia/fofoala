import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, IdCard, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { koloalaApi, type LotMembership, type StaffMember, type StaffRoleName } from '../lib/api'
import { Alert, Badge, Button, errorMessage, inputClass } from './ui'

const cleanDoc = (v: string) => v.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 12)

/** Integrantes de un lote para el Administrador: ver DNI (enmascarado), cambiarlo (restablece acceso), agregar y dar de baja. */
export function AdminLotMembers({ lotId }: { lotId: string }) {
  const qc = useQueryClient()
  const key = ['members', lotId]
  const members = useQuery({ queryKey: key, queryFn: () => koloalaApi.listLotMembers(lotId) })
  const [editing, setEditing] = useState<string | null>(null)
  const [newDoc, setNewDoc] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [add, setAdd] = useState({ first: '', last: '', phone: '', doc: '' })
  const refresh = () => qc.invalidateQueries({ queryKey: key })

  const changeDoc = useMutation({
    mutationFn: (m: LotMembership) => koloalaApi.updateLotMember(lotId, m.phone, { document_id: newDoc }),
    onSuccess: (_, m) => {
      setNotice(
        m.document_id
          ? `DNI de ${m.full_name} cambiado. Su acceso se restableció: entrará con su celular y este DNI y recibirá un PIN nuevo por WhatsApp.`
          : `DNI de ${m.full_name} registrado. Sigue entrando normalmente.`,
      )
      setEditing(null)
      setNewDoc('')
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (m: LotMembership) => koloalaApi.removeLotMember(lotId, m.phone),
    onSuccess: (_, m) => {
      setNotice(`${m.full_name} fue dado de baja del lote ${lotId}.`)
      refresh()
    },
  })
  const create = useMutation({
    mutationFn: () =>
      koloalaApi.addLotMember(lotId, {
        phone: add.phone,
        full_name: `${add.first.trim()} ${add.last.trim()}`.trim(),
        document_id: add.doc,
      }),
    onSuccess: () => {
      setNotice('Integrante agregado.')
      setAdd({ first: '', last: '', phone: '', doc: '' })
      refresh()
    },
  })

  const confirmChange = (m: LotMembership) => {
    if (newDoc.length < 8) return
    if (!m.document_id) {
      // Completar un DNI vacío no afecta su acceso
      changeDoc.mutate(m)
      return
    }
    const ok = window.confirm(
      `¿Cambiar el DNI de ${m.full_name}?\n\nSe restablecerá su acceso: su contraseña actual dejará de funcionar, ` +
        'se cerrarán sus sesiones abiertas y deberá entrar con su celular y este DNI para recibir un PIN nuevo por WhatsApp.',
    )
    if (ok) changeDoc.mutate(m)
  }

  const err = changeDoc.error || remove.error || create.error || members.error

  return (
    <div className="bg-snow border-2 border-gold-200 rounded-2xl p-4 space-y-3">
      {notice && <Alert tone="success" onClose={() => setNotice(null)}>{notice}</Alert>}
      {err && <Alert tone="error">{errorMessage(err, 'Ocurrió un error')}</Alert>}

      <ul className="divide-y divide-pine-100">
        {members.data?.map((m) => (
          <li key={m.phone} className="py-2.5 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[180px]">
              <p className="font-extrabold text-pine-950">{m.full_name}</p>
              <p className="text-xs font-mono text-pine-800/60">{m.phone}</p>
            </div>
            <Badge tone={m.membership_role === 'ANCHOR' ? 'gold' : 'pine'}>{m.membership_role === 'ANCHOR' ? 'Titular' : 'Familiar'}</Badge>
            {m.document_id ? (
              <span className="text-xs font-extrabold text-pine-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> DNI {m.document_id}
              </span>
            ) : (
              <span className="text-xs font-extrabold text-gold-700 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Falta DNI
              </span>
            )}
            {editing === m.phone ? (
              <span className="flex items-center gap-1.5">
                <input
                  autoFocus
                  aria-label={`Nuevo DNI de ${m.full_name}`}
                  placeholder="Nuevo DNI / CE"
                  value={newDoc}
                  onChange={(e) => setNewDoc(cleanDoc(e.target.value))}
                  className={`${inputClass} !py-1.5 !w-40 font-mono`}
                />
                <Button size="sm" variant="berry" disabled={newDoc.length < 8} loading={changeDoc.isPending} onClick={() => confirmChange(m)}>
                  Guardar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(m.phone)
                    setNewDoc('')
                  }}
                >
                  <IdCard className="w-4 h-4" /> {m.document_id ? 'Cambiar DNI' : 'Registrar DNI'}
                </Button>
                <button
                  type="button"
                  onClick={() => window.confirm(`¿Dar de baja a ${m.full_name} del lote ${lotId}? Su carnet dejará de funcionar.`) && remove.mutate(m)}
                  className="p-2 rounded-xl text-berry-700 hover:bg-berry-50 cursor-pointer"
                  aria-label={`Dar de baja a ${m.full_name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </span>
            )}
          </li>
        ))}
        {members.data?.length === 0 && <li className="py-3 text-sm font-semibold text-pine-800/60">Este lote aún no tiene integrantes.</li>}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (add.phone.length === 9 && add.first.trim() && add.last.trim()) create.mutate()
        }}
        className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-center pt-2 border-t border-pine-100"
      >
        <input aria-label="Nombres" placeholder="Nombres" value={add.first} onChange={(e) => setAdd({ ...add, first: e.target.value })} className={`${inputClass} !py-2`} />
        <input aria-label="Apellidos" placeholder="Apellidos" value={add.last} onChange={(e) => setAdd({ ...add, last: e.target.value })} className={`${inputClass} !py-2`} />
        <input
          aria-label="Celular"
          inputMode="tel"
          placeholder="Celular"
          value={add.phone}
          onChange={(e) => setAdd({ ...add, phone: e.target.value.replace(/\D/g, '').slice(0, 9) })}
          className={`${inputClass} !py-2 font-mono`}
        />
        <input aria-label="DNI / CE" placeholder="DNI / CE" value={add.doc} onChange={(e) => setAdd({ ...add, doc: cleanDoc(e.target.value) })} className={`${inputClass} !py-2 font-mono`} />
        <Button type="submit" size="sm" loading={create.isPending} disabled={add.phone.length !== 9 || !add.first.trim() || !add.last.trim()}>
          <UserPlus className="w-4 h-4" /> Agregar
        </Button>
      </form>
    </div>
  )
}

/** Personal de la Villa: vigilantes (y administradores si eres Super Admin). Entran con su celular + DNI + PIN. */
export function StaffTab({ canAddAdmins }: { canAddAdmins: boolean }) {
  const qc = useQueryClient()
  const staff = useQuery({ queryKey: ['staff'], queryFn: koloalaApi.listStaff })
  const [form, setForm] = useState({ first: '', last: '', phone: '', doc: '', role: 'GUARD' as StaffRoleName })
  const [notice, setNotice] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['staff'] })

  const add = useMutation({
    mutationFn: () =>
      koloalaApi.addStaff({
        phone: form.phone,
        full_name: `${form.first.trim()} ${form.last.trim()}`.trim(),
        document_id: form.doc || undefined,
        role: form.role,
      }),
    onSuccess: () => {
      setNotice('Personal agregado. Entrará con su celular y su DNI; recibirá su PIN por WhatsApp.')
      setForm({ first: '', last: '', phone: '', doc: '', role: 'GUARD' })
      refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (s: StaffMember) => koloalaApi.removeStaff(s.phone),
    onSuccess: (_, s) => {
      setNotice(`${s.full_name ?? s.phone} fue dado de baja y su sesión se cerró.`)
      refresh()
    },
  })
  const err = add.error || remove.error || staff.error
  const valid = form.phone.length === 9 && form.first.trim() && form.last.trim() && form.doc.length >= 8

  return (
    <div className="space-y-4">
      {notice && <Alert tone="success" onClose={() => setNotice(null)}>{notice}</Alert>}
      {err && <Alert tone="error">{errorMessage(err, 'Ocurrió un error')}</Alert>}

      <div className="bg-white rounded-3xl border border-pine-100 p-5 space-y-3">
        <h2 className="text-base font-black text-pine-950">Agregar personal</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) add.mutate()
          }}
          className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-center"
        >
          <input aria-label="Nombres" placeholder="Nombres" value={form.first} onChange={(e) => setForm({ ...form, first: e.target.value })} className={`${inputClass} !py-2`} />
          <input aria-label="Apellidos" placeholder="Apellidos" value={form.last} onChange={(e) => setForm({ ...form, last: e.target.value })} className={`${inputClass} !py-2`} />
          <input
            aria-label="Celular"
            inputMode="tel"
            placeholder="Celular"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '').slice(0, 9) })}
            className={`${inputClass} !py-2 font-mono`}
          />
          <input aria-label="DNI / CE" placeholder="DNI / CE" value={form.doc} onChange={(e) => setForm({ ...form, doc: cleanDoc(e.target.value) })} className={`${inputClass} !py-2 font-mono`} />
          <select aria-label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRoleName })} className={`${inputClass} !py-2`}>
            <option value="GUARD">Vigilante</option>
            {canAddAdmins && <option value="ADMIN">Administrador</option>}
          </select>
          <Button type="submit" size="sm" loading={add.isPending} disabled={!valid}>
            <UserPlus className="w-4 h-4" /> Agregar
          </Button>
        </form>
      </div>

      <div className="bg-white rounded-3xl border border-pine-100 p-2">
        <ul className="divide-y divide-pine-50">
          {staff.data?.map((s) => (
            <li key={s.phone} className={`p-3 flex flex-wrap items-center gap-3 ${s.is_active ? '' : 'opacity-50'}`}>
              <div className="flex-1 min-w-[180px]">
                <p className="font-extrabold text-pine-950">{s.full_name ?? 'Sin nombre'}</p>
                <p className="text-xs font-mono text-pine-800/60">{s.phone}</p>
              </div>
              <Badge tone={s.role === 'ADMIN' ? 'gold' : 'pine'}>{s.role === 'ADMIN' ? 'Administrador' : 'Vigilante'}</Badge>
              <span className="text-xs font-extrabold text-pine-700">{s.document_id ? `DNI ${s.document_id}` : '⚠️ Falta DNI'}</span>
              <Badge tone={s.is_active ? (s.has_activated ? 'pine' : 'gold') : 'muted'}>
                {s.is_active ? (s.has_activated ? 'Activo' : 'Sin activar') : 'De baja'}
              </Badge>
              {s.is_active && (s.role === 'GUARD' || canAddAdmins) && (
                <button
                  type="button"
                  onClick={() => window.confirm(`¿Dar de baja a ${s.full_name ?? s.phone}? Se cerrará su sesión.`) && remove.mutate(s)}
                  className="p-2 rounded-xl text-berry-700 hover:bg-berry-50 cursor-pointer"
                  aria-label={`Dar de baja a ${s.full_name ?? s.phone}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
