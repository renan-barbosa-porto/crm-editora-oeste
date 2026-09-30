import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Printer, Download, MessageCircle, Info } from 'lucide-react'
import type { Quote, QuoteItem, GraficaTiragemRow, CompanySettings } from '@/types/crm'
import { openProposalPdfWindow, formatCurrencyBRL } from '@/lib/pdf-generator'
import { formatWhatsAppUrl } from '@/lib/quote-utils'
import { useCompanySettings } from '@/contexts/SettingsContext'

interface ProposalPdfModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  quote: Quote
  items: QuoteItem[]
  tiragens: GraficaTiragemRow[]
  especificacoesGrafica: string
  condicoes: string
  descontoPercentual: number
  companySettings?: CompanySettings
  incluiEditorial?: boolean
  numeroReferencia?: string
  onPdfGenerated?: () => void
}

export function ProposalPdfModal({
  open,
  onOpenChange,
  quote,
  items,
  tiragens,
  especificacoesGrafica,
  condicoes,
  descontoPercentual,
  companySettings: customCompanySettings,
  incluiEditorial: propIncluiEditorial,
  numeroReferencia: propNumeroReferencia,
  onPdfGenerated,
}: ProposalPdfModalProps) {
  const { settings: globalCompanySettings } = useCompanySettings()
  const companySettings = customCompanySettings || globalCompanySettings

  const incluiEditorial =
    propIncluiEditorial !== undefined ? propIncluiEditorial : quote.inclui_editorial !== false

  const numeroReferencia =
    propNumeroReferencia !== undefined
      ? propNumeroReferencia
      : quote.numero_referencia || quote.codigo || ''

  const [activeTab, setActiveTab] = useState<'preview' | 'whatsapp'>('preview')

  // Precedência: quando a proposta tem lead_id, o cliente contratante principal é o LEAD (instituição)
  const leadNome = quote.expand?.lead_id?.nome?.trim()
  const contactNome = quote.expand?.contact_id?.nome?.trim()
  const clienteNome = leadNome || contactNome || 'Cliente'
  const contatoPessoa = leadNome && contactNome && leadNome !== contactNome ? contactNome : ''

  const clienteEmpresa = quote.expand?.lead_id?.empresa || quote.expand?.contact_id?.empresa || ''
  const email = quote.expand?.lead_id?.email || quote.expand?.contact_id?.email || ''
  const telefone = quote.expand?.lead_id?.telefone || quote.expand?.contact_id?.telefone || ''

  const companyNome = companySettings?.nome_comercial || 'Editora Oeste'
  const companyRazao = companySettings?.razao_social || 'Editora Oeste Comunicação & Gráfica Ltda.'
  const companyCnpj = companySettings?.cnpj || '14.882.910/0001-35'
  const companyCidade = companySettings?.cidade_uf || 'Campo Grande - MS'
  const companyTelefone = companySettings?.telefone || '(67) 99843-2210'
  const companyPortal = companySettings?.portal || 'editoraoeste.com.br'

  const handlePrintOrSavePdf = () => {
    openProposalPdfWindow({
      quote,
      items,
      tiragens,
      especificacoesGrafica,
      condicoes,
      descontoPercentual,
      companySettings,
      incluiEditorial,
      numeroReferencia,
      autoPrint: true,
    })
    if (onPdfGenerated) {
      onPdfGenerated()
    }
  }

  const handleOpenPdfNewTab = () => {
    openProposalPdfWindow({
      quote,
      items,
      tiragens,
      especificacoesGrafica,
      condicoes,
      descontoPercentual,
      companySettings,
      incluiEditorial,
      numeroReferencia,
      autoPrint: false,
    })
    if (onPdfGenerated) {
      onPdfGenerated()
    }
  }

  // Mensagem WhatsApp para envio orientando sobre o anexo em PDF
  const waMsg = `Olá ${clienteNome}! Segue anexa a nossa proposta comercial da ${companyNome} referente a "${quote.titulo}"${numeroReferencia ? ` (Ref. ${numeroReferencia})` : ''}. Qualquer dúvida estou à total disposição!`
  const waUrl = telefone ? formatWhatsAppUrl(telefone, waMsg) : ''

  const subtotalEditorial = items.reduce(
    (acc, it) => acc + (it.quantidade || 0) * (it.valor_unitario || 0),
    0,
  )
  const descValor = (subtotalEditorial * (descontoPercentual || 0)) / 100
  const totalEditorialLiquido = Math.max(0, subtotalEditorial - descValor)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white border-[#E5DFD6]">
        <DialogHeader className="p-4 sm:p-5 border-b border-[#E5DFD6] bg-[#FAF8F5]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="font-serif text-lg font-bold text-[#1E1B16] flex items-center gap-2">
                <span>Proposta Comercial em PDF — {companyNome}</span>
                {numeroReferencia ? (
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-white border border-[#E5DFD6] text-[#1E1B16]">
                    Nº {numeroReferencia}
                  </span>
                ) : null}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#8A8178] mt-0.5">
                Layout sóbrio e limpo com produção gráfica, condições de entrega
                {incluiEditorial ? ' e produção editorial' : ''}.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenPdfNewTab}
                className="h-8 text-xs border-[#E5DFD6] text-[#4A4238] hover:bg-white"
              >
                Abrir em Nova Aba
              </Button>
              <Button
                size="sm"
                onClick={handlePrintOrSavePdf}
                className="h-8 text-xs bg-[#B3541E] hover:bg-[#9A4618] text-white flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Salvar PDF / Imprimir
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Abas: Visualizar Proposta vs Enviar por WhatsApp */}
        <div className="p-4 border-b border-[#E5DFD6] bg-white flex items-center justify-between gap-2 flex-wrap">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'preview' | 'whatsapp')}>
            <TabsList className="bg-[#FAF8F5] border border-[#E5DFD6] h-8 p-0.5">
              <TabsTrigger
                value="preview"
                className="text-xs data-[state=active]:bg-white data-[state=active]:text-[#B3541E] h-7"
              >
                Visualização do Layout
              </TabsTrigger>
              <TabsTrigger
                value="whatsapp"
                className="text-xs data-[state=active]:bg-white data-[state=active]:text-[#2F7D4F] h-7 flex items-center gap-1.5"
              >
                <MessageCircle className="w-3 h-3 text-[#2F7D4F]" />
                Enviar por WhatsApp
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="text-xs text-[#8A8178]">
            Cliente: <strong className="text-[#1E1B16]">{clienteNome}</strong>
            {telefone && <span className="ml-2 font-mono text-xs">({telefone})</span>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F4F1EA]">
          {activeTab === 'preview' ? (
            /* Container da Proposta no Estilo Papel (Layout Sóbrio e Limpo) */
            <div className="max-w-[760px] mx-auto bg-white p-6 sm:p-8 rounded-lg shadow-sm border border-[#E5DFD6] space-y-4 text-xs sm:text-sm">
              {/* Header Empresa */}
              <div className="border-b border-[#1E1B16] pb-3 flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex items-start gap-3">
                  {companySettings?.logo ? (
                    <img
                      src={
                        companySettings.logo.startsWith('http') ||
                        companySettings.logo.startsWith('data:')
                          ? companySettings.logo
                          : `https://crm-editora-e-grafica-5e899.shrd00.internal.goskip.dev/api/files/company_settings/${companySettings.id || ''}/${companySettings.logo}`
                      }
                      alt="Logo"
                      className="max-h-12 max-w-[150px] object-contain"
                    />
                  ) : (
                    <div className="font-serif text-lg font-bold text-[#1E1B16]">{companyNome}</div>
                  )}
                  <p className="text-xs text-[#333] leading-relaxed border-l border-[#E5DFD6] pl-3">
                    {companyRazao}
                    <br />
                    {companyCnpj ? `CNPJ: ${companyCnpj}` : ''}
                    {companyCnpj && companyCidade ? ' • ' : ''}
                    {companyCidade}
                  </p>
                </div>
                <div className="text-left sm:text-right text-xs text-[#1E1B16] space-y-0.5">
                  {numeroReferencia ? (
                    <div className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#E5DFD6] inline-block">
                      Nº {numeroReferencia}
                    </div>
                  ) : null}
                  <div>
                    Emissão:{' '}
                    {quote.data_envio
                      ? new Date(quote.data_envio).toLocaleDateString('pt-BR')
                      : new Date().toLocaleDateString('pt-BR')}
                  </div>
                  <div className="line-clamp-1 max-w-[220px]">Projeto: {quote.titulo}</div>
                </div>
              </div>

              {/* Box Cliente */}
              <div className="bg-[#FAFAFA] border border-[#E5DFD6] p-3 rounded flex flex-col sm:flex-row justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase text-[#666]">Cliente / Contratante</span>
                  <div className="font-semibold text-sm text-[#1E1B16]">{clienteNome}</div>
                  {contatoPessoa && (
                    <div className="text-xs text-[#333] mt-0.5">
                      <span className="text-[#888]">A/C:</span> {contatoPessoa}
                    </div>
                  )}
                  {clienteEmpresa && (
                    <div className="text-xs text-[#333] mt-0.5">{clienteEmpresa}</div>
                  )}
                </div>
                <div className="text-xs text-[#333] sm:text-right">
                  {telefone && <div>WhatsApp: {telefone}</div>}
                  {email && <div>Email: {email}</div>}
                </div>
              </div>

              {/* Parte 1 — Produção Editorial (Opcional) */}
              {incluiEditorial && (
                <div>
                  <div className="font-medium text-sm text-[#1E1B16] border-b border-[#1E1B16] pb-1 flex items-center justify-between mb-2">
                    <span>Parte 1 — Produção Editorial</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#1E1B16] text-[#1E1B16] font-semibold text-[11px] uppercase">
                        <tr>
                          <th className="py-1.5 px-2">Item / Serviço Editorial</th>
                          <th className="py-1.5 px-2 text-center w-12">Qtd</th>
                          <th className="py-1.5 px-2 text-right w-24">Valor Unit.</th>
                          <th className="py-1.5 px-2 text-right w-24">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5DFD6]">
                        {items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="py-1.5 px-2 text-[#1E1B16]">
                              {idx + 1}. {it.descricao}
                            </td>
                            <td className="py-1.5 px-2 text-center text-[#1E1B16]">
                              {it.quantidade}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-[#1E1B16]">
                              {formatCurrencyBRL(it.valor_unitario)}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-[#1E1B16]">
                              {formatCurrencyBRL((it.quantidade || 0) * (it.valor_unitario || 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-[#E5DFD6] pt-1.5 text-right space-y-0.5">
                    <div className="text-xs text-[#333]">
                      Subtotal Editorial:{' '}
                      <span className="font-mono">{formatCurrencyBRL(subtotalEditorial)}</span>
                    </div>
                    {descValor > 0 && (
                      <div className="text-xs text-[#333]">
                        Desconto ({descontoPercentual}%): -
                        <span className="font-mono">{formatCurrencyBRL(descValor)}</span>
                      </div>
                    )}
                    <div className="text-xs font-semibold text-[#1E1B16]">
                      Total Editorial:{' '}
                      <span className="font-mono">{formatCurrencyBRL(totalEditorialLiquido)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Parte 2 — Produção Gráfica */}
              <div>
                <div className="font-medium text-sm text-[#1E1B16] border-b border-[#1E1B16] pb-1 flex items-center justify-between mb-2">
                  <span>{incluiEditorial ? 'Parte 2 — Produção Gráfica' : 'Produção Gráfica'}</span>
                </div>

                <div className="text-[11px] font-semibold uppercase text-[#666] mb-1">
                  Especificações Técnicas
                </div>
                <div className="bg-[#FAFAFA] border border-[#E5DFD6] p-2.5 rounded text-xs leading-relaxed whitespace-pre-line text-[#1E1B16] mb-3">
                  {especificacoesGrafica}
                </div>

                <div className="text-[11px] font-semibold uppercase text-[#666] mb-1">
                  Tabela de Produção por Tiragem
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#1E1B16] text-[#1E1B16] font-semibold text-[11px] uppercase">
                      <tr>
                        <th className="py-1.5 px-2">Tiragem Solicitada</th>
                        <th className="py-1.5 px-2 text-right">Preço Unitário</th>
                        <th className="py-1.5 px-2 text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5DFD6]">
                      {tiragens.map((row, i) => {
                        const rowTot = row.valor_total || row.tiragem * row.valor_unitario
                        return (
                          <tr key={i}>
                            <td className="py-1.5 px-2 text-[#1E1B16]">
                              {row.tiragem} {row.tiragem === 1 ? 'exemplar' : 'exemplares'}
                              {row.descricao && row.descricao !== `${row.tiragem} exemplares` && (
                                <span className="text-[#555] text-xs"> ({row.descricao})</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-[#1E1B16]">
                              {formatCurrencyBRL(row.valor_unitario)}/un
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono text-[#1E1B16]">
                              {formatCurrencyBRL(rowTot)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Condições Gerais */}
              <div>
                <div className="font-medium text-sm text-[#1E1B16] border-b border-[#1E1B16] pb-1 mb-2">
                  <span>Condições Gerais de Produção & Entrega</span>
                </div>
                <div className="border border-[#E5DFD6] p-2.5 rounded text-xs leading-relaxed whitespace-pre-line text-[#333] bg-white">
                  {condicoes}
                </div>
              </div>
            </div>
          ) : (
            /* Guia de Envio via WhatsApp com Orientação de Anexo */
            <div className="max-w-[620px] mx-auto bg-white p-6 rounded-lg border border-[#E5DFD6] shadow-sm space-y-4">
              <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#E1F2E8] border border-[#C5E6D2]">
                <MessageCircle className="w-5 h-5 text-[#2F7D4F] flex-shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-[#1E1B16] space-y-1">
                  <p className="font-semibold text-[#2F7D4F]">
                    Como funciona o envio da proposta por WhatsApp:
                  </p>
                  <p className="text-[#333] leading-relaxed">
                    1. Clique no botão <strong>"Baixar / Salvar PDF"</strong> para gerar o arquivo
                    em seu dispositivo.
                  </p>
                  <p className="text-[#333] leading-relaxed">
                    2. Em seguida clique em <strong>"Abrir Conversa no WhatsApp"</strong> para
                    iniciar o contato com o cliente com a mensagem pré-formatada.
                  </p>
                  <p className="text-[#333] leading-relaxed font-semibold">
                    3. ⚠ O anexo do PDF é feito diretamente dentro do próprio WhatsApp através do
                    ícone de clipe/anexo.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#1E1B16]">
                  Mensagem que será enviada:
                </label>
                <div className="p-3 bg-[#FAF8F5] border border-[#E5DFD6] rounded text-xs text-[#333] whitespace-pre-wrap font-sans leading-relaxed">
                  {waMsg}
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintOrSavePdf}
                  className="h-9 border-[#E5DFD6] text-[#B3541E] hover:bg-[#FAF8F5]"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  1º Baixar / Salvar PDF
                </Button>

                {waUrl ? (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-md bg-[#2F7D4F] text-white hover:bg-[#25633e] transition-colors h-9"
                  >
                    <MessageCircle className="w-4 h-4" />
                    2º Abrir Conversa no WhatsApp
                  </a>
                ) : (
                  <Button disabled size="sm" className="h-9 text-xs">
                    Cliente sem telefone cadastrado
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="p-3.5 border-t border-[#E5DFD6] bg-[#FAF8F5] flex items-center justify-between text-xs text-[#8A8178]">
          <span className="flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-[#B3541E]" />
            Layout oficial de proposta comercial ({companyNome})
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 text-xs text-[#8A8178] hover:text-[#1E1B16]"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
