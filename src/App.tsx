import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { AdminView } from './components/AdminView'
import { GuardView } from './components/GuardView'
import { LoginView } from './components/LoginView'
import { ResidentView } from './components/ResidentView'
import { type AuthSession, clearSession, getStoredSession } from './lib/api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession())

  const handleLogout = () => {
    clearSession()
    queryClient.clear()
    setSession(null)
  }

  return (
    <QueryClientProvider client={queryClient}>
      {!session ? (
        <LoginView onLoginSuccess={setSession} />
      ) : session.role === 'GUARD' ? (
        <GuardView session={session} onLogout={handleLogout} />
      ) : session.role === 'ADMIN' ? (
        <AdminView session={session} onLogout={handleLogout} />
      ) : (
        <ResidentView session={session} onLogout={handleLogout} />
      )}
    </QueryClientProvider>
  )
}

export default App
