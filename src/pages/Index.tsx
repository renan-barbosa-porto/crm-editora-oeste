import React, { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getLeads } from '@/services/leads'
import { getQuotes, getQuoteItems, updateQuoteStatus } from '@/services/quotes'
import { useRealtime } from '@/hooks/use-realtime'
import type { Lead, Quote } from '@/types/crm'
import {
  Users,
  Target,
  Clock,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  MessageCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { cn } from '@/lib/utils'
import { getPrazoDestaque, getQuoteDataEnvio, formatWhatsAppUrl } from '@/lib/quote-utils'

export default function Index() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [leads, setLeads] = useState<Lead[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [quoteValues, setQuoteValues] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  // Ações de Aprovação / Rejeição rápida
  const [quoteToAction, setQuoteToAction] = useState<{
    id: string
    titulo: string
    acao: 'Aprovado' | 'Rejeitado'
  } | null>(null)
  const [isProcessingAction, setIsProcessingAction] = useState(false)

  const loadData = async () => {
    try {
      const [allLeads, allQuotes] = await Promise.all([getLeads(), getQuotes('todos')])
      setLeads(allLeads)
      setQuotes(allQuotes)

      // Carregar os valores totais dos orçamentos
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

  // Subscrições Realtime
  useRealtime('leads', () => loadData())
  useRealtime('quotes', () => loadData())
  useRealtime('quote_items', () => loadData())

  // Cálculos dos KPIs existentes
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // 1. Leads Novos (7 dias)
  const leadsNovos7Dias = useMemo(() => {
    return leads.filter((l) => new Date(l.created) >= sevenDaysAgo).length
  }, [leads, sevenDaysAgo])

  // 2. Leads Ativos (exclui 'Perdido', 'Fechado' e 'Esfriou' conforme especificação)
  const leadsAtivos = useMemo(() => {
    return leads.filter(
      (l) => l.estagio !== 'Perdido' && l.estagio !== 'Fechado' && l.estagio !== 'Esfriou',
    ).length
  }, [leads])

  // 3. Orçamentos Pendentes (status 'Enviado' ou 'Visualizado')
  const orcamentosPendentesCount = useMemo(() => {
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

  // ORÇAMENTOS ENVIADOS SEM RESPOSTA — SEÇÃO PRINCIPAL DE FOLLOW-UP
  // Ordenados do MAIS ANTIGO para o MAIS RECENTE (mais antigo no topo, onde priorizar esforços)
  const orcamentosFollowUp = useMemo(() => {
    const pendentes = quotes.filter((q) => q.status === 'Enviado' || q.status === 'Visualizado')

    return pendentes.sort((a, b) => {
      const dateA = getQuoteDataEnvio(a)?.getTime() || new Date(a.created).getTime()
      const dateB = getQuoteDataEnvio(b)?.getTime() || new Date(b.created).getTime()
      return dateA - dateB // Ascendente: mais antigo primeiro
    })
  }, [quotes])

  // Contadores de urgência de follow-up
  const followUpStats = useMemo(() => {
    let urgente = 0
    let alerta = 0
    let neutro = 0

    orcamentosFollowUp.forEach((q) => {
      const p = getPrazoDestaque(q)
      if (p?.urgencia === 'urgente') urgente++
      else if (p?.urgencia === 'alerta') alerta++
      else neutro++
    })

    return { urgente, alerta, neutro }
  }, [orcamentosFollowUp])

  // Executar Aprovação ou Rejeição Rápida
  const handleConfirmQuickStatus = async () => {
    if (!quoteToAction) return
    setIsProcessingAction(true)
    try {
      await updateQuoteStatus(quoteToAction.id, quoteToAction.acao)
      toast({
        title: `Orçamento marcado como ${quoteToAction.acao}!`,
        description: `O orçamento "${quoteToAction.titulo}" foi atualizado com sucesso.`,
      })
      // Atualização otimista
      setQuotes((prev) =>
        prev.map((q) => (q.id === quoteToAction.id ? { ...q, status: quoteToAction.acao } : q)),
      )
    } catch {
      toast({
        title: 'Erro ao atualizar orçamento',
        variant: 'destructive',
      })
      loadData()
    } finally {
      setIsProcessingAction(false)
      setQuoteToAction(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#B3541E] border-t-transparent" />
          <p className="text-sm font-serif text-[#8A8178]">Carregando Painel de Follow-up...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 4 KPI CARDS EXISTENTES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Leads Novos (7 dias) */}
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

        {/* KPI 2: Leads Ativos */}
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

        {/* KPI 3: Orçamentos Pendentes - Âmbar */}
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
              {orcamentosPendentesCount}
            </div>
            <p className="text-xs font-medium text-[#925608] mt-1">
              {followUpStats.urgente > 0 ? (
                <span className="text-[#B3261E] font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {followUpStats.urgente} urgente(s) (&gt;7
                  dias)
                </span>
              ) : (
                'Aguardando resposta do cliente'
              )}
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Orçamentos Aprovados (mês) */}
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

      {/* SEÇÃO PRINCIPAL: PAINEL DE FOLLOW-UP COMERCIAL (ONDE DEVO PRIORIZAR ESFORÇOS) */}
      <Card className="bg-white border-[#E5DFD6] shadow-sm animate-fade-in-up [animation-delay:320ms]">
        <CardHeader className="p-4 sm:p-5 border-b border-[#E5DFD6] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FAF8F5]">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="font-serif text-lg font-bold text-[#1E1B16] flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#B3541E]" />
                Prioridades de Follow-up — Orçamentos Enviados sem Resposta
              </CardTitle>
            </div>
            <p className="text-xs text-[#8A8178] mt-1">
              Ordenados do mais antigo para o mais recente. Priorize contato com clientes com
              destaque vermelho e amarelo.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {followUpStats.urgente > 0 && (
              <Badge className="bg-[#B3261E] text-white text-xs font-semibold">
                {followUpStats.urgente} urgente(s) (&gt;7 dias)
              </Badge>
            )}
            {followUpStats.alerta > 0 && (
              <Badge className="bg-[#C07A1B] text-white text-xs font-semibold">
                {followUpStats.alerta} em atenção (4 a 7 dias)
              </Badge>
            )}
            <Link
              to="/orcamentos?tab=pendentes"
              className="text-xs font-semibold text-[#B3541E] hover:underline flex items-center gap-1 ml-1"
            >
              Ver todos <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </CardHeader>

        <CardContent className="p-0 divide-y divide-[#E5DFD6]">
          {orcamentosFollowUp.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#8A8178]">
              <CheckCircle2 className="w-10 h-10 mx-auto text-[#2F7D4F] opacity-40 mb-2" />
              <p className="font-medium text-[#1E1B16]">Nenhum orçamento pendente de resposta!</p>
              <p className="text-xs text-[#8A8178] mt-1">
                Todos os orçamentos enviados foram respondidos ou aprovados.
              </p>
            </div>
          ) : (
            orcamentosFollowUp.map((quote) => {
              const prazo = getPrazoDestaque(quote)
              const clienteNome =
                quote.expand?.contact_id?.nome ||
                quote.expand?.lead_id?.nome ||
                'Cliente não identificado'
              const telefone =
                quote.expand?.contact_id?.telefone || quote.expand?.lead_id?.telefone || ''
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
                : 'Data não informada'

              const waMsg = `Olá ${clienteNome}! Tudo bem? Gostaria de saber se você teve a oportunidade de avaliar a proposta "${quote.titulo}" que lhe enviamos.`
              const waUrl = telefone ? formatWhatsAppUrl(telefone, waMsg) : ''

              return (
                <div
                  key={quote.id}
                  className={cn(
                    'p-4 transition-all duration-150 flex flex-col lg:flex-row lg:items-center justify-between gap-4',
                    prazo?.cardBorderClass,
                    prazo?.bgHighlightClass,
                    'hover:bg-[#FAF8F5]',
                  )}
                >
                  {/* Informações do Orçamento & Lead */}
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => navigate(`/orcamentos/${quote.id}`)}
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-mono font-bold text-[#8A8178]">
                        {quote.codigo || 'ORC-TEMP'}
                      </span>
                      {prazo && (
                        <Badge className={cn('text-xs px-2 py-0.5', prazo.badgeClass)}>
                          {prazo.urgencia === 'urgente' && (
                            <AlertTriangle className="w-3 h-3 mr-1 inline" />
                          )}
                          {prazo.label}
                        </Badge>
                      )}
                      <span className="text-xs text-[#8A8178]">(Envio: {dataEnvioFmt})</span>
                    </div>

                    <h3 className="font-semibold text-sm sm:text-base text-[#1E1B16] hover:text-[#B3541E] transition-colors">
                      {quote.titulo}
                    </h3>

                    <div className="flex items-center gap-3 text-xs text-[#8A8178] mt-1 flex-wrap">
                      <span>
                        Cliente:{' '}
                        <strong className="text-[#1E1B16] font-medium">{clienteNome}</strong>
                      </span>
                      {telefone && (
                        <span className="font-mono text-[#4A4238]">Tel: {telefone}</span>
                      )}
                      <span className="font-bold text-[#B3541E] font-mono text-sm">
                        {valorFormatado}
                      </span>
                    </div>
                  </div>

                  {/* AÇÕES RÁPIDAS: WhatsApp, Aprovar, Rejeitar */}
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap pt-2 lg:pt-0 border-t lg:border-t-0 border-[#E5DFD6]">
                    {waUrl ? (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-[#2F7D4F] text-white hover:bg-[#25633e] transition-colors shadow-xs"
                        title="Abrir WhatsApp com mensagem pronta de acompanhamento"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="text-xs h-8 text-gray-400 border-gray-200"
                        title="Sem telefone cadastrado"
                      >
                        <MessageCircle className="w-3.5 h-3.5 mr-1" />
                        Sem Tel.
                      </Button>
                    )}

                    <Button
                      size="sm"
                      onClick={() =>
                        setQuoteToAction({
                          id: quote.id,
                          titulo: quote.titulo,
                          acao: 'Aprovado',
                        })
                      }
                      className="h-8 text-xs font-semibold bg-[#2F7D4F]/10 text-[#2F7D4F] hover:bg-[#2F7D4F] hover:text-white border border-[#2F7D4F]/30 transition-colors"
                      title="Marcar proposta como Aprovada"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Aprovar
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setQuoteToAction({
                          id: quote.id,
                          titulo: quote.titulo,
                          acao: 'Rejeitado',
                        })
                      }
                      className="h-8 text-xs font-semibold text-[#B3261E] border-[#B3261E]/30 hover:bg-[#B3261E] hover:text-white transition-colors"
                      title="Marcar proposta como Rejeitada"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Rejeitar
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/orcamentos/${quote.id}`)}
                      className="h-8 text-xs text-[#8A8178] hover:text-[#1E1B16]"
                      title="Ver detalhes completos do orçamento"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* CONFIRMAÇÃO DE AÇÃO RÁPIDA (APROVAR / REJEITAR) */}
      <AlertDialog open={!!quoteToAction} onOpenChange={(open) => !open && setQuoteToAction(null)}>
        <AlertDialogContent className="bg-white border-[#E5DFD6]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif text-[#1E1B16]">
              {quoteToAction?.acao === 'Aprovado'
                ? 'Marcar Orçamento como Aprovado?'
                : 'Marcar Orçamento como Rejeitado?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#8A8178]">
              {quoteToAction?.acao === 'Aprovado'
                ? `Confirmar aprovação de "${quoteToAction?.titulo}"? O orçamento será registrado como convertido em pedido.`
                : `Deseja registrar que o orçamento "${quoteToAction?.titulo}" foi recusado pelo cliente?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#E5DFD6]">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmQuickStatus}
              disabled={isProcessingAction}
              className={cn(
                quoteToAction?.acao === 'Aprovado'
                  ? 'bg-[#2F7D4F] hover:bg-[#25633e] text-white'
                  : 'bg-[#B3261E] hover:bg-[#961f18] text-white',
              )}
            >
              {isProcessingAction
                ? 'Salvando...'
                : quoteToAction?.acao === 'Aprovado'
                  ? 'Sim, Aprovar Orçamento'
                  : 'Sim, Marcar Rejeitado'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
