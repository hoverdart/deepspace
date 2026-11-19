import { test, expect } from 'deepspace/testing'
import { action, getToken, recordSubscription, sampleFinding } from './helpers/rooms'

const ownerToken = process.env.MERGECOURT_TEST_ADMIN_JWT
const provider = process.env.MERGECOURT_TEST_AI_FIXTURE

for (const providerFails of [false, true]) {
  test(`AI claim permits one provider request and persists a ${providerFails ? 'failure' : 'result'}`, async ({ users, request }) => {
    test.skip(!ownerToken || !provider || !!process.env.MERGECOURT_TEST_URL, 'Requires a local owner session and mock provider.')
    test.skip(process.env.DEEPSPACE_API_URL !== provider, 'Route DeepSpace’s external API boundary to the mock.')
    const [reviewer] = await users(1)
    const page = reviewer.page
    await page.goto('/')
    const guestToken = await getToken(page)
    const { data: { roomId } } = await action(page, 'createRoom', { challengeId: 'balance-transfer' }, ownerToken)
    const owner = (name: string, params: object = {}) => action(page, name, { roomId, ...params }, ownerToken)
    const peer = (name: string, params: object = {}) => action(page, name, { roomId, ...params }, guestToken)
    expect((await owner('requestAiOpinion')).status).toBe(409)
    await peer('joinRoom')
    await owner('startRoom')
    const title = `__test-${Date.now()}__ ${providerFails ? 'fail-provider' : 'successful-provider'}`
    await peer('createFinding', { finding: sampleFinding(title) })
    expect(await recordSubscription(page, 'private_findings', { sessionId: roomId }, ownerToken, 'admin')).toEqual([])
    await owner('submitReview', { confirmEmpty: true })
    await peer('submitReview')
    await owner('revealRoom')

    expect((await owner('getAiAvailability')).data.canRequest).toBe(true)
    expect((await peer('requestAiOpinion')).status).toBe(403)
    expect((await owner('completeAiOpinion', { cards: [] })).status).toBe(404)
    const direct = await page.request.post('/api/integrations/openai/chat-completion', {
      headers: { Authorization: `Bearer ${guestToken}` }, data: {},
    })
    expect(direct.status()).toBe(404)

    const calls = await Promise.all([owner('requestAiOpinion'), owner('requestAiOpinion')])
    expect(calls.map(({ status }) => status).sort()).toEqual([200, 409])
    expect(await recordSubscription(page, 'ai_claims', { sessionId: roomId }, ownerToken, 'admin')).toEqual([])
    const countUrl = new URL('/count', provider)
    countUrl.searchParams.set('key', title)
    expect(await (await request.get(countUrl.href)).json()).toEqual({ count: 1 })

    await page.goto(`/rooms/${roomId}`)
    const opinion = page.getByRole('region', { name: 'AI second opinion' })
    await expect(opinion).toBeVisible()
    if (providerFails) {
      await expect(opinion.getByText('The AI opinion was unavailable for this room.')).toBeVisible()
    } else {
      await expect(opinion.getByRole('heading', { name: 'Consider concurrent writes' })).toBeVisible()
    }
    await owner('closeRoom')
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Review results' })).toBeVisible()
    await expect(opinion).toBeVisible()
  })
}
