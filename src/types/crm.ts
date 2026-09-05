import type { RecordModel } from 'pocketbase'

export interface User extends RecordModel {
  email: string
  name?: string
  avatar?: string
}

export interface Contact extends RecordModel {
  nome: string
  email?: string
  telefone: string
  empresa?: string
  endereco?: string
}

export type LeadEstagio = 'Novo' | 'Contato Feito' | 'Proposta Enviada' | 'Fechado' | 'Perdido'

export interface Lead extends RecordModel {
  nome: string
  telefone: string
  email?: string
  empresa?: string
  estagio: LeadEstagio
  valor_estimado?: number
  observacoes?: string
  contact_id?: string
  expand?: {
    contact_id?: Contact
  }
}

export type ConversationDirecao = 'enviada' | 'recebida'

export interface Conversation extends RecordModel {
  mensagem: string
  direcao: ConversationDirecao
  contact_id?: string
  lead_id?: string
  expand?: {
    contact_id?: Contact
    lead_id?: Lead
  }
}

export type QuoteStatus = 'Rascunho' | 'Enviado' | 'Visualizado' | 'Aprovado' | 'Rejeitado'

export interface Quote extends RecordModel {
  codigo?: string
  titulo: string
  lead_id: string
  contact_id?: string
  status: QuoteStatus
  desconto_percentual?: number
  validade?: string
  expand?: {
    lead_id?: Lead
    contact_id?: Contact
    quote_items_via_quote_id?: QuoteItem[]
  }
}

export interface QuoteItem extends RecordModel {
  quote_id: string
  descricao: string
  quantidade: number
  valor_unitario: number
  desconto_percentual?: number
}
