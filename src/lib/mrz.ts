/**
 * Lectura de la zona MRZ (TD1, 3 líneas de 30 caracteres) del reverso del DNI peruano.
 *   Línea 1: I<PER + número (9 posiciones: 8 dígitos + relleno) + dígito de control + ...
 *   Línea 3: APELLIDO1<APELLIDO2<<NOMBRE1<NOMBRE2<<<<
 * Solo extraemos nombres, apellidos y número. No usamos fecha de nacimiento ni otros datos.
 */

export interface DniData {
  first_names: string
  last_names: string
  doc_number: string
  /** true si el dígito de control del número coincide (lectura confiable). */
  checksum_ok: boolean
}

const WEIGHTS = [7, 3, 1]

function charValue(c: string): number {
  if (c === '<') return 0
  if (/[0-9]/.test(c)) return Number(c)
  return c.charCodeAt(0) - 55 // A=10 ... Z=35
}

export function mrzCheckDigit(field: string): number {
  let sum = 0
  for (let i = 0; i < field.length; i++) sum += charValue(field[i]) * WEIGHTS[i % 3]
  return sum % 10
}

/** Corrige confusiones típicas del OCR en campos numéricos. */
function toDigits(s: string): string {
  return s.replace(/[OQD]/g, '0').replace(/[IL]/g, '1').replace(/Z/g, '2').replace(/S/g, '5').replace(/B/g, '8')
}

function cleanLines(raw: string): string[] {
  return raw
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, '').replace(/[«‹]/g, '<').replace(/[^A-Z0-9<]/g, ''))
    .filter((l) => l.length >= 20 && l.includes('<'))
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export function parseDniMrz(raw: string): DniData | null {
  const lines = cleanLines(raw)
  if (lines.length === 0) return null

  // Número: buscamos "I<PER" (o variantes leídas por el OCR) seguido de 8 dígitos
  let docNumber = ''
  let checksumOk = false
  for (const l of lines) {
    const m = l.match(/[I1][<K]?P[E3]R([0-9OQDILZSB]{8})(<?)([0-9OQDILZSB<])/)
    if (m) {
      docNumber = toDigits(m[1])
      const field = `${docNumber}<`
      const check = toDigits(m[3])
      checksumOk = /\d/.test(check) && mrzCheckDigit(field) === Number(check)
      break
    }
  }
  if (!docNumber) {
    const fallback = lines.join('').match(/(?<!\d)\d{8}(?!\d)/)
    if (fallback) docNumber = fallback[0]
  }

  // Nombres: la línea con "<<" que tenga más letras (y casi sin dígitos)
  const nameLine = lines
    .filter((l) => l.includes('<<') && /[A-Z]{2,}/.test(l) && (l.match(/\d/g)?.length ?? 0) <= 2)
    .sort((a, b) => (b.match(/[A-Z]/g)?.length ?? 0) - (a.match(/[A-Z]/g)?.length ?? 0))[0]

  let last = ''
  let first = ''
  if (nameLine) {
    const body = nameLine.replace(/^[^A-Z]+/, '').replace(/<+$/, '')
    const [sur, ...rest] = body.split('<<')
    last = sur.replace(/</g, ' ').trim()
    first = rest.join(' ').replace(/</g, ' ').replace(/\s+/g, ' ').trim()
  }

  if (!docNumber && !last) return null
  return {
    first_names: titleCase(first),
    last_names: titleCase(last),
    doc_number: docNumber,
    checksum_ok: checksumOk,
  }
}
