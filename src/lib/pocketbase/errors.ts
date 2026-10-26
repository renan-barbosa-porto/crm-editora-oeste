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

export function isNetworkError(err: unknown): boolean {
  if (!err) return false

  const status = (err as any)?.status ?? (err as any)?.response?.status
  if (status === 0 || status === 429 || status === 502 || status === 503 || status === 504) {
    return true
  }

  const msg = String((err as any)?.message || '').toLowerCase()
  const originalMsg = String((err as any)?.originalError?.message || '').toLowerCase()

  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('load failed') ||
    msg.includes('timeout') ||
    msg.includes('temporarily unavailable') ||
    originalMsg.includes('failed to fetch') ||
    originalMsg.includes('networkerror')
  ) {
    return true
  }

  if ((err as any)?.isAbort === true) {
    return true
  }

  return false
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}
