import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createQuote } from '@/services/quotes'
import { getLeads } from '@/services/leads'
import {
  searchItemSugestoes,
  salvarItemNaMemoriaSeNovo,
  type ItemSugestao,
} from '@/services/catalog'
import {
  ESPECIFICACOES_GRAFICAS_PADRAO,
  CONDICOES_PADRAO_EDITORA_OESTE,
  TIRAGENS_PADRAO,
} from '@/lib/pdf-generator'
import { useCompanySettings } from '@/contexts/SettingsContext'
import { useToast } from '@/hooks/use-toast'
import { getQuotes } from '@/services/quotes'
import { getUltimoNumeroPropostaUsado } from '@/lib/quote-utils'
import { Switch } from '@/components/ui/switch'
import type { Lead, QuoteItem, QuoteStatus, GraficaTiragemRow } from '@/types/crm'
import { Plus, Trash2, Sparkles, BookOpen, AlertTriangle, RefreshCw } from 'lucide-react'

interface NewQuoteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialLeadId?: string
  onSuccess?: (newQuoteId?: string) => void
}

interface ItemRow {
  descricao: string
  quantidade: number
  valor_unitario: number
  showSugestoes?: boolean
}

export function NewQuoteModal({
  open,
  onOpenChange,
  initialLeadId,
  onSuccess,
}: NewQuoteModalProps) {
  const { toast } = useToast()
  const { settings: companySettings } = useCompanySettings()
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLeadId || '')
  const [numeroReferencia, setNumeroReferencia] = useState('')
  const [ultimoNumeroUsado, setUltimoNumeroUsado] = useState<string | null>(null)
  const [incluiEditorial, setIncluiEditorial] = useState(true)
  const [tiragemValorizacao, setTiragemValorizacao] = useState<string>('50')
  const [titulo, setTitulo] = useState('')
  const [status, setStatus] = useState<QuoteStatus>('Rascunho')
  const [descontoPercentual, setDescontoPercentual] = useState<number>(0)
  const [dataEnvio, setDataEnvio] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10)
  })

  // "o formulário de NOVO orçamento começa VAZIO" — conforme solicitado expressamente pelo usuário!
  const [items, setItems] = useState<ItemRow[]>([])

  // Campos Livres de Produção Gráfica
  const [especificacoesGrafica, setEspecificacoesGrafica] = useState(ESPECIFICACOES_GRAFICAS_PADRAO)
  const [tiragens, setTiragens] = useState<GraficaTiragemRow[]>(TIRAGENS_PADRAO)

  // Condições Gerais Editáveis
  const [condicoesGerais, setCondicoesGerais] = useState(
    companySettings?.texto_condicoes_padrao || CONDICOES_PADRAO_EDITORA_OESTE,
  )

  // Autocomplete e memória
  const [sugestoesCache, setSugestoesCache] = useState<ItemSugestao[]>([])
  const [activeSugestaoRow, setActiveSugestaoRow] = useState<number | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [networkErrorMsg, setNetworkErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      getLeads()
        .then((list) => {
          setLeads(list)
          if (initialLeadId) {
            setSelectedLeadId(initialLeadId)
            const found = list.find((l) => l.id === initialLeadId)
            if (found) {
              setTitulo(`Orçamento — ${found.nome}`)
            }
          }
        })
        .catch(() => {
          // Degradação suave em caso de falha de conexão inicial
        })

      // Buscar orçamentos existentes para calcular último número usado (apenas lembrete!)
      getQuotes()
        .then((quotes) => {
          const ultimo = getUltimoNumeroPropostaUsado(quotes)
          setUltimoNumeroUsado(ultimo)
        })
        .catch(() => {})

      // Se não havia initialLeadId, reseta os campos
      if (!initialLeadId) {
        setSelectedLeadId('')
        setTitulo('')
      }
      setNumeroReferencia('')
      setIncluiEditorial(true)
      setTiragemValorizacao('50')
      setItems([])
      setErrors({})
      setNetworkErrorMsg(null)

      // Pré-carregar catálogo inicial para sugestões rápidas
      searchItemSugestoes('')
        .then(setSugestoesCache)
        .catch(() => {})
      if (companySettings?.texto_condicoes_padrao) {
        setCondicoesGerais(companySettings.texto_condicoes_padrao)
      }
    }
  }, [open, initialLeadId, companySettings?.texto_condicoes_padrao])

  const handleAddItem = () => {
    setItems((prev) => [...prev, { descricao: '', quantidade: 1, valor_unitario: 0 }])
  }

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateItem = async (index: number, field: keyof ItemRow, value: any) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)

    if (field === 'descricao') {
      const termo = String(value || '')
      if (termo.length >= 1) {
        const sugs = await searchItemSugestoes(termo)
        setSugestoesCache(sugs)
        setActiveSugestaoRow(index)
      } else {
        setActiveSugestaoRow(null)
      }
    }
  }

  const handleSelectSugestao = (index: number, sugestao: ItemSugestao) => {
    const updated = [...items]
    updated[index] = {
      ...updated[index],
      descricao: sugestao.nome,
      valor_unitario: sugestao.valor_unitario || 0,
    }
    setItems(updated)
    setActiveSugestaoRow(null)
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

  const handleRemoveTiragemRow = (index: number) => {
    setTiragens((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateTiragemRow = (index: number, field: keyof GraficaTiragemRow, val: any) => {
    const updated = [...tiragens]
    const row = { ...updated[index], [field]: val }
    if (field === 'tiragem' || field === 'valor_unitario') {
      const tir = field === 'tiragem' ? Number(val) || 0 : Number(row.tiragem) || 0
      const unit = field === 'valor_unitario' ? Number(val) || 0 : Number(row.valor_unitario) || 0
      row.valor_total = tir * unit
      if (!row.descricao || row.descricao.includes('exemplar')) {
        row.descricao = `${tir} ${tir === 1 ? 'exemplar' : 'exemplares'}`
      }
    }
    updated[index] = row
    setTiragens(updated)
  }

  const subtotalEditorial = items.reduce(
    (acc, it) => acc + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0),
    0,
  )
  const valorDesconto = (subtotalEditorial * (Number(descontoPercentual) || 0)) / 100
  const valorTotalEditorial = Math.max(0, subtotalEditorial - valorDesconto)

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!titulo.trim()) {
      errs.titulo = 'Título do orçamento é obrigatório'
    }
    if (!selectedLeadId) {
      errs.leadId = 'Selecione um Lead'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const submitQuote = async () => {
    if (!validate()) return

    setIsSubmitting(true)
    setNetworkErrorMsg(null)

    try {
      const selectedLead = leads.find((l) => l.id === selectedLeadId)

      const payloadQuote: Partial<import('@/types/crm').Quote> = {
        titulo: titulo.trim(),
        numero_referencia: numeroReferencia.trim() || undefined,
        inclui_editorial: incluiEditorial,
        tiragem_valorizacao: tiragemValorizacao,
        lead_id: selectedLeadId,
        contact_id: selectedLead?.contact_id || undefined,
        status,
        desconto_percentual: Number(descontoPercentual) || 0,
        data_envio: dataEnvio ? `${dataEnvio} 12:00:00` : undefined,
        grafica_especificacoes: especificacoesGrafica.trim() || undefined,
        grafica_tiragens: tiragens,
        condicoes_gerais: condicoesGerais.trim() || undefined,
      }

      const quote = await createQuote(
        payloadQuote,
        items.filter((it) => it.descricao.trim() !== '') as Partial<QuoteItem>[],
      )

      // Guardar na memória do catálogo de forma silenciosa e resiliente
      for (const it of items) {
        if (it.descricao && it.descricao.trim()) {
          try {
            salvarItemNaMemoriaSeNovo(it.descricao, it.valor_unitario)
          } catch {
            // falha em salvar memória não impede o sucesso do orçamento
          }
        }
      }

      toast({
        title: 'Orçamento criado com sucesso!',
        description: `Orçamento "${titulo}" foi gerado em status ${status}.`,
      })

      // Sucesso: limpar estado e fechar modal
      setTitulo('')
      setSelectedLeadId('')
      setDescontoPercentual(0)
      setDataEnvio(new Date().toISOString().slice(0, 10))
      setItems([])
      setNetworkErrorMsg(null)
      onOpenChange(false)
      if (onSuccess) onSuccess(quote.id)
    } catch (error: any) {
      console.error('[NewQuoteModal] Erro ao salvar orçamento:', error)

      // Se mesmo com todos os retries e reconciliação falhar por instabilidade de rede / 503:
      const statusErr = error?.status ?? error?.response?.status
      const is503 = statusErr === 503 || String(error?.message || '').includes('503')
      const friendlyMsg = is503
        ? 'O servidor do banco está temporariamente indisponível (503). Seus dados estão salvos neste formulário — aguarde alguns instantes e clique em Tentar novamente.'
        : error?.message ||
          'Não foi possível gravar o orçamento no servidor. Seu orçamento NÃO foi perdido — clique em Tentar novamente.'

      setNetworkErrorMsg(friendlyMsg)

      toast({
        title: is503 ? 'Servidor temporariamente indisponível' : 'Erro ao salvar orçamento',
        description:
          'Seu orçamento NÃO foi perdido — os dados foram preservados. Clique em "Tentar novamente".',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submitQuote()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto bg-white border-[#E5DFD6]">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-[#1E1B16] flex items-center gap-2">
            <span>Novo Orçamento Comercial</span>
            <span className="text-xs px-2 py-0.5 rounded bg-[#FAF8F5] text-[#8A8178] border border-[#E5DFD6]">
              {companySettings?.nome_comercial || 'Editora Oeste'}
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs text-[#8A8178]">
            Monte a proposta com serviços editoriais (Parte 1), produção gráfica por tiragens (Parte
            2) e condições de entrega.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Cabeçalho: Lead, Status, Título e Data de Envio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label
                htmlFor="quote-lead"
                className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
              >
                Lead Solicitante *
              </Label>
              <Select
                value={selectedLeadId}
                onValueChange={(val) => {
                  setSelectedLeadId(val)
                  const leadFound = leads.find((l) => l.id === val)
                  if (leadFound && (!titulo || titulo.startsWith('Orçamento —'))) {
                    setTitulo(`Orçamento — ${leadFound.nome}`)
                  }
                }}
              >
                <SelectTrigger id="quote-lead" className="mt-1 border-[#E5DFD6]">
                  <SelectValue placeholder="Selecione o lead" />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nome} {l.empresa ? `(${l.empresa})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.leadId && <p className="text-xs text-[#B3261E] mt-1">{errors.leadId}</p>}
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]">
                Status Inicial
              </Label>
              <Select value={status} onValueChange={(val) => setStatus(val as QuoteStatus)}>
                <SelectTrigger className="mt-1 border-[#E5DFD6]">
                  <SelectValue placeholder="Status" />
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label
                htmlFor="quote-titulo"
                className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
              >
                Título do Orçamento / Projeto *
              </Label>
              <Input
                id="quote-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Proposta Editorial — Pra. Daiana"
                className="mt-1 border-[#E5DFD6] focus-visible:ring-[#B3541E]"
              />
              {errors.titulo && <p className="text-xs text-[#B3261E] mt-1">{errors.titulo}</p>}
            </div>

            <div>
              <Label
                htmlFor="quote-data-envio"
                className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
              >
                Data de Envio *
              </Label>
              <Input
                id="quote-data-envio"
                type="date"
                value={dataEnvio}
                onChange={(e) => setDataEnvio(e.target.value)}
                className="mt-1 border-[#E5DFD6] focus-visible:ring-[#B3541E]"
              />
            </div>
          </div>

          {/* Número de Referência + Tiragem para Valorização */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[#FAF8F5] rounded-md border border-[#E5DFD6]">
            <div>
              <Label
                htmlFor="quote-ref"
                className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
              >
                Referência / Nº da Proposta
              </Label>
              <Input
                id="quote-ref"
                value={numeroReferencia}
                onChange={(e) => setNumeroReferencia(e.target.value)}
                placeholder="Ex: 26152"
                className="mt-1 border-[#E5DFD6] bg-white font-mono"
              />
              {ultimoNumeroUsado && (
                <p className="text-[11px] text-[#8A8178] mt-1">
                  Lembrete da sequência: último número usado foi{' '}
                  <strong className="font-mono text-[#1E1B16]">{ultimoNumeroUsado}</strong>.
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]">
                Tiragem para valorização (Dashboard)
              </Label>
              <Select value={tiragemValorizacao} onValueChange={setTiragemValorizacao}>
                <SelectTrigger className="mt-1 border-[#E5DFD6] bg-white">
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
                Define qual lote gráfico compõe o valor no dashboard.
              </p>
            </div>
          </div>

          {/* PARTE 1 — PRODUÇÃO EDITORIAL (com interruptor) */}
          <div className="border border-[#E5DFD6] rounded-md p-3.5 bg-[#FAF8F5] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#1E1B16] flex items-center gap-1.5">
                  <span className="bg-[#1E1B16] text-white text-[10px] px-1.5 py-0.2 rounded font-mono">
                    PARTE 1
                  </span>
                  Produção Editorial
                </span>
                <p className="text-[11px] text-[#8A8178]">
                  Digite para buscar itens do catálogo ou cadastre novos livremente.
                </p>
              </div>

              {/* Interruptor: Projeto inclui produção editorial? */}
              <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded border border-[#E5DFD6] self-start sm:self-auto">
                <label
                  htmlFor="modal-toggle-editorial"
                  className="text-xs font-medium text-[#1E1B16] cursor-pointer"
                >
                  Inclui editorial?
                </label>
                <Switch
                  id="modal-toggle-editorial"
                  checked={incluiEditorial}
                  onCheckedChange={setIncluiEditorial}
                />
              </div>
            </div>

            {!incluiEditorial ? (
              <div className="p-4 text-center text-xs text-[#8A8178] border border-dashed border-[#E5DFD6] rounded bg-white">
                Parte 1 desligada: a proposta começará direto na Parte 2 (Produção Gráfica).
              </div>
            ) : (
              <>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddItem}
                    className="h-7 text-xs border-[#E5DFD6] hover:bg-white text-[#B3541E]"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Adicionar Item Editorial
                  </Button>
                </div>

                {items.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#8A8178] border border-dashed border-[#E5DFD6] rounded bg-white">
                    Nenhum item adicionado ainda. Clique em "Adicionar Item Editorial" acima para
                    começar.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        className="relative bg-white p-2.5 rounded border border-[#E5DFD6]"
                      >
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Input
                              placeholder="Digite o serviço editorial (ex: ISBN, Capa, Diagramação InDesign...)"
                              value={item.descricao}
                              onChange={(e) => handleUpdateItem(idx, 'descricao', e.target.value)}
                              onFocus={() => setActiveSugestaoRow(idx)}
                              className="text-xs sm:text-sm border-[#E5DFD6]"
                            />

                            {/* Dropdown de sugestões do catálogo com memória */}
                            {activeSugestaoRow === idx && sugestoesCache.length > 0 && (
                              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E5DFD6] rounded-md shadow-lg z-20 max-h-48 overflow-y-auto divide-y divide-[#FAF8F5]">
                                <div className="p-1.5 bg-[#FAF8F5] text-[10px] font-bold uppercase text-[#8A8178] flex items-center justify-between">
                                  <span className="flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-[#B3541E]" />
                                    Sugestões da memória do catálogo:
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveSugestaoRow(null)}
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
                                      handleSelectSugestao(idx, sug)
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
                                    <div className="text-right flex-shrink-0 font-mono text-xs font-bold text-[#1E1B16]">
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

                          <div className="w-16">
                            <Input
                              type="number"
                              min="1"
                              placeholder="Qtd"
                              value={item.quantidade}
                              onChange={(e) =>
                                handleUpdateItem(
                                  idx,
                                  'quantidade',
                                  Math.max(1, parseInt(e.target.value) || 1),
                                )
                              }
                              className="text-xs sm:text-sm text-center border-[#E5DFD6]"
                            />
                          </div>

                          <div className="w-24">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="R$ Unit."
                              value={item.valor_unitario}
                              onChange={(e) =>
                                handleUpdateItem(
                                  idx,
                                  'valor_unitario',
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="text-xs sm:text-sm text-right border-[#E5DFD6]"
                            />
                          </div>

                          <div className="w-24 text-right text-xs font-mono font-bold text-[#1E1B16] pr-1">
                            {(
                              (Number(item.quantidade) || 0) * (Number(item.valor_unitario) || 0)
                            ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(idx)}
                            className="h-8 w-8 text-[#8A8178] hover:text-[#B3261E]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Subtotal Editorial */}
                <div className="pt-2 border-t border-[#E5DFD6] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[#8A8178]">Desconto Editorial (%):</span>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={descontoPercentual}
                      onChange={(e) =>
                        setDescontoPercentual(
                          Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)),
                        )
                      }
                      className="w-16 h-7 text-xs border-[#E5DFD6] bg-white font-mono"
                    />
                  </div>

                  <div className="text-right">
                    <span className="text-[#8A8178]">Subtotal Editorial: </span>
                    <strong className="text-sm text-[#1E1B16] font-mono">
                      {valorTotalEditorial.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </strong>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* PARTE 2 — PRODUÇÃO GRÁFICA (Impressão do Livro) */}
          <div className="border border-[#E5DFD6] rounded-md p-3.5 bg-[#FAF8F5] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#1E1B16] flex items-center gap-1.5">
                  <span className="bg-[#B3541E] text-white text-[10px] px-1.5 py-0.2 rounded font-mono">
                    PARTE 2
                  </span>
                  Produção Gráfica (Impressão do Livro)
                </span>
                <p className="text-[11px] text-[#8A8178]">
                  Campos livres para formato, miolo, papel, acabamento e tabela de impressão por
                  tiragem flexível.
                </p>
              </div>
            </div>

            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-[#1E1B16]">
                Especificações Técnicas da Impressão (Texto Livre)
              </Label>
              <textarea
                value={especificacoesGrafica}
                onChange={(e) => setEspecificacoesGrafica(e.target.value)}
                rows={4}
                className="w-full mt-1 p-2 text-xs border border-[#E5DFD6] rounded bg-white text-[#1E1B16] focus:outline-none focus:ring-1 focus:ring-[#B3541E] font-sans leading-relaxed"
                placeholder="Ex: Livro até 72 páginas, formato 155x225mm, miolo P&B em Pólen 80g..."
              />
            </div>

            {/* Tabela de Tiragens Flexíveis */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1E1B16]">
                  Tabela de Impressão por Tiragem
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTiragemRow}
                  className="h-7 text-xs border-[#E5DFD6] text-[#B3541E] hover:bg-white"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Adicionar Linha de Tiragem
                </Button>
              </div>

              <div className="space-y-1.5">
                {tiragens.map((row, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-white p-2 rounded border border-[#E5DFD6]"
                  >
                    <div className="w-24">
                      <Input
                        type="number"
                        min="1"
                        placeholder="Tiragem"
                        value={row.tiragem}
                        onChange={(e) =>
                          handleUpdateTiragemRow(
                            idx,
                            'tiragem',
                            Math.max(1, parseInt(e.target.value) || 1),
                          )
                        }
                        className="text-xs h-8 border-[#E5DFD6]"
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        placeholder="Descrição (ex: 50 exemplares)"
                        value={row.descricao}
                        onChange={(e) => handleUpdateTiragemRow(idx, 'descricao', e.target.value)}
                        className="text-xs h-8 border-[#E5DFD6]"
                      />
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Preço/un (R$)"
                        value={row.valor_unitario}
                        onChange={(e) =>
                          handleUpdateTiragemRow(
                            idx,
                            'valor_unitario',
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="text-xs h-8 text-right border-[#E5DFD6]"
                      />
                    </div>
                    <div className="w-28 text-right font-mono font-bold text-xs text-[#1E1B16] pr-1">
                      {(
                        (Number(row.tiragem) || 0) * (Number(row.valor_unitario) || 0)
                      ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveTiragemRow(idx)}
                      className="h-7 w-7 text-[#8A8178] hover:text-[#B3261E]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CONDIÇÕES GERAIS EDITÁVEIS */}
          <div className="border border-[#E5DFD6] rounded-md p-3.5 bg-white space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#B3541E]" />
              Condições Gerais de Produção & Entrega (Editável)
            </Label>
            <textarea
              value={condicoesGerais}
              onChange={(e) => setCondicoesGerais(e.target.value)}
              rows={4}
              className="w-full p-2 text-xs border border-[#E5DFD6] rounded bg-[#FAF8F5] text-[#333] focus:outline-none focus:ring-1 focus:ring-[#B3541E] font-sans leading-relaxed"
              placeholder="1. Prazo de entrega: 20 dias úteis... 2. Impressão sob demanda..."
            />
          </div>

          {/* Banner de erro de rede amigável com preservação de dados e Tentar Novamente */}
          {networkErrorMsg && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-start sm:items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" />
                <span className="leading-snug">{networkErrorMsg}</span>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => submitQuote()}
                disabled={isSubmitting}
                className="bg-[#B3541E] hover:bg-[#9A4618] text-white self-start sm:self-auto h-7 px-3 text-xs flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                Tentar novamente
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#E5DFD6] text-[#8A8178] hover:bg-[#F7F5F2]"
            >
              Cancelar
            </Button>
            {networkErrorMsg ? (
              <Button
                type="button"
                onClick={() => submitQuote()}
                disabled={isSubmitting || !titulo.trim() || !selectedLeadId}
                className="bg-[#B3541E] hover:bg-[#9A4618] text-white flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                {isSubmitting ? 'Tentando novamente...' : 'Tentar novamente'}
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={isSubmitting || !titulo.trim() || !selectedLeadId}
                className="bg-[#B3541E] hover:bg-[#9A4618] text-white"
              >
                {isSubmitting ? 'Gerando...' : 'Criar Orçamento'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
