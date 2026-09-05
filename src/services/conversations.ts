import pb from '@/lib/pocketbase/client'
import type { Conversation } from '@/types/crm'

export async function getConversationsByLeadId(leadId: string): Promise<Conversation[]> {
  return await pb.collection('conversations').getFullList<Conversation>({
    filter: `lead_id = '${leadId}'`,
    sort: 'created',
    expand: 'contact_id,lead_id',
  })
}

export async function getConversationsByContactId(contactId: string): Promise<Conversation[]> {
  return await pb.collection('conversations').getFullList<Conversation>({
    filter: `contact_id = '${contactId}'`,
    sort: 'created',
    expand: 'contact_id,lead_id',
  })
}

export async function createConversation(data: {
  mensagem: string
  direcao: 'enviada' | 'recebida'
  contact_id?: string
  lead_id?: string
}): Promise<Conversation> {
  return await pb.collection('conversations').create<Conversation>(data, {
    expand: 'contact_id,lead_id',
  })
}

export async function getRecentConversations(limit = 5): Promise<Conversation[]> {
  const res = await pb.collection('conversations').getList<Conversation>(1, limit, {
    sort: '-created',
    expand: 'contact_id,lead_id',
  })
  return res.items
}
