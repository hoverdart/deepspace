import type { Page } from '@playwright/test'
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import { action } from './helpers/rooms'

test('two reviewers join live, keep findings private, reveal, vote, and reopen results', async ({ users, browser, baseURL }) => {
  const [alice, bob] = await users(2)
  const host = alice.page
  const guest = bob.page
  const errors: string[] = []
  for (const page of [host, guest]) page.on('pageerror', (error) => errors.push(error.message))
  await guest.setViewportSize({ width: 390, height: 844 })

  const room = await action(host, 'createRoom', { challengeId: 'reservation-race' })
  expect(room.status).toBe(200)
  await host.goto(`/rooms/${room.data.roomId}`)
  await expect(host.getByRole('heading', { name: 'Reservation race' })).toBeVisible()
  await expect(host.getByRole('button', { name: 'Start review' })).toBeDisabled()
  const invite = await host.getByRole('textbox', { name: 'Invitation link' }).inputValue()
  await guest.goto(invite)
  await guest.getByRole('button', { name: 'Join review' }).click()
  await expect(guest.getByRole('heading', { name: 'Both seats are filled' })).toBeVisible()
  await expect(host.getByRole('heading', { name: 'Both seats are filled' })).toBeVisible()
  await expect(host.getByRole('region', { name: 'Participants' }).getByTitle('Online')).toHaveCount(2)
  await host.getByRole('button', { name: 'Start review' }).click()

  for (const [page, line, title] of [[host, 17, 'Inventory update can race'], [guest, 15, 'Invalid seat count']] as const) {
    await page.getByRole('button', { name: `Annotate line ${line}`, exact: true }).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('textbox', { name: 'Finding title' }).fill(title)
    await page.getByRole('textbox', { name: 'Explanation' }).fill('Two operations can leave an inconsistent result.')
    await page.getByRole('button', { name: 'Save finding' }).click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
  }

  await expect(host.getByText('Invalid seat count', { exact: true })).toHaveCount(0)
  await expect(guest.getByText('Inventory update can race', { exact: true })).toHaveCount(0)
  await host.getByRole('button', { name: 'Submit review' }).click()
  await expect(host.getByRole('button', { name: 'Reveal findings' })).toBeDisabled()
  await guest.getByRole('button', { name: 'Submit review' }).click()
  await host.getByRole('button', { name: 'Reveal findings' }).click()
  for (const page of [host, guest]) {
    await expect(page.getByRole('heading', { name: 'Revealed findings' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Inventory update can race' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Invalid seat count' })).toBeVisible()
  }

  const hostVotes = host.getByRole('group', { name: 'Verdicts for Inventory update can race' })
  const guestVotes = guest.getByRole('group', { name: 'Verdicts for Inventory update can race' })
  await hostVotes.getByRole('button', { name: 'Valid 0', exact: true }).click()
  await expect(guestVotes.getByRole('button', { name: 'Valid 1', exact: true })).toBeVisible()
  await guestVotes.getByRole('button', { name: 'Valid 1', exact: true }).click()
  await expect(hostVotes.getByRole('button', { name: 'Valid 2', exact: true })).toBeVisible()

  await host.getByRole('button', { name: 'Close room' }).click()
  await expect(guest.getByRole('heading', { name: 'Reference guide' })).toBeVisible()
  await expect(guest.getByRole('region', { name: 'Reference guide' }).getByRole('listitem')).toHaveCount(4)
  await Promise.all([host.reload(), guest.reload()])
  for (const page of [host, guest]) {
    await expect(page.getByRole('heading', { name: 'Review results' })).toBeVisible()
    await expect(page.getByText('1 settled', { exact: true })).toBeVisible()
    await expect(page.getByText('1 unresolved', { exact: true })).toBeVisible()
  }
  const account = loadAllTestAccounts().find(({ email }) => email === bob.email)
  if (!account) throw new Error('The reviewer test account is missing.')
  // Use a fresh auth session here so sign-out does not revoke cookies
  // shared with concurrent tests through the SDK's fixture cache.
  const independent = await browser.newContext({ baseURL })
  try {
    const returning = await independent.newPage()
    await returning.goto(invite)
    await signIn(returning, account)
    await expect(returning.getByRole('heading', { name: 'Review results' })).toBeVisible()
    await returning.getByRole('button', { name: 'Sign out' }).click()
    await expect(returning.getByTestId('static-landing')).toBeVisible()
    await returning.goto(invite)
    await signIn(returning, account)
    await expect(returning.getByRole('heading', { name: 'Review results' })).toBeVisible()
  } finally {
    await independent.close()
  }
  expect(await guest.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  expect(errors).toEqual([])
})

async function signIn(page: Page, account: { email: string; password: string }) {
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  const overlay = page.getByTestId('auth-overlay')
  await overlay.getByRole('button', { name: 'Sign in with email' }).click()
  await overlay.getByPlaceholder('Email', { exact: true }).fill(account.email)
  await overlay.getByPlaceholder('Password', { exact: true }).fill(account.password)
  await overlay.getByRole('button', { name: 'Sign in', exact: true }).click()
}
