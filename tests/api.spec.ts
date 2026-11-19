import { test, expect } from 'deepspace/testing'
import { action, getToken, recordSubscription, sampleFinding } from './helpers/rooms'

test('room actions require a signed-in caller; private endpoints stay internal', async ({ request }) => {
  expect((await request.get('/api/auth/ok')).ok()).toBeTruthy()
  expect((await request.post('/api/actions/createRoom', { data: { challengeId: 'reservation-race' } })).status()).toBe(401)
  expect((await request.post('/internal/mergecourt', { data: {} })).status()).toBe(404)
  expect((await request.post('/api/tools/execute', { headers: { 'X-App-Action': 'true' }, data: {} })).status()).toBe(404)
})

test('the native invite form redirects only to MergeCourt rooms', async ({ request }) => {
  const roomId = crypto.randomUUID()
  const valid = await request.get('/join', {
    params: { invite: `https://mergecourt.example/rooms/${roomId}/?source=invite` }, maxRedirects: 0,
  })
  expect(valid.status()).toBe(303)
  expect(valid.headers().location).toBe(`/rooms/${roomId}`)
  const invalid = await request.get('/join', {
    params: { invite: 'https://mergecourt.example/unrelated' }, maxRedirects: 0,
  })
  expect(invalid.status()).toBe(303)
  expect(invalid.headers().location).toBe('/#invalid-invite')
})

test('membership, phases, review locks and votes are enforced on the server', async ({ users }) => {
  const [alice, bob, observer] = await users(3)
  const [host, guest, outsider] = [alice.page, bob.page, observer.page]
  await Promise.all([host.goto('/'), guest.goto('/'), outsider.goto('/')])
  const [hostToken, guestToken, outsiderToken] = await Promise.all([getToken(host), getToken(guest), getToken(outsider)])
  const callHost = (name: string, params: object) => action(host, name, params, hostToken)
  const callGuest = (name: string, params: object) => action(guest, name, params, guestToken)
  const callOutsider = (name: string, params: object) => action(outsider, name, params, outsiderToken)

  expect((await callHost('createRoom', { challengeId: 'unknown' })).status).toBe(400)
  const { data: { roomId } } = await callHost('createRoom', { challengeId: 'reservation-race' })
  expect((await callHost('startRoom', { roomId })).status).toBe(409)
  expect((await callGuest('joinRoom', { roomId })).success).toBe(true)
  expect((await callOutsider('joinRoom', { roomId })).status).toBe(409)
  expect((await callGuest('startRoom', { roomId })).status).toBe(403)
  expect((await callHost('startRoom', { roomId })).success).toBe(true)
  expect((await callOutsider('joinRoom', { roomId })).status).toBe(404)
  expect((await callOutsider('getOwnFindings', { roomId })).status).toBe(404)
  expect((await callHost('getReferenceGuide', { roomId })).status).toBe(409)
  expect((await callHost('createFinding', { roomId, finding: sampleFinding('Invalid line', 500) })).status).toBe(400)
  expect((await callGuest('submitReview', { roomId })).status).toBe(409)

  const title = `__test-${Date.now()}__ private draft`
  const { data: { finding } } = await callHost('createFinding', { roomId, finding: sampleFinding(title) })
  const findingId = finding.id
  expect((await callGuest('getOwnFindings', { roomId, authorId: finding.authorId })).data.findings).toEqual([])
  expect((await callGuest('updateFinding', { roomId, findingId, finding: sampleFinding('Wrong author') })).status).toBe(404)
  expect((await callGuest('deleteFinding', { roomId, findingId })).status).toBe(404)
  expect(await recordSubscription(guest, 'private_findings', { sessionId: roomId }, guestToken)).toEqual([])
  expect(await recordSubscription(host, 'private_findings', { sessionId: roomId }, hostToken)).toEqual([])
  expect(await recordSubscription(outsider, 'sessions', { recordId: roomId }, outsiderToken)).toEqual([])
  expect((await callHost('revealRoom', { roomId })).status).toBe(409)

  await callHost('submitReview', { roomId })
  expect((await callHost('deleteFinding', { roomId, findingId })).status).toBe(409)
  expect((await callGuest('submitReview', { roomId, confirmEmpty: true })).success).toBe(true)
  expect((await callGuest('revealRoom', { roomId })).status).toBe(403)
  const reveals = await Promise.all([callHost('revealRoom', { roomId }), callHost('revealRoom', { roomId })])
  expect(reveals.map(({ status }) => status)).toEqual([200, 200])
  const revealed = await recordSubscription(guest, 'sessions', { recordId: roomId }, guestToken)
  expect(revealed).toEqual([expect.objectContaining({
    data: expect.objectContaining({ status: 'REVEALED', findings: [expect.objectContaining({ id: findingId, title })] }),
  })])
  expect(await recordSubscription(guest, 'revealed_findings', { sessionId: roomId }, guestToken)).toEqual([])
  expect(await recordSubscription(outsider, 'sessions', { recordId: roomId }, outsiderToken)).toEqual([])

  const params = { roomId, findingId, verdict: 'valid' }
  expect((await callOutsider('vote', params)).status).toBe(404)
  expect((await callGuest('vote', { ...params, findingId: crypto.randomUUID() })).status).toBe(404)
  const repeated = await Promise.all([callGuest('vote', params), callGuest('vote', params)])
  expect(repeated.map(({ status }) => status)).toEqual([200, 200])
  expect(await recordSubscription(host, 'votes', { sessionId: roomId }, hostToken)).toHaveLength(1)
  expect(await recordSubscription(outsider, 'votes', { sessionId: roomId }, outsiderToken)).toEqual([])
  expect((await callGuest('vote', { ...params, verdict: 'false_positive' })).status).toBe(409)
  expect((await callGuest('closeRoom', { roomId })).status).toBe(403)
  expect((await callHost('closeRoom', { roomId })).success).toBe(true)
  expect((await callHost('vote', params)).status).toBe(409)
  expect((await callOutsider('getReferenceGuide', { roomId })).status).toBe(404)
  expect((await callGuest('getReferenceGuide', { roomId })).data.guide).toHaveLength(4)
})

test('concurrent joins and draft creation respect room limits', async ({ users }) => {
  const [alice, bob, observer] = await users(3)
  const [host, guest, outsider] = [alice.page, bob.page, observer.page]
  const [hostToken, guestToken, outsiderToken] = await Promise.all([getToken(host), getToken(guest), getToken(outsider)])
  const { data: { roomId } } = await action(host, 'createRoom', { challengeId: 'reservation-race' }, hostToken)
  const joins = await Promise.all([action(guest, 'joinRoom', { roomId }, guestToken), action(outsider, 'joinRoom', { roomId }, outsiderToken)])
  expect(joins.map(({ status }) => status).sort()).toEqual([200, 409])
  expect((await action(host, 'startRoom', { roomId }, hostToken)).status).toBe(200)

  const writes = await Promise.all(Array.from({ length: 6 }, (_, index) => action(host, 'createFinding', {
    roomId, finding: sampleFinding(`__test-${Date.now()}__ finding ${index}`),
  }, hostToken)))
  expect(writes.map(({ status }) => status).sort()).toEqual([200, 200, 200, 200, 200, 409])
  expect((await action(host, 'getOwnFindings', { roomId }, hostToken)).data.findings).toHaveLength(5)
})
