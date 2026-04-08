---
'@noy-db/core': minor
---

feat(core): `Query.live()` — reactive primitive with merged join change-streams (#74)

New terminal `.live()` on `Query<T>` returns a `LiveQuery<T>` — a
framework-agnostic reactive primitive with `value` / `error` fields
and a `subscribe(cb)` notification channel:

```ts
const live = invoices.query()
  .where('status', '==', 'open')
  .join<'client', Client>('clientId', { as: 'client' })
  .live()

console.log(live.value)  // current rows with attached clients

const stop = live.subscribe(() => {
  console.log('updated:', live.value)
})

// later...
stop()
live.stop()
```

For non-joined queries, `.live()` is a convenience wrapper over the
existing `.subscribe()` callback shape. For joined queries, the
`LiveQuery` additionally subscribes to every join target's change
stream — mutations on a right-side collection (e.g. updating a
client referenced by an invoice) re-fire the live query and
re-evaluate every dependent left row. Right-side targets are
deduped by name, so a chain that joins the same target twice
(e.g. `.join('billingClientId').join('shippingClientId')`, both →
`clients`) only subscribes once.

**Ref-mode behavior on right-side disappearance** — matches the
eager `.toArray()` contract from #73:

- `strict` → re-run throws `DanglingReferenceError`. The LiveQuery
  catches the throw, stores it in `live.error`, notifies listeners.
  The throw does NOT propagate out of the source's change handler
  (which would tear down the upstream emitter). Consumers check
  `live.error` after each notification and render an error state.
- `warn` → joined value flips to `null`; the existing one-shot
  warn dedup keeps repeated re-runs from spamming the console.
- `cascade` → no special handling; the v0.4 cascade-delete
  mechanism propagates the right-side delete into the left
  collection on the next tick, and the live query naturally
  re-fires with the orphaned left rows gone.

**Error preservation** — when a re-run throws, `live.value` keeps
the previous successful snapshot rather than flashing to an empty
list. UIs typically want to show "last known good + error message"
rather than "blank screen + error message".

**New public surface:**

- `Query.live(): LiveQuery<T>` — terminal method
- `LiveQuery<T>` interface with `value`, `error`, `subscribe(cb)`,
  `stop()`
- `LiveUpstream` interface for the upstream subscribe contract
- `buildLiveQuery(recompute, upstreams)` — exported builder for
  custom planners and tests
- `JoinableSource.subscribe?` — optional method on the join-source
  interface, populated by `Collection.querySourceForJoin()`

**v0.6 limitations** (tracked separately):

- No granular delta updates — the whole query re-runs on every
  upstream change. v2 optimization once the API is stable.
- No microtask batching — bursty changes produce one re-run per
  change. v2 enhancement.
- No re-planning under live mutations — the planner picks once at
  subscription time and reuses the same plan.
- Streaming live joins → tracked under #76.

Tests: 12 new cases covering initial value, idempotent stop(),
left-side insert / update / delete re-fire, right-side insert /
update / delete propagation, cascade-mode right-side delete,
multi-subscriber notifications, non-joined `.live()` shape, and
the error-preservation invariant. 455/455 core tests passing.

Strict-mode dangling at read time is verified by the eager-path
test in `query-join.test.ts` for the same recompute path the live
mode uses; the live error path wraps that recompute in try/catch
and the error-preservation test exercises the same machinery with
a synthetic throw.
