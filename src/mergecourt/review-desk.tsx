import { useRef, useState, type FormEvent } from 'react'
import { Eye, LockKeyhole, Plus } from 'lucide-react'
import type { Challenge } from './challenges'
import { roomAction, useRoomAction } from './client'
import { SourceView } from './source-view'
import { categories, maxProposals, severities, type Finding, type FindingInput } from './types'
import { useRoomRead } from './use-room-read'
import { findingLimits } from './validation'

type ReviewProps = {
  roomId: string
  challenge: Challenge
  host: boolean
  locked: boolean
  allSubmitted: boolean
  submissionsReady: boolean
  timed?: boolean
  expired?: boolean
}

const blankFinding: FindingInput = {
  lineStart: 1, lineEnd: 1, category: 'Correctness', severity: 'Medium', title: '', explanation: '', suggestedFix: '',
}

export function ReviewDesk(props: ReviewProps) {
  const privateReview = useRoomRead<{ findings: Finding[] }>('getOwnFindings', props.roomId)

  if (!privateReview.data) {
    return (
      <div className="mc-desk">
        <SourceView challenge={props.challenge} findings={[]} />
        <section className="mc-panel" aria-busy={!privateReview.error}>
          <h2>Private findings</h2>
          {privateReview.error
            ? <><p role="alert" className="mc-error">{privateReview.error}</p><button className="mc-button" onClick={privateReview.retry}>Try again</button></>
            : <p>Loading your review…</p>}
        </section>
      </div>
    )
  }
  return <ReviewEditor {...props} initialFindings={privateReview.data.findings} />
}

function ReviewEditor({ roomId, challenge, host, locked, allSubmitted, submissionsReady, timed, expired, initialFindings }:
  ReviewProps & { initialFindings: Finding[] }) {
  const [findings, setFindings] = useState(initialFindings)
  const [editor, setEditor] = useState<{ id?: string; values: FindingInput }>()
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [feedback, setFeedback] = useState('')
  const titleInput = useRef<HTMLInputElement>(null)
  const { pending, error, run } = useRoomAction()
  const reviewLocked = locked || submitted
  const editable = submissionsReady && !reviewLocked && !pending && !expired
  const lineCount = challenge.source.split('\n').length

  function openLine(line: number) {
    if (!editor && findings.length >= maxProposals) return
    setEditor((previous) => ({ id: previous?.id, values: { ...previous?.values ?? blankFinding, lineStart: line, lineEnd: line } }))
    requestAnimationFrame(() => titleInput.current?.focus())
  }

  function change<K extends keyof FindingInput>(field: K, value: FindingInput[K]) {
    setEditor((previous) => previous && ({ ...previous, values: { ...previous.values, [field]: value } }))
  }

  async function saveFinding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor) return
    setFeedback('')
    const result = await run(() => roomAction<{ finding: Finding }>(editor.id ? 'updateFinding' : 'createFinding', {
      roomId, findingId: editor.id, finding: editor.values,
    }))
    if (!result) return
    setFindings((current) => [...current.filter((finding) => finding.id !== result.finding.id), result.finding])
    setEditor(undefined)
    setConfirmEmpty(false)
    setFeedback('Finding saved.')
  }

  async function deleteFinding(findingId: string) {
    setFeedback('')
    await run(async () => {
      await roomAction('deleteFinding', { roomId, findingId })
      setFindings((current) => current.filter(({ id }) => id !== findingId))
      if (editor?.id === findingId) setEditor(undefined)
      setFeedback('Finding deleted.')
    })
  }

  async function submitReview() {
    if (editor) return
    if (!findings.length && !confirmEmpty) {
      setConfirmEmpty(true)
      return
    }
    await run(async () => {
      await roomAction('submitReview', { roomId, confirmEmpty: !findings.length && confirmEmpty })
      setSubmitted(true)
      setFeedback('Review submitted. Your findings are locked.')
    })
  }

  return (
    <div className="mc-desk">
      <SourceView challenge={challenge} findings={findings} selected={editor?.values} onSelect={editable ? openLine : undefined} />
      <section className="mc-panel mc-review-panel">
        <div className="mc-panel-heading">
          <h2><LockKeyhole size={20} aria-hidden="true" /> Private findings</h2>
          <span className="mc-tag">{findings.length} / {maxProposals}</span>
        </div>
        <p>{expired ? 'Time’s up. Your saved proposals go to the vote.'
          : reviewLocked ? 'Your review is locked.'
          : timed ? 'Choose a line, explain the bug, and save a proposed fix.' : 'Only you can see these findings until the host reveals both reviews.'}</p>
        {!submissionsReady && <p role="status">Connecting to review status… <button className="mc-inline-btn" onClick={() => window.location.reload()}>Reconnect</button></p>}
        {error && <p className="mc-error" role="alert">{error}</p>}
        {feedback && <p className="mc-feedback" role="status">{feedback}</p>}
        {!reviewLocked && editor && (
          <form className="mc-finding-form" onSubmit={(event) => void saveFinding(event)}>
            <fieldset disabled={pending || expired}>
              <legend>{editor.id ? 'Edit finding' : 'New finding'}</legend>
              <div className="mc-fields-pair">
                <label>Start line<input type="number" min="1" max={lineCount} required value={editor.values.lineStart || ''} onChange={(event) => change('lineStart', Number(event.target.value))} /></label>
                <label>End line<input type="number" min={Math.max(1, editor.values.lineStart)} max={lineCount} required value={editor.values.lineEnd || ''} onChange={(event) => change('lineEnd', Number(event.target.value))} /></label>
                <label>Category<select value={editor.values.category} onChange={(event) => change('category', event.target.value as FindingInput['category'])}>
                  {categories.map((value) => <option key={value}>{value}</option>)}
                </select></label>
                <label>Severity<select value={editor.values.severity} onChange={(event) => change('severity', event.target.value as FindingInput['severity'])}>
                  {severities.map((value) => <option key={value}>{value}</option>)}
                </select></label>
              </div>
              <label>Finding title<input ref={titleInput} value={editor.values.title} maxLength={findingLimits.title} required onChange={(event) => change('title', event.target.value)} /></label>
              <label>Explanation<textarea value={editor.values.explanation} maxLength={findingLimits.explanation} rows={4} required onChange={(event) => change('explanation', event.target.value)} /></label>
              <label>{timed ? "Proposed fix" : "Suggested fix"} <span className="mc-muted">(optional)</span><textarea className={timed ? "mc-fix-input" : undefined} value={editor.values.suggestedFix} maxLength={findingLimits.suggestedFix} rows={timed ? 4 : 2} onChange={(event) => change('suggestedFix', event.target.value)} /></label>
              <div className="mc-actions">
                <button className="mc-button mc-primary" type="submit">{pending ? 'Saving…' : 'Save finding'}</button>
                <button className="mc-button" type="button" onClick={() => setEditor(undefined)}>Cancel</button>
              </div>
            </fieldset>
          </form>
        )}
        {!findings.length && !editor && <p className="mc-empty">{reviewLocked ? 'You submitted an empty review.' : 'Select a line number to attach your first finding.'}</p>}
        <ol className="mc-findings">
          {findings.map((finding) => (
            <li key={finding.id}>
              <FindingDetails finding={finding} />
              {!reviewLocked && (
                <div className="mc-actions">
                  <button className="mc-inline-btn" disabled={!editable} onClick={() => {
                    setEditor({ id: finding.id, values: finding })
                    requestAnimationFrame(() => titleInput.current?.focus())
                  }}>Edit <span className="mc-sr-only">{finding.title}</span></button>
                  <button className="mc-inline-btn" disabled={!editable} onClick={() => void deleteFinding(finding.id)}>Delete <span className="mc-sr-only">{finding.title}</span></button>
                </div>
              )}
            </li>
          ))}
        </ol>
        {!reviewLocked && (
          <div className="mc-review-footer">
            {confirmEmpty && <p role="status">Submit an empty review? This will lock it for this room.</p>}
            <div className="mc-actions">
              {!editor && findings.length < maxProposals && <button className="mc-button" disabled={!editable} onClick={() => openLine(1)}>
                <Plus size={17} aria-hidden="true" /> Add finding
              </button>}
              <button className="mc-button mc-primary" disabled={!editable || !!editor} onClick={() => void submitReview()}>
                {confirmEmpty ? 'Confirm empty review' : 'Submit review'}
              </button>
              {confirmEmpty && <button className="mc-inline-btn" onClick={() => setConfirmEmpty(false)}>Cancel</button>}
            </div>
          </div>
        )}
        {reviewLocked && (
          <div className="mc-review-footer">
            <p>{timed ? 'Waiting for the vote to start.' : allSubmitted ? 'Both reviews are ready to reveal.' : 'Waiting for the other reviewer to submit.'}</p>
            {host && !timed && <button className="mc-button mc-primary" disabled={!allSubmitted || pending} onClick={() => void run(() => roomAction('revealRoom', { roomId }))}>
              <Eye size={17} aria-hidden="true" /> {pending ? 'Revealing…' : 'Reveal findings'}
            </button>}
          </div>
        )}
      </section>
    </div>
  )
}

export function FindingDetails({ finding, author, codeFix }: { finding: Finding; author?: string; codeFix?: boolean }) {
  return (
    <>
      <div className="mc-finding-meta">
        <span>{finding.lineStart === finding.lineEnd ? `Line ${finding.lineStart}` : `Lines ${finding.lineStart}–${finding.lineEnd}`}</span>
        <span className="mc-tag">{finding.category}</span>
        <span className="mc-tag" data-severity={finding.severity}>{finding.severity}</span>
      </div>
      <h3>{finding.title}</h3>
      {author && <p className="mc-author">{author}</p>}
      <p className="mc-finding-text">{finding.explanation}</p>
      {finding.suggestedFix && (codeFix
        ? <div className="mc-fix"><strong>Proposed fix</strong><pre><code>{finding.suggestedFix}</code></pre></div>
        : <p className="mc-finding-text"><strong>Suggested fix</strong> {finding.suggestedFix}</p>)}
    </>
  )
}
