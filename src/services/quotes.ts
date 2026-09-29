import pb from '@/lib/pocketbase/client'
import type { Quote, QuoteItem, QuoteStatus } from '@/types/crm'

export async function getQuotes(statusFilter?: string): Promise<Quote[]> {
  let filter: string | undefined = undefined

  if (statusFilter === 'pendentes') {
    filter = "status = 'Enviado' || status = 'Visualizado'"
    // Listas de orçamentos pendentes de follow-up ordenadas do mais antigo para o mais recente
    return await pb.collection('quotes').getFullList<Quote>({
      sort: 'created',
      filter,
      expand: 'lead_id,contact_id',
    })
  } else if (statusFilter === 'rascunhos') {
    filter = "status = 'Rascunho'"
  } else if (statusFilter === 'aprovados') {
    filter = "status = 'Aprovado'"
  } else if (statusFilter === 'rejeitados') {
    filter = "status = 'Rejeitado'"
  } else if (statusFilter === 'esfriados') {
    filter = "status = 'Esfriou'"
  } else if (statusFilter && statusFilter !== 'todos') {
    filter = `status = '${statusFilter}'`
  }

  return await pb.collection('quotes').getFullList<Quote>({
    sort: '-created',
    filter,
    expand: 'lead_id,contact_id',
  })
}

export async function getQuoteById(id: string): Promise<Quote> {
  return await pb.collection('quotes').getOne<Quote>(id, {
    expand: 'lead_id,contact_id',
  })
}

export async function getQuotesByLeadId(leadId: string): Promise<Quote[]> {
  return await pb.collection('quotes').getFullList<Quote>({
    filter: `lead_id = '${leadId}'`,
    sort: '-created',
  })
}

export async function getQuotesByContactId(contactId: string): Promise<Quote[]> {
  return await pb.collection('quotes').getFullList<Quote>({
    filter: `contact_id = '${contactId}'`,
    sort: '-created',
  })
}

export async function createQuote(
  data: Partial<Quote>,
  items?: Partial<QuoteItem>[],
): Promise<Quote> {
  const quote = await pb.collection('quotes').create<Quote>(data, {
    expand: 'lead_id,contact_id',
  })

  if (items && items.length > 0) {
    for (const item of items) {
      if (item.descricao && item.descricao.trim()) {
        await pb.collection('quote_items').create({
          quote_id: quote.id,
          descricao: item.descricao,
          quantidade: item.quantidade || 1,
          valor_unitario: item.valor_unitario || 0,
          desconto_percentual: item.desconto_percentual || 0,
        })
      }
    }
  }

  return quote
}

export async function updateQuote(id: string, data: Partial<Quote>): Promise<Quote> {
  return await pb.collection('quotes').update<Quote>(id, data, {
    expand: 'lead_id,contact_id',
  })
}

export async function updateQuoteStatus(id: string, status: QuoteStatus): Promise<Quote> {
  return await pb.collection('quotes').update<Quote>(
    id,
    { status },
    {
      expand: 'lead_id,contact_id',
    },
  )
}

export async function deleteQuote(id: string): Promise<boolean> {
  return await pb.collection('quotes').delete(id)
}

/**
 * Helper para executar chamadas assíncronas com retry e backoff exponencial em caso de erro 429
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, initialDelay = 400): Promise<T> {
  let attempt = 0
  let delay = initialDelay

  while (true) {
    try {
      return await fn()
    } catch (err: any) {
      attempt++
      const isRateLimit = err?.status === 429 || err?.response?.status === 429
      if (isRateLimit && attempt <= retries) {
        await new Promise((resolve) => setTimeout(resolve, delay))
        delay *= 2
        continue
      }
      throw err
    }
  }
}

// Quote Items
export async function getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
  try {
    return await withRetry(() =>
      pb.collection('quote_items').getFullList<QuoteItem>({
        filter: `quote_id = '${quoteId}'`,
        sort: 'created',
      }),
    )
  } catch (err) {
    console.warn(
      `[getQuoteItems] Não foi possível carregar itens para o orçamento ${quoteId}:`,
      err,
    )
    return []
  }
}

/**
 * Busca itens de múltiplos orçamentos em lote (batching) com limitação de tamanho de filtro,
 * eliminando a rajada de requisições individuais paralelas e tratando erros com retry e degradação suave.
 */
export async function getQuoteItemsByQuoteIds(
  quoteIds: string[],
): Promise<Record<string, QuoteItem[]>> {
  const result: Record<string, QuoteItem[]> = {}
  const uniqueIds = Array.from(new Set(quoteIds.filter(Boolean)))

  for (const id of uniqueIds) {
    result[id] = []
  }

  if (uniqueIds.length === 0) {
    return result
  }

  // Agrupa em blocos de até 25 orçamentos por requisição
  const CHUNK_SIZE = 25
  const chunks: string[][] = []
  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    chunks.push(uniqueIds.slice(i, i + CHUNK_SIZE))
  }

  // Executa os lotes em sequência (ou pequenos passos) para evitar concorrência excessiva
  for (const chunk of chunks) {
    try {
      const filterClause = chunk.map((id) => `quote_id = '${id}'`).join(' || ')
      const items = await withRetry(() =>
        pb.collection('quote_items').getFullList<QuoteItem>({
          filter: `(${filterClause})`,
          sort: 'created',
        }),
      )

      for (const item of items) {
        if (item.quote_id && result[item.quote_id]) {
          result[item.quote_id].push(item)
        }
      }
    } catch (err) {
      console.warn('[getQuoteItemsByQuoteIds] Erro ao carregar lote de itens:', err)
      // Degradação graciosa: os orçamentos do bloco continuam vazios em result sem estourar runtime
    }
  }

  return result
}

export async function createQuoteItem(data: Partial<QuoteItem>): Promise<QuoteItem> {
  return await pb.collection('quote_items').create<QuoteItem>(data)
}

export async function updateQuoteItem(id: string, data: Partial<QuoteItem>): Promise<QuoteItem> {
  return await pb.collection('quote_items').update<QuoteItem>(id, data)
}

export async function deleteQuoteItem(id: string): Promise<boolean> {
  return await pb.collection('quote_items').delete(id)
}
