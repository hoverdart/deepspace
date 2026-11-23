import type { Finding, JuryOpinion } from '../mergecourt/types'

const guides: Record<string, { title: string; first: number; last: number; explanation: string; signals: string[] }[]> = {
  "reservation-race": [
    {
      title: "Validate the seat count", first: 15, last: 16,
      explanation: "Zero, negative, fractional, and non-finite quantities need validation before modifying capacity.",
      signals: ["zero","negative","nan","integer","positive","number","validat","bound"],
    },
    {
      title: "Make reservations atomic", first: 13, last: 22,
      explanation: "The read and both writes run separately. Concurrent reservations can overbook, and a later write can fail after capacity was deducted.",
      signals: ["race","concurr","lock","atomic","transaction","fail"],
    },
    {
      title: "Guard retries with the request ID", first: 21, last: 23,
      explanation: "Persist an idempotency key and its result inside the same transaction before allowing retries to change capacity.",
      signals: ["idempot","retry","requestid","duplicate"],
    },
  ],
  "balance-transfer": [
    {
      title: "Validate the transfer", first: 15, last: 18,
      explanation: "Validate a positive, finite integer amount and reject transfers to the same account before writing.",
      signals: ["negative","zero","same","finite","amount","integer","validat"],
    },
    {
      title: "Make both balance changes atomic", first: 15, last: 26,
      explanation: "A transaction or equivalent conditional write is needed so concurrent transfers do not lose updates and a failure cannot strand the debit.",
      signals: ["transaction","atomic","lock","race","concurr","fail","separate"],
    },
    {
      title: "Give retries a stable transfer identity", first: 20, last: 26,
      explanation: "Record a unique transfer key and completion in the same transaction to make repeated requests safe.",
      signals: ["idempot","retry","duplicate","stable","unique"],
    },
  ],
  "coupon-math": [
    {
      title: "Convert percentages to fractions", first: 2, last: 3,
      explanation: "A 25% coupon should multiply the subtotal by 0.25. Using 25 as the multiplier can produce a negative total.",
      signals: ["percent","divide","0.25","100"],
    },
  ],
  "last-page": [
    {
      title: "Use the exclusive stop index", first: 3, last: 4,
      explanation: "Python slices exclude the stop position. Subtracting one drops the last title of every full page.",
      signals: ["exclusive","slice","off-by-one","stop","page_size"],
    },
  ],
  "reading-average": [
    {
      title: "Define the empty average", first: 3, last: 8,
      explanation: "The startup case divides zero by zero and yields NaN. Return a documented no-reading result before dividing.",
      signals: ["empty","zero","nan","divide"],
    },
  ],
  "loyalty-welcome": [
    {
      title: "Give the bonus on the first visit", first: 6, last: 7,
      explanation: "The condition grants credit to returning customers. Check for zero previous visits to follow the welcome-credit rule.",
      signals: ["zero","first","previous","condition"],
    },
  ],
  "missing-movies": [
    {
      title: "Filter matching rentals in the join", first: 6, last: 7,
      explanation: "The WHERE predicate drops movies whose rental columns are NULL. Apply the status predicate in the JOIN condition.",
      signals: ["where","null","join","filter"],
    },
  ],
  "shared-cart": [
    {
      title: "Allocate a fresh list per cart", first: 1, last: 2,
      explanation: "Python evaluates defaults once. Use a None default and allocate a fresh list when none is provided.",
      signals: ["default","shared","mutable","none","list"],
    },
  ],
  "loading-playlist": [
    {
      title: "Await the metadata work", first: 3, last: 7,
      explanation: "forEach never awaits its async callbacks. Await Promise.all over mapped promises to deliver all tracks in input order.",
      signals: ["foreach","await","promise","order","async"],
    },
  ],
  "byte-label": [
    {
      title: "Choose a valid UTF-8 boundary", first: 2, last: 5,
      explanation: "Rust string indices are byte offsets. Cutting at byte eight can panic and measures bytes instead of characters.",
      signals: ["utf","byte","boundary","char","panic"],
    },
  ],
  "retry-merge": [
    {
      title: "Make the page update idempotent", first: 3, last: 10,
      explanation: "A crash after updating counts but before marking the page processed causes double-counting. Atomically record the page ID with its edits.",
      signals: ["atomic","idempot","double","processed","transaction"],
    },
  ],
  "loop-workers": [
    {
      title: "Let every worker publish its result", first: 4, last: 10,
      explanation: "An early return leaves workers blocked while sending to the unbuffered channel. Buffer one result per job or drain/cancel the remaining work.",
      signals: ["channel","buffer","block","drain","goroutine","cancel"],
    },
  ],
  "price-cache": [
    {
      title: "Distinguish a missing value from zero", first: 9, last: 13,
      explanation: "A valid zero price is treated as a miss on every read. Look up presence separately or use computeIfAbsent with an appropriate thread-safety contract.",
      signals: ["zero","sentinel","missing","computeifabsent","presence"],
    },
  ],
  "feed-cursor": [
    {
      title: "Make the cursor a total ordering", first: 4, last: 5,
      explanation: "Rows tied on timestamp can disappear between pages. Order by timestamp and a unique ID and use both fields in the cursor predicate.",
      signals: ["tie","timestamp","cursor","id","ordering"],
    },
  ],
  "refresh-race": [
    {
      title: "Apply only the latest request", first: 4, last: 11,
      explanation: "A slow older search can overwrite the newest rows and clear its loading flag. Associate both writes with a request generation or cancel stale work.",
      signals: ["stale","abort","generation","race","latest","request"],
    },
  ],
  "partitioned-ledger": [
    {
      title: "Use a row-by-row window over a stable order", first: 6, last: 9,
      explanation: "The default range frame can aggregate timestamp peers together. Order the window by posted_at and event_id and use ROWS UNBOUNDED PRECEDING.",
      signals: ["window","rows","range","peer","timestamp","event_id"],
    },
  ],
  "cancelled-pool": [
    {
      title: "Release the connection on every exit", first: 2, last: 7,
      explanation: "A successful return never releases the connection, and cancellation may bypass Exception. Use finally or the pool’s async context manager.",
      signals: ["finally","release","cancel","success","context"],
    },
  ],
  "snapshot-slices": [
    {
      title: "Copy the backing array under the lock", first: 9, last: 13,
      explanation: "The returned slice aliases the mutable data after the lock is released. Clone the slice while holding the mutex to give readers an independent snapshot.",
      signals: ["slice","backing","alias","copy","lock"],
    },
  ],
}

export function challengeGuide(id: string) {
  return (guides[id] ?? []).map(({ title, explanation, first, last }) => ({ title, explanation, first, last }))
}

export function referenceOpinion(challengeId: string, finding: Finding): JuryOpinion {
  const text = `${finding.title} ${finding.explanation} ${finding.suggestedFix}`.toLowerCase()
  const nearby = (guides[challengeId] ?? []).filter(({ first, last }) =>
    finding.lineStart <= last && finding.lineEnd >= first,
  )
  const issue = nearby.find(({ signals }) => signals.some((signal) => text.includes(signal)))
  if (issue) return { verdict: 'valid', reason: issue.explanation, source: 'reference' }
  return {
    verdict: 'needs_context',
    reason: nearby[0]?.explanation ?? 'The authored explanation focuses on other lines. The reviewers can still accept this proposal.',
    source: 'reference',
  }
}
