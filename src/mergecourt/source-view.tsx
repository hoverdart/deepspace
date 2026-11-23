import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { FileCode2 } from 'lucide-react'
import Prism from 'prismjs'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-java'
import type { Challenge } from './challenges'
import type { Finding } from './types'

function colorTokens(tokens: (string | Prism.Token)[], prefix = ''): ReactNode {
  return tokens.map((token, index) => {
    if (typeof token === 'string') return token
    const key = `${prefix}-${index}`
    const content = typeof token.content === 'string' ? token.content
      : colorTokens(Array.isArray(token.content) ? token.content : [token.content], key)
    return <span className={`mc-token-${token.type}`} key={key}>{content}</span>
  })
}

export function SourceView({ challenge, findings, selected, onSelect, focusSelection }: {
  challenge: Challenge
  findings: Finding[]
  selected?: { lineStart: number; lineEnd: number }
  focusSelection?: boolean
  onSelect?: (line: number) => void
}) {
  const scroll = useRef<HTMLDivElement>(null)
  const firstLine = selected?.lineStart
  const lines = useMemo(() => challenge.source.split('\n').map(
    (line) => colorTokens(Prism.tokenize(line, Prism.languages[challenge.language.toLowerCase()])),
  ), [challenge.language, challenge.source])

  useEffect(() => {
    if (!focusSelection || !firstLine) return
    const pane = scroll.current
    const line = pane?.querySelector<HTMLElement>('li[data-active]')
    if (!pane || !line) return
    pane.scrollTop += line.getBoundingClientRect().top - pane.getBoundingClientRect().top - pane.clientHeight * .25
  }, [firstLine, focusSelection])

  return (
    <section className="mc-source" aria-label={`Source code for ${challenge.file}`}>
      <div className="mc-preview-header">
        <span><FileCode2 size={17} aria-hidden="true" /> {challenge.file}</span>
        <span>{challenge.language}</span>
      </div>
      <div ref={scroll} className="mc-source-scroll">
        <ol className="mc-source-lines">
          {lines.map((content, index) => {
            const line = index + 1
            const count = findings.filter((finding) => line >= finding.lineStart && line <= finding.lineEnd).length
            const active = selected && line >= selected.lineStart && line <= selected.lineEnd
            return (
              <li key={line} data-active={active || undefined} data-evidence={count > 0 || undefined}>
                {onSelect
                  ? <button className="mc-line" aria-label={`Annotate line ${line}`} aria-pressed={!!active} onClick={() => onSelect(line)}>
                    {line}
                  </button>
                  : <span className="mc-line">{line}</span>}
                <code>{content}</code>
                {count > 0 && <span className="mc-line-count" aria-label={`${count} findings`}>{count}</span>}
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
