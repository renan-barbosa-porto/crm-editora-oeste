import test from 'node:test'
import assert from 'node:assert/strict'
import { createPocketBaseSummaryReader } from '../src/pocketbase-reader.mjs'

const crmId = 'abcdefghijklmno'
const config = {
  baseUrl: 'https://crm-hml.example.test/',
  allowedHostname: 'crm-hml.example.test',
  authToken: 'mock_token_not_a_real_secret',
  timeoutMs: 1000,
}

function fakeReader(responses, calls) {
  return createPocketBaseSummaryReader(config, async (url, options) => {
    calls.push({ url, options })
    const response = responses.shift()
    if (!response) throw new Error('unexpected_request')
    return { ok: true, json: async () => response }
  })
}

test('rejects missing credentials and non-HTTPS destinations', () => {
  assert.throws(() => createPocketBaseSummaryReader({ ...config, authToken: '' }), /reader_not_configured/)
  assert.throws(() => createPocketBaseSummaryReader({ ...config, baseUrl: 'http://crm-hml.example.test/' }), /reader_destination_not_allowed/)
  assert.throws(() => createPocketBaseSummaryReader({ ...config, baseUrl: 'https://other.example.test/' }), /reader_destination_not_allowed/)
  assert.throws(() => createPocketBaseSummaryReader({ ...config, baseUrl: 'https://crm-hml.example.test@evil.test/' }), /reader_destination_not_allowed/)
  assert.throws(() => createPocketBaseSummaryReader({ ...config, baseUrl: 'https://crm-hml.example.test:8443/' }), /reader_destination_not_allowed/)
})

test('requires an exact PocketBase record ID before network', async () => {
  const calls = []
  const reader = fakeReader([], calls)
  await assert.rejects(reader({ pocketbaseContactId: '../unsafe' }), /invalid_crm_contact_id/)
  assert.equal(calls.length, 0)
})

test('requests only three authorized, read-only projections', async () => {
  const calls = []
  const reader = fakeReader([
    { id: crmId, nome: 'Cliente exemplo', email: 'private' },
    { items: [{ id: '1234567890abcde', estagio: 'Novo' }] },
    { items: [{ id: 'abcde1234567890', numero_referencia: 'ORC-1', status: 'Enviado' }] },
  ], calls)
  const result = await reader({ pocketbaseContactId: crmId })
  assert.deepEqual(result, {
    crmContact: { id: crmId, name: 'Cliente exemplo' },
    leads: [{ id: '1234567890abcde', stage: 'Novo' }],
    quotes: [{ id: 'abcde1234567890', reference: 'ORC-1', status: 'Enviado' }],
  })
  assert.equal(calls.length, 3)
  for (const call of calls) {
    assert.equal(call.options.method, 'GET')
    assert.equal(call.options.redirect, 'error')
    assert.equal(call.options.headers.Authorization, config.authToken)
    assert.ok(call.url.startsWith(config.baseUrl))
    assert.equal(call.options.body, undefined)
  }
  assert.match(calls[0].url, /fields=id%2Cnome/)
  assert.match(calls[1].url, /fields=id%2Cestagio/)
  assert.match(calls[2].url, /fields=id%2Cnumero_referencia%2Cstatus/)
  assert.match(calls[1].url, /perPage=10/)
  assert.match(calls[2].url, /perPage=10/)
  assert.equal(JSON.stringify(result).includes('private'), false)
})

test('rejects inconsistent contact IDs and stops before querying leads', async () => {
  const calls = []
  const reader = fakeReader([{ id: '1234567890abcde', nome: 'Outro' }], calls)
  await assert.rejects(reader({ pocketbaseContactId: crmId }), /invalid_crm_contact_response/)
  assert.equal(calls.length, 1)
})

test('does not misreport unauthorized upstream responses as empty CRM data', async () => {
  const reader = createPocketBaseSummaryReader(config, async () => ({
    ok: false,
    status: 403,
    json: async () => ({ message: 'secret upstream detail' }),
  }))
  await assert.rejects(reader({ pocketbaseContactId: crmId }), /crm_upstream_unavailable/)
})

test('rejects malformed list payloads instead of reporting zero items', async () => {
  const reader = fakeReader([
    { id: crmId, nome: 'Cliente' },
    { items: null },
    { items: [] },
  ], [])
  await assert.rejects(reader({ pocketbaseContactId: crmId }), /invalid_crm_list_response/)
})
