import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getLeads } from '@/services/leads'
import { getQuotes, getQuoteItems } from '@/services/quotes'
import { getRecentConversations } from '@/services/conversations'
import { useRealtime } from '@/hooks/use-realtime'
import type { Lead, Quote, Conversation } from '@/types/crm'
import {
  Users,
  Target,
  Clock,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  MessageSquare,
  FileText,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export default function Index() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [quoteValues, setQuoteValues] = useState<Record<string, number>>({})
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [allLeads, allQuotes, recentConvs] = await Promise.all([
        getLeads(),
        getQuotes('todos'),
        getRecentConversations(5),
      ])
      setLeads(allLeads)
      setQuotes(allQuotes)
      setRecentConversations(recentConvs)

      // Carregar os valores totais dos orçamentos para exibir nas tabelas
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
      console.error('Erro ao carregar dados do dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Subscrições Realtime para atualizar instantaneamente o dashboard
  useRealtime('leads', () => loadData())
  useRealtime('quotes', () => loadData())
  useRealtime('conversations', () => loadData())

  // Cálculos dos KPIs
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // 1. Leads Novos (7 dias)
  const leadsNovos7Dias = useMemo(() => {
    return leads.filter((l) => new Date(l.created) >= sevenDaysAgo).length
  }, [leads, sevenDaysAgo])

  // 2. Leads Ativos (não 'Perdido' nem 'Fechado')
  const leadsAtivos = useMemo(() => {
    return leads.filter((l) => l.estagio !== 'Perdido' && l.estagio !== 'Fechado').length
  }, [leads])

  // 3. Orçamentos Pendentes (status 'Enviado' ou 'Visualizado')
  const orcamentosPendentes = useMemo(() => {
    return quotes.filter((q) => q.status === 'Enviado' || q.status === 'Visualizado').length
  }, [quotes])

  // 4. Orçamentos Aprovados no mês atual
  const orcamentosAprovadosMes = useMemo(() => {
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    return quotes.filter((q) => {
      if (q.status !== 'Aprovado') return false
      const qDate = new Date(q.updated || q.created)
      return qDate.getMonth() === currentMonth && qDate.getFullYear() === currentYear
    }).length
  }, [quotes, now])

  // Orçamentos Recentes (Não Aprovados: Rascunho, Enviado, Visualizado - top 5)
  const orcamentosRecentesNaoAprovados = useMemo(() => {
    return quotes
      .filter(
        (q) => q.status === 'Rascunho' || q.status === 'Enviado' || q.status === 'Visualizado',
      )
      .slice(0, 5)
  }, [quotes])

  // Leads Recentes (top 5)
  const leadsRecentes = useMemo(() => {
    return leads.slice(0, 5)
  }, [leads])

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

  const getEstagioBadge = (estagio: string) => {
    switch (estagio) {
      case 'Novo':
        return <Badge className="bg-[#2B5F8A] text-white hover:bg-[#2B5F8A]">Novo</Badge>
      case 'Contato Feito':
        return <Badge className="bg-[#0284c7] text-white hover:bg-[#0284c7]">Contato Feito</Badge>
      case 'Proposta Enviada':
        return (
          <Badge className="bg-[#C07A1B] text-white hover:bg-[#C07A1B]">Proposta Enviada</Badge>
        )
      case 'Fechado':
        return <Badge className="bg-[#2F7D4F] text-white hover:bg-[#2F7D4F]">Fechado</Badge>
      case 'Perdido':
        return (
          <Badge variant="outline" className="border-gray-400 text-gray-500">
            Perdido
          </Badge>
        )
      default:
        return <Badge variant="outline">{estagio}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#B3541E] border-t-transparent" />
          <p className="text-sm font-serif text-[#8A8178]">Carregando Visão Geral...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 4 KPI CARDS com animação sequencial fade-in-up */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Leads Novos (7 dias) - Neutro */}
        <Card className="bg-white border-[#E5DFD6] shadow-sm hover:shadow-elevation transition-all duration-150 animate-fade-in-up [animation-delay:0ms]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8A8178]">
              Leads Novos (7 dias)
            </span>
            <div className="w-8 h-8 rounded-full bg-[#FAF8F5] flex items-center justify-center text-[#8A8178]">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-3xl font-bold text-[#1E1B16]">{leadsNovos7Dias}</div>
            <p className="text-xs text-[#8A8178] mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-[#2F7D4F]" />
              Novas oportunidades esta semana
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Leads Ativos - Azul Suave */}
        <Card className="bg-[#F0F5FA] border-[#D0DFEB] shadow-sm hover:shadow-elevation transition-all duration-150 animate-fade-in-up [animation-delay:80ms]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#2B5F8A]">
              Leads Ativos
            </span>
            <div className="w-8 h-8 rounded-full bg-[#E1EDF7] flex items-center justify-center text-[#2B5F8A]">
              <Target className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-3xl font-bold text-[#1E1B16]">{leadsAtivos}</div>
            <p className="text-xs text-[#2B5F8A] mt-1">Em andamento no funil</p>
          </CardContent>
        </Card>

        {/* KPI 3: Orçamentos Pendentes - ALTO DESTAQUE, Âmbar */}
        <Card className="bg-[#FEF7EA] border-[#F2D8A7] shadow-sm hover:shadow-elevation transition-all duration-150 ring-2 ring-[#C07A1B]/40 animate-fade-in-up [animation-delay:160ms]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C07A1B]">
              Orçamentos Pendentes
            </span>
            <div className="w-8 h-8 rounded-full bg-[#FCECD0] flex items-center justify-center text-[#C07A1B]">
              <Clock className="w-4 h-4 animate-pulse" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-3xl font-bold text-[#C07A1B]">
              {orcamentosPendentes}
            </div>
            <p className="text-xs font-medium text-[#925608] mt-1">
              Enviados / Visualizados (atenção!)
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Orçamentos Aprovados (mês) - Verde Suave */}
        <Card className="bg-[#F2F8F4] border-[#D1E6D8] shadow-sm hover:shadow-elevation transition-all duration-150 animate-fade-in-up [animation-delay:240ms]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#2F7D4F]">
              Orçamentos Aprovados (mês)
            </span>
            <div className="w-8 h-8 rounded-full bg-[#E3F2E7] flex items-center justify-center text-[#2F7D4F]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-serif text-3xl font-bold text-[#2F7D4F]">
              {orcamentosAprovadosMes}
            </div>
            <p className="text-xs text-[#2F7D4F] mt-1">Convertidos em pedidos</p>
          </CardContent>
        </Card>
      </div>

      {/* DUAS LISTAS EM GRID 2 COLUNAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LISTA 1: Orçamentos Recentes (Não Aprovados) */}
        <Card className="bg-white border-[#E5DFD6] shadow-sm flex flex-col animate-fade-in-up [animation-delay:320ms]">
          <CardHeader className="p-4 sm:p-5 border-b border-[#E5DFD6] flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-serif text-base font-bold text-[#1E1B16] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#C07A1B]" />
                Orçamentos Recentes (Não Aprovados)
              </CardTitle>
              <p className="text-xs text-[#8A8178] mt-0.5">
                Propostas pendentes que demandam acompanhamento
              </p>
            </div>
            <Link
              to="/orcamentos?tab=pendentes"
              className="text-xs font-semibold text-[#B3541E] hover:underline flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>

          <CardContent className="p-0 flex-1 divide-y divide-[#E5DFD6]">
            {orcamentosRecentesNaoAprovados.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8A8178]">
                Nenhum orçamento pendente no momento.
              </div>
            ) : (
              orcamentosRecentesNaoAprovados.map((q) => {
                const clienteNome =
                  q.expand?.contact_id?.nome ||
                  q.expand?.lead_id?.nome ||
                  'Cliente não identificado'
                const isVisualizado = q.status === 'Visualizado'
                const valorFormatado = (quoteValues[q.id] || 0).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })

                return (
                  <div
                    key={q.id}
                    onClick={() => navigate(`/orcamentos/${q.id}`)}
                    className={cn(
                      'p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer transition-all duration-150',
                      isVisualizado ? 'bg-[#FFFDF7] hover:bg-[#FDF3E1]' : 'hover:bg-[#FAF8F5]',
                      'hover:-translate-y-0.5',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-medium text-[#8A8178]">
                          {q.codigo || 'ORC-TEMP'}
                        </span>
                        <p className="text-sm font-semibold text-[#1E1B16] truncate">{q.titulo}</p>
                      </div>
                      <p className="text-xs text-[#8A8178] truncate mt-0.5">
                        Cliente: <span className="text-[#1E1B16] font-medium">{clienteNome}</span>
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold text-[#1E1B16]">{valorFormatado}</span>
                      {getStatusBadge(q.status)}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* LISTA 2: Leads Recentes */}
        <Card className="bg-white border-[#E5DFD6] shadow-sm flex flex-col animate-fade-in-up [animation-delay:400ms]">
          <CardHeader className="p-4 sm:p-5 border-b border-[#E5DFD6] flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-serif text-base font-bold text-[#1E1B16] flex items-center gap-2">
                <Target className="w-4 h-4 text-[#2B5F8A]" />
                Leads Recentes
              </CardTitle>
              <p className="text-xs text-[#8A8178] mt-0.5">
                Novos contatos e interessados em serviços
              </p>
            </div>
            <Link
              to="/leads"
              className="text-xs font-semibold text-[#B3541E] hover:underline flex items-center gap-1"
            >
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>

          <CardContent className="p-0 flex-1 divide-y divide-[#E5DFD6]">
            {leadsRecentes.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#8A8178]">
                Nenhum lead cadastrado ainda.
              </div>
            ) : (
              leadsRecentes.map((lead) => {
                const dataFormatada = new Date(lead.created).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })

                return (
                  <div
                    key={lead.id}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="p-3 sm:p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#FAF8F5] transition-all duration-150 hover:-translate-y-0.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#1E1B16] truncate">{lead.nome}</p>
                      <p className="text-xs text-[#8A8178] truncate mt-0.5">
                        {lead.empresa || lead.telefone}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                      {getEstagioBadge(lead.estagio)}
                      <span className="text-[11px] text-[#8A8178]">{dataFormatada}</span>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* BLOCO DE ATIVIDADE RECENTE (últimas 5 interações) */}
      {recentConversations.length > 0 && (
        <Card className="bg-white border-[#E5DFD6] shadow-sm animate-fade-in-up [animation-delay:480ms]">
          <CardHeader className="p-4 sm:p-5 border-b border-[#E5DFD6]">
            <CardTitle className="font-serif text-base font-bold text-[#1E1B16] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#2F7D4F]" />
              Últimas Interações WhatsApp Registradas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="space-y-3">
              {recentConversations.map((conv) => {
                const isSent = conv.direcao === 'enviada'
                const nomeContato =
                  conv.expand?.lead_id?.nome || conv.expand?.contact_id?.nome || 'Cliente'
                const timeAgo = new Date(conv.created).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })

                return (
                  <div
                    key={conv.id}
                    onClick={() => {
                      if (conv.lead_id) navigate(`/leads/${conv.lead_id}`)
                      else if (conv.contact_id) navigate(`/contatos/${conv.contact_id}`)
                    }}
                    className="flex items-start gap-3 p-2.5 rounded-md hover:bg-[#FAF8F5] cursor-pointer transition-colors border border-transparent hover:border-[#E5DFD6]"
                  >
                    <div
                      className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5',
                        isSent ? 'bg-[#E9E4DC] text-[#B3541E]' : 'bg-[#E1EDF7] text-[#2B5F8A]',
                      )}
                    >
                      {isSent ? 'E' : 'R'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#1E1B16]">
                          {isSent ? `Mensagem para ${nomeContato}` : `Mensagem de ${nomeContato}`}
                        </span>
                        <span className="text-[11px] text-[#8A8178]">{timeAgo}</span>
                      </div>
                      <p className="text-xs text-[#8A8178] truncate mt-0.5">"{conv.mensagem}"</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
