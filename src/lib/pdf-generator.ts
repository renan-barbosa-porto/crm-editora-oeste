import type { Quote, QuoteItem, GraficaTiragemRow } from '@/types/crm'

export const CONDICOES_PADRAO_EDITORA_OESTE = `1. Prazo de entrega: até 20 dias úteis após a aprovação final das fichas técnicas e prova digital (AF).
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
}): string {
  const { quote, items, tiragens, especificacoesGrafica, condicoes, descontoPercentual } = params

  const clienteNome = quote.expand?.contact_id?.nome || quote.expand?.lead_id?.nome || 'Cliente'
  const clienteEmail = quote.expand?.contact_id?.email || quote.expand?.lead_id?.email || ''
  const clienteTelefone =
    quote.expand?.contact_id?.telefone || quote.expand?.lead_id?.telefone || ''
  const clienteEmpresa = quote.expand?.contact_id?.empresa || quote.expand?.lead_id?.empresa || ''

  const codigo = quote.codigo || 'ORC-26152'
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

  // Itens HTML
  const itemsRowsHtml =
    items.length > 0
      ? items
          .map(
            (it, idx) => `
        <tr style="border-bottom: 1px solid #E5DFD6;">
          <td style="padding: 10px 12px; font-size: 13px; color: #1E1B16; vertical-align: top;">
            <div style="font-weight: 600; line-height: 1.4;">${idx + 1}. ${escapeHtml(it.descricao)}</div>
          </td>
          <td style="padding: 10px 12px; font-size: 13px; text-align: center; color: #4A4238; vertical-align: top; white-space: nowrap;">
            ${it.quantidade}
          </td>
          <td style="padding: 10px 12px; font-size: 13px; text-align: right; color: #1E1B16; font-weight: 600; font-family: monospace; vertical-align: top; white-space: nowrap;">
            ${formatCurrencyBRL(it.valor_unitario)}
          </td>
          <td style="padding: 10px 12px; font-size: 13px; text-align: right; color: #B3541E; font-weight: 700; font-family: monospace; vertical-align: top; white-space: nowrap;">
            ${formatCurrencyBRL((it.quantidade || 0) * (it.valor_unitario || 0))}
          </td>
        </tr>`,
          )
          .join('')
      : `
        <tr>
          <td colspan="4" style="padding: 14px; text-align: center; color: #8A8178; font-size: 13px;">
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
        <tr style="border-bottom: 1px solid #E5DFD6;">
          <td style="padding: 8px 12px; font-size: 13px; color: #1E1B16; font-weight: 600;">
            ${row.tiragem} ${row.tiragem === 1 ? 'exemplar' : 'exemplares'}
            ${row.descricao && row.descricao !== `${row.tiragem} exemplares` ? `<span style="font-weight: normal; color: #666; font-size: 12px;"> (${escapeHtml(row.descricao)})</span>` : ''}
          </td>
          <td style="padding: 8px 12px; font-size: 13px; text-align: right; color: #4A4238; font-family: monospace;">
            ${formatCurrencyBRL(row.valor_unitario)}/un
          </td>
          <td style="padding: 8px 12px; font-size: 13px; text-align: right; color: #1E1B16; font-weight: 700; font-family: monospace;">
            ${formatCurrencyBRL(tot)}
          </td>
        </tr>`
          })
          .join('')
      : `
        <tr>
          <td colspan="3" style="padding: 12px; text-align: center; color: #8A8178; font-size: 13px;">
            Sob consulta conforme tiragem desejada.
          </td>
        </tr>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Proposta Comercial — ${escapeHtml(codigo)} — ${escapeHtml(clienteNome)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 18mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1E1B16;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.5;
    }
    .page-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 10px 20px;
    }
    .header-box {
      border-bottom: 2px solid #B3541E;
      padding-bottom: 14px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    .brand-title {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 24px;
      font-weight: bold;
      color: #B3541E;
      letter-spacing: -0.5px;
      margin: 0 0 4px 0;
    }
    .brand-sub {
      font-size: 12px;
      color: #666;
      margin: 0;
      line-height: 1.4;
    }
    .proposal-meta {
      text-align: right;
      font-size: 12px;
      color: #4A4238;
    }
    .proposal-ref {
      display: inline-block;
      font-family: monospace;
      font-size: 14px;
      font-weight: 700;
      color: #B3541E;
      background: #FAF3EC;
      padding: 4px 10px;
      border-radius: 4px;
      border: 1px solid #E5DFD6;
      margin-bottom: 4px;
    }
    .client-card {
      background: #FAF8F5;
      border: 1px solid #E5DFD6;
      border-left: 4px solid #B3541E;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 18px;
    }
    .section-title {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 15px;
      font-weight: bold;
      color: #1E1B16;
      border-bottom: 1px solid #E5DFD6;
      padding-bottom: 6px;
      margin: 18px 0 10px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-badge {
      background: #B3541E;
      color: white;
      font-size: 10px;
      font-weight: bold;
      padding: 2px 7px;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    th {
      background: #FAF8F5;
      border-bottom: 2px solid #E5DFD6;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #666;
    }
    .subtotal-box {
      background: #FAF8F5;
      border: 1px solid #E5DFD6;
      border-radius: 6px;
      padding: 10px 16px;
      margin: 8px 0 16px 0;
      text-align: right;
    }
    .spec-box {
      background: #FAF8F5;
      border: 1px solid #E5DFD6;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 12px;
      color: #333;
      white-space: pre-line;
      line-height: 1.55;
      margin-bottom: 12px;
    }
    .conditions-box {
      background: #FFFFFF;
      border: 1px dashed #D5CDC4;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 11.5px;
      color: #4A4238;
      white-space: pre-line;
      line-height: 1.6;
      margin-top: 14px;
    }
    .footer-note {
      margin-top: 22px;
      padding-top: 12px;
      border-top: 1px solid #E5DFD6;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #8A8178;
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
    <!-- Cabeçalho com dados da empresa (Editora Oeste) e referência da proposta -->
    <div class="header-box">
      <div>
        <h1 class="brand-title">Editora Oeste</h1>
        <p class="brand-sub">
          <strong>Editora Oeste Comunicação & Gráfica Ltda.</strong><br>
          CNPJ: 14.882.910/0001-35 • Campo Grande - MS<br>
          Portal: editoraoeste.com.br • WhatsApp: (67) 99843-2210
        </p>
      </div>
      <div class="proposal-meta">
        <div class="proposal-ref">REF. PROPOSTA: ${escapeHtml(codigo)}</div>
        <div><strong>Data de Emissão:</strong> ${escapeHtml(dataEnvioFmt)}</div>
        <div><strong>Projeto:</strong> ${escapeHtml(quote.titulo)}</div>
      </div>
    </div>

    <!-- Dados do Cliente -->
    <div class="client-card">
      <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #8A8178; letter-spacing: 0.5px; margin-bottom: 4px;">
        Cliente / Contratante
      </div>
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
        <div>
          <div style="font-size: 15px; font-weight: bold; color: #1E1B16;">${escapeHtml(clienteNome)}</div>
          ${clienteEmpresa ? `<div style="font-size: 12px; color: #4A4238;">${escapeHtml(clienteEmpresa)}</div>` : ''}
        </div>
        <div style="font-size: 12px; color: #4A4238; text-align: right;">
          ${clienteTelefone ? `<div><strong>WhatsApp:</strong> ${escapeHtml(clienteTelefone)}</div>` : ''}
          ${clienteEmail ? `<div><strong>Email:</strong> ${escapeHtml(clienteEmail)}</div>` : ''}
        </div>
      </div>
    </div>

    <!-- PARTE 1 — PRODUÇÃO EDITORIAL -->
    <div class="section-title">
      <span class="section-badge">Parte 1</span>
      <span>Produção Editorial</span>
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
      <div style="font-size: 12px; color: #666;">
        Subtotal Produção Editorial: <strong style="font-family: monospace; color: #1E1B16;">${formatCurrencyBRL(subtotalEditorial)}</strong>
      </div>
      ${
        valorDesconto > 0
          ? `
      <div style="font-size: 12px; color: #B3261E; margin-top: 2px;">
        Desconto Comercial (${descontoPercentual}%): <strong style="font-family: monospace;">- ${formatCurrencyBRL(valorDesconto)}</strong>
      </div>`
          : ''
      }
      <div style="font-size: 15px; font-weight: bold; color: #B3541E; margin-top: 4px; font-family: Georgia, serif;">
        Total Parcial Editorial: <span style="font-family: monospace;">${formatCurrencyBRL(totalEditorialLiquido)}</span>
      </div>
    </div>

    <!-- PARTE 2 — PRODUÇÃO GRÁFICA (Impressão do Livro) -->
    <div class="section-title" style="margin-top: 24px;">
      <span class="section-badge">Parte 2</span>
      <span>Produção Gráfica (Impressão do Livro)</span>
    </div>

    <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #8A8178; letter-spacing: 0.5px; margin-bottom: 4px;">
      Especificações Técnicas
    </div>
    <div class="spec-box">${escapeHtml(especificacoesGrafica)}</div>

    <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #8A8178; letter-spacing: 0.5px; margin-bottom: 4px;">
      Tabela de Impressão por Tiragem (Flexível sob demanda)
    </div>
    <table>
      <thead>
        <tr>
          <th style="text-align: left;">Tiragem Solicitada</th>
          <th style="text-align: right; width: 140px;">Preço Unitário</th>
          <th style="text-align: right; width: 150px;">Valor Total do Lote</th>
        </tr>
      </thead>
      <tbody>
        ${tiragensRowsHtml}
      </tbody>
    </table>

    <!-- CONDIÇÕES GERAIS E RODAPÉ -->
    <div class="section-title" style="margin-top: 20px;">
      <span class="section-badge" style="background: #4A4238;">Condições</span>
      <span>Condições Gerais de Produção & Entrega</span>
    </div>

    <div class="conditions-box">
      ${escapeHtml(condicoes)}
    </div>

    <div class="footer-note">
      <div>
        <strong>Editora Oeste</strong> — Proposta válida por 15 dias a contar da data de emissão.
      </div>
      <div>
        Documento gerado eletronicamente em ${escapeHtml(dataHoje)}.
      </div>
    </div>
  </div>

  <script>
    // Se aberto em nova aba de impressão, abre diálogo direto
    window.addEventListener('load', () => {
      // Auto-trigger print se solicitado via hash
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
