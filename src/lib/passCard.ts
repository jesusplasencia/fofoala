import QRCode from 'qrcode'
import { type GuestPassResponse } from './api'

/**
 * Formato del QR leído en garita:
 * KOLOALA:VC3:9X4K2M (también soporta pegar o leer solo los 6 caracteres)
 */
export function buildQrPayload(pass: GuestPassResponse): string {
  return `KOLOALA:${pass.villa_id}:${pass.code}`
}

export function extractPassCodeFromScannedText(rawText: string): string {
  const cleaned = rawText.trim().toUpperCase()
  if (cleaned.startsWith('KOLOALA:')) {
    const parts = cleaned.split(':')
    const candidate = parts[parts.length - 1] || ''
    return candidate.replace(/[^A-Z0-9]/g, '').slice(0, 6)
  }
  return cleaned.replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

/**
 * Genera una imagen DataURL del QR puro (blanco y negro de alto contraste)
 * para mostrar en la pantalla del residente.
 */
export async function generateQrDataUrl(pass: GuestPassResponse): Promise<string> {
  return QRCode.toDataURL(buildQrPayload(pass), {
    width: 340,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#022c22',
      light: '#ffffff',
    },
  })
}

/**
 * Dibuja un "Boarding Pass / Tarjeta Oficial de Ingreso" en alta resolución (PNG)
 * con el logo/cabecera de la Villa, lote destino, QR grande, código de 6 dígitos
 * y hora de vencimiento, listo para descargar en el teléfono o compartir por WhatsApp.
 */
export async function generatePassCardBlob(pass: GuestPassResponse): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 1120
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo inicializar el lienzo de imagen')

  // Fondo general
  ctx.fillStyle = '#064e3b'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Tarjeta blanca central
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(48, 48, 704, 1024, 40)
  ctx.fill()

  // Cabecera verde oscura dentro de la tarjeta
  ctx.fillStyle = '#022c22'
  ctx.beginPath()
  ctx.roundRect(48, 48, 704, 195, [40, 40, 0, 0])
  ctx.fill()

  // Texto cabecera
  ctx.fillStyle = '#6ee7b7'
  ctx.font = 'bold 24px system-ui, -apple-system, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`PASE OFICIAL DE GARITA • ${pass.villa_id}`, 400, 110)

  ctx.fillStyle = '#ffffff'
  ctx.font = '900 48px system-ui, -apple-system, sans-serif'
  ctx.fillText(`CASA ${pass.lot_id}`, 400, 172)

  const passTypeLabel =
    pass.pass_type === 'DELIVERY'
      ? 'DELIVERY (45 MIN)'
      : pass.pass_type === 'TAXI'
        ? 'TAXI / MOVILIDAD (30 MIN)'
        : 'VISITA / INVITADO (8 HORAS)'

  ctx.fillStyle = '#d1fae5'
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif'
  ctx.fillText(passTypeLabel, 400, 215)

  // Dibujar el QR en el centro
  const qrCanvas = document.createElement('canvas')
  await QRCode.toCanvas(qrCanvas, buildQrPayload(pass), {
    width: 440,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#022c22',
      light: '#ffffff',
    },
  })
  ctx.drawImage(qrCanvas, 180, 275, 440, 440)

  // Caja del código alfanumérico de 6 caracteres
  ctx.fillStyle = '#0f172a'
  ctx.beginPath()
  ctx.roundRect(120, 740, 560, 125, 24)
  ctx.fill()

  ctx.fillStyle = '#34d399'
  ctx.font = '900 68px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
  ctx.fillText(pass.code.split('').join(' '), 400, 825)

  // Información de expiración y nota
  const expiresTime = new Date(pass.expires_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  ctx.fillStyle = '#334155'
  ctx.font = 'bold 25px system-ui, -apple-system, sans-serif'
  ctx.fillText(`Válido hasta las ${expiresTime}`, 400, 920)

  if (pass.visitor_info) {
    ctx.fillStyle = '#0f172a'
    ctx.font = 'bold 24px system-ui, -apple-system, sans-serif'
    ctx.fillText(`Detalle: ${pass.visitor_info}`, 400, 962)
  }

  ctx.fillStyle = '#64748b'
  ctx.font = '600 20px system-ui, -apple-system, sans-serif'
  ctx.fillText('Muestre este QR en garita junto con su DNI físico', 400, 1020)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('No se pudo exportar la imagen PNG del pase'))
    }, 'image/png')
  })
}
