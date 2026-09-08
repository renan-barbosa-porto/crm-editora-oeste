import type { Quote, QuoteItem, GraficaTiragemRow, CompanySettings } from '@/types/crm'
import { DEFAULT_COMPANY_SETTINGS, getCompanyLogoUrl } from '@/services/settings'

export const CONDICOES_PADRAO_EDITORA_OESTE =
  DEFAULT_COMPANY_SETTINGS.texto_condicoes_padrao ||
  `1. Prazo de entrega: até 20 dias úteis após a aprovação final das fichas técnicas e prova digital (AF).
2. Modelo de publicação: livro disponível no portal da Editora Oeste em regime de impressão sob demanda (POD).
3. Lançamento e divulgação: eventos de lançamento e ações promocionais negociados à parte.
4. Condições de pagamento: PIX à vista com 5% de desconto, ou cartão de crédito em até 3x sem juros.
5. Frete e entrega: entrega CIF Campo Grande - MS (frete incluso para Campo Grande/MS; demais regiões sob consulta).`

export const ESPECIFICACOES_GRAFICAS_PADRAO = `Livro até 72 páginas, formato 155x225mm fechado.
Miolo: Impressão 1x1 (Preto & Branco) em papel Pólen/Avena 80g ou Offset 90g.
Costura: Costurado em cadernos para alta durabilidade.
Capa: Cartão Supremo 250g, impressão 4x0 (colorida frente), laminação fosca.
Acabamento: Lombada quadrada colada em Hotmelt.`

export const TIRAGENS_PADRAO: GraficaTiragemRow[] = [
  {
    tiragem: 1,
    descricao: '1 exemplar (sob demanda)',
    valor_unitario: 24.0,
    valor_total: 24.0,
  },
  {
    tiragem: 50,
    descricao: '50 exemplares',
    valor_unitario: 20.0,
    valor_total: 1000.0,
  },
  {
    tiragem: 100,
    descricao: '100 exemplares',
    valor_unitario: 18.0,
    valor_total: 1800.0,
  },
]

export function parseTiragens(quote: Quote): GraficaTiragemRow[] {
  if (Array.isArray(quote.grafica_tiragens)) {
    return quote.grafica_tiragens
  }
  if (typeof quote.grafica_tiragens === 'string' && quote.grafica_tiragens.trim()) {
    try {
      const parsed = JSON.parse(quote.grafica_tiragens)
      if (Array.isArray(parsed)) return parsed
    } catch {
      /* intentionally ignored */
    }
  }
  return TIRAGENS_PADRAO
}

export function formatCurrencyBRL(val: number): string {
  return (val || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

/**
 * Monta o documento HTML completo com o layout idêntico ao modelo da Editora Oeste
 * (ref. 26152 / Pra. Daiana), pronto para visualização e janela de impressão do navegador
 * (que gera o PDF limpo e vetorial via "Salvar como PDF").
 */
export function buildProposalPrintHTML(params: {
  quote: Quote
  items: QuoteItem[]
  tiragens: GraficaTiragemRow[]
  especificacoesGrafica: string
  condicoes: string
  descontoPercentual: number
  companySettings?: Partial<CompanySettings>
  incluiEditorial?: boolean
  numeroReferencia?: string
}): string {
  const {
    quote,
    items,
    tiragens,
    especificacoesGrafica,
    condicoes,
    descontoPercentual,
    companySettings,
    incluiEditorial: paramIncluiEditorial,
    numeroReferencia: paramNumeroReferencia,
  } = params

  const incluiEditorial =
    paramIncluiEditorial !== undefined ? paramIncluiEditorial : quote.inclui_editorial !== false

  const companyNome = companySettings?.nome_comercial || DEFAULT_COMPANY_SETTINGS.nome_comercial
  const companyRazao = companySettings?.razao_social || DEFAULT_COMPANY_SETTINGS.razao_social
  const companyCnpj = companySettings?.cnpj || DEFAULT_COMPANY_SETTINGS.cnpj
  const companyCidade = companySettings?.cidade_uf || DEFAULT_COMPANY_SETTINGS.cidade_uf
  const companyTelefone = companySettings?.telefone || DEFAULT_COMPANY_SETTINGS.telefone
  const companyPortal = companySettings?.portal || DEFAULT_COMPANY_SETTINGS.portal
  const companyValidadeDias =
    companySettings?.validade_proposta_dias ?? DEFAULT_COMPANY_SETTINGS.validade_proposta_dias ?? 15

  const logoUrl = getCompanyLogoUrl(companySettings)

  const clienteNome = quote.expand?.contact_id?.nome || quote.expand?.lead_id?.nome || 'Cliente'
  const clienteEmail = quote.expand?.contact_id?.email || quote.expand?.lead_id?.email || ''
  const clienteTelefone =
    quote.expand?.contact_id?.telefone || quote.expand?.lead_id?.telefone || ''
  const clienteEmpresa = quote.expand?.contact_id?.empresa || quote.expand?.lead_id?.empresa || ''

  // Número da proposta exatamente como digitado pelo usuário (sem fallback automático fixo se estiver vazio)
  const refDigitada =
    paramNumeroReferencia !== undefined
      ? paramNumeroReferencia.trim()
      : (quote.numero_referencia || quote.codigo || '').trim()

  const dataHoje = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const dataEnvioFmt = quote.data_envio
    ? new Date(quote.data_envio).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : dataHoje

  // Subtotal Parte 1 (Produção Editorial)
  const subtotalEditorial = items.reduce(
    (acc, it) => acc + (it.quantidade || 0) * (it.valor_unitario || 0),
    0,
  )
  const valorDesconto = (subtotalEditorial * (descontoPercentual || 0)) / 100
  const totalEditorialLiquido = Math.max(0, subtotalEditorial - valorDesconto)

  // Itens HTML da Parte 1
  const itemsRowsHtml =
    items.length > 0
      ? items
          .map(
            (it, idx) => `
        <tr style="border-bottom: 1px solid #E5E5E5;">
          <td style="padding: 7px 8px; font-size: 12px; color: #000000; vertical-align: top;">
            ${idx + 1}. ${escapeHtml(it.descricao)}
          </td>
          <td style="padding: 7px 8px; font-size: 12px; text-align: center; color: #000000; vertical-align: top; white-space: nowrap;">
            ${it.quantidade}
          </td>
          <td style="padding: 7px 8px; font-size: 12px; text-align: right; color: #000000; font-family: monospace; vertical-align: top; white-space: nowrap;">
            ${formatCurrencyBRL(it.valor_unitario)}
          </td>
          <td style="padding: 7px 8px; font-size: 12px; text-align: right; color: #000000; font-family: monospace; vertical-align: top; white-space: nowrap;">
            ${formatCurrencyBRL((it.quantidade || 0) * (it.valor_unitario || 0))}
          </td>
        </tr>`,
          )
          .join('')
      : `
        <tr>
          <td colspan="4" style="padding: 10px; text-align: center; color: #666666; font-size: 12px;">
            Nenhum item editorial especificado nesta proposta.
          </td>
        </tr>`

  // Tiragens HTML (Parte 2)
  const tiragensRowsHtml =
    tiragens.length > 0
      ? tiragens
          .map((row) => {
            const tot = row.valor_total || row.tiragem * row.valor_unitario
            return `
        <tr style="border-bottom: 1px solid #E5E5E5;">
          <td style="padding: 7px 8px; font-size: 12px; color: #000000;">
            ${row.tiragem} ${row.tiragem === 1 ? 'exemplar' : 'exemplares'}
            ${row.descricao && row.descricao !== `${row.tiragem} exemplares` ? `<span style="color: #555555; font-size: 11px;"> (${escapeHtml(row.descricao)})</span>` : ''}
          </td>
          <td style="padding: 7px 8px; font-size: 12px; text-align: right; color: #000000; font-family: monospace;">
            ${formatCurrencyBRL(row.valor_unitario)}/un
          </td>
          <td style="padding: 7px 8px; font-size: 12px; text-align: right; color: #000000; font-family: monospace;">
            ${formatCurrencyBRL(tot)}
          </td>
        </tr>`
          })
          .join('')
      : `
        <tr>
          <td colspan="3" style="padding: 10px; text-align: center; color: #666666; font-size: 12px;">
            Sob consulta conforme tiragem desejada.
          </td>
        </tr>`

  // Header da empresa:
  // RETIRAR o texto "Editora Oeste" do cabeçalho do PDF (ficou redundante com o logo).
  // Se tiver logo, mostra apenas o logo + dados fiscais sutis. Se não tiver logo, mostra apenas o nome comercial de forma discreta.
  const headerBrandHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" style="max-height: 52px; max-width: 190px; object-contain: contain; display: block; margin-bottom: 4px;" />`
    : `<div style="font-size: 18px; font-weight: 600; color: #000000; margin-bottom: 2px;">${escapeHtml(companyNome)}</div>`

  // Bloco Parte 1 HTML (Editorial) — opcional
  const parte1Html = incluiEditorial
    ? `
    <!-- PARTE 1 — PRODUÇÃO EDITORIAL -->
    <div class="section-title">
      Parte 1 — Produção Editorial
    </div>

    <table>
      <thead>
        <tr>
          <th style="text-align: left;">Item / Serviço Editorial</th>
          <th style="text-align: center; width: 60px;">Qtd</th>
          <th style="text-align: right; width: 110px;">Valor Unit.</th>
          <th style="text-align: right; width: 120px;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRowsHtml}
      </tbody>
    </table>

    <div class="subtotal-box">
      <div style="font-size: 12px; color: #000000;">
        Subtotal Produção Editorial: <span style="font-family: monospace;">${formatCurrencyBRL(subtotalEditorial)}</span>
      </div>
      ${
        valorDesconto > 0
          ? `
      <div style="font-size: 12px; color: #000000; margin-top: 2px;">
        Desconto (${descontoPercentual}%): <span style="font-family: monospace;">- ${formatCurrencyBRL(valorDesconto)}</span>
      </div>`
          : ''
      }
      <div style="font-size: 13px; color: #000000; margin-top: 3px; font-weight: 600;">
        Total Editorial: <span style="font-family: monospace;">${formatCurrencyBRL(totalEditorialLiquido)}</span>
      </div>
    </div>
`
    : ''

  const tituloParte2 = incluiEditorial ? 'Parte 2 — Produção Gráfica' : 'Produção Gráfica'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Proposta Comercial${refDigitada ? ` — ${escapeHtml(refDigitada)}` : ''} — ${escapeHtml(clienteNome)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 14mm 16mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #000000;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.45;
    }
    .page-container {
      max-width: 780px;
      margin: 0 auto;
      padding: 6px 14px;
    }
    .header-box {
      border-bottom: 1px solid #000000;
      padding-bottom: 12px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .brand-col {
      flex: 1;
    }
    .brand-sub {
      font-size: 11px;
      color: #222222;
      margin: 0;
      line-height: 1.35;
    }
    .proposal-meta {
      text-align: right;
      font-size: 11.5px;
      color: #000000;
      line-height: 1.4;
      white-space: nowrap;
    }
    .proposal-ref {
      font-size: 13px;
      font-weight: 600;
      color: #000000;
      margin-bottom: 3px;
    }
    .client-card {
      border: 1px solid #D0D0D0;
      border-radius: 4px;
      padding: 9px 12px;
      margin-bottom: 14px;
      background: #FAFAFA;
    }
    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: #000000;
      border-bottom: 1px solid #000000;
      padding-bottom: 4px;
      margin: 16px 0 8px 0;
      text-transform: none;
      letter-spacing: 0.2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    th {
      border-bottom: 1px solid #000000;
      padding: 6px 8px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      color: #000000;
      background: transparent;
    }
    .subtotal-box {
      border-top: 1px solid #D0D0D0;
      padding: 6px 4px;
      margin: 4px 0 12px 0;
      text-align: right;
    }
    .spec-label {
      font-size: 11px;
      font-weight: 600;
      color: #000000;
      margin: 8px 0 3px 0;
    }
    .spec-box {
      border: 1px solid #D0D0D0;
      border-radius: 3px;
      padding: 8px 10px;
      font-size: 11.5px;
      color: #000000;
      white-space: pre-line;
      line-height: 1.45;
      margin-bottom: 10px;
      background: #FAFAFA;
    }
    .conditions-box {
      border: 1px solid #D0D0D0;
      border-radius: 3px;
      padding: 8px 10px;
      font-size: 11px;
      color: #111111;
      white-space: pre-line;
      line-height: 1.45;
      margin-top: 8px;
      background: #FFFFFF;
    }
    .footer-note {
      margin-top: 18px;
      padding-top: 8px;
      border-top: 1px solid #E0E0E0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10.5px;
      color: #444444;
    }
    @media print {
      body {
        margin: 0;
      }
      .no-print {
        display: none !important;
      }
      .page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <div class="page-container">
    <!-- Cabeçalho sóbrio com logo e dados da empresa -->
    <div class="header-box">
      <div class="brand-col">
        ${headerBrandHtml}
        <p class="brand-sub">
          ${escapeHtml(companyRazao)}<br>
          ${companyCnpj ? `CNPJ: ${escapeHtml(companyCnpj)}` : ''}${companyCnpj && companyCidade ? ' • ' : ''}${companyCidade ? escapeHtml(companyCidade) : ''}<br>
          ${companyPortal ? `Portal: ${escapeHtml(companyPortal)}` : ''}${companyPortal && companyTelefone ? ' • ' : ''}${companyTelefone ? `WhatsApp: ${escapeHtml(companyTelefone)}` : ''}
        </p>
      </div>
      <div class="proposal-meta">
        ${refDigitada ? `<div class="proposal-ref">Nº Proposta: ${escapeHtml(refDigitada)}</div>` : ''}
        <div>Emissão: ${escapeHtml(dataEnvioFmt)}</div>
        <div>Projeto: ${escapeHtml(quote.titulo)}</div>
      </div>
    </div>

    <!-- Dados do Cliente -->
    <div class="client-card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
        <div>
          <div style="font-size: 10px; text-transform: uppercase; color: #555555; letter-spacing: 0.5px; margin-bottom: 2px;">
            Cliente / Contratante
          </div>
          <div style="font-size: 13px; font-weight: 600; color: #000000;">${escapeHtml(clienteNome)}</div>
          ${clienteEmpresa ? `<div style="font-size: 11px; color: #333333;">${escapeHtml(clienteEmpresa)}</div>` : ''}
        </div>
        <div style="font-size: 11.5px; color: #000000; text-align: right;">
          ${clienteTelefone ? `<div>WhatsApp: ${escapeHtml(clienteTelefone)}</div>` : ''}
          ${clienteEmail ? `<div>Email: ${escapeHtml(clienteEmail)}</div>` : ''}
        </div>
      </div>
    </div>

    <!-- PARTE 1 (Opcional) -->
    ${parte1Html}

    <!-- PARTE 2 — PRODUÇÃO GRÁFICA -->
    <div class="section-title">
      ${escapeHtml(tituloParte2)}
    </div>

    <div class="spec-label">Especificações Técnicas</div>
    <div class="spec-box">${escapeHtml(especificacoesGrafica)}</div>

    <div class="spec-label">Tabela de Produção por Tiragem</div>
    <table>
      <thead>
        <tr>
          <th style="text-align: left;">Tiragem Solicitada</th>
          <th style="text-align: right; width: 140px;">Preço Unitário</th>
          <th style="text-align: right; width: 150px;">Valor Total</th>
        </tr>
      </thead>
      <tbody>
        ${tiragensRowsHtml}
      </tbody>
    </table>

    <!-- CONDIÇÕES GERAIS -->
    <div class="section-title" style="margin-top: 14px;">
      Condições Gerais de Produção & Entrega
    </div>

    <div class="conditions-box">
      ${escapeHtml(condicoes)}
    </div>

    <div class="footer-note">
      <div>
        ${escapeHtml(companyNome)} — Proposta válida por ${companyValidadeDias} dias a contar da emissão.
      </div>
      <div>
        Documento gerado em ${escapeHtml(dataHoje)}.
      </div>
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      if (window.location.hash === '#print') {
        window.print();
      }
    });
  </script>
</body>
</html>`
}

function escapeHtml(str?: string): string {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Abre a janela de visualização/impressão do PDF com o layout da proposta.
 * O usuário pode salvar como PDF com máxima nitidez ou imprimir diretamente.
 */
export function openProposalPdfWindow(params: {
  quote: Quote
  items: QuoteItem[]
  tiragens: GraficaTiragemRow[]
  especificacoesGrafica: string
  condicoes: string
  descontoPercentual: number
  companySettings?: Partial<CompanySettings>
  incluiEditorial?: boolean
  numeroReferencia?: string
  autoPrint?: boolean
}) {
  const html = buildProposalPrintHTML(params)
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    if (params.autoPrint) {
      setTimeout(() => {
        try {
          printWindow.print()
        } catch {
          /* intentionally ignored */
        }
      }, 350)
    }
  } else {
    // Fallback se popup bloqueado: cria iframe temporário para imprimir
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
    const doc = iframe.contentWindow?.document
    if (doc) {
      doc.open()
      doc.write(html)
      doc.close()
      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => document.body.removeChild(iframe), 2000)
      }, 500)
    }
  }
}
