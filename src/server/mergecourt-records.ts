import { RECORD_NOT_FOUND } from 'deepspace/worker'
import type { ActionResult, GetActionData, MutateActionData, QueryActionData } from 'deepspace/worker'

import type { Env } from '../../worker'
import type { RoomCall } from './mergecourt-workflow'

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
      if (result.error === RECORD_NOT_FOUND) return null
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

export async function sendRoomCall(env: Env, call: RoomCall): Promise<ActionResult> {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  const response = await stub.fetch(new Request('https://internal/internal/mergecourt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(call),
  }))
  return response.json() as Promise<ActionResult>
}
