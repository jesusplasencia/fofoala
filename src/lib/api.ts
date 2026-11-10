/**
 * Cliente API Tipado de punta a punta para Koloala (FastAPI + Supabase)
 * Detecta automáticamente la Villa desde el subdominio (vc1, vc2, vc3) o permite
 * cambiarla en local, e inyecta el JWT Bearer de 30 días + X-Villa-Id.
 */

export type UserRole = 'RESIDENT' | 'GUARD' | 'ADMIN'
export type PassType = 'DELIVERY' | 'TAXI' | 'GUEST'
export type PassStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED'

export interface AuthSession {
  access_token: string
  token_type: string
  expires_in_days: number
  villa_id: string
  role: UserRole
  username: string
  lot_id: string | null
}

export interface GuestPassResponse {
  villa_id: string
  code: string
  lot_id: string
  pass_type: PassType
  visitor_info: string | null
  status: PassStatus
  expires_at: string
  checked_in_dni: string | null
  checked_in_plate: string | null
}

export interface PassVerificationResponse {
  authorized: boolean
  message: string
  villa_id: string | null
  lot_id: string | null
  owner_name: string | null
  pass_type: PassType | null
  visitor_info: string | null
  checked_in_dni: string | null
  checked_in_plate: string | null
  used_at: string | null
}

export interface PropertyLotResponse {
  villa_id: string
  lot_id: string
  owner_name: string
  owner_phone: string | null
  owner_email: string | null
  is_maintenance_up_to_date: boolean
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

export interface ResidentCredentialItem {
  villa_id: string
  lot_id: string
  owner_name: string
  owner_phone: string | null
  owner_email: string | null
  username: string
  initial_password: string
  login_url: string
  whatsapp_share_url: string | null
}

export interface BulkLotsSyncResponse {
  villa_id: string
  processed_count: number
  created_count: number
  updated_count: number
  generated_credentials: ResidentCredentialItem[]
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

export interface UserLookupResponse {
  villa_id: string
  username: string
  status: 'READY_FOR_PASSWORD' | 'NEEDS_PHONE_ACTIVATION'
  masked_phone_hint: string | null
  owner_name: string | null
}

export interface ActivateLotPinResponse {
  villa_id: string
  lot_id: string
  delivery_channel: string
  message: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
const STORAGE_KEY = 'fofoala_koloala_session_v1'

/**
 * Resuelve automáticamente la Villa desde el subdominio (vc1.lasvillas.club -> VC1,
 * vc2.lasvillas.club -> VC2, vc3.lasvillas.club -> VC3). En desarrollo local sin
 * subdominio usa VITE_DEFAULT_VILLA_ID o 'VC3'. No es seleccionable manualmente.
 */
export function detectVillaId(): string {
  const host = window.location.hostname.toLowerCase()
  const sub = host.split('.')[0]
  if (sub === 'vc1' || sub === 'vc2' || sub === 'vc3') {
    return sub.toUpperCase()
  }
  return (import.meta.env.VITE_DEFAULT_VILLA_ID || 'VC3').toUpperCase()
}

export function getVillaDisplayName(villaId: string): string {
  const map: Record<string, string> = {
    VC1: 'Villa Club 1',
    VC2: 'Villa Club 2',
    VC3: 'Villa Club 3',
  }
  return map[villaId.toUpperCase()] || villaId.toUpperCase()
}

export function getStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY)
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  customVillaId?: string,
): Promise<T> {
  const session = getStoredSession()
  const activeVilla = customVillaId || session?.villa_id || detectVillaId()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Villa-Id': activeVilla,
    ...(options.headers as Record<string, string> | undefined),
  }

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let errorDetail = `Error HTTP ${response.status}`
    try {
      const errBody = await response.json()
      if (typeof errBody.detail === 'string') {
        errorDetail = errBody.detail
      } else if (Array.isArray(errBody.detail)) {
        errorDetail = errBody.detail.map((e: { msg?: string }) => e.msg).join(', ')
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorDetail)
  }

  return (await response.json()) as T
}

export const koloalaApi = {
  lookupUser: (username: string, villaId: string) =>
    apiRequest<UserLookupResponse>(
      '/api/v1/auth/lookup',
      {
        method: 'POST',
        body: JSON.stringify({ username }),
      },
      villaId,
    ),

  activateLotPin: (username: string, phone: string, villaId: string) =>
    apiRequest<ActivateLotPinResponse>(
      '/api/v1/auth/activate-pin',
      {
        method: 'POST',
        body: JSON.stringify({ username, phone }),
      },
      villaId,
    ),

  login: (username: string, password: string, villaId: string) =>
    apiRequest<AuthSession>(
      '/api/v1/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      },
      villaId,
    ),

  createPass: (pass_type: PassType, visitor_info?: string) =>
    apiRequest<GuestPassResponse>('/api/v1/passes', {
      method: 'POST',
      body: JSON.stringify({
        pass_type,
        visitor_info: visitor_info?.trim() || null,
      }),
    }),

  verifyPass: (code: string, visitor_dni: string, vehicle_plate?: string) =>
    apiRequest<PassVerificationResponse>('/api/v1/passes/verify', {
      method: 'POST',
      body: JSON.stringify({
        code: code.trim().toUpperCase(),
        visitor_dni: visitor_dni.trim(),
        vehicle_plate: vehicle_plate?.trim() || null,
      }),
    }),

  listLots: (page = 0, limit = 50, isMaintenanceUpToDate?: boolean | null) => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    })
    if (isMaintenanceUpToDate !== undefined && isMaintenanceUpToDate !== null) {
      params.set('is_maintenance_up_to_date', String(isMaintenanceUpToDate))
    }
    return apiRequest<PaginatedLotsResponse>(`/api/v1/lots?${params.toString()}`)
  },

  toggleLotMaintenance: (lotId: string, is_maintenance_up_to_date: boolean) =>
    apiRequest<PropertyLotResponse>(`/api/v1/lots/${encodeURIComponent(lotId)}/maintenance`, {
      method: 'PATCH',
      body: JSON.stringify({ is_maintenance_up_to_date }),
    }),

  updateLotDetails: (
    lotId: string,
    payload: {
      is_maintenance_up_to_date: boolean
      owner_name: string
      owner_phone: string | null
    },
  ) =>
    apiRequest<PropertyLotResponse>(`/api/v1/lots/${encodeURIComponent(lotId)}/maintenance`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  resetLotPassword: (lotId: string) =>
    apiRequest<ResidentCredentialItem>(
      `/api/v1/lots/${encodeURIComponent(lotId)}/reset-password`,
      {
        method: 'POST',
      },
    ),

  upsertLot: (lot: {
    lot_id: string
    owner_name: string
    owner_phone?: string
    owner_email?: string
    is_maintenance_up_to_date: boolean
  }) =>
    apiRequest<BulkLotsSyncResponse>('/api/v1/lots/bulk', {
      method: 'PUT',
      body: JSON.stringify({ lots: [lot] }),
    }),

  bulkImportLots: (
    lots: Array<{
      lot_id: string
      owner_name: string
      owner_phone?: string
      owner_email?: string
      is_maintenance_up_to_date: boolean
    }>,
  ) =>
    apiRequest<BulkLotsSyncResponse>('/api/v1/lots/bulk', {
      method: 'PUT',
      body: JSON.stringify({ lots }),
    }),

  listBlockedIps: () => apiRequest<BlockedIPReport[]>('/api/v1/auth/security/blocked-ips'),

  unblockIp: (ipAddress: string) =>
    apiRequest<{ message: string }>(
      `/api/v1/auth/security/blocked-ips/${encodeURIComponent(ipAddress)}`,
      {
        method: 'DELETE',
      },
    ),
}
