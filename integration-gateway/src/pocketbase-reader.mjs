/**
 * Leitor PocketBase exclusivo de homologação, sem conexões automáticas.
 *
 * O chamador precisa fornecer URL HTTPS permitida, token de acesso restrito
 * e uma função fetch. Jamais usar no browser ou com superuser de produção.
 * O vínculo organização/contato é validado pelo gateway antes desta chamada;
 * este leitor NÃO fornece isolamento multi-tenant por si só.
 */
const PB_ID = /^[a-z0-9]{15}$/i
const LIMIT = 10

function validateConfig(config) {
  if (!config || typeof config !== 'object') throw new Error('reader_not_configured')
  const { baseUrl, allowedHostname, authToken } = config
  if (!baseUrl || !allowedHostname || !authToken) throw new Error('reader_not_configured')
  const url = new URL(baseUrl)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
    url.hostname !== allowedHostname || url.port || url.pathname !== '/') {
    throw new Error('reader_destination_not_allowed')
  }
  if (!/^[a-z0-9.-]+$/i.test(allowedHostname)) throw new Error('reader_destination_not_allowed')
  if (typeof authToken !== 'string' || authToken.length < 12 || /[\r\n]/.test(authToken)) {
    throw new Error('reader_invalid_credentials')
  }
  return url.origin
}

export function createPocketBaseSummaryReader(config, fetchImpl = globalThis.fetch) {
  const origin = validateConfig(config)
  if (typeof fetchImpl !== 'function') throw new Error('reader_fetch_unavailable')
  const timeoutMs = Number.isFinite(config.timeoutMs)
    ? Math.max(500, Math.min(5000, config.timeoutMs))
    : 2500

  async function read(collection, id, params = {}) {
    const path = id
      ? `/api/collections/${collection}/records/${id}`
      : `/api/collections/${collection}/records`
    const url = new URL(path, origin)
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value))
    }
    const response = await fetchImpl(url.toString(), {
      method: 'GET',
      redirect: 'error',
      headers: {
        Authorization: config.authToken,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response?.ok) {
      // Não retornar conteúdo da resposta, pois pode conter informações privadas.
      throw new Error('crm_upstream_unavailable')
    }
    return response.json()
  }

  return async function lookupCrmSummary({ pocketbaseContactId }) {
    if (!PB_ID.test(pocketbaseContactId || '')) throw new Error('invalid_crm_contact_id')

    // Três consultas REST pequenas e sequenciais, nenhuma escrita ou polling.
    // Campos de apresentação apenas; documentos, e-mails, valores e anexos excluídos.
    const contact = await read('contacts', pocketbaseContactId, {
      fields: 'id,nome',
    })
    if (contact?.id !== pocketbaseContactId) throw new Error('invalid_crm_contact_response')

    const filter = `contact_id = '${pocketbaseContactId}'`
    const leads = await read('leads', null, {
      filter,
      page: 1,
      perPage: LIMIT,
      sort: '-created',
      fields: 'id,estagio',
    })
    const quotes = await read('quotes', null, {
      filter,
      page: 1,
      perPage: LIMIT,
      sort: '-created',
      fields: 'id,numero_referencia,status',
    })

    if (!Array.isArray(leads?.items) || !Array.isArray(quotes?.items)) {
      throw new Error('invalid_crm_list_response')
    }

    return {
      crmContact: { id: contact.id, name: contact.nome || '' },
      leads: leads.items.map((lead) => ({ id: lead.id, stage: lead.estagio })),
      quotes: quotes.items.map((quote) => ({
        id: quote.id,
        reference: quote.numero_referencia,
        status: quote.status,
      })),
    }
  }
}
