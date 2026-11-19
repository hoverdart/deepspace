import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect } from 'deepspace/testing'

export async function getToken(page: Page): Promise<string> {
  const tokenResponse = await page.request.post('/api/auth/token', { headers: { 'Content-Type': 'application/json' } })
  expect(tokenResponse.ok()).toBeTruthy()
  const { token } = await tokenResponse.json()
  return token
}

export async function action(page: Page, name: string, params: object, token?: string) {
  const response = await page.request.post(`/api/actions/${name}`, {
    headers: { Authorization: `Bearer ${token ?? await getToken(page)}` },
    data: params,
  })
  return { status: response.status(), ...(await response.json()) }
}

export function sampleFinding(title: string, lineStart = 14) {
  return {
    lineStart, lineEnd: lineStart, category: 'Concurrency', severity: 'High',
    title, explanation: 'The database operation can race with another request.', suggestedFix: 'Make the update conditional.',
  }
}

export async function recordSubscription(page: Page, collection: string, where: object, token?: string, expectedRole?: string) {
  // Give this independent connection the same app scope as the real SDK socket.
  const auth = token ?? await getToken(page)
  const config = readFileSync(new URL('../../wrangler.toml', import.meta.url), 'utf8')
  const appId = process.env.MERGECOURT_TEST_APP_ID ?? config.match(/DEEPSPACE_APP_ID = "([^"]+)"/)?.[1]
  if (!appId) throw new Error('No test app ID configured')
  const result = await page.evaluate(async ({ appId, auth, collection, where }) => {
    const url = new URL(`/ws/app:${appId}`, location.href)
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    url.searchParams.set('token', auth)
    const socket = new WebSocket(url)
    return new Promise<{ records: unknown[]; role?: string }>((resolve, reject) => {
      let role: string | undefined
      const timer = setTimeout(() => {
        socket.close()
        reject(new Error('No record subscription result'))
      }, 5000)
      socket.onopen = () => socket.send(JSON.stringify({
        type: 'core.subscribe',
        payload: { subscriptionId: 'privacy-check', query: { collection, where } },
      }))
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data)
        if (message.type === 'user.info') role = message.payload.role
        if (message.type !== 'core.query_result' || message.payload.subscriptionId !== 'privacy-check') return
        clearTimeout(timer)
        socket.close()
        resolve({ records: message.payload.records, role })
      }
      socket.onerror = () => {
        clearTimeout(timer)
        reject(new Error('Record subscription could not connect'))
      }
    })
  }, { appId, auth, collection, where })
  if (expectedRole) expect(result.role).toBe(expectedRole)
  return result.records
}
