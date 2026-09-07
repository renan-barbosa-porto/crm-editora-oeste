import pb from '@/lib/pocketbase/client'
import type { QuoteCategory, CatalogItem } from '@/types/crm'

// Categorias (Nível 1)
export async function getQuoteCategories(): Promise<QuoteCategory[]> {
  try {
    return await pb.collection('quote_categories').getFullList<QuoteCategory>({
      sort: 'ordem,nome',
    })
  } catch (err) {
    console.error('Erro ao buscar categorias de orçamento:', err)
    return []
  }
}

export async function createQuoteCategory(data: Partial<QuoteCategory>): Promise<QuoteCategory> {
  return await pb.collection('quote_categories').create<QuoteCategory>(data)
}

export async function updateQuoteCategory(
  id: string,
  data: Partial<QuoteCategory>,
): Promise<QuoteCategory> {
  return await pb.collection('quote_categories').update<QuoteCategory>(id, data)
}

export async function deleteQuoteCategory(id: string): Promise<boolean> {
  return await pb.collection('quote_categories').delete(id)
}

// Itens do Catálogo (Nível 2)
export async function getCatalogItems(categoryId?: string): Promise<CatalogItem[]> {
  try {
    const filter = categoryId ? `category_id = '${categoryId}'` : undefined
    return await pb.collection('catalog_items').getFullList<CatalogItem>({
      filter,
      sort: 'nome',
      expand: 'category_id',
    })
  } catch (err) {
    console.error('Erro ao buscar itens de catálogo:', err)
    return []
  }
}

export async function createCatalogItem(data: Partial<CatalogItem>): Promise<CatalogItem> {
  return await pb.collection('catalog_items').create<CatalogItem>(data, {
    expand: 'category_id',
  })
}

export async function updateCatalogItem(
  id: string,
  data: Partial<CatalogItem>,
): Promise<CatalogItem> {
  return await pb.collection('catalog_items').update<CatalogItem>(id, data, {
    expand: 'category_id',
  })
}

export async function deleteCatalogItem(id: string): Promise<boolean> {
  return await pb.collection('catalog_items').delete(id)
}

/**
 * Busca sugestões com memória global:
 * 1. Itens da coleção catalog_items (incluindo pré-cadastrados da migração)
 * 2. Itens anteriormente salvos em quote_items em outros orçamentos
 * Retorna sugestões únicas formatadas com nome, descrição e valor sugerido
 */
export interface ItemSugestao {
  id: string
  nome: string
  descricao: string
  valor_unitario: number
  origem: 'catalogo' | 'historico'
  categoriaNome?: string
}

export async function searchItemSugestoes(termo: string): Promise<ItemSugestao[]> {
  const cleanTerm = termo.trim().toLowerCase()
  const results: ItemSugestao[] = []
  const seenNomes = new Set<string>()

  try {
    // 1. Buscar no catálogo global
    const catalogFilter = cleanTerm
      ? `nome ~ '${cleanTerm.replace(/'/g, "\\'")}' || descricao ~ '${cleanTerm.replace(/'/g, "\\'")}'`
      : undefined

    const catItems = await pb.collection('catalog_items').getList<CatalogItem>(1, 15, {
      filter: catalogFilter,
      sort: 'nome',
      expand: 'category_id',
    })

    for (const item of catItems.items) {
      const lower = item.nome.trim().toLowerCase()
      if (!seenNomes.has(lower)) {
        seenNomes.add(lower)
        results.push({
          id: `cat_${item.id}`,
          nome: item.nome,
          descricao: item.descricao || '',
          valor_unitario: item.valor_padrao || 0,
          origem: 'catalogo',
          categoriaNome: item.expand?.category_id?.nome,
        })
      }
    }
  } catch (e) {
    console.warn('Erro ao consultar catálogo:', e)
  }

  try {
    // 2. Buscar no histórico de quote_items de orçamentos anteriores
    const quoteItemsFilter = cleanTerm
      ? `descricao ~ '${cleanTerm.replace(/'/g, "\\'")}'`
      : undefined

    const prevItems = await pb.collection('quote_items').getList(1, 20, {
      filter: quoteItemsFilter,
      sort: '-created',
    })

    for (const qItem of prevItems.items) {
      const desc = (qItem.descricao || '').trim()
      const lower = desc.toLowerCase()
      if (desc && !seenNomes.has(lower)) {
        seenNomes.add(lower)
        results.push({
          id: `prev_${qItem.id}`,
          nome: desc,
          descricao: '',
          valor_unitario: Number(qItem.valor_unitario) || 0,
          origem: 'historico',
        })
      }
    }
  } catch (e) {
    console.warn('Erro ao consultar histórico de itens:', e)
  }

  return results
}

/**
 * Salva item na memória do catálogo caso ainda não exista,
 * garantindo que novos itens digitados pelo usuário fiquem salvos para próximas propostas.
 */
export async function salvarItemNaMemoriaSeNovo(
  nome: string,
  valor: number,
  descricao?: string,
  categoryId?: string,
) {
  const trimmed = nome.trim()
  if (!trimmed) return

  try {
    // Verifica se já existe item de catálogo com esse nome
    const existing = await pb.collection('catalog_items').getList(1, 1, {
      filter: `nome = '${trimmed.replace(/'/g, "\\'")}'`,
    })

    if (existing.totalItems === 0) {
      await pb.collection('catalog_items').create({
        nome: trimmed,
        descricao: descricao || '',
        valor_padrao: valor || 0,
        category_id: categoryId || undefined,
      })
    }
  } catch (err) {
    console.warn('Não foi possível salvar item na memória:', err)
  }
}
