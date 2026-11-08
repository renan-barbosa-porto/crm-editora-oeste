import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import pb from '@/lib/pocketbase/client'
import {
  validateSession,
  scheduleSessionWatch,
  getLocalToken,
  getTokenExp,
} from '@/lib/pocketbase/session'

interface AuthContextValue {
  user: any | null
  bootLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  validateSession: () => Promise<boolean>
  getLocalToken: () => string | null
  getTokenExp: () => number | null
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Contexto de autenticação com validação real de sessão:
 * 1. No boot, valida o token salvo: verifica a expiração local do JWT (campo
 *    `exp`) e confirma com o servidor via authRefresh. Token ausente, expirado
 *    ou rejeitado → limpa as credenciais locais e redireciona ao /login com a
 *    mensagem "Sua sessão expirou. Entre novamente."
 * 2. O interceptador global (src/lib/pocketbase/session.ts) derruba a sessão
 *    automaticamente em qualquer resposta 401 ou 200-com-aut-invalida, em
 *    qualquer tela, sem tratamento tela a tela.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(pb.authStore.record || null)
  const [bootLoading, setBootLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    // Sincroniza o estado 'user' com o authStore
    const unsubscribe = pb.authStore.onChange(() => {
      setUser(pb.authStore.record || null)
    })

    // Validação real da sessão no boot (exp + authRefresh contra o servidor)
    validateSession().finally(() => {
      if (!cancelled) setBootLoading(false)
    })

    // Vigia a expiração do token em tempo real: quando o `exp` é alcançado,
    // user = null → ProtectedRoute redireciona ao login
    const cancelWatch = scheduleSessionWatch(() => setUser(null))

    return () => {
      cancelled = true
      unsubscribe()
      cancelWatch()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    await pb.collection('users').authWithPassword(email, password)
    setUser(pb.authStore.record || null)
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    await pb.collection('users').create({
      name,
      email,
      password,
      passwordConfirm: password,
    })
    await pb.collection('users').authWithPassword(email, password)
    setUser(pb.authStore.record || null)
  }, [])

  const logout = useCallback(() => {
    pb.authStore.clear()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        bootLoading,
        login,
        register,
        logout,
        validateSession,
        getLocalToken,
        getTokenExp,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
