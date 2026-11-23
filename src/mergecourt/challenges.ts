import { extraChallenges } from './challenge-library'

export const difficulties = ['Easy', 'Medium', 'Hard', 'Extreme'] as const
export type Difficulty = (typeof difficulties)[number]
export type Language = 'TypeScript' | 'JavaScript' | 'Python' | 'Go' | 'Rust' | 'SQL' | 'Java'
export type Challenge = {
  id: string
  title: string
  file: string
  description: string
  difficulty: Difficulty
  language: Language
  hint: string
  source: string
}

export const reviewSeconds: Record<Difficulty, number> = { Easy: 90, Medium: 120, Hard: 180, Extreme: 240 }

export const challenges: Challenge[] = [
  {
    id: 'reservation-race',
    title: 'Reservation race',
    file: 'reserve-seats.ts',
    language: 'TypeScript', difficulty: 'Hard',
    hint: 'Walk through two overlapping requests for the last remaining seat.',
    description: 'A pull request adds seat reservations for events. Review the change before it ships.',
    source: `type Event = { id: string; seatsLeft: number }
type Reservation = { id: string; eventId: string; userId: string; seats: number }

type DB = {
  getEvent(id: string): Promise<Event | null>
  saveEvent(event: Event): Promise<void>
  saveReservation(reservation: Reservation): Promise<void>
}

export async function reserveSeats(
  db: DB, eventId: string, userId: string, seats: number, requestId: string
): Promise<Reservation> {
  const event = await db.getEvent(eventId)
  if (!event) throw new Error('Event not found')
  if (seats < 0) throw new Error('Seats must be positive')
  if (event.seatsLeft < seats) throw new Error('Sold out')

  event.seatsLeft -= seats
  await db.saveEvent(event)

  const reservation = { id: requestId, eventId, userId, seats }
  await db.saveReservation(reservation)
  return reservation
}`,
  },
  {
    id: 'balance-transfer',
    title: 'Account balance transfer',
    file: 'transfer-credits.ts',
    language: 'TypeScript', difficulty: 'Medium',
    hint: 'Imagine the first save works but the second save throws.',
    description: 'A pull request moves credits between two demo accounts. Review what happens as each balance is saved.',
    source: `type Account = { id: string; credits: number }

type Store = {
  read(id: string): Promise<Account | null>
  save(account: Account): Promise<void>
  recordTransfer(from: string, to: string, amount: number): Promise<void>
}

export async function transferCredits(
  store: Store,
  fromId: string,
  toId: string,
  amount: number
): Promise<void> {
  const from = await store.read(fromId)
  const to = await store.read(toId)
  if (!from || !to) throw new Error('Account not found')
  if (from.credits < amount) throw new Error('Insufficient credits')

  const debited = { ...from, credits: from.credits - amount }
  await store.save(debited)

  const credited = { ...to, credits: to.credits + amount }
  await store.save(credited)

  await store.recordTransfer(fromId, toId, amount)
}`,
  },
  ...extraChallenges,
]

export function getChallenge(id: string): Challenge | undefined {
  return challenges.find((challenge) => challenge.id === id)
}
