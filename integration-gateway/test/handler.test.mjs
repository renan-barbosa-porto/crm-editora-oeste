import test from 'node:test'
import assert from 'node:assert/strict'
import { handleCrmSummary } from '../src/handler.mjs'

const organizationId = '96b9f6a9-0fe3-4b88-ae3d-cbc7ca819d4d'
const whatsappContactId = 'ca53408b-f443-4fc4-984f-41c2aab806a1'
const instanceId = 'ad3ac2cf-39af-489d-9038-5f5ee9e635a2'
const crmId = 'abcdefghijklmno'
const uri = `/api/internal/crm/v1/contacts/${whatsappContactId}/summary?instanceId=${instanceId}`
const request = { method: 'GET', url: uri }

const baseDeps = () => ({
  authorize: async () => ({
    authenticated: true, authorized: true, organizationId, operatorId: 'operator-1',
  }),
  findVerifiedLink: async (key) => ({
    ...key, status: 'verified', pocketbaseContactId: crmId,
  }),
  lookupCrmSummary: async () => ({
    crmContact: { id: crmId, name: 'Cliente de exemplo', secret: 'never return' },
    leads: [{ id: '1234567890abcde', stage: 'Novo', note: 'private' }],
    quotes: [{ id: 'abcde1234567890', reference: 'ORC-1', status: 'Enviado', value: 999 }],
  }),
})

test('fails closed when integration is not configured', async () => {
  const response = await handleCrmSummary(request)
  assert.equal(response.statusCode, 503)
  assert.equal(response.body.error, 'integration_not_configured')
})

test('rejects non-GET requests without calling dependencies', async () => {
  const response = await handleCrmSummary({ ...request, method: 'POST' }, baseDeps())
  assert.equal(response.statusCode, 405)
})

test('rejects invalid UUIDs without consulting data', async () => {
  const response = await handleCrmSummary({
    method: 'GET',
    url: '/api/internal/crm/v1/contacts/123/summary?instanceId=invalid',
  }, baseDeps())
  assert.equal(response.statusCode, 400)
})

test('rejects invalid path', async () => {
  const response = await handleCrmSummary({ ...request, url: '/admin/secrets' }, baseDeps())
  assert.equal(response.statusCode, 404)
})

test('denies unauthenticated and unauthorized users', async () => {
  const unauthenticated = await handleCrmSummary(request, {
    ...baseDeps(), authorize: async () => ({ authenticated: false }),
  })
  const forbidden = await handleCrmSummary(request, {
    ...baseDeps(),
    authorize: async () => ({ authenticated: true, authorized: false, organizationId }),
  })
  assert.equal(unauthenticated.statusCode, 401)
  assert.equal(forbidden.statusCode, 403)
})

test('no verified link produces an unlinked response without CRM fetch', async () => {
  let crmCalls = 0
  const response = await handleCrmSummary(request, {
    ...baseDeps(),
    findVerifiedLink: async () => null,
    lookupCrmSummary: async () => { crmCalls++; throw new Error('must not run') },
  })
  assert.equal(response.statusCode, 200)
  assert.equal(response.body.status, 'unlinked')
  assert.equal(crmCalls, 0)
})

test('ambiguous identities return conflict without leaking candidates', async () => {
  const response = await handleCrmSummary(request, {
    ...baseDeps(),
    findVerifiedLink: async () => ({ status: 'ambiguous', candidates: ['sensitive'] }),
  })
  assert.equal(response.statusCode, 409)
  assert.equal(JSON.stringify(response.body).includes('sensitive'), false)
})

test('rejects cross-organization links before CRM fetch', async () => {
  let calls = 0
  const response = await handleCrmSummary(request, {
    ...baseDeps(),
    findVerifiedLink: async (key) => ({
      ...key, organizationId: whatsappContactId, status: 'verified', pocketbaseContactId: crmId,
    }),
    lookupCrmSummary: async () => { calls++; return {} },
  })
  assert.equal(response.statusCode, 403)
  assert.equal(calls, 0)
})

test('returns a whitelisted summary and strips secrets and financial values', async () => {
  const response = await handleCrmSummary(request, baseDeps())
  assert.equal(response.statusCode, 200)
  assert.equal(response.headers['cache-control'], 'no-store')
  assert.deepEqual(response.body, {
    status: 'linked',
    crmContact: { id: crmId, name: 'Cliente de exemplo' },
    leads: [{ id: '1234567890abcde', stage: 'Novo' }],
    quotes: [{ id: 'abcde1234567890', reference: 'ORC-1', status: 'Enviado' }],
    limits: { leads: 10, quotes: 10 },
  })
})

test('limits leads and quotes to ten records each', async () => {
  const deps = baseDeps()
  deps.lookupCrmSummary = async () => ({
    crmContact: { id: crmId, name: 'Cliente' },
    leads: Array.from({ length: 40 }, (_, i) => ({
      id: String(i).padStart(15, '0'), stage: 'Novo',
    })),
    quotes: Array.from({ length: 40 }, (_, i) => ({
      id: String(i).padStart(15, '0'), status: 'Rascunho',
    })),
  })
  const response = await handleCrmSummary(request, deps)
  assert.equal(response.body.leads.length, 10)
  assert.equal(response.body.quotes.length, 10)
})

test('does not turn CRM outage into an empty contact result', async () => {
  const response = await handleCrmSummary(request, {
    ...baseDeps(),
    lookupCrmSummary: async () => { throw new Error('secret connection info') },
  })
  assert.equal(response.statusCode, 503)
  assert.equal(response.body.error, 'crm_temporarily_unavailable')
  assert.equal(JSON.stringify(response.body).includes('secret'), false)
})

test('rejects a CRM response referencing another contact', async () => {
  const response = await handleCrmSummary(request, {
    ...baseDeps(),
    lookupCrmSummary: async () => ({
      crmContact: { id: '1234567890abcde', name: 'Outro' },
    }),
  })
  assert.equal(response.statusCode, 502)
})
