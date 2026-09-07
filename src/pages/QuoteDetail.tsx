import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getQuoteById,
  updateQuote,
  updateQuoteStatus,
  getQuoteItems,
  createQuoteItem,
  updateQuoteItem,
  deleteQuoteItem,
} from '@/services/quotes'
import { getConversationsByLeadId, getConversationsByContactId } from '@/services/conversations'
import { useRealtime } from '@/hooks/use-realtime'
import type { Quote, QuoteItem, Conversation, QuoteStatus } from '@/types/crm'
import {
  ArrowLeft,
  FileText,
  User,
  Phone,
  Mail,
  Building,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Send,
  XCircle,
  MessageCircle,
  Calendar,
  AlertTriangle,
} from 'lucide-react'
import { getPrazoDestaque, getQuoteDataEnvio, formatWhatsAppUrl } from '@/lib/quote-utils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [quote, setQuote] = useState<Quote | null>(null)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  // Status update confirmation
  const [confirmAprovarOpen, setConfirmAprovarOpen] = useState(false)
  const [descontoPercentual, setDescontoPercentual] = useState<number>(0)
  const [isUpdatingDiscount, setIsUpdatingDiscount] = useState(false)
  const [dataEnvioEdit, setDataEnvioEdit] = useState<string>('')
  const [isUpdatingDataEnvio, setIsUpdatingDataEnvio] = useState(false)

  // Novo item em adição
  const [novaDescricao, setNovaDescricao] = useState('')
  const [novaQtd, setNovaQtd] = useState(1)
  const [novoValorUnit, setNovoValorUnit] = useState(0)
  const [isAddingItem, setIsAddingItem] = useState(false)

  const loadData = async () => {
    if (!id) return
    try {
      const q = await getQuoteById(id)
      setQuote(q)
      setDescontoPercentual(q.desconto_percentual || 0)
      if (q.data_envio) {
        setDataEnvioEdit(q.data_envio.slice(0, 10))
      } else if (q.created) {
        setDataEnvioEdit(q.created.slice(0, 10))
      }

      const qItems = await getQuoteItems(id)
      setItems(qItems)

      // Conversas do lead ou contato
      let convs: Conversation[] = []
      if (q.lead_id) {
        convs = await getConversationsByLeadId(q.lead_id)
      } else if (q.contact_id) {
        convs = await getConversationsByContactId(q.contact_id)
      }
      setConversations(convs)
    } catch {
      toast({
        title: 'Orçamento não encontrado',
        variant: 'destructive',
      })
      navigate('/orcamentos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  useRealtime('quotes', () => {
    if (id) getQuoteById(id).then(setQuote)
  })
  useRealtime('quote_items', () => {
    if (id) getQuoteItems(id).then(setItems)
  })

  // Cálculos de Totais
  const subtotal = items.reduce(
    (acc, it) => acc + (it.quantidade || 0) * (it.valor_unitario || 0),
    0,
  )
  const valorDesconto = (subtotal * (Number(descontoPercentual) || 0)) / 100
  const valorTotal = Math.max(0, subtotal - valorDesconto)

  const handleSaveDataEnvio = async () => {
    if (!id || !dataEnvioEdit) return
    setIsUpdatingDataEnvio(true)
    try {
      const updated = await updateQuote(id, {
        data_envio: `${dataEnvioEdit} 12:00:00`,
      })
      setQuote(updated)
      toast({
        title: 'Data de envio atualizada',
        description: 'A nova data foi salva com sucesso.',
      })
    } catch {
      toast({
        title: 'Erro ao atualizar data de envio',
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingDataEnvio(false)
    }
  }

  const handleApplyDiscount = async () => {
    if (!id) return
    setIsUpdatingDiscount(true)
    try {
      await updateQuote(id, {
        desconto_percentual: Number(descontoPercentual) || 0,
      })
      toast({
        title: 'Desconto atualizado',
      })
    } catch {
      toast({
        title: 'Erro ao salvar desconto',
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingDiscount(false)
    }
  }

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !novaDescricao.trim()) return

    setIsAddingItem(true)
    try {
      await createQuoteItem({
        quote_id: id,
        descricao: novaDescricao.trim(),
        quantidade: Math.max(1, Number(novaQtd) || 1),
        valor_unitario: Math.max(0, Number(novoValorUnit) || 0),
        desconto_percentual: 0,
      })
      setNovaDescricao('')
      setNovaQtd(1)
      setNovoValorUnit(0)
      const updatedItems = await getQuoteItems(id)
      setItems(updatedItems)
      toast({
        title: 'Item adicionado ao orçamento',
      })
    } catch {
      toast({
        title: 'Erro ao adicionar item',
        variant: 'destructive',
      })
    } finally {
      setIsAddingItem(false)
    }
  }

  const handleRemoveItem = async (itemId: string) => {
    try {
      await deleteQuoteItem(itemId)
      setItems((prev) => prev.filter((i) => i.id !== itemId))
      toast({
        title: 'Item removido',
      })
    } catch {
      toast({
        title: 'Erro ao remover item',
        variant: 'destructive',
      })
    }
  }

  const handleChangeStatus = async (novoStatus: QuoteStatus) => {
    if (!id) return
    if (novoStatus === 'Aprovado') {
      setConfirmAprovarOpen(true)
      return
    }

    try {
      const updated = await updateQuoteStatus(id, novoStatus)
      setQuote(updated)
      toast({
        title: `Status alterado para "${novoStatus}"`,
      })
    } catch {
      toast({
        title: 'Erro ao alterar status',
        variant: 'destructive',
      })
    }
  }

  const confirmAprovacao = async () => {
    if (!id) return
    try {
      const updated = await updateQuoteStatus(id, 'Aprovado')
      setQuote(updated)
      toast({
        title: 'Orçamento Aprovado!',
        description: 'Parabéns pela conversão da proposta em pedido.',
      })
    } catch {
      toast({
        title: 'Erro ao aprovar orçamento',
        variant: 'destructive',
      })
    }
  }

  const handleQuickEditDraft = async () => {
    if (!id || !quote) return
    // "Editar (fixa o status para 'Enviado' se estava em 'Rascunho')"
    if (quote.status === 'Rascunho') {
      try {
        const updated = await updateQuoteStatus(id, 'Enviado')
        setQuote(updated)
        toast({
          title: 'Orçamento marcado como Enviado',
        })
      } catch {
        toast({
          title: 'Erro ao atualizar',
          variant: 'destructive',
        })
      }
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Rascunho':
        return (
          <Badge variant="outline" className="border-[#8A8178] text-[#8A8178] bg-[#F7F5F2]">
            Rascunho
          </Badge>
        )
      case 'Enviado':
        return <Badge className="bg-[#2B5F8A] text-white">Enviado</Badge>
      case 'Visualizado':
        return <Badge className="bg-[#C07A1B] text-white font-semibold">Visualizado</Badge>
      case 'Aprovado':
        return <Badge className="bg-[#2F7D4F] text-white">Aprovado</Badge>
      case 'Rejeitado':
        return <Badge className="bg-[#B3261E] text-white">Rejeitado</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  if (loading || !quote) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#B3541E] border-t-transparent" />
          <p className="text-sm font-serif text-[#8A8178]">Carregando Detalhes do Orçamento...</p>
        </div>
      </div>
    )
  }

  // Dados do cliente relacionados
  const clienteNome =
    quote.expand?.contact_id?.nome || quote.expand?.lead_id?.nome || 'Cliente não informado'
  const clienteEmpresa = quote.expand?.contact_id?.empresa || quote.expand?.lead_id?.empresa
  const clienteTelefone = quote.expand?.contact_id?.telefone || quote.expand?.lead_id?.telefone
  const clienteEmail = quote.expand?.contact_id?.email || quote.expand?.lead_id?.email

  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/orcamentos')}
          className="text-[#8A8178] hover:text-[#1E1B16] -ml-2 h-8"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar para Orçamentos
        </Button>
      </div>

      {/* Cabeçalho do Orçamento */}
      <div className="bg-white p-5 rounded-lg border border-[#E5DFD6] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#8A8178]">
            <span>{quote.codigo || 'ORC-TEMP'}</span>
            <span>•</span>
            <span>
              Criado em{' '}
              {new Date(quote.created).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </span>
            {(() => {
              const dt = getQuoteDataEnvio(quote)
              if (!dt) return null
              return (
                <>
                  <span>•</span>
                  <span>
                    Enviado em{' '}
                    {dt.toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </span>
                </>
              )
            })()}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <h1 className="font-serif text-2xl font-bold text-[#1E1B16]">{quote.titulo}</h1>
            {getStatusBadge(quote.status)}
            {(() => {
              const prazo = getPrazoDestaque(quote)
              if (!prazo) return null
              return (
                <Badge className={cn('text-xs px-2.5 py-0.5', prazo.badgeClass)}>
                  {prazo.urgencia === 'urgente' && (
                    <AlertTriangle className="w-3 h-3 mr-1 inline" />
                  )}
                  {prazo.label}
                </Badge>
              )
            })()}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {quote.status === 'Rascunho' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleQuickEditDraft}
              className="border-[#E5DFD6] text-[#2B5F8A] hover:bg-[#F0F5FA]"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Marcar como Enviado
            </Button>
          )}

          {/* Menu Atualizar Status */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="bg-[#B3541E] hover:bg-[#9A4618] text-white">
                Atualizar Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white border-[#E5DFD6]">
              <DropdownMenuItem onClick={() => handleChangeStatus('Enviado')}>
                <Send className="w-4 h-4 mr-2 text-[#2B5F8A]" />
                Enviado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleChangeStatus('Visualizado')}>
                <Clock className="w-4 h-4 mr-2 text-[#C07A1B]" />
                Visualizado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleChangeStatus('Aprovado')}>
                <CheckCircle2 className="w-4 h-4 mr-2 text-[#2F7D4F]" />
                Aprovado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleChangeStatus('Rejeitado')}>
                <XCircle className="w-4 h-4 mr-2 text-[#B3261E]" />
                Rejeitado
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Grid: Informações do Cliente + Tabela de Itens */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Card Dados do Cliente (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="bg-white border-[#E5DFD6] shadow-sm">
            <CardHeader className="p-4 pb-2 border-b border-[#E5DFD6]">
              <CardTitle className="font-serif text-sm font-bold text-[#1E1B16]">
                Dados do Solicitante
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-sm">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8178]">
                  Cliente / Lead
                </span>
                <p className="flex items-center gap-2 mt-1 text-[#1E1B16] font-semibold">
                  <User className="w-4 h-4 text-[#8A8178]" />
                  {clienteNome}
                </p>
              </div>

              {clienteEmpresa && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8178]">
                    Empresa
                  </span>
                  <p className="flex items-center gap-2 mt-1 text-[#1E1B16]">
                    <Building className="w-4 h-4 text-[#8A8178]" />
                    {clienteEmpresa}
                  </p>
                </div>
              )}

              {clienteTelefone && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8178]">
                    WhatsApp / Telefone
                  </span>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="flex items-center gap-2 text-[#1E1B16] font-mono">
                      <Phone className="w-4 h-4 text-[#2F7D4F]" />
                      {clienteTelefone}
                    </p>
                    <a
                      href={formatWhatsAppUrl(
                        clienteTelefone,
                        `Olá ${clienteNome}! Gostaria de dar um retorno sobre a proposta "${quote.titulo}".`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded bg-[#2F7D4F]/10 text-[#2F7D4F] hover:bg-[#2F7D4F]/20 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Conversar
                    </a>
                  </div>
                </div>
              )}

              {clienteEmail && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8178]">
                    Email
                  </span>
                  <p className="flex items-center gap-2 mt-1 text-[#1E1B16] truncate">
                    <Mail className="w-4 h-4 text-[#8A8178]" />
                    {clienteEmail}
                  </p>
                </div>
              )}
              {/* Campo para editar Data de Envio da Proposta */}
              <div className="pt-3 border-t border-[#E5DFD6]">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#1E1B16] flex items-center gap-1.5 mb-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#B3541E]" />
                  Data de Envio da Proposta
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dataEnvioEdit}
                    onChange={(e) => setDataEnvioEdit(e.target.value)}
                    className="h-8 text-xs border-[#E5DFD6] bg-[#FAF8F5]"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveDataEnvio}
                    disabled={isUpdatingDataEnvio || !dataEnvioEdit}
                    className="h-8 text-xs border-[#E5DFD6] hover:bg-white text-[#B3541E]"
                  >
                    Salvar
                  </Button>
                </div>
                <p className="text-[11px] text-[#8A8178] mt-1">
                  Data em que a proposta foi entregue ao cliente.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Itens e Totais (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="bg-white border-[#E5DFD6] shadow-sm">
            <CardHeader className="p-4 border-b border-[#E5DFD6]">
              <CardTitle className="font-serif text-base font-bold text-[#1E1B16] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#B3541E]" />
                Itens e Serviços Orçados
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#FAF8F5] border-b border-[#E5DFD6] text-[#8A8178] uppercase font-semibold tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Item / Descrição</th>
                      <th className="py-3 px-3 text-center w-20">Qtd</th>
                      <th className="py-3 px-3 text-right w-28">Valor Unit.</th>
                      <th className="py-3 px-3 text-right w-28">Subtotal</th>
                      <th className="py-3 px-3 text-center w-12">Remover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5DFD6]">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-xs text-[#8A8178]">
                          Nenhum item adicionado a este orçamento ainda.
                        </td>
                      </tr>
                    ) : (
                      items.map((it) => {
                        const itemSub = (it.quantidade || 0) * (it.valor_unitario || 0)
                        return (
                          <tr key={it.id} className="hover:bg-[#FAF8F5]">
                            <td className="py-3 px-4 font-medium text-[#1E1B16]">{it.descricao}</td>
                            <td className="py-3 px-3 text-center font-mono">{it.quantidade}</td>
                            <td className="py-3 px-3 text-right font-mono text-[#8A8178]">
                              {(it.valor_unitario || 0).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-[#1E1B16] font-mono">
                              {itemSub.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(it.id)}
                                className="h-7 w-7 text-[#8A8178] hover:text-[#B3261E]"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Formulário Linha Adicionar Item */}
              <form
                onSubmit={handleAddItem}
                className="p-3 bg-[#FAF8F5] border-t border-[#E5DFD6] flex flex-col sm:flex-row items-center gap-2"
              >
                <Input
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  placeholder="Nova descrição do serviço/produto"
                  className="flex-1 text-xs sm:text-sm h-8 bg-white border-[#E5DFD6]"
                />
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    type="number"
                    min="1"
                    value={novaQtd}
                    onChange={(e) => setNovaQtd(parseInt(e.target.value) || 1)}
                    placeholder="Qtd"
                    className="w-20 text-xs sm:text-sm h-8 bg-white border-[#E5DFD6]"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={novoValorUnit}
                    onChange={(e) => setNovoValorUnit(parseFloat(e.target.value) || 0)}
                    placeholder="R$ Unit."
                    className="w-28 text-xs sm:text-sm h-8 bg-white border-[#E5DFD6]"
                  />
                  <Button
                    type="submit"
                    disabled={isAddingItem || !novaDescricao.trim()}
                    size="sm"
                    className="h-8 bg-[#B3541E] hover:bg-[#9A4618] text-white text-xs whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </form>

              {/* Bloco de Totais */}
              <div className="p-4 sm:p-5 bg-white border-t border-[#E5DFD6] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#8A8178]">Desconto (%):</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={descontoPercentual}
                    onChange={(e) => setDescontoPercentual(parseFloat(e.target.value) || 0)}
                    onBlur={handleApplyDiscount}
                    className="w-20 h-8 text-xs font-mono border-[#E5DFD6]"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleApplyDiscount}
                    disabled={isUpdatingDiscount}
                    className="h-8 text-xs border-[#E5DFD6]"
                  >
                    Salvar %
                  </Button>
                </div>

                <div className="text-right space-y-1 w-full sm:w-auto">
                  <div className="text-xs text-[#8A8178]">
                    Subtotal:{' '}
                    <span className="font-mono">
                      {subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  {valorDesconto > 0 && (
                    <div className="text-xs text-[#B3261E]">
                      Desconto ({descontoPercentual}%):{' '}
                      <span className="font-mono">
                        -{' '}
                        {valorDesconto.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </span>
                    </div>
                  )}
                  <div className="font-serif text-2xl font-bold text-[#1E1B16] pt-1 border-t border-[#E5DFD6]">
                    Total:{' '}
                    <span className="text-[#B3541E] font-mono">
                      {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Histórico de Conversas do Lead/Contato */}
          <Card className="bg-white border-[#E5DFD6] shadow-sm">
            <CardHeader className="p-4 border-b border-[#E5DFD6]">
              <CardTitle className="font-serif text-base font-bold text-[#1E1B16] flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#2F7D4F]" />
                Histórico de Conversas com o Cliente
              </CardTitle>
              <p className="text-xs text-[#8A8178]">
                Contexto das interações no WhatsApp para acompanhar a negociação
              </p>
            </CardHeader>
            <CardContent className="p-4">
              {conversations.length === 0 ? (
                <p className="text-xs text-[#8A8178] text-center p-3">
                  Nenhuma conversa registrada para este cliente.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {conversations.map((c) => {
                    const isSent = c.direcao === 'enviada'
                    const dataHora = new Date(c.created).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    return (
                      <div
                        key={c.id}
                        className={`p-2.5 rounded text-xs border ${
                          isSent
                            ? 'bg-[#E1F2E8] border-[#C5E6D2] text-[#1E1B16]'
                            : 'bg-[#FAF8F5] border-[#E5DFD6] text-[#1E1B16]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1 text-[10px] text-[#8A8178]">
                          <span className="font-semibold">
                            {isSent ? 'Mensagem Enviada' : 'Mensagem Recebida'}
                          </span>
                          <span>{dataHora}</span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed">{c.mensagem}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmação de Aprovação */}
      <AlertDialog open={confirmAprovarOpen} onOpenChange={setConfirmAprovarOpen}>
        <AlertDialogContent className="bg-white border-[#E5DFD6]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1E1B16]">
              Aprovar este Orçamento?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#8A8178]">
              Ao aprovar o orçamento "{quote.titulo}", o status será atualizado para "Aprovado" e
              computado nos indicadores de conversão do CRM.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E5DFD6]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAprovacao}
              className="bg-[#2F7D4F] hover:bg-[#25633e] text-white"
            >
              Sim, Aprovar Orçamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
