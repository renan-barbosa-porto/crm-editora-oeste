/**
 * Gestão central de sessão PocketBase:
 * - Validação real no boot (exp local + authRefresh no servidor)
 * - Interceptador global: qualquer resposta 401 ou "200 com dados vazios por
 *   auth inválida" derruba a sessão local e redireciona ao /login com aviso,
 *   em qualquer tela, sem tratamento tela a tela.
 * - Vigia a expiração do token em tempo real (scheduleSessionWatch).
 *
 * O PocketBase JS SDK grava a sessão em localStorage sob a chave
 * `pocketbase_auth`, exatamente o que o app usa hoje. Toda a lógica abaixo
 * opera sobre pb.authStore (memória + essa chave), então tokens "expirados no
 * localStorage" (o caso do relato) são detectados aqui.
 */
import pb from '@/lib/pocketbase/client'

const MESSAGE = 'Sua sessão expirou. Entre novamente.'
const STORAGE_KEY = 'session_expired_message'
const EXPIRY_SLACK_MS = 30_000 // margem de segurança para relógio atrasado

// Ref global para o App saber que deve mostrar o aviso de sessão no login
let sessionExpiredFlag = false

export function wasSessionExpired(): boolean {
  return sessionExpiredFlag || localStorage.getItem(STORAGE_KEY) === MESSAGE
}

export function clearSessionExpiredFlag(): void {
  sessionExpiredFlag = false
  localStorage.removeItem(STORAGE_KEY)
}

/** Marca a sessão como expirada: limpa credenciais locais e avisa o login. */
export function logoutInvalidSession(): void {
  const hadToken = Boolean(pb.authStore.isValid)
  try {
    if (hadToken) {
      // persiste o motivo para a tela de Login exibir o aviso
      localStorage.setItem(STORAGE_KEY, MESSAGE)
    }
  } catch {
    /* localStorage indisponível: segue sem persistir o aviso */
  }
  sessionExpiredFlag = true
  pb.authStore.clear()
  redirectToLogin()
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return
  const path = window.location.pathname
  // não redireciona se já estamos no login/cadastro
  if (path === '/login' || path === '/cadastro' || path === '/registrar') {
    return
  }
  // Preserva a rota original para voltar depois do login
  const destino = `/login?expired=1&from=${encodeURIComponent(path + window.location.search)}`
  if (window.location.pathname + window.location.search !== destino) {
    window.location.assign(destino)
  }
}

/**
 * Lê o payload do JWT salvo e devolve o campo `exp` (em segundos).
 * Retorna null se não houver token ou ele não for um JWT parseável.
 */
export function getTokenExp(): number | null {
  try {
    const token = pb.authStore.token
    if (!token) return null
    const payloadB64 = token.split('.')[1]
    if (!payloadB64) return null
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json)
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

/** Há um token salvo e ele ainda não venceu (verificação local, sem rede)? */
export function isTokenLocallyValid(): boolean {
  if (!pb.authStore.isValid || !pb.authStore.token) return false
  const exp = getTokenExp()
  if (exp === null) return true // sem exp legível → decide pelo servidor
  const nowSec = Math.floor(Date.now() / 1000)
  return nowSec < exp - EXPIRY_SLACK_MS / 1000
}

/** Token salvo já venceu? (para o vigia em tempo real) */
export function isTokenExpired(): boolean {
  if (!pb.authStore.isValid || !pb.authStore.token) return false
  const exp = getTokenExp()
  if (exp === null) return false
  return Math.floor(Date.now() / 1000) >= exp
}

export function getLocalToken(): string | null {
  return pb.authStore.token || null
}

/**
 * Validação completa da sessão (boot e uso geral):
 * 1. Sem token salvo → nada a validar; retorna false sem tocar no servidor
 *    (boot anônimo/login ainda não aconteceu — NÃO marca como "expirou").
 * 2. Token vencido localmente (campo exp) → logout + redirect imediato.
 * 3. Token aparenta valer → authRefresh confirma com o servidor; recusado →
 *    logout + redirect.
 * Retorna true somente com sessão confirmada válida.
 */
export async function validateSession(): Promise<boolean> {
  if (!pb.authStore.isValid || !pb.authStore.token) {
    return false
  }

  // 1) Expiração local (campo exp do JWT)
  const exp = getTokenExp()
  const nowSec = Math.floor(Date.now() / 1000)
  if (exp !== null && nowSec >= exp - EXPIRY_SLACK_MS / 1000) {
    logoutInvalidSession()
    return false
  }

  // 2) Confirmação com o servidor
  try {
    await pb.collection('users').authRefresh()
    return true
  } catch (err: any) {
    const status = err?.status ?? err?.response?.status
    // Rede fora: não derruba a sessão (o retry das telas cuida da mensagem)
    const msg = String(err?.message || '').toLowerCase()
    const isNetwork =
      status === 0 ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('load failed')
    if (isNetwork) return true
    logoutInvalidSession()
    return false
  }
}

/**
 * Vigia a expiração do token em tempo real. Checa a cada 30s + no retorno da
 * aba ao foco/visibilidade. Quando o `exp` é alcançado, invalida a sessão.
 */
export function scheduleSessionWatch(onExpired: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  let timer: number | null = null

  const check = () => {
    if (isTokenExpired()) {
      logoutInvalidSession()
      onExpired()
    }
  }

  const start = () => {
    if (timer === null) {
      timer = window.setInterval(check, 30_000)
      check()
    }
  }
  const stop = () => {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible') check()
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', check)
  start()

  return () => {
    stop()
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', check)
  }
}

// ---------------------------------------------------------------------------
// Interceptador global do transporte do SDK
// ---------------------------------------------------------------------------

/**
 * Sessão provavelmente inválida? (consultado pelas telas quando uma listagem
 * volta vazia — o caso "HTTP 200 com lista vazia causado por regras que exigem
 * auth")
 */
export function isSessionProbablyInvalid(): boolean {
  return !pb.authStore.isValid || !isTokenLocallyValid()
}

type SendFn = typeof pb.send

/**
 * Instala o interceptador global: envolve pb.send (usado por TODAS as chamadas
 * do SDK — getList, getFullList, create, update, delete, authRefresh...).
 * - 401 → sessão derrubada no ato + redirect ao login com aviso.
 * - Falha de rede (HTTP N/A, 429, 503) passa intocada: o retry com espera
 *   progressiva das telas trata (comportamento preservado).
 */
export function installSessionInterceptor(): void {
  const originalSend: SendFn = pb.send.bind(pb)

  const wrapped: SendFn = async (path, options) => {
    try {
      return await originalSend(path, options)
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status
      const url = typeof path === 'string' ? path : String(path)
      const isAuthEndpoint = url.includes('/auth-with-password') || url.includes('/auth-refresh')

      // Sessão recusada pelo servidor em qualquer chamada de dados: derruba
      // no ato. Endpoints de login/refresh são excluídos (falha legítima de
      // senha não deve disparar o aviso de sessão expirada).
      if (status === 401 && !isAuthEndpoint) {
        logoutInvalidSession()
      }
      throw err
    }
  }

  ;(pb as any).send = wrapped
}

let installed = false
export function ensureInterceptorInstalled(): void {
  if (!installed) {
    installed = true
    installSessionInterceptor()
  }
}

// Instala imediatamente na importação do módulo
ensureInterceptorInstalled()
