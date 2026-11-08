import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

/**
 * Proteção de rota com validação real de sessão:
 * - Aguarda o boot concluir a validação real (exp + authRefresh) antes de
 *   liberar qualquer rota protegida — evita a janela em que o token morto
 *   ainda está no authStore e a tela buscaria dados com sessão inválida.
 * - Sem sessão válida → redirect ao /login preservando o destino original.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, bootLoading } = useAuth()
  const location = useLocation()

  if (bootLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F2ED]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-[#B3541E]" />
          <p className="text-xs text-[#8A8178]">Verificando sua sessão...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/login?expired=1"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }
  return <>{children}</>
}
