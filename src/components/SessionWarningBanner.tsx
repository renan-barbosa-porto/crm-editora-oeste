import { LogIn, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SessionWarningBannerProps {
  /** Mensagem a exibir. Em telas de listagem, o erro da busca. */
  message: string
  /** Título do aviso (acima da mensagem). */
  title?: string
  /** Variante visual: sessão (vermelho) ou rede (âmbar). */
  variant?: 'session' | 'network'
  /** Callback do botão "Tentar novamente" (recarrega os dados sem recarregar a página). */
  onRetry?: () => void
  /** Texto do botão de login (quando presente, o botão vira "Ir para login"). */
  showLoginButton?: boolean
}

/**
 * Banner de aviso para sessão inválida ou falha de rede, reutilizável em todas
 * as telas. Mantém o layout: ocupa o espaço da listagem sem quebrar o grid.
 */
export function SessionWarningBanner({
  message,
  title,
  variant = 'session',
  onRetry,
  showLoginButton = false,
}: SessionWarningBannerProps) {
  const isSession = variant === 'session'

  return (
    <div
      className={`p-3.5 rounded-md border text-xs flex flex-col gap-2 ${
        isSession
          ? 'bg-red-50 border-red-200 text-red-900'
          : 'bg-amber-50 border-amber-200 text-amber-900'
      }`}
    >
      <div className="flex items-start gap-2">
        {isSession ? (
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        )}
        <div>
          {title && <p className="font-semibold mb-0.5">{title}</p>}
          <p className="leading-relaxed">{message}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {showLoginButton && (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              window.location.assign('/login?expired=1')
            }}
            className="bg-red-600 hover:bg-red-700 text-white text-xs h-7 px-2.5 flex items-center gap-1.5"
          >
            <LogIn className="w-3.5 h-3.5" />
            Ir para login
          </Button>
        )}
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="text-xs h-7 px-2.5 flex items-center gap-1.5 border-red-300 text-red-900 hover:bg-red-100"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  )
}
