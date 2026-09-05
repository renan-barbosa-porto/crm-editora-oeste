import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getLeadById, updateLead, deleteLead } from '@/services/leads'
import { getQuotesByLeadId, getQuoteItems } from '@/services/quotes'
import { getConversationsByLeadId, createConversation } from '@/services/conversations'
import { useRealtime } from '@/hooks/use-realtime'
import type { Lead, Quote, Conversation, LeadEstagio } from '@/types/crm'
import {
  Phone,
  Mail,
  Building,
  MapPin,
  MessageCircle,
  FileText,
  Send,
  MoreVertical,
  Trash2,
  Edit,
  ArrowLeft,
  Plus,
} from 'lucide-react'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { NewQuoteModal } from '@/components/modals/NewQuoteModal'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [lead, setLead] = useState<Lead | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [quoteValues, setQuoteValues] = useState<Record<string, number>>({})
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [novaMensagem, setNovaMensagem] = useState('')
  const [direcaoEnvio, setDirecaoEnvio] = useState<'enviada' | 'recebida'>('enviada')
  const [loading, setLoading] = useState(true)

  // Modais de ação
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [newQuoteModalOpen, setNewQuoteModalOpen] = useState(false)

  // Campos de edição
  const [editNome, setEditNome] = useState('')
  const [editTelefone, setEditTelefone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editEmpresa, setEditEmpresa] = useState('')
  const [editEstagio, setEditEstagio] = useState<LeadEstagio>('Novo')
  const [editObservacoes, setEditObservacoes] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadAll = async () => {
    if (!id) return
    try {
      const [leadData, quotesData, convsData] = await Promise.all([
        getLeadById(id),
        getQuotesByLeadId(id),
        getConversationsByLeadId(id),
      ])
      setLead(leadData)
      setQuotes(quotesData)
      setConversations(convsData)

      // Inicializa campos de edição
      setEditNome(leadData.nome)
      setEditTelefone(leadData.telefone)
      setEditEmail(leadData.email || '')
      setEditEmpresa(leadData.empresa || '')
      setEditEstagio(leadData.estagio)
      setEditObservacoes(leadData.observacoes || '')

      // Buscar valores dos orçamentos
      const valMap: Record<string, number> = {}
      for (const q of quotesData) {
        try {
          const items = await getQuoteItems(q.id)
          const subtotal = items.reduce(
            (acc, it) => acc + (it.quantidade || 0) * (it.valor_unitario || 0),
            0,
          )
          const desc = (subtotal * (q.desconto_percentual || 0)) / 100
          valMap[q.id] = Math.max(0, subtotal - desc)
        } catch {
          valMap[q.id] = 0
        }
      }
      setQuoteValues(valMap)
    } catch (err) {
      console.error('Erro ao carregar lead:', err)
      toast({
        title: 'Lead não encontrado',
        description: 'Não foi possível carregar os dados deste lead.',
        variant: 'destructive',
      })
      navigate('/leads')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [id])

  useRealtime('conversations', () => {
    if (id) getConversationsByLeadId(id).then(setConversations)
  })
  useRealtime('quotes', () => {
    if (id) getQuotesByLeadId(id).then(setQuotes)
  })
  useRealtime('leads', () => {
    if (id) getLeadById(id).then(setLead)
  })

  // Rolagem suave para o fim das mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversations])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novaMensagem.trim() || !id || !lead) return

    const msgTexto = novaMensagem.trim()
    setNovaMensagem('')

    // Otimista
    const tempConv: Conversation = {
      id: 'temp-' + Date.now(),
      mensagem: msgTexto,
      direcao: direcaoEnvio,
      lead_id: id,
      contact_id: lead.contact_id,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      collectionId: 'conversations',
      collectionName: 'conversations',
    }
    setConversations((prev) => [...prev, tempConv])

    try {
      await createConversation({
        mensagem: msgTexto,
        direcao: direcaoEnvio,
        lead_id: id,
        contact_id: lead.contact_id || undefined,
      })
    } catch {
      toast({
        title: 'Erro ao registrar mensagem',
        variant: 'destructive',
      })
      if (id) getConversationsByLeadId(id).then(setConversations)
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !editNome.trim() || !editTelefone.trim()) return

    setIsSavingEdit(true)
    try {
      const updated = await updateLead(id, {
        nome: editNome.trim(),
        telefone: editTelefone.trim(),
        email: editEmail.trim() || undefined,
        empresa: editEmpresa.trim() || undefined,
        estagio: editEstagio,
        observacoes: editObservacoes.trim() || undefined,
      })
      setLead(updated)
      setEditModalOpen(false)
      toast({
        title: 'Lead atualizado',
        description: 'As alterações foram salvas com sucesso.',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar',
        description: err?.message || 'Falha ao salvar alterações.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDeleteLead = async () => {
    if (!id) return
    try {
      await deleteLead(id)
      toast({
        title: 'Lead excluído',
        description: 'O registro foi removido com sucesso.',
      })
      navigate('/leads')
    } catch {
      toast({
        title: 'Erro ao excluir lead',
        variant: 'destructive',
      })
    }
  }

  const formatWhatsAppLink = (tel: string) => {
    const cleanNumber = tel.replace(/\D/g, '')
    // Se não tiver código de país 55, adiciona
    const fullNumber = cleanNumber.startsWith('55') ? cleanNumber : `55${cleanNumber}`
    return `https://wa.me/${fullNumber}`
  }

  const getEstagioBadge = (estagio: string) => {
    switch (estagio) {
      case 'Novo':
        return <Badge className="bg-[#2B5F8A] text-white">Novo</Badge>
      case 'Contato Feito':
        return <Badge className="bg-[#0284c7] text-white">Contato Feito</Badge>
      case 'Proposta Enviada':
        return <Badge className="bg-[#C07A1B] text-white">Proposta Enviada</Badge>
      case 'Fechado':
        return <Badge className="bg-[#2F7D4F] text-white">Fechado</Badge>
      case 'Perdido':
        return (
          <Badge variant="outline" className="border-gray-400 text-gray-500">
            Perdido
          </Badge>
        )
      default:
        return <Badge variant="secondary">{estagio}</Badge>
    }
  }

  const getQuoteStatusBadge = (status: string) => {
    switch (status) {
      case 'Rascunho':
        return (
          <Badge variant="outline" className="text-xs">
            Rascunho
          </Badge>
        )
      case 'Enviado':
        return <Badge className="bg-[#2B5F8A] text-white text-xs">Enviado</Badge>
      case 'Visualizado':
        return <Badge className="bg-[#C07A1B] text-white text-xs">Visualizado</Badge>
      case 'Aprovado':
        return <Badge className="bg-[#2F7D4F] text-white text-xs">Aprovado</Badge>
      case 'Rejeitado':
        return <Badge className="bg-[#B3261E] text-white text-xs">Rejeitado</Badge>
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {status}
          </Badge>
        )
    }
  }

  if (loading || !lead) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#B3541E] border-t-transparent" />
          <p className="text-sm font-serif text-[#8A8178]">Carregando Detalhes do Lead...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/leads')}
          className="text-[#8A8178] hover:text-[#1E1B16] -ml-2 h-8"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar para Funil
        </Button>
      </div>

      {/* Cabeçalho do Lead */}
      <div className="bg-white p-5 rounded-lg border border-[#E5DFD6] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-serif text-2xl font-bold text-[#1E1B16]">{lead.nome}</h1>
            {getEstagioBadge(lead.estagio)}
          </div>
          {lead.empresa && (
            <p className="text-sm font-medium text-[#8A8178] flex items-center gap-1.5 mt-1">
              <Building className="w-4 h-4" />
              {lead.empresa}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditModalOpen(true)}
            className="border-[#E5DFD6] text-[#1E1B16] hover:bg-[#FAF8F5]"
          >
            <Edit className="w-3.5 h-3.5 mr-1.5 text-[#8A8178]" />
            Editar
          </Button>

          <Button
            size="sm"
            onClick={() => setNewQuoteModalOpen(true)}
            className="bg-[#B3541E] hover:bg-[#9A4618] text-white"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Novo Orçamento
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-[#8A8178]">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-white border-[#E5DFD6]">
              <DropdownMenuItem
                onClick={() => setDeleteConfirmOpen(true)}
                className="text-[#B3261E] focus:text-[#B3261E] focus:bg-[#B3261E]/10 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir Lead
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Grid Central: Informações de Contato + Chat WhatsApp + Orçamentos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Card Lateral Esquerda: Informações de Contato (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="bg-white border-[#E5DFD6] shadow-sm">
            <CardHeader className="p-4 pb-2 border-b border-[#E5DFD6]">
              <CardTitle className="font-serif text-sm font-bold text-[#1E1B16]">
                Dados do Potencial Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 text-sm">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8178]">
                  WhatsApp / Telefone
                </span>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2 text-[#1E1B16] font-medium">
                    <Phone className="w-4 h-4 text-[#2F7D4F]" />
                    {lead.telefone}
                  </div>
                  <a
                    href={formatWhatsAppLink(lead.telefone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded bg-[#2F7D4F]/10 text-[#2F7D4F] hover:bg-[#2F7D4F]/20 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Abrir WhatsApp
                  </a>
                </div>
              </div>

              {lead.email && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8178]">
                    Email
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-[#1E1B16] truncate">
                    <Mail className="w-4 h-4 text-[#8A8178]" />
                    <a href={`mailto:${lead.email}`} className="hover:underline truncate">
                      {lead.email}
                    </a>
                  </div>
                </div>
              )}

              {lead.empresa && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8178]">
                    Empresa
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-[#1E1B16]">
                    <Building className="w-4 h-4 text-[#8A8178]" />
                    {lead.empresa}
                  </div>
                </div>
              )}

              {lead.expand?.contact_id?.endereco && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8178]">
                    Endereço Cadastrado
                  </span>
                  <div className="flex items-start gap-2 mt-1 text-[#1E1B16] text-xs">
                    <MapPin className="w-4 h-4 text-[#8A8178] flex-shrink-0 mt-0.5" />
                    <span>{lead.expand.contact_id.endereco}</span>
                  </div>
                </div>
              )}

              {lead.observacoes && (
                <div className="pt-2 border-t border-[#E5DFD6]">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8178]">
                    Observações do Pedido
                  </span>
                  <p className="text-xs text-[#1E1B16] mt-1 bg-[#FAF8F5] p-2.5 rounded border border-[#E5DFD6] leading-relaxed">
                    {lead.observacoes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Card Central: Conversas WhatsApp (5 cols) */}
        <div className="lg:col-span-5">
          <Card className="bg-white border-[#E5DFD6] shadow-sm flex flex-col h-[520px]">
            <CardHeader className="p-3.5 border-b border-[#E5DFD6] flex flex-row items-center justify-between bg-[#FAF8F5]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#2F7D4F] text-white flex items-center justify-center">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="font-serif text-sm font-bold text-[#1E1B16]">
                    Conversas WhatsApp
                  </CardTitle>
                  <p className="text-[11px] text-[#8A8178]">Histórico registrado manualmente</p>
                </div>
              </div>
            </CardHeader>

            {/* Balões de Mensagem */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FBF9F6]">
              {conversations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-[#8A8178] space-y-1">
                  <MessageCircle className="w-8 h-8 opacity-40 text-[#2F7D4F]" />
                  <p className="text-xs">Nenhuma mensagem registrada ainda.</p>
                  <p className="text-[11px] text-[#8A8178]">
                    Registre notas e mensagens trocadas pelo WhatsApp abaixo.
                  </p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const isSent = conv.direcao === 'enviada'
                  const hora = new Date(conv.created).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  const data = new Date(conv.created).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                  })

                  return (
                    <div
                      key={conv.id}
                      className={cn('flex flex-col', isSent ? 'items-end' : 'items-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[85%] rounded-lg p-2.5 text-xs shadow-xs leading-relaxed',
                          isSent
                            ? 'bg-[#E1F2E8] text-[#1E1B16] rounded-br-none border border-[#C5E6D2]'
                            : 'bg-white text-[#1E1B16] rounded-bl-none border border-[#E5DFD6]',
                        )}
                      >
                        <p className="whitespace-pre-wrap">{conv.mensagem}</p>
                        <div className="text-[10px] text-[#8A8178] mt-1 text-right flex items-center justify-end gap-1">
                          <span>
                            {data} {hora}
                          </span>
                          <span>• {isSent ? 'Você' : lead.nome}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Campo de Entrada no Rodapé */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-[#E5DFD6] bg-white">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-[#8A8178] font-medium">Registrar como:</span>
                <button
                  type="button"
                  onClick={() => setDirecaoEnvio('enviada')}
                  className={cn(
                    'text-[11px] px-2 py-0.5 rounded transition-colors',
                    direcaoEnvio === 'enviada'
                      ? 'bg-[#2F7D4F] text-white font-semibold'
                      : 'bg-[#F7F5F2] text-[#8A8178]',
                  )}
                >
                  Mensagem Enviada
                </button>
                <button
                  type="button"
                  onClick={() => setDirecaoEnvio('recebida')}
                  className={cn(
                    'text-[11px] px-2 py-0.5 rounded transition-colors',
                    direcaoEnvio === 'recebida'
                      ? 'bg-[#2B5F8A] text-white font-semibold'
                      : 'bg-[#F7F5F2] text-[#8A8178]',
                  )}
                >
                  Mensagem Recebida
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  value={novaMensagem}
                  onChange={(e) => setNovaMensagem(e.target.value)}
                  placeholder="Escreva a mensagem ou nota da conversa..."
                  className="text-xs h-9 border-[#E5DFD6] focus-visible:ring-[#2F7D4F]"
                />
                <Button
                  type="submit"
                  disabled={!novaMensagem.trim()}
                  className="h-9 px-3 bg-[#2F7D4F] hover:bg-[#25633e] text-white flex-shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Card Lateral Direita: Orçamentos Vinculados (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          <Card className="bg-white border-[#E5DFD6] shadow-sm">
            <CardHeader className="p-3.5 border-b border-[#E5DFD6] flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-sm font-bold text-[#1E1B16] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#B3541E]" />
                Orçamentos ({quotes.length})
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNewQuoteModalOpen(true)}
                className="h-7 px-2 text-xs text-[#B3541E] hover:bg-[#FAF8F5]"
              >
                <Plus className="w-3.5 h-3.5 mr-0.5" />
                Criar
              </Button>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-[460px] overflow-y-auto">
              {quotes.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#8A8178]">
                  Nenhum orçamento gerado para este lead.
                </div>
              ) : (
                quotes.map((q) => {
                  const valor = (quoteValues[q.id] || 0).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })

                  return (
                    <Link
                      key={q.id}
                      to={`/orcamentos/${q.id}`}
                      className="block p-2.5 rounded-md border border-[#E5DFD6] bg-[#FAF8F5] hover:bg-white hover:shadow-xs transition-all hover:-translate-y-0.5"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-mono font-medium text-[#8A8178]">
                          {q.codigo || 'ORC'}
                        </span>
                        {getQuoteStatusBadge(q.status)}
                      </div>
                      <p className="text-xs font-semibold text-[#1E1B16] line-clamp-1">
                        {q.titulo}
                      </p>
                      <p className="text-xs font-bold text-[#B3541E] mt-1.5 text-right">{valor}</p>
                    </Link>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Edição do Lead */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white border-[#E5DFD6]">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-[#1E1B16]">Editar Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-3.5 pt-2">
            <div>
              <Label className="text-xs font-semibold text-[#1E1B16]">Nome *</Label>
              <Input
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                required
                className="mt-1 border-[#E5DFD6]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-[#1E1B16]">Telefone *</Label>
                <Input
                  value={editTelefone}
                  onChange={(e) => setEditTelefone(e.target.value)}
                  required
                  className="mt-1 border-[#E5DFD6]"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#1E1B16]">Email</Label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="mt-1 border-[#E5DFD6]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-[#1E1B16]">Empresa</Label>
                <Input
                  value={editEmpresa}
                  onChange={(e) => setEditEmpresa(e.target.value)}
                  className="mt-1 border-[#E5DFD6]"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#1E1B16]">Estágio</Label>
                <Select
                  value={editEstagio}
                  onValueChange={(val) => setEditEstagio(val as LeadEstagio)}
                >
                  <SelectTrigger className="mt-1 border-[#E5DFD6]">
                    <SelectValue />
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
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#1E1B16]">Observações</Label>
              <Input
                value={editObservacoes}
                onChange={(e) => setEditObservacoes(e.target.value)}
                className="mt-1 border-[#E5DFD6]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditModalOpen(false)}
                className="border-[#E5DFD6]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSavingEdit || !editNome.trim() || !editTelefone.trim()}
                className="bg-[#B3541E] hover:bg-[#9A4618] text-white"
              >
                {isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-white border-[#E5DFD6]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1E1B16]">Excluir Lead?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#8A8178]">
              Esta ação removerá o lead "{lead.nome}". Mensagens e orçamentos vinculados
              permanecerão arquivados no sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E5DFD6]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLead}
              className="bg-[#B3261E] hover:bg-[#961f18] text-white"
            >
              Sim, Excluir Lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Novo Orçamento Pré-selecionando este Lead */}
      <NewQuoteModal
        open={newQuoteModalOpen}
        onOpenChange={setNewQuoteModalOpen}
        initialLeadId={lead.id}
        onSuccess={() => {
          if (id) getQuotesByLeadId(id).then(setQuotes)
        }}
      />
    </div>
  )
}
