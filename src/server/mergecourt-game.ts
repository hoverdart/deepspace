import { z } from 'zod'
import {
  resultSeconds, verdictChoices, votingSeconds, type Finding, type FindingInput,
  type GameOutcome, type GameState, type JuryOpinion, type Session, type Submission, type Verdict,
} from '../mergecourt/types'
import { referenceOpinion } from './challenge-guides'
import type { createRoomRecords } from './mergecourt-records'

export type Records = ReturnType<typeof createRoomRecords>
export type StoredFinding = FindingInput & { sessionId: string; authorId: string }
type GameVote = { sessionId: string; findingId: string; voterId: string; verdict: Verdict }
export type JuryClaim = { gameStatus: 'PENDING' | 'COMPLETE'; judgments?: Record<string, JuryOpinion> }
export const modelJudgmentsSchema = z.record(z.uuid(), z.object({
  verdict: z.enum(verdictChoices.map(({ value }) => value)),
  reason: z.string().trim().min(1).max(360),
  source: z.literal('model'),
}))

export function confirmWrite(result: { success: boolean }) {
  if (!result.success) throw new Error('Record write failed.')
}

export function presentFinding(id: string, data: StoredFinding): Finding {
  const { authorId, lineStart, lineEnd, category, severity, title, explanation, suggestedFix } = data
  return { id, authorId, lineStart, lineEnd, category, severity, title, explanation, suggestedFix }
}

function newRound(index: number, now: number) {
  return { index, votingEndsAt: now + votingSeconds * 1000 }
}

export async function advanceGame(records: Records, roomId: string, session: Session, game: GameState) {
  const now = Date.now()
  if (session.status === 'REVIEWING') {
    if (!game.reviewStartsAt || now < game.reviewStartsAt) return {}
    if (now < (game.reviewEndsAt ?? now)) {
      const submissions = await records.query<Submission>('submissions', { sessionId: roomId })
      if (!session.collaborators.every((id) => submissions.some(({ data }) => data.reviewerId === id))) return {}
    }

    const rows = await records.query<StoredFinding>('private_findings', { sessionId: roomId })
    const proposals = rows.filter(({ data }) => session.collaborators.includes(data.authorId))
      .map(({ recordId, data }) => presentFinding(recordId, data))
      .sort((a, b) => a.lineStart - b.lineStart || a.lineEnd - b.lineEnd || a.id.localeCompare(b.id))
    if (!proposals.length) {
      await finishGame(records, roomId, game)
      return {}
    }

    // The shared session contains only the proposals which have reached the spotlight.
    confirmWrite(await records.update('sessions', roomId, {
      status: 'REVEALED',
      findings: [proposals[0]],
      game: { ...game, proposalIds: proposals.map(({ id }) => id), round: newRound(0, Date.now()) },
    }))
    return { startJury: game.modelJury }
  }

  const round = game.round
  const proposals = game.proposalIds
  if (session.status !== 'REVEALED' || !round || !proposals) return {}
  if (round.showUntil) {
    if (now < round.showUntil) return {}
    const nextId = proposals[round.index + 1]
    if (!nextId) {
      await finishGame(records, roomId, game)
      return {}
    }
    const row = await records.get<StoredFinding>('private_findings', nextId)
    if (!row || row.data.sessionId !== roomId) throw new Error('Proposal lookup failed.')
    confirmWrite(await records.update('sessions', roomId, {
      findings: [...session.findings, presentFinding(nextId, row.data)],
      game: { ...game, round: newRound(round.index + 1, Date.now()) },
    }))
    return {}
  }

  const finding = session.findings[round.index]
  const votes = await records.query<GameVote>('game_votes', { sessionId: roomId, findingId: finding.id })
  if (now < round.votingEndsAt && votes.length < session.collaborators.length - 1) return {}
  const claim = game.modelJury ? await records.get<JuryClaim>('ai_claims', roomId) : null
  if (game.modelJury && claim?.data.gameStatus !== 'COMPLETE' && now < round.votingEndsAt) return {}

  const jury = claim?.data.judgments?.[finding.id] ?? referenceOpinion(session.challengeId, finding)
  const outcome = tallyVotes(finding.id, votes.map(({ data }) => data.verdict), jury)
  confirmWrite(await records.update('sessions', roomId, {
    game: {
      ...game,
      round: { ...round, showUntil: Date.now() + resultSeconds * 1000 },
      outcomes: [...game.outcomes, outcome],
    },
  }))
  return {}
}

async function finishGame(records: Records, roomId: string, game: GameState) {
  confirmWrite(await records.update('sessions', roomId, {
    status: 'CLOSED', closedAt: new Date().toISOString(), game,
  }))
}

export function tallyVotes(findingId: string, ballots: Verdict[], jury: JuryOpinion): GameOutcome {
  const counts = { valid: 0, false_positive: 0, needs_context: 0 }
  for (const ballot of ballots) counts[ballot]++
  const accepted = counts.valid > 0 && (counts.valid + Number(jury.verdict === 'valid')) * 2 > ballots.length + 1
  return { findingId, counts, jury, accepted }
}
