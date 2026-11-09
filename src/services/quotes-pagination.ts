import pb from '@/lib/pocketbase/client'
import type { Quote } from '@/types/crm'

export type QuoteListStatus =
  | 'todos'
  | 'pendentes'
  | 'rascunhos'
  | 'aprovados'
  | 'rejeitados'
  | 'esfriados'

export interface QuotesPage {
  items: Quote[]
  page: number
  perPage: number
  totalItems: number
  totalPages: number
}

/**
 * API de paginação para futura migração gradual da listagem.
 *
 * Não substituir getQuotes() no painel nem nos indicadores sem implementar
 * contagens globais por status e preservar a pesquisa em todo o histórico.
 * Este módulo não é chamado pela UI nesta etapa.
 */
export async function getQuotesPage(
  page = 1,
  perPage = 20,
  status: QuoteListStatus = 'todos',
): Promise<QuotesPage> {
  const filters: Record<Exclude<QuoteListStatus, 'todos'>, string> = {
    pendentes: "(status = 'Enviado' || status = 'Visualizado')",
    rascunhos: "status = 'Rascunho'",
    aprovados: "status = 'Aprovado'",
    rejeitados: "status = 'Rejeitado'",
    esfriados: "status = 'Esfriou'",
  }
  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1
  const safePerPage = Number.isFinite(perPage)
    ? Math.max(1, Math.min(50, Math.floor(perPage)))
    : 20
  const filter = status === 'todos' ? undefined : filters[status]
  const sort = status === 'pendentes' ? 'created' : '-created'

  // A expansão não deve impedir a leitura da coleção quando relacionamentos
  // estiverem temporariamente indisponíveis.
  const options = { sort, filter, expand: 'lead_id,contact_id', requestKey: null as null }
  try {
    const response = await pb.collection('quotes').getList<Quote>(safePage, safePerPage, options)
    return {
      items: response.items,
      page: response.page,
      perPage: response.perPage,
      totalItems: response.totalItems,
      totalPages: response.totalPages,
    }
  } catch (err) {
    // Sem fallback para erros de rede, autorização ou limites: apenas expansão.
    // Na ausência de diagnóstico conclusivo, propagamos erros ao chamador.
    throw err
  }
}
