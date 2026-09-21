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
  if (!error) return false
  if (error instanceof ClientResponseError) {
    if (error.status === 0) return true
    const orig = error.originalError as any
    if (orig && (orig.name === 'TypeError' || String(orig).includes('Failed to fetch'))) {
      return true
    }
  }
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    return true
  }
  const str = String(error)
  return str.includes('Failed to fetch') || str.includes('NetworkError') || str.includes('net::ERR')
}

export function getErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'
  }

  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'
  }

  // PocketBase status 400 em authWithPassword costuma indicar credenciais inválidas
  if (
    error.status === 400 &&
    (!error.response?.data || Object.keys(error.response.data).length === 0)
  ) {
    return 'Email ou senha incorretos. Verifique suas credenciais.'
  }

  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'Ocorreu um erro inesperado.'
}
