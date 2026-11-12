import QRCode from 'qrcode'
import { formatDateTime, getVillaDisplayName, type InviteResponse, KIND_LABEL } from './api'

/** Enlace del pase: el QR lleva el link para que el invitado vea su pase y complete su grupo. */
export function buildShareUrl(pass: Pick<InviteResponse, 'token'>): string {
  return `${window.location.origin}/v/${pass.token}`
}

export type ScanResult =
  | { type: 'carnet'; payload: string }
  | { type: 'visit'; ref: string }
  | { type: 'unknown' }

/**
 * Interpreta lo que lee la cámara de garita:
 * - Carnet de residente: "R1.VC3.916220518.<ventana>.<firma>"
 * - Pase de visita: enlace ".../v/<token>", token suelto o código de 6 caracteres
 */
export function parseScan(raw: string): ScanResult {
  const text = raw.trim()
  if (text.startsWith('R1.')) return { type: 'carnet', payload: text }
  const fromUrl = text.match(/\/v\/([A-Za-z0-9_-]{10,})/)
  if (fromUrl) return { type: 'visit', ref: fromUrl[1] }
  if (/^[A-Za-z0-9_-]{20,}$/.test(text)) return { type: 'visit', ref: text }
  const code = text.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (code.length === 6) return { type: 'visit', ref: code }
  return { type: 'unknown' }
}

const QR_COLORS = { dark: '#061f12', light: '#ffffff' }

export function qrDataUrl(text: string, width = 340): Promise<string> {
  return QRCode.toDataURL(text, { width, margin: 2, errorCorrectionLevel: 'M', color: QR_COLORS })
}

function drawSnowflake(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
    ctx.stroke()
  }
  ctx.restore()
}

/** Tarjeta navideña PNG del pase (para guardar o compartir por WhatsApp). */
export async function generatePassCardBlob(pass: InviteResponse): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 1140
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear la imagen')

  // Fondo pino con brillo
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height)
  bg.addColorStop(0, '#11472a')
  bg.addColorStop(1, '#061f12')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ;[
    [70, 70, 22],
    [730, 110, 16],
    [60, 1060, 18],
    [740, 1080, 24],
    [700, 560, 12],
  ].forEach(([x, y, r]) => drawSnowflake(ctx, x, y, r, 'rgba(255,255,255,0.35)'))

  // Tarjeta blanca
  ctx.fillStyle = '#fffaf0'
  ctx.beginPath()
  ctx.roundRect(48, 48, 704, 1044, 40)
  ctx.fill()

  // Cabecera roja
  ctx.fillStyle = '#c21616'
  ctx.beginPath()
  ctx.roundRect(48, 48, 704, 200, [40, 40, 0, 0])
  ctx.fill()

  // Franja bastón de caramelo
  ctx.save()
  ctx.beginPath()
  ctx.rect(48, 248, 704, 14)
  ctx.clip()
  for (let x = 30; x < 800; x += 40) {
    ctx.fillStyle = (x / 40) % 2 < 1 ? '#16703b' : '#ffffff'
    ctx.beginPath()
    ctx.moveTo(x, 262)
    ctx.lineTo(x + 20, 248)
    ctx.lineTo(x + 40, 248)
    ctx.lineTo(x + 20, 262)
    ctx.fill()
  }
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffd447'
  ctx.font = '800 24px Nunito, system-ui, sans-serif'
  ctx.fillText(`✦ ${getVillaDisplayName(pass.villa_id).toUpperCase()} ✦`, 400, 108)
  ctx.fillStyle = '#ffffff'
  ctx.font = '900 50px Nunito, system-ui, sans-serif'
  ctx.fillText(pass.destination_label.toUpperCase(), 400, 172)
  ctx.fillStyle = '#ffe585'
  ctx.font = '800 24px Nunito, system-ui, sans-serif'
  ctx.fillText(`PASE DE ${KIND_LABEL[pass.kind].toUpperCase()} • ${pass.party_size_expected} PERSONA(S)`, 400, 220)

  // QR
  const qrCanvas = document.createElement('canvas')
  await QRCode.toCanvas(qrCanvas, buildShareUrl(pass), {
    width: 440,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: QR_COLORS,
  })
  ctx.strokeStyle = '#fbbf24'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.roundRect(170, 290, 460, 460, 24)
  ctx.stroke()
  ctx.drawImage(qrCanvas, 180, 300, 440, 440)

  // Código manual
  ctx.fillStyle = '#11472a'
  ctx.beginPath()
  ctx.roundRect(140, 780, 520, 120, 24)
  ctx.fill()
  ctx.fillStyle = '#ffd447'
  ctx.font = '900 66px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  ctx.fillText(pass.short_code.split('').join(' '), 400, 862)

  ctx.fillStyle = '#135a31'
  ctx.font = '800 25px Nunito, system-ui, sans-serif'
  ctx.fillText(`Válido hasta ${formatDateTime(pass.valid_until)}`, 400, 952)
  ctx.fillStyle = '#6d1717'
  ctx.font = '700 21px Nunito, system-ui, sans-serif'
  ctx.fillText('Muestra este QR en garita. Si no traes DNI físico, igual puedes ingresar.', 400, 1000)
  ctx.fillStyle = '#c21616'
  ctx.font = '700 30px "Mountains of Christmas", Nunito, cursive'
  ctx.fillText('¡Felices Fiestas!', 400, 1052)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo exportar la imagen'))), 'image/png')
  })
}
