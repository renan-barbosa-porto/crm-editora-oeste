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
      requestKey: null,
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
    requestKey: null,
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

/**
 * Determina se um erro é transitório de rede ou sobrecarga do servidor,
 * passível de recuperação por retry automático com backoff.
 */
function isTransientNetworkError(err: any): boolean {
  if (!err) return false

  const status = err?.status ?? err?.response?.status
  if (status === 0 || status === 429 || status === 502 || status === 503 || status === 504) {
    return true
  }

  const msg = String(err?.message || '').toLowerCase()
  const originalMsg = String(err?.originalError?.message || '').toLowerCase()
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('load failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('timeout') ||
    msg.includes('temporary unavailable') ||
    msg.includes('temporarily unavailable') ||
    originalMsg.includes('failed to fetch') ||
    originalMsg.includes('networkerror') ||
    originalMsg.includes('network error')
  ) {
    return true
  }

  // PocketBase ClientResponseError com status 0 ou isAbort
  if (err?.isAbort === true) {
    return true
  }

  return false
}

/**
 * Helper para executar chamadas assíncronas com retry e backoff exponencial
 * tolerando oscilações de rede ("Failed to fetch", status 0, 429, 502, 503, 504).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  initialDelay = 400,
): Promise<T> {
  let attempt = 0
  let delay = initialDelay

  while (true) {
    try {
      return await fn()
    } catch (err: any) {
      attempt++
      if (isTransientNetworkError(err) && attempt <= retries) {
        await new Promise((resolve) => setTimeout(resolve, delay))
        delay *= 2
        continue
      }
      throw err
    }
  }
}

/**
 * Busca orçamento por numero_referencia de forma segura para evitar duplicações
 * em caso de ambiguidade pós-falha de rede.
 */
export async function findQuoteByNumeroReferencia(numeroReferencia: string): Promise<Quote | null> {
  const cleanRef = (numeroReferencia || '').trim()
  if (!cleanRef) return null

  try {
    // Sanitizar contra quebra de filtro PocketBase
    const safeRef = cleanRef.replace(/['"\\]/g, '')
    const list = await withRetry(
      () =>
        pb.collection('quotes').getList<Quote>(1, 1, {
          filter: `numero_referencia = '${safeRef}'`,
          expand: 'lead_id,contact_id',
          requestKey: null,
        }),
      2,
      300,
    )
    return list.items[0] || null
  } catch (err) {
    console.warn('[findQuoteByNumeroReferencia] Erro ao buscar referência existente:', err)
    return null
  }
}

export async function createQuote(
  data: Partial<Quote>,
  items?: Partial<QuoteItem>[],
): Promise<Quote> {
  const numeroRef = (data.numero_referencia || '').trim()

  // 1. Verificação prévia de idempotência: se já existir com a mesma referência, reutilizar
  if (numeroRef) {
    try {
      const existing = await findQuoteByNumeroReferencia(numeroRef)
      if (existing) {
        return existing
      }
    } catch {
      // Se a checagem falhar por instabilidade, prossegue para tentativa de criação
    }
  }

  // 2. Criação do registro de quote com retry tolerante a oscilações de rede
  let quote: Quote
  try {
    quote = await withRetry(
      () =>
        pb.collection('quotes').create<Quote>(data, {
          expand: 'lead_id,contact_id',
          requestKey: null,
        }),
      4,
      500,
    )
  } catch (createErr: any) {
    // Se falhou no nível de rede / ambiguidade ("Failed to fetch", timeout, gateway 502/503),
    // é comum que a requisição tenha sido gravada no servidor antes da conexão cair.
    // Fazemos checagem de reconciliação para não acusar erro falso positivo se o registro já existir.
    if (numeroRef) {
      // Pequena pausa para o banco estabilizar eventual escrita
      await new Promise((res) => setTimeout(res, 600))
      try {
        const existingAfterErr = await findQuoteByNumeroReferencia(numeroRef)
        if (existingAfterErr) {
          return existingAfterErr
        }
      } catch {
        // Se a busca falhar, lança o erro original
      }
    }
    throw createErr
  }

  // 3. Criação dos itens do orçamento (quote_items)
  if (items && items.length > 0) {
    // Verificar se já não existem itens cadastrados (ex.: em caso de reexecução parcial)
    let existingItemCount = 0
    try {
      const existingItems = await pb.collection('quote_items').getList(1, 1, {
        filter: `quote_id = '${quote.id}'`,
        requestKey: null,
      })
      existingItemCount = existingItems.totalItems
    } catch {
      // Se falhar a listagem, segue criando
    }

    if (existingItemCount === 0) {
      for (const item of items) {
        if (item.descricao && item.descricao.trim()) {
          await withRetry(() =>
            pb.collection('quote_items').create(
              {
                quote_id: quote.id,
                descricao: item.descricao,
                quantidade: item.quantidade || 1,
                valor_unitario: item.valor_unitario || 0,
                desconto_percentual: item.desconto_percentual || 0,
              },
              { requestKey: null },
            ),
          )
        }
      }
    }
  }

  return quote
}

export async function updateQuote(id: string, data: Partial<Quote>): Promise<Quote> {
  return await withRetry(() =>
    pb.collection('quotes').update<Quote>(id, data, {
      expand: 'lead_id,contact_id',
      requestKey: null,
    }),
  )
}

export async function updateQuoteStatus(id: string, status: QuoteStatus): Promise<Quote> {
  return await withRetry(() =>
    pb.collection('quotes').update<Quote>(
      id,
      { status },
      {
        expand: 'lead_id,contact_id',
        requestKey: null,
      },
    ),
  )
}

export async function deleteQuote(id: string): Promise<boolean> {
  return await withRetry(() => pb.collection('quotes').delete(id))
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
