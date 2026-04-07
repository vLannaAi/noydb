---
"@noy-db/core": minor
---

Add verifiable backups (v0.4 #46). `dump()` now embeds the current ledger head hash and the full `_ledger` + `_ledger_deltas` internal collections so the receiver can run a full integrity check after `load()`. `load()` rejects any backup whose chain has been tampered with — either by modifying ledger entries or by swapping data envelope ciphertext between dump and restore.

```ts
const company = await db.openCompartment('demo-co')
const invoices = company.collection('invoices')
await invoices.put('inv-1', { /* ... */ })

// Dump now embeds ledgerHead + internal collections
const backupJson = await company.dump()

// Load runs verifyBackupIntegrity() after restoring
await company.load(backupJson)
//   → throws BackupLedgerError if the chain is broken or the head doesn't match
//   → throws BackupCorruptedError if any data envelope's payloadHash diverged
```

New methods + types:

- **`Compartment.verifyBackupIntegrity()`** — runs both chain verification AND a data-envelope cross-check. Returns a discriminated union for the three outcomes (`ok`, `chain` failure, `data` failure). Can be called any time on a live compartment, not just on load — useful for periodic background audits.
- **`BackupLedgerError`** — chain or head mismatch
- **`BackupCorruptedError`** — data envelope hash mismatch (carries `collection` + `id`)

The data envelope cross-check is essentially the deferred `verifyIntegrity()` from #43: for every (collection, id) with a current value, find the most recent put in the ledger, recompute `sha256(envelope._data)`, and compare to the entry's `payloadHash`. Mismatch means an out-of-band write modified the data without going through Collection.put.

Backwards compat: pre-v0.4 backups (no `ledgerHead`, no `_internal`) load with a console warning and skip the integrity check.

What's NOT in this PR (defer to follow-up):
- HMAC signing — skipped because the chain itself is the integrity guarantee. A signature would protect against backup substitution attacks (replacing the file with a different valid backup), which is out of scope for v0.4.
- A `verifyBackupIntegrity()` analogue for old-format backups — pre-v0.4 backups have no chain to verify.
- Per-collection or per-record granular integrity errors — only the first failure is surfaced today.

## Side fix: keyring reload on `Compartment.load()`

Encrypted backups previously couldn't round-trip because `load()` restored a different keyring file but the in-memory `Compartment.keyring` still held the pre-load session's DEKs, causing every subsequent decrypt to fail with `TamperedError`. The fix:

- New `reloadKeyring` callback wired through Noydb → Compartment that re-derives the unlocked keyring from the user's passphrase against the freshly-loaded keyring file
- Compartment.load() calls it after restoring keyrings, then rebuilds the cached `getDEK` resolver so the next encrypted operation sees the loaded wrapped DEKs
- Noydb's `keyringCache` is also invalidated so future `openCompartment` calls see the refreshed keyring

This makes encrypted dump→load round-trips work for the first time in a single process. Plaintext compartments are unaffected (no callback is provided).

Closes #46, part of #41.
