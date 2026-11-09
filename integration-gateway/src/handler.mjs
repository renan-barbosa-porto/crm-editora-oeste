/**
 * Núcleo independente do gateway CRM -> WhatsApp (pré-homologação).
 *
 * Não inclui servidor HTTP, conexão com PocketBase, credenciais nem rotas públicas.
 * Todas as dependências devem ser injetadas por um adaptador privado autorizado.
 * Na ausência de dependências a resposta é 503 (fail closed).
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const POCKETBASE_ID_PATTERN = /^[a-z0-9]{15}$/i

function respond(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: payload,
  }
}

function normalizeSummary(summary, linkedCrmContactId) {
  const contact = summary?.crmContact
  if (!contact || contact.id !== linkedCrmContactId) {
    return null
  }

  return {
    status: 'linked',
    crmContact: {
      id: contact.id,
      name: typeof contact.name === 'string' ? contact.name.slice(0, 160) : '',
    },
    leads: (Array.isArray(summary.leads) ? summary.leads : [])
      .filter((lead) => POCKETBASE_ID_PATTERN.test(lead?.id || ''))
      .slice(0, 10)
      .map((lead) => ({
        id: lead.id,
        stage: typeof lead.stage === 'string' ? lead.stage.slice(0, 80) : '',
      })),
    quotes: (Array.isArray(summary.quotes) ? summary.quotes : [])
      .filter((quote) => POCKETBASE_ID_PATTERN.test(quote?.id || ''))
      .slice(0, 10)
      .map((quote) => ({
        id: quote.id,
        reference: typeof quote.reference === 'string' ? quote.reference.slice(0, 80) : '',
        status: typeof quote.status === 'string' ? quote.status.slice(0, 80) : '',
      })),
    limits: { leads: 10, quotes: 10 },
  }
}

/**
 * Contratos injetados pelo futuro adaptador privado:
 *  authorize(request): {authenticated, authorized, organizationId, operatorId}
 *  findVerifiedLink({organizationId, whatsappContactId, instanceId}):
 *      null | {status:'verified', organizationId, whatsappContactId, instanceId,
 *              pocketbaseContactId} | {status:'ambiguous'}
 *  lookupCrmSummary({organizationId, pocketbaseContactId}): object
 *
 * O adaptador deve verificar tenant, instância e perfil antes de qualquer busca.
 * A função não consulta banco, não faz polling e não altera registros.
 */
export async function handleCrmSummary(request, deps = {}) {
  if (request?.method !== 'GET') {
    return respond(405, { error: 'method_not_allowed' })
  }

  let url
  try {
    url = new URL(request.url, 'http://gateway.invalid')
  } catch {
    return respond(400, { error: 'invalid_request' })
  }

  const match = /^\/api\/internal\/crm\/v1\/contacts\/([^/]+)\/summary$/.exec(url.pathname)
  if (!match) return respond(404, { error: 'not_found' })

  const whatsappContactId = match[1]
  const instanceId = url.searchParams.get('instanceId')
  if (!UUID_PATTERN.test(whatsappContactId) || !UUID_PATTERN.test(instanceId || '')) {
    return respond(400, { error: 'invalid_identifier' })
  }

  if (
    typeof deps.authorize !== 'function' ||
    typeof deps.findVerifiedLink !== 'function' ||
    typeof deps.lookupCrmSummary !== 'function'
  ) {
    return respond(503, { error: 'integration_not_configured' })
  }

  let identity
  try {
    identity = await deps.authorize(request)
  } catch {
    return respond(503, { error: 'authorization_unavailable' })
  }

  if (!identity?.authenticated) {
    return respond(401, { error: 'unauthorized' })
  }
  if (!identity.authorized || !UUID_PATTERN.test(identity.organizationId || '') || !identity.operatorId) {
    return respond(403, { error: 'forbidden' })
  }

  try {
    const key = { organizationId: identity.organizationId, whatsappContactId, instanceId }
    const link = await deps.findVerifiedLink(key)
    if (link?.status === 'ambiguous') {
      return respond(409, { error: 'ambiguous_identity' })
    }
    if (!link) {
      return respond(200, { status: 'unlinked', crmContact: null, leads: [], quotes: [] })
    }
    if (
      link.status !== 'verified' ||
      link.organizationId !== key.organizationId ||
      link.whatsappContactId !== whatsappContactId ||
      link.instanceId !== instanceId ||
      !POCKETBASE_ID_PATTERN.test(link.pocketbaseContactId || '')
    ) {
      return respond(403, { error: 'invalid_link_scope' })
    }

    const summary = await deps.lookupCrmSummary({
      organizationId: identity.organizationId,
      pocketbaseContactId: link.pocketbaseContactId,
    })
    const payload = normalizeSummary(summary, link.pocketbaseContactId)
    if (!payload) return respond(502, { error: 'invalid_crm_response' })
    return respond(200, payload)
  } catch {
    // Não expor erros internos, tokens, dados comerciais ou mensagens no retorno.
    return respond(503, { error: 'crm_temporarily_unavailable' })
  }
}
