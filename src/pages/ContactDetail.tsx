import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getContactById, updateContact, deleteContact } from '@/services/contacts'
import { getLeadsByContactId } from '@/services/leads'
import { getQuotesByContactId } from '@/services/quotes'
import { getConversationsByContactId } from '@/services/conversations'
import { useRealtime } from '@/hooks/use-realtime'
import type { Contact, Lead, Quote, Conversation } from '@/types/crm'
import {
  Phone,
  Mail,
  Building,
  MapPin,
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  MessageCircle,
  FileText,
  Target,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

interface TimelineItem {
  id: string
  tipo: 'lead' | 'orcamento' | 'orcamento_aprovado' | 'conversa'
  titulo: string
  descricao: string
  data: string
  link?: string
}

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [contact, setContact] = useState<Contact | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  // Edição e Exclusão
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [editNome, setEditNome] = useState('')
  const [editTelefone, setEditTelefone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editEmpresa, setEditEmpresa] = useState('')
  const [editEndereco, setEditEndereco] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const loadData = async () => {
    if (!id) return
    try {
      const [c, lList, qList, convList] = await Promise.all([
        getContactById(id),
        getLeadsByContactId(id),
        getQuotesByContactId(id),
        getConversationsByContactId(id),
      ])
      setContact(c)
      setLeads(lList)
      setQuotes(qList)
      setConversations(convList)

      setEditNome(c.nome)
      setEditTelefone(c.telefone)
      setEditEmail(c.email || '')
      setEditEmpresa(c.empresa || '')
      setEditEndereco(c.endereco || '')
    } catch {
      toast({
        title: 'Contato não encontrado',
        variant: 'destructive',
      })
      navigate('/contatos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id])

  useRealtime('contacts', () => {
    if (id) getContactById(id).then(setContact)
  })
  useRealtime('leads', () => {
    if (id) getLeadsByContactId(id).then(setLeads)
  })
  useRealtime('quotes', () => {
    if (id) getQuotesByContactId(id).then(setQuotes)
  })
  useRealtime('conversations', () => {
    if (id) getConversationsByContactId(id).then(setConversations)
  })

  // Tem algum orçamento aprovado? Se sim, ganha badge "Cliente"
  const isCliente = quotes.some((q) => q.status === 'Aprovado')

  // Montar Timeline Vertical combinando eventos
  const timeline: TimelineItem[] = []

  leads.forEach((l) => {
    timeline.push({
      id: `lead-${l.id}`,
      tipo: 'lead',
      titulo: 'Novo Lead Criado',
      descricao: `Oportunidade "${l.nome}" no estágio "${l.estagio}"`,
      data: l.created,
      link: `/leads/${l.id}`,
    })
  })

  quotes.forEach((q) => {
    timeline.push({
      id: `quote-${q.id}`,
      tipo: q.status === 'Aprovado' ? 'orcamento_aprovado' : 'orcamento',
      titulo: q.status === 'Aprovado' ? 'Orçamento Aprovado!' : `Orçamento Gerado (${q.status})`,
      descricao: `${q.codigo || 'ORC'} — ${q.titulo}`,
      data: q.created,
      link: `/orcamentos/${q.id}`,
    })
  })

  conversations.forEach((conv) => {
    timeline.push({
      id: `conv-${conv.id}`,
      tipo: 'conversa',
      titulo: conv.direcao === 'enviada' ? 'Mensagem Enviada' : 'Mensagem Recebida',
      descricao: conv.mensagem,
      data: conv.created,
    })
  })

  // Ordenar timeline descrescente (mais recente primeiro)
  timeline.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !editNome.trim() || !editTelefone.trim()) return

    setIsSavingEdit(true)
    try {
      const updated = await updateContact(id, {
        nome: editNome.trim(),
        telefone: editTelefone.trim(),
        email: editEmail.trim() || undefined,
        empresa: editEmpresa.trim() || undefined,
        endereco: editEndereco.trim() || undefined,
      })
      setContact(updated)
      setEditModalOpen(false)
      toast({
        title: 'Contato atualizado com sucesso',
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao atualizar contato',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    try {
      await deleteContact(id)
      toast({
        title: 'Contato excluído',
      })
      navigate('/contatos')
    } catch {
      toast({
        title: 'Erro ao excluir contato',
        variant: 'destructive',
      })
    }
  }

  const formatTelefone = (tel: string) => {
    const clean = tel.replace(/\D/g, '')
    if (clean.length === 11) {
      return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`
    }
    return tel
  }

  if (loading || !contact) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#B3541E] border-t-transparent" />
          <p className="text-sm font-serif text-[#8A8178]">Carregando Detalhes do Contato...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/contatos')}
          className="text-[#8A8178] hover:text-[#1E1B16] -ml-2 h-8"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar para Contatos
        </Button>
      </div>

      {/* Cabeçalho do Contato */}
      <div className="bg-white p-5 rounded-lg border border-[#E5DFD6] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-serif text-2xl font-bold text-[#1E1B16]">{contact.nome}</h1>
            {isCliente && (
              <Badge className="bg-[#2F7D4F] text-white flex items-center gap-1 font-semibold">
                <Sparkles className="w-3 h-3" />
                Cliente Ativo
              </Badge>
            )}
          </div>
          {contact.empresa && (
            <p className="text-sm font-medium text-[#8A8178] flex items-center gap-1.5 mt-1">
              <Building className="w-4 h-4" />
              {contact.empresa}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
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
            variant="outline"
            size="sm"
            onClick={() => setDeleteConfirmOpen(true)}
            className="border-[#E5DFD6] text-[#B3261E] hover:bg-[#B3261E]/10"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Excluir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Lateral Esquerda: Dados de Contato + Leads Associados (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="bg-white border-[#E5DFD6] shadow-sm">
            <CardHeader className="p-4 pb-2 border-b border-[#E5DFD6]">
              <CardTitle className="font-serif text-sm font-bold text-[#1E1B16]">
                Informações de Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-sm">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8178]">
                  Telefone / Celular
                </span>
                <p className="flex items-center gap-2 mt-1 text-[#1E1B16] font-medium font-mono">
                  <Phone className="w-4 h-4 text-[#2F7D4F]" />
                  {formatTelefone(contact.telefone)}
                </p>
              </div>

              {contact.email && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8178]">
                    Email
                  </span>
                  <p className="flex items-center gap-2 mt-1 text-[#1E1B16] truncate">
                    <Mail className="w-4 h-4 text-[#8A8178]" />
                    <a href={`mailto:${contact.email}`} className="hover:underline truncate">
                      {contact.email}
                    </a>
                  </p>
                </div>
              )}

              {contact.endereco && (
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8178]">
                    Endereço
                  </span>
                  <p className="flex items-start gap-2 mt-1 text-[#1E1B16] text-xs">
                    <MapPin className="w-4 h-4 text-[#8A8178] flex-shrink-0 mt-0.5" />
                    <span>{contact.endereco}</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leads Associados a esta pessoa */}
          <Card className="bg-white border-[#E5DFD6] shadow-sm">
            <CardHeader className="p-4 pb-2 border-b border-[#E5DFD6]">
              <CardTitle className="font-serif text-sm font-bold text-[#1E1B16] flex items-center gap-1.5">
                <Target className="w-4 h-4 text-[#2B5F8A]" />
                Leads Vinculados ({leads.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {leads.length === 0 ? (
                <p className="text-xs text-[#8A8178] p-2">Nenhum lead vinculado diretamente.</p>
              ) : (
                leads.map((l) => (
                  <Link
                    key={l.id}
                    to={`/leads/${l.id}`}
                    className="block p-2.5 rounded-md border border-[#E5DFD6] bg-[#FAF8F5] hover:bg-white hover:shadow-xs transition-all text-xs"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-[#1E1B16] line-clamp-1">{l.nome}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {l.estagio}
                      </Badge>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita: Timeline Vertical de Atividades (8 cols) */}
        <div className="lg:col-span-8">
          <Card className="bg-white border-[#E5DFD6] shadow-sm">
            <CardHeader className="p-4 border-b border-[#E5DFD6]">
              <CardTitle className="font-serif text-base font-bold text-[#1E1B16] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#B3541E]" />
                Histórico de Atividades & Interações
              </CardTitle>
              <p className="text-xs text-[#8A8178] mt-0.5">
                Linha do tempo cronológica com leads, conversas WhatsApp e propostas comerciais
              </p>
            </CardHeader>

            <CardContent className="p-5">
              {timeline.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#8A8178]">
                  Nenhuma atividade registrada para este contato ainda.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E5DFD6]">
                  {timeline.map((item) => {
                    const dataFmt = new Date(item.data).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })

                    let icon = <FileText className="w-3.5 h-3.5 text-[#B3541E]" />
                    let dotColor = 'bg-[#B3541E]'

                    if (item.tipo === 'lead') {
                      icon = <Target className="w-3.5 h-3.5 text-[#2B5F8A]" />
                      dotColor = 'bg-[#2B5F8A]'
                    } else if (item.tipo === 'orcamento_aprovado') {
                      icon = <CheckCircle2 className="w-3.5 h-3.5 text-[#2F7D4F]" />
                      dotColor = 'bg-[#2F7D4F]'
                    } else if (item.tipo === 'conversa') {
                      icon = <MessageCircle className="w-3.5 h-3.5 text-[#2F7D4F]" />
                      dotColor = 'bg-[#2F7D4F]'
                    }

                    return (
                      <div key={item.id} className="relative group">
                        {/* Ponto indicador na linha vertical */}
                        <div
                          className={`absolute -left-[30px] top-1 w-5 h-5 rounded-full bg-white border-2 border-[#E5DFD6] flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform`}
                        >
                          <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                        </div>

                        <div className="bg-[#FAF8F5] p-3 rounded-md border border-[#E5DFD6] hover:bg-white hover:shadow-xs transition-all">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-xs text-[#1E1B16] flex items-center gap-1.5">
                              {icon}
                              {item.titulo}
                            </span>
                            <span className="text-[11px] text-[#8A8178]">{dataFmt}</span>
                          </div>
                          <p className="text-xs text-[#1E1B16] leading-relaxed">{item.descricao}</p>
                          {item.link && (
                            <Link
                              to={item.link}
                              className="inline-block mt-2 text-[11px] font-semibold text-[#B3541E] hover:underline"
                            >
                              Ver detalhes →
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Editar */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white border-[#E5DFD6]">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-[#1E1B16]">Editar Contato</DialogTitle>
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
            <div>
              <Label className="text-xs font-semibold text-[#1E1B16]">Empresa</Label>
              <Input
                value={editEmpresa}
                onChange={(e) => setEditEmpresa(e.target.value)}
                className="mt-1 border-[#E5DFD6]"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-[#1E1B16]">Endereço</Label>
              <Input
                value={editEndereco}
                onChange={(e) => setEditEndereco(e.target.value)}
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

      {/* Confirmação Exclusão */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-white border-[#E5DFD6]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1E1B16]">
              Excluir Contato?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#8A8178]">
              Esta ação removerá o contato "{contact.nome}". Os leads e orçamentos vinculados
              permanecerão no sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E5DFD6]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-[#B3261E] hover:bg-[#961f18] text-white"
            >
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
