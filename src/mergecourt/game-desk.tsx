import { useEffect, useRef, useState } from 'react'
import { Clock3, Gavel, Lightbulb, Radio, Sparkles, Trophy } from 'lucide-react'
import type { Challenge } from './challenges'
import { roomAction, useRoomAction } from './client'
import { FindingDetails } from './review-desk'
import { SourceView } from './source-view'
import {
  introSeconds, maxProposals, resultSeconds, verdictChoices, votingSeconds,
  type Finding, type GameOutcome, type GameState, type Session, type Verdict,
} from './types'
import { useRoomRead } from './use-room-read'

export function useGameClock(enabled: boolean) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!enabled) return
    const timer = window.setInterval(() => setNow(Date.now()), 180)
    return () => window.clearInterval(timer)
  }, [enabled])
  return now
}

export function useGameAdvance(roomId: string, deadline: number | undefined) {
  const [problem, setProblem] = useState(false)
  useEffect(() => {
    if (deadline === undefined) return
    let stopped = false
    let timer: number
    async function advance() {
      try {
        await roomAction('advanceGame', { roomId })
        if (!stopped) setProblem(false)
      } catch {
        if (!stopped) setProblem(true)
      }
      if (!stopped) timer = window.setTimeout(() => void advance(), 1800)
    }
    timer = window.setTimeout(() => void advance(), Math.max(0, deadline - Date.now()) + 40)
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [deadline, roomId])
  return deadline !== undefined && problem
}

export function GameIntro({ startsAt, now, challenge }: { startsAt: number; now: number; challenge: Challenge }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const elapsed = introSeconds - Math.ceil((startsAt - now) / 1000)
  const count = Math.ceil((startsAt - now) / 1000)

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return (
    <dialog ref={dialog} className="mc-intro" aria-labelledby="intro-title" onCancel={(event) => event.preventDefault()}>
      <div className="mc-intro-stage">
        <Gavel aria-hidden="true" size={24} className="mc-intro-gavel" />
        <p className="mc-game-kicker">{challenge.language} <span>·</span> {challenge.difficulty}</p>
        <h2 id="intro-title">Court is in session</h2>
        <ol className="mc-intro-rules">
          <li data-visible="true">Find bugs and save up to {maxProposals} fixes before time runs out.</li>
          <li data-visible={elapsed >= 1}>Vote on everyone else’s proposals, one at a time.</li>
          <li data-visible={elapsed >= 3}>Earn one point when a reviewer votes Valid and Valid has a majority of all ballots.</li>
        </ol>
        <div className="mc-countdown-slot" role="status" aria-live="polite">
          {count <= 3 && count > 0 && <span key={count}>{count}</span>}
        </div>
      </div>
    </dialog>
  )
}

function GameTimer({ now, deadline, duration, label }: { now: number; deadline: number; duration: number; label: string }) {
  const seconds = Math.max(0, Math.min(duration, Math.ceil((deadline - now) / 1000)))
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  return (
    <div className="mc-game-timer" data-urgent={seconds <= 10 || undefined}>
      <div className="mc-timer-readout">
        <span><Clock3 size={16} aria-hidden="true" /> {label}</span>
        <span className="mc-time" role="timer" aria-label={`${time} remaining`}>{time}</span>
      </div>
      <div className="mc-time-track" aria-hidden="true"><span style={{ transform: `scaleX(${seconds / duration})` }} /></div>
    </div>
  )
}

export function GameReviewBar({ challenge, game, now }: { challenge: Challenge; game: GameState; now: number }) {
  if (game.reviewStartsAt === undefined || game.reviewEndsAt === undefined) return null
  return (
    <div className="mc-review-bar">
      <GameTimer now={now} deadline={game.reviewEndsAt} duration={(game.reviewEndsAt - game.reviewStartsAt) / 1000} label="Time to review" />
      <details className="mc-hint">
        <summary><Lightbulb size={18} aria-hidden="true" /> Need a hint?</summary>
        <p>{challenge.hint}</p>
      </details>
    </div>
  )
}

export function GameDesk({ roomId, session, game, challenge, userId, now }: {
  roomId: string; session: Session; game: GameState; challenge: Challenge; userId: string; now: number
}) {
  if (session.status === 'CLOSED') return <GameResults roomId={roomId} session={session} game={game} challenge={challenge} />
  const round = game.round
  const finding = round && session.findings[round.index]
  if (!round || !finding) return null
  const author = session.participants.find(({ id }) => id === finding.authorId)?.name ?? 'Reviewer'

  return (
    <section className="mc-spotlight" aria-label="Proposal spotlight">
      <div className="mc-spotlight-header">
        <div>
          <p className="mc-game-kicker"><Radio size={15} aria-hidden="true" /> Proposal {round.index + 1} of {game.proposalIds?.length}</p>
          <h2>{round.showUntil ? 'The jury has voted' : 'The floor is yours'}</h2>
        </div>
        <GameTimer now={now} deadline={round.showUntil ?? round.votingEndsAt} duration={round.showUntil ? resultSeconds : votingSeconds}
          label={round.showUntil ? (round.index + 1 === game.proposalIds?.length ? 'Final scores in' : 'Next proposal in') : 'Time to vote'} />
      </div>
      <div key={finding.id} className="mc-desk mc-spotlight-content">
        <SourceView challenge={challenge} findings={[]} selected={finding} focusSelection />
        <section className="mc-panel mc-proposal">
          <FindingDetails finding={finding} author={author} codeFix />
          <RoundVote key={finding.id} roomId={roomId} finding={finding} userId={userId}
            elapsed={now >= round.votingEndsAt} outcome={game.outcomes[round.index]} />
        </section>
      </div>
    </section>
  )
}

function RoundVote({ roomId, finding, userId, elapsed, outcome }: {
  roomId: string; finding: Finding; userId: string; elapsed: boolean; outcome?: GameOutcome
}) {
  const author = finding.authorId === userId
  const currentVote = useRoomRead<{ verdict: Verdict | null }>('getGameVote', roomId, !author && !outcome, finding.id)
  const [choice, setChoice] = useState<Verdict>()
  const { pending, error, run } = useRoomAction()
  if (outcome) return <JuryResult outcome={outcome} />
  if (author) return <p className="mc-round-note">You’re presenting this proposal. The other reviewers are voting.</p>
  const cast = choice ?? currentVote.data?.verdict
  return (
    <div className="mc-round-ballot">
      {cast ? <p role="status">Vote locked · {verdictLabel(cast)}</p>
        : elapsed ? <p role="status">Voting closed. Counting ballots…</p>
          : <>
            <h3>Does this fix hold up?</h3>
            <div className="mc-round-choices">
              {verdictChoices.map(({ value, label }) => <button className={value === 'valid' ? 'mc-button mc-primary' : 'mc-button'}
                key={value} disabled={pending || !currentVote.data} onClick={() => void run(async () => {
                  await roomAction('vote', { roomId, findingId: finding.id, verdict: value })
                  setChoice(value)
                })}>{label}</button>)}
            </div>
          </>}
      {currentVote.error && <p role="alert" className="mc-error">{currentVote.error} <button className="mc-inline-btn" onClick={currentVote.retry}>Retry</button></p>}
      {error && <p role="alert" className="mc-error">{error}</p>}
    </div>
  )
}

function verdictLabel(verdict: Verdict) {
  return verdictChoices.find(({ value }) => value === verdict)?.label
}

function JuryResult({ outcome }: { outcome: GameOutcome }) {
  return (
    <div className="mc-jury-result" aria-live="polite">
      <div className="mc-jury-ballot">
        <Sparkles size={19} aria-hidden="true" />
        <strong>{outcome.jury.source === 'model' ? 'AI jury' : 'Reference jury'}</strong>
        <span className="mc-tag">{verdictLabel(outcome.jury.verdict)}</span>
      </div>
      <p>{outcome.jury.reason}</p>
      <ul className="mc-ballot-counts" aria-label="Reviewer votes">
        {verdictChoices.map(({ value, label }) => <li key={value}><strong>{outcome.counts[value]}</strong> {label}</li>)}
      </ul>
      <p className="mc-round-decision">{outcome.accepted ? 'Proposal accepted · +1 point' : 'Proposal did not reach a majority'}</p>
    </div>
  )
}

function GameResults({ roomId, session, game, challenge }: { roomId: string; session: Session; game: GameState; challenge: Challenge }) {
  const guide = useRoomRead<{ guide: { title: string; explanation: string; first?: number; last?: number }[] }>('getReferenceGuide', roomId)
  const scores = new Map(session.participants.map(({ id }) => [id, 0]))
  game.outcomes.forEach((outcome, index) => {
    const finding = session.findings[index]
    if (outcome.accepted && finding) scores.set(finding.authorId, (scores.get(finding.authorId) ?? 0) + 1)
  })
  const players = [...session.participants].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
  const best = scores.get(players[0]?.id) ?? 0
  const winners = best ? players.filter(({ id }) => scores.get(id) === best) : []
  const winnerNames = winners.map(({ name }) => name).join(' & ')

  return (
    <div className="mc-results">
      <section className="mc-winner">
        <Trophy size={35} aria-hidden="true" />
        <p className="mc-game-kicker">Final verdict</p>
        <h2>{winners.length === 1 ? `${winnerNames} wins` : winners.length ? `${winnerNames} tie` : 'No winning proposal'}</h2>
        <ol aria-label="Final scores">
          {players.map(({ id, name }) => <li key={id}><span>{name}</span><strong>{scores.get(id)} {scores.get(id) === 1 ? 'point' : 'points'}</strong></li>)}
        </ol>
      </section>
      <section className="mc-panel mc-code-explainer">
        <h2>What was wrong with the code?</h2>
        <details className="mc-original-code">
          <summary>View original code</summary>
          <SourceView challenge={challenge} findings={[]} />
        </details>
        {guide.error && <p role="alert" className="mc-error">{guide.error} <button className="mc-inline-btn" onClick={guide.retry}>Try again</button></p>}
        {!guide.data && !guide.error && <p role="status">Loading the walkthrough…</p>}
        {guide.data?.guide.map(({ title, explanation, first, last }) => <article key={title}>
          {first && <p className="mc-explain-lines">{first === last ? `Line ${first}` : `Lines ${first}–${last}`}</p>}
          <h3>{title}</h3><p>{explanation}</p>
        </article>)}
      </section>
      {session.findings.length > 0 && <section className="mc-panel mc-round-history">
        <h2>Proposal history</h2>
        {session.findings.map((finding, index) => <details key={finding.id}>
          <summary>{finding.title}</summary>
          <FindingDetails finding={finding} author={session.participants.find(({ id }) => id === finding.authorId)?.name} codeFix />
          {game.outcomes[index] && <JuryResult outcome={game.outcomes[index]} />}
        </details>)}
      </section>}
    </div>
  )
}
