import { useCallback, useEffect, useRef } from 'react'

/**
 * Agrupa notificações próximas em uma única atualização de tela.
 * Não cria polling e não altera as consultas disparadas na abertura da página
 * ou por ações explícitas do usuário.
 *
 * Quando chegam eventos durante uma atualização em andamento, executa mais
 * uma atualização após o término (com debounce), em vez de sobrepor consultas.
 */
export function useCoalescedRealtimeRefresh(
  refresh: () => Promise<unknown>,
  delayMs = 350,
): () => void {
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runningRef = useRef(false)
  const pendingRef = useRef(false)
  const mountedRef = useRef(false)

  const scheduleRef = useRef<() => void>(() => {})

  const run = useCallback(async () => {
    timerRef.current = null
    if (!mountedRef.current) return

    if (runningRef.current) {
      pendingRef.current = true
      return
    }

    runningRef.current = true
    try {
      await refreshRef.current()
    } catch (err) {
      console.warn('[Realtime] Falha ao atualizar tela:', err)
    } finally {
      runningRef.current = false
      if (pendingRef.current && mountedRef.current) {
        pendingRef.current = false
        scheduleRef.current()
      }
    }
  }, [])

  const schedule = useCallback(() => {
    if (!mountedRef.current) return
    if (runningRef.current) {
      pendingRef.current = true
      return
    }
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { void run() }, delayMs)
  }, [delayMs, run])

  scheduleRef.current = schedule

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      pendingRef.current = false
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  return schedule
}
