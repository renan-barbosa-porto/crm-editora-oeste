import pb from '@/lib/pocketbase/client'
import type { Quote, QuoteItem, QuoteStatus } from '@/types/crm'

export async function getQuotes(statusFilter?: string): Promise<Quote[]> {
  let filter: string | undefined = undefined

  if (statusFilter === 'pendentes') {
    filter = "status = 'Rascunho' || status = 'Enviado' || status = 'Visualizado'"
  } else if (statusFilter === 'aprovados') {
    filter = "status = 'Aprovado'"
  } else if (statusFilter === 'rejeitados') {
    filter = "status = 'Rejeitado'"
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

// Quote Items
export async function getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
  return await pb.collection('quote_items').getFullList<QuoteItem>({
    filter: `quote_id = '${quoteId}'`,
    sort: 'created',
  })
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
