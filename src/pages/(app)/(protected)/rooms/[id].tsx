import { useState } from 'react'
import { useAuth, usePresenceRoom, useQuery } from 'deepspace'
import { ArrowLeft, ArrowRight, Check, Copy, Users } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { getChallenge } from '../../../../mergecourt/challenges'
import { roomAction, useRoomAction } from '../../../../mergecourt/client'
import { useRoomRead } from '../../../../mergecourt/use-room-read'
import { ReviewDesk } from '../../../../mergecourt/review-desk'
import { VerdictDesk } from '../../../../mergecourt/verdict-desk'
import { presenceScope, type Session, type Submission } from '../../../../mergecourt/types'
import { roomIdSchema } from '../../../../mergecourt/validation'

const labels = { LOBBY: 'Lobby', REVIEWING: 'Private review', REVEALED: 'Verdict', CLOSED: 'Closed' }

export default function RoomPage() {
  const { id } = useParams()
  const { userId } = useAuth()
  const parsed = roomIdSchema.safeParse(id)
  if (!parsed.success || !userId) return <Unavailable />
  return <RoomState key={`${parsed.data}:${userId}`} roomId={parsed.data} userId={userId} />
}

function RoomState({ roomId, userId }: { roomId: string; userId: string }) {
  const { records, status } = useQuery<Session>('sessions', { where: { recordId: roomId }, limit: 1 })
  const session = records[0]?.data
  if (status === 'error') return <RoomNotice title="The room couldn’t connect." retry={() => window.location.reload()} />
  if (session) return <JoinedRoom roomId={roomId} session={session} userId={userId} />
  if (status === 'loading') return <RoomNotice title="Loading room…" loading />
  return <JoinRoom roomId={roomId} />
}

function RoomNotice({ title, retry, loading }: { title: string; retry?: () => void; loading?: boolean }) {
  return (
    <section className="mc-narrow mc-centered" aria-busy={loading}>
      <h1>{title}</h1>
      {retry && <button className="mc-button" onClick={retry}>Try again</button>}
    </section>
  )
}

function Unavailable() {
  return (
    <section className="mc-narrow mc-centered">
      <h1>Room unavailable</h1>
      <p>This invitation may be invalid, or the room is no longer accepting reviewers.</p>
      <Link className="mc-button" to="/">Back to home</Link>
    </section>
  )
}

function JoinRoom({ roomId }: { roomId: string }) {
  const invite = useRoomRead<{ joinable: boolean }>('getRoomInvite', roomId)
  const { pending, error, run } = useRoomAction()
  const [joined, setJoined] = useState(false)
  if (joined) return <RoomNotice title="Connecting to the room…" retry={() => window.location.reload()} />
  if (invite.error) return <RoomNotice title={invite.error} retry={invite.retry} />
  if (!invite.data) return <RoomNotice title="Checking invitation…" loading />
  if (!invite.data.joinable) return <Unavailable />

  return (
    <section className="mc-narrow mc-centered">
      <h1>Join a review</h1>
      <p>Take the second seat and review the same code with your teammate.</p>
      <button className="mc-button mc-primary" disabled={pending} onClick={() => void run(async () => {
        await roomAction('joinRoom', { roomId })
        setJoined(true)
      })}>
        {pending ? 'Joining…' : 'Join review'} <ArrowRight aria-hidden="true" size={18} />
      </button>
      {error && <p className="mc-error" role="alert">{error}</p>}
    </section>
  )
}

function JoinedRoom({ roomId, session, userId }: { roomId: string; session: Session; userId: string }) {
  const { peers, connected } = usePresenceRoom(presenceScope(roomId))
  const submissions = useQuery<Submission>('submissions', { where: { sessionId: roomId } })
  const submitted = new Set(submissions.records.map(({ data }) => data.reviewerId))
  const challenge = getChallenge(session.challengeId)
  const host = session.hostId === userId

  if (!challenge) return <Unavailable />
  return (
    <section className="mc-room">
      <div className="mc-room-top">
        <div>
          <Link className="mc-text-link mc-back" to="/"><ArrowLeft aria-hidden="true" size={16} /> Home</Link>
          <h1>{challenge.title}</h1>
          <p>{challenge.description}</p>
        </div>
        <span key={session.status} className="mc-phase">{labels[session.status]}</span>
      </div>

      <section className="mc-roster" aria-label="Participants">
        <span className="mc-roster-heading"><Users aria-hidden="true" size={17} /> Reviewers</span>
        {session.participants.map((participant) => {
          const online = connected && (participant.id === userId || peers.some((peer) => peer.userId === participant.id))
          return (
            <div className="mc-person" key={participant.id}>
              <span className={online ? 'mc-online' : 'mc-offline'} title={online ? 'Online' : 'Offline'} />
              <strong>{participant.name}{participant.id === userId ? ' (you)' : ''}</strong>
              <span>{participant.id === session.hostId ? 'Host' : 'Reviewer'}</span>
              {submitted.has(participant.id) && <span className="mc-submitted">Submitted</span>}
            </div>
          )
        })}
        {session.participants.length < 2 && <span className="mc-empty-seat">Second seat open</span>}
        {!connected && <span className="mc-muted" role="status">Connecting presence…</span>}
      </section>

      {session.status === 'LOBBY' && <Lobby roomId={roomId} host={host} ready={session.participants.length === 2} />}
      {session.status === 'REVIEWING' && <ReviewDesk
        roomId={roomId} challenge={challenge} host={host} locked={submitted.has(userId)}
        allSubmitted={session.collaborators.every((id) => submitted.has(id))}
        submissionsReady={submissions.status === 'ready'}
      />}
      {(session.status === 'REVEALED' || session.status === 'CLOSED') &&
        <VerdictDesk roomId={roomId} session={session} challenge={challenge} userId={userId} host={host} />}
    </section>
  )
}

function Lobby({ roomId, host, ready }: { roomId: string; host: boolean; ready: boolean }) {
  const [copied, setCopied] = useState(false)
  const { pending, error, run } = useRoomAction()
  const copy = useRoomAction()
  const inviteUrl = `${window.location.origin}/rooms/${roomId}`

  async function copyInvite() {
    setCopied(false)
    await copy.run(async () => {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
    })
  }

  return (
    <div className="mc-lobby">
      <div className="mc-panel">
        <h2>Invite your teammate</h2>
        <p>Share this link to offer the second seat in this room.</p>
        <label className="mc-sr-only" htmlFor="room-invite">Invitation link</label>
        <div className="mc-invite">
          <input id="room-invite" value={inviteUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
          <button className="mc-button" onClick={() => void copyInvite()} disabled={copy.pending}>
            {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        {copy.error && <p role="alert" className="mc-error">Couldn’t copy the link. Select and copy it from the field.</p>}
      </div>
      <div className="mc-panel">
        <h2>{ready ? 'Both seats are filled' : 'Waiting for a reviewer'}</h2>
        <p>{ready ? 'The host can open the pull request for private review.' : 'The review starts once your teammate joins.'}</p>
        {host && <button className="mc-button mc-primary" disabled={!ready || pending} onClick={() => void run(
          () => roomAction('startRoom', { roomId }),
        )}>{pending ? 'Starting…' : 'Start review'} <ArrowRight aria-hidden="true" size={18} /></button>}
        {error && <p className="mc-error" role="alert">{error}</p>}
      </div>
    </div>
  )
}
