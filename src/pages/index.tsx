import { useSyncExternalStore } from 'react'
import { ArrowRight, FileCode2, Link2, LockKeyhole, ScanLine, Vote } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { Wordmark } from '../mergecourt/brand'
import { seo } from '../seo'

const steps = [
  { title: 'Review in private', copy: 'Race the clock to find bugs and propose fixes.', icon: LockKeyhole },
  { title: 'Take the floor', copy: 'Each proposal gets its own round and a highlighted code snippet.', icon: ScanLine },
  { title: 'Cast your verdict', copy: 'Cast your ballot, hear the jury’s reasoning, and see who wins.', icon: Vote },
]

const subscribeToHydration = () => () => {}

export default function Landing() {
  const { hash } = useLocation()
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false)
  const invalidInvite = hydrated && hash === '#invalid-invite'

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
              <h1>
                <span>Find the bug.</span>{' '}
                <span>Defend the finding.</span>{' '}
                <span><em>Reach a verdict.</em></span>
              </h1>
              <p className="mc-hero-copy">
                A timed code review game for two to six players. Find bugs,
                propose fixes, and see what holds up when the room votes.
              </p>
              <div className="mc-actions">
                <Link className="mc-button mc-primary" to="/rooms/new">Start review <ArrowRight aria-hidden="true" size={19} /></Link>
                <details className="mc-join" open={invalidInvite || undefined} suppressHydrationWarning>
                  <summary className="mc-button"><Link2 aria-hidden="true" size={18} /> Join via link</summary>
                  <form className="mc-join-form" method="get" action="/join">
                    <label htmlFor="invite">Invitation link or room ID</label>
                    <div className="mc-actions">
                      <input id="invite" name="invite" maxLength={2048} required />
                      <button className="mc-button mc-primary" type="submit">Open room</button>
                    </div>
                  </form>
                </details>
              </div>
              <p className="mc-error mc-invite-error" id="invalid-invite" data-invalid={invalidInvite || undefined} role="alert">Enter a MergeCourt invitation link or room ID.</p>
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
