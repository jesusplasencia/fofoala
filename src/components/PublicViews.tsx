import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, Gift, MapPin, Store, TreePine, Trees, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { type CatalogItem, detectVillaId, formatDateTime, getVillaDisplayName, type InviteResponse, koloalaApi } from '../lib/api'
import { buildShareUrl, qrDataUrl } from '../lib/passCard'
import { type AttendeeDraft, AttendeeEditor, emptyAttendee, toAttendeeInputs } from './AttendeeEditor'
import { Alert, AppHeader, Badge, Button, Card, EmptyState, errorMessage, inputClass, Label, Snowfall } from './ui'

function PublicShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen xmas-page pb-12">
      <Snowfall flakes={22} />
      <AppHeader eyebrow={eyebrow} title={title} icon={<TreePine className="w-6 h-6" />} />
      <main className="relative z-10 max-w-xl mx-auto px-4 pt-5 space-y-5">{children}</main>
    </div>
  )
}

function QrBlock({ pass }: { pass: Pick<InviteResponse, 'token' | 'short_code'> }) {
  const [qr, setQr] = useState<string | null>(null)
  useEffect(() => {
    qrDataUrl(buildShareUrl(pass)).then(setQr)
  }, [pass])
  return (
    <div className="flex flex-col items-center">
      <div className="p-2 rounded-2xl bg-white border-4 border-gold-300 shadow-md">
        {qr ? <img src={qr} alt={`QR ${pass.short_code}`} className="w-56 h-56" /> : <div className="w-56 h-56" />}
      </div>
      <div className="mt-3 px-5 py-2 rounded-2xl bg-pine-900 text-gold-300 font-mono font-black text-3xl tracking-[0.25em] pl-6">{pass.short_code}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// /visita — Cartel QR de garita = vitrina de la Villa
// ---------------------------------------------------------------------------
export function PublicKioskView() {
  const villaId = detectVillaId()
  const catalog = useQuery({ queryKey: ['public-villa'], queryFn: koloalaApi.publicVilla })
  const [dest, setDest] = useState<CatalogItem | null>(null)
  const [rows, setRows] = useState<AttendeeDraft[]>([emptyAttendee()])
  const [plate, setPlate] = useState('')
  const [pass, setPass] = useState<InviteResponse | null>(null)

  const mut = useMutation({
    mutationFn: () =>
      koloalaApi.createPublicVisit({
        destination_lot_id: dest!.lot_id,
        attendees: toAttendeeInputs(rows),
        vehicle_plate: plate.trim() || null,
      }),
    onSuccess: (p) => {
      setPass(p)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
  })

  const businesses = catalog.data?.catalog.filter((c) => c.lot_type === 'MINI_LOT') ?? []
  const areas = catalog.data?.catalog.filter((c) => c.lot_type === 'COMMON_AREA') ?? []

  if (pass) {
    return (
      <PublicShell eyebrow={getVillaDisplayName(villaId)} title="¡Tu pase está listo!">
        <Card className="p-6 text-center space-y-4 border-2 border-gold-300">
          <p className="font-festive text-3xl text-berry-600">¡Bienvenidos!</p>
          <p className="text-lg font-black text-pine-950">{pass.destination_label}</p>
          <QrBlock pass={pass} />
          <Alert tone="info">Muestra este QR al guardia. Válido hasta {formatDateTime(pass.valid_until)}.</Alert>
          <Button variant="ghost" className="w-full" onClick={() => {
            setPass(null)
            setDest(null)
            setRows([emptyAttendee()])
            setPlate('')
          }}>
            Sacar otro pase
          </Button>
        </Card>
      </PublicShell>
    )
  }

  const Tile = ({ item, icon }: { item: CatalogItem; icon: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => setDest(item)}
      className={`p-4 rounded-3xl text-left border-2 transition-all cursor-pointer ${
        dest?.lot_id === item.lot_id ? 'bg-berry-600 border-berry-600 text-white shadow-lg scale-[1.02]' : 'bg-white border-pine-100 hover:border-gold-400 text-pine-950'
      }`}
    >
      <div className={dest?.lot_id === item.lot_id ? 'text-gold-300' : 'text-berry-600'}>{icon}</div>
      <p className="font-black mt-2 leading-tight">{item.display_name}</p>
    </button>
  )

  return (
    <PublicShell eyebrow={`Bienvenido a ${getVillaDisplayName(villaId)}`} title="¿A dónde vas hoy?">
      <p className="font-festive text-3xl text-berry-600 text-center">¡Felices Fiestas!</p>
      {catalog.isError && <Alert tone="error">{errorMessage(catalog.error, 'No se pudo cargar el catálogo')}</Alert>}

      {businesses.length > 0 && (
        <section>
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-pine-700 mb-2 flex items-center gap-1.5">
            <Store className="w-4 h-4" /> Negocios de la villa
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {businesses.map((b) => (
              <Tile key={b.lot_id} item={b} icon={<Gift className="w-7 h-7" />} />
            ))}
          </div>
        </section>
      )}
      {areas.length > 0 && (
        <section>
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-pine-700 mb-2 flex items-center gap-1.5">
            <Trees className="w-4 h-4" /> Áreas comunes
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {areas.map((a) => (
              <Tile key={a.lot_id} item={a} icon={<MapPin className="w-7 h-7" />} />
            ))}
          </div>
        </section>
      )}
      {catalog.data && catalog.data.catalog.length === 0 && (
        <EmptyState icon={<Store className="w-8 h-8" />}>Aún no hay lugares publicados.</EmptyState>
      )}

      <Alert tone="info">¿Visitas una casa? Pide a tu anfitrión que te envíe un QR desde su app.</Alert>

      {dest && (
        <Card className="p-5 space-y-4 border-2 border-gold-300">
          <h2 className="text-lg font-black text-pine-950">¿Quiénes ingresan a {dest.display_name}?</h2>
          {mut.isError && <Alert tone="error">{errorMessage(mut.error, 'No se pudo crear el pase')}</Alert>}
          <AttendeeEditor rows={rows} onChange={setRows} />
          <div>
            <Label htmlFor="k-plate">Placa del vehículo (si vienes en carro o moto)</Label>
            <input id="k-plate" placeholder="ABC-123" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} className={`${inputClass} font-mono uppercase`} />
          </div>
          <Button size="lg" variant="berry" className="w-full" loading={mut.isPending} disabled={toAttendeeInputs(rows).length === 0} onClick={() => mut.mutate()}>
            Obtener mi QR
          </Button>
          <p className="text-[11px] text-pine-800/60 font-semibold text-center">No necesitas crear cuenta ni dar tu celular.</p>
        </Card>
      )}
    </PublicShell>
  )
}

// ---------------------------------------------------------------------------
// /v/{token} — Enlace que el anfitrión envía por WhatsApp
// ---------------------------------------------------------------------------
export function InviteLinkView({ token }: { token: string }) {
  const villaId = detectVillaId()
  const qc = useQueryClient()
  const view = useQuery({ queryKey: ['invite', token], queryFn: () => koloalaApi.viewPublicVisit(token) })
  const [rows, setRows] = useState<AttendeeDraft[]>([emptyAttendee()])
  const add = useMutation({
    mutationFn: () => koloalaApi.addVisitAttendees(token, toAttendeeInputs(rows)),
    onSuccess: (data) => {
      qc.setQueryData(['invite', token], data)
      setRows([emptyAttendee()])
    },
  })

  const v = view.data
  const active = v?.status === 'ACTIVE'

  return (
    <PublicShell eyebrow={getVillaDisplayName(villaId)} title={v ? v.destination_label : 'Tu invitación'}>
      {view.isError && <Alert tone="error">{errorMessage(view.error, 'Este pase no existe')}</Alert>}
      {v && (
        <>
          <Card className="p-6 text-center space-y-4 border-2 border-gold-300">
            <p className="font-festive text-3xl text-berry-600">¡Te esperamos!</p>
            {active ? (
              <QrBlock pass={{ token, short_code: v.short_code }} />
            ) : (
              <Alert tone={v.status === 'USED' ? 'success' : 'warn'}>
                {v.status === 'USED' ? 'Este pase ya fue usado en garita.' : 'Este pase venció. Pide uno nuevo a tu anfitrión.'}
              </Alert>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <Badge tone="pine">
                <Users className="w-3.5 h-3.5" /> {v.party_size_expected} persona(s)
              </Badge>
              <Badge tone="gold">
                <Clock className="w-3.5 h-3.5" /> Hasta {formatDateTime(v.valid_until)}
              </Badge>
            </div>
            <p className="text-xs font-semibold text-pine-800/70">Muestra este QR en garita. Si alguien no trae DNI físico, igual puede ingresar.</p>
          </Card>

          <Card className="p-5 space-y-3">
            <h2 className="text-base font-black text-pine-950">Tu grupo</h2>
            {v.attendee_names.length === 0 ? (
              <p className="text-sm font-semibold text-pine-800/60">Aún no hay nombres. Agrégalos para pasar más rápido.</p>
            ) : (
              <ul className="space-y-1.5">
                {v.attendee_names.map((n, i) => (
                  <li key={i} className="flex items-center gap-2 font-extrabold text-pine-900">
                    <CheckCircle2 className="w-4 h-4 text-pine-500" /> {n}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {active && (
            <Card className="p-5 space-y-4">
              <h2 className="text-base font-black text-pine-950">Agregar personas</h2>
              {add.isError && <Alert tone="error">{errorMessage(add.error, 'No se pudo guardar')}</Alert>}
              <AttendeeEditor rows={rows} onChange={setRows} />
              <Button className="w-full" loading={add.isPending} disabled={toAttendeeInputs(rows).length === 0} onClick={() => add.mutate()}>
                Guardar nombres
              </Button>
            </Card>
          )}
        </>
      )}
    </PublicShell>
  )
}
