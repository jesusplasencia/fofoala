import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Home,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Store,
  TreePine,
  Unlock,
  Upload,
  X,
} from 'lucide-react'
import { type ChangeEvent, type FormEvent, useRef, useState } from 'react'
import {
  type AccessSearchResponse,
  type AuthSession,
  formatDateTime,
  koloalaApi,
  type LotType,
  type PropertyLotResponse,
  VERIFICATION_LABEL,
} from '../lib/api'
import { ChangePasswordButton } from './ChangePassword'
import { Alert, AppHeader, Badge, Button, Card, EmptyState, errorMessage, inputClass, Label, Tabs } from './ui'

interface AdminViewProps {
  session: AuthSession
  onLogout: () => void
  onSwitchToResident?: () => void
}

type Tab = 'lots' | 'catalog' | 'search' | 'security'

export function AdminView({ session, onLogout, onSwitchToResident }: AdminViewProps) {
  const [tab, setTab] = useState<Tab>('lots')
  return (
    <div className="min-h-screen xmas-page pb-14">
      <AppHeader
        wide
        eyebrow={`${session.role === 'SUPER_ADMIN' ? 'Super admin' : 'Junta directiva'} • ${session.villa_id}`}
        title="Panel de administración"
        icon={<TreePine className="w-6 h-6" />}
        onLogout={onLogout} actions={<ChangePasswordButton />}
      >
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Tabs
              dark
              active={tab}
              onChange={setTab}
              tabs={[
                { id: 'lots', label: 'Padrón', icon: <Building2 className="w-4 h-4" /> },
                { id: 'catalog', label: 'Catálogo', icon: <Store className="w-4 h-4" /> },
                { id: 'search', label: 'Incidentes', icon: <Search className="w-4 h-4" /> },
                { id: 'security', label: 'Seguridad', icon: <ShieldAlert className="w-4 h-4" /> },
              ]}
            />
          </div>
          {onSwitchToResident && (
            <Button variant="gold" size="sm" onClick={onSwitchToResident}>
              <Home className="w-4 h-4" /> Mi casa
            </Button>
          )}
        </div>
      </AppHeader>
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {tab === 'lots' && <LotsTab villaId={session.villa_id} />}
        {tab === 'catalog' && <CatalogTab />}
        {tab === 'search' && <SearchTab />}
        {tab === 'security' && <SecurityTab villaId={session.villa_id} />}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Padrón de lotes
// ---------------------------------------------------------------------------
type LotRow = { lot_id: string; owner_name: string; owner_phone?: string; is_maintenance_up_to_date: boolean }

function parseLotsCsv(text: string): LotRow[] {
  const out: LotRow[] = []
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const cols = line.split(/[;,]/).map((c) => c.trim().replace(/^"|"$/g, ''))
      if (cols.length < 2 || (i === 0 && /lote|lot_id/i.test(cols[0]))) return
      const status = (cols[3] || 'true').toLowerCase()
      out.push({
        lot_id: cols[0].toUpperCase(),
        owner_name: cols[1] || 'Propietario',
        owner_phone: cols[2] || undefined,
        is_maintenance_up_to_date: !['false', '0', 'no', 'mora', 'deuda'].includes(status),
      })
    })
  return out.filter((l) => l.lot_id.length >= 2)
}

function LotsTab({ villaId }: { villaId: string }) {
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<boolean | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [newLot, setNewLot] = useState({ lot_id: '', owner_name: '', owner_phone: '', ok: true })
  const fileRef = useRef<HTMLInputElement | null>(null)

  const lots = useQuery({ queryKey: ['lots', villaId, page, filter], queryFn: () => koloalaApi.listLots(page, 50, filter) })
  const refresh = () => qc.invalidateQueries({ queryKey: ['lots'] })

  const toggle = useMutation({
    mutationFn: (l: PropertyLotResponse) => koloalaApi.toggleLotMaintenance(l.lot_id, !l.is_maintenance_up_to_date),
    onSuccess: refresh,
  })
  const save = useMutation({
    mutationFn: (l: PropertyLotResponse) =>
      koloalaApi.updateLotDetails(l.lot_id, {
        is_maintenance_up_to_date: l.is_maintenance_up_to_date,
        owner_name: editName.trim(),
        owner_phone: editPhone.trim() || '',
      }),
    onSuccess: () => {
      refresh()
      setEditing(null)
    },
  })
  const resetPin = useMutation({
    mutationFn: (lotId: string) => koloalaApi.resetLotPassword(lotId),
    onSuccess: (c) =>
      setSummary(`Acceso restablecido para ${c.lot_id} (${c.owner_name}). Al ingresar confirmará su WhatsApp y recibirá un PIN nuevo.`),
  })
  const bulk = useMutation({
    mutationFn: (rows: LotRow[]) => koloalaApi.bulkImportLots(rows),
    onSuccess: (r) => {
      refresh()
      setSummary(`Padrón actualizado: ${r.processed_count} lotes (${r.created_count} nuevos, ${r.updated_count} actualizados).`)
    },
  })

  const onCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const rows = parseLotsCsv(await f.text())
    if (rows.length) bulk.mutate(rows)
  }

  const addLot = (e: FormEvent) => {
    e.preventDefault()
    if (!newLot.lot_id.trim() || !newLot.owner_name.trim()) return
    bulk.mutate([
      {
        lot_id: newLot.lot_id.trim().toUpperCase(),
        owner_name: newLot.owner_name.trim(),
        owner_phone: newLot.owner_phone.trim() || undefined,
        is_maintenance_up_to_date: newLot.ok,
      },
    ])
    setNewLot({ lot_id: '', owner_name: '', owner_phone: '', ok: true })
  }

  const residential = (lots.data?.items ?? []).filter((l) => !l.lot_type || l.lot_type === 'LOT')

  return (
    <>
      {summary && <Alert tone="success" onClose={() => setSummary(null)}>{summary}</Alert>}
      {(bulk.isError || toggle.isError || save.isError || resetPin.isError) && (
        <Alert tone="error">{errorMessage(bulk.error || toggle.error || save.error || resetPin.error, 'Ocurrió un error')}</Alert>
      )}

      <Card className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-pine-950">Alta de lotes y carga masiva</h2>
            <p className="text-xs font-semibold text-pine-800/60">
              CSV: <code className="font-mono">lote,propietario,telefono,aldia</code>
            </p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={onCsv} className="hidden" />
          <Button variant="dark" size="sm" loading={bulk.isPending} onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 text-gold-300" /> Importar CSV
          </Button>
        </div>
        <form onSubmit={addLot} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div>
            <Label htmlFor="nl-id">Lote</Label>
            <input id="nl-id" placeholder="P21" value={newLot.lot_id} onChange={(e) => setNewLot({ ...newLot, lot_id: e.target.value.toUpperCase() })} className={`${inputClass} uppercase`} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="nl-name">Propietario</Label>
            <input id="nl-name" placeholder="Familia Torres" value={newLot.owner_name} onChange={(e) => setNewLot({ ...newLot, owner_name: e.target.value })} className={inputClass} />
          </div>
          <div>
            <Label htmlFor="nl-phone">WhatsApp</Label>
            <input id="nl-phone" placeholder="987654321" value={newLot.owner_phone} onChange={(e) => setNewLot({ ...newLot, owner_phone: e.target.value })} className={`${inputClass} font-mono`} />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-extrabold text-pine-800 cursor-pointer">
              <input type="checkbox" checked={newLot.ok} onChange={(e) => setNewLot({ ...newLot, ok: e.target.checked })} className="w-4 h-4 accent-pine-600" />
              Al día
            </label>
            <Button type="submit" size="sm" className="flex-1">
              <Plus className="w-4 h-4" /> Agregar
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-pine-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {(
              [
                [null, 'Todos'],
                [true, 'Al día'],
                [false, 'Con deuda'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setFilter(v)
                  setPage(0)
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                  filter === v ? (v === false ? 'bg-berry-600 text-white' : 'bg-pine-700 text-white') : 'bg-pine-50 text-pine-800 hover:bg-pine-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => lots.refetch()} className="p-2 rounded-xl bg-pine-50 hover:bg-pine-100 text-pine-700 cursor-pointer" aria-label="Actualizar">
            <RefreshCw className={`w-4 h-4 ${lots.isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gold-50 text-[11px] font-extrabold uppercase tracking-wider text-pine-800">
                <th className="py-3 px-5">Lote</th>
                <th className="py-3 px-5">Propietario</th>
                <th className="py-3 px-5">Teléfono</th>
                <th className="py-3 px-5">Mantenimiento</th>
                <th className="py-3 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pine-50">
              {residential.map((lot) => {
                const isEd = editing === lot.lot_id
                return (
                  <tr key={lot.lot_id} className={isEd ? 'bg-gold-50/60' : 'hover:bg-snow'}>
                    <td className="py-3 px-5 font-black font-mono text-base text-pine-950">{lot.lot_id}</td>
                    <td className="py-3 px-5 font-bold text-pine-900">
                      {isEd ? <input autoFocus aria-label="Propietario" value={editName} onChange={(e) => setEditName(e.target.value)} className={`${inputClass} !py-1.5`} /> : lot.owner_name}
                    </td>
                    <td className="py-3 px-5 font-mono text-xs text-pine-800/70">
                      {isEd ? <input aria-label="Teléfono" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className={`${inputClass} !py-1.5 !w-36`} /> : lot.owner_phone || '—'}
                    </td>
                    <td className="py-3 px-5">
                      <button type="button" onClick={() => toggle.mutate(lot)} className="cursor-pointer" title="Cambiar estado">
                        <Badge tone={lot.is_maintenance_up_to_date ? 'pine' : 'berry'}>{lot.is_maintenance_up_to_date ? '✓ Al día' : '✗ En mora'}</Badge>
                      </button>
                    </td>
                    <td className="py-3 px-5 text-right whitespace-nowrap">
                      {isEd ? (
                        <span className="inline-flex gap-1">
                          <Button size="sm" loading={save.isPending} onClick={() => editName.trim().length >= 2 && save.mutate(lot)} aria-label="Guardar">
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)} aria-label="Cancelar">
                            <X className="w-4 h-4" />
                          </Button>
                        </span>
                      ) : (
                        <span className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => resetPin.mutate(lot.lot_id)} title="Restablecer acceso por WhatsApp">
                            <KeyRound className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Editar ${lot.lot_id}`}
                            onClick={() => {
                              setEditing(lot.lot_id)
                              setEditName(lot.owner_name)
                              setEditPhone(lot.owner_phone || '')
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {lots.data && lots.data.total_pages > 1 && (
          <div className="px-5 py-3 bg-snow border-t border-pine-50 flex items-center justify-between text-xs font-extrabold text-pine-800">
            <span>
              Página {lots.data.page + 1} de {lots.data.total_pages}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Anterior">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" disabled={!lots.data.has_next} onClick={() => setPage((p) => p + 1)} aria-label="Siguiente">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------
// Catálogo: MiniLotes (ML) y áreas comunes (CA)
// ---------------------------------------------------------------------------
function CatalogTab() {
  const qc = useQueryClient()
  const catalog = useQuery({ queryKey: ['public-villa'], queryFn: koloalaApi.publicVilla })
  const [row, setRow] = useState<{ lot_id: string; display_name: string; lot_type: LotType }>({ lot_id: '', display_name: '', lot_type: 'MINI_LOT' })
  const [csv, setCsv] = useState('')
  const mut = useMutation({
    mutationFn: koloalaApi.bulkCatalog,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['public-villa'] })
      setRow({ lot_id: '', display_name: '', lot_type: 'MINI_LOT' })
      setCsv('')
    },
  })
  const hide = (lot_id: string, display_name: string, lot_type: LotType) =>
    mut.mutate([{ lot_id, display_name, lot_type, is_public: false }])

  const submitCsv = () => {
    const items = csv
      .split(/\r?\n/)
      .map((l) => l.split(/[;,]/).map((c) => c.trim()))
      .filter((c) => c[0] && c[1])
      .map(([lot_id, display_name]) => ({
        lot_id: lot_id.toUpperCase(),
        display_name,
        lot_type: (lot_id.toUpperCase().startsWith('CA') ? 'COMMON_AREA' : 'MINI_LOT') as LotType,
        is_public: true,
      }))
    if (items.length) mut.mutate(items)
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="p-5 space-y-4">
        <h2 className="text-base font-black text-pine-950">Agregar a la vitrina</h2>
        <p className="text-xs font-semibold text-pine-800/60 -mt-2">
          Negocios con prefijo <strong>ML</strong> (ML01 Panadería) y áreas comunes con <strong>CA</strong> (CA01 Canchita).
        </p>
        {mut.isError && <Alert tone="error">{errorMessage(mut.error, 'No se pudo guardar')}</Alert>}
        <div className="grid grid-cols-3 gap-2">
          <input aria-label="Código" placeholder="ML03" value={row.lot_id} onChange={(e) => setRow({ ...row, lot_id: e.target.value.toUpperCase() })} className={`${inputClass} uppercase`} />
          <input aria-label="Nombre" placeholder="Bodega Don Pepe" value={row.display_name} onChange={(e) => setRow({ ...row, display_name: e.target.value })} className={`${inputClass} col-span-2`} />
        </div>
        <select aria-label="Tipo" value={row.lot_type} onChange={(e) => setRow({ ...row, lot_type: e.target.value as LotType })} className={inputClass}>
          <option value="MINI_LOT">Negocio (MiniLote)</option>
          <option value="COMMON_AREA">Área común / municipal</option>
        </select>
        <Button
          className="w-full"
          loading={mut.isPending}
          disabled={row.lot_id.length < 2 || row.display_name.trim().length < 2}
          onClick={() => mut.mutate([{ ...row, display_name: row.display_name.trim(), is_public: true }])}
        >
          <Plus className="w-4 h-4" /> Guardar en catálogo
        </Button>
        <details className="rounded-2xl bg-gold-50 border-2 border-gold-200 p-3">
          <summary className="text-sm font-extrabold text-pine-900 cursor-pointer">Carga masiva (una línea por ítem)</summary>
          <textarea
            aria-label="Carga masiva"
            rows={5}
            placeholder={'ML01,Panadería\nML02,Botica\nCA01,Canchita de Fútbol 1'}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            className={`${inputClass} mt-2 font-mono text-sm`}
          />
          <Button variant="dark" size="sm" className="mt-2" onClick={submitCsv} loading={mut.isPending}>
            <Upload className="w-4 h-4 text-gold-300" /> Cargar
          </Button>
        </details>
      </Card>
      <Card className="p-2">
        <p className="px-3 pt-3 text-xs font-extrabold uppercase tracking-wider text-pine-700">Lo que ve el visitante</p>
        {catalog.data?.catalog.length === 0 && <EmptyState icon={<Store className="w-8 h-8" />}>El catálogo está vacío.</EmptyState>}
        <ul className="divide-y divide-pine-50">
          {catalog.data?.catalog.map((c) => (
            <li key={c.lot_id} className="flex items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono font-black text-berry-700 w-12">{c.lot_id}</span>
                <span className="font-extrabold text-pine-950 truncate">{c.display_name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge tone={c.lot_type === 'COMMON_AREA' ? 'pine' : 'gold'}>{c.lot_type === 'COMMON_AREA' ? 'Área común' : 'Negocio'}</Badge>
                <button
                  type="button"
                  onClick={() => hide(c.lot_id, c.display_name, c.lot_type)}
                  className="text-xs font-extrabold text-berry-700 hover:underline cursor-pointer"
                >
                  Ocultar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Búsqueda de incidentes (auditada)
// ---------------------------------------------------------------------------
function SearchTab() {
  const [f, setF] = useState({ date_from: '', date_to: '', dni: '', plate: '', destination: '' })
  const [result, setResult] = useState<AccessSearchResponse | null>(null)
  const mut = useMutation({
    mutationFn: () =>
      koloalaApi.accessSearch({
        ...f,
        date_from: f.date_from ? new Date(f.date_from).toISOString() : '',
        date_to: f.date_to ? new Date(f.date_to).toISOString() : '',
      }),
    onSuccess: setResult,
  })
  const field = (key: keyof typeof f, label: string, type = 'text', ph = '') => (
    <div>
      <Label htmlFor={`s-${key}`}>{label}</Label>
      <input id={`s-${key}`} type={type} placeholder={ph} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} className={inputClass} />
    </div>
  )

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            mut.mutate()
          }}
          className="space-y-4"
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {field('date_from', 'Desde', 'datetime-local')}
            {field('date_to', 'Hasta', 'datetime-local')}
            {field('dni', 'DNI', 'text', '45891230')}
            {field('plate', 'Placa', 'text', 'ABC-123')}
            {field('destination', 'Destino', 'text', 'P20 / ML01')}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-pine-800/60">Cada búsqueda queda registrada en la bitácora de acceso a datos.</p>
            <Button type="submit" variant="berry" loading={mut.isPending}>
              <Search className="w-4 h-4" /> Buscar
            </Button>
          </div>
        </form>
      </Card>
      {mut.isError && <Alert tone="error">{errorMessage(mut.error, 'No se pudo buscar')}</Alert>}
      {result && (
        <Card className="p-2">
          {result.items.length === 0 && result.resident_entries.length === 0 ? (
            <EmptyState icon={<Search className="w-8 h-8" />}>Sin resultados.</EmptyState>
          ) : (
            <ul className="divide-y divide-pine-50">
              {result.resident_entries.map((r, i) => (
                <li key={`r${i}`} className="p-3 flex items-center justify-between gap-3">
                  <span className="font-extrabold text-pine-950">{r.message}</span>
                  <span className="text-xs font-black text-pine-700">
                    {formatDateTime(r.at)}
                    {r.vehicle_plate ? ` • ${r.vehicle_plate}` : ''}
                  </span>
                </li>
              ))}
              {result.items.map((p) => (
                <li key={p.short_code} className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-extrabold text-pine-950">
                      {p.destination_label} <span className="font-mono text-berry-700 text-xs">{p.short_code}</span>
                    </span>
                    <span className="text-xs font-black text-pine-700">
                      {formatDateTime(p.checked_in_at ?? p.created_at)}
                      {p.vehicle_plate ? ` • ${p.vehicle_plate}` : ''}
                    </span>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {p.attendees.map((a) => (
                      <li key={a.attendee_no} className="text-xs font-semibold text-pine-900">
                        {a.full_name} <span className="font-mono text-pine-800/60">{a.doc_display ?? '—'}</span>
                        {a.verification && <span className="text-berry-700"> • {VERIFICATION_LABEL[a.verification]}</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Seguridad: IPs bloqueadas
// ---------------------------------------------------------------------------
function SecurityTab({ villaId }: { villaId: string }) {
  const qc = useQueryClient()
  const ips = useQuery({ queryKey: ['blocked-ips', villaId], queryFn: koloalaApi.listBlockedIps })
  const unblock = useMutation({
    mutationFn: koloalaApi.unblockIp,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocked-ips'] }),
  })
  return (
    <Card className="p-5 space-y-4">
      <div>
        <h2 className="text-lg font-black text-pine-950">Radar anti fuerza bruta</h2>
        <p className="text-xs font-semibold text-pine-800/60">Una IP que falla 3 veces se bloquea sin afectar al vecino inocente.</p>
      </div>
      {ips.data?.length === 0 ? (
        <EmptyState icon={<ShieldAlert className="w-8 h-8" />}>No hay IPs bloqueadas en {villaId}.</EmptyState>
      ) : (
        <div className="space-y-3">
          {ips.data?.map((item) => (
            <div key={item.ip_address} className="p-4 rounded-2xl bg-berry-50 border-2 border-berry-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-berry-900">{item.ip_address}</span>
                  <Badge tone="berry">
                    {item.attack_type} ({item.failed_attempts})
                  </Badge>
                </div>
                <p className="text-xs text-berry-800 mt-1 font-semibold">
                  Intentó: <strong>{item.attempted_usernames.join(', ')}</strong> • Sospechoso:{' '}
                  <strong>{item.suspected_lots_from_previous_logins.join(', ') || 'ninguno'}</strong>
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => unblock.mutate(item.ip_address)} loading={unblock.isPending}>
                <Unlock className="w-4 h-4" /> Desbloquear
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
