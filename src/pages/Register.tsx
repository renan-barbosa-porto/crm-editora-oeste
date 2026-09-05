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

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password) return

    if (password.length < 8) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve possuir pelo menos 8 caracteres.',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      await register(name, email, password)
      toast({
        title: 'Conta criada!',
        description: 'Bem-vindo ao CRM da Editora & Gráfica.',
      })
      navigate('/')
    } catch (error: any) {
      toast({
        title: 'Erro ao cadastrar',
        description: error?.message || 'Verifique seus dados e tente novamente.',
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
            <CardTitle className="font-serif text-xl text-[#1E1B16]">Criar Nova Conta</CardTitle>
            <CardDescription className="text-xs text-[#8A8178]">
              Cadastre seu usuário para ter acesso ao painel de atendimento e vendas.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-[#1E1B16]">
                  Nome Completo
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  required
                  className="border-[#E5DFD6] focus-visible:ring-[#B3541E]"
                />
              </div>

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
                <Label htmlFor="password" className="text-xs font-semibold text-[#1E1B16]">
                  Senha (mínimo 8 caracteres)
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="border-[#E5DFD6] focus-visible:ring-[#B3541E]"
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-3 pt-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#B3541E] hover:bg-[#9A4618] text-white font-medium"
              >
                {isLoading ? 'Cadastrando...' : 'Criar Conta'}
              </Button>

              <div className="text-center text-xs text-[#8A8178]">
                Já tem uma conta?{' '}
                <Link to="/login" className="text-[#B3541E] font-semibold hover:underline">
                  Faça login
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
