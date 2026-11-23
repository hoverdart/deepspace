import { useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Clock3, FileCode2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { challenges, difficulties, reviewSeconds, type Difficulty } from '../../../../mergecourt/challenges'
import { roomAction, useRoomAction } from '../../../../mergecourt/client'

export default function NewRoom() {
  const [difficulty, setDifficulty] = useState<Difficulty>('Easy')
  const [language, setLanguage] = useState('')
  const [challengeId, setChallengeId] = useState<string>()
  const navigate = useNavigate()
  const { pending, error, run } = useRoomAction()
  const levelChallenges = challenges.filter((challenge) => challenge.difficulty === difficulty)
  const languages = Array.from(new Set(levelChallenges.map((challenge) => challenge.language))).sort()
  const visible = levelChallenges.filter((challenge) => !language || challenge.language === language)
  const chosen = visible.find((challenge) => challenge.id === challengeId) ?? visible[0]
  const duration = reviewSeconds[difficulty]
  const formattedDuration = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = await run(() => roomAction<{ roomId: string }>('createRoom', { challengeId: chosen.id, mode: 'game' }))
    if (result) await navigate(`/rooms/${result.roomId}`)
  }

  return (
    <section className="mc-narrow mc-library">
      <Link className="mc-text-link mc-back" to="/"><ArrowLeft aria-hidden="true" size={16} /> Home</Link>
      <h1>Choose your case</h1>
      <p>Pick a code challenge, then invite friends. Rooms seat 2–6 players.</p>
      <form className="mc-picker" onSubmit={(event) => void createRoom(event)}>
        <fieldset className="mc-library-filters" disabled={pending}>
          <legend className="mc-sr-only">Challenge filters</legend>
          <div className="mc-difficulty" aria-label="Difficulty" role="group">
            {difficulties.map((level) => <button key={level} className="mc-button" type="button" aria-pressed={level === difficulty}
              onClick={() => { setDifficulty(level); setLanguage('') }}>{level}</button>)}
          </div>
          <label className="mc-language">Language
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="">All languages</option>
              {languages.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
        </fieldset>
        <fieldset className="mc-challenge-grid" disabled={pending} key={`${difficulty}:${language}`}>
          <legend className="mc-sr-only">Challenge</legend>
          {visible.map((challenge) => (
            <label className="mc-challenge-option" key={challenge.id}>
              <input type="radio" name="challenge" checked={chosen.id === challenge.id} onChange={() => setChallengeId(challenge.id)} />
              <span><span className="mc-challenge-language"><FileCode2 size={15} aria-hidden="true" /> {challenge.language}</span>
                <strong>{challenge.title}</strong><span>{challenge.description}</span></span>
            </label>
          ))}
        </fieldset>
        {error && <p className="mc-error" role="alert">{error}</p>}
        <div className="mc-library-footer">
          <button className="mc-button mc-primary" disabled={pending} type="submit">
            {pending ? 'Creating room…' : 'Create room'} <ArrowRight aria-hidden="true" size={18} />
          </button>
          <p><Clock3 size={17} aria-hidden="true" /> {formattedDuration} to review</p>
        </div>
      </form>
    </section>
  )
}
