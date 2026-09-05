import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getQuotes, getQuoteItems } from '@/services/quotes'
import { useRealtime } from '@/hooks/use-realtime'
import type { Quote } from '@/types/crm'
import { FileText, Search, Plus, ArrowUpRight, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NewQuoteModal } from '@/components/modals/NewQuoteModal'
import { cn } from '@/lib/utils'

export default function Quotes() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [quoteValues, setQuoteValues] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // Aba padrão: "pendentes" (Rascunho, Enviado, Visualizado)
  const initialTab = searchParams.get('tab') || 'pendentes'
  const [activeTab, setActiveTab] = useState<string>(initialTab)
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '')

  const [newQuoteModalOpen, setNewQuoteModalOpen] = useState(false)

  const fetchQuotes = async () => {
    try {
      const allQuotes = await getQuotes('todos')
      setQuotes(allQuotes)

      const valuesMap: Record<string, number> = {}
      for (const q of allQuotes) {
        try {
          const items = await getQuoteItems(q.id)
          const subtotal = items.reduce(
            (acc, it) => acc + (it.quantidade || 0) * (it.valor_unitario || 0),
            0,
          )
          const desc = (subtotal * (q.desconto_percentual || 0)) / 100
          valuesMap[q.id] = Math.max(0, subtotal - desc)
        } catch {
          valuesMap[q.id] = 0
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

  // Filtragem por abas e busca
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      // Filtro de aba
      let matchTab = true
      if (activeTab === 'pendentes') {
        matchTab = q.status === 'Rascunho' || q.status === 'Enviado' || q.status === 'Visualizado'
      } else if (activeTab === 'aprovados') {
        matchTab = q.status === 'Aprovado'
      } else if (activeTab === 'rejeitados') {
        matchTab = q.status === 'Rejeitado'
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

        <Button
          onClick={() => setNewQuoteModalOpen(true)}
          className="bg-[#B3541E] hover:bg-[#9A4618] text-white text-xs sm:text-sm font-medium h-9"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Orçamento
        </Button>
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
        <TabsList className="bg-[#E9E4DC] p-1 border border-[#E5DFD6]">
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
            Nenhum orçamento encontrado com este filtro.
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#FAF8F5] border-b border-[#E5DFD6] text-[#8A8178] uppercase font-semibold tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">ID / Código</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Título / Serviço</th>
                    <th className="py-3 px-4 text-right">Valor Total</th>
                    <th className="py-3 px-4">Data de Criação</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DFD6]">
                  {filteredQuotes.map((quote) => {
                    const clienteNome =
                      quote.expand?.contact_id?.nome ||
                      quote.expand?.lead_id?.nome ||
                      'Não identificado'
                    const isVisualizado = quote.status === 'Visualizado'
                    const valorFormatado = (quoteValues[quote.id] || 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                    const dataFormatada = new Date(quote.created).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })

                    return (
                      <tr
                        key={quote.id}
                        onClick={() => navigate(`/orcamentos/${quote.id}`)}
                        className={cn(
                          'cursor-pointer transition-colors duration-150',
                          isVisualizado ? 'bg-[#FFFDF7] hover:bg-[#FDF3E1]' : 'hover:bg-[#FAF8F5]',
                        )}
                      >
                        <td className="py-3.5 px-4 font-mono font-semibold text-[#8A8178] text-xs">
                          {quote.codigo || 'ORC-TEMP'}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-[#1E1B16]">{clienteNome}</td>
                        <td className="py-3.5 px-4 text-[#1E1B16] font-medium max-w-xs truncate">
                          {quote.titulo}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-[#B3541E] font-mono">
                          {valorFormatado}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[#8A8178]">{dataFormatada}</td>
                        <td className="py-3.5 px-4 text-center">{getStatusBadge(quote.status)}</td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#B3541E] hover:underline">
                            Ver <ArrowUpRight className="w-3.5 h-3.5" />
                          </span>
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
                const valorFormatado = (quoteValues[quote.id] || 0).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })

                return (
                  <div
                    key={quote.id}
                    onClick={() => navigate(`/orcamentos/${quote.id}`)}
                    className={cn(
                      'p-3.5 cursor-pointer space-y-2',
                      isVisualizado ? 'bg-[#FFFDF7]' : 'hover:bg-[#FAF8F5]',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-[#8A8178]">
                        {quote.codigo || 'ORC'}
                      </span>
                      {getStatusBadge(quote.status)}
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
    </div>
  )
}
