import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getQuoteById,
  updateQuote,
  updateQuoteStatus,
  deleteQuote,
  getQuoteItems,
  createQuoteItem,
  updateQuoteItem,
  deleteQuoteItem,
} from '@/services/quotes'
import { getConversationsByLeadId, getConversationsByContactId } from '@/services/conversations'
import { useRealtime } from '@/hooks/use-realtime'
import {
  searchItemSugestoes,
  salvarItemNaMemoriaSeNovo,
  type ItemSugestao,
} from '@/services/catalog'
import {
  ESPECIFICACOES_GRAFICAS_PADRAO,
  CONDICOES_PADRAO_EDITORA_OESTE,
  TIRAGENS_PADRAO,
  parseTiragens,
} from '@/lib/pdf-generator'
import { ProposalPdfModal } from '@/components/modals/ProposalPdfModal'
import { CatalogManagerModal } from '@/components/modals/CatalogManagerModal'
import type { Quote, QuoteItem, QuoteStatus, Conversation, GraficaTiragemRow } from '@/types/crm'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Trash2,
  Plus,
  Send,
  Printer,
  MessageCircle,
  FileText,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  BookOpen,
  Snowflake,
  ExternalLink,
  Lock,
  Unlock,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { cn } from '@/lib/utils'
import {
  getPrazoDestaque,
  getQuoteDataEnvio,
  formatWhatsAppUrl,
  getUltimoNumeroPropostaUsado,
  calcularValorQuote,
} from '@/lib/quote-utils'
import { useToast } from '@/hooks/use-toast'
import { useCompanySettings } from '@/contexts/SettingsContext'
import { getQuotes } from '@/services/quotes'

export default function QuoteDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { settings: companySettings } = useCompanySettings()

  const [quote, setQuote] = useState<Quote | null>(null)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  // Desconto e Edição de Cabeçalho
  const [descontoPercentual, setDescontoPercentual] = useState<number>(0)
  const [titulo, setTitulo] = useState<string>('')
  const [dataEnvio, setDataEnvio] = useState<string>('')
  const [numeroReferencia, setNumeroReferencia] = useState<string>('')
  const [incluiEditorial, setIncluiEditorial] = useState<boolean>(true)
  const [tiragemValorizacao, setTiragemValorizacao] = useState<string>('50')
  const [pdfLocked, setPdfLocked] = useState<boolean>(false)
  const [ultimoNumeroUsado, setUltimoNumeroUsado] = useState<string | null>(null)
  const [isUpdatingDiscount, setIsUpdatingDiscount] = useState(false)
  const [unlockConfirmOpen, setUnlockConfirmOpen] = useState(false)

  // Produção Gráfica e Condições (campos livres e flexíveis)
  const [especificacoesGrafica, setEspecificacoesGrafica] = useState(ESPECIFICACOES_GRAFICAS_PADRAO)
  const [tiragens, setTiragens] = useState<GraficaTiragemRow[]>(TIRAGENS_PADRAO)
  const [condicoesGerais, setCondicoesGerais] = useState(
    companySettings?.texto_condicoes_padrao || CONDICOES_PADRAO_EDITORA_OESTE,
  )
  const [isSavingGrafica, setIsSavingGrafica] = useState(false)

  // Formulário Inline de Novo Item Editorial com Autocomplete e Memória
  const [newDescricao, setNewDescricao] = useState('')
  const [newQuantidade, setNewQuantidade] = useState<number>(1)
  const [newValorUnitario, setNewValorUnitario] = useState<number>(0)
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [sugestoesCache, setSugestoesCache] = useState<ItemSugestao[]>([])
  const [showSugestoes, setShowSugestoes] = useState(false)

  // Modal de PDF / WhatsApp
  const [pdfModalOpen, setPdfModalOpen] = useState(false)
  const [catalogModalOpen, setCatalogModalOpen] = useState(false)

  // Diálogo de confirmação de exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const loadData = async () => {
    if (!id) return
    try {
      const q = await getQuoteById(id)
      setQuote(q)
      setDescontoPercentual(q.desconto_percentual || 0)
      setTitulo(q.titulo)
      setDataEnvio(q.data_envio ? q.data_envio.slice(0, 10) : '')
      setNumeroReferencia(q.numero_referencia || '')
      setIncluiEditorial(q.inclui_editorial !== false)
      setTiragemValorizacao(q.tiragem_valorizacao || '50')
      setPdfLocked(Boolean(q.pdf_locked))
      setEspecificacoesGrafica(q.grafica_especificacoes || ESPECIFICACOES_GRAFICAS_PADRAO)
      setTiragens(parseTiragens(q))
      setCondicoesGerais(
        q.condicoes_gerais ||
          companySettings?.texto_condicoes_padrao ||
          CONDICOES_PADRAO_EDITORA_OESTE,
      )

      const [it, allQuotes] = await Promise.all([getQuoteItems(id), getQuotes()])
      setItems(it)
      const ultimo = getUltimoNumeroPropostaUsado(allQuotes)
      setUltimoNumeroUsado(ultimo)

      if (q.lead_id) {
        const convs = await getConversationsByLeadId(q.lead_id)
        setConversations(convs)
      } else if (q.contact_id) {
        const convs = await getConversationsByContactId(q.contact_id)
        setConversations(convs)
      }

      // Pré-carregar catálogo inicial
      searchItemSugestoes('').then(setSugestoesCache)
    } catch (err) {
      console.error('Erro ao carregar orçamento:', err)
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

  // Mudança de Status
  const handleStatusChange = async (newStatus: QuoteStatus) => {
    if (!id || !quote) return
    try {
      await updateQuoteStatus(id, newStatus)
      setQuote({ ...quote, status: newStatus })
      toast({
        title: 'Status atualizado',
        description: `Orçamento agora está "${newStatus}". O estágio do lead foi sincronizado automaticamente se aplicável.`,
      })
    } catch {
      toast({
        title: 'Erro ao atualizar status',
        variant: 'destructive',
      })
    }
  }

  // Reativar orçamento esfriado
  const handleReativar = async () => {
    await handleStatusChange('Enviado')
  }

  // Salvar Título, Referência, Data de Envio, Tiragem de Valorização e Interruptor Editorial
  const handleSaveHeader = async () => {
    if (!id || !quote) return
    if (pdfLocked) {
      toast({
        title: 'Orçamento congelado',
        description: 'Destrave o orçamento com o botão "Editar orçamento" para fazer alterações.',
        variant: 'destructive',
      })
      return
    }
    try {
      const updated = await updateQuote(id, {
        titulo: titulo.trim() || quote.titulo,
        numero_referencia: numeroReferencia.trim(),
        data_envio: dataEnvio ? `${dataEnvio} 12:00:00` : '',
        tiragem_valorizacao: tiragemValorizacao,
        inclui_editorial: incluiEditorial,
      })
      setQuote(updated)
      toast({
        title: 'Informações salvas',
        description: 'Dados do orçamento foram atualizados.',
      })
    } catch {
      toast({
        title: 'Erro ao salvar',
        variant: 'destructive',
      })
    }
  }

  // Congelar orçamento ao gerar PDF
  const handlePdfGenerated = async () => {
    if (!id || !quote) return
    try {
      if (!quote.pdf_locked) {
        const updated = await updateQuote(id, {
          pdf_locked: true,
          numero_referencia: numeroReferencia.trim() || quote.numero_referencia,
          inclui_editorial: incluiEditorial,
          tiragem_valorizacao: tiragemValorizacao,
        })
        setQuote(updated)
        setPdfLocked(true)
        toast({
          title: 'Orçamento congelado',
          description:
            'O orçamento foi travado contra alterações após a geração do documento oficial.',
        })
      }
    } catch (err) {
      console.error('Erro ao congelar orçamento:', err)
    }
  }

  // Destravar orçamento
  const handleUnlockQuote = async () => {
    if (!id || !quote) return
    try {
      const updated = await updateQuote(id, { pdf_locked: false })
      setQuote(updated)
      setPdfLocked(false)
      setUnlockConfirmOpen(false)
      toast({
        title: 'Orçamento liberado para edição',
        description: 'Os campos foram destravados.',
      })
    } catch {
      toast({
        title: 'Erro ao destravar orçamento',
        variant: 'destructive',
      })
    }
  }

  // Salvar Desconto
  const handleSaveDiscount = async () => {
    if (!id || !quote) return
    if (pdfLocked) {
      toast({
        title: 'Orçamento congelado',
        description: 'Destrave o orçamento para alterar o desconto.',
        variant: 'destructive',
      })
      return
    }
    setIsUpdatingDiscount(true)
    try {
      await updateQuote(id, { desconto_percentual: descontoPercentual })
      setQuote({ ...quote, desconto_percentual: descontoPercentual })
      toast({
        title: 'Desconto atualizado',
        description: `Desconto de ${descontoPercentual}% aplicado ao subtotal editorial.`,
      })
    } catch {
      toast({
        title: 'Erro ao atualizar desconto',
        variant: 'destructive',
      })
    } finally {
      setIsUpdatingDiscount(false)
    }
  }

  // Salvar Produção Gráfica e Condições Gerais
  const handleSaveGraficaECondicoes = async () => {
    if (!id) return
    if (pdfLocked) {
      toast({
        title: 'Orçamento congelado',
        description: 'Destrave o orçamento para editar especificações e tiragens.',
        variant: 'destructive',
      })
      return
    }
    setIsSavingGrafica(true)
    try {
      await updateQuote(id, {
        grafica_especificacoes: especificacoesGrafica.trim(),
        grafica_tiragens: tiragens,
        condicoes_gerais: condicoesGerais.trim(),
      })
      toast({
        title: 'Produção gráfica salva!',
        description: 'Especificações, tiragens e condições foram atualizadas.',
      })
    } catch {
      toast({
        title: 'Erro ao salvar produção gráfica',
        variant: 'destructive',
      })
    } finally {
      setIsSavingGrafica(false)
    }
  }

  // Tiragens handlers
  const handleAddTiragemRow = () => {
    setTiragens((prev) => [
      ...prev,
      {
        tiragem: 200,
        descricao: '200 exemplares',
        valor_unitario: 16.0,
        valor_total: 3200.0,
      },
    ])
  }

  const handleRemoveTiragemRow = (idx: number) => {
    setTiragens((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleUpdateTiragemRow = (idx: number, field: keyof GraficaTiragemRow, val: any) => {
    const updated = [...tiragens]
    const row = { ...updated[idx], [field]: val }
    if (field === 'tiragem' || field === 'valor_unitario') {
      const tir = field === 'tiragem' ? Number(val) || 0 : Number(row.tiragem) || 0
      const unit = field === 'valor_unitario' ? Number(val) || 0 : Number(row.valor_unitario) || 0
      row.valor_total = tir * unit
      if (!row.descricao || row.descricao.includes('exemplar')) {
        row.descricao = `${tir} ${tir === 1 ? 'exemplar' : 'exemplares'}`
      }
    }
    updated[idx] = row
    setTiragens(updated)
  }

  // Autocomplete ao digitar item
  const handleDescricaoChange = async (val: string) => {
    setNewDescricao(val)
    if (val.trim().length >= 1) {
      const sugs = await searchItemSugestoes(val)
      setSugestoesCache(sugs)
      setShowSugestoes(true)
    } else {
      setShowSugestoes(false)
    }
  }

  const handleSelectSugestao = (sug: ItemSugestao) => {
    setNewDescricao(sug.nome)
    setNewValorUnitario(sug.valor_unitario || 0)
    setShowSugestoes(false)
  }

  // Adicionar Item Editorial
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !newDescricao.trim() || pdfLocked) return

    setIsAddingItem(true)
    try {
      const newItem = await createQuoteItem({
        quote_id: id,
        descricao: newDescricao.trim(),
        quantidade: newQuantidade || 1,
        valor_unitario: newValorUnitario || 0,
      })

      setItems([...items, newItem])

      // Salva no catálogo para memória futura
      salvarItemNaMemoriaSeNovo(newDescricao.trim(), newValorUnitario)

      setNewDescricao('')
      setNewQuantidade(1)
      setNewValorUnitario(0)
      setShowSugestoes(false)

      toast({
        title: 'Item editorial adicionado',
        description: 'Item inserido e salvo na memória para futuras propostas.',
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

  // Excluir Item
  const handleDeleteItem = async (itemId: string) => {
    if (pdfLocked) {
      toast({
        title: 'Orçamento congelado',
        description: 'Destrave o orçamento para remover itens.',
        variant: 'destructive',
      })
      return
    }
    try {
      await deleteQuoteItem(itemId)
      setItems(items.filter((it) => it.id !== itemId))
      toast({
        title: 'Item removido',
      })
    } catch {
      toast({
        title: 'Erro ao excluir item',
        variant: 'destructive',
      })
    }
  }

  // Excluir Orçamento Inteiro
  const handleDeleteQuote = async () => {
    if (!id) return
    try {
      await deleteQuote(id)
      toast({
        title: 'Orçamento excluído com sucesso!',
      })
      navigate('/orcamentos')
    } catch {
      toast({
        title: 'Erro ao excluir orçamento',
        variant: 'destructive',
      })
    }
  }

  // Subtotais Parte 1
  const subtotal = items.reduce(
    (acc, it) => acc + (it.quantidade || 0) * (it.valor_unitario || 0),
    0,
  )
  const valorDesconto = (subtotal * (descontoPercentual || 0)) / 100
  const totalEditorialLiquido = Math.max(0, subtotal - valorDesconto)

  const prazo = quote ? getPrazoDestaque(quote) : null
  const clienteNome =
    quote?.expand?.contact_id?.nome || quote?.expand?.lead_id?.nome || 'Cliente não identificado'
  const telefone = quote?.expand?.contact_id?.telefone || quote?.expand?.lead_id?.telefone || ''

  const companyNome = companySettings?.nome_comercial || 'Editora Oeste'
  const waMsg = quote
    ? `Olá ${clienteNome}! Segue anexa a nossa proposta comercial da ${companyNome} referente a "${quote.titulo}"${numeroReferencia ? ` (Ref. ${numeroReferencia})` : ''}. Fico à disposição para esclarecer qualquer ponto!`
    : ''
  const waUrl = telefone ? formatWhatsAppUrl(telefone, waMsg) : ''

  if (loading || !quote) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#B3541E] border-t-transparent" />
          <p className="text-sm font-serif text-[#8A8178]">Carregando Proposta...</p>
        </div>
      </div>
    )
  }

  const isEsfriado = quote.status === 'Esfriou'
  const isPendente =
    quote.status === 'Rascunho' || quote.status === 'Enviado' || quote.status === 'Visualizado'

  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/orcamentos')}
          className="text-[#8A8178] hover:text-[#1E1B16] -ml-2 h-8"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar para Lista de Orçamentos
        </Button>
      </div>

      {/* Banner de Prazo Urgente se houver */}
      {prazo && (
        <div
          className={cn(
            'p-3.5 rounded-lg border flex items-center justify-between gap-3 text-xs sm:text-sm',
            prazo.bgHighlightClass,
            prazo.cardBorderClass,
          )}
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-[#B3541E]" />
            <span className="font-semibold text-[#1E1B16]">Acompanhamento:</span>
            <Badge className={cn('text-[10px] px-1.5 py-0.2', prazo.badgeClass)}>
              {prazo.label}
            </Badge>
          </div>
          <span className="text-xs text-[#8A8178] hidden sm:inline">Status: {quote.status}</span>
        </div>
      )}

      {/* Banner de Orçamento Congelado após PDF */}
      {pdfLocked && (
        <div className="p-3.5 rounded-lg border border-[#D5CDC4] bg-[#FAF8F5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-[#8A8178] flex-shrink-0" />
            <div>
              <span className="font-semibold text-[#1E1B16]">Orçamento congelado:</span>{' '}
              <span className="text-[#4A4238]">
                O documento oficial em PDF já foi gerado. Os campos estão em modo somente leitura
                para preservar a versão enviada ao cliente.
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setUnlockConfirmOpen(true)}
            className="border-[#B3541E] text-[#B3541E] hover:bg-[#FAF3EC] text-xs h-8 whitespace-nowrap self-start sm:self-auto"
          >
            <Unlock className="w-3.5 h-3.5 mr-1.5" />
            Editar orçamento
          </Button>
        </div>
      )}

      {/* Cabeçalho da Proposta */}
      <div className="bg-white p-5 rounded-lg border border-[#E5DFD6] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {numeroReferencia ? (
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#FAF8F5] text-[#1E1B16] border border-[#E5DFD6] font-bold">
                REF: {numeroReferencia}
              </span>
            ) : quote.codigo ? (
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#FAF8F5] text-[#8A8178] border border-[#E5DFD6]">
                {quote.codigo}
              </span>
            ) : null}

            {pdfLocked && (
              <Badge
                variant="outline"
                className="border-amber-300 bg-amber-50 text-amber-800 text-[11px] flex items-center gap-1"
              >
                <Lock className="w-3 h-3" />
                Congelado após PDF
              </Badge>
            )}

            <span className="text-xs text-[#8A8178]">
              Cliente: <strong className="text-[#1E1B16]">{clienteNome}</strong>
            </span>
            {isEsfriado && (
              <Badge
                variant="outline"
                className="border-slate-400 text-slate-700 bg-slate-100 flex items-center gap-1"
              >
                <Snowflake className="w-3 h-3 text-slate-500" />
                Orçamento Esfriado
              </Badge>
            )}
          </div>
          <h1 className="font-serif text-2xl font-bold text-[#1E1B16]">{quote.titulo}</h1>
        </div>

        {/* Barra de Ações Rápidas: PDF da Proposta, WhatsApp e Status */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão Gerar PDF Oficial */}
          <Button
            onClick={() => setPdfModalOpen(true)}
            className="bg-[#B3541E] hover:bg-[#9A4618] text-white flex items-center gap-1.5 h-9"
          >
            <Printer className="w-4 h-4" />
            Gerar PDF da Proposta
          </Button>

          {/* Botão WhatsApp com Orientação */}
          {waUrl && (
            <Button
              variant="outline"
              onClick={() => setPdfModalOpen(true)}
              className="border-[#2F7D4F] text-[#2F7D4F] hover:bg-[#2F7D4F]/10 flex items-center gap-1.5 h-9"
              title="Abre modal com opções de download do PDF e envio no WhatsApp"
            >
              <MessageCircle className="w-4 h-4" />
              Enviar por WhatsApp
            </Button>
          )}

          {/* Reativar se estiver Esfriado */}
          {isEsfriado ? (
            <Button
              onClick={handleReativar}
              className="bg-[#2B5F8A] hover:bg-[#214b6e] text-white flex items-center gap-1.5 h-9"
            >
              <RotateCcw className="w-4 h-4" />
              Reativar Orçamento
            </Button>
          ) : isPendente ? (
            <Button
              variant="outline"
              onClick={() => handleStatusChange('Esfriou')}
              className="border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 h-9"
              title="Mover este orçamento para a aba Esfriados"
            >
              <Snowflake className="w-4 h-4 text-slate-500" />
              Esfriar
            </Button>
          ) : null}

          {/* Acesso ao Catálogo Global */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCatalogModalOpen(true)}
            className="border-[#E5DFD6] text-[#4A4238] hover:bg-[#FAF8F5] flex items-center gap-1.5 h-9"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#B3541E]" />
            Catálogo
          </Button>

          {/* Seletor de Status */}
          <div className="w-36">
            <Select
              value={quote.status}
              onValueChange={(val) => handleStatusChange(val as QuoteStatus)}
            >
              <SelectTrigger className="border-[#E5DFD6] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Rascunho">Rascunho</SelectItem>
                <SelectItem value="Enviado">Enviado</SelectItem>
                <SelectItem value="Visualizado">Visualizado</SelectItem>
                <SelectItem value="Aprovado">Aprovado</SelectItem>
                <SelectItem value="Rejeitado">Rejeitado</SelectItem>
                <SelectItem value="Esfriou">Esfriou</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteConfirmOpen(true)}
            className="text-[#8A8178] hover:text-[#B3261E] h-9 w-9"
            title="Excluir orçamento"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Grid de Conteúdo Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Coluna Esquerda: Itens Editoriais + Produção Gráfica (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card: Parte 1 — Produção Editorial (com Interruptor opcional) */}
          <Card className="bg-white border-[#E5DFD6] shadow-sm">
            <CardHeader className="p-4 border-b border-[#E5DFD6] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="font-serif text-base font-bold text-[#1E1B16] flex items-center gap-2">
                  <span className="bg-[#1E1B16] text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                    PARTE 1
                  </span>
                  <span>Produção Editorial</span>
                </CardTitle>
                <p className="text-xs text-[#8A8178] mt-0.5">
                  ISBN, Capa, Diagramação InDesign, Revisão e Kindle
                </p>
              </div>

              {/* Interruptor: Projeto inclui produção editorial? */}
              <div className="flex items-center gap-2.5 bg-[#FAF8F5] px-3 py-1.5 rounded-md border border-[#E5DFD6]">
                <label
                  htmlFor="toggle-editorial"
                  className="text-xs font-semibold text-[#1E1B16] cursor-pointer"
                >
                  Inclui produção editorial?
                </label>
                <Switch
                  id="toggle-editorial"
                  checked={incluiEditorial}
                  disabled={pdfLocked}
                  onCheckedChange={async (checked) => {
                    setIncluiEditorial(checked)
                    if (id && quote) {
                      try {
                        await updateQuote(id, { inclui_editorial: checked })
                        setQuote({ ...quote, inclui_editorial: checked })
                      } catch {
                        /* silently caught */
                      }
                    }
                  }}
                />
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {!incluiEditorial ? (
                <div className="py-6 px-4 bg-[#FAF8F5] rounded-md border border-dashed border-[#D5CDC4] text-center space-y-1">
                  <div className="text-xs font-semibold text-[#1E1B16]">
                    Parte 1 desativada para este projeto
                  </div>
                  <p className="text-xs text-[#8A8178] max-w-md mx-auto">
                    A Parte 1 não será exibida no PDF da proposta (a proposta começará direto na
                    Parte 2 — Produção Gráfica) e não somará valores editoriais no dashboard.
                  </p>
                </div>
              ) : (
                <>
                  {/* Tabela de Itens */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-[#FAF8F5] border-b border-[#E5DFD6] text-[#8A8178] font-semibold text-[11px] uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Item / Serviço Editorial</th>
                          <th className="py-2.5 px-3 text-center w-16">Qtd</th>
                          <th className="py-2.5 px-3 text-right w-28">Valor Unit.</th>
                          <th className="py-2.5 px-3 text-right w-28">Subtotal</th>
                          <th className="py-2.5 px-2 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5DFD6]">
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-xs text-[#8A8178]">
                              Nenhum item editorial inserido. Adicione no formulário abaixo.
                            </td>
                          </tr>
                        ) : (
                          items.map((it, idx) => (
                            <tr key={it.id} className="hover:bg-[#FAF8F5]">
                              <td className="py-3 px-3 font-medium text-[#1E1B16]">
                                <span className="text-[#8A8178] mr-1.5 font-mono text-xs">
                                  {idx + 1}.
                                </span>
                                {it.descricao}
                              </td>
                              <td className="py-3 px-3 text-center text-[#4A4238]">
                                {it.quantidade}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-[#1E1B16]">
                                {(it.valor_unitario || 0).toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-[#1E1B16]">
                                {((it.quantidade || 0) * (it.valor_unitario || 0)).toLocaleString(
                                  'pt-BR',
                                  {
                                    style: 'currency',
                                    currency: 'BRL',
                                  },
                                )}
                              </td>
                              <td className="py-3 px-2 text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={pdfLocked}
                                  onClick={() => handleDeleteItem(it.id)}
                                  className="h-7 w-7 text-[#8A8178] hover:text-[#B3261E]"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Formulário Inline para Adicionar Novo Item Editorial */}
                  {!pdfLocked && (
                    <form
                      onSubmit={handleAddItem}
                      className="bg-[#FAF8F5] p-3 rounded-md border border-[#E5DFD6] space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-[#1E1B16]">
                        <span className="flex items-center gap-1">
                          <Plus className="w-3.5 h-3.5 text-[#B3541E]" />
                          Adicionar Serviço Editorial
                        </span>
                        <span className="text-[11px] text-[#8A8178] font-normal">
                          Sugestões aparecem ao digitar
                        </span>
                      </div>

                      <div className="relative">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <Input
                              value={newDescricao}
                              onChange={(e) => handleDescricaoChange(e.target.value)}
                              onFocus={() => {
                                if (newDescricao.trim()) setShowSugestoes(true)
                              }}
                              placeholder="Nome do serviço (ex: ISBN, Revisão textual, Diagramação...)"
                              className="text-xs h-9 bg-white border-[#E5DFD6]"
                            />

                            {/* Dropdown de Autocomplete com Memória */}
                            {showSugestoes && sugestoesCache.length > 0 && (
                              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E5DFD6] rounded-md shadow-lg z-30 max-h-52 overflow-y-auto divide-y divide-[#FAF8F5]">
                                <div className="p-1.5 bg-[#FAF8F5] text-[10px] font-bold uppercase text-[#8A8178] flex items-center justify-between">
                                  <span className="flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-[#B3541E]" />
                                    Sugestões da memória do catálogo:
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setShowSugestoes(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    ✕
                                  </button>
                                </div>
                                {sugestoesCache.map((sug) => (
                                  <div
                                    key={sug.id}
                                    onMouseDown={(e) => {
                                      e.preventDefault()
                                      handleSelectSugestao(sug)
                                    }}
                                    className="p-2 hover:bg-[#FAF8F5] cursor-pointer text-xs flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="font-semibold text-[#1E1B16] line-clamp-1">
                                        {sug.nome}
                                      </div>
                                      {sug.descricao && (
                                        <div className="text-[11px] text-[#8A8178] line-clamp-1">
                                          {sug.descricao}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right font-mono font-bold text-xs text-[#1E1B16] flex-shrink-0">
                                      {sug.valor_unitario > 0
                                        ? sug.valor_unitario.toLocaleString('pt-BR', {
                                            style: 'currency',
                                            currency: 'BRL',
                                          })
                                        : 'A combinar'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="w-full sm:w-20">
                            <Input
                              type="number"
                              min="1"
                              value={newQuantidade}
                              onChange={(e) =>
                                setNewQuantidade(Math.max(1, parseInt(e.target.value) || 1))
                              }
                              placeholder="Qtd"
                              className="text-xs h-9 bg-white text-center border-[#E5DFD6]"
                            />
                          </div>

                          <div className="w-full sm:w-28">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={newValorUnitario}
                              onChange={(e) => setNewValorUnitario(parseFloat(e.target.value) || 0)}
                              placeholder="R$ Unit."
                              className="text-xs h-9 bg-white text-right border-[#E5DFD6]"
                            />
                          </div>

                          <Button
                            type="submit"
                            disabled={isAddingItem || !newDescricao.trim()}
                            className="bg-[#B3541E] hover:bg-[#9A4618] text-white text-xs h-9 px-4"
                          >
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    </form>
                  )}

                  {/* Box de Subtotais da Parte 1 */}
                  <div className="bg-[#FAF8F5] p-3 rounded-md border border-[#E5DFD6] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[#8A8178]">Desconto Comercial (%):</span>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        disabled={pdfLocked}
                        value={descontoPercentual}
                        onChange={(e) =>
                          setDescontoPercentual(
                            Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                          )
                        }
                        className="w-16 h-7 text-xs border-[#E5DFD6] bg-white font-mono"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isUpdatingDiscount || pdfLocked}
                        onClick={handleSaveDiscount}
                        className="h-7 text-xs border-[#E5DFD6] text-[#4A4238] hover:bg-white"
                      >
                        {isUpdatingDiscount ? 'Aplicando...' : 'Aplicar'}
                      </Button>
                    </div>

                    <div className="text-right space-y-0.5">
                      <div className="text-[#8A8178]">
                        Subtotal Bruto:{' '}
                        <strong>
                          {subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                      </div>
                      {valorDesconto > 0 && (
                        <div className="text-[#B3261E]">
                          Desconto ({descontoPercentual}%): -
                          {valorDesconto.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </div>
                      )}
                      <div className="text-sm font-bold text-[#1E1B16] font-serif">
                        Total Editorial Líquido:{' '}
                        <span className="font-mono">
                          {totalEditorialLiquido.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          {/* Card: Parte 2 — Produção Gráfica (Impressão do Livro) */}
          <Card className="bg-white border-[#E5DFD6] shadow-sm">
            <CardHeader className="p-4 border-b border-[#E5DFD6] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-serif text-base font-bold text-[#1E1B16] flex items-center gap-2">
                  <span className="bg-[#1E1B16] text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                    PARTE 2
                  </span>
                  <span>Produção Gráfica (Impressão do Livro)</span>
                </CardTitle>
                <p className="text-xs text-[#8A8178] mt-0.5">
                  Especificações técnicas e faixas de tiragem (1, 50 e 100 exemplares)
                </p>
              </div>
              {!pdfLocked && (
                <Button
                  size="sm"
                  onClick={handleSaveGraficaECondicoes}
                  disabled={isSavingGrafica}
                  className="bg-[#B3541E] hover:bg-[#9A4618] text-white text-xs h-8"
                >
                  {isSavingGrafica ? 'Salvando...' : 'Salvar Produção Gráfica'}
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#1E1B16] block mb-1">
                  Especificações Técnicas da Impressão (Texto Livre)
                </label>
                <textarea
                  value={especificacoesGrafica}
                  disabled={pdfLocked}
                  onChange={(e) => setEspecificacoesGrafica(e.target.value)}
                  rows={4}
                  className={cn(
                    'w-full p-2.5 text-xs border border-[#E5DFD6] rounded bg-[#FAF8F5] text-[#1E1B16] focus:outline-none focus:ring-1 focus:ring-[#B3541E] font-sans leading-relaxed',
                    pdfLocked && 'opacity-75 cursor-not-allowed bg-slate-50',
                  )}
                  placeholder="Ex: Livro até 72 páginas, formato 155x225mm fechado, miolo P&B..."
                />
              </div>

              {/* Tabela de Tiragens Flexíveis */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E1B16]">
                    Tabela de Impressão por Tiragem
                  </span>
                  {!pdfLocked && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddTiragemRow}
                      className="h-7 text-xs border-[#E5DFD6] text-[#B3541E] hover:bg-[#FAF8F5]"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Adicionar Linha de Tiragem
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {tiragens.map((row, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-[#FAF8F5] p-2 rounded border border-[#E5DFD6]"
                    >
                      <div className="w-20">
                        <Input
                          type="number"
                          min="1"
                          disabled={pdfLocked}
                          placeholder="Tiragem"
                          value={row.tiragem}
                          onChange={(e) =>
                            handleUpdateTiragemRow(
                              idx,
                              'tiragem',
                              Math.max(1, parseInt(e.target.value) || 1),
                            )
                          }
                          className="text-xs h-8 bg-white border-[#E5DFD6]"
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          placeholder="Descrição (ex: 50 exemplares)"
                          disabled={pdfLocked}
                          value={row.descricao}
                          onChange={(e) => handleUpdateTiragemRow(idx, 'descricao', e.target.value)}
                          className="text-xs h-8 bg-white border-[#E5DFD6]"
                        />
                      </div>
                      <div className="w-28">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={pdfLocked}
                          placeholder="Preço/un"
                          value={row.valor_unitario}
                          onChange={(e) =>
                            handleUpdateTiragemRow(
                              idx,
                              'valor_unitario',
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="text-xs h-8 bg-white text-right border-[#E5DFD6]"
                        />
                      </div>
                      <div className="w-28 text-right font-mono font-bold text-xs text-[#1E1B16] pr-1">
                        {(
                          (Number(row.tiragem) || 0) * (Number(row.valor_unitario) || 0)
                        ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                      {!pdfLocked && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveTiragemRow(idx)}
                          className="h-7 w-7 text-[#8A8178] hover:text-[#B3261E]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Condições Gerais Editáveis */}
              <div className="pt-2 border-t border-[#E5DFD6]">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#1E1B16] flex items-center gap-1.5 mb-1">
                  <BookOpen className="w-3.5 h-3.5 text-[#B3541E]" />
                  Condições Gerais de Produção & Entrega (Editável)
                </label>
                <textarea
                  value={condicoesGerais}
                  disabled={pdfLocked}
                  onChange={(e) => setCondicoesGerais(e.target.value)}
                  rows={4}
                  className={cn(
                    'w-full p-2.5 text-xs border border-[#E5DFD6] rounded bg-white text-[#4A4238] focus:outline-none focus:ring-1 focus:ring-[#B3541E] font-sans leading-relaxed',
                    pdfLocked && 'opacity-75 cursor-not-allowed bg-slate-50',
                  )}
                  placeholder="Condições contratuais..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita: Dados de Envio, Cliente e Histórico (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Dados do Orçamento */}
          <Card className="bg-white border-[#E5DFD6] shadow-sm">
            <CardHeader className="p-4 border-b border-[#E5DFD6] flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-sm font-bold text-[#1E1B16]">
                Dados do Orçamento
              </CardTitle>
              {pdfLocked && (
                <span className="text-[10px] font-semibold text-amber-800 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  <Lock className="w-3 h-3" /> Travado
                </span>
              )}
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 text-xs">
              {/* Campo livre: Número da Proposta + hint discreto do último usado */}
              <div>
                <label className="font-semibold uppercase tracking-wider text-[#1E1B16] text-[10px] block">
                  Referência / Nº da Proposta
                </label>
                <Input
                  value={numeroReferencia}
                  disabled={pdfLocked}
                  onChange={(e) => setNumeroReferencia(e.target.value)}
                  placeholder="Ex: 26152"
                  className={cn(
                    'mt-1 text-xs border-[#E5DFD6] bg-[#FAF8F5] font-mono',
                    pdfLocked && 'cursor-not-allowed opacity-75',
                  )}
                />
                {ultimoNumeroUsado && (
                  <p className="text-[11px] text-[#8A8178] mt-1">
                    Lembrete da sequência: último número usado foi{' '}
                    <strong className="font-mono text-[#1E1B16]">{ultimoNumeroUsado}</strong>.
                  </p>
                )}
              </div>

              <div>
                <label className="font-semibold uppercase tracking-wider text-[#8A8178] text-[10px]">
                  Título do Projeto
                </label>
                <Input
                  value={titulo}
                  disabled={pdfLocked}
                  onChange={(e) => setTitulo(e.target.value)}
                  className={cn(
                    'mt-1 text-xs border-[#E5DFD6] bg-[#FAF8F5]',
                    pdfLocked && 'cursor-not-allowed opacity-75',
                  )}
                />
              </div>

              {/* Novo Campo: Tiragem para valorização no dashboard */}
              <div>
                <label className="font-semibold uppercase tracking-wider text-[#1E1B16] text-[10px] block">
                  Tiragem para valorização (Dashboard)
                </label>
                <Select
                  value={tiragemValorizacao}
                  disabled={pdfLocked}
                  onValueChange={setTiragemValorizacao}
                >
                  <SelectTrigger
                    className={cn(
                      'mt-1 text-xs border-[#E5DFD6] bg-[#FAF8F5] h-9',
                      pdfLocked && 'cursor-not-allowed opacity-75',
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 exemplar (prova / piloto)</SelectItem>
                    <SelectItem value="50">50 exemplares</SelectItem>
                    <SelectItem value="100">100 exemplares</SelectItem>
                    <SelectItem value="combinar">A combinar (sem valor monetário)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-[#8A8178] mt-1">
                  Define qual lote da gráfica compõe o valor exibido nas somas do dashboard. O PDF
                  para o cliente continuará listando as 3 tiragens completas.
                </p>
              </div>

              <div>
                <label className="font-semibold uppercase tracking-wider text-[#8A8178] text-[10px]">
                  Data de Envio da Proposta
                </label>
                <Input
                  type="date"
                  value={dataEnvio}
                  disabled={pdfLocked}
                  onChange={(e) => setDataEnvio(e.target.value)}
                  className={cn(
                    'mt-1 text-xs border-[#E5DFD6] bg-[#FAF8F5]',
                    pdfLocked && 'cursor-not-allowed opacity-75',
                  )}
                />
                <p className="text-[10px] text-[#8A8178] mt-1">
                  Alimenta o cálculo de dias sem resposta e prioridades no painel.
                </p>
              </div>

              {!pdfLocked ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveHeader}
                  className="w-full text-xs border-[#E5DFD6] text-[#1E1B16] hover:bg-[#FAF8F5]"
                >
                  Salvar Informações
                </Button>
              ) : (
                <div className="text-[11px] text-center text-[#8A8178] pt-1">
                  Para editar estas informações, destrave o orçamento acima.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dados do Cliente */}
          <Card className="bg-white border-[#E5DFD6] shadow-sm">
            <CardHeader className="p-4 border-b border-[#E5DFD6]">
              <CardTitle className="font-serif text-sm font-bold text-[#1E1B16]">
                Cliente Solicitante
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div>
                <span className="font-semibold uppercase tracking-wider text-[#8A8178] text-[10px]">
                  Nome
                </span>
                <div className="font-bold text-sm text-[#1E1B16] mt-0.5">{clienteNome}</div>
              </div>

              {telefone && (
                <div>
                  <span className="font-semibold uppercase tracking-wider text-[#8A8178] text-[10px]">
                    WhatsApp
                  </span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono text-[#1E1B16]">{telefone}</span>
                    <a
                      href={waUrl || `https://wa.me/${telefone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2F7D4F] hover:underline"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Conversar
                    </a>
                  </div>
                </div>
              )}

              {quote.lead_id && (
                <div className="pt-2 border-t border-[#E5DFD6]">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/leads/${quote.lead_id}`)}
                    className="w-full text-xs border-[#E5DFD6] text-[#B3541E] hover:bg-[#FAF8F5]"
                  >
                    Ver Ficha do Lead
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Gestão do Catálogo */}
      <CatalogManagerModal
        open={catalogModalOpen}
        onOpenChange={setCatalogModalOpen}
        onItemChanged={() => {
          searchItemSugestoes('').then(setSugestoesCache)
        }}
      />

      {/* Modal do PDF Oficial da Proposta */}
      <ProposalPdfModal
        open={pdfModalOpen}
        onOpenChange={setPdfModalOpen}
        quote={quote}
        items={items}
        tiragens={tiragens}
        especificacoesGrafica={especificacoesGrafica}
        condicoes={condicoesGerais}
        descontoPercentual={descontoPercentual}
        companySettings={companySettings}
        incluiEditorial={incluiEditorial}
        numeroReferencia={numeroReferencia}
        onPdfGenerated={handlePdfGenerated}
      />

      {/* Confirmação de Destravamento de Edição do Orçamento */}
      <AlertDialog open={unlockConfirmOpen} onOpenChange={setUnlockConfirmOpen}>
        <AlertDialogContent className="bg-white border-[#E5DFD6]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1E1B16]">
              Destravar orçamento para edição?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#4A4238]">
              A proposta em PDF deste orçamento já foi gerada e pode ter sido enviada ao cliente. Se
              fizer alterações nos valores ou especificações, certifique-se de gerar e enviar um
              novo documento atualizado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E5DFD6]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlockQuote}
              className="bg-[#B3541E] hover:bg-[#9A4618] text-white"
            >
              Sim, destravar edição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de Exclusão */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-white border-[#E5DFD6]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1E1B16]">
              Excluir este orçamento?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#8A8178]">
              Esta ação removerá o orçamento "{quote.titulo}" e seus itens associados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E5DFD6]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuote}
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
