import { Plus, Trash2, UserRound } from 'lucide-react'
import type { AttendeeInput, DocType } from '../lib/api'
import { inputClass } from './ui'

export interface AttendeeDraft {
  first_names: string
  last_names: string
  doc_type: DocType
  doc_number: string
  /** Número tal como lo leyó el OCR; si el guardia lo edita, deja de contar como OCR. */
  ocr_doc?: string
}

export const emptyAttendee = (): AttendeeDraft => ({
  first_names: '',
  last_names: '',
  doc_type: 'DNI',
  doc_number: '',
})

/** Convierte borradores a payload: el documento es opcional (sin número ⇒ NINGUNO). */
export function toAttendeeInputs(rows: AttendeeDraft[]): AttendeeInput[] {
  return rows
    .filter((r) => r.first_names.trim())
    .map((r) => {
      const num = r.doc_number.trim()
      return {
        first_names: r.first_names.trim(),
        last_names: r.last_names.trim() || null,
        doc_type: num ? r.doc_type : 'NINGUNO',
        doc_number: num || null,
        doc_source: num ? (r.ocr_doc && r.ocr_doc === num ? 'OCR' : 'MANUAL') : null,
      } as AttendeeInput
    })
}

const DOC_OPTIONS: Array<{ value: DocType; label: string }> = [
  { value: 'DNI', label: 'DNI' },
  { value: 'CE', label: 'Carnet Ext.' },
  { value: 'PASAPORTE', label: 'Pasaporte' },
]

interface Props {
  rows: AttendeeDraft[]
  onChange: (rows: AttendeeDraft[]) => void
  max?: number
  minRows?: number
}

export function AttendeeEditor({ rows, onChange, max = 20, minRows = 1 }: Props) {
  const update = (i: number, patch: Partial<AttendeeDraft>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <fieldset key={i} className="rounded-2xl border-2 border-pine-100 bg-snow/60 p-3 space-y-2">
          <legend className="sr-only">Persona {i + 1}</legend>
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-berry-700 flex items-center gap-1.5">
              <UserRound className="w-4 h-4" />
              Persona {i + 1}
            </span>
            {rows.length > minRows && (
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                className="p-1.5 rounded-lg text-berry-700 hover:bg-berry-50 cursor-pointer"
                aria-label={`Quitar persona ${i + 1}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              aria-label="Nombres"
              placeholder="Nombres"
              value={row.first_names}
              onChange={(e) => update(i, { first_names: e.target.value })}
              className={inputClass}
            />
            <input
              aria-label="Apellidos"
              placeholder="Apellidos"
              value={row.last_names}
              onChange={(e) => update(i, { last_names: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <select
              aria-label="Tipo de documento"
              value={row.doc_type}
              onChange={(e) => update(i, { doc_type: e.target.value as DocType })}
              className={`${inputClass} !w-auto pr-8`}
            >
              {DOC_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              aria-label="Número de documento (opcional)"
              placeholder="N° documento (opcional)"
              inputMode={row.doc_type === 'DNI' ? 'numeric' : 'text'}
              value={row.doc_number}
              onChange={(e) => update(i, { doc_number: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '') })}
              className={`${inputClass} font-mono`}
            />
          </div>
        </fieldset>
      ))}
      {rows.length < max && (
        <button
          type="button"
          onClick={() => onChange([...rows, emptyAttendee()])}
          className="w-full py-2.5 rounded-2xl border-2 border-dashed border-gold-400 text-gold-700 hover:bg-gold-50 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Agregar otra persona
        </button>
      )}
      <p className="text-[11px] text-pine-800/60 font-semibold">
        El documento es opcional: quien no lo trae igual ingresa y queda registrado en garita.
      </p>
    </div>
  )
}
