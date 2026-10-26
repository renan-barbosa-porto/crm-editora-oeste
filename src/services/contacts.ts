import pb from '@/lib/pocketbase/client'
import type { Contact } from '@/types/crm'

export async function getContacts(
  page = 1,
  perPage = 10,
  search = '',
): Promise<{ items: Contact[]; totalItems: number; totalPages: number }> {
  let filter = ''
  if (search.trim()) {
    const term = search.trim().replace(/'/g, "\\'")
    filter = `nome ~ '${term}' || empresa ~ '${term}' || email ~ '${term}' || telefone ~ '${term}'`
  }

  const res = await pb.collection('contacts').getList<Contact>(page, perPage, {
    sort: '-created',
    filter: filter || undefined,
  })
  return {
    items: res.items,
    totalItems: res.totalItems,
    totalPages: res.totalPages,
  }
}

export async function getAllContacts(): Promise<Contact[]> {
  return await pb.collection('contacts').getFullList<Contact>({
    sort: 'nome',
  })
}

export async function getContactById(id: string): Promise<Contact> {
  return await pb.collection('contacts').getOne<Contact>(id)
}

export async function findContactByEmail(email: string): Promise<Contact | null> {
  if (!email) return null
  try {
    return await pb
      .collection('contacts')
      .getFirstListItem<Contact>(`email = '${email.replace(/'/g, "\\'")}'`)
  } catch {
    return null
  }
}

export async function createContact(data: Partial<Contact>): Promise<Contact> {
  const payload: Record<string, any> = {
    nome: (data.nome || '').trim(),
    telefone: (data.telefone || '').trim(),
  }

  const emailTrim = (data.email || '').trim()
  if (emailTrim) {
    payload.email = emailTrim
  }

  const empresaTrim = (data.empresa || '').trim()
  if (empresaTrim) {
    payload.empresa = empresaTrim
  }

  const enderecoTrim = (data.endereco || '').trim()
  if (enderecoTrim) {
    payload.endereco = enderecoTrim
  }

  return await pb.collection('contacts').create<Contact>(payload)
}

export async function updateContact(id: string, data: Partial<Contact>): Promise<Contact> {
  return await pb.collection('contacts').update<Contact>(id, data)
}

export async function deleteContact(id: string): Promise<boolean> {
  return await pb.collection('contacts').delete(id)
}
