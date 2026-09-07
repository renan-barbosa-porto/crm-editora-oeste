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
import { Plus, ChevronDown, ChevronRight, Search, Building } from 'lucide-react'
import { NewLeadModal } from '@/components/modals/NewLeadModal'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#B3541E] border-t-transparent" />
          <p className="text-sm font-serif text-[#8A8178]">Carregando Funil de Leads...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho de Ações */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1E1B16]">Funil de Vendas</h1>
          <p className="text-xs text-[#8A8178] mt-0.5">
            Acompanhamento das oportunidades por estágio comercial
          </p>
        </div>

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

      {/* PIPELINE KANBAN (Estágios ativos: Novo, Contato Feito, Proposta Enviada, Fechado) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {ESTAGIOS.filter((st) => st.key !== 'Perdido').map((estagioInfo) => {
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
                          <p className="text-xs text-[#8A8178] truncate mt-0.5">{lead.empresa}</p>
                        )}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#FAF8F5] text-xs">
                          <span className="text-[#8A8178] truncate max-w-[120px]">
                            {lead.telefone}
                          </span>
                          {valorFmt && (
                            <span className="font-semibold text-[#B3541E] text-xs">{valorFmt}</span>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
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

      <NewLeadModal
        open={newLeadModalOpen}
        onOpenChange={setNewLeadModalOpen}
        initialEstagio={modalEstagio}
        onSuccess={fetchLeads}
      />
    </div>
  )
}
