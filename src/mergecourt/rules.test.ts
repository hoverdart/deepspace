import { describe, expect, it } from 'vitest'
import { isSettled, type Verdict } from './types'
import { findingSchema } from './validation'

const finding = {
  lineStart: 2, lineEnd: 3, title: ' A finding ', explanation: ' Explanation ',
  category: 'Correctness', severity: 'High',
}

describe('finding validation', () => {
  it('normalizes text and omits caller-supplied identity', () => {
    expect(findingSchema.parse({ ...finding, authorId: 'spoofed' })).toEqual({
      ...finding, title: 'A finding', explanation: 'Explanation', suggestedFix: '',
    })
  })

  it.each([
    { lineStart: 0 }, { lineStart: 2.5 }, { lineEnd: 1 }, { category: 'Other category' },
    { severity: 'Urgent' }, { title: '  ' }, { explanation: 'x'.repeat(601) },
  ])('rejects invalid field values', (invalid) => {
    expect(findingSchema.safeParse({ ...finding, ...invalid }).success).toBe(false)
  })
})

describe('a settled finding', () => {
  it.each<{ choices: Verdict[]; settled: boolean }>([
    { choices: [], settled: false },
    { choices: ['valid'], settled: false },
    { choices: ['valid', 'valid'], settled: true },
    { choices: ['false_positive', 'false_positive'], settled: true },
    { choices: ['needs_context', 'needs_context'], settled: false },
    { choices: ['valid', 'false_positive'], settled: false },
  ])('applies the agreement rule to $choices', ({ choices, settled }) => {
    expect(isSettled(choices.map((verdict) => ({ verdict })))).toBe(settled)
  })
})
