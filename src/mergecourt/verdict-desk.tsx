import { useState } from 'react'
import { useQuery } from 'deepspace'
import { Flag, Vote as VoteIcon } from 'lucide-react'
import type { Challenge } from './challenges'
import { roomAction, useRoomAction } from './client'
import { FindingDetails } from './review-desk'
import { SourceView } from './source-view'
import { isSettled, verdictChoices, type Finding, type Session, type Verdict, type Vote } from './types'
import { AiOpinion } from './ai-opinion'
import { useRoomRead } from './use-room-read'

export function VerdictDesk({ roomId, session, challenge, userId, host }: {
  roomId: string
  session: Session
  challenge: Challenge
  userId: string
  host: boolean
}) {
  const query = useQuery<Vote>('votes', { where: { sessionId: roomId } })
  const votes = query.records.map(({ data }) => data)
  const closed = session.status === 'CLOSED'
  const counts = session.findings.reduce((total, { id }) => total + Number(isSettled(votes.filter(
    (vote) => vote.findingId === id,
  ))), 0)
  const close = useRoomAction()
  const reference = useRoomRead<{ guide: { title: string; explanation: string }[] }>('getReferenceGuide', roomId, closed)

  return (
    <div className="mc-desk">
      <SourceView challenge={challenge} findings={session.findings} />
      <div className="mc-verdict-panels">
        <section className="mc-panel mc-review-panel">
          <div className="mc-panel-heading">
            <h2><VoteIcon size={21} aria-hidden="true" /> {closed ? 'Review results' : 'Revealed findings'}</h2>
            <span className="mc-tag">{session.findings.length} findings</span>
          </div>
          {query.status === 'ready' && (
            <div className="mc-summary" aria-live="polite">
              <span><strong>{counts}</strong> settled</span>
              <span><strong>{session.findings.length - counts}</strong> unresolved</span>
            </div>
          )}
          {query.status === 'loading' && <p role="status">Loading votes…</p>}
          {query.status === 'error' && <p role="alert" className="mc-error">Votes could not load. <button className="mc-inline-btn" onClick={() => window.location.reload()}>Try again</button></p>}
          {!session.findings.length && <p className="mc-empty">Both reviewers submitted without findings.</p>}
          <ol className="mc-findings">
            {session.findings.map((finding) => (
              <VerdictFinding key={finding.id} roomId={roomId} finding={finding} closed={closed}
                ready={query.status === 'ready'} votes={votes.filter((vote) => vote.findingId === finding.id)}
                userId={userId} author={session.participants.find(({ id }) => id === finding.authorId)?.name} />
            ))}
          </ol>
          {!closed && host && (
            <div className="mc-review-footer">
              <p>Closing the room ends voting and opens the reference guide.</p>
              <button className="mc-button" disabled={close.pending} onClick={() => void close.run(() => roomAction('closeRoom', { roomId }))}>
                <Flag size={17} aria-hidden="true" /> {close.pending ? 'Closing…' : 'Close room'}
              </button>
              {close.error && <p className="mc-error" role="alert">{close.error}</p>}
            </div>
          )}
        </section>
        <AiOpinion roomId={roomId} closed={closed} host={host} />
        {closed && (
          <section className="mc-panel" aria-labelledby="reference-guide-heading">
            <h2 id="reference-guide-heading">Reference guide</h2>
            {reference.error
              ? <><p role="alert" className="mc-error">{reference.error}</p><button className="mc-button" onClick={reference.retry}>Try again</button></>
              : reference.data
                ? <ul className="mc-guide">{reference.data.guide.map((item) => <li key={item.title}><h3>{item.title}</h3><p>{item.explanation}</p></li>)}</ul>
                : <p role="status">Loading guide…</p>}
          </section>
        )}
      </div>
    </div>
  )
}

function VerdictFinding({ roomId, finding, closed, ready, votes, userId, author }: {
  roomId: string
  finding: Finding
  closed: boolean
  ready: boolean
  votes: Vote[]
  userId: string
  author?: string
}) {
  const { pending, error, run } = useRoomAction()
  const [confirmed, setConfirmed] = useState<Verdict>()
  const ownVote = votes.find(({ voterId }) => voterId === userId)?.verdict ?? confirmed

  return (
    <li>
      <FindingDetails finding={finding} author={author} />
      {ready && <span className="mc-author">{isSettled(votes) ? 'Settled' : 'Unresolved'}</span>}
      <div className="mc-votes" role="group" aria-label={`Verdicts for ${finding.title}`}>
        {verdictChoices.map(({ value, label }) => {
          const count = votes.filter(({ verdict }) => verdict === value).length
          return closed
            ? <span className="mc-vote" key={value}>{label} <strong>{count}</strong></span>
            : <button className="mc-vote" key={value} disabled={!ready || pending || !!ownVote} aria-pressed={ownVote === value}
              onClick={() => void run(async () => {
                await roomAction('vote', { roomId, findingId: finding.id, verdict: value })
                setConfirmed(value)
              })}>{label} <strong>{count}</strong></button>
        })}
      </div>
      {ownVote && !closed && <span className="mc-author" role="status">Your vote is locked.</span>}
      {error && <p className="mc-error" role="alert">{error}</p>}
    </li>
  )
}
