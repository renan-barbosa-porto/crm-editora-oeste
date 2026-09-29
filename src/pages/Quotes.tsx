import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  getQuotes,
  getQuoteItems,
  getQuoteItemsByQuoteIds,
  updateQuoteStatus,
} from '@/services/quotes'
import { useRealtime } from '@/hooks/use-realtime'
import type { Quote, QuoteStatus } from '@/types/crm'
import {
  FileText,
  Search,
  Plus,
  ArrowUpRight,
  AlertTriangle,
  RotateCcw,
  Printer,
  Snowflake,
  BookOpen,
  FileEdit,
  Send,
  Lock,
  RefreshCw,
  X,
} from 'lucide-react'
import { CatalogManagerModal } from '@/components/modals/CatalogManagerModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NewQuoteModal } from '@/components/modals/NewQuoteModal'
import { ProposalPdfModal } from '@/components/modals/ProposalPdfModal'
import { cn } from '@/lib/utils'
import { getPrazoDestaque, getQuoteDataEnvio, calcularValorQuote } from '@/lib/quote-utils'
import { useCompanySettings } from '@/contexts/SettingsContext'
import {
  parseTiragens,
  CONDICOES_PADRAO_EDITORA_OESTE,
  ESPECIFICACOES_GRAFICAS_PADRAO,
} from '@/lib/pdf-generator'
import { useToast } from '@/hooks/use-toast'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function Quotes() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { settings: companySettings } = useCompanySettings()
  const [searchParams, setSearchParams] = useSearchParams()

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [quoteValues, setQuoteValues] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Aba padrão: "pendentes" (Rascunho, Enviado, Visualizado)
  const initialTab = searchParams.get('tab') || 'pendentes'
  const [activeTab, setActiveTab] = useState<string>(initialTab)
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '')

  const [newQuoteModalOpen, setNewQuoteModalOpen] = useState(false)
  const [catalogModalOpen, setCatalogModalOpen] = useState(false)

  // Modal de PDF rápido
  const [selectedQuoteForPdf, setSelectedQuoteForPdf] = useState<Quote | null>(null)
  const [pdfItems, setPdfItems] = useState<any[]>([])
  const [pdfModalOpen, setPdfModalOpen] = useState(false)

  const fetchQuotes = async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const allQuotes = await getQuotes('todos')
      setQuotes(allQuotes || [])

      // Filtra os orçamentos que precisam de busca dos itens (que não vieram via expand)
      const quotesNeedingItems = (allQuotes || []).filter(
        (q) => !q.expand?.quote_items_via_quote_id,
      )

      let itemsByQuoteId: Record<string, any[]> = {}
      if (quotesNeedingItems.length > 0) {
        try {
          itemsByQuoteId = await getQuoteItemsByQuoteIds(quotesNeedingItems.map((q) => q.id))
        } catch (itemsErr) {
          console.warn('[Quotes] Erro ao carregar itens de orçamentos em lote:', itemsErr)
        }
      }

      const valuesMap: Record<string, number> = {}
      for (const q of allQuotes || []) {
        try {
          const items = q.expand?.quote_items_via_quote_id || itemsByQuoteId[q.id] || []
          valuesMap[q.id] = calcularValorQuote(q, items)
        } catch {
          valuesMap[q.id] = calcularValorQuote(q)
        }
      }
      setQuoteValues(valuesMap)
    } catch (err: any) {
      console.error('[Quotes] Erro ao buscar orçamentos:', err)
      setFetchError(
        err?.message ||
          'Não foi possível carregar os orçamentos. Verifique sua conexão e tente novamente.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuotes()
  }, [])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q !== null && q !== searchTerm) setSearchTerm(q)
    const tab = searchParams.get('tab')
    if (tab && tab !== activeTab) setActiveTab(tab)
  }, [searchParams])

  useRealtime('quotes', () => fetchQuotes())
  useRealtime('quote_items', () => fetchQuotes())

  // Ação de Esfriar orçamento
  const handleEsfriarQuote = async (quoteId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      await updateQuoteStatus(quoteId, 'Esfriou')
      setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, status: 'Esfriou' } : q)))
      toast({
        title: 'Orçamento marcado como Esfriou',
        description: 'O orçamento foi movido para a aba "Esfriados".',
      })
    } catch {
      toast({
        title: 'Erro ao esfriar orçamento',
        variant: 'destructive',
      })
      fetchQuotes()
    }
  }

  // Ação de Reativar orçamento esfriado -> volta para status 'Enviado'
  const handleReativarQuote = async (quoteId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      await updateQuoteStatus(quoteId, 'Enviado')
      setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, status: 'Enviado' } : q)))
      toast({
        title: 'Orçamento reativado com sucesso!',
        description: 'O orçamento voltou para o status "Enviado" e reaparece na aba Pendentes.',
      })
    } catch {
      toast({
        title: 'Erro ao reativar orçamento',
        variant: 'destructive',
      })
      fetchQuotes()
    }
  }

  // Abrir Modal de PDF direto da lista
  const handleOpenPdfForQuote = async (quote: Quote, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const items = await getQuoteItems(quote.id)
      setSelectedQuoteForPdf(quote)
      setPdfItems(items || [])
      setPdfModalOpen(true)
    } catch {
      toast({
        title: 'Erro ao carregar dados do PDF',
        variant: 'destructive',
      })
    }
  }

  // Contagens por status para exibir nas abas
  const tabCounts = useMemo(() => {
    const safeQuotes = Array.isArray(quotes) ? quotes : []
    return {
      todos: safeQuotes.length,
      pendentes: safeQuotes.filter(
        (q) => q && (q.status === 'Enviado' || q.status === 'Visualizado'),
      ).length,
      rascunhos: safeQuotes.filter((q) => q && q.status === 'Rascunho').length,
      aprovados: safeQuotes.filter((q) => q && q.status === 'Aprovado').length,
      rejeitados: safeQuotes.filter((q) => q && q.status === 'Rejeitado').length,
      esfriados: safeQuotes.filter((q) => q && q.status === 'Esfriou').length,
    }
  }, [quotes])

  // Ação rápida: Marcar rascunho como Enviado
  const handleMarcarEnviado = async (quoteId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      await updateQuoteStatus(quoteId, 'Enviado')
      setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, status: 'Enviado' } : q)))
      toast({
        title: 'Orçamento marcado como Enviado',
        description: 'O orçamento agora está ativo e entra no fluxo de follow-up.',
      })
    } catch {
      toast({
        title: 'Erro ao atualizar status',
        variant: 'destructive',
      })
      fetchQuotes()
    }
  }

  // Filtragem por abas e busca
  const filteredQuotes = useMemo(() => {
    const safeQuotes = Array.isArray(quotes) ? quotes : []
    const term = (searchTerm || '').trim().toLowerCase()

    const list = safeQuotes.filter((q) => {
      if (!q) return false

      // Filtro de aba
      let matchTab = true
      if (activeTab === 'pendentes') {
        matchTab = q.status === 'Enviado' || q.status === 'Visualizado'
      } else if (activeTab === 'rascunhos') {
        matchTab = q.status === 'Rascunho'
      } else if (activeTab === 'aprovados') {
        matchTab = q.status === 'Aprovado'
      } else if (activeTab === 'rejeitados') {
        matchTab = q.status === 'Rejeitado'
      } else if (activeTab === 'esfriados') {
        matchTab = q.status === 'Esfriou'
      } else if (activeTab === 'todos') {
        matchTab = true
      }

      if (!matchTab) return false

      // Filtro de busca
      if (!term) return true

      const clienteNome = (
        q.expand?.contact_id?.nome ||
        q.expand?.lead_id?.nome ||
        ''
      ).toLowerCase()
      const titulo = (q.titulo || '').toLowerCase()
      const codigo = (q.codigo || '').toLowerCase()
      const ref = (q.numero_referencia || '').toLowerCase()

      return (
        titulo.includes(term) ||
        codigo.includes(term) ||
        ref.includes(term) ||
        clienteNome.includes(term)
      )
    })

    // Na aba "pendentes", ordenar do mais antigo para o mais recente (mais antigo no topo)
    if (activeTab === 'pendentes') {
      return [...list].sort((a, b) => {
        const timeA =
          getQuoteDataEnvio(a)?.getTime() || (a.created ? new Date(a.created).getTime() : 0)
        const timeB =
          getQuoteDataEnvio(b)?.getTime() || (b.created ? new Date(b.created).getTime() : 0)
        return timeA - timeB // Ascendente: mais antigo primeiro
      })
    }

    // Nas outras abas (Rascunhos, Todos, etc.), mais recentes primeiro
    return [...list].sort((a, b) => {
      const timeA = a.created ? new Date(a.created).getTime() : 0
      const timeB = b.created ? new Date(b.created).getTime() : 0
      return timeB - timeA
    })
  }, [quotes, activeTab, searchTerm])

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
      case 'Esfriou':
        return (
          <Badge
            variant="outline"
            className="border-slate-400 text-slate-700 bg-slate-100 flex items-center gap-1"
          >
            <Snowflake className="w-3 h-3 text-slate-500" />
            Esfriou
          </Badge>
        )
      default:
        return <Badge variant="secondary">{status || 'Sem status'}</Badge>
    }
  }

  const getEmptyMessage = () => {
    if (searchTerm.trim()) {
      return `Nenhum orçamento encontrado para "${searchTerm}".`
    }
    switch (activeTab) {
      case 'pendentes':
        return 'Nenhum orçamento pendente de follow-up (Enviado ou Visualizado). Verifique a aba Rascunhos ou Todos.'
      case 'rascunhos':
        return 'Nenhum orçamento em rascunho. Crie um novo no botão acima!'
      case 'aprovados':
        return 'Nenhum orçamento aprovado até o momento.'
      case 'rejeitados':
        return 'Nenhum orçamento rejeitado registrado.'
      case 'esfriados':
        return 'Nenhum orçamento marcado como esfriado.'
      default:
        return 'Nenhum orçamento cadastrado no sistema.'
    }
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    setSearchParams({ tab: activeTab, q: '' })
  }

  return (
    <div className="space-y-5">
      {/* Barra de Filtros e Novo Orçamento */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-md border border-[#E5DFD6] shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8178]" />
          <Input
            value={searchTerm}
            onChange={(e) => {
              const val = e.target.value
              setSearchTerm(val)
              setSearchParams({ tab: activeTab, q: val })
            }}
            placeholder="Buscar por código, ref, título ou cliente..."
            className="pl-9 pr-8 h-9 text-xs sm:text-sm border-[#E5DFD6] bg-[#FAF8F5]"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A8178] hover:text-[#1E1B16]"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchQuotes}
            disabled={loading}
            className="border-[#E5DFD6] text-[#4A4238] hover:bg-[#FAF8F5] text-xs sm:text-sm font-medium h-9"
            title="Atualizar lista de orçamentos"
          >
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
            Atualizar
          </Button>

          <Button
            variant="outline"
            onClick={() => setCatalogModalOpen(true)}
            className="border-[#E5DFD6] text-[#4A4238] hover:bg-[#FAF8F5] text-xs sm:text-sm font-medium h-9"
          >
            <BookOpen className="w-4 h-4 mr-1.5 text-[#B3541E]" />
            Catálogo
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

      {/* Abas de Filtro de Status */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val)
          setSearchParams({ tab: val, q: searchTerm })
        }}
        className="w-full"
      >
        <TabsList className="bg-[#E9E4DC] p-1 border border-[#E5DFD6] flex-wrap h-auto gap-1">
          <TabsTrigger
            value="pendentes"
            className="data-[state=active]:bg-white data-[state=active]:text-[#B3541E] font-medium text-xs sm:text-sm flex items-center gap-1.5"
          >
            Pendentes (Foco)
            {tabCounts.pendentes > 0 && (
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-[#FAF3EC] text-[#B3541E] font-semibold">
                {tabCounts.pendentes}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="rascunhos"
            className="data-[state=active]:bg-white data-[state=active]:text-[#8A8178] text-xs sm:text-sm flex items-center gap-1.5"
          >
            <FileEdit className="w-3.5 h-3.5 text-[#8A8178]" />
            Rascunhos
            {tabCounts.rascunhos > 0 && (
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-semibold">
                {tabCounts.rascunhos}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="todos"
            className="data-[state=active]:bg-white data-[state=active]:text-[#1E1B16] text-xs sm:text-sm flex items-center gap-1.5"
          >
            Todos
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-gray-200 text-gray-700 font-semibold">
              {tabCounts.todos}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="aprovados"
            className="data-[state=active]:bg-white data-[state=active]:text-[#2F7D4F] text-xs sm:text-sm flex items-center gap-1.5"
          >
            Aprovados
            {tabCounts.aprovados > 0 && (
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-green-100 text-green-800 font-semibold">
                {tabCounts.aprovados}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="rejeitados"
            className="data-[state=active]:bg-white data-[state=active]:text-[#B3261E] text-xs sm:text-sm flex items-center gap-1.5"
          >
            Rejeitados
            {tabCounts.rejeitados > 0 && (
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-red-100 text-red-800 font-semibold">
                {tabCounts.rejeitados}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="esfriados"
            className="data-[state=active]:bg-white data-[state=active]:text-slate-700 text-xs sm:text-sm flex items-center gap-1.5"
          >
            <Snowflake className="w-3.5 h-3.5 text-slate-500" />
            Esfriados
            {tabCounts.esfriados > 0 && (
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-semibold">
                {tabCounts.esfriados}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Alerta de erro com botão Tentar novamente caso a requisição falhe */}
      {fetchError && (
        <div className="p-4 rounded-md border border-red-200 bg-red-50 text-red-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span>{fetchError}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchQuotes}
            className="h-8 border-red-300 text-red-800 hover:bg-red-100 self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Tabela de Orçamentos (Desktop) / Cards (Mobile) */}
      <div className="bg-white rounded-md border border-[#E5DFD6] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#B3541E] border-t-transparent" />
              <p className="text-xs text-[#8A8178]">Carregando orçamentos...</p>
            </div>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#8A8178] space-y-2">
            <FileText className="w-10 h-10 mx-auto opacity-30 text-[#B3541E]" />
            <p className="font-medium text-[#1E1B16]">{getEmptyMessage()}</p>
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSearch}
                className="text-xs text-[#B3541E] hover:text-[#9A4618]"
              >
                Limpar busca
              </Button>
            )}
            {activeTab !== 'todos' && tabCounts.todos > 0 && !searchTerm && (
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setActiveTab('todos')
                    setSearchParams({ tab: 'todos', q: searchTerm })
                  }}
                  className="text-xs border-[#E5DFD6] text-[#4A4238] mt-1"
                >
                  Ver todos os {tabCounts.todos} orçamentos
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#FAF8F5] border-b border-[#E5DFD6] text-[#8A8178] uppercase font-semibold tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">ID / Referência</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Título / Proposta</th>
                    <th className="py-3 px-4 text-right">Valor Proposta</th>
                    <th className="py-3 px-4">Data de Envio</th>
                    <th className="py-3 px-4 text-center">Status / Prazo</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DFD6]">
                  {filteredQuotes.map((quote) => {
                    return (
                      <ErrorBoundary
                        key={quote.id}
                        fallback={
                          <tr className="bg-red-50/50">
                            <td colSpan={7} className="py-3 px-4 text-xs text-red-700">
                              Erro ao exibir este orçamento ({quote.id}).{' '}
                              <button
                                onClick={() => navigate(`/orcamentos/${quote.id}`)}
                                className="underline font-semibold"
                              >
                                Abrir detalhes
                              </button>
                            </td>
                          </tr>
                        }
                      >
                        <QuoteTableRow
                          quote={quote}
                          valor={quoteValues[quote.id] || 0}
                          onNavigate={() => navigate(`/orcamentos/${quote.id}`)}
                          onOpenPdf={(e) => handleOpenPdfForQuote(quote, e)}
                          onReativar={(e) => handleReativarQuote(quote.id, e)}
                          onMarcarEnviado={(e) => handleMarcarEnviado(quote.id, e)}
                          onEsfriar={(e) => handleEsfriarQuote(quote.id, e)}
                          getStatusBadge={getStatusBadge}
                        />
                      </ErrorBoundary>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stack de Cards */}
            <div className="md:hidden divide-y divide-[#E5DFD6]">
              {filteredQuotes.map((quote) => {
                return (
                  <ErrorBoundary
                    key={quote.id}
                    fallback={
                      <div className="p-3 bg-red-50 text-xs text-red-700">
                        Erro ao exibir orçamento ({quote.id}).
                      </div>
                    }
                  >
                    <QuoteMobileCard
                      quote={quote}
                      valor={quoteValues[quote.id] || 0}
                      onNavigate={() => navigate(`/orcamentos/${quote.id}`)}
                      onOpenPdf={(e) => handleOpenPdfForQuote(quote, e)}
                      onReativar={(e) => handleReativarQuote(quote.id, e)}
                      onMarcarEnviado={(e) => handleMarcarEnviado(quote.id, e)}
                      onEsfriar={(e) => handleEsfriarQuote(quote.id, e)}
                      getStatusBadge={getStatusBadge}
                    />
                  </ErrorBoundary>
                )
              })}
            </div>
          </>
        )}
      </div>

      <NewQuoteModal
        open={newQuoteModalOpen}
        onOpenChange={setNewQuoteModalOpen}
        onSuccess={fetchQuotes}
      />

      <CatalogManagerModal
        open={catalogModalOpen}
        onOpenChange={setCatalogModalOpen}
        onItemChanged={fetchQuotes}
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

// Subcomponente isolado para renderização de uma linha na tabela Desktop
function QuoteTableRow({
  quote,
  valor,
  onNavigate,
  onOpenPdf,
  onReativar,
  onMarcarEnviado,
  onEsfriar,
  getStatusBadge,
}: {
  quote: Quote
  valor: number
  onNavigate: () => void
  onOpenPdf: (e: React.MouseEvent) => void
  onReativar: (e: React.MouseEvent) => void
  onMarcarEnviado: (e: React.MouseEvent) => void
  onEsfriar: (e: React.MouseEvent) => void
  getStatusBadge: (status: string) => React.ReactNode
}) {
  const clienteNome =
    quote.expand?.contact_id?.nome || quote.expand?.lead_id?.nome || 'Não identificado'

  const isRascunho = quote.status === 'Rascunho'
  const isVisualizado = quote.status === 'Visualizado'
  const isEsfriado = quote.status === 'Esfriou'
  const isPendente = quote.status === 'Enviado' || quote.status === 'Visualizado'

  const valorFormatado = (valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  const dataEnvioObj = getQuoteDataEnvio(quote)
  const dataEnvioFmt = dataEnvioObj
    ? dataEnvioObj.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : quote.created
      ? new Date(quote.created).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '-'

  const prazo = getPrazoDestaque(quote)

  return (
    <tr
      onClick={onNavigate}
      className={cn(
        'cursor-pointer transition-colors duration-150',
        isEsfriado
          ? 'bg-slate-50/70 text-slate-600'
          : isRascunho
            ? 'bg-amber-50/30'
            : prazo
              ? prazo.bgHighlightClass
              : isVisualizado
                ? 'bg-[#FFFDF7]'
                : '',
        'hover:bg-[#FAF8F5]',
      )}
    >
      <td className="py-3.5 px-4 font-mono font-semibold text-[#8A8178] text-xs">
        <div className="flex items-center gap-1.5">
          <span>{quote.numero_referencia || quote.codigo || 'ORC-TEMP'}</span>
          {quote.pdf_locked && (
            <span title="Congelado após PDF" className="inline-flex items-center">
              <Lock className="w-3 h-3 text-amber-600" />
            </span>
          )}
        </div>
      </td>
      <td className="py-3.5 px-4 font-semibold text-[#1E1B16]">{clienteNome}</td>
      <td className="py-3.5 px-4 text-[#1E1B16] font-medium max-w-xs truncate">
        <span className="block truncate">{quote.titulo || 'Sem título'}</span>
        {prazo && (
          <span className="text-[11px] text-[#8A8178] flex items-center gap-1 mt-0.5">
            {prazo.urgencia === 'urgente' && <AlertTriangle className="w-3 h-3 text-[#B3261E]" />}
            {prazo.label}
          </span>
        )}
      </td>
      <td className="py-3.5 px-4 text-right font-bold text-[#B3541E] font-mono">
        {quote.tiragem_valorizacao === 'combinar' && quote.inclui_editorial === false ? (
          <span className="text-xs font-normal text-[#8A8178]">A combinar</span>
        ) : (
          valorFormatado
        )}
      </td>
      <td className="py-3.5 px-4 text-xs text-[#8A8178]">{dataEnvioFmt}</td>
      <td className="py-3.5 px-4 text-center">
        <div className="flex flex-col items-center gap-1">
          {getStatusBadge(quote.status)}
          {prazo && (
            <Badge className={cn('text-[10px] px-1.5 py-0.2', prazo.badgeClass)}>
              {prazo.label}
            </Badge>
          )}
        </div>
      </td>
      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1.5 flex-wrap">
          {/* Botão Gerar PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenPdf}
            className="h-7 text-xs border-[#E5DFD6] text-[#4A4238] hover:bg-[#FAF8F5]"
            title="Gerar PDF da proposta comercial"
          >
            <Printer className="w-3 h-3 mr-1" />
            PDF
          </Button>

          {/* Ação Reativar se estiver Esfriado */}
          {isEsfriado && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReativar}
              className="h-7 text-xs border-[#2B5F8A] text-[#2B5F8A] hover:bg-[#F0F5FA]"
              title="Reativar orçamento (retorna para status Enviado)"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reativar
            </Button>
          )}

          {/* Ação Enviar disponível em Rascunhos */}
          {isRascunho && (
            <Button
              variant="outline"
              size="sm"
              onClick={onMarcarEnviado}
              className="h-7 text-xs border-[#2B5F8A] text-[#2B5F8A] hover:bg-[#F0F5FA]"
              title="Marcar como Enviado para ativar follow-up"
            >
              <Send className="w-3 h-3 mr-1" />
              Enviar
            </Button>
          )}

          {/* Ação Esfriar disponível em orçamentos pendentes */}
          {isPendente && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEsfriar}
              className="h-7 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              title="Mover para Esfriados"
            >
              <Snowflake className="w-3 h-3 mr-1" />
              Esfriar
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onNavigate}
            className="h-7 text-xs font-semibold text-[#B3541E] hover:text-[#9A4618] hover:bg-transparent"
          >
            Ver <ArrowUpRight className="w-3 h-3 ml-0.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

// Subcomponente isolado para renderização de um card no Mobile
function QuoteMobileCard({
  quote,
  valor,
  onNavigate,
  onOpenPdf,
  onReativar,
  onMarcarEnviado,
  onEsfriar,
  getStatusBadge,
}: {
  quote: Quote
  valor: number
  onNavigate: () => void
  onOpenPdf: (e: React.MouseEvent) => void
  onReativar: (e: React.MouseEvent) => void
  onMarcarEnviado: (e: React.MouseEvent) => void
  onEsfriar: (e: React.MouseEvent) => void
  getStatusBadge: (status: string) => React.ReactNode
}) {
  const clienteNome =
    quote.expand?.contact_id?.nome || quote.expand?.lead_id?.nome || 'Não identificado'

  const isRascunho = quote.status === 'Rascunho'
  const isVisualizado = quote.status === 'Visualizado'
  const isEsfriado = quote.status === 'Esfriou'
  const isPendente = quote.status === 'Enviado' || quote.status === 'Visualizado'

  const valorFormatado = (valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

  const prazo = getPrazoDestaque(quote)
  const dataEnvioObj = getQuoteDataEnvio(quote)
  const dataEnvioFmt = dataEnvioObj
    ? dataEnvioObj.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null

  return (
    <div
      onClick={onNavigate}
      className={cn(
        'p-3.5 cursor-pointer space-y-2',
        isEsfriado
          ? 'bg-slate-50'
          : isRascunho
            ? 'bg-amber-50/30'
            : prazo
              ? prazo.bgHighlightClass
              : isVisualizado
                ? 'bg-[#FFFDF7]'
                : '',
        prazo ? prazo.cardBorderClass : '',
        'hover:bg-[#FAF8F5]',
      )}
    >
      <div className="flex items-center justify-between gap-1 flex-wrap">
        <span className="text-xs font-mono font-semibold text-[#8A8178]">
          {quote.numero_referencia || quote.codigo || 'ORC'}
        </span>
        <div className="flex items-center gap-1">
          {getStatusBadge(quote.status)}
          {prazo && (
            <Badge className={cn('text-[10px] px-1.5 py-0.2', prazo.badgeClass)}>
              {prazo.label}
            </Badge>
          )}
        </div>
      </div>
      <p className="font-semibold text-sm text-[#1E1B16] line-clamp-1">
        {quote.titulo || 'Sem título'}
      </p>
      <div className="flex items-center justify-between text-xs text-[#8A8178] pt-1">
        <span>
          Cliente: <strong className="text-[#1E1B16]">{clienteNome}</strong>
        </span>
        <span className="font-bold text-[#B3541E] text-sm font-mono">
          {quote.tiragem_valorizacao === 'combinar' && quote.inclui_editorial === false
            ? 'A combinar'
            : valorFormatado}
        </span>
      </div>
      {dataEnvioFmt && <div className="text-[11px] text-[#8A8178]">Enviado em: {dataEnvioFmt}</div>}

      <div
        className="pt-2 flex items-center justify-between gap-2 border-t border-[#E5DFD6]"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenPdf}
          className="h-7 text-xs border-[#E5DFD6]"
        >
          <Printer className="w-3 h-3 mr-1" />
          PDF da Proposta
        </Button>

        {isRascunho ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onMarcarEnviado}
            className="h-7 text-xs border-[#2B5F8A] text-[#2B5F8A]"
          >
            <Send className="w-3 h-3 mr-1" />
            Marcar Enviado
          </Button>
        ) : isEsfriado ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onReativar}
            className="h-7 text-xs border-[#2B5F8A] text-[#2B5F8A]"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reativar
          </Button>
        ) : isPendente ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEsfriar}
            className="h-7 text-xs text-slate-500"
          >
            <Snowflake className="w-3 h-3 mr-1" />
            Esfriar
          </Button>
        ) : null}
      </div>
    </div>
  )
}
