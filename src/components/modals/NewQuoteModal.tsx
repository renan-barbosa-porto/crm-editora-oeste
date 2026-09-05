import React, { useState, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createQuote } from '@/services/quotes'
import { getLeads } from '@/services/leads'
import { useToast } from '@/hooks/use-toast'
import type { Lead, QuoteItem, QuoteStatus } from '@/types/crm'
import { Plus, Trash2 } from 'lucide-react'

interface NewQuoteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialLeadId?: string
  onSuccess?: (newQuoteId?: string) => void
}

interface ItemRow {
  descricao: string
  quantidade: number
  valor_unitario: number
}

export function NewQuoteModal({
  open,
  onOpenChange,
  initialLeadId,
  onSuccess,
}: NewQuoteModalProps) {
  const { toast } = useToast()
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLeadId || '')
  const [titulo, setTitulo] = useState('')
  const [status, setStatus] = useState<QuoteStatus>('Rascunho')
  const [descontoPercentual, setDescontoPercentual] = useState<number>(0)
  const [validade, setValidade] = useState('')
  const [items, setItems] = useState<ItemRow[]>([
    { descricao: '', quantidade: 1, valor_unitario: 0 },
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      getLeads().then((list) => {
        setLeads(list)
        if (initialLeadId) {
          setSelectedLeadId(initialLeadId)
          const found = list.find((l) => l.id === initialLeadId)
          if (found && !titulo) {
            setTitulo(`Orçamento — ${found.nome}`)
          }
        }
      })
      setErrors({})
    }
  }, [open, initialLeadId])

  const handleAddItem = () => {
    setItems([...items, { descricao: '', quantidade: 1, valor_unitario: 0 }])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setItems([{ descricao: '', quantidade: 1, valor_unitario: 0 }])
      return
    }
    setItems(items.filter((_, i) => i !== index))
  }

  const handleUpdateItem = (index: number, field: keyof ItemRow, value: any) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)
  }

  const subtotal = items.reduce(
    (acc, it) => acc + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0),
    0,
  )
  const valorDesconto = (subtotal * (Number(descontoPercentual) || 0)) / 100
  const valorTotal = Math.max(0, subtotal - valorDesconto)

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!titulo.trim()) {
      errs.titulo = 'Título do orçamento é obrigatório'
    }
    if (!selectedLeadId) {
      errs.leadId = 'Selecione um Lead'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    try {
      const selectedLead = leads.find((l) => l.id === selectedLeadId)

      const quote = await createQuote(
        {
          titulo: titulo.trim(),
          lead_id: selectedLeadId,
          contact_id: selectedLead?.contact_id || undefined,
          status,
          desconto_percentual: Number(descontoPercentual) || 0,
          validade: validade || undefined,
        },
        items.filter((it) => it.descricao.trim() !== '') as Partial<QuoteItem>[],
      )

      toast({
        title: 'Orçamento criado com sucesso!',
        description: `Orçamento "${titulo}" foi gerado em ${status}.`,
      })

      // Limpar formulário
      setTitulo('')
      setSelectedLeadId('')
      setDescontoPercentual(0)
      setValidade('')
      setItems([{ descricao: '', quantidade: 1, valor_unitario: 0 }])
      onOpenChange(false)
      if (onSuccess) onSuccess(quote.id)
    } catch (error: any) {
      toast({
        title: 'Erro ao gerar orçamento',
        description: error?.message || 'Verifique as informações e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border-[#E5DFD6]">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-[#1E1B16]">Novo Orçamento</DialogTitle>
          <DialogDescription className="text-sm text-[#8A8178]">
            Monte a proposta comercial com serviços gráficos, editoriais ou livros.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label
                htmlFor="quote-lead"
                className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
              >
                Lead Solicitante *
              </Label>
              <Select
                value={selectedLeadId}
                onValueChange={(val) => {
                  setSelectedLeadId(val)
                  const leadFound = leads.find((l) => l.id === val)
                  if (leadFound && (!titulo || titulo.startsWith('Orçamento —'))) {
                    setTitulo(`Orçamento — ${leadFound.nome}`)
                  }
                }}
              >
                <SelectTrigger id="quote-lead" className="mt-1 border-[#E5DFD6]">
                  <SelectValue placeholder="Selecione o lead" />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nome} {l.empresa ? `(${l.empresa})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.leadId && <p className="text-xs text-[#B3261E] mt-1">{errors.leadId}</p>}
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]">
                Status Inicial
              </Label>
              <Select value={status} onValueChange={(val) => setStatus(val as QuoteStatus)}>
                <SelectTrigger className="mt-1 border-[#E5DFD6]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Rascunho">Rascunho</SelectItem>
                  <SelectItem value="Enviado">Enviado</SelectItem>
                  <SelectItem value="Visualizado">Visualizado</SelectItem>
                  <SelectItem value="Aprovado">Aprovado</SelectItem>
                  <SelectItem value="Rejeitado">Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label
              htmlFor="quote-titulo"
              className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
            >
              Título do Orçamento / Projeto *
            </Label>
            <Input
              id="quote-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Impressão de 500 Livros 120 páginas"
              className="mt-1 border-[#E5DFD6] focus-visible:ring-[#B3541E]"
            />
            {errors.titulo && <p className="text-xs text-[#B3261E] mt-1">{errors.titulo}</p>}
          </div>

          <div>
            <Label
              htmlFor="quote-validade"
              className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
            >
              Data de Validade (opcional)
            </Label>
            <Input
              id="quote-validade"
              type="date"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
              className="mt-1 border-[#E5DFD6] focus-visible:ring-[#B3541E]"
            />
          </div>

          {/* Itens do orçamento */}
          <div className="border border-[#E5DFD6] rounded-md p-3 bg-[#FAF8F5]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]">
                Itens & Serviços
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="h-7 text-xs border-[#E5DFD6] hover:bg-white text-[#B3541E]"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Adicionar Item
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-white p-2 rounded border border-[#E5DFD6]"
                >
                  <Input
                    placeholder="Descrição do serviço/produto"
                    value={item.descricao}
                    onChange={(e) => handleUpdateItem(idx, 'descricao', e.target.value)}
                    className="flex-1 text-sm border-[#E5DFD6]"
                  />
                  <div className="w-20">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qtd"
                      value={item.quantidade}
                      onChange={(e) =>
                        handleUpdateItem(
                          idx,
                          'quantidade',
                          Math.max(1, parseInt(e.target.value) || 1),
                        )
                      }
                      className="text-sm border-[#E5DFD6]"
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Unitário (R$)"
                      value={item.valor_unitario}
                      onChange={(e) =>
                        handleUpdateItem(idx, 'valor_unitario', parseFloat(e.target.value) || 0)
                      }
                      className="text-sm border-[#E5DFD6]"
                    />
                  </div>
                  <div className="w-24 text-right text-xs font-medium text-[#1E1B16] pr-1">
                    {(
                      (Number(item.quantidade) || 0) * (Number(item.valor_unitario) || 0)
                    ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(idx)}
                    className="h-8 w-8 text-[#8A8178] hover:text-[#B3261E]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Totais */}
            <div className="mt-4 pt-3 border-t border-[#E5DFD6] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Label htmlFor="quote-desc" className="text-xs text-[#8A8178]">
                  Desconto (%):
                </Label>
                <Input
                  id="quote-desc"
                  type="number"
                  min="0"
                  max="100"
                  value={descontoPercentual}
                  onChange={(e) =>
                    setDescontoPercentual(
                      Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                    )
                  }
                  className="w-20 h-8 border-[#E5DFD6]"
                />
              </div>

              <div className="text-right">
                <div className="text-xs text-[#8A8178]">
                  Subtotal:{' '}
                  {subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
                <div className="font-serif text-lg font-bold text-[#1E1B16]">
                  Total:{' '}
                  <span className="text-[#B3541E]">
                    {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
              disabled={isSubmitting || !titulo.trim() || !selectedLeadId}
              className="bg-[#B3541E] hover:bg-[#9A4618] text-white"
            >
              {isSubmitting ? 'Gerando...' : 'Gerar Orçamento'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
