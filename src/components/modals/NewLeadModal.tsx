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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createLead } from '@/services/leads'
import { createContact, findContactByEmail } from '@/services/contacts'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'
import type { LeadEstagio } from '@/types/crm'

interface NewLeadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialEstagio?: LeadEstagio
  onSuccess?: () => void
}

export function NewLeadModal({
  open,
  onOpenChange,
  initialEstagio = 'Novo',
  onSuccess,
}: NewLeadModalProps) {
  const { toast } = useToast()
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [estagio, setEstagio] = useState<LeadEstagio>(initialEstagio)
  const [valorEstimado, setValorEstimado] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [createAsContact, setCreateAsContact] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Sincronizar estágio inicial quando abrir
  React.useEffect(() => {
    if (open) {
      setEstagio(initialEstagio)
      setErrors({})
    }
  }, [open, initialEstagio])

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
      let contactId: string | undefined = undefined

      if (createAsContact) {
        // Verificar se contato já existe por email
        let existingContact = null
        if (email.trim()) {
          existingContact = await findContactByEmail(email.trim())
        }
        if (existingContact) {
          contactId = existingContact.id
        } else {
          const newContact = await createContact({
            nome: nome.trim(),
            telefone: telefone.trim(),
            ...(email.trim() ? { email: email.trim() } : {}),
            ...(empresa.trim() ? { empresa: empresa.trim() } : {}),
          })
          contactId = newContact.id
        }
      }

      const parsedValor = valorEstimado.trim()
        ? parseFloat(valorEstimado.trim().replace(',', '.'))
        : undefined

      await createLead({
        nome: nome.trim(),
        telefone: telefone.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(empresa.trim() ? { empresa: empresa.trim() } : {}),
        estagio,
        ...(parsedValor !== undefined && !Number.isNaN(parsedValor)
          ? { valor_estimado: parsedValor }
          : {}),
        observacoes: observacoes.trim() || undefined,
        contact_id: contactId,
      })

      toast({
        title: 'Lead criado com sucesso!',
        description: `O lead "${nome}" foi cadastrado no estágio ${estagio}.`,
      })

      // Limpar formulário
      setNome('')
      setTelefone('')
      setEmail('')
      setEmpresa('')
      setValorEstimado('')
      setObservacoes('')
      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (error: any) {
      const fieldErrs = extractFieldErrors(error)
      if (Object.keys(fieldErrs).length > 0) {
        setErrors((prev) => ({ ...prev, ...fieldErrs }))
      }

      const message = getErrorMessage(error) || 'Verifique as informações e tente novamente.'
      toast({
        title: 'Erro ao criar lead',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white border-[#E5DFD6]">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-[#1E1B16]">Novo Lead</DialogTitle>
          <DialogDescription className="text-sm text-[#8A8178]">
            Preencha os dados do potencial cliente para iniciar o acompanhamento no pipeline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <Label
              htmlFor="lead-nome"
              className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
            >
              Nome completo *
            </Label>
            <Input
              id="lead-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: João Silva ou Editora Livros & Cia"
              className="mt-1 border-[#E5DFD6] focus-visible:ring-[#B3541E]"
            />
            {errors.nome && <p className="text-xs text-[#B3261E] mt-1">{errors.nome}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label
                htmlFor="lead-telefone"
                className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
              >
                Telefone (WhatsApp) *
              </Label>
              <Input
                id="lead-telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Ex: 11987654321"
                className="mt-1 border-[#E5DFD6] focus-visible:ring-[#B3541E]"
              />
              {errors.telefone && <p className="text-xs text-[#B3261E] mt-1">{errors.telefone}</p>}
            </div>

            <div>
              <Label
                htmlFor="lead-email"
                className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
              >
                Email
              </Label>
              <Input
                id="lead-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@empresa.com"
                className="mt-1 border-[#E5DFD6] focus-visible:ring-[#B3541E]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label
                htmlFor="lead-empresa"
                className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
              >
                Empresa / Instituição
              </Label>
              <Input
                id="lead-empresa"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Nome da empresa (se houver)"
                className="mt-1 border-[#E5DFD6] focus-visible:ring-[#B3541E]"
              />
            </div>

            <div>
              <Label
                htmlFor="lead-valor"
                className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
              >
                Valor Potencial (R$)
              </Label>
              <Input
                id="lead-valor"
                type="number"
                step="0.01"
                value={valorEstimado}
                onChange={(e) => setValorEstimado(e.target.value)}
                placeholder="Ex: 1500.00"
                className="mt-1 border-[#E5DFD6] focus-visible:ring-[#B3541E]"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]">
              Estágio Inicial no Pipeline
            </Label>
            <Select value={estagio} onValueChange={(val) => setEstagio(val as LeadEstagio)}>
              <SelectTrigger className="mt-1 border-[#E5DFD6]">
                <SelectValue placeholder="Selecione o estágio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Novo">Novo</SelectItem>
                <SelectItem value="Contato Feito">Contato Feito</SelectItem>
                <SelectItem value="Proposta Enviada">Proposta Enviada</SelectItem>
                <SelectItem value="Fechado">Fechado</SelectItem>
                <SelectItem value="Perdido">Perdido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label
              htmlFor="lead-obs"
              className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
            >
              Observações do Projeto / Pedido
            </Label>
            <Input
              id="lead-obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Tiragem de 200 exemplares capa dura"
              className="mt-1 border-[#E5DFD6] focus-visible:ring-[#B3541E]"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="createAsContact"
              checked={createAsContact}
              onCheckedChange={(checked) => setCreateAsContact(!!checked)}
            />
            <label
              htmlFor="createAsContact"
              className="text-sm font-medium leading-none text-[#1E1B16] cursor-pointer"
            >
              Criar também como Contato (se ainda não existir)
            </label>
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
              {isSubmitting ? 'Salvando...' : 'Salvar Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
