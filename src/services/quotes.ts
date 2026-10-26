import pb from '@/lib/pocketbase/client'
import type { Quote, QuoteItem, QuoteStatus } from '@/types/crm'

export async function getQuotes(statusFilter?: string): Promise<Quote[]> {
  let filter: string | undefined = undefined

  const isPendentes = statusFilter === 'pendentes'
  if (isPendentes) {
    filter = "status = 'Enviado' || status = 'Visualizado'"
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

  const sortOrder = isPendentes ? 'created' : '-created'

  try {
    return await pb.collection('quotes').getFullList<Quote>({
      sort: sortOrder,
      filter,
      expand: 'lead_id,contact_id',
      requestKey: null,
    })
  } catch (err: any) {
    console.warn(
      '[getQuotes] Falha ao carregar com expand lead_id/contact_id, tentando fallback sem expand:',
      err,
    )
    return await pb.collection('quotes').getFullList<Quote>({
      sort: sortOrder,
      filter,
      requestKey: null,
    })
  }
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
    expand: 'lead_id,contact_id',
    requestKey: null,
  })
}

export async function getQuotesByContactId(contactId: string): Promise<Quote[]> {
  return await pb.collection('quotes').getFullList<Quote>({
    filter: `contact_id = '${contactId}'`,
    sort: '-created',
    expand: 'lead_id,contact_id',
    requestKey: null,
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
 * Busca orçamento por numero_referencia de forma segura.
 * Quando fornecido lead_id e/ou título, filtra com precisão para não confundir propostas
 * distintas que compartilham o mesmo número de referência intencionalmente (ex: tiragens ou propostas diferentes para o mesmo cliente).
 */
export async function findQuoteByNumeroReferencia(
  numeroReferencia: string,
  criteria?: { leadId?: string; titulo?: string; createdAfterMs?: number },
): Promise<Quote | null> {
  const cleanRef = (numeroReferencia || '').trim()
  if (!cleanRef) return null

  try {
    // Sanitizar contra quebra de filtro PocketBase
    const safeRef = cleanRef.replace(/['"\\]/g, '')
    const filterParts = [`numero_referencia = '${safeRef}'`]
    if (criteria?.leadId) {
      const safeLead = criteria.leadId.replace(/['"\\]/g, '')
      filterParts.push(`lead_id = '${safeLead}'`)
    }

    const list = await withRetry(
      () =>
        pb.collection('quotes').getList<Quote>(1, 10, {
          filter: filterParts.join(' && '),
          sort: '-created',
          expand: 'lead_id,contact_id',
          requestKey: null,
        }),
      2,
      300,
    )

    if (list.items.length === 0) return null

    // Se houver filtro de título ou janela de tempo recente, refina a correspondência
    const candidates = list.items.filter((q) => {
      if (criteria?.titulo && criteria.titulo.trim()) {
        const t1 = q.titulo.trim().toLowerCase()
        const t2 = criteria.titulo.trim().toLowerCase()
        if (t1 !== t2) return false
      }
      if (criteria?.createdAfterMs) {
        const createdMs = q.created ? new Date(q.created).getTime() : 0
        if (createdMs < criteria.createdAfterMs) return false
      }
      return true
    })

    return candidates[0] || null
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
  const nowMs = Date.now()

  // 1. Criação do registro de quote com retry tolerante a oscilações de rede.
  // ATENÇÃO: NUNCA reutilizar preventivamente um orçamento existente antes da tentativa de salvar,
  // pois o usuário pode criar legitimamente propostas diferentes com o mesmo número de referência!
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
    // SOMENTE reconciliamos se encontrarmos uma proposta criada NESTE MOMENTO (últimos 30 segundos)
    // com exatamente o MESMO lead e MESMO título.
    if (numeroRef && isTransientNetworkError(createErr)) {
      await new Promise((res) => setTimeout(res, 600))
      try {
        const existingAfterErr = await findQuoteByNumeroReferencia(numeroRef, {
          leadId: data.lead_id,
          titulo: data.titulo,
          createdAfterMs: nowMs - 30_000,
        })
        if (existingAfterErr) {
          quote = existingAfterErr
        } else {
          throw createErr
        }
      } catch {
        throw createErr
      }
    } else {
      throw createErr
    }
  }

  // 2. Verificação pós-salvamento OBRIGATÓRIA no banco:
  // Confirma que o registro realmente existe antes de prosseguir ou reportar sucesso.
  try {
    const verified = await withRetry(
      () =>
        pb.collection('quotes').getOne<Quote>(quote.id, {
          expand: 'lead_id,contact_id',
          requestKey: null,
        }),
      3,
      400,
    )
    if (!verified || !verified.id) {
      throw new Error('Falha na confirmação de gravação do orçamento no servidor.')
    }
    quote = verified
  } catch (verifyErr: any) {
    console.error('[createQuote] Erro na verificação pós-salvamento:', verifyErr)
    throw new Error(
      verifyErr?.message ||
        'Não foi possível confirmar a gravação do orçamento no servidor. Verifique a listagem antes de tentar novamente.',
    )
  }

  // 3. Criação dos itens do orçamento (quote_items)
  if (items && items.length > 0) {
    let existingItemCount = 0
    try {
      const existingItems = await pb.collection('quote_items').getList(1, 1, {
        filter: `quote_id = '${quote.id}'`,
        requestKey: null,
      })
      existingItemCount = existingItems.totalItems
    } catch {
      // Se falhar a checagem, tenta salvar
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
  const updated = await withRetry(() =>
    pb.collection('quotes').update<Quote>(id, data, {
      expand: 'lead_id,contact_id',
      requestKey: null,
    }),
  )

  // Verificação pós-salvamento: confirma no banco que a atualização persistiu
  try {
    const verified = await withRetry(
      () =>
        pb.collection('quotes').getOne<Quote>(id, {
          expand: 'lead_id,contact_id',
          requestKey: null,
        }),
      2,
      300,
    )
    return verified || updated
  } catch (err) {
    console.warn(
      '[updateQuote] Verificação pós-atualização falhou, retornando resposta do update:',
      err,
    )
    return updated
  }
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
