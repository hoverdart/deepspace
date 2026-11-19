import type { ActionResult, GetActionData, MutateActionData, QueryActionData } from 'deepspace/worker'

type RecordFetch = (request: Request) => Promise<Response>

export function createRoomRecords(fetchRecord: RecordFetch, userId: string) {
  async function run<T>(tool: string, params: Record<string, unknown>) {
    const response = await fetchRecord(new Request('https://internal/api/tools/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
        'X-App-Action': 'true',
      },
      body: JSON.stringify({ tool, params }),
    }))
    return response.json() as Promise<ActionResult<T>>
  }

  return {
    async get<T extends Record<string, unknown>>(collection: string, recordId: string) {
      const result = await run<GetActionData<T>>('records.get', { collection, recordId })
      if (result.success) return result.data.record
      if (/not found/i.test(result.error)) return null
      throw new Error('Record lookup failed.')
    },
    async query<T extends Record<string, unknown>>(collection: string, where: Record<string, string>) {
      const result = await run<QueryActionData<T>>('records.query', { collection, where, limit: 50 })
      if (!result.success) throw new Error('Record query failed.')
      return result.data.records
    },
    create: (collection: string, data: Record<string, unknown>, recordId?: string) =>
      run<MutateActionData>('records.create', { collection, data, recordId }),
    update: (collection: string, recordId: string, data: Record<string, unknown>) =>
      run<MutateActionData>('records.update', { collection, recordId, data }),
    remove: (collection: string, recordId: string) =>
      run<MutateActionData>('records.delete', { collection, recordId }),
  }
}
