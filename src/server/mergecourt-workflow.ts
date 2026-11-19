import type { ActionResult } from 'deepspace/worker'
import { z } from 'zod'
import { getChallenge } from '../mergecourt/challenges'
import { aiCardsSchema, findingSchema, roomIdSchema } from '../mergecourt/validation'
import { verdictChoices, type AiReview, type Finding, type FindingInput, type Session, type Submission, type Vote } from '../mergecourt/types'
import type { createRoomRecords } from './mergecourt-records'

type Records = ReturnType<typeof createRoomRecords>
type StoredFinding = FindingInput & { sessionId: string; authorId: string }

export const roomCommands = [
  'createRoom', 'getRoomInvite', 'joinRoom', 'startRoom', 'getOwnFindings', 'createFinding', 'updateFinding',
  'deleteFinding', 'submitReview', 'revealRoom', 'vote', 'closeRoom', 'getReferenceGuide', 'getAiAvailability',
] as const
export type RoomCommand = (typeof roomCommands)[number]

export type RoomCall = {
  name: RoomCommand | 'authorizePresence' | 'claimAiOpinion' | 'completeAiOpinion'
  params: Record<string, unknown>
  userId: string
  displayName?: string
}

class RoomError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message)
  }
}

const ok = <T>(data: T): ActionResult<T> => ({ success: true, data })

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new RoomError(result.error.issues[0].message, 400)
  return result.data
}

function confirmWrite(result: ActionResult) {
  if (!result.success) throw new Error('Record write failed.')
}

function presentFinding(id: string, data: StoredFinding): Finding {
  const { authorId, lineStart, lineEnd, category, severity, title, explanation, suggestedFix } = data
  return { id, authorId, lineStart, lineEnd, category, severity, title, explanation, suggestedFix }
}

export async function executeRoomCall(
  call: RoomCall,
  records: Records,
  config: { referenceGuide?: string; aiOwner?: string },
): Promise<ActionResult> {
  try {
    return await runRoomCall(call, records, config)
  } catch (error) {
    if (error instanceof RoomError) {
      return { success: false, error: error.message, status: error.status }
    }
    console.error('MergeCourt record operation failed', call.name, error instanceof Error ? error.message : '')
    return { success: false, error: 'The room could not be updated. Try again.', status: 503 }
  }
}

async function runRoomCall(
  { name, params, userId, displayName }: RoomCall,
  records: Records,
  config: { referenceGuide?: string; aiOwner?: string },
) {
  if (name === 'createRoom') {
    const challengeId = parse(z.string().max(80), params.challengeId)
    if (!getChallenge(challengeId)) throw new RoomError('Choose a challenge from the list.', 400)
    const roomId = crypto.randomUUID()
    const data: Session = {
      challengeId,
      status: 'LOBBY',
      hostId: userId,
      collaborators: [userId],
      participants: [{ id: userId, name: displayName || 'Host' }],
      findings: [],
    }
    confirmWrite(await records.create('sessions', data, roomId))
    return ok({ roomId })
  }

  const roomId = parse(roomIdSchema, params.roomId)
  const session = (await records.get<Session>('sessions', roomId))?.data
  if (name === 'getRoomInvite') {
    return ok({ joinable: session?.status === 'LOBBY' && session.collaborators.length < 2 })
  }
  const member = session?.collaborators.includes(userId) ?? false
  const host = session?.hostId === userId
  if (!session || (!member && (name !== 'joinRoom' || session.status !== 'LOBBY'))) {
    throw new RoomError('This room is unavailable.', 404)
  }

  const ownFindings = () => records.query<StoredFinding>('private_findings', { sessionId: roomId, authorId: userId })
  const ownSubmission = () => records.query<Submission>('submissions', { sessionId: roomId, reviewerId: userId })

  function requireHost() {
    if (!host) throw new RoomError('Only the host can do that.', 403)
  }

  function requirePhase(phase: Session['status']) {
    if (session?.status !== phase) throw new RoomError('This action is unavailable in the current phase.')
  }

  async function requireEditableReview() {
    requirePhase('REVIEWING')
    if ((await ownSubmission()).length) throw new RoomError('Your review is locked.')
  }

  async function requireOwnFinding() {
    const findingId = parse(z.uuid(), params.findingId)
    const row = await records.get<StoredFinding>('private_findings', findingId)
    if (!row || row.data.authorId !== userId || row.data.sessionId !== roomId) {
      throw new RoomError('This finding is unavailable.', 404)
    }
    return row.recordId
  }

  function readFinding(): FindingInput {
    const finding = parse(findingSchema, params.finding)
    const challenge = getChallenge(session!.challengeId)
    if (!challenge || finding.lineEnd > challenge.source.split('\n').length) {
      throw new RoomError('Select lines in the challenge source.', 400)
    }
    return finding
  }

  switch (name) {
    case 'authorizePresence':
      return ok({})
    case 'joinRoom': {
      if (member) return ok({ roomId })
      if (session.collaborators.length >= 2) throw new RoomError('Both seats in this room are filled.')
      confirmWrite(await records.update('sessions', roomId, {
        collaborators: [...session.collaborators, userId],
        participants: [...session.participants, { id: userId, name: displayName || 'Reviewer' }],
      }))
      return ok({ roomId })
    }
    case 'startRoom':
      requireHost()
      requirePhase('LOBBY')
      if (session.collaborators.length !== 2) throw new RoomError('Wait for a second reviewer.')
      confirmWrite(await records.update('sessions', roomId, { status: 'REVIEWING' }))
      return ok({})
    case 'getOwnFindings': {
      const findings = (await ownFindings()).map((row) => presentFinding(row.recordId, row.data))
      return ok({ findings })
    }
    case 'createFinding': {
      await requireEditableReview()
      const finding = readFinding()
      if ((await ownFindings()).length >= 5) throw new RoomError('Each reviewer can file up to five findings.')
      const id = crypto.randomUUID()
      confirmWrite(await records.create('private_findings', { ...finding, sessionId: roomId, authorId: userId }, id))
      return ok({ finding: presentFinding(id, { ...finding, sessionId: roomId, authorId: userId }) })
    }
    case 'updateFinding': {
      await requireEditableReview()
      const id = await requireOwnFinding()
      const finding = readFinding()
      confirmWrite(await records.update('private_findings', id, finding))
      return ok({ finding: presentFinding(id, { ...finding, sessionId: roomId, authorId: userId }) })
    }
    case 'deleteFinding': {
      await requireEditableReview()
      const id = await requireOwnFinding()
      confirmWrite(await records.remove('private_findings', id))
      return ok({})
    }
    case 'submitReview': {
      requirePhase('REVIEWING')
      if ((await ownSubmission()).length) return ok({})
      if (!(await ownFindings()).length && params.confirmEmpty !== true) {
        throw new RoomError('Confirm that you want to submit an empty review.')
      }
      const data: Submission = {
        sessionId: roomId, reviewerId: userId, submittedAt: new Date().toISOString(),
        collaborators: session.collaborators,
      }
      confirmWrite(await records.create('submissions', data))
      return ok({})
    }
    case 'revealRoom': {
      requireHost()
      if (session.status === 'REVEALED' || session.status === 'CLOSED') return ok({})
      requirePhase('REVIEWING')
      const submissions = await records.query<Submission>('submissions', { sessionId: roomId })
      if (session.collaborators.length !== 2 || !session.collaborators.every(
        (id) => submissions.some(({ data }) => data.reviewerId === id),
      )) {
        throw new RoomError('Both reviewers must submit before you reveal.')
      }

      const findings = []
      const draftRows = await records.query<StoredFinding>('private_findings', { sessionId: roomId })
      for (const { recordId, data } of draftRows) {
        if (!session.collaborators.includes(data.authorId)) continue
        const finding = presentFinding(recordId, data)
        const { id, ...fields } = finding
        confirmWrite(await records.create('revealed_findings', {
          ...fields, sessionId: roomId, sourceFindingId: id,
        }, id))
        findings.push(finding)
      }
      findings.sort((first, second) => first.lineStart - second.lineStart || first.id.localeCompare(second.id))

      // The stage is private. This single, room-shared row update publishes
      // the complete set and phase in the same observable RecordRoom change.
      confirmWrite(await records.update('sessions', roomId, { findings, status: 'REVEALED' }))
      return ok({})
    }
    case 'vote': {
      requirePhase('REVEALED')
      const findingId = parse(z.uuid(), params.findingId)
      const verdict = parse(z.enum(verdictChoices.map(({ value }) => value)), params.verdict)
      if (!session.findings.some(({ id }) => id === findingId)) throw new RoomError('This finding is unavailable.', 404)
      const [existing] = await records.query<Vote>('votes', { findingId, voterId: userId })
      if (existing) {
        if (existing.data.verdict === verdict) return ok({})
        throw new RoomError('Your vote is already locked.')
      }
      const data: Vote = { sessionId: roomId, findingId, voterId: userId, verdict, collaborators: session.collaborators }
      confirmWrite(await records.create('votes', data))
      return ok({})
    }
    case 'closeRoom':
      requireHost()
      if (session.status === 'CLOSED') return ok({})
      requirePhase('REVEALED')
      confirmWrite(await records.update('sessions', roomId, {
        status: 'CLOSED', closedAt: new Date().toISOString(),
      }))
      return ok({})
    case 'getAiAvailability': {
      const approved = host && userId === config.aiOwner && session.status === 'REVEALED'
      if (!approved) return ok({ canRequest: false })
      const claim = await records.get<{ startedAt: string }>('ai_claims', roomId)
      return ok({ canRequest: !claim, startedAt: claim?.data.startedAt })
    }
    case 'claimAiOpinion': {
      requireHost()
      requirePhase('REVEALED')
      if (userId !== config.aiOwner) throw new RoomError('The AI opinion is available in rooms hosted by the app owner.', 403)
      if (await records.get('ai_claims', roomId)) throw new RoomError('This room has already used its AI request.')
      const startedAt = new Date().toISOString()
      confirmWrite(await records.create('ai_claims', { sessionId: roomId, startedAt }, roomId))
      const review: AiReview = {
        sessionId: roomId, status: 'PENDING', cards: [], model: '', startedAt, collaborators: session.collaborators,
      }
      confirmWrite(await records.create('ai_reviews', review, roomId))
      return ok({ challengeId: session.challengeId, findings: session.findings })
    }
    case 'completeAiOpinion': {
      requireHost()
      if (userId !== config.aiOwner) throw new RoomError('This request is unavailable.', 403)
      if (session.status !== 'REVEALED' && session.status !== 'CLOSED') {
        throw new RoomError('This request is unavailable.')
      }
      const review = await records.get<AiReview>('ai_reviews', roomId)
      if (!review) throw new RoomError('This request is unavailable.')
      if (review.data.status !== 'PENDING') return ok({})
      const result = aiCardsSchema.safeParse(params.cards)
      confirmWrite(await records.update('ai_reviews', roomId, {
        status: result.success ? 'READY' : 'FAILED',
        cards: result.success ? result.data : [],
        model: typeof params.model === 'string' ? params.model : '',
      }))
      return ok({})
    }
    case 'getReferenceGuide': {
      requirePhase('CLOSED')
      const guide = readReferenceGuide(config.referenceGuide, session.challengeId)
      if (!guide?.length) throw new RoomError('The reference guide is unavailable.', 503)
      return ok({ guide })
    }
  }
}

function readReferenceGuide(raw: string | undefined, challengeId: string) {
  if (!raw) return undefined
  try {
    const json = new TextDecoder().decode(Uint8Array.from(atob(raw), (character) => character.charCodeAt(0)))
    const result = z.record(z.string(), z.array(z.object({
      title: z.string(), explanation: z.string(),
    }))).safeParse(JSON.parse(json))
    return result.success ? result.data[challengeId] : undefined
  } catch {
    return undefined
  }
}
