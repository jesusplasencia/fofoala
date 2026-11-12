import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { AdminView } from './components/AdminView'
import { GuardView } from './components/GuardView'
import { LoginView } from './components/LoginView'
import { InviteLinkView, PublicKioskView } from './components/PublicViews'
import { ResidentView } from './components/ResidentView'
import { type AuthSession, clearSession, getStoredSession, isAdminRole } from './lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

/** Rutas públicas (sin login): /visita (vitrina informativa) y /v/{token} (enlace de invitación). */
function publicRoute(): { kind: 'kiosk' } | { kind: 'invite'; token: string } | null {
  const path = window.location.pathname
  if (/^\/visita\/?$/.test(path)) return { kind: 'kiosk' }
  const m = path.match(/^\/v\/([A-Za-z0-9_-]{10,})\/?$/)
  if (m) return { kind: 'invite', token: m[1] }
  return null
}

function AuthedApp({ session, onLogout }: { session: AuthSession; onLogout: () => void }) {
  const hasLot = !!session.lot_id || session.available_lots.length > 0
  const [asResident, setAsResident] = useState(false)

  if (session.role === 'GUARD') return <GuardView session={session} onLogout={onLogout} />
  if (isAdminRole(session.role) && !asResident) {
    return <AdminView session={session} onLogout={onLogout} onSwitchToResident={hasLot ? () => setAsResident(true) : undefined} />
  }
  return (
    <ResidentView
      session={session}
      onLogout={onLogout}
      onSwitchToAdmin={isAdminRole(session.role) ? () => setAsResident(false) : undefined}
    />
  )
}

export function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession())
  const route = publicRoute()

  const handleLogout = () => {
    clearSession()
    queryClient.clear()
    setSession(null)
  }

  return (
    <QueryClientProvider client={queryClient}>
      {route?.kind === 'kiosk' ? (
        <PublicKioskView />
      ) : route?.kind === 'invite' ? (
        <InviteLinkView token={route.token} />
      ) : !session ? (
        <LoginView onLoginSuccess={setSession} />
      ) : (
        <AuthedApp session={session} onLogout={handleLogout} />
      )}
    </QueryClientProvider>
  )
}

export default App
