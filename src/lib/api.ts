/**
 * Cliente API tipado para Koloala (FastAPI + Supabase).
 * Detecta la Villa desde el subdominio (vc1, vc2, vc3) e inyecta el JWT Bearer + X-Villa-Id.
 */

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'GUARD' | 'RESIDENT'
export type MembershipRole = 'ANCHOR' | 'HOUSEHOLD'
export type VisitKind = 'GUEST' | 'TAXI' | 'DELIVERY'
export type VisitStatus = 'ACTIVE' | 'USED' | 'EXPIRED'
export type VisitOrigin = 'HOST_INVITE' | 'GUARD_DESK'
export type DocSource = 'OCR' | 'MANUAL'
export type DocType = 'DNI' | 'CE' | 'PASAPORTE' | 'NINGUNO'
export type Verification = 'DOC_SHOWN' | 'DOC_DIGITAL' | 'DECLARED' | 'VOUCHED'
export type LotType = 'LOT' | 'MINI_LOT' | 'COMMON_AREA'

export interface AuthSession {
  access_token: string
  token_type: string
  expires_in_days: number
  villa_id: string
  role: UserRole
  username: string
  lot_id: string | null
  membership_role: MembershipRole | null
  full_name: string | null
  available_lots: string[]
}

export interface UserLookupResponse {
  villa_id: string
  username: string
  status: 'READY_FOR_PASSWORD' | 'NEEDS_DOCUMENT' | 'UNREGISTERED_NO_ACCOUNT'
  message: string | null
}

export interface ActivateLotPinResponse {
  villa_id: string
  lot_id: string
  delivery_channel: string
  message: string
}

// ---------- Visitas (QR sin cuenta) ----------
export interface AttendeeInput {
  first_names: string
  last_names?: string | null
  doc_type?: DocType | null
  doc_number?: string | null
  doc_source?: DocSource | null
}

export interface InviteResponse {
  token: string
  short_code: string
  kind: VisitKind
  villa_id: string
  destination_label: string
  party_size_expected: number
  valid_from: string
  valid_until: string
  share_path: string
}

export interface PublicPassView {
  short_code: string
  villa_id: string
  destination_label: string
  status: VisitStatus
  valid_from: string
  valid_until: string
  party_size_expected: number
  attendee_names: string[]
}

export interface GuardAttendeeView {
  attendee_no: number
  full_name: string
  doc_type: DocType
  doc_display: string | null
  doc_source?: DocSource | null
  verification: Verification | null
  vouched_by_no: number | null
  checked_in_at: string | null
}

export interface GuardPassView {
  authorized: boolean
  message: string
  short_code: string
  origin: VisitOrigin
  kind: VisitKind
  destination_label: string
  host_name: string | null
  host_role: string | null
  party_size_expected: number
  status: VisitStatus
  created_at: string
  valid_until: string
  vehicle_plate: string | null
  checked_in_at: string | null
  checked_in_by_guard: string | null
  attendees: GuardAttendeeView[]
}

export interface AttendeeCheckIn {
  attendee_no?: number | null
  person?: AttendeeInput | null
  verification?: Verification | null
  vouched_by_no?: number | null
}

export interface CatalogItem {
  lot_id: string
  lot_type: LotType
  display_name: string
}

export interface EntryLot {
  lot_id: string
  membership_role: string
  maintenance_ok: boolean
}

export interface ResidentEntryView {
  authorized: boolean
  message: string
  person_name: string
  lots: EntryLot[]
  warnings: string[]
  method: 'QR' | 'MANUAL'
  at: string
  vehicle_plate: string | null
}

export interface CarnetResponse {
  payload: string
  expires_in: number
  window_seconds: number
  full_name: string
  lots: EntryLot[]
}

export interface VisitLogResponse {
  villa_id: string
  total_passes: number
  checked_in_passes: number
  total_people_in: number
  resident_entries: number
  docs_revealed: boolean
  items: GuardPassView[]
  resident_items: ResidentEntryView[]
}

export interface AccessSearchResponse {
  villa_id: string
  result_count: number
  items: GuardPassView[]
  resident_entries: ResidentEntryView[]
}

// ---------- Lotes y miembros ----------
export interface PropertyLotResponse {
  villa_id: string
  lot_id: string
  owner_name: string
  owner_phone: string | null
  is_maintenance_up_to_date: boolean
  lot_type?: LotType
  display_name?: string | null
  is_public?: boolean
  updated_at: string
}

export interface PaginatedLotsResponse {
  villa_id: string
  items: PropertyLotResponse[]
  total: number
  page: number
  limit: number
  total_pages: number
  has_next: boolean
}

export interface LotMembership {
  villa_id: string
  lot_id: string
  phone: string
  full_name: string
  document_id: string | null
  membership_role: MembershipRole
  added_by: string
  is_active: boolean
  is_maintenance_up_to_date: boolean | null
}

export interface BulkRejectedRow {
  row_number: number | null
  lot_id: string | null
  phone: string | null
  reason: string
}

export interface BulkLotsSyncResponse {
  villa_id: string
  processed_count: number
  created_count: number
  updated_count: number
  rejected_count: number
  rejected: BulkRejectedRow[]
}

export interface CatalogBulkResponse {
  villa_id: string
  created_count: number
  updated_count: number
  items: CatalogItem[]
}

export type StaffRoleName = 'ADMIN' | 'GUARD'

export interface StaffMember {
  villa_id: string
  phone: string
  full_name: string | null
  role: StaffRoleName
  document_id: string | null
  is_active: boolean
  has_activated: boolean
}

export interface BlockedIPReport {
  villa_id: string
  ip_address: string
  failed_attempts: number
  is_blocked: boolean
  attack_type: 'TARGETED_BRUTE_FORCE' | 'PASSWORD_SPRAYING'
  attempted_usernames: string[]
  suspected_lots_from_previous_logins: string[]
  blocked_at: string | null
  last_user_agent: string | null
}

function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  const host = window.location.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) {
    return 'http://127.0.0.1:8000'
  }
  console.error('Falta VITE_API_BASE_URL en Vercel (Production y Preview). Usando el mismo dominio.')
  return window.location.origin
}

const API_BASE_URL = resolveApiBaseUrl()
const STORAGE_KEY = 'fofoala_koloala_session_v2'

export function detectVillaId(): string {
  const host = window.location.hostname.toLowerCase()
  const sub = host.split('.')[0]
  if (/^vc\d$/.test(sub)) return sub.toUpperCase()
  return (import.meta.env.VITE_DEFAULT_VILLA_ID || 'VC3').toUpperCase()
}

export function getVillaDisplayName(villaId: string): string {
  const n = villaId.toUpperCase().replace('VC', '')
  return /^\d+$/.test(n) ? `Villa Club ${n}` : villaId.toUpperCase()
}

export const SESSION_EXPIRED_EVENT = 'koloala:session-expired'

/** Lee el `exp` del JWT (sin verificar la firma: solo para saber si ya venció en este dispositivo). */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()
  } catch {
    return true
  }
}

export function getStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (isTokenExpired(parsed.access_token)) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return { ...parsed, available_lots: parsed.available_lots ?? [] }
  } catch {
    return null
  }
}

let memorySession: AuthSession | null = null

export function saveSession(session: AuthSession): void {
  memorySession = session
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // almacenamiento no disponible (modo privado): la sesión vive solo en memoria
  }
}

export function clearSession(): void {
  memorySession = null
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function isAdminRole(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN'
}

async function request<T>(path: string, options: RequestInit, villaId: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Villa-Id': villaId,
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  if (response.status === 401 && token) {
    // Sesión vencida o cerrada por administración: volvemos al login.
    clearSession()
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
  if (!response.ok) {
    let detail = `Error HTTP ${response.status}`
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') detail = body.detail
      else if (Array.isArray(body.detail)) {
        detail = body.detail
          .map((e: { msg?: string }) => (e.msg || '').replace(/^Value error, /, ''))
          .join(', ')
      }
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
  return (await response.json()) as T
}

function apiRequest<T>(path: string, options: RequestInit = {}, customVillaId?: string): Promise<T> {
  const session = getStoredSession() ?? memorySession
  return request<T>(path, options, customVillaId || session?.villa_id || detectVillaId(), session?.access_token)
}

/** Peticiones públicas (vitrina / enlace de invitación): nunca envían el JWT. */
function publicRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request<T>(path, options, detectVillaId())
}

const json = (body: unknown) => JSON.stringify(body)

export const koloalaApi = {
  // ---- Auth ----
  lookupUser: (username: string, villaId: string) =>
    apiRequest<UserLookupResponse>('/api/v1/auth/lookup', { method: 'POST', body: json({ username }) }, villaId),
  activateLotPin: (username: string, document_id: string, villaId: string) =>
    apiRequest<ActivateLotPinResponse>(
      '/api/v1/auth/activate-pin',
      { method: 'POST', body: json({ username, document_id }) },
      villaId,
    ),
  changePassword: (current_password: string, new_password: string) =>
    apiRequest<{ message: string }>('/api/v1/auth/change-password', {
      method: 'POST',
      body: json({ current_password, new_password }),
    }),
  login: (username: string, password: string, villaId: string) =>
    apiRequest<AuthSession>('/api/v1/auth/login', { method: 'POST', body: json({ username, password }) }, villaId),

  // ---- Residente ----
  createInvite: (payload: {
    kind: VisitKind
    lot_id?: string | null
    party_size_expected?: number
    valid_hours?: number
    note?: string | null
    attendees?: AttendeeInput[]
  }) => apiRequest<InviteResponse>('/api/v1/visits/invite', { method: 'POST', body: json(payload) }),
  myCarnet: () => apiRequest<CarnetResponse>('/api/v1/me/carnet'),
  myEntries: () => apiRequest<{ villa_id: string; items: ResidentEntryView[] }>('/api/v1/me/entries'),
  lotEntries: () => apiRequest<LotEntriesResponse>('/api/v1/me/lot-entries'),
  myMemberships: () => apiRequest<LotMembership[]>('/api/v1/lots/my-memberships'),
  listLotMembers: (lotId: string) =>
    apiRequest<LotMembership[]>(`/api/v1/lots/${encodeURIComponent(lotId)}/members`),
  addLotMember: (lotId: string, payload: { phone: string; full_name: string; document_id: string }) =>
    apiRequest<LotMembership>(`/api/v1/lots/${encodeURIComponent(lotId)}/members`, {
      method: 'POST',
      body: json(payload),
    }),
  updateLotMember: (lotId: string, phone: string, payload: { full_name?: string; document_id?: string; phone?: string }) =>
    apiRequest<LotMembership>(
      `/api/v1/lots/${encodeURIComponent(lotId)}/members/${encodeURIComponent(phone)}`,
      { method: 'PATCH', body: json(payload) },
    ),
  removeLotMember: (lotId: string, phone: string) =>
    apiRequest<LotMembership>(
      `/api/v1/lots/${encodeURIComponent(lotId)}/members/${encodeURIComponent(phone)}`,
      { method: 'DELETE' },
    ),

  // ---- Público (sin login) ----
  publicVilla: () => publicRequest<{ villa_id: string; catalog: CatalogItem[] }>('/api/v1/public/villa'),
  viewPublicVisit: (token: string) =>
    publicRequest<PublicPassView>(`/api/v1/public/visits/${encodeURIComponent(token)}`),
  addVisitAttendees: (token: string, attendees: AttendeeInput[]) =>
    publicRequest<PublicPassView>(`/api/v1/public/visits/${encodeURIComponent(token)}/attendees`, {
      method: 'POST',
      body: json({ attendees }),
    }),

  // ---- Garita ----
  guardLookup: (ref: string) => apiRequest<GuardPassView>(`/api/v1/guard/visits/${encodeURIComponent(ref)}`),
  guardCheckIn: (ref: string, attendees: AttendeeCheckIn[], vehicle_plate?: string | null) =>
    apiRequest<GuardPassView>(`/api/v1/guard/visits/${encodeURIComponent(ref)}/check-in`, {
      method: 'POST',
      body: json({ attendees, vehicle_plate: vehicle_plate || null }),
    }),
  guardDesk: (destination_lot_id: string, attendees: AttendeeCheckIn[], vehicle_plate?: string | null) =>
    apiRequest<GuardPassView>('/api/v1/guard/visits/desk', {
      method: 'POST',
      body: json({ destination_lot_id, attendees, vehicle_plate: vehicle_plate || null }),
    }),
  residentEntry: (payload: { qr_payload?: string; phone?: string; lot_id?: string; vehicle_plate?: string | null }) =>
    apiRequest<ResidentEntryView>('/api/v1/guard/resident-entry', { method: 'POST', body: json(payload) }),
  dailyLog: (reveal = false) =>
    apiRequest<VisitLogResponse>(`/api/v1/guard/visits/daily-log${reveal ? '?reveal=true' : ''}`),

  // ---- Admin ----
  listLots: (page = 0, limit = 50, isMaintenanceUpToDate?: boolean | null) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (isMaintenanceUpToDate !== undefined && isMaintenanceUpToDate !== null) {
      params.set('is_maintenance_up_to_date', String(isMaintenanceUpToDate))
    }
    return apiRequest<PaginatedLotsResponse>(`/api/v1/lots?${params.toString()}`)
  },
  toggleLotMaintenance: (lotId: string, is_maintenance_up_to_date: boolean) =>
    apiRequest<PropertyLotResponse>(`/api/v1/lots/${encodeURIComponent(lotId)}/maintenance`, {
      method: 'PATCH',
      body: json({ is_maintenance_up_to_date }),
    }),
  updateLotDetails: (lotId: string, payload: { is_maintenance_up_to_date: boolean; owner_name?: string }) =>
    apiRequest<PropertyLotResponse>(`/api/v1/lots/${encodeURIComponent(lotId)}/maintenance`, {
      method: 'PATCH',
      body: json(payload),
    }),
  bulkImportLots: (
    lots: Array<{
      row_number?: number
      lot_id: string
      owner_name?: string
      owner_phone?: string
      owner_document_id?: string
      is_maintenance_up_to_date: boolean
    }>,
  ) => apiRequest<BulkLotsSyncResponse>('/api/v1/lots/bulk', { method: 'PUT', body: json({ lots }) }),
  bulkCatalog: (items: Array<{ lot_id: string; display_name: string; lot_type: LotType; is_public: boolean }>) =>
    apiRequest<CatalogBulkResponse>('/api/v1/admin/catalog/bulk', { method: 'POST', body: json({ items }) }),
  accessSearch: (filters: { date_from?: string; date_to?: string; dni?: string; plate?: string; destination?: string }) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v.trim()) params.set(k, v.trim())
    })
    return apiRequest<AccessSearchResponse>(`/api/v1/admin/access-search?${params.toString()}`)
  },
  listStaff: () => apiRequest<StaffMember[]>('/api/v1/admin/staff'),
  addStaff: (payload: { phone: string; full_name: string; document_id?: string; role: StaffRoleName }) =>
    apiRequest<StaffMember>('/api/v1/admin/staff', { method: 'POST', body: json(payload) }),
  removeStaff: (phone: string) =>
    apiRequest<StaffMember>(`/api/v1/admin/staff/${encodeURIComponent(phone)}`, { method: 'DELETE' }),
  listBlockedIps: () => apiRequest<BlockedIPReport[]>('/api/v1/auth/security/blocked-ips'),
  unblockIp: (ipAddress: string) =>
    apiRequest<{ message: string }>(`/api/v1/auth/security/blocked-ips/${encodeURIComponent(ipAddress)}`, {
      method: 'DELETE',
    }),
}

export const KIND_LABEL: Record<VisitKind, string> = {
  GUEST: 'Visita',
  TAXI: 'Taxi',
  DELIVERY: 'Delivery',
}

export const VERIFICATION_LABEL: Record<Verification, string> = {
  DOC_SHOWN: 'DNI físico',
  DOC_DIGITAL: 'DNI digital',
  DECLARED: 'De memoria',
  VOUCHED: 'Avalado',
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

export type LotEntryType = 'RESIDENT' | 'GUEST' | 'TAXI' | 'DELIVERY'

export interface LotEntryItem {
  at: string
  type: LotEntryType
  names: string[]
  vehicle_plate: string | null
  lot_id: string
  invited_by: string | null
}

export interface LotEntriesResponse {
  villa_id: string
  lot_ids: string[]
  since: string
  items: LotEntryItem[]
}

const SHORT_DT = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

/** "24 nov, 07:45pm" en hora de Lima. */
export function formatShortDateTime(iso: string): string {
  const p = Object.fromEntries(SHORT_DT.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  const month = (p.month ?? '').replace('.', '').toLowerCase()
  const ampm = (p.dayPeriod ?? '').toLowerCase().replace(/[^apm]/g, '')
  return `${p.day} ${month}, ${p.hour}:${p.minute}${ampm}`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
