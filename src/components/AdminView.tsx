import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Unlock,
  Upload,
  X,
  XCircle,
} from 'lucide-react'
import { type ChangeEvent, type FormEvent, useRef, useState } from 'react'
import {
  type AuthSession,
  koloalaApi,
  type PropertyLotResponse,
} from '../lib/api'

interface AdminViewProps {
  session: AuthSession
  onLogout: () => void
}

export function AdminView({ session, onLogout }: AdminViewProps) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [filterStatus, setFilterStatus] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<'lots' | 'security'>('lots')

  // Estado de edición en línea (columna del lápiz)
  const [editingLotId, setEditingLotId] = useState<string | null>(null)
  const [editOwnerName, setEditOwnerName] = useState('')
  const [editOwnerPhone, setEditOwnerPhone] = useState('')
  const [csvImportSummary, setCsvImportSummary] = useState<string | null>(null)
  const csvFileInputRef = useRef<HTMLInputElement | null>(null)

  // Formulario rápido para crear un nuevo lote
  const [newLotId, setNewLotId] = useState('')
  const [newOwnerName, setNewOwnerName] = useState('')
  const [newOwnerPhone, setNewOwnerPhone] = useState('')
  const [newIsUpToDate, setNewIsUpToDate] = useState(true)

  const lotsQuery = useQuery({
    queryKey: ['lots', session.villa_id, page, filterStatus],
    queryFn: () => koloalaApi.listLots(page, 50, filterStatus),
  })

  const securityQuery = useQuery({
    queryKey: ['blocked-ips', session.villa_id],
    queryFn: () => koloalaApi.listBlockedIps(),
  })

  const toggleMaintenanceMutation = useMutation({
    mutationFn: ({ lotId, nextState }: { lotId: string; nextState: boolean }) =>
      koloalaApi.toggleLotMaintenance(lotId, nextState),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lots'] })
    },
  })

  const updateLotDetailsMutation = useMutation({
    mutationFn: ({
      lotId,
      isUpToDate,
      ownerName,
      ownerPhone,
    }: {
      lotId: string
      isUpToDate: boolean
      ownerName: string
      ownerPhone: string
    }) =>
      koloalaApi.updateLotDetails(lotId, {
        is_maintenance_up_to_date: isUpToDate,
        owner_name: ownerName.trim(),
        owner_phone: ownerPhone.trim() || '',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lots'] })
      setEditingLotId(null)
    },
  })

  const resetPinMutation = useMutation({
    mutationFn: (lotId: string) => koloalaApi.resetLotPassword(lotId),
    onSuccess: (cred) => {
      setCsvImportSummary(
        `Acceso restablecido en modo privado para el lote ${cred.villa_id}-${cred.lot_id} (${cred.owner_name}). Cuando el vecino ingrese "${cred.lot_id}" en el portal, confirmará su número de WhatsApp y recibirá su nuevo PIN directamente en su teléfono.`,
      )
    },
  })

  const upsertLotMutation = useMutation({
    mutationFn: () =>
      koloalaApi.upsertLot({
        lot_id: newLotId.trim().toUpperCase(),
        owner_name: newOwnerName.trim(),
        owner_phone: newOwnerPhone.trim() || undefined,
        is_maintenance_up_to_date: newIsUpToDate,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['lots'] })
      setNewLotId('')
      setNewOwnerName('')
      setNewOwnerPhone('')
      setCsvImportSummary(
        `Lote guardado correctamente (${res.created_count} nuevo, ${res.updated_count} actualizado). El vecino recibirá su PIN por WhatsApp al ingresar por primera vez.`,
      )
    },
  })

  const bulkCsvMutation = useMutation({
    mutationFn: (
      lots: Array<{
        lot_id: string
        owner_name: string
        owner_phone?: string
        is_maintenance_up_to_date: boolean
      }>,
    ) => koloalaApi.bulkImportLots(lots),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['lots'] })
      setCsvImportSummary(
        `Carga masiva completada: ${res.processed_count} lotes procesados (${res.created_count} nuevos, ${res.updated_count} actualizados). Cuando cada vecino ingrese su lote en el portal, confirmará su WhatsApp y recibirá su PIN automáticamente.`,
      )
    },
  })

  const handleCsvFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    const parsedLots: Array<{
      lot_id: string
      owner_name: string
      owner_phone?: string
      is_maintenance_up_to_date: boolean
    }> = []

    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split(/[;,]/).map((c) => c.trim().replace(/^"|"$/g, ''))
      if (cols.length < 2) continue
      // Saltar fila de cabecera si existe (ej. "lote,propietario,telefono,aldia")
      if (i === 0 && /lote|lot_id/i.test(cols[0])) continue

      const lotId = cols[0].toUpperCase()
      const ownerName = cols[1] || 'Propietario'
      const ownerPhone = cols[2] || undefined
      const statusRaw = (cols[3] || 'true').toLowerCase()
      const isUpToDate = !['false', '0', 'no', 'mora', 'deuda'].includes(statusRaw)

      if (lotId.length >= 2) {
        parsedLots.push({
          lot_id: lotId,
          owner_name: ownerName,
          owner_phone: ownerPhone,
          is_maintenance_up_to_date: isUpToDate,
        })
      }
    }

    e.target.value = ''
    if (parsedLots.length > 0) {
      bulkCsvMutation.mutate(parsedLots)
    }
  }

  const unblockIpMutation = useMutation({
    mutationFn: (ip: string) => koloalaApi.unblockIp(ip),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-ips'] })
    },
  })

  const startEditingLot = (lot: PropertyLotResponse) => {
    setEditingLotId(lot.lot_id)
    setEditOwnerName(lot.owner_name)
    setEditOwnerPhone(lot.owner_phone || '')
  }

  const cancelEditingLot = () => {
    setEditingLotId(null)
    setEditOwnerName('')
    setEditOwnerPhone('')
  }

  const saveEditingLot = (lot: PropertyLotResponse) => {
    if (editOwnerName.trim().length < 2) return
    updateLotDetailsMutation.mutate({
      lotId: lot.lot_id,
      isUpToDate: lot.is_maintenance_up_to_date,
      ownerName: editOwnerName,
      ownerPhone: editOwnerPhone,
    })
  }

  const handleCreateOrUpdateLot = (e: FormEvent) => {
    e.preventDefault()
    if (!newLotId.trim() || !newOwnerName.trim()) return
    upsertLotMutation.mutate()
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-14">
      {/* Top Navbar Desktop & Mobile */}
      <header className="bg-emerald-950 text-white border-b border-emerald-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-800 flex items-center justify-center font-black text-emerald-300">
              {session.villa_id}
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Junta Directiva • Administración
              </span>
              <h1 className="text-xl font-black">Panel de Control ({session.villa_id})</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('lots')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'lots'
                  ? 'bg-emerald-500 text-emerald-950'
                  : 'bg-emerald-900/80 text-emerald-100 hover:bg-emerald-800'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Padrón de Lotes ({lotsQuery.data?.total ?? 0})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-emerald-900/80 text-emerald-100 hover:bg-emerald-800'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Seguridad IPs ({securityQuery.data?.length ?? 0})
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 ml-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {activeTab === 'lots' ? (
          <>
            {csvImportSummary && (
              <div className="bg-emerald-50 border-2 border-emerald-400 text-emerald-950 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs font-bold">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>{csvImportSummary}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCsvImportSummary(null)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-200/70 hover:bg-emerald-200 text-emerald-950 cursor-pointer"
                >
                  OK
                </button>
              </div>
            )}

            {/* Formulario Rápido para Registrar un Lote Nuevo + Botón de Carga Masiva CSV/Excel */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-black text-slate-800">
                    Alta de Lotes y Carga Masiva (CSV / Excel)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Formato CSV: <code className="font-mono">lote,propietario,telefono,aldia</code>{' '}
                    (Ej: <code className="font-mono">P21,Familia Torres,987654321,true</code>)
                  </p>
                </div>

                <div>
                  <input
                    ref={csvFileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleCsvFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={bulkCsvMutation.isPending}
                    onClick={() => csvFileInputRef.current?.click()}
                    className="py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer"
                  >
                    {bulkCsvMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 text-emerald-400" />
                    )}
                    Importar Padrón CSV / Excel
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleCreateOrUpdateLot}
                className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Nuevo Lote (Ej. P21)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="P21"
                    value={newLotId}
                    onChange={(e) => setNewLotId(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold uppercase text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Familia / Propietario
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Familia Plasencia"
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    WhatsApp (Para envío de PIN)
                  </label>
                  <input
                    type="text"
                    placeholder="987654321"
                    value={newOwnerPhone}
                    onChange={(e) => setNewOwnerPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newIsUpToDate}
                      onChange={(e) => setNewIsUpToDate(e.target.checked)}
                      className="w-4 h-4 accent-emerald-600 rounded"
                    />
                    Al día
                  </label>

                  <button
                    type="submit"
                    disabled={upsertLotMutation.isPending}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {upsertLotMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Agregar Lote
                  </button>
                </div>
              </form>
            </div>

            {/* Filtros y Tabla Paginada */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterStatus(null)
                      setPage(0)
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      filterStatus === null
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterStatus(true)
                      setPage(0)
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      filterStatus === true
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Al Día (Habilitados)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterStatus(false)
                      setPage(0)
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      filterStatus === false
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Con Deuda (Morosos)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => lotsQuery.refetch()}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                  title="Actualizar padrón"
                >
                  <RefreshCw className={`w-4 h-4 ${lotsQuery.isFetching ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="py-3.5 px-6">Lote</th>
                      <th className="py-3.5 px-6">Propietario / Familia</th>
                      <th className="py-3.5 px-6">Teléfono</th>
                      <th className="py-3.5 px-6">Estado Mantenimiento</th>
                      <th className="py-3.5 px-6 text-right">Acciones</th>
                      <th className="py-3.5 px-6 text-right w-24">Editar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {lotsQuery.data?.items.map((lot) => {
                      const isEditing = editingLotId === lot.lot_id
                      return (
                        <tr
                          key={`${lot.villa_id}-${lot.lot_id}`}
                          className={isEditing ? 'bg-emerald-50/60' : 'hover:bg-slate-50/80'}
                        >
                          <td className="py-4 px-6 font-black font-mono text-base text-slate-900">
                            {lot.lot_id}
                          </td>

                          {/* Columna PROPIETARIO / FAMILIA */}
                          <td className="py-3 px-6 font-semibold text-slate-800">
                            {isEditing ? (
                              <input
                                type="text"
                                autoFocus
                                value={editOwnerName}
                                onChange={(e) => setEditOwnerName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEditingLot(lot)
                                  if (e.key === 'Escape') cancelEditingLot()
                                }}
                                placeholder="Familia / Propietario"
                                className="w-full px-3 py-1.5 rounded-xl bg-white border-2 border-emerald-500 text-sm font-semibold text-slate-900 focus:outline-none"
                              />
                            ) : (
                              lot.owner_name
                            )}
                          </td>

                          {/* Columna TELÉFONO */}
                          <td className="py-3 px-6 font-mono text-xs text-slate-500">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editOwnerPhone}
                                onChange={(e) => setEditOwnerPhone(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEditingLot(lot)
                                  if (e.key === 'Escape') cancelEditingLot()
                                }}
                                placeholder="987654321"
                                className="w-36 px-3 py-1.5 rounded-xl bg-white border-2 border-emerald-500 font-mono text-xs font-bold text-slate-900 focus:outline-none"
                              />
                            ) : (
                              lot.owner_phone || '—'
                            )}
                          </td>

                          {/* Estado Mantenimiento */}
                          <td className="py-4 px-6">
                            <button
                              type="button"
                              onClick={() =>
                                toggleMaintenanceMutation.mutate({
                                  lotId: lot.lot_id,
                                  nextState: !lot.is_maintenance_up_to_date,
                                })
                              }
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold cursor-pointer transition-colors ${
                                lot.is_maintenance_up_to_date
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-red-100 text-red-800 hover:bg-red-200'
                              }`}
                            >
                              {lot.is_maintenance_up_to_date ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  AL DÍA (Click para cambiar)
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5" />
                                  EN MORA (Click para habilitar)
                                </>
                              )}
                            </button>
                          </td>

                          {/* Acciones (Restablecer Acceso Privado por WhatsApp) */}
                          <td className="py-4 px-6 text-right">
                            <button
                              type="button"
                              onClick={() => resetPinMutation.mutate(lot.lot_id)}
                              disabled={resetPinMutation.isPending}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-bold text-xs cursor-pointer"
                              title="Habilita que el vecino confirme su WhatsApp en su próximo ingreso y reciba un nuevo PIN privado"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              Restablecer Acceso
                            </button>
                          </td>

                          {/* Columna única de LÁPIZ en el extremo derecho */}
                          <td className="py-3 px-6 text-right">
                            {isEditing ? (
                              <div className="inline-flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  disabled={
                                    updateLotDetailsMutation.isPending ||
                                    editOwnerName.trim().length < 2
                                  }
                                  onClick={() => saveEditingLot(lot)}
                                  className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 cursor-pointer"
                                  title="Guardar cambios (Enter)"
                                >
                                  {updateLotDetailsMutation.isPending ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditingLot}
                                  className="p-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                                  title="Cancelar (Esc)"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEditingLot(lot)}
                                className="p-2 rounded-xl text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                                title="Editar propietario o teléfono"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {lotsQuery.data && lotsQuery.data.total_pages > 1 && (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>
                    Página {lotsQuery.data.page + 1} de {lotsQuery.data.total_pages} (
                    {lotsQuery.data.total} lotes)
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={page === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      className="p-2 rounded-lg bg-white border border-slate-200 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={!lotsQuery.data.has_next}
                      onClick={() => setPage((p) => p + 1)}
                      className="p-2 rounded-lg bg-white border border-slate-200 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Pestaña de Seguridad Forense: IPs Bloqueadas por Fuerza Bruta / Password Spraying */
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Radar Anti-Fuerza Bruta & Password Spraying ({session.villa_id})
              </h2>
              <p className="text-xs text-slate-500">
                Si una IP falla 3 contraseñas seguidas, se bloquea automáticamente sin bloquear al
                vecino inocente y revela con qué lote inició sesión antes.
              </p>
            </div>

            {securityQuery.data?.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm font-medium">
                No hay direcciones IP bloqueadas en {session.villa_id} en este momento.
              </div>
            ) : (
              <div className="space-y-3">
                {securityQuery.data?.map((item) => (
                  <div
                    key={item.ip_address}
                    className="p-4 rounded-2xl bg-red-50 border border-red-200 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-base text-red-900">
                          {item.ip_address}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-red-200 text-red-900">
                          {item.attack_type} ({item.failed_attempts} fallos)
                        </span>
                      </div>
                      <p className="text-xs text-red-800 mt-1">
                        Lotes atacados: <strong>{item.attempted_usernames.join(', ')}</strong> •
                        Lote sospechoso previo:{' '}
                        <strong>
                          {item.suspected_lots_from_previous_logins.length > 0
                            ? item.suspected_lots_from_previous_logins.join(', ')
                            : 'Ninguno registrado'}
                        </strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => unblockIpMutation.mutate(item.ip_address)}
                      className="px-4 py-2 rounded-xl bg-white hover:bg-red-100 text-red-900 border border-red-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Unlock className="w-4 h-4" />
                      Desbloquear IP
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
