import { test, expect } from 'deepspace/testing'
import { action, getToken, recordSubscription, sampleFinding } from './helpers/rooms'

const ownerToken = process.env.MERGECOURT_TEST_ADMIN_JWT

test('a genuine app admin cannot subscribe to room records without membership', async ({ users }) => {
  test.skip(!ownerToken, 'Set MERGECOURT_TEST_ADMIN_JWT to the signed-in app owner JWT.')
  const [host, reviewer] = await users(2)
  await host.page.goto('/')
  const [hostToken, reviewerToken] = await Promise.all([getToken(host.page), getToken(reviewer.page)])
  const { data: { roomId } } = await action(host.page, 'createRoom', { challengeId: 'reservation-race' }, hostToken)
  const call = (name: string, params: object = {}) => action(host.page, name, { roomId, ...params }, hostToken)
  await action(reviewer.page, 'joinRoom', { roomId }, reviewerToken)
  await call('startRoom')
  const finding = sampleFinding(`__test-${Date.now()}__ private admin check`)
  expect((await call('createFinding', { finding })).status).toBe(200)

  expect(await recordSubscription(host.page, 'private_findings', { sessionId: roomId }, ownerToken, 'admin')).toEqual([])
  expect(await recordSubscription(host.page, 'sessions', { recordId: roomId }, ownerToken, 'admin')).toEqual([])
  expect((await action(host.page, 'getOwnFindings', { roomId }, ownerToken)).status).toBe(404)
})

test('reveal recovers a partially staged room before publishing any finding', async ({ users }) => {
  test.skip(!ownerToken || !!process.env.MERGECOURT_TEST_URL, 'Requires the local owner-only debug fixture.')
  const [host, reviewer] = await users(2)
  await reviewer.page.goto('/')
  const [hostToken, reviewerToken] = await Promise.all([getToken(host.page), getToken(reviewer.page)])
  const { data: { roomId } } = await action(host.page, 'createRoom', { challengeId: 'reservation-race' }, hostToken)
  const call = (name: string, params: object = {}) => action(host.page, name, { roomId, ...params }, hostToken)
  const peer = (name: string, params: object = {}) => action(reviewer.page, name, { roomId, ...params }, reviewerToken)
  await peer('joinRoom')
  await call('startRoom')

  const first = await call('createFinding', { finding: sampleFinding(`__test-${Date.now()}__ staged first`, 13) })
  const second = await peer('createFinding', { finding: sampleFinding(`__test-${Date.now()}__ staged second`, 17) })
  await call('submitReview')
  await peer('submitReview')

  const alphaId = first.data.finding.id
  const betaId = second.data.finding.id
  const sql = (statement: string, params: string[]) => host.page.request.post('/api/debug/sql', {
    headers: { Authorization: `Bearer ${ownerToken}` }, data: { sql: statement, params },
  })
  const fields = [
    '_row_id', '_created_by', '_created_at', '_updated_at', 'col_sessionid',
    'col_authorid', 'col_linestart', 'col_lineend', 'col_title', 'col_explanation',
    'col_suggestedfix', 'col_severity', 'col_category',
  ].join(', ')
  const inserted = await sql(`INSERT INTO c_revealed_findings (${fields}, col_sourcefindingid)
    SELECT ${fields}, _row_id FROM c_private_findings WHERE _row_id = ? AND col_sessionid = ?`, [alphaId, roomId])
  expect(inserted.ok()).toBeTruthy()
  expect(await recordSubscription(reviewer.page, 'revealed_findings', { sessionId: roomId }, reviewerToken)).toEqual([])
  expect(await recordSubscription(reviewer.page, 'sessions', { recordId: roomId }, reviewerToken)).toEqual([
    expect.objectContaining({ data: expect.objectContaining({ status: 'REVIEWING', findings: [] }) }),
  ])

  expect((await call('revealRoom')).status).toBe(200)
  expect(await recordSubscription(reviewer.page, 'sessions', { recordId: roomId }, reviewerToken)).toEqual([
    expect.objectContaining({ data: expect.objectContaining({
      status: 'REVEALED', findings: [expect.objectContaining({ id: alphaId }), expect.objectContaining({ id: betaId })],
    }) }),
  ])
})
