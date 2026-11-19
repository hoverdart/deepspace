import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, FileCode2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { challenges } from '../../../../mergecourt/challenges'
import { roomAction, useRoomAction } from '../../../../mergecourt/client'

export default function NewRoom() {
  const [challengeId, setChallengeId] = useState<string>(challenges[0].id)
  const navigate = useNavigate()
  const { pending, error, run } = useRoomAction()

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await run(() => roomAction<{ roomId: string }>('createRoom', { challengeId }))
    if (result) await navigate(`/rooms/${result.roomId}`)
  }

  return (
    <section className="mc-narrow">
      <Link className="mc-text-link mc-back" to="/"><ArrowLeft aria-hidden="true" size={16} /> Home</Link>
      <h1>Start a review</h1>
      <p>Choose a challenge, then invite one teammate.</p>
      <form className="mc-picker" onSubmit={(event) => void createRoom(event)}>
        <fieldset disabled={pending}>
          <legend>Challenge</legend>
          {challenges.map((challenge) => (
            <label className="mc-challenge-option" key={challenge.id}>
              <input type="radio" name="challenge" checked={challengeId === challenge.id} onChange={() => setChallengeId(challenge.id)} />
              <span><strong>{challenge.title}</strong><span>{challenge.description}</span></span>
              <FileCode2 size={20} aria-hidden="true" />
            </label>
          ))}
        </fieldset>
        {error && <p className="mc-error" role="alert">{error}</p>}
        <button className="mc-button mc-primary" disabled={pending} type="submit">
          {pending ? 'Creating room…' : 'Create room'} <ArrowRight aria-hidden="true" size={18} />
        </button>
      </form>
    </section>
  )
}
