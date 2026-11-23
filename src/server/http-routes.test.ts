import { SESSION_COOKIE } from 'deepspace/worker'
import { Hono } from 'hono'
import { afterEach, expect, it, vi } from 'vitest'
import type { AppContext, Env } from '../../worker.js'
import { registerAuthAndIntegrationRoutes } from './http-routes.js'

afterEach(() => vi.unstubAllGlobals())

it('sets the session cookie while clearing the OAuth return cookie after a code exchange', async () => {
  const app = new Hono<AppContext>()
  registerAuthAndIntegrationRoutes(app)
  const authUrl = 'https://auth.example'
  const env = { AUTH_WORKER_URL: authUrl } as Env
  const room = '/rooms/f202884b-e15c-4cca-b6a4-57813db375d1'
  const exchange = vi.fn().mockResolvedValue(Response.json({ sessionToken: 'test-token' }))
  vi.stubGlobal('fetch', exchange)

  const response = await app.request('/api/auth/oauth-complete?code=test-code', {
    headers: { Cookie: `mergecourt-oauth-return=${encodeURIComponent(room)}` },
  }, env)

  expect(exchange).toHaveBeenCalledWith(`${authUrl}/api/auth/exchange-code`, expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ code: 'test-code' }),
  }))
  expect(response.status).toBe(302)
  expect(response.headers.get('Location')).toBe(room)
  expect(response.headers.getSetCookie()).toEqual([
    expect.stringMatching(/^mergecourt-oauth-return=;.*Max-Age=0/),
    expect.stringContaining(`${SESSION_COOKIE}=test-token`),
  ])
})
