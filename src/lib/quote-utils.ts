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
export function getQuoteDataEnvio(quote: Quote): Date | null {
  if (quote.data_envio) {
    const d = new Date(quote.data_envio)
    if (!isNaN(d.getTime())) return d
  }
  // Se está Enviado ou Visualizado mas não possui data_envio explícita, usa created como fallback
  if (quote.status === 'Enviado' || quote.status === 'Visualizado') {
    const d = new Date(quote.created)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

/**
 * Calcula a quantidade de dias inteiros transcorridos desde a data de envio.
 */
export function calcularDiasSemResposta(quote: Quote): number | null {
  const dataEnvio = getQuoteDataEnvio(quote)
  if (!dataEnvio) return null

  const now = new Date()
  const diffTime = now.getTime() - dataEnvio.getTime()
  if (diffTime < 0) return 0
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Regras de destaque confirmadas pelo usuário:
 * - mais de 7 dias sem resposta = destaque VERMELHO (urgente);
 * - 4 a 7 dias = destaque AMARELO;
 * - até 3 dias = estilo NEUTRO.
 */
export function getPrazoDestaque(quote: Quote): PrazoStatusInfo | null {
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
