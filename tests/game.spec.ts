import { test, expect } from 'deepspace/testing'
import { action, recordSubscription, sampleFinding } from './helpers/rooms'

test('three players share a countdown, private fixes, spotlight votes, and the final score', async ({ users }) => {
  test.setTimeout(75_000)
  const [alice, bob, carol] = await users(3)
  const host = alice.page
  const guest = bob.page
  const third = carol.page
  await guest.setViewportSize({ width: 390, height: 844 })
  await host.goto('/rooms/new')
  await expect(host.getByRole('heading', { name: 'Choose your case' })).toBeVisible()
  await host.getByRole('button', { name: 'Extreme' }).click()
  await expect(host.getByRole('button', { name: 'Extreme' })).toHaveAttribute('aria-pressed', 'true')
  await expect(host.getByRole('radio')).toHaveCount(4)
  await host.getByRole('combobox', { name: 'Language', exact: true }).selectOption('Go')
  await expect(host.getByRole('radio')).toHaveCount(1)
  await host.getByRole('button', { name: 'Easy' }).click()
  await host.getByRole('radio', { name: /Coupon math/ }).check()
  await host.getByRole('button', { name: 'Create room' }).click()
  const invite = await host.getByRole('textbox', { name: 'Invitation link' }).inputValue()
  const roomId = new URL(invite).pathname.split('/').at(-1)!
  const ownAction = (page: typeof host, name: string, params: object = {}) => action(page, name, { roomId, ...params })
  for (const page of [guest, third]) {
    await page.goto(invite)
    await page.getByRole('button', { name: 'Join game' }).click()
  }
  await expect(host.getByText('3 / 6 seats filled')).toBeVisible()
  await host.getByRole('button', { name: 'Start game' }).click()
  const intro = host.getByRole('dialog', { name: 'Court is in session' })
  await expect(intro).toBeVisible()
  await expect(guest.getByRole('dialog')).toBeVisible()
  await expect(intro.getByText('Earn one point', { exact: false })).toBeHidden()
  expect((await ownAction(host, 'createFinding', { finding: sampleFinding('Too early', 2) })).status).toBe(409)
  await expect(intro.getByText('Earn one point', { exact: false })).toBeVisible()
  for (const number of ['3', '2', '1']) await expect(intro.getByText(number, { exact: true })).toBeVisible()
  await expect(intro).toBeHidden()
  await expect(host.getByRole('timer')).toBeVisible()
  await host.getByText('Need a hint?').click()
  await expect(host.getByText('Try a $40 subtotal with a 25% coupon.')).toBeVisible()

  for (const [page, line, title] of [[host, 2, 'Divide coupon percent by 100'], [guest, 3, 'Round the total sooner']] as const) {
    await page.getByRole('button', { name: `Annotate line ${line}`, exact: true }).click()
    await page.getByRole('textbox', { name: 'Finding title' }).fill(title)
    await page.getByRole('textbox', { name: 'Explanation' }).fill('The result differs from the advertised price.')
    await page.getByRole('textbox', { name: /Proposed fix/ }).fill('return Math.round(subtotal * 100) / 100;')
    await page.getByRole('button', { name: 'Save finding' }).click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await page.getByRole('button', { name: 'Submit review' }).click()
  }
  await expect(guest.getByText('Divide coupon percent by 100')).toHaveCount(0)
  await expect(host.getByText('Round the total sooner')).toHaveCount(0)
  expect((await ownAction(third, 'submitReview', { confirmEmpty: true })).status).toBe(200)

  const firstTitle = 'Divide coupon percent by 100'
  await expect(guest.getByRole('heading', { name: firstTitle })).toBeVisible()
  await expect(guest.getByRole('heading', { name: 'Round the total sooner' })).toHaveCount(0)
  const [room] = await recordSubscription(guest, 'sessions', { recordId: roomId }) as { data: { findings: { id: string }[] } }[]
  const findingId = room.data.findings[0].id
  expect(room.data.findings).toHaveLength(1)
  expect((await ownAction(host, 'vote', { findingId, verdict: 'valid' })).status).toBe(403)
  await guest.getByRole('button', { name: 'Valid', exact: true }).click()
  await expect(guest.getByText('Vote locked · Valid')).toBeVisible()
  expect(await recordSubscription(guest, 'game_votes', { sessionId: roomId })).toEqual([])
  await guest.reload()
  await expect(guest.getByText('Vote locked · Valid')).toBeVisible()
  await third.getByRole('button', { name: 'Valid', exact: true }).click()
  await expect(host.getByText('Reference jury')).toBeVisible()
  await expect(host.getByText('Proposal accepted · +1 point')).toBeVisible()
  await expect(host.getByText('Proposal 2 of 2')).toBeVisible({ timeout: 12_000 })
  await expect(host.getByRole('heading', { name: 'Round the total sooner' })).toBeVisible()
  await expect(host.getByRole('heading', { name: firstTitle })).toHaveCount(0)
  for (const page of [host, third]) await page.getByRole('button', { name: 'False positive', exact: true }).click()
  await expect(guest.getByText('Proposal did not reach a majority')).toBeVisible()
  await expect(host.getByRole('heading', { name: /wins$/ })).toBeVisible({ timeout: 12_000 })
  await expect(host.getByText('1 point', { exact: true })).toBeVisible()
  await expect(guest.getByRole('heading', { name: 'What was wrong with the code?' })).toBeVisible()
  await expect(guest.getByText('Convert percentages to fractions', { exact: true })).toBeVisible()
  expect(await guest.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})

test('an owner-hosted game reveals a model vote and persists it through final scores', async ({ users, request }) => {
  test.setTimeout(65_000)
  const ownerToken = process.env.MERGECOURT_TEST_ADMIN_JWT
  const provider = process.env.MERGECOURT_TEST_AI_FIXTURE
  const liveJury = process.env.MERGECOURT_TEST_LIVE_JURY === '1' && !!process.env.MERGECOURT_TEST_URL
  test.skip(!ownerToken || (!liveJury && (!provider || process.env.DEEPSPACE_API_URL !== provider)), 'Requires an authenticated owner and a local fixture or explicitly enabled live jury.')
  const [player] = await users(1)
  const page = player.page
  await page.goto('/')
  const created = await action(page, 'createRoom', { challengeId: 'coupon-math', mode: 'game' }, ownerToken)
  expect(created.status).toBe(200)
  const { roomId } = created.data
  const owner = (name: string, params: object = {}) => action(page, name, { roomId, ...params }, ownerToken)
  const peer = (name: string, params: object = {}) => action(page, name, { roomId, ...params })
  expect((await peer('joinRoom')).status).toBe(200)
  expect((await owner('startRoom')).status).toBe(200)
  await page.goto(`/rooms/${roomId}`)
  await expect(page.getByRole('button', { name: 'Annotate line 2' })).toBeEnabled({ timeout: 15_000 })
  const title = `Divide the coupon percentage by 100 ${Date.now()}`
  const finding = {
    ...sampleFinding(title, 2), category: 'Correctness',
    explanation: 'A discount of 25 is treated as 25 times the subtotal, not 25 percent.',
    suggestedFix: 'const discount = subtotal * (discountPercent / 100);',
  }
  const proposal = await owner('createFinding', { finding })
  expect(proposal.status).toBe(200)
  expect((await owner('submitReview')).status).toBe(200)
  // The guest starts the vote while the owner has no open game page.
  expect((await peer('submitReview', { confirmEmpty: true })).status).toBe(200)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await page.getByRole('button', { name: 'Valid', exact: true }).click()
  await expect(page.getByText('AI jury', { exact: true })).toBeVisible({ timeout: 25_000 })
  await expect(page.getByText('Proposal accepted · +1 point')).toBeVisible()
  expect(await recordSubscription(page, 'ai_claims', { sessionId: roomId }, ownerToken, 'admin')).toEqual([])
  expect(await recordSubscription(page, 'game_votes', { sessionId: roomId }, ownerToken, 'admin')).toEqual([])
  expect((await owner('requestAiOpinion')).status).toBe(409)
  if (provider) {
    const countUrl = new URL('/count', provider)
    countUrl.searchParams.set('key', title)
    expect(await (await request.get(countUrl.href)).json()).toEqual({ count: 1 })
  }
  await expect(page.getByRole('heading', { name: /wins$/ })).toBeVisible({ timeout: 15_000 })
  await page.reload()
  await page.locator('summary').getByText(title, { exact: true }).click()
  await expect(page.getByText('AI jury', { exact: true })).toBeVisible()
})
