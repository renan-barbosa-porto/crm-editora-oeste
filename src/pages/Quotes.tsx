import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getQuotes, getQuoteItems, updateQuoteStatus } from '@/services/quotes'
import { useRealtime } from '@/hooks/use-realtime'
import type { Quote, QuoteStatus } from '@/types/crm'
import {
  FileText,
  Search,
  Plus,
  ArrowUpRight,
  AlertTriangle,
  RotateCcw,
  Archive,
  Printer,
  Snowflake,
  BookOpen,
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
import { Lock } from 'lucide-react'
import { useCompanySettings } from '@/contexts/SettingsContext'
import {
  parseTiragens,
  CONDICOES_PADRAO_EDITORA_OESTE,
  ESPECIFICACOES_GRAFICAS_PADRAO,
} from '@/lib/pdf-generator'
import { useToast } from '@/hooks/use-toast'

export default function Quotes() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { settings: companySettings } = useCompanySettings()
  const [searchParams, setSearchParams] = useSearchParams()

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [quoteValues, setQuoteValues] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

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
    try {
      const allQuotes = await getQuotes('todos')
      setQuotes(allQuotes)

      const valuesMap: Record<string, number> = {}
      for (const q of allQuotes) {
        try {
          let items = q.expand?.quote_items_via_quote_id
          if (!items) {
            items = await getQuoteItems(q.id)
          }
          valuesMap[q.id] = calcularValorQuote(q, items)
        } catch {
          valuesMap[q.id] = calcularValorQuote(q)
        }
      }
      setQuoteValues(valuesMap)
    } catch (err) {
      console.error('Erro ao buscar orçamentos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuotes()
  }, [])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q !== null) setSearchTerm(q)
    const tab = searchParams.get('tab')
    if (tab) setActiveTab(tab)
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

  // Ação de Reativar orçamento esfriado -> volta para status 'Enviado' (mesma mecânica de antes)
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
      setPdfItems(items)
      setPdfModalOpen(true)
    } catch {
      toast({
        title: 'Erro ao carregar dados do PDF',
        variant: 'destructive',
      })
    }
  }

  // Contagem de esfriados
  const totalEsfriados = useMemo(() => {
    return quotes.filter((q) => q.status === 'Esfriou').length
  }, [quotes])

  // Filtragem por abas e busca
  const filteredQuotes = useMemo(() => {
    const list = quotes.filter((q) => {
      // Filtro de aba
      let matchTab = true
      if (activeTab === 'pendentes') {
        matchTab = q.status === 'Rascunho' || q.status === 'Enviado' || q.status === 'Visualizado'
      } else if (activeTab === 'aprovados') {
        matchTab = q.status === 'Aprovado'
      } else if (activeTab === 'rejeitados') {
        matchTab = q.status === 'Rejeitado'
      } else if (activeTab === 'esfriados') {
        matchTab = q.status === 'Esfriou'
      }

      // Filtro de busca
      const clienteNome = q.expand?.contact_id?.nome || q.expand?.lead_id?.nome || ''
      const matchSearch =
        !searchTerm.trim() ||
        q.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.codigo && q.codigo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        clienteNome.toLowerCase().includes(searchTerm.toLowerCase())

      return matchTab && matchSearch
    })

    // Na aba "pendentes", ordenar do mais antigo para o mais recente (mais antigo no topo)
    if (activeTab === 'pendentes') {
      return [...list].sort((a, b) => {
        const timeA = getQuoteDataEnvio(a)?.getTime() || new Date(a.created).getTime()
        const timeB = getQuoteDataEnvio(b)?.getTime() || new Date(b.created).getTime()
        return timeA - timeB // Ascendente: mais antigo primeiro
      })
    }

    return list
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
        return <Badge variant="secondary">{status}</Badge>
    }
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
              setSearchTerm(e.target.value)
              setSearchParams({ tab: activeTab, q: e.target.value })
            }}
            placeholder="Buscar por código, título ou cliente..."
            className="pl-9 h-9 text-xs sm:text-sm border-[#E5DFD6] bg-[#FAF8F5]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCatalogModalOpen(true)}
            className="border-[#E5DFD6] text-[#4A4238] hover:bg-[#FAF8F5] text-xs sm:text-sm font-medium h-9"
          >
            <BookOpen className="w-4 h-4 mr-1.5 text-[#B3541E]" />
            Catálogo de Serviços
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

      {/* Abas de Filtro de Status com nova aba 'Esfriados' */}
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
            className="data-[state=active]:bg-white data-[state=active]:text-[#B3541E] font-medium text-xs sm:text-sm"
          >
            Pendentes (Foco)
          </TabsTrigger>
          <TabsTrigger
            value="todos"
            className="data-[state=active]:bg-white data-[state=active]:text-[#1E1B16] text-xs sm:text-sm"
          >
            Todos
          </TabsTrigger>
          <TabsTrigger
            value="aprovados"
            className="data-[state=active]:bg-white data-[state=active]:text-[#2F7D4F] text-xs sm:text-sm"
          >
            Aprovados
          </TabsTrigger>
          <TabsTrigger
            value="rejeitados"
            className="data-[state=active]:bg-white data-[state=active]:text-[#B3261E] text-xs sm:text-sm"
          >
            Rejeitados
          </TabsTrigger>
          <TabsTrigger
            value="esfriados"
            className="data-[state=active]:bg-white data-[state=active]:text-slate-700 text-xs sm:text-sm flex items-center gap-1.5"
          >
            <Snowflake className="w-3.5 h-3.5 text-slate-500" />
            Esfriados
            {totalEsfriados > 0 && (
              <span className="ml-1 text-[11px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-semibold">
                {totalEsfriados}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

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
          <div className="p-8 text-center text-sm text-[#8A8178]">
            <FileText className="w-10 h-10 mx-auto opacity-30 mb-2 text-[#B3541E]" />
            Nenhum orçamento encontrado nesta aba.
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
                    const clienteNome =
                      quote.expand?.contact_id?.nome ||
                      quote.expand?.lead_id?.nome ||
                      'Não identificado'
                    const isVisualizado = quote.status === 'Visualizado'
                    const isEsfriado = quote.status === 'Esfriou'
                    const isPendente =
                      quote.status === 'Rascunho' ||
                      quote.status === 'Enviado' ||
                      quote.status === 'Visualizado'
                    const valorFormatado = (quoteValues[quote.id] || 0).toLocaleString('pt-BR', {
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
                      : new Date(quote.created).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })

                    const prazo = getPrazoDestaque(quote)

                    return (
                      <tr
                        key={quote.id}
                        onClick={() => navigate(`/orcamentos/${quote.id}`)}
                        className={cn(
                          'cursor-pointer transition-colors duration-150',
                          isEsfriado
                            ? 'bg-slate-50/70 text-slate-600'
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
                          <span className="block truncate">{quote.titulo}</span>
                          {prazo && (
                            <span className="text-[11px] text-[#8A8178] flex items-center gap-1 mt-0.5">
                              {prazo.urgencia === 'urgente' && (
                                <AlertTriangle className="w-3 h-3 text-[#B3261E]" />
                              )}
                              {prazo.label}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#B3541E] font-mono">
                          {quote.tiragem_valorizacao === 'combinar' &&
                          quote.inclui_editorial === false ? (
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
                              onClick={(e) => handleOpenPdfForQuote(quote, e)}
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
                                onClick={(e) => handleReativarQuote(quote.id, e)}
                                className="h-7 text-xs border-[#2B5F8A] text-[#2B5F8A] hover:bg-[#F0F5FA]"
                                title="Reativar orçamento (retorna para status Enviado)"
                              >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Reativar
                              </Button>
                            )}

                            {/* Ação Esfriar disponível em orçamentos pendentes */}
                            {isPendente && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleEsfriarQuote(quote.id, e)}
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
                              onClick={() => navigate(`/orcamentos/${quote.id}`)}
                              className="h-7 text-xs font-semibold text-[#B3541E] hover:text-[#9A4618] hover:bg-transparent"
                            >
                              Ver <ArrowUpRight className="w-3 h-3 ml-0.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stack de Cards */}
            <div className="md:hidden divide-y divide-[#E5DFD6]">
              {filteredQuotes.map((quote) => {
                const clienteNome =
                  quote.expand?.contact_id?.nome ||
                  quote.expand?.lead_id?.nome ||
                  'Não identificado'
                const isVisualizado = quote.status === 'Visualizado'
                const isEsfriado = quote.status === 'Esfriou'
                const isPendente =
                  quote.status === 'Rascunho' ||
                  quote.status === 'Enviado' ||
                  quote.status === 'Visualizado'
                const valorFormatado = (quoteValues[quote.id] || 0).toLocaleString('pt-BR', {
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
                    key={quote.id}
                    onClick={() => navigate(`/orcamentos/${quote.id}`)}
                    className={cn(
                      'p-3.5 cursor-pointer space-y-2',
                      isEsfriado
                        ? 'bg-slate-50'
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
                        {quote.codigo || 'ORC'}
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
                      {quote.titulo}
                    </p>
                    <div className="flex items-center justify-between text-xs text-[#8A8178] pt-1">
                      <span>
                        Cliente: <strong className="text-[#1E1B16]">{clienteNome}</strong>
                      </span>
                      <span className="font-bold text-[#B3541E] text-sm font-mono">
                        {valorFormatado}
                      </span>
                    </div>
                    {dataEnvioFmt && (
                      <div className="text-[11px] text-[#8A8178]">Enviado em: {dataEnvioFmt}</div>
                    )}

                    <div
                      className="pt-2 flex items-center justify-between gap-2 border-t border-[#E5DFD6]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleOpenPdfForQuote(quote, e)}
                        className="h-7 text-xs border-[#E5DFD6]"
                      >
                        <Printer className="w-3 h-3 mr-1" />
                        PDF da Proposta
                      </Button>

                      {isEsfriado ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleReativarQuote(quote.id, e)}
                          className="h-7 text-xs border-[#2B5F8A] text-[#2B5F8A]"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Reativar
                        </Button>
                      ) : isPendente ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleEsfriarQuote(quote.id, e)}
                          className="h-7 text-xs text-slate-500"
                        >
                          <Snowflake className="w-3 h-3 mr-1" />
                          Esfriar
                        </Button>
                      ) : null}
                    </div>
                  </div>
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
            companySettings.texto_condicoes_padrao ||
            CONDICOES_PADRAO_EDITORA_OESTE
          }
          descontoPercentual={selectedQuoteForPdf.desconto_percentual || 0}
          companySettings={companySettings}
        />
      )}
    </div>
  )
}
