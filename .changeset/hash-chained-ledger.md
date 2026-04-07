---
"@noy-db/core": minor
---

Add hash-chained audit log (the v0.4 ledger). Every `Collection.put` and `Collection.delete` now appends an encrypted entry to the compartment's `_ledger/` internal collection. Each entry is `{ index, prevHash, op, collection, id, version, ts, actor, payloadHash }`, where `prevHash = sha256(canonicalJson(previousEntry))`. Tampering with any entry breaks the chain at that point and is detected by `verify()`.

```ts
const company = await db.openCompartment('demo-co')
const invoices = company.collection('invoices')
await invoices.put('inv-1', { /* ... */ })
await invoices.delete('inv-1')

// Read the ledger
const ledger = company.ledger()
const head = await ledger.head()
// → { entry: {...}, hash: 'a1b2c3...', length: 2 }

// Verify chain integrity
const result = await ledger.verify()
// → { ok: true, head: 'a1b2c3...', length: 2 }
// or { ok: false, divergedAt: 5, expected: '...', actual: '...' }

// Read entries in a range
const recent = await ledger.entries({ from: 0, to: 10 })
```

Design highlights:

- **Zero-knowledge preserved.** `payloadHash` is the sha256 of the encrypted envelope's `_data` field, NOT the plaintext. The full ledger entry is itself encrypted with the compartment's `_ledger` DEK, so adapters never see plaintext metadata.
- **Cached head for O(1) appends.** Each LedgerStore caches its head in memory so `append()` doesn't re-scan the adapter on every call. Without this, 100 puts would have been O(N²) and exceeded the test timeout.
- **Hidden from `loadAll`.** `_ledger` follows the `_keyring` / `_history` / `_sync` convention — backups and exports filter it out automatically.
- **System DEK propagation in `grant()`.** A side-effect fix: the keyring grant flow now propagates ALL system-prefixed collection DEKs (`_ledger`, `_history`, `_sync`) to every grant target, not just owner/admin/viewer roles. This is required so an operator with write access on a single collection can still append to the shared compartment ledger.

New exports from `@noy-db/core`:
- `LedgerStore`, `LEDGER_COLLECTION`, `envelopePayloadHash`
- `canonicalJson`, `sha256Hex`, `hashEntry`, `paddedIndex`, `parseIndex`
- Types: `LedgerEntry`, `AppendInput`, `VerifyResult`
- New method: `Compartment.ledger()` — returns the per-compartment LedgerStore

What's NOT in this PR (deferred):
- Delta history via JSON Patch (#44 — next PR)
- Grant/revoke/rotate as ledger operations (currently only put/delete are recorded)
- Merkle proofs for individual entries (post-v0.4)
- `verifyIntegrity()` cross-check between ledger and data collections

Single-writer concurrency model: documented in the LedgerStore docstring. Multi-writer hardening is a v0.5 follow-up.

Closes #43, part of #41.
