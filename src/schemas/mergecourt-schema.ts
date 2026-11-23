import type { CollectionSchema, ColumnDefinition } from 'deepspace/schema'

const denied = { read: false, create: false, update: false, delete: false } as const
const shared = { ...denied, read: 'shared' } as const
const privatePermissions = { '*': denied, viewer: denied, member: denied, admin: denied }
const sharedPermissions = { ...privatePermissions, member: shared, admin: shared }

const text = (name: string): ColumnDefinition => ({ name, storage: 'text', interpretation: 'plain' })
const integer = (name: string): ColumnDefinition => ({ name, storage: 'number', interpretation: 'number' })
const json = (name: string): ColumnDefinition => ({ name, storage: 'text', interpretation: { kind: 'json' } })
const findings = [
  text('sessionId'), text('authorId'), integer('lineStart'), integer('lineEnd'),
  text('category'), text('severity'), text('title'), text('explanation'), text('suggestedFix'),
]

export const mergeCourtSchemas: CollectionSchema[] = [
  {
    name: 'sessions',
    columns: [
      text('challengeId'), text('status'), text('hostId'), json('collaborators'),
      json('participants'), json('findings'), text('closedAt'), json('game'),
    ],
    collaboratorsField: 'collaborators',
    permissions: sharedPermissions,
  },
  { name: 'private_findings', columns: findings, permissions: privatePermissions },
  {
    name: 'submissions',
    columns: [text('sessionId'), text('reviewerId'), text('submittedAt'), json('collaborators')],
    uniqueOn: ['sessionId', 'reviewerId'],
    collaboratorsField: 'collaborators',
    permissions: sharedPermissions,
  },
  {
    name: 'revealed_findings',
    columns: [...findings, text('sourceFindingId')],
    uniqueOn: ['sourceFindingId'],
    permissions: privatePermissions,
  },
  {
    name: 'votes',
    columns: [text('sessionId'), text('findingId'), text('voterId'), text('verdict'), json('collaborators')],
    uniqueOn: ['findingId', 'voterId'],
    collaboratorsField: 'collaborators',
    permissions: sharedPermissions,
  },
  {
    name: 'game_votes',
    columns: [text('sessionId'), text('findingId'), text('voterId'), text('verdict')],
    uniqueOn: ['findingId', 'voterId'],
    permissions: privatePermissions,
  },
  {
    name: 'ai_claims',
    columns: [text('sessionId'), text('startedAt'), text('gameStatus'), json('judgments')],
    uniqueOn: ['sessionId'],
    permissions: privatePermissions,
  },
  {
    name: 'ai_reviews',
    columns: [text('sessionId'), text('status'), text('startedAt'), text('model'), json('cards'), json('collaborators')],
    uniqueOn: ['sessionId'],
    collaboratorsField: 'collaborators',
    permissions: sharedPermissions,
  },
]
