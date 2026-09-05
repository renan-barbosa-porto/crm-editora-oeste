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

  return await pb.collection('leads').getFullList<Lead>({
    sort: '-created',
    filter: filterParts.length > 0 ? filterParts.join(' && ') : undefined,
    expand: 'contact_id',
  })
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
