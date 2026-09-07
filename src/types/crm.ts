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

export type QuoteStatus =
  | 'Rascunho'
  | 'Enviado'
  | 'Visualizado'
  | 'Aprovado'
  | 'Rejeitado'
  | 'Esfriou'

export interface GraficaTiragemRow {
  id?: string
  tiragem: number // ex: 1, 50, 100, 500
  descricao?: string // ex: "1 exemplar (sob demanda)", "50 exemplares"
  valor_unitario: number
  valor_total?: number
}

export interface Quote extends RecordModel {
  codigo?: string
  titulo: string
  lead_id: string
  contact_id?: string
  status: QuoteStatus
  desconto_percentual?: number
  validade?: string
  data_envio?: string
  grafica_especificacoes?: string
  grafica_tiragens?: GraficaTiragemRow[] | string
  condicoes_gerais?: string
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

// Catálogo Global em 2 níveis
export interface QuoteCategory extends RecordModel {
  nome: string
  descricao?: string
  ordem?: number
}

export interface CatalogItem extends RecordModel {
  category_id?: string
  nome: string
  descricao?: string
  valor_padrao?: number
  unidade?: string
  expand?: {
    category_id?: QuoteCategory
  }
}

export interface CompanySettings extends RecordModel {
  nome_comercial: string
  razao_social?: string
  cnpj?: string
  cidade_uf?: string
  telefone?: string
  email?: string
  portal?: string
  prazo_execucao_dias?: number
  condicoes_pagamento?: string
  condicoes_entrega?: string
  validade_proposta_dias?: number
  texto_condicoes_padrao?: string
}
