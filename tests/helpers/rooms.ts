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

export async function recordSubscription(page: Page, collection: string, where: object, token?: string) {
  // Give this independent connection the same app scope as the real SDK socket.
  const auth = token ?? await getToken(page)
  const appId = process.env.MERGECOURT_TEST_APP_ID ?? 'app_01M7SCCK5KAHBC32DQTGM0BAY6'
  return page.evaluate(async ({ appId, auth, collection, where }) => {
    const url = new URL(`/ws/app:${appId}`, location.href)
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    url.searchParams.set('token', auth)
    const socket = new WebSocket(url)
    return new Promise<unknown[]>((resolve, reject) => {
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
        if (message.type !== 'core.query_result' || message.payload.subscriptionId !== 'privacy-check') return
        clearTimeout(timer)
        socket.close()
        resolve(message.payload.records)
      }
      socket.onerror = () => {
        clearTimeout(timer)
        reject(new Error('Record subscription could not connect'))
      }
    })
  }, { appId, auth, collection, where })
}
