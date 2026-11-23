import { createServer } from 'node:http'

const calls = new Map()
const port = Number(process.env.MERGECOURT_PROVIDER_PORT)

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost')
  const send = (status, data) => {
    response.writeHead(status, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(data))
  }
  if (url.pathname === '/health') return send(200, { ok: true })
  if (url.pathname === '/count') return send(200, { count: calls.get(url.searchParams.get('key')) ?? 0 })
  if (request.method !== 'POST' || url.pathname !== '/api/integrations/openai/chat-completion') return send(404, {})
  try {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    const source = JSON.parse(body.messages.find(({ role }) => role === 'user').content)
    const key = source.findings[0]?.title
    calls.set(key, (calls.get(key) ?? 0) + 1)
    if (body.model !== 'gpt-4o-mini' || body.max_tokens > 650 || !source.source.includes('function')) {
      return send(400, { success: false, error: 'unexpected_model_request' })
    }
    if (key.includes('fail-provider')) return send(402, { success: false, error: 'insufficient_credits' })
    return send(200, {
      success: true,
      data: { choices: [{ message: { content: [
        '## Consider concurrent writes',
        'A lock or conditional update can make the check atomic. '.repeat(12),
        '## Check the account identifiers',
        'Reject a transfer to the same account.',
      ].join('\n\n') } }] },
    })
  } catch {
    return send(400, { success: false, error: 'bad_test_request' })
  }
}).listen(port, '127.0.0.1')
