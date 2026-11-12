import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Bike,
  CarTaxiFront,
  Check,
  Copy,
  Download,
  History,
  Home,
  IdCard,
  LayoutDashboard,
  Share2,
  Ticket,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  type AuthSession,
  formatDateTime,
  formatTime,
  type InviteResponse,
  KIND_LABEL,
  koloalaApi,
  type VisitKind,
} from '../lib/api'
import { buildShareUrl, generatePassCardBlob, qrDataUrl } from '../lib/passCard'
import { type AttendeeDraft, AttendeeEditor, toAttendeeInputs } from './AttendeeEditor'
import { Alert, AppHeader, Badge, Button, Card, EmptyState, errorMessage, inputClass, Label, Snowfall, Tabs } from './ui'

interface ResidentViewProps {
  session: AuthSession
  onLogout: () => void
  onSwitchToAdmin?: () => void
}

type Tab = 'passes' | 'carnet' | 'family' | 'entries'

export function ResidentView({ session, onLogout, onSwitchToAdmin }: ResidentViewProps) {
  const [tab, setTab] = useState<Tab>('passes')
  const membershipsQuery = useQuery({ queryKey: ['my-memberships'], queryFn: koloalaApi.myMemberships })
  const lots = useMemo(() => {
    const fromApi = membershipsQuery.data?.map((m) => m.lot_id) ?? []
    const merged = [...new Set([...fromApi, ...session.available_lots, ...(session.lot_id ? [session.lot_id] : [])])]
    return merged
  }, [membershipsQuery.data, session.available_lots, session.lot_id])
  const [lotId, setLotId] = useState<string | null>(session.lot_id)
  const activeLot = lotId && lots.includes(lotId) ? lotId : lots[0] ?? null
  const myRole = membershipsQuery.data?.find((m) => m.lot_id === activeLot)?.membership_role

  return (
    <div className="min-h-screen xmas-page pb-12">
      <Snowfall flakes={16} />
      <AppHeader
        eyebrow={`${session.villa_id} • ${myRole === 'HOUSEHOLD' ? 'Familiar' : 'Residente'}`}
        title={activeLot ? `Casa ${activeLot}` : session.full_name || session.username}
        icon={<Home className="w-6 h-6" />}
        onTitleClick={() => setTab('passes')}
        onLogout={onLogout}
      >
        <div className="space-y-3">
          {lots.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {lots.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLotId(l)}
                  className={`px-3 py-1.5 rounded-full text-xs font-extrabold border cursor-pointer ${
                    l === activeLot ? 'bg-gold-400 text-pine-950 border-gold-300' : 'bg-white/10 text-white border-white/20'
                  }`}
                >
                  Casa {l}
                </button>
              ))}
            </div>
          )}
          <Tabs
            dark
            active={tab}
            onChange={setTab}
            tabs={[
              { id: 'passes', label: 'Pases', icon: <Ticket className="w-4 h-4" /> },
              { id: 'carnet', label: 'Mi carnet', icon: <IdCard className="w-4 h-4" /> },
              { id: 'family', label: 'Familia', icon: <Users className="w-4 h-4" /> },
              { id: 'entries', label: 'Ingresos', icon: <History className="w-4 h-4" /> },
            ]}
          />
          {onSwitchToAdmin && (
            <button
              type="button"
              onClick={onSwitchToAdmin}
              className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LayoutDashboard className="w-4 h-4 text-gold-300" />
              Ir al panel de administración
            </button>
          )}
        </div>
      </AppHeader>

      <main className="relative z-10 max-w-xl mx-auto px-4 pt-5 space-y-5">
        {tab === 'passes' && <PassesTab lotId={activeLot} />}
        {tab === 'carnet' && <CarnetTab />}
        {tab === 'family' && <FamilyTab lotId={activeLot} isAnchor={myRole === 'ANCHOR'} />}
        {tab === 'entries' && <EntriesTab />}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pases: Visita / Taxi / Delivery
// ---------------------------------------------------------------------------
const KIND_OPTIONS: Array<{ kind: VisitKind; title: string; subtitle: string; ttl: string; icon: typeof Bike; cls: string }> = [
  {
    kind: 'GUEST',
    title: 'Visita',
    subtitle: 'Familia o amigos, un solo QR para todo el grupo',
    ttl: 'Tú eliges la vigencia',
    icon: Users,
    cls: 'from-pine-600 to-pine-800 shadow-pine-800/25',
  },
  {
    kind: 'TAXI',
    title: 'Taxi',
    subtitle: 'Uber, InDrive, Cabify',
    ttl: 'Válido 30 min • placa obligatoria',
    icon: CarTaxiFront,
    cls: 'from-gold-400 to-gold-600 shadow-gold-600/25 !text-pine-950',
  },
  {
    kind: 'DELIVERY',
    title: 'Delivery',
    subtitle: 'Rappi, PedidosYa, gas, farmacia',
    ttl: 'Válido 45 min • placa obligatoria',
    icon: Bike,
    cls: 'from-berry-500 to-berry-700 shadow-berry-700/25',
  },
]

function PassesTab({ lotId }: { lotId: string | null }) {
  const [kind, setKind] = useState<VisitKind | null>(null)
  const [note, setNote] = useState('')
  const [partySize, setPartySize] = useState(1)
  const [hours, setHours] = useState(24)
  const [rows, setRows] = useState<AttendeeDraft[]>([])
  const [pass, setPass] = useState<InviteResponse | null>(null)

  const mutation = useMutation({
    mutationFn: (k: VisitKind) => {
      const attendees = k === 'GUEST' ? toAttendeeInputs(rows) : []
      return koloalaApi.createInvite({
        kind: k,
        lot_id: lotId,
        note: note.trim() || null,
        party_size_expected: k === 'GUEST' ? Math.max(partySize, attendees.length || 1) : 1,
        valid_hours: hours,
        attendees,
      })
    },
    onSuccess: (data) => {
      setPass(data)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
  })

  const resetAll = () => {
    setPass(null)
    setKind(null)
    setNote('')
    setRows([])
    setPartySize(1)
    mutation.reset()
  }

  if (pass) return <PassResult pass={pass} onBack={resetAll} />

  if (kind === 'GUEST') {
    return (
      <Card className="p-5 space-y-4">
        <button type="button" onClick={() => setKind(null)} className="text-xs font-extrabold text-pine-700 flex items-center gap-1 cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <h2 className="text-lg font-black text-pine-950">Invitar visita a Casa {lotId}</h2>
        {mutation.isError && <Alert tone="error">{errorMessage(mutation.error, 'No se pudo crear el pase')}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="party">¿Cuántas personas?</Label>
            <input
              id="party"
              type="number"
              min={1}
              max={20}
              value={partySize}
              onChange={(e) => setPartySize(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
              className={inputClass}
            />
          </div>
          <div>
            <Label htmlFor="hours">Vigencia</Label>
            <select id="hours" value={hours} onChange={(e) => setHours(Number(e.target.value))} className={inputClass}>
              {[4, 8, 24, 48, 72].map((h) => (
                <option key={h} value={h}>
                  {h} horas
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Label htmlFor="note">Nota (opcional)</Label>
          <input id="note" maxLength={120} placeholder="Ej. Familia de Canadá" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </div>
        <details className="rounded-2xl bg-gold-50 border-2 border-gold-200 p-3" open={rows.length > 0}>
          <summary className="text-sm font-extrabold text-pine-900 cursor-pointer">Precargar nombres (opcional)</summary>
          <p className="text-xs text-pine-800/70 font-semibold my-2">
            Si no los pones, tus invitados pueden completarlos desde el enlace o en la garita.
          </p>
          <AttendeeEditor rows={rows} onChange={setRows} minRows={0} />
        </details>
        <Button size="lg" className="w-full" loading={mutation.isPending} onClick={() => mutation.mutate('GUEST')}>
          Generar QR de visita
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {mutation.isError && <Alert tone="error">{errorMessage(mutation.error, 'No se pudo crear el pase')}</Alert>}
      {!lotId && <Alert tone="warn">No tienes un lote activo para generar pases.</Alert>}
      <Card className="p-4">
        <Label htmlFor="quick-note">Nota opcional (empresa o nombre)</Label>
        <input id="quick-note" maxLength={120} placeholder="Ej. Uber gris, PedidosYa..." value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </Card>
      <h2 className="text-xs font-extrabold uppercase tracking-wider text-pine-700 px-1">¿Quién viene a casa?</h2>
      {KIND_OPTIONS.map((opt) => {
        const Icon = opt.icon
        const pending = mutation.isPending && mutation.variables === opt.kind
        return (
          <button
            key={opt.kind}
            type="button"
            disabled={!lotId || mutation.isPending}
            onClick={() => (opt.kind === 'GUEST' ? setKind('GUEST') : mutation.mutate(opt.kind))}
            className={`w-full p-5 rounded-3xl bg-gradient-to-br ${opt.cls} text-white shadow-lg active:scale-[0.98] transition-all flex items-center gap-4 text-left disabled:opacity-50 cursor-pointer`}
          >
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Icon className={`w-8 h-8 ${pending ? 'animate-pulse' : ''}`} />
            </div>
            <div className="flex-1">
              <div className="text-xl font-black">{opt.title}</div>
              <div className="text-xs font-semibold opacity-90">{opt.subtitle}</div>
              <div className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-black/15 text-[11px] font-extrabold">⏱ {opt.ttl}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function PassResult({ pass, onBack }: { pass: InviteResponse; onBack: () => void }) {
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const shareUrl = buildShareUrl(pass)

  useEffect(() => {
    qrDataUrl(shareUrl).then(setQr)
  }, [shareUrl])

  const fileName = `Pase-${pass.villa_id}-${pass.short_code}.png`
  const download = async () => {
    const blob = await generatePassCardBlob(pass)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
  }
  const share = async () => {
    setBusy(true)
    const text =
      `🎄 Tu pase para ${pass.destination_label} (${pass.villa_id})\n` +
      `🔑 Código: *${pass.short_code}*\n` +
      `⏰ Válido hasta ${formatDateTime(pass.valid_until)}\n` +
      `Completa los nombres de tu grupo aquí: ${shareUrl}`
    try {
      const blob = await generatePassCardBlob(pass)
      const file = new File([blob], fileName, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Pase de ingreso', text, files: [file] })
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
      }
    } catch {
      // share cancelado
    } finally {
      setBusy(false)
    }
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // portapapeles no disponible
    }
  }

  return (
    <Card className="p-5 border-2 border-gold-300 ribbon-card">
      <div className="relative flex items-center justify-between">
        <Badge tone="berry">🎁 Pase de {KIND_LABEL[pass.kind]}</Badge>
        <span className="text-xs font-extrabold text-pine-700">hasta {formatTime(pass.valid_until)}</span>
      </div>
      <div className="relative my-4 flex flex-col items-center">
        <div className="p-2 rounded-2xl bg-white border-4 border-gold-300 shadow-md">
          {qr ? <img src={qr} alt={`QR del pase ${pass.short_code}`} className="w-56 h-56" /> : <div className="w-56 h-56" />}
        </div>
        <p className="text-sm font-extrabold text-pine-900 mt-3">{pass.destination_label}</p>
        <p className="text-xs font-semibold text-pine-800/60">{pass.party_size_expected} persona(s)</p>
      </div>
      <div className="relative py-3 rounded-2xl bg-pine-900 text-center mb-4">
        <div className="text-[10px] font-extrabold uppercase tracking-widest text-pine-200">Código manual</div>
        <div className="text-4xl font-black font-mono tracking-[0.25em] pl-3 text-gold-300">{pass.short_code}</div>
      </div>
      <div className="relative space-y-2.5">
        <Button variant="berry" className="w-full" onClick={share} loading={busy}>
          <Share2 className="w-4 h-4" /> Compartir por WhatsApp
        </Button>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="dark" size="sm" onClick={download}>
            <Download className="w-4 h-4 text-gold-300" /> Guardar imagen
          </Button>
          <Button variant="ghost" size="sm" onClick={copy}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? '¡Copiado!' : 'Copiar enlace'}
          </Button>
        </div>
        <Button variant="ghost" className="w-full" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" /> Generar otro pase
        </Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Carnet QR rotativo
// ---------------------------------------------------------------------------
function CarnetTab() {
  const query = useQuery({ queryKey: ['carnet'], queryFn: koloalaApi.myCarnet, staleTime: 0 })
  const [qr, setQr] = useState<string | null>(null)
  const [left, setLeft] = useState(0)

  useEffect(() => {
    if (!query.data) return
    qrDataUrl(query.data.payload, 360).then(setQr)
    setLeft(query.data.expires_in)
    const id = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          clearInterval(id)
          query.refetch()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data])

  if (query.isError) return <Alert tone="error">{errorMessage(query.error, 'No se pudo cargar tu carnet')}</Alert>
  const data = query.data
  const pct = data ? (left / data.window_seconds) * 100 : 0

  return (
    <Card className="p-6 text-center border-2 border-berry-200">
      <span className="font-festive text-3xl text-berry-600">Mi carnet</span>
      <p className="text-lg font-black text-pine-950">{data?.full_name ?? '...'}</p>
      <p className="text-sm font-extrabold text-pine-700">{data?.lots.map((l) => l.lot_id).join(', ')}</p>
      <div className="my-5 mx-auto w-fit p-2 rounded-2xl bg-white border-4 border-pine-600 shadow-lg">
        {qr && data ? <img src={qr} alt="Carnet QR" className="w-64 h-64" /> : <div className="w-64 h-64 animate-pulse bg-pine-50 rounded-xl" />}
      </div>
      <div className="h-2.5 rounded-full bg-pine-100 overflow-hidden" aria-hidden="true">
        <div className="h-full bg-gradient-to-r from-berry-500 via-gold-400 to-pine-500 transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs font-extrabold text-pine-800/70 mt-2" aria-live="polite">
        Se renueva en {left}s • muéstralo al guardia
      </p>
      <p className="text-[11px] text-pine-800/50 font-semibold mt-3">
        El código cambia cada {data?.window_seconds ?? 30} segundos: una captura de pantalla no sirve para otra persona.
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Familia (ANCHOR gestiona HOUSEHOLD)
// ---------------------------------------------------------------------------
function FamilyTab({ lotId, isAnchor }: { lotId: string | null; isAnchor: boolean }) {
  const qc = useQueryClient()
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const members = useQuery({
    queryKey: ['members', lotId],
    queryFn: () => koloalaApi.listLotMembers(lotId as string),
    enabled: !!lotId,
  })
  const add = useMutation({
    mutationFn: () => koloalaApi.addLotMember(lotId as string, { phone: phone.trim(), full_name: name.trim() }),
    onSuccess: () => {
      setPhone('')
      setName('')
      qc.invalidateQueries({ queryKey: ['members', lotId] })
    },
  })
  const remove = useMutation({
    mutationFn: (p: string) => koloalaApi.removeLotMember(lotId as string, p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', lotId] }),
  })

  if (!lotId) return <Alert tone="warn">No tienes un lote activo.</Alert>

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (phone.trim().length >= 9 && name.trim().length >= 2) add.mutate()
  }

  return (
    <div className="space-y-4">
      {isAnchor && (
        <Card className="p-5">
          <form onSubmit={submit} className="space-y-3">
            <h2 className="text-base font-black text-pine-950 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-berry-600" /> Agregar familiar o inquilino
            </h2>
            {add.isError && <Alert tone="error">{errorMessage(add.error, 'No se pudo agregar')}</Alert>}
            <input aria-label="Nombre completo" placeholder="Nombre completo" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            <input
              aria-label="Celular"
              type="tel"
              inputMode="numeric"
              placeholder="Celular (9 dígitos)"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
              className={`${inputClass} font-mono`}
            />
            <Button type="submit" className="w-full" loading={add.isPending}>
              Agregar a Casa {lotId}
            </Button>
            <p className="text-[11px] font-semibold text-pine-800/60">Recibirá su PIN por WhatsApp la primera vez que ingrese.</p>
          </form>
        </Card>
      )}
      <Card className="p-2">
        {members.isError && <div className="p-3"><Alert tone="error">{errorMessage(members.error, 'No se pudo cargar')}</Alert></div>}
        {members.data?.length === 0 && <EmptyState icon={<Users className="w-8 h-8" />}>Aún no hay integrantes.</EmptyState>}
        <ul className="divide-y divide-pine-50">
          {members.data?.map((m) => (
            <li key={m.phone} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="font-extrabold text-pine-950 truncate">{m.full_name}</p>
                <p className="text-xs font-mono text-pine-800/60">{m.phone}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge tone={m.membership_role === 'ANCHOR' ? 'gold' : 'pine'}>
                  {m.membership_role === 'ANCHOR' ? 'Titular' : 'Familiar'}
                </Badge>
                {isAnchor && m.membership_role === 'HOUSEHOLD' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`¿Dar de baja a ${m.full_name}? Su carnet dejará de funcionar.`)) remove.mutate(m.phone)
                    }}
                    className="p-2 rounded-xl text-berry-700 hover:bg-berry-50 cursor-pointer"
                    aria-label={`Dar de baja a ${m.full_name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mis ingresos
// ---------------------------------------------------------------------------
function EntriesTab() {
  const query = useQuery({ queryKey: ['my-entries'], queryFn: koloalaApi.myEntries })
  if (query.isError) return <Alert tone="error">{errorMessage(query.error, 'No se pudo cargar')}</Alert>
  const items = query.data?.items ?? []
  return (
    <Card className="p-2">
      {items.length === 0 ? (
        <EmptyState icon={<History className="w-8 h-8" />}>Todavía no hay ingresos registrados.</EmptyState>
      ) : (
        <ul className="divide-y divide-pine-50">
          {items.map((e, i) => (
            <li key={i} className="flex items-center justify-between p-3">
              <div>
                <p className="font-extrabold text-pine-950">{formatDateTime(e.at)}</p>
                <p className="text-xs font-semibold text-pine-800/60">
                  {e.method === 'QR' ? 'Con carnet' : 'Registro manual'}
                  {e.vehicle_plate ? ` • ${e.vehicle_plate}` : ''}
                </p>
              </div>
              <Badge tone="pine">{e.lots.map((l) => l.lot_id).join(', ')}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
