import type { ActionHandler, ActionResult } from 'deepspace/worker'
import type { Env } from '../../worker'
import { roomCommands, type RoomCall } from '../server/mergecourt-workflow'

export async function sendRoomCall(env: Env, call: RoomCall): Promise<ActionResult> {
  const stub = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  const response = await stub.fetch(new Request('https://internal/internal/mergecourt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(call),
  }))
  return response.json() as Promise<ActionResult>
}

function roomAction(name: RoomCall['name']): ActionHandler<Env> {
  return ({ env, userId, params, callerJwt }) => {
    // The action route has already verified the JWT, including the subject.
    const displayName = readVerifiedName(callerJwt)
    return sendRoomCall(env, { name, userId, params, displayName })
  }
}

function readVerifiedName(jwt: string) {
  try {
    const encoded = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
    const name: unknown = JSON.parse(new TextDecoder().decode(bytes)).name
    return typeof name === 'string' ? name.trim().slice(0, 80) : undefined
  } catch {
    return undefined
  }
}

export const actions: Record<string, ActionHandler<Env>> = Object.fromEntries(
  roomCommands.map((name) => [name, roomAction(name)]),
)
