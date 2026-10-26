import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLeads } from '@/services/leads'
import {
  getQuotes,
  getQuoteItems,
  getQuoteItemsByQuoteIds,
  updateQuoteStatus,
} from '@/services/quotes'
import { useRealtime } from '@/hooks/use-realtime'
import type { Lead, Quote } from '@/types/crm'
import {
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Plus,
  MessageCircle,
  Clock,
  Printer,
  Snowflake,
  FileEdit,
  Send,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NewLeadModal } from '@/components/modals/NewLeadModal'
import { NewQuoteModal } from '@/components/modals/NewQuoteModal'
import { ProposalPdfModal } from '@/components/modals/ProposalPdfModal'
import { cn } from '@/lib/utils'
import { getPrazoDestaque, getQuoteDataEnvio, calcularValorQuote } from '@/lib/quote-utils'
import { Lock } from 'lucide-react'
import { useCompanySettings } from '@/contexts/SettingsContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import {
  parseTiragens,
  ESPECIFICACOES_GRAFICAS_PADRAO,
  CONDICOES_PADRAO_EDITORA_OESTE,
} from '@/lib/pdf-generator'
import { useToast } from '@/hooks/use-toast'

export default function Index() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { settings: companySettings } = useCompanySettings()

  const [leads, setLeads] = useState<Lead[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [quoteValues, setQuoteValues] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Modais de Criação Rápida
  const [newLeadModalOpen, setNewLeadModalOpen] = useState(false)
  const [newQuoteModalOpen, setNewQuoteModalOpen] = useState(false)

  // Modal PDF rápido
  const [selectedQuoteForPdf, setSelectedQuoteForPdf] = useState<Quote | null>(null)
  const [pdfItems, setPdfItems] = useState<any[]>([])
  const [pdfModalOpen, setPdfModalOpen] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setFetchError(null)

    // Busca leads e quotes de forma isolada (Promise.allSettled) para que falha em um
    // NUNCA derrube ou oculte o outro!
    const [leadsResult, quotesResult] = await Promise.allSettled([getLeads(), getQuotes('todos')])

    const errors: string[] = []

    if (leadsResult.status === 'fulfilled') {
      setLeads(Array.isArray(leadsResult.value) ? leadsResult.value : [])
    } else {
      console.error('[Index] Falha ao buscar leads:', leadsResult.reason)
      errors.push('Não foi possível carregar os leads.')
    }

    let loadedQuotes: Quote[] = []
    if (quotesResult.status === 'fulfilled') {
      loadedQuotes = Array.isArray(quotesResult.value) ? quotesResult.value : []
      setQuotes(loadedQuotes)
    } else {
      console.error('[Index] Falha ao buscar quotes:', quotesResult.reason)
      errors.push('Não foi possível carregar os orçamentos.')
    }

    if (
      errors.length > 0 &&
      leadsResult.status === 'rejected' &&
      quotesResult.status === 'rejected'
    ) {
      setFetchError(
        'Não foi possível carregar os dados do painel. Verifique sua conexão e tente novamente.',
      )
    }

    // Buscar valores dos orçamentos considerando a tiragem de valorização
    try {
      const quotesNeedingItems = (loadedQuotes || []).filter(
        (q) => !q.expand?.quote_items_via_quote_id,
      )

      let itemsByQuoteId: Record<string, any[]> = {}
      if (quotesNeedingItems.length > 0) {
        try {
          itemsByQuoteId = await getQuoteItemsByQuoteIds(quotesNeedingItems.map((q) => q.id))
        } catch (itemsErr) {
          console.warn(
            '[Index] Erro tolerado ao carregar itens de orçamentos em lote no painel:',
            itemsErr,
          )
        }
      }

      const valuesMap: Record<string, number> = {}
      for (const q of loadedQuotes || []) {
        if (!q || !q.id) continue
        try {
          const items = q.expand?.quote_items_via_quote_id || itemsByQuoteId[q.id] || []
          valuesMap[q.id] = calcularValorQuote(q, items)
        } catch {
          valuesMap[q.id] = calcularValorQuote(q)
        }
      }
      setQuoteValues(valuesMap)
    } catch (calcErr) {
      console.warn('[Index] Erro tolerado ao calcular valores dos orçamentos:', calcErr)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useRealtime('leads', () => fetchData())
  useRealtime('quotes', () => fetchData())
  useRealtime('quote_items', () => fetchData())

  // Ação rápida Esfriar
  const handleEsfriarQuote = async (quoteId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await updateQuoteStatus(quoteId, 'Esfriou')
      setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, status: 'Esfriou' } : q)))
      toast({
        title: 'Orçamento marcado como Esfriou',
        description: 'Movido para a aba Esfriados na tela de orçamentos.',
      })
    } catch {
      toast({
        title: 'Erro ao esfriar orçamento',
        variant: 'destructive',
      })
    }
  }

  // Abrir PDF
  const handleOpenPdf = async (quote: Quote, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const items = await getQuoteItems(quote.id)
      setSelectedQuoteForPdf(quote)
      setPdfItems(items)
      setPdfModalOpen(true)
    } catch {
      toast({
        title: 'Erro ao carregar dados do PDF',
        variant: 'destructive',
      })
    }
  }

  // Estatísticas do Painel (tolerante a maiúsculas/minúsculas de status)
  const stats = useMemo(() => {
    const safeLeads = Array.isArray(leads) ? leads : []
    const safeQuotes = Array.isArray(quotes) ? quotes : []
    const totalLeads = safeLeads.length

    const orcamentosPendentes = safeQuotes.filter((q) => {
      if (!q) return false
      const s = (q.status || '').trim().toLowerCase()
      return s === 'enviado' || s === 'visualizado'
    }).length

    const rascunhos = safeQuotes.filter((q) => {
      if (!q) return false
      return (q.status || '').trim().toLowerCase() === 'rascunho'
    }).length

    const orcamentosAprovados = safeQuotes.filter((q) => {
      if (!q) return false
      return (q.status || '').trim().toLowerCase() === 'aprovado'
    })
    const orcamentosEsfriados = safeQuotes.filter((q) => {
      if (!q) return false
      return (q.status || '').trim().toLowerCase() === 'esfriou'
    }).length

    const valorAprovado = orcamentosAprovados.reduce((acc, q) => acc + (quoteValues[q.id] || 0), 0)

    const totalOrcamentos = safeQuotes.length
    const taxaConversao =
      totalOrcamentos > 0 ? ((orcamentosAprovados.length / totalOrcamentos) * 100).toFixed(1) : '0'

    return {
      totalLeads,
      orcamentosPendentes,
      rascunhos,
      orcamentosEsfriados,
      valorAprovado,
      taxaConversao,
    }
  }, [leads, quotes, quoteValues])

  // Orçamentos Pendentes de follow-up (apenas enviados/visualizados): mais antigos primeiro
  const pendentesOrdenados = useMemo(() => {
    const safeQuotes = Array.isArray(quotes) ? quotes : []
    const pendentes = safeQuotes.filter((q) => {
      if (!q) return false
      const s = (q.status || '').trim().toLowerCase()
      return s === 'enviado' || s === 'visualizado'
    })
    return [...pendentes].sort((a, b) => {
      let timeA = 0
      let timeB = 0
      try {
        timeA = getQuoteDataEnvio(a)?.getTime() || (a.created ? new Date(a.created).getTime() : 0)
      } catch {
        timeA = 0
      }
      try {
        timeB = getQuoteDataEnvio(b)?.getTime() || (b.created ? new Date(b.created).getTime() : 0)
      } catch {
        timeB = 0
      }
      return timeA - timeB
    })
  }, [quotes])

  // Rascunhos Recentes: criados recentemente, ordenados do mais novo para o mais antigo
  const rascunhosOrdenados = useMemo(() => {
    const safeQuotes = Array.isArray(quotes) ? quotes : []
    const rasc = safeQuotes.filter((q) => {
      if (!q) return false
      return (q.status || '').trim().toLowerCase() === 'rascunho'
    })
    return [...rasc].sort((a, b) => {
      let timeA = 0
      let timeB = 0
      try {
        timeA = a.created ? new Date(a.created).getTime() : 0
      } catch {
        timeA = 0
      }
      try {
        timeB = b.created ? new Date(b.created).getTime() : 0
      } catch {
        timeB = 0
      }
      return timeB - timeA // Mais recentes primeiro
    })
  }, [quotes])

  // Orçamentos que precisam de atenção (> 3 dias sem resposta: alerta 4-7d ou urgente >7d)
  const orcamentosAtencao = useMemo(() => {
    return pendentesOrdenados.filter((q) => {
      const prazo = getPrazoDestaque(q)
      return prazo !== null && (prazo.urgencia === 'urgente' || prazo.urgencia === 'alerta')
    })
  }, [pendentesOrdenados])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#B3541E] border-t-transparent" />
          <p className="text-sm font-serif text-[#8A8178]">Carregando Painel Papel & Tinta...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Alerta de erro com botão Tentar novamente caso o carregamento falhe */}
      {fetchError && (
        <div className="p-4 rounded-md border border-red-200 bg-red-50 text-red-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span>{fetchError}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="h-8 border-red-300 text-red-800 hover:bg-red-100 self-start sm:self-auto"
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Banner de Boas-Vindas e Ações Rápidas */}
      <div className="bg-white p-6 rounded-lg border border-[#E5DFD6] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1E1B16]">Visão Geral Comercial</h1>
          <p className="text-sm text-[#8A8178] mt-1">
            {companySettings.nome_comercial || 'Editora Oeste'} • Acompanhamento de propostas,
            tiragens gráficas e funil de vendas
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={() => setNewLeadModalOpen(true)}
            variant="outline"
            className="border-[#E5DFD6] text-[#1E1B16] hover:bg-[#FAF8F5] text-xs sm:text-sm h-9"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Lead
          </Button>

          <Button
            onClick={() => setNewQuoteModalOpen(true)}
            className="bg-[#B3541E] hover:bg-[#9A4618] text-white text-xs sm:text-sm font-medium h-9"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Orçamento
          </Button>
        </div>
      </div>

      {/* Grid de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-[#E5DFD6] shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-[#8A8178] font-semibold">
                Leads no Funil
              </p>
              <h3 className="font-serif text-2xl font-bold text-[#1E1B16] mt-1">
                {stats.totalLeads}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#2B5F8A]/10 flex items-center justify-center text-[#2B5F8A]">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => navigate('/orcamentos?tab=pendentes')}
          className="bg-white border-[#E5DFD6] shadow-xs cursor-pointer hover:border-[#B3541E]/40 transition-colors"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-[#8A8178] font-semibold">
                Orçamentos Pendentes
              </p>
              <h3 className="font-serif text-2xl font-bold text-[#B3541E] mt-1">
                {stats.orcamentosPendentes}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#FAF3EC] flex items-center justify-center text-[#B3541E]">
              <FileText className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => navigate('/orcamentos?tab=rascunhos')}
          className="bg-white border-[#E5DFD6] shadow-xs cursor-pointer hover:border-amber-400/60 transition-colors"
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-[#8A8178] font-semibold">
                Rascunhos Criados
              </p>
              <h3 className="font-serif text-2xl font-bold text-amber-700 mt-1">
                {stats.rascunhos}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
              <FileEdit className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#E5DFD6] shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-[#8A8178] font-semibold">
                Valor em Fechamento
              </p>
              <h3 className="font-serif text-2xl font-bold text-[#2F7D4F] mt-1 font-mono">
                {stats.valorAprovado.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#2F7D4F]/10 flex items-center justify-center text-[#2F7D4F]">
              <DollarSign className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seção Central: Orçamentos com Urgência / Foco */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Painel de Orçamentos Pendentes / Prioridades (8 colunas) */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="bg-white border-[#E5DFD6] shadow-sm">
            <CardHeader className="p-4 border-b border-[#E5DFD6] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-serif text-base font-bold text-[#1E1B16] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#B3541E]" />
                  Orçamentos Pendentes (Foco de Follow-up)
                </CardTitle>
                <p className="text-xs text-[#8A8178] mt-0.5">
                  Ordenados do mais antigo para o mais recente. Destaque por dias sem resposta:
                  vermelho &gt;7 dias, amarelo 4–7 dias, neutro até 3 dias.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/orcamentos?tab=pendentes')}
                className="text-xs text-[#B3541E] hover:text-[#9A4618] h-8"
              >
                Ver todos <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </CardHeader>

            <CardContent className="p-0 divide-y divide-[#E5DFD6]">
              {pendentesOrdenados.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#8A8178]">
                  Nenhum orçamento pendente de resposta no momento.
                </div>
              ) : (
                pendentesOrdenados.slice(0, 6).map((quote) => {
                  const leadNome = quote.expand?.lead_id?.nome?.trim()
                  const contactNome = quote.expand?.contact_id?.nome?.trim()
                  const clienteNome = leadNome || contactNome || 'Cliente'
                  const contatoPessoa =
                    leadNome && contactNome && leadNome !== contactNome ? contactNome : ''
                  let valor = 'R$ 0,00'
                  try {
                    valor = (Number(quoteValues[quote.id]) || 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  } catch {
                    valor = 'R$ 0,00'
                  }
                  let prazo: any = null
                  try {
                    prazo = getPrazoDestaque(quote)
                  } catch {
                    prazo = null
                  }
                  let dataEnvioFmt = 'Hoje'
                  try {
                    const dataEnvioObj = getQuoteDataEnvio(quote)
                    if (dataEnvioObj && !isNaN(dataEnvioObj.getTime())) {
                      dataEnvioFmt = dataEnvioObj.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                      })
                    }
                  } catch {
                    dataEnvioFmt = 'Hoje'
                  }

                  return (
                    <ErrorBoundary key={quote.id}>
                      <div
                        onClick={() => navigate(`/orcamentos/${quote.id}`)}
                        className={cn(
                          'p-3.5 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5] transition-colors',
                          prazo ? prazo.bgHighlightClass : '',
                        )}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-semibold text-[#8A8178] flex items-center gap-1">
                              {quote.numero_referencia || quote.codigo || 'ORC'}
                              {quote.pdf_locked && (
                                <span
                                  title="Congelado após PDF"
                                  className="inline-flex items-center"
                                >
                                  <Lock className="w-3 h-3 text-amber-600" />
                                </span>
                              )}
                            </span>
                            <span className="font-semibold text-sm text-[#1E1B16] truncate">
                              {quote.titulo || 'Sem título'}
                            </span>
                            {prazo && (
                              <Badge className={cn('text-[10px] px-1.5 py-0.2', prazo.badgeClass)}>
                                {prazo.label}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-[#8A8178]">
                            Cliente: <strong className="text-[#1E1B16]">{clienteNome}</strong>
                            {contatoPessoa && (
                              <span className="ml-1 text-[#8A8178]">(A/C: {contatoPessoa})</span>
                            )}{' '}
                            • Enviado: {dataEnvioFmt}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 justify-between sm:justify-end">
                          {quote.tiragem_valorizacao === 'combinar' &&
                          quote.inclui_editorial === false ? (
                            <span className="text-xs font-mono text-[#8A8178]">A combinar</span>
                          ) : (
                            <span className="font-mono font-bold text-sm text-[#B3541E]">
                              {valor}
                            </span>
                          )}

                          <div
                            className="flex items-center gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleOpenPdf(quote, e)}
                              className="h-7 text-xs border-[#E5DFD6] text-[#4A4238] hover:bg-white"
                              title="Gerar PDF"
                            >
                              <Printer className="w-3 h-3 mr-1" />
                              PDF
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleEsfriarQuote(quote.id, e)}
                              className="h-7 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                              title="Esfriar orçamento"
                            >
                              <Snowflake className="w-3 h-3 mr-1" />
                              Esfriar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </ErrorBoundary>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita: Rascunhos Recentes, Alertas e Acesso Rápido (4 colunas) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card Rascunhos Recentes criados pelo usuário */}
          <Card className="bg-white border-[#E5DFD6] shadow-sm">
            <CardHeader className="p-3.5 border-b border-[#E5DFD6] flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-serif text-sm font-bold text-[#1E1B16] flex items-center gap-2">
                  <FileEdit className="w-4 h-4 text-amber-700" />
                  Rascunhos Recentes ({rascunhosOrdenados.length})
                </CardTitle>
                <p className="text-[11px] text-[#8A8178] mt-0.5">
                  Propostas criadas aguardando envio.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/orcamentos?tab=rascunhos')}
                className="text-xs text-[#B3541E] hover:text-[#9A4618] h-7 px-2"
              >
                Ver todos <ArrowRight className="w-3 h-3 ml-0.5" />
              </Button>
            </CardHeader>
            <CardContent className="p-2.5 space-y-2 text-xs">
              {rascunhosOrdenados.length === 0 ? (
                <p className="text-[#8A8178] py-3 text-center text-xs">
                  Nenhum rascunho no momento.
                </p>
              ) : (
                rascunhosOrdenados.slice(0, 4).map((q) => {
                  const leadNome = q.expand?.lead_id?.nome?.trim()
                  const contactNome = q.expand?.contact_id?.nome?.trim()
                  const clienteNome = leadNome || contactNome || 'Cliente'
                  const contatoPessoa =
                    leadNome && contactNome && leadNome !== contactNome ? contactNome : ''
                  let valor = 'R$ 0,00'
                  try {
                    valor = (Number(quoteValues[q.id]) || 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  } catch {
                    valor = 'R$ 0,00'
                  }
                  return (
                    <div
                      key={q.id}
                      onClick={() => navigate(`/orcamentos/${q.id}`)}
                      className="p-2 rounded border border-[#E5DFD6] bg-amber-50/40 hover:bg-amber-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[11px] font-semibold text-[#8A8178]">
                          {q.numero_referencia || q.codigo || 'ORC'}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-800 bg-amber-100"
                        >
                          Rascunho
                        </Badge>
                      </div>
                      <p className="font-semibold text-[#1E1B16] truncate mt-0.5">{q.titulo}</p>
                      {q.expand?.lead_id?.nome &&
                        !q.titulo?.toLowerCase().includes(q.expand.lead_id.nome.toLowerCase()) && (
                          <p className="text-[10px] text-[#8A8178] truncate">
                            Lead: {q.expand.lead_id.nome}
                          </p>
                        )}
                      <div className="flex items-center justify-between mt-1 text-[11px] text-[#8A8178]">
                        <span
                          className="truncate max-w-[120px]"
                          title={
                            contatoPessoa ? `${clienteNome} (A/C: ${contatoPessoa})` : clienteNome
                          }
                        >
                          {clienteNome}
                        </span>
                        <span className="font-mono font-bold text-[#B3541E]">{valor}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Card Alerta de Atenção (>3 dias) */}
          <Card className="bg-white border-[#E5DFD6] shadow-sm">
            <CardHeader className="p-3.5 border-b border-[#E5DFD6]">
              <CardTitle className="font-serif text-sm font-bold text-[#1E1B16] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#B3261E]" />
                Necessitam Follow-up ({orcamentosAtencao.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2.5 space-y-2 text-xs">
              {orcamentosAtencao.length === 0 ? (
                <p className="text-[#8A8178] py-2 text-center text-xs">
                  Tudo em dia! Nenhum orçamento aguardando há mais de 3 dias.
                </p>
              ) : (
                orcamentosAtencao.slice(0, 4).map((q) => {
                  let prazo: any = null
                  try {
                    prazo = getPrazoDestaque(q)
                  } catch {
                    prazo = null
                  }
                  const leadNome = q.expand?.lead_id?.nome?.trim()
                  const contactNome = q.expand?.contact_id?.nome?.trim()
                  const clienteNome = leadNome || contactNome || 'Cliente'
                  return (
                    <div
                      key={q.id}
                      onClick={() => navigate(`/orcamentos/${q.id}`)}
                      className="p-2.5 rounded border border-[#E5DFD6] bg-[#FAF8F5] cursor-pointer hover:bg-white transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#1E1B16] truncate max-w-[150px]">
                          {clienteNome}
                        </span>
                        {prazo && (
                          <Badge className={cn('text-[10px] px-1.5 py-0.2', prazo.badgeClass)}>
                            {prazo.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-[#8A8178] truncate mt-0.5">{q.titulo}</p>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Atalho para Funil de Leads */}
          <Card className="bg-[#FAF8F5] border-[#E5DFD6] shadow-sm">
            <CardContent className="p-3.5 space-y-2.5">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#B3541E]" />
                <h4 className="font-serif font-bold text-sm text-[#1E1B16]">
                  Funil de Vendas de Leads
                </h4>
              </div>
              <p className="text-xs text-[#8A8178] leading-relaxed">
                Leads em prospecção ativa. Ao aprovar ou enviar uma proposta, o estágio do lead é
                atualizado automaticamente.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/leads')}
                className="w-full text-xs border-[#E5DFD6] bg-white text-[#B3541E] hover:bg-[#FAF8F5]"
              >
                Abrir Kanban de Leads <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modais Globais */}
      <NewLeadModal
        open={newLeadModalOpen}
        onOpenChange={setNewLeadModalOpen}
        onSuccess={fetchData}
      />

      <NewQuoteModal
        open={newQuoteModalOpen}
        onOpenChange={setNewQuoteModalOpen}
        onSuccess={fetchData}
      />

      {selectedQuoteForPdf && (
        <ProposalPdfModal
          open={pdfModalOpen}
          onOpenChange={setPdfModalOpen}
          quote={selectedQuoteForPdf}
          items={pdfItems}
          tiragens={parseTiragens(selectedQuoteForPdf)}
          especificacoesGrafica={
            selectedQuoteForPdf.grafica_especificacoes || ESPECIFICACOES_GRAFICAS_PADRAO
          }
          condicoes={
            selectedQuoteForPdf.condicoes_gerais ||
            companySettings?.texto_condicoes_padrao ||
            CONDICOES_PADRAO_EDITORA_OESTE
          }
          descontoPercentual={selectedQuoteForPdf.desconto_percentual || 0}
          companySettings={companySettings}
        />
      )}
    </div>
  )
}
