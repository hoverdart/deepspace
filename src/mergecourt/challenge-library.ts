import type { Challenge } from './challenges'

export const extraChallenges: Challenge[] = [
  {
    id: "coupon-math", title: "Coupon math", file: "checkout.js", language: "JavaScript", difficulty: "Easy",
    description: "A checkout applies a percentage coupon to a subtotal.",
    hint: "Try a $40 subtotal with a 25% coupon.",
    source: `function checkoutTotal(subtotal, discountPercent) {
  const discount = subtotal * discountPercent;
  const total = subtotal - discount;
  return Math.round(total * 100) / 100;
}`,
  },
  {
    id: "last-page", title: "Last page", file: "pagination.py", language: "Python", difficulty: "Easy",
    description: "A library builds the title list shown on a page.",
    hint: "Try requesting two items from the middle of a list.",
    source: `def titles_on_page(titles, page, page_size):
    start = page * page_size
    stop = start + page_size - 1
    return titles[start:stop]

# Pages are zero-based. The result can be shorter on the last page.
`,
  },
  {
    id: "reading-average", title: "Reading average", file: "temperatures.go", language: "Go", difficulty: "Easy",
    description: "A weather widget displays the average of a batch of readings.",
    hint: "An empty batch is allowed during startup.",
    source: `package weather

func Average(readings []float64) float64 {
    total := 0.0
    for _, reading := range readings {
        total += reading
    }
    return total / float64(len(readings))
}`,
  },
  {
    id: "loyalty-welcome", title: "Welcome credit", file: "Loyalty.java", language: "Java", difficulty: "Easy",
    description: "A loyalty service grants credits to first-time customers.",
    hint: "Read the condition using a customer with zero prior visits.",
    source: `class Loyalty {
    static int welcomeCredit(int previousVisits, boolean enrolled) {
        if (!enrolled) {
            return 0;
        }
        if (previousVisits > 0) {
            return 100;
        }
        return 0;
    }
}`,
  },
  {
    id: "missing-movies", title: "Missing movies", file: "catalog.sql", language: "SQL", difficulty: "Medium",
    description: "A catalog report should show every movie, including titles with no rentals.",
    hint: "Consider the row a left join produces when there is no match.",
    source: `SELECT
  movies.id,
  movies.title,
  COUNT(rentals.id) AS renter_count
FROM movies
LEFT JOIN rentals ON rentals.movie_id = movies.id
WHERE rentals.status = 'complete'
GROUP BY movies.id, movies.title
ORDER BY renter_count DESC;`,
  },
  {
    id: "shared-cart", title: "The shared cart", file: "carts.py", language: "Python", difficulty: "Medium",
    description: "A storefront starts an empty cart for each visitor.",
    hint: "Call make_cart twice without supplying any items.",
    source: `def make_cart(items=[]):
    return {"items": items, "total": 0}

def add_item(cart, sku, price):
    cart["items"].append({"sku": sku, "price": price})
    cart["total"] += price
    return cart

first = make_cart()
second = make_cart()
add_item(first, "notebook", 5)
`,
  },
  {
    id: "loading-playlist", title: "Loading playlist", file: "playlist.js", language: "JavaScript", difficulty: "Medium",
    description: "A player preloads track metadata before showing a playlist.",
    hint: "Watch what the preload function returns before I/O finishes.",
    source: `async function preload(ids, getTrack) {
  const tracks = [];
  ids.forEach(async id => {
    const track = await getTrack(id);
    tracks.push(track);
  });
  return tracks;
}`,
  },
  {
    id: "byte-label", title: "Short label", file: "labels.rs", language: "Rust", difficulty: "Medium",
    description: "A labeling service keeps the first eight characters of a label.",
    hint: "Try a label with an emoji or an accented character.",
    source: `fn short_label(label: &str) -> &str {
    if label.len() <= 8 {
        return label;
    }
    &label[..8]
}

fn main() {
    println!("{}", short_label("Café €uro"));
}`,
  },
  {
    id: "retry-merge", title: "Retrying imports", file: "imports.py", language: "Python", difficulty: "Hard",
    description: "An importer merges a page of inventory counts into a local index.",
    hint: "Try replaying the same page after a partial failure.",
    source: `def merge_page(index, page):
    for record in page.records:
        key = record["sku"]
        index[key] = index.get(key, 0) + record["count"]
    mark_processed(page.id)

def import_all(index, pages):
    for page in pages:
        if not already_processed(page.id):
            merge_page(index, page)
`,
  },
  {
    id: "loop-workers", title: "Queue workers", file: "workers.go", language: "Go", difficulty: "Hard",
    description: "A worker pool reports the first failure and returns promptly.",
    hint: "Consider what happens to a worker after the result reader returns.",
    source: `package queue

func Run(jobs []func() error) error {
    errs := make(chan error)
    for _, job := range jobs {
        go func(work func() error) { errs <- work() }(job)
    }
    for range jobs {
        if err := <-errs; err != nil {
            return err
        }
    }
    return nil
}`,
  },
  {
    id: "price-cache", title: "Price cache", file: "PriceCache.java", language: "Java", difficulty: "Hard",
    description: "A product page memoizes expensive price calculations.",
    hint: "Consider what happens when a price can be zero.",
    source: `import java.util.Map;
import java.util.function.IntSupplier;

class PriceCache {
    private final Map<String, Integer> prices = new java.util.HashMap<>();

    int current(String sku, IntSupplier calculate) {
        int price = prices.getOrDefault(sku, 0);
        if (price == 0) {
            price = calculate.getAsInt();
            prices.put(sku, price);
        }
        return price;
    }
}`,
  },
  {
    id: "feed-cursor", title: "Activity feed cursor", file: "feed.sql", language: "SQL", difficulty: "Hard",
    description: "An activity feed pages backward through events by creation time.",
    hint: "Imagine the last event on a page shares its timestamp with two more events.",
    source: `SELECT id, created_at, summary
FROM activity
WHERE workspace_id = :workspace
  AND created_at < :cursor_time
ORDER BY created_at DESC
LIMIT 25;`,
  },
  {
    id: "refresh-race", title: "Refresh race", file: "search.ts", language: "TypeScript", difficulty: "Extreme",
    description: "A search panel refreshes as the query changes.",
    hint: "Compare the order in which searches start with the order in which they finish.",
    source: `let rows: Result[] = [];
let loading = false;

async function showQuery(query: string) {
  loading = true;
  try {
    const result = await search(query);
    rows = result.rows;
    render(rows);
  } finally {
    loading = false;
  }
}

input.addEventListener('input', () => {
  void showQuery(input.value);
});`,
  },
  {
    id: "partitioned-ledger", title: "Ledger totals", file: "ledger.sql", language: "SQL", difficulty: "Extreme",
    description: "A query displays a running account balance after each ledger event.",
    hint: "Look at how peers sharing a timestamp are treated by window frames.",
    source: `SELECT
  account_id,
  event_id,
  posted_at,
  amount,
  SUM(amount) OVER (
    PARTITION BY account_id
    ORDER BY posted_at
  ) AS running_balance
FROM ledger_entries
ORDER BY account_id, posted_at, event_id;`,
  },
  {
    id: "cancelled-pool", title: "Cancelled fetch", file: "fetch.py", language: "Python", difficulty: "Extreme",
    description: "A coroutine reserves a connection while loading a profile.",
    hint: "What happens when the caller cancels while the download is awaiting?",
    source: `async def load_user(pool, user_id):
    connection = await pool.acquire()
    try:
        return await connection.fetch(user_id)
    except Exception:
        await pool.release(connection)
        raise

async def handle(pool, request):
    return await load_user(pool, request.user_id)
`,
  },
  {
    id: "snapshot-slices", title: "Snapshot slices", file: "snapshot.go", language: "Go", difficulty: "Extreme",
    description: "A monitor publishes slice snapshots while a writer updates measurements.",
    hint: "Check whether copying a slice header also copies its backing array.",
    source: `package monitor

import "sync"

type Measurements struct {
    mu sync.Mutex
    values []int
}
func (m *Measurements) Snapshot() []int {
    m.mu.Lock()
    defer m.mu.Unlock()
    return m.values
}
func (m *Measurements) Update(i, value int) {
    m.mu.Lock()
    defer m.mu.Unlock()
    m.values[i] = value
}`,
  },
]
