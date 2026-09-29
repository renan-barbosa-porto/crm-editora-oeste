import type { Quote } from '@/types/crm'

export type PrazoUrgencia = 'urgente' | 'alerta' | 'neutro'

export interface PrazoStatusInfo {
  diasSemResposta: number
  urgencia: PrazoUrgencia
  label: string
  badgeClass: string
  cardBorderClass: string
  bgHighlightClass: string
}

/**
 * Retorna a data efetiva de envio da proposta.
 * Se o campo data_envio estiver preenchido, usa-o.
 * Se não, para propostas enviadas/visualizadas usa a data de criação do orçamento como fallback.
 */
export function getQuoteDataEnvio(quote: Quote | null | undefined): Date | null {
  if (!quote) return null
  if (quote.data_envio) {
    const d = new Date(quote.data_envio)
    if (!isNaN(d.getTime())) return d
  }
  // Se está Enviado ou Visualizado mas não possui data_envio explícita, usa created como fallback
  if (quote.status === 'Enviado' || quote.status === 'Visualizado') {
    if (quote.created) {
      const d = new Date(quote.created)
      if (!isNaN(d.getTime())) return d
    }
  }
  return null
}

/**
 * Calcula a quantidade de dias inteiros transcorridos desde a data de envio.
 */
export function calcularDiasSemResposta(quote: Quote | null | undefined): number | null {
  if (!quote) return null
  const dataEnvio = getQuoteDataEnvio(quote)
  if (!dataEnvio) return null

  const now = new Date()
  const diffTime = now.getTime() - dataEnvio.getTime()
  if (isNaN(diffTime) || diffTime < 0) return 0
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Regras de destaque confirmadas pelo usuário:
 * - mais de 7 dias sem resposta = destaque VERMELHO (urgente);
 * - 4 a 7 dias = destaque AMARELO;
 * - até 3 dias = estilo NEUTRO.
 */
/**
 * Extrai o maior número de proposta usado em orçamentos existentes para exibir como lembrete (hint).
 * Procura tanto em `numero_referencia` quanto em `codigo` (ex: "ORC-26152" ou "26152").
 */
export function getUltimoNumeroPropostaUsado(quotes: Quote[]): string | null {
  let maiorNumero = 0

  for (const q of quotes) {
    const refs = [q.numero_referencia, q.codigo].filter(Boolean) as string[]
    for (const ref of refs) {
      // Procura sequências de dígitos
      const matches = ref.match(/\d+/g)
      if (matches) {
        for (const m of matches) {
          const num = parseInt(m, 10)
          if (!isNaN(num) && num > maiorNumero) {
            maiorNumero = num
          }
        }
      }
    }
  }

  return maiorNumero > 0 ? String(maiorNumero) : null
}

/**
 * Calcula o valor total do orçamento considerando a regra de tiragem de valorização:
 * - Se inclui_editorial !== false, soma o subtotal líquido da Parte 1 (editorial).
 * - Soma a faixa da Parte 2 (gráfica) de acordo com `tiragem_valorizacao`:
 *     - '1': lote de 1 exemplar
 *     - '50': lote de 50 exemplares
 *     - '100': lote de 100 exemplares
 *     - 'combinar': sem valor da produção gráfica (ou se for só gráfica, 0)
 *   Se 'combinar' e não tiver editorial, retorna 0 (entra na contagem sem valor monetário).
 */
export function calcularValorQuote(
  quote: Quote | null | undefined,
  items?: { quantidade?: number; valor_unitario?: number }[],
): number {
  if (!quote) return 0
  let total = 0

  try {
    // 1. Produção editorial (se aplicável)
    const incluiEditorial = quote.inclui_editorial !== false
    if (incluiEditorial) {
      const quoteItems = Array.isArray(items)
        ? items
        : Array.isArray(quote.expand?.quote_items_via_quote_id)
          ? quote.expand.quote_items_via_quote_id
          : []
      const subtotalEditorial = quoteItems.reduce((acc, it) => {
        if (!it) return acc
        const q = Number(it.quantidade) || 0
        const v = Number(it.valor_unitario) || 0
        return acc + q * v
      }, 0)
      const desc = Number(quote.desconto_percentual) || 0
      const descVal = (subtotalEditorial * desc) / 100
      total += Math.max(0, subtotalEditorial - descVal)
    }

    // 2. Produção gráfica por tiragem de valorização
    const tiragemValorizacao = quote.tiragem_valorizacao || '50'
    if (tiragemValorizacao !== 'combinar') {
      let tiragensList: { tiragem?: number; valor_unitario?: number; valor_total?: number }[] = []
      if (Array.isArray(quote.grafica_tiragens)) {
        tiragensList = quote.grafica_tiragens
      } else if (typeof quote.grafica_tiragens === 'string' && quote.grafica_tiragens.trim()) {
        try {
          const parsed = JSON.parse(quote.grafica_tiragens)
          if (Array.isArray(parsed)) {
            tiragensList = parsed
          }
        } catch {
          tiragensList = []
        }
      }

      const tiragemAlvo = parseInt(String(tiragemValorizacao), 10)
      if (!isNaN(tiragemAlvo) && Array.isArray(tiragensList)) {
        const linha = tiragensList.find((t) => t && Number(t.tiragem) === tiragemAlvo)
        if (linha) {
          const vTot = Number(linha.valor_total)
          const vUnit = Number(linha.valor_unitario) || 0
          const tir = Number(linha.tiragem) || tiragemAlvo
          const valorLote = !isNaN(vTot) && vTot > 0 ? vTot : tir * vUnit
          if (!isNaN(valorLote)) {
            total += valorLote
          }
        }
      }
    }
  } catch (err) {
    console.warn('[calcularValorQuote] Erro seguro ao calcular valor do orçamento:', err)
  }

  return isNaN(total) ? 0 : total
}

export function getPrazoDestaque(quote: Quote | null | undefined): PrazoStatusInfo | null {
  if (!quote) return null
  // Apenas relevante para orçamentos enviados sem resposta definitiva (Enviado ou Visualizado)
  if (quote.status !== 'Enviado' && quote.status !== 'Visualizado') {
    return null
  }

  const dias = calcularDiasSemResposta(quote)
  const diasNum = dias !== null ? dias : 0

  let urgencia: PrazoUrgencia = 'neutro'
  let label = ''
  let badgeClass = ''
  let cardBorderClass = ''
  let bgHighlightClass = ''

  if (diasNum === 0) {
    label = 'Enviado hoje'
  } else if (diasNum === 1) {
    label = 'Enviado há 1 dia'
  } else {
    label = `Enviado há ${diasNum} dias`
  }

  if (diasNum > 7) {
    urgencia = 'urgente'
    badgeClass = 'bg-[#B3261E] text-white font-semibold'
    cardBorderClass = 'border-l-4 border-l-[#B3261E] border-[#F2C2BF]'
    bgHighlightClass = 'bg-[#FDF3F2]'
  } else if (diasNum >= 4) {
    urgencia = 'alerta'
    badgeClass = 'bg-[#C07A1B] text-white font-semibold'
    cardBorderClass = 'border-l-4 border-l-[#C07A1B] border-[#FBE3B5]'
    bgHighlightClass = 'bg-[#FFFBF2]'
  } else {
    urgencia = 'neutro'
    badgeClass = 'bg-[#E5DFD6] text-[#4A4238] font-medium'
    cardBorderClass = 'border-l-4 border-l-[#8A8178] border-[#E5DFD6]'
    bgHighlightClass = 'bg-white'
  }

  return {
    diasSemResposta: diasNum,
    urgencia,
    label,
    badgeClass,
    cardBorderClass,
    bgHighlightClass,
  }
}

/**
 * Constrói o link oficial do WhatsApp (wa.me) limpando o número e garantindo DDI 55.
 */
export function formatWhatsAppUrl(telefone: string, mensagemPrevia?: string): string {
  const clean = telefone.replace(/\D/g, '')
  if (!clean) return ''
  const fullNumber = clean.startsWith('55') ? clean : `55${clean}`
  const base = `https://wa.me/${fullNumber}`
  if (mensagemPrevia) {
    return `${base}?text=${encodeURIComponent(mensagemPrevia)}`
  }
  return base
}
