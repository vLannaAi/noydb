---
'@noy-db/core': minor
---

feat(core): `scan().join()` — streaming join over `scan()` (#76)

`ScanBuilder` now has a chainable `.join(field, { as })` method that
resolves a `ref()`-declared foreign key per record as the scan
stream flows, attaching the right-side record (or null) under the
alias. v0.6 #76 — streaming joins.

```ts
// Streaming joined iteration
for await (const inv of invoices.scan().join('clientId', { as: 'client' })) {
  await processInvoice(inv) // inv.client is attached
}

// Streaming joined aggregation
const { total } = await invoices.scan()
  .where('status', '==', 'open')
  .join('clientId', { as: 'client' })
  .aggregate({ total: sum('amount') })
```

**The key difference from eager `Query.join()` (#73):** the LEFT
side streams page-by-page from the adapter and is never
materialized. Memory ceiling on the left is O(pageSize), not
O(rowCount). This is what makes streaming joins suitable for
collections that exceed the eager join's 50_000-row ceiling.

**Right-side strategy** is auto-selected per leg, mirroring eager
join exactly:
- **Indexed** — right source exposes `lookupById` (typical
  Collection right side) → O(1) per row, no upfront cost
- **Hash** — right source has only `snapshot()` → build a
  `Map<id, record>` once at iteration start, then O(1) per row

Both strategies hold the right side in memory for the duration of
the iteration. The "streaming" property applies to the **left**
side only — true left-and-right streaming joins (where neither
side fits in memory) require a sort-merge join planner that's out
of scope for v0.6.

**Ref-mode semantics match eager `.join()` exactly:**
- `strict` → throws `DanglingReferenceError` mid-stream when a
  left record points at a non-existent right id. The throw
  aborts the async iterator — consumers should wrap the
  `for await` in try/catch if they want to recover.
- `warn` → attaches `null` and emits a one-shot warning per
  unique dangling pair, deduped per iteration via the same
  warn channel as eager join.
- `cascade` → attaches `null` silently. A delete-time mode;
  dangling refs at read time are mid-flight or pre-existing
  orphans, not a DSL error.

**Multi-FK chaining** is supported via repeated `.join()` calls.
Each leg resolves an independent ref and picks its own strategy
and ref mode. Joins execute in declaration order — the result of
one leg becomes the input to the next.

**Joins run AFTER clauses** in the streaming pipeline, matching
the eager `Query.toArray()` ordering. This means `.where()` /
`.filter()` can only see un-joined fields. Filtering on joined
fields requires a follow-up post-aggregate filter in userland —
out of scope for v0.6.

**#87 constraint #1** — every JoinLeg from a streaming join
carries `partitionScope: 'all'` plumbed through but never read
by v0.6. v0.10 partition-aware streaming joins will populate it
from `where()` predicates without changing the planner shape.
Same seam as eager join.

**`Collection.scan()` now passes a `JoinContext`** to the
`ScanBuilder` it returns — same machinery as `Collection.query()`
already used for eager joins. ScanBuilder constructed via the
direct constructor (with a synthetic `ScanPageProvider`) has no
`joinContext` and `.join()` throws with an actionable error.

**Out of scope (tracked separately):**
- True left-and-right streaming joins (sort-merge planner)
- LRU + lazy probe for non-`lookupById` right sources (the
  current hash-from-snapshot fallback materializes the right
  side once; LRU only matters when the right side itself is
  stream-only, which v0.6's adapter API doesn't model)
- Filtering on joined fields (`.where()` / `.filter()` after
  `.join()` reading joined alias)
- `scan().join().live()` — same design problem as
  `scan().aggregate().live()`
- Streaming join across compartments (`queryAcross` continues
  to be the cross-compartment correlation primitive)

Tests: 12 new cases in `query-scan-join.test.ts` covering:
- Direct constructor without joinContext throws actionable error
- Strict mode throws `DanglingReferenceError` mid-iteration (unit
  test with synthetic `JoinContext` to bypass write-time strict
  rejection)
- Warn mode attaches null + one-shot warning, deduped per pair
- Cascade mode attaches null silently
- Null FK passes through regardless of mode
- Indexed `lookupById` happy path with multi-page iteration
- Multi-FK chaining via two `.join()` calls
- `.where()` composed with `.join()` (clauses run before joins)
- `.scan().join().aggregate()` reduces a joined stream
- Backward compatibility: `for await` without `.join()` still
  yields plain records

530/530 core tests passing (518 from #99 + 12 new for #76).
