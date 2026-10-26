import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { createContact, findContactByEmail } from '@/services/contacts'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'

interface NewContactModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function NewContactModal({ open, onOpenChange, onSuccess }: NewContactModalProps) {
  const { toast } = useToast()
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [endereco, setEndereco] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      setErrors({})
    }
  }, [open])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!nome.trim()) {
      errs.nome = 'Nome é obrigatório'
    }
    if (!telefone.trim()) {
      errs.telefone = 'Telefone é obrigatório'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      if (email.trim()) {
        const existing = await findContactByEmail(email.trim())
        if (existing) {
          setErrors({ email: 'Já existe um contato cadastrado com este e-mail' })
          setIsSubmitting(false)
          return
        }
      }

      await createContact({
        nome: nome.trim(),
        telefone: telefone.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(empresa.trim() ? { empresa: empresa.trim() } : {}),
        ...(endereco.trim() ? { endereco: endereco.trim() } : {}),
      })

      toast({
        title: 'Contato cadastrado com sucesso!',
        description: `O contato "${nome}" foi adicionado à lista.`,
      })

      setNome('')
      setTelefone('')
      setEmail('')
      setEmpresa('')
      setEndereco('')
      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (error: any) {
      const fieldErrs = extractFieldErrors(error)
      if (Object.keys(fieldErrs).length > 0) {
        setErrors((prev) => ({ ...prev, ...fieldErrs }))
      }

      const message = getErrorMessage(error) || 'Verifique as informações e tente novamente.'
      toast({
        title: 'Erro ao cadastrar contato',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-white border-[#E5DFD6]">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-[#1E1B16]">Novo Contato</DialogTitle>
          <DialogDescription className="text-sm text-[#8A8178]">
            Adicione uma pessoa de contato de cliente ou parceiro comercial.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <Label
              htmlFor="contact-nome"
              className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
            >
              Nome completo *
            </Label>
            <Input
              id="contact-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Carlos Eduardo"
              className="mt-1 border-[#E5DFD6] focus-visible:ring-[#B3541E]"
            />
            {errors.nome && <p className="text-xs text-[#B3261E] mt-1">{errors.nome}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label
                htmlFor="contact-telefone"
                className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
              >
                Telefone / Celular *
              </Label>
              <Input
                id="contact-telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Ex: 11987654321"
                className="mt-1 border-[#E5DFD6] focus-visible:ring-[#B3541E]"
              />
              {errors.telefone && <p className="text-xs text-[#B3261E] mt-1">{errors.telefone}</p>}
            </div>

            <div>
              <Label
                htmlFor="contact-email"
                className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
              >
                Email
              </Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="carlos@empresa.com"
                className="mt-1 border-[#E5DFD6] focus-visible:ring-[#B3541E]"
              />
              {errors.email && <p className="text-xs text-[#B3261E] mt-1">{errors.email}</p>}
            </div>
          </div>

          <div>
            <Label
              htmlFor="contact-empresa"
              className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
            >
              Empresa / Razão Social
            </Label>
            <Input
              id="contact-empresa"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Ex: Editora Saber & Arte"
              className="mt-1 border-[#E5DFD6] focus-visible:ring-[#B3541E]"
            />
          </div>

          <div>
            <Label
              htmlFor="contact-endereco"
              className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
            >
              Endereço Completo
            </Label>
            <Input
              id="contact-endereco"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua, número, complemento, bairro, cidade - UF"
              className="mt-1 border-[#E5DFD6] focus-visible:ring-[#B3541E]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#E5DFD6] text-[#8A8178] hover:bg-[#F7F5F2]"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !nome.trim() || !telefone.trim()}
              className="bg-[#B3541E] hover:bg-[#9A4618] text-white"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Contato'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
