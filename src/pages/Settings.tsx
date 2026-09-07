import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useCompanySettings } from '@/contexts/SettingsContext'
import { gerarTextoCondicoes } from '@/services/settings'
import {
  Building2,
  FileText,
  Clock,
  CreditCard,
  Truck,
  Calendar,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Printer,
} from 'lucide-react'

export default function Settings() {
  const { settings, loading, saveSettings } = useCompanySettings()
  const { toast } = useToast()

  const [nomeComercial, setNomeComercial] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [cidadeUf, setCidadeUf] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [portal, setPortal] = useState('')

  const [prazoExecucaoDias, setPrazoExecucaoDias] = useState<number>(20)
  const [condicoesPagamento, setCondicoesPagamento] = useState('')
  const [condicoesEntrega, setCondicoesEntrega] = useState('')
  const [validadePropostaDias, setValidadePropostaDias] = useState<number>(15)
  const [textoCondicoesPadrao, setTextoCondicoesPadrao] = useState('')

  const [isSaving, setIsSaving] = useState(false)

  // Preenche o formulário quando as configurações forem carregadas
  useEffect(() => {
    if (settings) {
      setNomeComercial(settings.nome_comercial || '')
      setRazaoSocial(settings.razao_social || '')
      setCnpj(settings.cnpj || '')
      setCidadeUf(settings.cidade_uf || '')
      setTelefone(settings.telefone || '')
      setEmail(settings.email || '')
      setPortal(settings.portal || '')
      setPrazoExecucaoDias(settings.prazo_execucao_dias ?? 20)
      setCondicoesPagamento(settings.condicoes_pagamento || '')
      setCondicoesEntrega(settings.condicoes_entrega || '')
      setValidadePropostaDias(settings.validade_proposta_dias ?? 15)
      setTextoCondicoesPadrao(settings.texto_condicoes_padrao || '')
    }
  }, [settings])

  const handleGerarTextoCondicoesAutomatico = () => {
    const gerado = gerarTextoCondicoes({
      nome_comercial: nomeComercial,
      portal,
      prazo_execucao_dias: prazoExecucaoDias,
      condicoes_pagamento: condicoesPagamento,
      condicoes_entrega: condicoesEntrega,
    })
    setTextoCondicoesPadrao(gerado)
    toast({
      title: 'Texto das condições atualizado',
      description: 'O texto padrão foi gerado a partir dos campos acima. Lembre-se de salvar.',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!nomeComercial.trim()) {
      toast({
        title: 'Nome comercial é obrigatório',
        description: 'Informe o nome comercial da editora / gráfica.',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsSaving(true)
      await saveSettings({
        nome_comercial: nomeComercial.trim(),
        razao_social: razaoSocial.trim(),
        cnpj: cnpj.trim(),
        cidade_uf: cidadeUf.trim(),
        telefone: telefone.trim(),
        email: email.trim(),
        portal: portal.trim(),
        prazo_execucao_dias: Number(prazoExecucaoDias) || 0,
        condicoes_pagamento: condicoesPagamento.trim(),
        condicoes_entrega: condicoesEntrega.trim(),
        validade_proposta_dias: Number(validadePropostaDias) || 0,
        texto_condicoes_padrao: textoCondicoesPadrao.trim(),
      })

      toast({
        title: 'Configurações salvas com sucesso!',
        description:
          'Os dados foram atualizados no cabeçalho do PDF, propostas e mensagens de WhatsApp.',
      })
    } catch (error: any) {
      console.error('Erro ao salvar configurações:', error)
      toast({
        title: 'Erro ao salvar',
        description: error?.message || 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#B3541E] border-t-transparent" />
          <p className="text-sm font-serif text-[#8A8178]">Carregando configurações...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Banner de Cabeçalho */}
      <div className="bg-white p-6 rounded-lg border border-[#E5DFD6] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-[#1E1B16] flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-[#B3541E]" />
            <span>Configurações da Empresa</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#8A8178] mt-1">
            Personalize os dados cadastrais e as condições comerciais exibidas no cabeçalho, rodapé
            e nas propostas em PDF.
          </p>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSaving}
          className="bg-[#B3541E] hover:bg-[#9A4618] text-white flex items-center gap-1.5 h-9 self-start sm:self-auto"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Salvando...' : 'Salvar Alterações'}</span>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bloco 1: Dados Cadastrais da Empresa */}
        <Card className="bg-white border-[#E5DFD6] shadow-sm">
          <CardHeader className="p-4 sm:p-5 border-b border-[#E5DFD6] bg-[#FAF8F5]">
            <CardTitle className="font-serif text-base font-bold text-[#1E1B16] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#B3541E]" />
              <span>Identificação & Contato da Empresa</span>
            </CardTitle>
            <p className="text-xs text-[#8A8178] mt-0.5">
              Estes dados compõem o cabeçalho impresso das propostas comerciais e as mensagens
              oficiais.
            </p>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label
                  htmlFor="nomeComercial"
                  className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
                >
                  Nome Comercial / Marca *
                </Label>
                <Input
                  id="nomeComercial"
                  value={nomeComercial}
                  onChange={(e) => setNomeComercial(e.target.value)}
                  placeholder="Ex: Editora Oeste"
                  className="mt-1 text-xs sm:text-sm border-[#E5DFD6] focus-visible:ring-[#B3541E]"
                  required
                />
                <p className="text-[11px] text-[#8A8178] mt-1">
                  Exibido em destaque no topo da proposta e no subtítulo do painel.
                </p>
              </div>

              <div>
                <Label
                  htmlFor="razaoSocial"
                  className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
                >
                  Razão Social Completa
                </Label>
                <Input
                  id="razaoSocial"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Ex: Editora Oeste Comunicação & Gráfica Ltda."
                  className="mt-1 text-xs sm:text-sm border-[#E5DFD6] focus-visible:ring-[#B3541E]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label
                  htmlFor="cnpj"
                  className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
                >
                  CNPJ
                </Label>
                <Input
                  id="cnpj"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="Ex: 14.882.910/0001-35"
                  className="mt-1 text-xs sm:text-sm border-[#E5DFD6] focus-visible:ring-[#B3541E] font-mono"
                />
              </div>

              <div>
                <Label
                  htmlFor="cidadeUf"
                  className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
                >
                  Cidade / UF
                </Label>
                <Input
                  id="cidadeUf"
                  value={cidadeUf}
                  onChange={(e) => setCidadeUf(e.target.value)}
                  placeholder="Ex: Campo Grande - MS"
                  className="mt-1 text-xs sm:text-sm border-[#E5DFD6] focus-visible:ring-[#B3541E]"
                />
              </div>

              <div>
                <Label
                  htmlFor="telefone"
                  className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
                >
                  Telefone / WhatsApp Comercial
                </Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="Ex: (67) 99843-2210"
                  className="mt-1 text-xs sm:text-sm border-[#E5DFD6] focus-visible:ring-[#B3541E]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label
                  htmlFor="email"
                  className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
                >
                  E-mail de Contato
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: contato@editoraoeste.com.br"
                  className="mt-1 text-xs sm:text-sm border-[#E5DFD6] focus-visible:ring-[#B3541E]"
                />
              </div>

              <div>
                <Label
                  htmlFor="portal"
                  className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]"
                >
                  Portal / Site da Editora
                </Label>
                <Input
                  id="portal"
                  value={portal}
                  onChange={(e) => setPortal(e.target.value)}
                  placeholder="Ex: editoraoeste.com.br"
                  className="mt-1 text-xs sm:text-sm border-[#E5DFD6] focus-visible:ring-[#B3541E]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bloco 2: Condições Comerciais da Proposta */}
        <Card className="bg-white border-[#E5DFD6] shadow-sm">
          <CardHeader className="p-4 sm:p-5 border-b border-[#E5DFD6] bg-[#FAF8F5]">
            <CardTitle className="font-serif text-base font-bold text-[#1E1B16] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#B3541E]" />
              <span>Condições Comerciais & Prazos da Proposta</span>
            </CardTitle>
            <p className="text-xs text-[#8A8178] mt-0.5">
              Valores pré-configurados que alimentam novas propostas e o rodapé contratual do PDF.
            </p>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label
                  htmlFor="prazoExecucaoDias"
                  className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16] flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-[#B3541E]" />
                  <span>Prazo de Execução (dias úteis)</span>
                </Label>
                <Input
                  id="prazoExecucaoDias"
                  type="number"
                  min="1"
                  value={prazoExecucaoDias}
                  onChange={(e) => setPrazoExecucaoDias(Math.max(1, parseInt(e.target.value) || 1))}
                  className="mt-1 text-xs sm:text-sm border-[#E5DFD6] focus-visible:ring-[#B3541E]"
                />
                <p className="text-[11px] text-[#8A8178] mt-1">
                  Ex: 20 dias após aprovação da prova final (AF).
                </p>
              </div>

              <div>
                <Label
                  htmlFor="validadePropostaDias"
                  className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16] flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#B3541E]" />
                  <span>Validade da Proposta (dias)</span>
                </Label>
                <Input
                  id="validadePropostaDias"
                  type="number"
                  min="1"
                  value={validadePropostaDias}
                  onChange={(e) =>
                    setValidadePropostaDias(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="mt-1 text-xs sm:text-sm border-[#E5DFD6] focus-visible:ring-[#B3541E]"
                />
                <p className="text-[11px] text-[#8A8178] mt-1">
                  Exibido na nota de rodapé do documento.
                </p>
              </div>

              <div className="sm:col-span-2">
                <Label
                  htmlFor="condicoesPagamento"
                  className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16] flex items-center gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5 text-[#B3541E]" />
                  <span>Formas de Pagamento</span>
                </Label>
                <Input
                  id="condicoesPagamento"
                  value={condicoesPagamento}
                  onChange={(e) => setCondicoesPagamento(e.target.value)}
                  placeholder="Ex: PIX à vista com 5% de desconto, ou cartão de crédito em até 3x sem juros"
                  className="mt-1 text-xs sm:text-sm border-[#E5DFD6] focus-visible:ring-[#B3541E]"
                />
              </div>
            </div>

            <div>
              <Label
                htmlFor="condicoesEntrega"
                className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16] flex items-center gap-1.5"
              >
                <Truck className="w-3.5 h-3.5 text-[#B3541E]" />
                <span>Frete & Entrega</span>
              </Label>
              <Input
                id="condicoesEntrega"
                value={condicoesEntrega}
                onChange={(e) => setCondicoesEntrega(e.target.value)}
                placeholder="Ex: CIF Campo Grande - MS (frete incluso para Campo Grande/MS; demais regiões sob consulta)"
                className="mt-1 text-xs sm:text-sm border-[#E5DFD6] focus-visible:ring-[#B3541E]"
              />
            </div>

            {/* Texto Completo das Condições Gerais do Rodapé */}
            <div className="pt-2 border-t border-[#E5DFD6] space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <Label
                    htmlFor="textoCondicoesPadrao"
                    className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16] flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#B3541E]" />
                    <span>Texto Completo das Condições Gerais (Padrão para novos orçamentos)</span>
                  </Label>
                  <p className="text-[11px] text-[#8A8178] mt-0.5">
                    Este bloco é inserido automaticamente em novas propostas e renderizado na seção
                    "Condições Gerais" do PDF.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGerarTextoCondicoesAutomatico}
                  className="h-8 text-xs border-[#E5DFD6] text-[#B3541E] hover:bg-[#FAF8F5] flex items-center gap-1 self-start sm:self-auto"
                  title="Regera o texto das condições combinando os campos acima"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Regerar Texto com Valores Acima</span>
                </Button>
              </div>

              <textarea
                id="textoCondicoesPadrao"
                value={textoCondicoesPadrao}
                onChange={(e) => setTextoCondicoesPadrao(e.target.value)}
                rows={6}
                className="w-full p-3 text-xs border border-[#E5DFD6] rounded bg-[#FAF8F5] text-[#1E1B16] focus:outline-none focus:ring-1 focus:ring-[#B3541E] font-mono leading-relaxed"
                placeholder="1. Prazo de entrega... 2. Modelo de publicação..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Pré-visualização do Rodapé / Cabeçalho */}
        <Card className="bg-[#FAF8F5] border-[#E5DFD6]">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#8A8178]">
              <Printer className="w-4 h-4 text-[#B3541E]" />
              <span>Prévia do Cabeçalho & Rodapé da Proposta</span>
            </div>

            <div className="bg-white p-4 rounded border border-[#E5DFD6] space-y-3">
              {/* Cabeçalho */}
              <div className="border-b-2 border-[#B3541E] pb-3 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                <div>
                  <h3 className="font-serif text-lg font-bold text-[#B3541E]">
                    {nomeComercial || 'Editora Oeste'}
                  </h3>
                  <div className="text-[#666] text-xs leading-relaxed mt-0.5">
                    <strong>{razaoSocial || 'Editora Oeste Comunicação & Gráfica Ltda.'}</strong>
                    <br />
                    CNPJ: {cnpj || '14.882.910/0001-35'} • {cidadeUf || 'Campo Grande - MS'}
                    <br />
                    {portal ? `Portal: ${portal}` : ''} {portal && telefone ? '•' : ''}{' '}
                    {telefone ? `WhatsApp: ${telefone}` : ''}
                    {email ? ` • E-mail: ${email}` : ''}
                  </div>
                </div>

                <div className="text-left sm:text-right text-[#4A4238] space-y-0.5">
                  <span className="font-mono text-xs px-2 py-0.5 bg-[#FAF3EC] border border-[#E5DFD6] rounded font-bold text-[#B3541E] inline-block">
                    REF. PROPOSTA: ORC-26152
                  </span>
                  <div className="text-[11px] text-[#8A8178]">Proposta Comercial Oficial</div>
                </div>
              </div>

              {/* Rodapé */}
              <div className="pt-2 text-[11px] text-[#8A8178] border-t border-[#E5DFD6] flex flex-col sm:flex-row justify-between gap-1">
                <div>
                  <strong>{nomeComercial || 'Editora Oeste'}</strong> — Proposta válida por{' '}
                  {validadePropostaDias || 15} dias a contar da data de emissão.
                </div>
                <div>Documento gerado eletronicamente.</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botão Salvar no fim da página */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-[#B3541E] hover:bg-[#9A4618] text-white px-6 h-10 shadow-sm flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSaving ? 'Salvando...' : 'Salvar Configurações da Empresa'}</span>
          </Button>
        </div>
      </form>
    </div>
  )
}
