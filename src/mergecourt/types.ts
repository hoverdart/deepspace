export const categories = ['Correctness', 'Concurrency', 'Reliability', 'Validation', 'Maintainability', 'Other'] as const
export const severities = ['Low', 'Medium', 'High'] as const
export const verdictChoices = [
  { value: 'valid', label: 'Valid' },
  { value: 'false_positive', label: 'False positive' },
  { value: 'needs_context', label: 'Needs context' },
] as const

export type Phase = 'LOBBY' | 'REVIEWING' | 'REVEALED' | 'CLOSED'
export type Verdict = (typeof verdictChoices)[number]['value']
export type FindingInput = {
  lineStart: number
  lineEnd: number
  category: (typeof categories)[number]
  severity: (typeof severities)[number]
  title: string
  explanation: string
  suggestedFix: string
}
export type Finding = FindingInput & { id: string; authorId: string }
export type Participant = { id: string; name: string }
export type Session = {
  challengeId: string
  status: Phase
  hostId: string
  collaborators: string[]
  participants: Participant[]
  findings: Finding[]
  closedAt?: string
}
export type Submission = { sessionId: string; reviewerId: string; submittedAt: string; collaborators: string[] }
export type Vote = { sessionId: string; findingId: string; voterId: string; verdict: Verdict; collaborators: string[] }

export function presenceScope(roomId: string) {
  return `mergecourt:${roomId}`
}

export function isSettled(votes: Pick<Vote, 'verdict'>[]) {
  return votes.length === 2 && votes[0].verdict === votes[1].verdict && votes[0].verdict !== 'needs_context'
}

export type AiCard = { title: string; analysis: string }
export type AiReview = {
  sessionId: string
  status: 'PENDING' | 'READY' | 'FAILED'
  startedAt: string
  model: string
  cards: AiCard[]
  collaborators: string[]
}
