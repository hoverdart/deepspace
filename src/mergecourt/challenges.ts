export const challenges = [
  {
    id: 'reservation-race',
    title: 'Reservation race',
    file: 'reserve-seats.ts',
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
] as const

export type Challenge = (typeof challenges)[number]

export function getChallenge(id: string): Challenge | undefined {
  return challenges.find((challenge) => challenge.id === id)
}
