import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, Gift, Home, IdCard, MapPin, Store, TreePine, Trees, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { detectVillaId, formatDateTime, getVillaDisplayName, type InviteResponse, koloalaApi } from '../lib/api'
import { buildShareUrl, qrDataUrl } from '../lib/passCard'
import { type AttendeeDraft, AttendeeEditor, emptyAttendee, toAttendeeInputs } from './AttendeeEditor'
import { Alert, AppHeader, Badge, Button, Card, EmptyState, errorMessage, Snowfall } from './ui'

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
    qrDataUrl(buildShareUrl({ token: pass.token })).then(setQr)
  }, [pass.token])
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
// /visita — Vitrina informativa de la Villa (sin autoservicio de QR)
// ---------------------------------------------------------------------------
export function PublicKioskView() {
  const villaId = detectVillaId()
  const catalog = useQuery({ queryKey: ['public-villa'], queryFn: koloalaApi.publicVilla })
  const businesses = catalog.data?.catalog.filter((c) => c.lot_type === 'MINI_LOT') ?? []
  const areas = catalog.data?.catalog.filter((c) => c.lot_type === 'COMMON_AREA') ?? []

  const Tile = ({ name, icon }: { name: string; icon: React.ReactNode }) => (
    <div className="p-4 rounded-3xl bg-white border-2 border-pine-100 text-pine-950">
      <div className="text-berry-600">{icon}</div>
      <p className="font-black mt-2 leading-tight">{name}</p>
    </div>
  )

  return (
    <PublicShell eyebrow={`Bienvenido a ${getVillaDisplayName(villaId)}`} title="Lo que hay en la villa">
      <p className="font-festive text-3xl text-berry-600 text-center">¡Felices Fiestas!</p>
      <Card className="p-5 space-y-3 border-2 border-gold-300">
        <h2 className="text-base font-black text-pine-950">¿Cómo ingreso?</h2>
        <p className="text-sm font-semibold text-pine-900 flex gap-2">
          <IdCard className="w-5 h-5 text-berry-600 shrink-0" />
          Si vas a un negocio o área común, acércate a la garita con tu DNI. El vigilante te registra en un momento.
        </p>
        <p className="text-sm font-semibold text-pine-900 flex gap-2">
          <Home className="w-5 h-5 text-pine-600 shrink-0" />
          Si visitas una casa, pide a tu anfitrión que te envíe su QR por WhatsApp.
        </p>
      </Card>
      {catalog.isError && <Alert tone="error">{errorMessage(catalog.error, 'No se pudo cargar el catálogo')}</Alert>}
      {businesses.length > 0 && (
        <section>
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-pine-700 mb-2 flex items-center gap-1.5">
            <Store className="w-4 h-4" /> Negocios de la villa
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {businesses.map((b) => (
              <Tile key={b.lot_id} name={b.display_name} icon={<Gift className="w-7 h-7" />} />
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
              <Tile key={a.lot_id} name={a.display_name} icon={<MapPin className="w-7 h-7" />} />
            ))}
          </div>
        </section>
      )}
      {catalog.data && catalog.data.catalog.length === 0 && (
        <EmptyState icon={<Store className="w-8 h-8" />}>Aún no hay lugares publicados.</EmptyState>
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
