# Roadmap

> **Current:** v0.12.0 shipped — storage routing, blob store, middleware, multi-backend topology. **Next:** v0.13 — store expansion (`to-*` packages).
>
> Related docs:
> - [Architecture](./docs/architecture.md) — data flow, key hierarchy, threat model
> - [Deployment profiles](./docs/deployment-profiles.md) — pick your stack
> - [Getting started](./docs/getting-started.md) — install and first app
> - [Spec](./SPEC.md) — invariants (do not violate)

---

## Status

v0.12.0 is the current codebase (2026-04-10). **15 packages** on the **hub / to-* / in-*** naming taxonomy. v0.12 adds encrypted blob store, store routing (`routeStore`), store middleware (`wrapStore`), `NoydbBundleStore`, `syncPolicy` scheduling, `SyncTarget[]` multi-backend topology, and runtime ephemeral routing. **850 tests** passing.

npm publishing is **paused** pending registry cleanup — see HANDOVER.md.

---

## Releases

| Version  | Status          | Theme                                               |
|---------:|-----------------|-----------------------------------------------------|
| 0.5–0.11 | ✅ shipped      | Core library + all renames                          |
| **0.12** | ✅ **shipped**  | **Storage structure** — blob store, routing, middleware, multi-backend |
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

## v0.12 — Storage structure (shipped 2026-04-10)

Internal hub changes that all future store packages and topologies depend on. 7 issues closed (#103, #105, #101, #158, #162, #163, #164).

### Encrypted binary blob store (#105)

`collection.blob(id)` returns a `BlobSet` for encrypted binary attachments. HMAC-SHA-256 keyed eTags (opaque to store), AES-256-GCM per-chunk with AAD binding, refCount with CAS retry, MIME auto-detection (55 magic-byte rules), selective versioning (`publish`/`getVersion`), HTTP `Response` surface.

### Store routing — `routeStore()` (#162)

Store multiplexer: records to DynamoDB, blobs to S3, cold data to archive. Five routing dimensions: collection prefix, record size (tiered blobs), record age, collection identity, vault name (geographic). 27x cost reduction for blob storage vs DynamoDB-only.

### Ephemeral routing (#163)

Runtime `override()`/`suspend()`/`resume()` for shared devices and restricted networks. Write-behind queue on suspended routes with replay on resume.

### Store middleware (#164)

`wrapStore(store, withRetry(), withCache(), withCircuitBreaker(), withHealthCheck(), withLogging(), withMetrics())` — composable interceptors for any `NoydbStore`.

### `NoydbBundleStore` (#103)

Second store shape for whole-vault bundle backends (Drive, WebDAV, iCloud). OCC via version tokens, `wrapBundleStore` with `autoFlush`/`batch`/`flush` modes, LWW conflict merge.

### `syncPolicy` scheduling (#101)

`SyncPolicy` type: 4 push modes (`manual`/`on-change`/`debounce`/`interval`), 3 pull modes. `SyncScheduler` with `minIntervalMs` floor and `onUnload` hooks. `INDEXED_STORE_POLICY` / `BUNDLE_STORE_POLICY` defaults.

### Multi-backend topology — `SyncTarget[]` (#158)

`NoydbOptions.sync` accepts `NoydbStore | SyncTarget | SyncTarget[]`. Roles: `sync-peer` (bidirectional), `backup`/`archive` (push-only). Write fanout with `sync:backup-error` event. Per-target policy override.

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
