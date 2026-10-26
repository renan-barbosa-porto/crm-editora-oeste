import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      errors[field] = (detail as { message: string }).message
    }
  }
  return errors
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof ClientResponseError) {
    return error.status === 0
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      msg.includes('network') ||
      msg.includes('failed to fetch') ||
      msg.includes('autocancelled') ||
      msg.includes('abort')
    )
  }
  return false
}

const FIELD_LABELS_PT_BR: Record<string, string> = {
  nome: 'Nome',
  telefone: 'Telefone',
  email: 'E-mail',
  empresa: 'Empresa',
  endereco: 'Endereço',
  estagio: 'Estágio',
  titulo: 'Título',
  valor_estimado: 'Valor estimado',
  observacoes: 'Observações',
  contact_id: 'Contato vinculado',
  lead_id: 'Lead vinculado',
  quote_id: 'Orçamento vinculado',
  codigo: 'Código',
  status: 'Status',
  descricao: 'Descrição',
  quantidade: 'Quantidade',
  valor_unitario: 'Valor unitário',
}

export function formatFieldErrorMessage(field: string, rawMessage: string): string {
  const label = FIELD_LABELS_PT_BR[field] || field
  const lower = (rawMessage || '').toLowerCase()

  if (
    lower.includes('cannot be blank') ||
    lower.includes('required') ||
    lower.includes('obrigat')
  ) {
    return `O campo "${label}" é obrigatório.`
  }
  if (lower.includes('must be a valid email') || lower.includes('valid email')) {
    return `O campo "${label}" deve ser um e-mail válido.`
  }
  if (lower.includes('already exists') || lower.includes('unique')) {
    return `Já existe um registro com este(a) "${label}".`
  }
  return `${label}: ${rawMessage}`
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'
  }

  const fieldErrors = extractFieldErrors(error)
  const entries = Object.entries(fieldErrors)
  if (entries.length > 0) {
    return entries.map(([field, msg]) => formatFieldErrorMessage(field, msg)).join(' ')
  }

  if (error.message && error.message !== 'Failed to create record.') {
    return error.message
  }

  return 'Não foi possível salvar o registro. Verifique os campos obrigatórios.'
}
