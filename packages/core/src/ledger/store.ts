/**
 * `LedgerStore` — read/write access to a compartment's hash-chained
 * audit log.
 *
 * The store is a thin wrapper around the adapter's `_ledger/` internal
 * collection. Every append:
 *
 *   1. Loads the current head (or treats an empty ledger as head = -1)
 *   2. Computes `prevHash` = sha256(canonicalJson(head))
 *   3. Builds the new entry with `index = head.index + 1`
 *   4. Encrypts the entry with the compartment's ledger DEK
 *   5. Writes the encrypted envelope to `_ledger/<paddedIndex>`
 *
 * `verify()` walks the chain from genesis forward and returns
 * `{ ok: true, head }` on success or `{ ok: false, divergedAt }` on the
 * first broken link.
 *
 * ## Thread / concurrency model
 *
 * For v0.4 we assume a **single writer per compartment**. Two
 * concurrent `append()` calls would race on the "read head, write
 * head+1" cycle and could produce a broken chain. The v0.3 sync engine
 * is the primary concurrent-writer scenario, and it uses
 * optimistic-concurrency via `expectedVersion` on the adapter — but
 * the ledger path has no such guard today. Multi-writer hardening is a
 * v0.5 follow-up.
 *
 * Single-writer usage IS safe, including across process restarts:
 * `head()` reads the adapter fresh each call, so a crash between the
 * adapter.put of a data record and the ledger append just means the
 * ledger is missing an entry for that record. `verify()` still
 * succeeds; a future `verifyIntegrity()` helper can cross-check the
 * ledger against the data collections to catch the gap.
 *
 * ## Why hide the ledger from `compartment.collection()`?
 *
 * The `_ledger` name starts with `_`, matching the existing prefix
 * convention for internal collections (`_keyring`, `_sync`,
 * `_history`). The Compartment's public `collection()` method already
 * returns entries for any name, but `loadAll()` filters out
 * underscore-prefixed collections so backups and exports don't leak
 * ledger metadata. We keep the ledger accessible ONLY via
 * `compartment.ledger()` to enforce the hash-chain invariants — direct
 * puts via `collection('_ledger')` would bypass the `append()` logic.
 */

import type { NoydbAdapter, EncryptedEnvelope } from '../types.js'
import { NOYDB_FORMAT_VERSION } from '../types.js'
import { encrypt, decrypt } from '../crypto.js'
import {
  canonicalJson,
  hashEntry,
  paddedIndex,
  sha256Hex,
  type LedgerEntry,
} from './entry.js'

/** The internal collection name used for ledger storage. */
export const LEDGER_COLLECTION = '_ledger'

/**
 * Input shape for `LedgerStore.append()`. The caller supplies the
 * operation metadata; the store fills in `index` and `prevHash`.
 */
export interface AppendInput {
  op: LedgerEntry['op']
  collection: string
  id: string
  version: number
  actor: string
  payloadHash: string
}

/**
 * Result of `LedgerStore.verify()`. On success, `head` is the hash of
 * the last entry — the same value that should be published to any
 * external anchoring service (blockchain, OpenTimestamps, etc.). On
 * failure, `divergedAt` is the 0-based index of the first entry whose
 * recorded `prevHash` does not match the recomputed hash of its
 * predecessor. Entries at `divergedAt` and later are untrustworthy;
 * entries before that index are still valid.
 */
export type VerifyResult =
  | { readonly ok: true; readonly head: string; readonly length: number }
  | {
      readonly ok: false
      readonly divergedAt: number
      readonly expected: string
      readonly actual: string
    }

/**
 * A LedgerStore is bound to a single compartment. Callers obtain one
 * via `compartment.ledger()` — there is no public constructor to keep
 * the hash-chain invariants in one place.
 *
 * The class holds no mutable state beyond its dependencies (adapter,
 * compartment name, DEK resolver, actor id). Every method reads the
 * adapter fresh so multiple instances against the same compartment
 * see each other's writes immediately (at the cost of re-parsing the
 * ledger on every head() / verify() call; acceptable at v0.4 scale).
 */
export class LedgerStore {
  private readonly adapter: NoydbAdapter
  private readonly compartment: string
  private readonly encrypted: boolean
  private readonly getDEK: (collectionName: string) => Promise<CryptoKey>
  private readonly actor: string

  /**
   * In-memory cache of the chain head — the most recently appended
   * entry along with its precomputed hash. Without this, every
   * `append()` would re-load every prior entry to recompute the
   * prevHash, making N puts O(N²) — a 1K-record stress test goes from
   * < 100ms to a multi-second timeout.
   *
   * The cache is populated on first read (`append`, `head`, `verify`)
   * and updated in-place on every successful `append`. Single-writer
   * usage (the v0.4 assumption) keeps it consistent. A second
   * LedgerStore instance writing to the same compartment would not
   * see the first instance's appends in its cached state — that's the
   * concurrency caveat documented at the class level.
   *
   * Sentinel `undefined` means "not yet loaded"; an explicit `null`
   * value means "loaded and confirmed empty" — distinguishing these
   * matters because an empty ledger is a valid state (genesis prevHash
   * is the empty string), and we don't want to re-scan the adapter
   * just because the chain is freshly initialized.
   */
  private headCache: { entry: LedgerEntry; hash: string } | null | undefined = undefined

  constructor(opts: {
    adapter: NoydbAdapter
    compartment: string
    encrypted: boolean
    getDEK: (collectionName: string) => Promise<CryptoKey>
    actor: string
  }) {
    this.adapter = opts.adapter
    this.compartment = opts.compartment
    this.encrypted = opts.encrypted
    this.getDEK = opts.getDEK
    this.actor = opts.actor
  }

  /**
   * Lazily load (or return cached) the current chain head. The cache
   * sentinel is `undefined` until first access; after the first call,
   * the cache holds either a `{ entry, hash }` for non-empty ledgers
   * or `null` for empty ones.
   */
  private async getCachedHead(): Promise<{ entry: LedgerEntry; hash: string } | null> {
    if (this.headCache !== undefined) return this.headCache
    const entries = await this.loadAllEntries()
    const last = entries[entries.length - 1]
    if (!last) {
      this.headCache = null
      return null
    }
    this.headCache = { entry: last, hash: await hashEntry(last) }
    return this.headCache
  }

  /**
   * Append a new entry to the ledger. Returns the full entry that was
   * written (with its assigned index and computed prevHash) so the
   * caller can use the hash for downstream purposes (e.g., embedding
   * in a verifiable backup).
   *
   * This is the **only** way to add entries. Direct adapter writes to
   * `_ledger/` would bypass the chain math and would be caught by the
   * next `verify()` call as a divergence.
   */
  async append(input: AppendInput): Promise<LedgerEntry> {
    const cached = await this.getCachedHead()
    const lastEntry = cached?.entry
    const prevHash = cached?.hash ?? ''
    const nextIndex = lastEntry ? lastEntry.index + 1 : 0

    const entry: LedgerEntry = {
      index: nextIndex,
      prevHash,
      op: input.op,
      collection: input.collection,
      id: input.id,
      version: input.version,
      ts: new Date().toISOString(),
      actor: input.actor === '' ? this.actor : input.actor,
      payloadHash: input.payloadHash,
    }

    const envelope = await this.encryptEntry(entry)
    await this.adapter.put(
      this.compartment,
      LEDGER_COLLECTION,
      paddedIndex(entry.index),
      envelope,
    )

    // Update the head cache so the next append() doesn't re-scan the
    // adapter. Computing the hash here is cheap (sha256 over a small
    // canonical JSON string) and avoids any possibility of cache drift
    // — the value we store is exactly what `prevHash` will be on the
    // next append.
    this.headCache = { entry, hash: await hashEntry(entry) }
    return entry
  }

  /**
   * Read all entries in ascending-index order. Used internally by
   * `append()`, `head()`, `verify()`, and `entries()`. Decryption is
   * serial because the entries are tiny and the overhead of a Promise
   * pool would dominate at realistic chain lengths (< 100K entries).
   */
  async loadAllEntries(): Promise<LedgerEntry[]> {
    const keys = await this.adapter.list(this.compartment, LEDGER_COLLECTION)
    // Sort lexicographically, which matches numeric order because
    // keys are zero-padded to 10 digits.
    keys.sort()
    const entries: LedgerEntry[] = []
    for (const key of keys) {
      const envelope = await this.adapter.get(
        this.compartment,
        LEDGER_COLLECTION,
        key,
      )
      if (!envelope) continue
      entries.push(await this.decryptEntry(envelope))
    }
    return entries
  }

  /**
   * Return the current head of the ledger: the last entry, its hash,
   * and the total chain length. `null` on an empty ledger so callers
   * can distinguish "no history yet" from "empty history".
   */
  async head(): Promise<
    | { readonly entry: LedgerEntry; readonly hash: string; readonly length: number }
    | null
  > {
    const cached = await this.getCachedHead()
    if (!cached) return null
    // `length` is `entry.index + 1` because indices are zero-based and
    // contiguous. We don't need to re-scan the adapter to compute it.
    return {
      entry: cached.entry,
      hash: cached.hash,
      length: cached.entry.index + 1,
    }
  }

  /**
   * Return entries in the requested half-open range `[from, to)`.
   * Defaults: `from = 0`, `to = length`. The indices are clipped to
   * the valid range; no error is thrown for out-of-range queries.
   */
  async entries(opts: { from?: number; to?: number } = {}): Promise<LedgerEntry[]> {
    const all = await this.loadAllEntries()
    const from = Math.max(0, opts.from ?? 0)
    const to = Math.min(all.length, opts.to ?? all.length)
    return all.slice(from, to)
  }

  /**
   * Walk the chain from genesis forward and verify every link.
   *
   * Returns `{ ok: true, head, length }` if every entry's `prevHash`
   * matches the recomputed hash of its predecessor (and the genesis
   * entry's `prevHash` is the empty string).
   *
   * Returns `{ ok: false, divergedAt, expected, actual }` on the first
   * mismatch. `divergedAt` is the 0-based index of the BROKEN entry
   * — entries before that index still verify cleanly; entries at and
   * after `divergedAt` are untrustworthy.
   *
   * This method detects:
   *   - Mutated entry content (fields changed)
   *   - Reordered entries (if any adjacent pair swaps, the prevHash
   *     of the second no longer matches)
   *   - Inserted entries (the inserted entry's prevHash likely fails,
   *     and the following entry's prevHash definitely fails)
   *   - Deleted entries (the entry after the deletion sees a wrong
   *     prevHash)
   *
   * It does NOT detect:
   *   - Tampering with the DATA collections that bypassed the ledger
   *     entirely (e.g., an attacker who modifies records without
   *     appending matching ledger entries — this is why we also
   *     plan a `verifyIntegrity()` helper in a follow-up)
   *   - Truncation of the chain at the tail (dropping the last N
   *     entries leaves a shorter but still consistent chain). External
   *     anchoring of `head.hash` to a trusted service is the defense
   *     against this.
   */
  async verify(): Promise<VerifyResult> {
    const entries = await this.loadAllEntries()
    let expectedPrevHash = ''
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      if (!entry) continue
      if (entry.prevHash !== expectedPrevHash) {
        return {
          ok: false,
          divergedAt: i,
          expected: expectedPrevHash,
          actual: entry.prevHash,
        }
      }
      if (entry.index !== i) {
        // An entry whose stored index doesn't match its position in
        // the sorted list means someone rewrote the adapter keys.
        // Treat as divergence.
        return {
          ok: false,
          divergedAt: i,
          expected: `index=${i}`,
          actual: `index=${entry.index}`,
        }
      }
      expectedPrevHash = await hashEntry(entry)
    }
    return {
      ok: true,
      head: expectedPrevHash,
      length: entries.length,
    }
  }

  // ─── Encryption plumbing ─────────────────────────────────────────

  /**
   * Serialize + encrypt a ledger entry into an EncryptedEnvelope. The
   * envelope's `_v` field is set to `entry.index + 1` so the usual
   * optimistic-concurrency machinery has a reasonable version number
   * to compare against (the ledger is append-only, so concurrent
   * writes should always bump the index).
   */
  private async encryptEntry(entry: LedgerEntry): Promise<EncryptedEnvelope> {
    const json = canonicalJson(entry)
    if (!this.encrypted) {
      return {
        _noydb: NOYDB_FORMAT_VERSION,
        _v: entry.index + 1,
        _ts: entry.ts,
        _iv: '',
        _data: json,
        _by: entry.actor,
      }
    }
    const dek = await this.getDEK(LEDGER_COLLECTION)
    const { iv, data } = await encrypt(json, dek)
    return {
      _noydb: NOYDB_FORMAT_VERSION,
      _v: entry.index + 1,
      _ts: entry.ts,
      _iv: iv,
      _data: data,
      _by: entry.actor,
    }
  }

  /** Decrypt an envelope into a LedgerEntry. Throws on bad key / tamper. */
  private async decryptEntry(envelope: EncryptedEnvelope): Promise<LedgerEntry> {
    if (!this.encrypted) {
      return JSON.parse(envelope._data) as LedgerEntry
    }
    const dek = await this.getDEK(LEDGER_COLLECTION)
    const json = await decrypt(envelope._iv, envelope._data, dek)
    return JSON.parse(json) as LedgerEntry
  }
}

/**
 * Compute the `payloadHash` value for an encrypted envelope. Pulled
 * out as a standalone helper because both `put` (hash the new
 * envelope's `_data`) and `delete` (hash the previous envelope's
 * `_data`) need the same calculation, and the logic is small enough
 * that duplicating it would be noise.
 */
export async function envelopePayloadHash(
  envelope: EncryptedEnvelope | null,
): Promise<string> {
  if (!envelope) return ''
  // `_data` is a base64 string for encrypted envelopes and the raw
  // JSON for plaintext ones. Both are strings, so a single sha256Hex
  // call works for both modes — the hash value is different between
  // encrypted/plaintext compartments, but that's correct: they're
  // different bytes on disk.
  return sha256Hex(envelope._data)
}
