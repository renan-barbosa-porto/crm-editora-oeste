import pb from '@/lib/pocketbase/client'
import type { Lead, LeadEstagio } from '@/types/crm'

export async function getLeads(filters?: { search?: string; empresa?: string }): Promise<Lead[]> {
  const filterParts: string[] = []

  if (filters?.search?.trim()) {
    const term = filters.search.trim().replace(/'/g, "\\'")
    filterParts.push(`nome ~ '${term}' || telefone ~ '${term}' || email ~ '${term}'`)
  }

  if (filters?.empresa?.trim() && filters.empresa !== 'all') {
    const emp = filters.empresa.trim().replace(/'/g, "\\'")
    filterParts.push(`empresa = '${emp}'`)
  }

  const filter = filterParts.length > 0 ? filterParts.join(' && ') : undefined

  // Tenta primeiro com expand: 'contact_id' e retry em falhas transitórias
  try {
    return await pb.collection('leads').getFullList<Lead>({
      sort: '-created',
      filter,
      expand: 'contact_id',
      requestKey: null,
    })
  } catch (err: any) {
    // Se falhar o expand ou houver inconsistência de relação, tenta fallback sem expand
    console.warn('[getLeads] Falha na busca com expand, tentando fallback sem expand:', err)
    return await pb.collection('leads').getFullList<Lead>({
      sort: '-created',
      filter,
      requestKey: null,
    })
  }
}

export async function getLeadById(id: string): Promise<Lead> {
  return await pb.collection('leads').getOne<Lead>(id, {
    expand: 'contact_id',
  })
}

export async function getLeadsByContactId(contactId: string): Promise<Lead[]> {
  return await pb.collection('leads').getFullList<Lead>({
    filter: `contact_id = '${contactId}'`,
    sort: '-created',
  })
}

export async function createLead(data: Partial<Lead>): Promise<Lead> {
  return await pb.collection('leads').create<Lead>(data, {
    expand: 'contact_id',
  })
}

export async function updateLead(id: string, data: Partial<Lead>): Promise<Lead> {
  return await pb.collection('leads').update<Lead>(id, data, {
    expand: 'contact_id',
  })
}

export async function updateLeadEstagio(id: string, estagio: LeadEstagio): Promise<Lead> {
  return await pb.collection('leads').update<Lead>(
    id,
    { estagio },
    {
      expand: 'contact_id',
    },
  )
}

export async function deleteLead(id: string): Promise<boolean> {
  return await pb.collection('leads').delete(id)
}


/**
 * Busca apenas os leads vinculados aos contatos de uma página.
 * Evita carregar o funil inteiro para mostrar a contagem na tabela de contatos.
 */
export async function getLeadsByContactIds(contactIds: string[]): Promise<Lead[]> {
  const ids = [...new Set(contactIds.filter((id) => /^[a-zA-Z0-9_]{15}$/.test(id)))]
  if (ids.length === 0) return []

  const filters = ids.map((id) => `contact_id = '${id}'`)
  return await pb.collection('leads').getFullList<Lead>({
    filter: `(${filters.join(' || ')})`,
    fields: 'id,contact_id',
    requestKey: null,
  })
}
