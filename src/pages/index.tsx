import { useState, type FormEvent } from 'react'
import { ArrowRight, FileCode2, Link2, LockKeyhole, ScanLine, Vote } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { Wordmark } from '../mergecourt/brand'
import { roomIdSchema } from '../mergecourt/validation'
import { seo } from '../seo'

const steps = [
  { title: 'Review in private', copy: 'Read the same pull request. File and lock your own findings.', icon: LockKeyhole },
  { title: 'Reveal the findings', copy: 'See both reviews and compare what each of you caught.', icon: ScanLine },
  { title: 'Cast your verdict', copy: 'Vote on each finding and see where your judgments agree.', icon: Vote },
]

export default function Landing() {
  const navigate = useNavigate()
  const [invitation, setInvitation] = useState('')
  const [error, setError] = useState('')

  function openInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = invitation.trim().replace(/\/$/, '')
    const roomId = roomIdSchema.safeParse(value.match(/\/rooms\/([^/?#]+)(?:[?#].*)?$/)?.[1] ?? value)
    if (!roomId.success) {
      setError('Enter a MergeCourt invitation link or room ID.')
      return
    }
    void navigate(`/rooms/${roomId.data}`)
  }

  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="mc-page">
        <header className="mc-header">
          <div className="mc-container mc-header-inner">
            <Wordmark />
            <a className="mc-text-link" href="#how-it-works">How it works</a>
          </div>
        </header>
        <main className="mc-container">
          <section className="mc-hero">
            <div>
              <h1>Find the bug.<br />Defend the finding.<br /><em>Reach a verdict.</em></h1>
              <p className="mc-hero-copy">
                A two-person code review game. Inspect the same code in private,
                reveal your findings together, and decide what holds up.
              </p>
              <div className="mc-actions">
                <Link className="mc-button mc-primary" to="/rooms/new">Start review <ArrowRight aria-hidden="true" size={19} /></Link>
                <details className="mc-join" suppressHydrationWarning>
                  <summary className="mc-button"><Link2 aria-hidden="true" size={18} /> Join via link</summary>
                  <form className="mc-join-form" onSubmit={openInvitation}>
                    <label htmlFor="invite">Invitation link or room ID</label>
                    <div className="mc-actions">
                      <input id="invite" value={invitation} onChange={(event) => setInvitation(event.target.value)} required />
                      <button className="mc-button mc-primary" type="submit">Open room</button>
                    </div>
                    {error && <p className="mc-error" role="alert">{error}</p>}
                  </form>
                </details>
              </div>
            </div>
            <div className="mc-preview" aria-label="Example of a line-anchored code review">
              <div className="mc-preview-header">
                <span><FileCode2 size={16} aria-hidden="true" /> reserve-seats.ts</span>
                <span>Example review</span>
              </div>
              <div className="mc-preview-source">
                <div><span>13</span><code><b>const</b> event = <b>await</b> db.getEvent(eventId)</code></div>
                <div><span>14</span><code><b>if</b> (!event) <b>throw new</b> Error(<i>'Event not found'</i>)</code></div>
                <div className="mc-preview-marked"><span>15</span><code><b>if</b> (seats &lt; 0) <b>throw new</b> Error(<i>'Seats must be positive'</i>)</code></div>
                <div><span>16</span><code><b>if</b> (event.seatsLeft &lt; seats)</code></div>
                <div><span>17</span><code>  <b>throw new</b> Error(<i>'Sold out'</i>)</code></div>
              </div>
              <div className="mc-preview-finding">
                <div className="mc-finding-meta"><span>Line 15</span><span className="mc-tag">Needs context</span></div>
                <strong>Check the input boundary</strong>
                <p>What inputs can reach this function?</p>
              </div>
            </div>
          </section>
          <section aria-labelledby="how-it-works" className="mc-workflow">
            <h2 id="how-it-works">How it works</h2>
            <ol className="mc-steps">
              {steps.map(({ title, copy, icon: Icon }) => (
                <li key={title}>
                  <Icon aria-hidden="true" size={22} />
                  <div><h3>{title}</h3><p>{copy}</p></div>
                </li>
              ))}
            </ol>
          </section>
        </main>
      </div>
    </>
  )
}
