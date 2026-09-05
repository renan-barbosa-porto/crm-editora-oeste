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
import { BookOpen, Printer } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function Login() {
  const [email, setEmail] = useState('renandm@gmail.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setIsLoading(true)
    try {
      await login(email, password)
      toast({
        title: 'Bem-vindo de volta!',
        description: 'Login efetuado com sucesso.',
      })
      navigate('/')
    } catch (error: any) {
      toast({
        title: 'Falha no login',
        description: error?.message || 'Email ou senha inválidos. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
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
