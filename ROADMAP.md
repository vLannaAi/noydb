# Roadmap

> **Current:** v0.11.0 shipped — 15 packages on the hub/to-*/in-* taxonomy. **Next:** v0.12 — storage structure (blob store, multi-backend topology, syncPolicy).
>
> Related docs:
> - [Architecture](./docs/architecture.md) — data flow, key hierarchy, threat model
> - [Deployment profiles](./docs/deployment-profiles.md) — pick your stack
> - [Getting started](./docs/getting-started.md) — install and first app
> - [Spec](./SPEC.md) — invariants (do not violate)

---

## Status

v0.11.0 is the current codebase (2026-04-10). **15 packages** on the **hub / to-* / in-*** naming taxonomy. Full surface from v0.5 through v0.11: zero-knowledge encryption, multi-user ACL, query DSL (joins, aggregations, streaming), sync v2 (CRDT, presence, partial), i18n primitives, identity/sessions, `.noydb` container format, store rename (NoydbStore / createStore / Vault), browser store split, AWS store renames, IndexedDB CAS fix, and the v0.11 package taxonomy rename. **1065 tests** passing.

npm publishing is **paused** pending registry cleanup — see HANDOVER.md.

---

## Releases

| Version  | Status          | Theme                                               |
|---------:|-----------------|-----------------------------------------------------|
| 0.5–0.11 | ✅ shipped      | Core library + all renames                          |
| **0.12** | 🔨 **next**     | **Storage structure** — blob store, multi-backend, syncPolicy |
| 0.13     | 📋 planned      | Store expansion — `to-*` packages + matching `auth-*` |
| 0.14     | 📋 planned      | Framework integrations — `in-*` + scaffolding       |
| 0.15     | 📋 planned      | Developer tools — CLI, store-probe, devtools        |
| 1.0      | 📋 planned      | Stability + LTS release                             |
| 1.x      | 🔭 vision       | Edge & realtime                                     |
| 2.0      | 🔭 vision       | Federation                                          |

---

## Guiding principles

Every future release respects these:

1. **Zero-knowledge stays zero-knowledge.** Adapters never see plaintext.
2. **Memory-first is the default.** Streaming, pagination, and lazy hydration are opt-in.
3. **Zero runtime crypto deps.** Web Crypto API only.
4. **Six-method store contract is sacred.** New capabilities go in core or in optional store extension interfaces.
5. **Pinia/Vue ergonomics are first-class.** If a feature makes Vue/Nuxt/Pinia adoption harder, it gets redesigned.
6. **Every feature ships with a `playground/` example** before it's documented as stable.

---

## v0.12 — Storage structure

**Goal:** Land the internal hub changes that all future store packages and topologies depend on. No new `to-*` packages ship here — just the contracts and primitives they build on.

### `NoydbBundleAdapter` interface (#103)

A second store shape for blob-store backends (Drive, WebDAV, Git, iCloud) that operate on whole-vault bundles rather than per-record KV. Backends implement `readBundle(vaultId)` / `writeBundle(vaultId, bytes)` instead of the six-method KV contract. Core wraps bundle adapters transparently so consumers use the same `openVault` / `collection.put` API regardless of the underlying store shape.

### `syncPolicy` scheduling (#101)

First-class `SyncPolicy` type in `NoydbOptions` — `{ push: { mode: 'on-change' | 'debounce' | 'interval' | 'manual', ... }, pull: { ... } }`. Default policies inferred by store category (indexed stores default `on-change`; bundle stores default `debounce` 30s). Foundation for per-target policy in the multi-backend topology.

### Encrypted binary attachment store (#105)

Blobs alongside records — large files (PDFs, images, audio) stored encrypted next to their parent records without inflating the in-memory collection. `collection.attachments(id)` returns an `AttachmentHandle` with `put(name, blob)` / `get(name)` / `list()`. Blobs go through the same DEK as the parent record; the attachment envelope carries `_noydb`, `_iv`, `_data` but never loads into the query layer.

### Multi-backend topology — `SyncTarget[]` (#158)

`NoydbOptions.sync` expands to accept `NoydbStore | SyncTarget | SyncTarget[]`. Each `SyncTarget` carries a `role` (`'sync-peer' | 'backup' | 'archive'`), optional per-target `policy`, and a display `label`. Write fanout is fire-and-mark-dirty — `put()` resolves on primary success only. See discussion #137 for full design.

---

## v0.13 — Store expansion

`to-*` packages that depend on v0.12 primitives (`NoydbBundleAdapter`, `syncPolicy`, `SyncTarget`), plus matching `auth-*` packages where the store has its own auth flow (OAuth for Drive, OIDC for cloud providers).

| Store                      | Shape    | Notes |
|----------------------------|----------|-------|
| `@noy-db/to-cloudflare-r2` | KV       | S3-compatible, no egress fees |
| `@noy-db/to-cloudflare-d1` | KV       | SQLite at the edge, free tier |
| `@noy-db/to-supabase`      | KV       | Postgres + storage |
| `@noy-db/to-ipfs`          | Bundle   | Content-addressed, hash-chain natural fit |
| `@noy-db/to-git`           | Bundle   | Vault = repo, history = commits |
| `@noy-db/to-webdav`        | Bundle   | Nextcloud, ownCloud, any WebDAV |
| `@noy-db/to-sqlite`        | KV       | Single-file, better than JSON >10K records |
| `@noy-db/to-turso`         | KV       | Edge SQLite with replication |
| `@noy-db/to-firestore`     | KV       | Firebase teams |
| `@noy-db/to-postgres`      | KV       | `jsonb` column, single-table pattern |
| `@noy-db/to-drive`         | Bundle   | Google Drive, OAuth (#104) |
| `@noy-db/to-icloud`        | Bundle   | iCloud Drive (#142) |
| `@noy-db/to-smb`           | KV/file  | SMB/CIFS network shares (#144) |
| `@noy-db/to-nfs`           | KV/file  | NFS network shares (#145) |

Also: `@noy-db/decrypt-sql` (#107) and SQL-backed adapters `@noy-db/to-postgres` / `@noy-db/to-mysql` (#108).

---

## v0.14 — Framework integrations + scaffolding

`in-*` packages for ecosystems beyond Vue/Nuxt/Pinia, plus `create-noy-db` templates and the multi-backend wizard.

| Package                         | Provides                                                       |
|---------------------------------|----------------------------------------------------------------|
| `@noy-db/in-react`              | `useNoydb`, `useCollection`, `useQuery`, `useSync` hooks       |
| `@noy-db/in-svelte`             | Reactive stores                                                |
| `@noy-db/in-solid`              | Signals                                                        |
| `@noy-db/in-qwik`               | Resumable queries                                              |
| `@noy-db/in-tanstack-query`     | Query function adapter — paginate / infinite-scroll            |
| `@noy-db/in-tanstack-table`     | Bridge for the existing `useSmartTable` pattern                |
| `@noy-db/in-zustand`            | Zustand store factory mirroring `defineNoydbStore`             |

All share one core implementation; framework packages stay thin (~200 LoC each).

Scaffolding additions: `vite-vue`, `electron`, and `vanilla` templates for `create-noy-db` (#155–157), plus the multi-backend setup wizard (#159).

---

## v0.15 — Developer tools

`@noy-db/store-probe` (setup-time suitability + runtime monitor, single and multi-backend), `.noydb` reader CLI, Chrome extension, Nuxt devtools tab, `nuxi noydb` CLI extension, and naked-mode debugging (#106).

---

## v1.0 — Stability + LTS release

- API freeze. Every public symbol marked `@stable`. Semver enforced.
- Third-party security audit of crypto, sync, and access control.
- Performance benchmarks published; tracked in CI with regression alerts.
- Migration tooling: `noydb migrate --from 0.x` for envelope/keyring schema changes.
- Documentation site with searchable API docs, recipes, video walkthroughs.
- LTS branch with security backports for 18 months.

---

## v1.x — Edge & realtime

- **Edge worker adapter.** NOYDB inside Cloudflare Workers / Deno Deploy / Vercel Edge.
- **WebRTC peer sync (`@noy-db/p2p`).** Direct browser-to-browser, encrypted, no server in the middle. TURN fallback only sees ciphertext.
- **Encrypted BroadcastChannel.** Multi-tab session and hot cache sharing.
- **Reactive subscriptions over the wire.** `collection.subscribe(query, callback)` works across tabs, peers, and edge workers.

---

## v2.0 — Federation & verifiable credentials

- **Multi-instance federation.** Two vaults at two organizations share a *bridged collection* via ECDH-derived session keys; each side keeps its own DEK.
- **Verifiable credentials (W3C VC).** Sign records as VCs; pairs with the hash-chained ledger for non-repudiation.
- **Zero-knowledge proofs.** "I have at least N invoices over $X without showing them" via zk-SNARKs. Gated by a real use case.

---

## Plaintext export packages — `@noy-db/decrypt-*`

> Spawned from discussion vLannaAi/noy-db#70.

`vault.dump()` produces an **encrypted, tamper-evident envelope** for backup and transport. It is the right answer when bytes are leaving an active session and need to remain protected. It is the **wrong answer** when a downstream tool needs to read records as plaintext in a standard format.

### Naming policy: `@noy-db/decrypt-{format}`

Named `@noy-db/decrypt-*` instead of `@noy-db/export-*` deliberately. The word **"decrypt"** in the package name forces the consumer to acknowledge what they are actually doing — it shows up in `package.json`, imports, the lockfile, `npm audit`, and every code review. That visibility is the entire point.

```ts
import { decryptToCSV }  from '@noy-db/decrypt-csv'
import { decryptToXML }  from '@noy-db/decrypt-xml'
import { decryptToXLSX } from '@noy-db/decrypt-xlsx'
```

| Package                  | Deps                                  | Target              |
|--------------------------|---------------------------------------|---------------------|
| `@noy-db/decrypt-csv`    | Zero. ~50 LOC.                        | opportunistic       |
| `@noy-db/decrypt-xml`    | Zero. Hand-rolled ~200–300 LOC.       | opportunistic       |
| `@noy-db/decrypt-xlsx`   | Peer dep on `xlsx` or `exceljs`.      | v0.9+               |

Every `@noy-db/decrypt-*` README starts with an explicit warning block: what plaintext-on-disk means, when use is legitimate, and a pointer to `dump()` for the encrypted path.

JSON is **not** in this family — `exportJSON()` lives in `@noy-db/hub` (zero-dep, five lines, same warning in docs).

---

## Cross-cutting investments

- **Bundle size budget.** Core under 30 KB gzipped. Each store under 10 KB.
- **Tree-shakeable feature flags.** Indexes, ledger, schema validation each cost zero bytes if unused.
- **WASM crypto fast path.** Optional accelerator for >10MB bulk encrypts. Never a dependency.
- **Accessibility.** Vue/Nuxt UI primitives produce ARIA-correct output.
- **i18n of error messages.** Especially Thai, given the first consumer.
- **Telemetry.** Opt-in only, local-first. `noydb stats` shows your own usage; nothing leaves the device.

---

## Contributing

Open a discussion before opening a PR that touches anything past v0.12 — the further out on the roadmap, the more likely the design will shift. Anything that violates the *Guiding principles* is out of scope, no matter how exciting.

---

*Roadmap last updated: noy-db v0.11.0 — 2026-04-10*
