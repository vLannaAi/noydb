---
'@noy-db/core': minor
---

feat(core): `.join().join()` multi-FK chaining (#75)

Multiple `.join()` calls can be chained on the same query, each
resolving an independent FK declared via `ref()`:

```ts
const rows = invoices.query()
  .where('status', '==', 'open')
  .join<'client', Client>('clientId', { as: 'client' })
  .join<'category', Category>('categoryId', { as: 'category' })
  .toArray()
// → [{ id, amount, client: { ... }, category: { ... } | null }, ...]
```

Each leg picks its own planner strategy independently — a query can
mix nested-loop and explicit hash join in the same chain. Each leg
also enforces its own ref-mode behavior independently: a strict join
on `clientId` and a warn join on `categoryId` in the same query both
fire correctly without one mode bleeding into the other.

Per-leg `maxRows` is now enforced against the current left-row count
on every leg (not just the first), so
`.join('a', { maxRows: 100_000 }).join('b', { maxRows: 50 })`
correctly throws on the second leg if the left set exceeds 50. Because
v0.6 joins are equi-joins on the target's primary key (one-to-one or
one-to-null), the left row count stays constant across legs — there's
no cartesian blowup.

Joins execute in declaration order. Reordering by the planner is out
of scope for v1.

**Out of scope (separate issues):**
- **Self-joins** — same source/target collection. Needs cycle
  detection and alias-collision handling; tracked separately if a
  consumer asks.
- **Live mode** for chained joins — depends on #74 landing first.
- **Streaming chained joins** — separate issue under #76.

Tests: 8 new cases covering 2-join chains across multiple rows with
mixed FK populations, 3-join shapes, mixed planner strategies in the
same query, mixed ref modes (strict + warn) firing independently, the
per-leg left-side ceiling check, and `toPlan()` surfacing every leg
with its `partitionScope: 'all'` seam (#87 constraint #1).
