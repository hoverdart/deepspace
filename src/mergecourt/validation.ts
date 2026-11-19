import { z } from 'zod'
import { categories, severities } from './types'

export const roomIdSchema = z.uuid({ message: 'This invitation is invalid.' })

export const findingLimits = { title: 80, explanation: 600, suggestedFix: 300 } as const

export const findingSchema = z.object({
  lineStart: z.number().int().min(1),
  lineEnd: z.number().int().min(1),
  category: z.enum(categories),
  severity: z.enum(severities),
  title: z.string().trim().min(1, 'Enter a finding title.').max(findingLimits.title),
  explanation: z.string().trim().min(1, 'Explain the finding.').max(findingLimits.explanation),
  suggestedFix: z.string().trim().max(findingLimits.suggestedFix).default(''),
}).refine(({ lineStart, lineEnd }) => lineStart <= lineEnd, 'The end line must follow the start line.')

export const aiCardsSchema = z.array(z.object({
  title: z.string().trim().min(1).max(80),
  analysis: z.string().trim().min(1).max(420),
})).min(1).max(4)
