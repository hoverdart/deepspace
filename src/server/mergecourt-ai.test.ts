import { describe, expect, it } from 'vitest'
import { aiCardLimits, aiCardsSchema } from '../mergecourt/validation'
import { parseOpinion } from './mergecourt-ai'

describe('parseOpinion', () => {
  it('keeps usable notes when a Markdown section exceeds the display limit', () => {
    const cards = parseOpinion([
      '## Consider concurrent writes',
      'Check whether the storage layer serializes updates. '.repeat(12),
      '## Check the destination',
      'A transfer to the same account can leave the balance inconsistent.',
    ].join('\n\n'))

    expect(aiCardsSchema.safeParse(cards).success).toBe(true)
    expect(cards?.[0].analysis.length).toBeLessThanOrEqual(aiCardLimits.analysis)
    expect(cards?.[1].title).toBe('Check the destination')
  })

  it('unwraps fenced JSON and keeps valid cards beside incomplete ones', () => {
    const valid = { title: 'Check the write order', analysis: 'The second write can fail.' }
    const fenced = 'Here are the notes:\n```json\n' + JSON.stringify({ cards: [{ title: 'Incomplete' }, valid] }) + '\n```'
    expect(parseOpinion(fenced)).toEqual([valid])
  })

  it('uses a single card for a plain-text note', () => {
    expect(parseOpinion('Validate the amount before writing.')).toEqual([
      { title: 'Review notes', analysis: 'Validate the amount before writing.' },
    ])
  })

  it('rejects empty or broken structured replies', () => {
    expect(parseOpinion('  ')).toBeNull()
    expect(parseOpinion('{"cards":')).toBeNull()
    expect(parseOpinion('```json\n{"cards":')).toBeNull()
    expect(parseOpinion({ cards: [] })).toBeNull()
  })
})
