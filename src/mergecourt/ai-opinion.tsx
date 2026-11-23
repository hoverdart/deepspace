import { useEffect, useState } from 'react'
import { useQuery } from 'deepspace'
import { Sparkles } from 'lucide-react'
import { roomAction, useRoomAction } from './client'
import { useRoomRead } from './use-room-read'
import type { AiReview } from './types'

export function AiOpinion({ roomId, closed, host }: { roomId: string; closed: boolean; host: boolean }) {
  const { records } = useQuery<AiReview>('ai_reviews', { where: { sessionId: roomId }, limit: 1 })
  const opinion = records[0]?.data
  const availability = useRoomRead<{ canRequest: boolean; startedAt?: string }>('getAiAvailability', roomId, host && !closed)
  const { pending, error, run } = useRoomAction()
  const [requestedAt, setRequestedAt] = useState<string>()
  const startedAt = opinion?.startedAt ?? availability.data?.startedAt ?? requestedAt
  const expired = useClaimExpired(startedAt)
  const canRequest = !closed && !startedAt && availability.data?.canRequest === true

  async function requestOpinion() {
    setRequestedAt(new Date().toISOString())
    const acknowledged = await run(async () => {
      await roomAction('requestAiOpinion', { roomId })
      return true
    })
    availability.retry()
    if (!acknowledged) setRequestedAt(undefined)
  }

  if (!opinion && !startedAt && !canRequest && !availability.error && !error) return null

  return (
    <section className="mc-panel" aria-labelledby="ai-opinion-heading">
      <h2 id="ai-opinion-heading"><Sparkles size={19} aria-hidden="true" /> AI second opinion</h2>
      <p>This model can be wrong. The room’s votes are your verdict.</p>
      {canRequest && (
        <>
          <p>The request sends the challenge source and revealed findings to OpenAI. Each room can make one request.</p>
          <button className="mc-button" disabled={pending} onClick={() => void requestOpinion()}>Request AI opinion</button>
        </>
      )}
      {opinion?.status === 'READY' && (
        <ul className="mc-guide">{opinion.cards.map((card, index) => (
          <li key={`${card.title}-${index}`}><h3>{card.title}</h3><p>{card.analysis}</p></li>
        ))}</ul>
      )}
      {opinion?.status === 'FAILED' && <p role="status">The AI request ended without a usable review. Each room allows one request.</p>}
      {startedAt && (!opinion || opinion.status === 'PENDING') && (
        <p role="status">{expired ? 'The AI opinion was unavailable for this room.' : 'Waiting for the AI opinion…'}</p>
      )}
      {availability.error && !startedAt && (
        <p className="mc-error" role="alert">
          Couldn’t check AI availability. <button className="mc-inline-btn" onClick={availability.retry}>Try again</button>
        </p>
      )}
      {error && <p className="mc-error" role="alert">{error}</p>}
    </section>
  )
}

function useClaimExpired(startedAt: string | undefined) {
  const [expiredClaim, setExpiredClaim] = useState<string>()
  useEffect(() => {
    if (!startedAt) return
    const timer = window.setTimeout(() => setExpiredClaim(startedAt), Math.max(0, Date.parse(startedAt) + 30_000 - Date.now()))
    return () => window.clearTimeout(timer)
  }, [startedAt])
  return !!startedAt && expiredClaim === startedAt
}
