import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { BookOpen, Printer, AlertCircle, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { getErrorMessage, isNetworkError } from '@/lib/pocketbase/errors'

export default function Login() {
  const [email, setEmail] = useState('renandm@gmail.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [isLoading, setIsLoading] = useState(false)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const { login } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleLogin = async (targetEmail = email, targetPassword = password) => {
    if (!targetEmail || !targetPassword) return

    setIsLoading(true)
    setNetworkError(null)
    try {
      await login(targetEmail, targetPassword)
      toast({
        title: 'Bem-vindo de volta!',
        description: 'Login efetuado com sucesso.',
      })
      navigate('/')
    } catch (error: any) {
      if (isNetworkError(error)) {
        const netMsg =
          'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'
        setNetworkError(netMsg)
        toast({
          title: 'Erro de conexão',
          description: netMsg,
          variant: 'destructive',
        })
      } else {
        const message = getErrorMessage(error) || 'Email ou senha inválidos. Tente novamente.'
        toast({
          title: 'Falha no login',
          description: message,
          variant: 'destructive',
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await handleLogin()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F5F2] p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6 text-center">
          <div className="w-10 h-10 rounded-md bg-[#B3541E] text-white flex items-center justify-center shadow-md">
            <div className="flex items-center -space-x-1">
              <BookOpen className="w-5 h-5" />
              <Printer className="w-4 h-4 opacity-80" />
            </div>
          </div>
          <div className="text-left">
            <h1 className="font-serif text-2xl font-bold text-[#1E1B16] leading-none">
              Editora & Gráfica
            </h1>
            <p className="text-xs text-[#8A8178] uppercase tracking-wider font-semibold">
              Sistema CRM
            </p>
          </div>
        </div>

        <Card className="border-[#E5DFD6] shadow-sm bg-white">
          <CardHeader className="space-y-1">
            <CardTitle className="font-serif text-xl text-[#1E1B16]">Acesso ao Sistema</CardTitle>
            <CardDescription className="text-xs text-[#8A8178]">
              Entre com suas credenciais para gerenciar leads, conversas e orçamentos.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-[#1E1B16]">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@editora.com.br"
                  required
                  className="border-[#E5DFD6] focus-visible:ring-[#B3541E]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold text-[#1E1B16]">
                    Senha
                  </Label>
                  <span className="text-[11px] text-[#8A8178] cursor-not-allowed">
                    Esqueci minha senha
                  </span>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-[#E5DFD6] focus-visible:ring-[#B3541E]"
                />
              </div>

              {networkError && (
                <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{networkError}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleLogin()}
                    disabled={isLoading}
                    className="self-start text-xs border-amber-300 text-amber-900 hover:bg-amber-100 flex items-center gap-1.5 h-7 px-2.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    Tentar novamente
                  </Button>
                </div>
              )}

              <div className="p-3 bg-[#FAF8F5] rounded border border-[#E5DFD6] text-xs text-[#8A8178]">
                <p className="font-semibold text-[#1E1B16] mb-0.5">Acesso pré-configurado:</p>
                <p>
                  Usuário: <span className="font-mono text-[#B3541E]">renandm@gmail.com</span>
                </p>
                <p>
                  Senha: <span className="font-mono text-[#B3541E]">Skip@Pass</span>
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-3 pt-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#B3541E] hover:bg-[#9A4618] text-white font-medium"
              >
                {isLoading ? 'Entrando...' : 'Entrar no CRM'}
              </Button>

              <div className="text-center text-xs text-[#8A8178]">
                Não possui conta?{' '}
                <Link to="/registro" className="text-[#B3541E] font-semibold hover:underline">
                  Cadastre-se
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
