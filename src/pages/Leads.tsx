import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getLeads, updateLeadEstagio } from '@/services/leads'
import { useRealtime } from '@/hooks/use-realtime'
import type { Lead, LeadEstagio } from '@/types/crm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  Building,
  Archive,
  RotateCcw,
  MessageCircle,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { NewLeadModal } from '@/components/modals/NewLeadModal'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { formatWhatsAppUrl } from '@/lib/quote-utils'

const ESTAGIOS: {
  key: LeadEstagio
  label: string
  color: string
  borderClass: string
  bgClass: string
}[] = [
  {
    key: 'Novo',
    label: 'Novo',
    color: '#2B5F8A',
    borderClass: 'border-l-[#2B5F8A]',
    bgClass: 'bg-[#2B5F8A]/10',
  },
  {
    key: 'Contato Feito',
    label: 'Contato Feito',
    color: '#0284c7',
    borderClass: 'border-l-[#0284c7]',
    bgClass: 'bg-[#0284c7]/10',
  },
  {
    key: 'Proposta Enviada',
    label: 'Proposta Enviada',
    color: '#C07A1B',
    borderClass: 'border-l-[#C07A1B]',
    bgClass: 'bg-[#C07A1B]/10',
  },
  {
    key: 'Fechado',
    label: 'Fechado',
    color: '#2F7D4F',
    borderClass: 'border-l-[#2F7D4F]',
    bgClass: 'bg-[#2F7D4F]/10',
  },
  {
    key: 'Perdido',
    label: 'Perdido',
    color: '#6b7280',
    borderClass: 'border-l-[#6b7280]',
    bgClass: 'bg-[#6b7280]/10',
  },
]

export default function Leads() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'funil' | 'arquivados'>('funil')
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '')
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>('all')
  const [perdidoExpanded, setPerdidoExpanded] = useState(false)

  // Drag & drop state
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null)
  const [isOverColumn, setIsOverColumn] = useState<LeadEstagio | null>(null)

  // Modal Novo Lead
  const [newLeadModalOpen, setNewLeadModalOpen] = useState(false)
  const [modalEstagio, setModalEstagio] = useState<LeadEstagio>('Novo')

  const fetchLeads = async () => {
    try {
      const data = await getLeads()
      setLeads(data)
    } catch (err) {
      console.error('Erro ao buscar leads:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [])

  // Sincronizar parâmetro de busca da URL
  useEffect(() => {
    const q = searchParams.get('q')
    if (q !== null) {
      setSearchTerm(q)
    }
  }, [searchParams])

  useRealtime('leads', () => fetchLeads())

  // Lista única de empresas para o dropdown
  const empresasDisponiveis = useMemo(() => {
    const set = new Set<string>()
    leads.forEach((l) => {
      if (l.empresa && l.empresa.trim()) {
        set.add(l.empresa.trim())
      }
    })
    return Array.from(set).sort()
  }, [leads])

  // Filtros aplicados em tempo real
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const matchSearch =
        !searchTerm.trim() ||
        l.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.telefone && l.telefone.includes(searchTerm)) ||
        (l.empresa && l.empresa.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchEmpresa = selectedEmpresa === 'all' || l.empresa?.trim() === selectedEmpresa

      return matchSearch && matchEmpresa
    })
  }, [leads, searchTerm, selectedEmpresa])

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    setDraggedLeadId(id)
  }

  const handleDragOver = (e: React.DragEvent, estagio: LeadEstagio) => {
    e.preventDefault()
    if (isOverColumn !== estagio) {
      setIsOverColumn(estagio)
    }
  }

  const handleDragLeave = () => {
    setIsOverColumn(null)
  }

  const handleReativar = async (leadId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      await updateLeadEstagio(leadId, 'Contato Feito')
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, estagio: 'Contato Feito' } : l)),
      )
      toast({
        title: 'Lead reativado!',
        description: 'O lead voltou para o estágio "Contato Feito" no funil de vendas.',
      })
    } catch {
      toast({
        title: 'Erro ao reativar lead',
        variant: 'destructive',
      })
      fetchLeads()
    }
  }

  const handleDrop = async (e: React.DragEvent, targetEstagio: LeadEstagio) => {
    e.preventDefault()
    setIsOverColumn(null)
    const id = e.dataTransfer.getData('text/plain') || draggedLeadId
    if (!id) return

    const lead = leads.find((l) => l.id === id)
    if (!lead || lead.estagio === targetEstagio) return

    // Atualização otimista
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, estagio: targetEstagio } : l)))

    try {
      await updateLeadEstagio(id, targetEstagio)
      toast({
        title: 'Estágio atualizado',
        description: `Lead movido para "${targetEstagio}".`,
      })
    } catch {
      toast({
        title: 'Erro ao atualizar estágio',
        variant: 'destructive',
      })
      fetchLeads()
    } finally {
      setDraggedLeadId(null)
    }
  }

  const openNewLeadWithEstagio = (estagio: LeadEstagio) => {
    setModalEstagio(estagio)
    setNewLeadModalOpen(true)
  }

  const leadsEsfriados = useMemo(() => {
    return filteredLeads.filter((l) => l.estagio === 'Esfriou')
  }, [filteredLeads])

  const totalEsfriados = useMemo(() => {
    return leads.filter((l) => l.estagio === 'Esfriou').length
  }, [leads])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#B3541E] border-t-transparent" />
          <p className="text-sm font-serif text-[#8A8178]">Carregando Pipeline de Leads...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Abas: Funil de Vendas vs Arquivados (Esfriou) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'funil' | 'arquivados')}
        >
          <TabsList className="bg-[#E9E4DC] p-1 border border-[#E5DFD6]">
            <TabsTrigger
              value="funil"
              className="data-[state=active]:bg-white data-[state=active]:text-[#B3541E] font-medium text-xs sm:text-sm"
            >
              Funil de Vendas
            </TabsTrigger>
            <TabsTrigger
              value="arquivados"
              className="data-[state=active]:bg-white data-[state=active]:text-slate-700 font-medium text-xs sm:text-sm flex items-center gap-1.5"
            >
              <Archive className="w-3.5 h-3.5 text-slate-500" />
              Arquivados (Esfriou)
              {totalEsfriados > 0 && (
                <span className="ml-1 text-[11px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-semibold">
                  {totalEsfriados}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          onClick={() => openNewLeadWithEstagio('Novo')}
          className="bg-[#B3541E] hover:bg-[#9A4618] text-white text-xs sm:text-sm font-medium h-9"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Lead
        </Button>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-md border border-[#E5DFD6] shadow-sm">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8178]" />
            <Input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setSearchParams({ q: e.target.value })
              }}
              placeholder="Filtrar por nome ou telefone..."
              className="pl-9 h-9 text-xs sm:text-sm border-[#E5DFD6] bg-[#FAF8F5]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Building className="w-4 h-4 text-[#8A8178]" />
          <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
            <SelectTrigger className="w-[180px] h-9 text-xs sm:text-sm border-[#E5DFD6]">
              <SelectValue placeholder="Todas as empresas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {empresasDisponiveis.map((emp) => (
                <SelectItem key={emp} value={emp}>
                  {emp}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {activeTab === 'funil' ? (
        <>
          {/* PIPELINE KANBAN (Apenas estágios ativos - 'Esfriou' não entra no funil ativo) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {/* As 4 colunas principais */}
            {ESTAGIOS.filter((st) => st.key !== 'Perdido' && st.key !== 'Esfriou').map(
              (estagioInfo) => {
                const columnLeads = filteredLeads.filter((l) => l.estagio === estagioInfo.key)
                const isOver = isOverColumn === estagioInfo.key

                return (
                  <div
                    key={estagioInfo.key}
                    onDragOver={(e) => handleDragOver(e, estagioInfo.key)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, estagioInfo.key)}
                    className={cn(
                      'flex flex-col bg-[#FAF8F5] rounded-lg border border-[#E5DFD6] p-3 min-h-[480px] transition-all duration-150',
                      isOver && 'bg-[#FAF0E6] ring-2 ring-[#B3541E]/40',
                    )}
                  >
                    {/* Cabeçalho da Coluna */}
                    <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#E5DFD6]">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: estagioInfo.color }}
                        />
                        <h3 className="font-serif text-sm font-bold text-[#1E1B16]">
                          {estagioInfo.label}
                        </h3>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-white text-[#8A8178] border border-[#E5DFD6] font-semibold">
                          {columnLeads.length}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openNewLeadWithEstagio(estagioInfo.key)}
                        className="h-7 w-7 text-[#8A8178] hover:text-[#B3541E] hover:bg-white"
                        title={`Adicionar lead em ${estagioInfo.label}`}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Lista de Mini-cards */}
                    <div className="space-y-2.5 flex-1 overflow-y-auto">
                      {columnLeads.length === 0 ? (
                        <div className="h-24 flex items-center justify-center text-center text-xs text-[#8A8178] border border-dashed border-[#E5DFD6] rounded-md">
                          Nenhum lead
                        </div>
                      ) : (
                        columnLeads.map((lead) => {
                          const valorFmt = lead.valor_estimado
                            ? lead.valor_estimado.toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              })
                            : null

                          return (
                            <div
                              key={lead.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, lead.id)}
                              onClick={() => navigate(`/leads/${lead.id}`)}
                              className={cn(
                                'p-3 bg-white rounded-md border border-[#E5DFD6] shadow-xs cursor-pointer',
                                'border-l-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-subtle active:scale-[0.98]',
                                estagioInfo.borderClass,
                                draggedLeadId === lead.id && 'opacity-50 rotate-1',
                              )}
                            >
                              <p className="font-semibold text-sm text-[#1E1B16] line-clamp-1">
                                {lead.nome}
                              </p>
                              {lead.empresa && (
                                <p className="text-xs text-[#8A8178] truncate mt-0.5">
                                  {lead.empresa}
                                </p>
                              )}
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#FAF8F5] text-xs">
                                <span className="text-[#8A8178] truncate max-w-[120px]">
                                  {lead.telefone}
                                </span>
                                {valorFmt && (
                                  <span className="font-semibold text-[#B3541E] text-xs">
                                    {valorFmt}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              },
            )}
          </div>

          {/* Coluna "Perdido" — Contraída por padrão */}
          <div
            onDragOver={(e) => handleDragOver(e, 'Perdido')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'Perdido')}
            className={cn(
              'rounded-lg border border-[#E5DFD6] bg-white transition-all duration-150',
              isOverColumn === 'Perdido' && 'ring-2 ring-gray-400 bg-gray-50',
            )}
          >
            <button
              type="button"
              onClick={() => setPerdidoExpanded(!perdidoExpanded)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-[#FAF8F5] rounded-lg text-left"
            >
              <div className="flex items-center gap-2">
                {perdidoExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[#8A8178]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#8A8178]" />
                )}
                <span className="w-2.5 h-2.5 rounded-full bg-[#6b7280]" />
                <span className="font-serif text-sm font-bold text-[#1E1B16]">
                  Perdido (Oportunidades Descartadas)
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#FAF8F5] text-[#8A8178] border border-[#E5DFD6] font-semibold">
                  {filteredLeads.filter((l) => l.estagio === 'Perdido').length}
                </span>
              </div>
              <span className="text-xs text-[#8A8178]">
                {perdidoExpanded ? 'Clique para recolher' : 'Clique para ver descartados'}
              </span>
            </button>

            {perdidoExpanded && (
              <div className="p-4 pt-1 border-t border-[#E5DFD6] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-[#FAF8F5]">
                {filteredLeads.filter((l) => l.estagio === 'Perdido').length === 0 ? (
                  <p className="text-xs text-[#8A8178] p-2">Nenhum lead marcado como perdido.</p>
                ) : (
                  filteredLeads
                    .filter((l) => l.estagio === 'Perdido')
                    .map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onClick={() => navigate(`/leads/${lead.id}`)}
                        className="p-3 bg-white rounded-md border border-[#E5DFD6] border-l-4 border-l-[#6b7280] shadow-xs cursor-pointer hover:shadow-subtle hover:-translate-y-0.5"
                      >
                        <p className="font-semibold text-sm text-[#1E1B16] truncate">{lead.nome}</p>
                        <p className="text-xs text-[#8A8178] truncate">
                          {lead.empresa || lead.telefone}
                        </p>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        /* ABA ARQUIVADOS ("Esfriou") */
        <div className="bg-white rounded-lg border border-[#E5DFD6] shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#E5DFD6] bg-[#FAF8F5]">
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-slate-500" />
              <div>
                <h2 className="font-serif text-base font-bold text-[#1E1B16]">
                  Leads Arquivados — Estágio "Esfriou"
                </h2>
                <p className="text-xs text-[#8A8178]">
                  Oportunidades que pararam de responder. Ficam fora do funil ativo, mas podem ser
                  reativadas a qualquer momento.
                </p>
              </div>
            </div>
          </div>

          {leadsEsfriados.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#8A8178]">
              <Archive className="w-10 h-10 mx-auto opacity-30 mb-2 text-slate-400" />
              Nenhum lead com status "Esfriou" encontrado.
            </div>
          ) : (
            <div className="divide-y divide-[#E5DFD6]">
              {leadsEsfriados.map((lead) => {
                const valorFmt = lead.valor_estimado
                  ? lead.valor_estimado.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  : null
                const dataFmt = new Date(lead.updated || lead.created).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })

                return (
                  <div
                    key={lead.id}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF8F5] cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-[#1E1B16]">{lead.nome}</span>
                        <Badge
                          variant="outline"
                          className="border-slate-300 text-slate-600 bg-slate-50 text-[11px]"
                        >
                          Esfriou
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#8A8178] mt-1 flex-wrap">
                        {lead.empresa && <span>{lead.empresa}</span>}
                        <span>Tel: {lead.telefone}</span>
                        {valorFmt && (
                          <span className="font-semibold text-[#B3541E]">{valorFmt}</span>
                        )}
                        <span>Última movimentação: {dataFmt}</span>
                      </div>
                      {lead.observacoes && (
                        <p className="text-xs text-[#8A8178] mt-1 italic line-clamp-1">
                          "{lead.observacoes}"
                        </p>
                      )}
                    </div>

                    <div
                      className="flex items-center gap-2 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <a
                        href={formatWhatsAppUrl(
                          lead.telefone,
                          `Olá ${lead.nome}! Tudo bem? Gostaria de retomar nosso contato.`,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded bg-[#2F7D4F]/10 text-[#2F7D4F] hover:bg-[#2F7D4F]/20 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleReativar(lead.id, e)}
                        className="h-8 text-xs border-[#2B5F8A] text-[#2B5F8A] hover:bg-[#F0F5FA]"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1 text-[#2B5F8A]" />
                        Reativar no Funil
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <NewLeadModal
        open={newLeadModalOpen}
        onOpenChange={setNewLeadModalOpen}
        initialEstagio={modalEstagio}
        onSuccess={fetchLeads}
      />
    </div>
  )
}
