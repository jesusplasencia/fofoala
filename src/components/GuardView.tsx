import { useMutation, useQuery } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  Home,
  RotateCcw,
  ScanLine,
  Search,
  Shield,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import {
  type AttendeeCheckIn,
  type AuthSession,
  formatTime,
  type GuardPassView,
  KIND_LABEL,
  koloalaApi,
  type ResidentEntryView,
  type Verification,
  VERIFICATION_LABEL,
} from '../lib/api'
import { parseScan } from '../lib/passCard'
import { type AttendeeDraft, AttendeeEditor, emptyAttendee, toAttendeeInputs } from './AttendeeEditor'
import { Alert, AppHeader, Badge, Button, Card, EmptyState, errorMessage, inputClass, Label, Tabs } from './ui'

interface GuardViewProps {
  session: AuthSession
  onLogout: () => void
}

type Tab = 'scan' | 'desk' | 'log'

export function GuardView({ session, onLogout }: GuardViewProps) {
  const [tab, setTab] = useState<Tab>('scan')
  return (
    <div className="min-h-screen xmas-page pb-12">
      <AppHeader eyebrow={`Garita oficial • ${session.villa_id}`} title={`Vigilante ${session.username}`} icon={<Shield className="w-6 h-6" />} onLogout={onLogout}>
        <Tabs
          dark
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'scan', label: 'Escanear', icon: <ScanLine className="w-4 h-4" /> },
            { id: 'desk', label: 'Mesa', icon: <UserPlus className="w-4 h-4" /> },
            { id: 'log', label: 'Bitácora', icon: <ClipboardList className="w-4 h-4" /> },
          ]}
        />
      </AppHeader>
      <main className="relative z-10 max-w-xl mx-auto px-4 pt-5 space-y-5">
        {tab === 'scan' && <ScanTab />}
        {tab === 'desk' && <DeskTab />}
        {tab === 'log' && <LogTab />}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Escanear: carnet de residente o pase de visita
// ---------------------------------------------------------------------------
function ScanTab() {
  const [manual, setManual] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [resident, setResident] = useState<ResidentEntryView | null>(null)
  const [pass, setPass] = useState<GuardPassView | null>(null)
  const [passRef, setPassRef] = useState<string | null>(null)
  const [showManualResident, setShowManualResident] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)

  const residentMut = useMutation({
    mutationFn: koloalaApi.residentEntry,
    onSuccess: (r) => setResident(r),
  })
  const lookupMut = useMutation({
    mutationFn: (ref: string) => koloalaApi.guardLookup(ref),
    onSuccess: (p, ref) => {
      setPass(p)
      setPassRef(ref)
    },
  })

  const clear = () => {
    setResident(null)
    setPass(null)
    setPassRef(null)
    setManual('')
    residentMut.reset()
    lookupMut.reset()
  }

  const handleText = (text: string) => {
    clear()
    const parsed = parseScan(text)
    if (parsed.type === 'carnet') residentMut.mutate({ qr_payload: parsed.payload })
    else if (parsed.type === 'visit') lookupMut.mutate(parsed.ref)
    else setCameraError('No reconocemos ese código. Prueba con el código de 6 caracteres.')
  }

  const stopScanner = async () => {
    const s = scannerRef.current
    scannerRef.current = null
    if (s) {
      try {
        if (s.isScanning) await s.stop()
        s.clear()
      } catch {
        // ignore
      }
    }
    setScannerOpen(false)
  }

  const startScanner = () => {
    setCameraError(null)
    setScannerOpen(true)
    setTimeout(async () => {
      try {
        const s = new Html5Qrcode('garita-qr-reader')
        scannerRef.current = s
        await s.start(
          { facingMode: 'environment' },
          { fps: 12, qrbox: { width: 240, height: 240 } },
          async (decoded) => {
            await stopScanner()
            handleText(decoded)
          },
          () => {},
        )
      } catch {
        setCameraError('No se pudo abrir la cámara. Da permiso al navegador o escribe el código.')
        setScannerOpen(false)
      }
    }, 80)
  }

  useEffect(
    () => () => {
      if (scannerRef.current?.isScanning) scannerRef.current.stop().catch(() => {})
    },
    [],
  )

  const busy = residentMut.isPending || lookupMut.isPending
  const err = residentMut.error || lookupMut.error

  return (
    <div className="space-y-5">
      {err && (
        <div className="rounded-3xl p-5 border-4 border-berry-500 bg-berry-50">
          <div className="flex items-start gap-3">
            <XCircle className="w-10 h-10 text-berry-600 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-widest text-berry-700">No abrir</p>
              <p className="text-lg font-black text-berry-900">{errorMessage(err, 'Código no válido')}</p>
            </div>
          </div>
          <Button variant="berry" className="w-full mt-4" onClick={clear}>
            <RotateCcw className="w-4 h-4" /> Intentar de nuevo
          </Button>
        </div>
      )}

      {resident && <ResidentResult r={resident} onNext={clear} />}
      {pass && passRef && <PassCheckIn pass={pass} passRef={passRef} onDone={clear} />}

      {!resident && !pass && (
        <>
          {cameraError && <Alert tone="warn" onClose={() => setCameraError(null)}>{cameraError}</Alert>}
          {scannerOpen ? (
            <Card className="p-4 space-y-3 border-2 border-gold-400">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-pine-700">Apunta al QR o carnet</span>
                <Button variant="berry" size="sm" onClick={stopScanner}>
                  <CameraOff className="w-4 h-4" /> Cerrar
                </Button>
              </div>
              <div id="garita-qr-reader" className="w-full overflow-hidden rounded-2xl bg-black min-h-[260px]" />
            </Card>
          ) : (
            <Button size="lg" className="w-full py-6 text-lg" onClick={startScanner} loading={busy}>
              <Camera className="w-7 h-7" /> Escanear QR o carnet
            </Button>
          )}

          <Card className="p-5">
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault()
                if (manual.trim()) handleText(manual)
              }}
              className="space-y-3"
            >
              <Label htmlFor="manual-code">O escribe el código del pase</Label>
              <div className="flex gap-2">
                <input
                  id="manual-code"
                  maxLength={80}
                  placeholder="EJ: 9X4K2M"
                  value={manual}
                  onChange={(e) => setManual(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  className={`${inputClass} font-mono text-xl tracking-[0.25em] uppercase text-center`}
                />
                <Button type="submit" variant="gold" loading={busy} aria-label="Buscar pase">
                  <Search className="w-5 h-5" />
                </Button>
              </div>
            </form>
          </Card>

          <button
            type="button"
            onClick={() => setShowManualResident((v) => !v)}
            className="w-full text-sm font-extrabold text-berry-700 hover:underline cursor-pointer"
          >
            {showManualResident ? 'Ocultar' : '¿Residente sin celular? Registrar a mano'}
          </button>
          {showManualResident && (
            <ManualResident onDone={(r) => setResident(r)} />
          )}
        </>
      )}
    </div>
  )
}

function ManualResident({ onDone }: { onDone: (r: ResidentEntryView) => void }) {
  const [phone, setPhone] = useState('')
  const [lot, setLot] = useState('')
  const mut = useMutation({
    mutationFn: () => koloalaApi.residentEntry({ phone: phone.trim(), lot_id: lot.trim() }),
    onSuccess: onDone,
  })
  return (
    <Card className="p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (phone.length === 9 && lot.trim()) mut.mutate()
        }}
        className="space-y-3"
      >
        {mut.isError && <Alert tone="error">{errorMessage(mut.error, 'No encontrado')}</Alert>}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="mr-lot">Lote</Label>
            <input id="mr-lot" placeholder="P20" value={lot} onChange={(e) => setLot(e.target.value.toUpperCase())} className={`${inputClass} uppercase`} />
          </div>
          <div>
            <Label htmlFor="mr-phone">Celular que dicta</Label>
            <input
              id="mr-phone"
              inputMode="numeric"
              placeholder="9XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
              className={`${inputClass} font-mono`}
            />
          </div>
        </div>
        <Button type="submit" variant="gold" className="w-full" loading={mut.isPending}>
          Registrar ingreso del residente
        </Button>
      </form>
    </Card>
  )
}

function ResidentResult({ r, onNext }: { r: ResidentEntryView; onNext: () => void }) {
  return (
    <div className="rounded-3xl p-6 border-4 border-pine-500 bg-pine-50 shadow-xl">
      <div className="flex items-start gap-4">
        <CheckCircle2 className="w-14 h-14 text-pine-600 shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-black uppercase tracking-widest text-pine-700">Abrir • ingreso registrado {formatTime(r.at)}</p>
          <p className="text-2xl font-black text-pine-950 leading-tight mt-1">{r.message}</p>
          {r.warnings.map((w) => (
            <p key={w} className="mt-2 text-sm font-extrabold text-gold-700 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> {w}
            </p>
          ))}
        </div>
      </div>
      <Button className="w-full mt-5" size="lg" onClick={onNext}>
        <RotateCcw className="w-5 h-5" /> Siguiente
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Check-in de un pase de visita (grupo)
// ---------------------------------------------------------------------------
type RowState = { enters: boolean; verification: Verification | ''; vouchedBy: string }

function PassCheckIn({ pass, passRef, onDone }: { pass: GuardPassView; passRef: string; onDone: () => void }) {
  const needsPlate = pass.kind === 'TAXI' || pass.kind === 'DELIVERY'
  const [rows, setRows] = useState<Record<number, RowState>>(() =>
    Object.fromEntries(pass.attendees.map((a) => [a.attendee_no, { enters: true, verification: '', vouchedBy: '' }])),
  )
  const [extra, setExtra] = useState<AttendeeDraft[]>(pass.attendees.length === 0 ? [emptyAttendee()] : [])
  const [plate, setPlate] = useState(pass.vehicle_plate ?? '')
  const [done, setDone] = useState<GuardPassView | null>(null)

  const mut = useMutation({
    mutationFn: () => {
      const entries: AttendeeCheckIn[] = pass.attendees
        .filter((a) => rows[a.attendee_no]?.enters)
        .map((a) => {
          const r = rows[a.attendee_no]
          return {
            attendee_no: a.attendee_no,
            verification: r.vouchedBy ? 'VOUCHED' : r.verification || null,
            vouched_by_no: r.vouchedBy ? Number(r.vouchedBy) : null,
          }
        })
      toAttendeeInputs(extra).forEach((p) => entries.push({ person: p }))
      return koloalaApi.guardCheckIn(passRef, entries, plate.trim() || null)
    },
    onSuccess: setDone,
  })

  if (done) {
    const inCount = done.attendees.filter((a) => a.checked_in_at).length
    return (
      <div className="rounded-3xl p-6 border-4 border-pine-500 bg-pine-50 shadow-xl">
        <div className="flex items-start gap-4">
          <CheckCircle2 className="w-14 h-14 text-pine-600 shrink-0" />
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-pine-700">Abrir tranquera</p>
            <p className="text-2xl font-black text-pine-950">{inCount} persona(s) → {done.destination_label}</p>
          </div>
        </div>
        <Button className="w-full mt-5" size="lg" onClick={onDone}>
          <RotateCcw className="w-5 h-5" /> Siguiente
        </Button>
      </div>
    )
  }

  const canEnter = pass.authorized
  const totalEntering = pass.attendees.filter((a) => rows[a.attendee_no]?.enters).length + toAttendeeInputs(extra).length

  return (
    <Card className={`p-5 space-y-4 border-4 ${canEnter ? 'border-gold-400' : 'border-berry-500'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge tone={pass.kind === 'GUEST' ? 'pine' : pass.kind === 'TAXI' ? 'gold' : 'berry'}>{KIND_LABEL[pass.kind]}</Badge>
          <p className="text-2xl font-black text-pine-950 mt-1">{pass.destination_label}</p>
          <p className="text-sm font-bold text-pine-800/70">
            {pass.host_name ? `Invita: ${pass.host_name}` : pass.origin === 'PUBLIC_KIOSK' ? 'Pase del cartel de garita' : 'Registro de garita'}
            {' • '}hasta {formatTime(pass.valid_until)}
          </p>
        </div>
        <span className="font-mono font-black text-lg text-berry-700">{pass.short_code}</span>
      </div>

      {!canEnter && <Alert tone="error">{pass.message}</Alert>}

      {canEnter && (
        <>
          {pass.attendees.length > 0 && (
            <div className="space-y-2">
              <Label>Personas del pase</Label>
              {pass.attendees.map((a) => {
                const r = rows[a.attendee_no]
                const set = (patch: Partial<RowState>) => setRows((s) => ({ ...s, [a.attendee_no]: { ...s[a.attendee_no], ...patch } }))
                return (
                  <div key={a.attendee_no} className={`rounded-2xl border-2 p-3 ${r.enters ? 'border-pine-200 bg-pine-50/50' : 'border-pine-100 opacity-60'}`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={r.enters} onChange={(e) => set({ enters: e.target.checked })} className="w-5 h-5 accent-pine-600" />
                      <span className="flex-1 min-w-0">
                        <span className="block font-extrabold text-pine-950 truncate">{a.full_name}</span>
                        <span className="block text-xs font-mono text-pine-800/60">
                          {a.doc_display ? `${a.doc_type} ${a.doc_display}` : 'Sin documento'}
                        </span>
                      </span>
                    </label>
                    {r.enters && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <select
                          aria-label={`Cómo se identificó ${a.full_name}`}
                          value={r.vouchedBy ? 'VOUCHED' : r.verification}
                          onChange={(e) => set({ verification: e.target.value as Verification | '', vouchedBy: e.target.value === 'VOUCHED' ? r.vouchedBy : '' })}
                          className={`${inputClass} !py-2 text-sm`}
                        >
                          <option value="">Automático</option>
                          {(Object.keys(VERIFICATION_LABEL) as Verification[]).map((v) => (
                            <option key={v} value={v}>
                              {VERIFICATION_LABEL[v]}
                            </option>
                          ))}
                        </select>
                        {(r.verification === 'VOUCHED' || r.vouchedBy) && (
                          <select
                            aria-label="Avalado por"
                            value={r.vouchedBy}
                            onChange={(e) => set({ vouchedBy: e.target.value })}
                            className={`${inputClass} !py-2 text-sm`}
                          >
                            <option value="">¿Quién responde?</option>
                            {pass.attendees
                              .filter((o) => o.attendee_no !== a.attendee_no)
                              .map((o) => (
                                <option key={o.attendee_no} value={o.attendee_no}>
                                  {o.full_name}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <details open={pass.attendees.length === 0} className="rounded-2xl bg-gold-50 border-2 border-gold-200 p-3">
            <summary className="text-sm font-extrabold text-pine-900 cursor-pointer">Agregar personas que llegaron</summary>
            <div className="mt-3">
              <AttendeeEditor rows={extra} onChange={setExtra} minRows={0} />
            </div>
          </details>

          <div>
            <Label htmlFor="plate">Placa {needsPlate ? '(obligatoria)' : '(opcional)'}</Label>
            <input
              id="plate"
              maxLength={10}
              placeholder="ABC-123"
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              className={`${inputClass} font-mono uppercase ${needsPlate && !plate ? '!border-gold-400' : ''}`}
            />
          </div>

          {mut.isError && <Alert tone="error">{errorMessage(mut.error, 'No se pudo registrar')}</Alert>}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={onDone}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              size="lg"
              loading={mut.isPending}
              disabled={totalEntering === 0 || (needsPlate && !plate.trim())}
              onClick={() => mut.mutate()}
            >
              Dejar pasar ({totalEntering})
            </Button>
          </div>
        </>
      )}
      {!canEnter && (
        <Button variant="ghost" className="w-full" onClick={onDone}>
          <RotateCcw className="w-4 h-4" /> Volver
        </Button>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Mesa del guardia: quien llega sin celular
// ---------------------------------------------------------------------------
function DeskTab() {
  const catalog = useQuery({ queryKey: ['public-villa'], queryFn: koloalaApi.publicVilla })
  const [dest, setDest] = useState('')
  const [customLot, setCustomLot] = useState('')
  const [rows, setRows] = useState<AttendeeDraft[]>([emptyAttendee()])
  const [plate, setPlate] = useState('')
  const [done, setDone] = useState<GuardPassView | null>(null)
  const destination = dest === '__LOT__' ? customLot.trim() : dest

  const mut = useMutation({
    mutationFn: () =>
      koloalaApi.guardDesk(
        destination,
        toAttendeeInputs(rows).map((p) => ({ person: p })),
        plate.trim() || null,
      ),
    onSuccess: (r) => {
      setDone(r)
      setRows([emptyAttendee()])
      setPlate('')
    },
  })

  return (
    <div className="space-y-4">
      {done && (
        <Alert tone="success" onClose={() => setDone(null)}>
          Ingresaron {done.attendees.length} persona(s) a {done.destination_label}. Código {done.short_code}.
        </Alert>
      )}
      <Card className="p-5 space-y-4">
        <h2 className="text-base font-black text-pine-950">Registrar visita en mesa</h2>
        <p className="text-xs font-semibold text-pine-800/70 -mt-2">Para quien no tiene celular. Mismo formulario que el cartel de garita.</p>
        {mut.isError && <Alert tone="error">{errorMessage(mut.error, 'No se pudo registrar')}</Alert>}
        <div>
          <Label htmlFor="desk-dest">¿A dónde va?</Label>
          <select id="desk-dest" value={dest} onChange={(e) => setDest(e.target.value)} className={inputClass}>
            <option value="">Elige un destino</option>
            {catalog.data?.catalog.map((c) => (
              <option key={c.lot_id} value={c.lot_id}>
                {c.display_name}
              </option>
            ))}
            <option value="__LOT__">Una casa (escribir lote)</option>
          </select>
          {dest === '__LOT__' && (
            <input
              aria-label="Lote"
              placeholder="Ej. P20"
              value={customLot}
              onChange={(e) => setCustomLot(e.target.value.toUpperCase())}
              className={`${inputClass} mt-2 uppercase`}
            />
          )}
        </div>
        <AttendeeEditor rows={rows} onChange={setRows} />
        <div>
          <Label htmlFor="desk-plate">Placa (opcional)</Label>
          <input id="desk-plate" placeholder="ABC-123" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} className={`${inputClass} font-mono uppercase`} />
        </div>
        <Button
          size="lg"
          className="w-full"
          loading={mut.isPending}
          disabled={!destination || toAttendeeInputs(rows).length === 0}
          onClick={() => mut.mutate()}
        >
          Registrar y dejar pasar
        </Button>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bitácora 24 h (DNI enmascarado salvo "mostrar", que queda auditado)
// ---------------------------------------------------------------------------
function LogTab() {
  const [reveal, setReveal] = useState(false)
  const log = useQuery({ queryKey: ['daily-log', reveal], queryFn: () => koloalaApi.dailyLog(reveal), refetchInterval: 30_000 })
  const d = log.data

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Visitas', d?.total_people_in ?? 0, 'text-berry-600'],
          ['Pases', d?.checked_in_passes ?? 0, 'text-gold-600'],
          ['Residentes', d?.resident_entries ?? 0, 'text-pine-600'],
        ].map(([label, n, cls]) => (
          <Card key={label as string} className="p-3 text-center">
            <p className={`text-3xl font-black ${cls}`}>{n as number}</p>
            <p className="text-[11px] font-extrabold uppercase text-pine-800/60">{label as string}</p>
          </Card>
        ))}
      </div>
      <div className="flex justify-end">
        <Button
          variant={reveal ? 'berry' : 'ghost'}
          size="sm"
          onClick={() => {
            if (reveal || window.confirm('Ver DNIs completos queda registrado a tu nombre. ¿Continuar?')) setReveal(!reveal)
          }}
        >
          {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {reveal ? 'Ocultar DNIs' : 'Mostrar DNIs'}
        </Button>
      </div>
      {log.isError && <Alert tone="error">{errorMessage(log.error, 'No se pudo cargar')}</Alert>}

      <Card className="p-2">
        {!d || (d.items.length === 0 && d.resident_items.length === 0) ? (
          <EmptyState icon={<ClipboardList className="w-8 h-8" />}>Sin movimientos en las últimas 24 horas.</EmptyState>
        ) : (
          <ul className="divide-y divide-pine-50">
            {d.resident_items.map((r, i) => (
              <li key={`r${i}`} className="p-3 flex items-center gap-3">
                <Home className="w-5 h-5 text-pine-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-pine-950 truncate">{r.message}</p>
                  <p className="text-xs font-semibold text-pine-800/60">{r.method === 'QR' ? 'Carnet' : 'Manual'}{r.vehicle_plate ? ` • ${r.vehicle_plate}` : ''}</p>
                </div>
                <span className="text-xs font-black text-pine-700">{formatTime(r.at)}</span>
              </li>
            ))}
            {d.items.map((p) => (
              <li key={p.short_code} className="p-3">
                <div className="flex items-center gap-2">
                  <Badge tone={p.checked_in_at ? 'pine' : p.status === 'EXPIRED' ? 'muted' : 'gold'}>
                    {p.checked_in_at ? 'Ingresó' : p.status === 'EXPIRED' ? 'Vencido' : 'Pendiente'}
                  </Badge>
                  <span className="font-extrabold text-pine-950 flex-1 truncate">{p.destination_label}</span>
                  <span className="text-xs font-black text-pine-700">{formatTime(p.checked_in_at ?? p.created_at)}</span>
                </div>
                {p.attendees.length > 0 && (
                  <ul className="mt-1.5 ml-1 space-y-0.5">
                    {p.attendees.map((a) => (
                      <li key={a.attendee_no} className="text-xs text-pine-900 font-semibold">
                        {a.full_name}
                        <span className="font-mono text-pine-800/60"> {a.doc_display ?? '—'}</span>
                        {a.verification && <span className="text-berry-700"> • {VERIFICATION_LABEL[a.verification]}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
