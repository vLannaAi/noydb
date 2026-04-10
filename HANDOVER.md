# Session handover

> **Purpose:** context for the next Claude Code session. Read this first —
> it will save you 10 minutes of re-discovery.
>
> **Updated:** 2026-04-10 — v0.12.0 shipped (storage routing, blob store, middleware, multi-backend). npm publishing still PAUSED. Next: v0.13 store expansion.

---

## What this project is

NOYDB is a zero-knowledge, offline-first, encrypted document store with
pluggable backends and multi-user access control. TypeScript monorepo,
Node 18+ and modern browsers. See `SPEC.md` for the full design reference;
`CLAUDE.md` for coding conventions.

**Privacy rule (CLAUDE.md):** never name the first consumer (an accounting
firm). Use "accounting firm", "first consumer", or "the platform". Grep for
the actual name before any commit or publish that touches user-facing copy.

---

## Current state: v0.12.0 shipped — npm publishing still paused

v0.12.0 code is **done**. 15 packages, **850 tests** passing across 51 test files.
**npm publishing is PAUSED** — see npm cleanup section below.

### What shipped in v0.12 (7 issues closed)

| Issue | Feature | Key file |
|-------|---------|----------|
| #105 | Encrypted blob store (`BlobSet`) | `hub/src/blob-set.ts` |
| #103 | `NoydbBundleStore` with OCC | `hub/src/bundle-store.ts` |
| #101 | `syncPolicy` scheduling | `hub/src/sync-policy.ts` |
| #158 | `SyncTarget[]` multi-backend | `hub/src/noydb.ts` |
| #162 | `routeStore()` split-store routing | `hub/src/route-store.ts` |
| #163 | Ephemeral routing (override/suspend) | `hub/src/route-store.ts` |
| #164 | Store middleware (E1-E10) | `hub/src/store-middleware.ts` |

### New files in hub/src/

- `blob-set.ts` — BlobSet class (replaces old attachments.ts)
- `mime-magic.ts` — MIME detection from magic bytes (55 rules, 48 formats)
- `sync-policy.ts` — SyncPolicy types + SyncScheduler
- `route-store.ts` — routeStore multiplexer + override/suspend
- `store-middleware.ts` — wrapStore + 6 middlewares (retry, logging, metrics, circuit breaker, cache, health check)
- `attachments.ts` — legacy compat file (old naming)

### API renames in v0.12

| Old | New |
|-----|-----|
| `collection.attachments(id)` | `collection.blob(id)` |
| `AttachmentHandle` | `BlobSet` |
| `AttachmentEntry` | `SlotRecord` |
| `ATTACH_META_PREFIX` | `BLOB_SLOTS_PREFIX` |

### Deferred to v0.13

- `vault.blobGC()` full reconciliation scan
- True streaming decompression (`DecompressionStream` piping)
- Blob sync via `SyncTarget`
- `_blob` DEK rotation with eTag recomputation
- Concrete `to-drive` / `to-webdav` bundle store packages
- Timer-mocked tests for syncPolicy debounce coalescing

**Open milestones:** v0.13.0 (store expansion), v0.14.0 (frameworks + scaffolding), v0.15.0 (developer tools).

---

## npm cleanup status — DO THIS BEFORE ANY PUBLISHING

### The plan (execute in order)

**Step 1 — Try again tomorrow (2026-04-11):**
Some versions that are currently blocked by the 72h window will have expired.
Retry unpublishing any remaining versions from the old package names.

**Step 2 — Send npm support email:**
Go to **https://www.npmjs.com/support** (available on free plan).
Request hard deletion of all pre-v0.10.0 versions across the old package names.
Key points to include:
- Pre-release cleanup before first public launch
- Zero downloads across all affected versions
- All versions already deprecated with migration messages
- Packages to clean: `@noy-db/hub`, `@noy-db/file`, `@noy-db/memory`,
  `@noy-db/vue`, `@noy-db/pinia`, `@noy-db/nuxt`, `@noy-db/s3`,
  `@noy-db/browser`, `@noy-db/dynamo`, `@noy-db/create`
- Versions: everything `<0.10.0` plus the stuck last-versions

**Step 3 — Once registry is clean, publish v0.11.0:**
Re-enable the release workflow and publish all 15 packages under the new names.
Version to publish: **0.11.0**. All code is ready on `main`.

### Current npm state (as of 2026-04-10)

**New packages at 0.10.0 — FORCE-UNPUBLISHED (will need re-publishing):**
- `@noy-db/to-file@0.10.0` — deleted
- `@noy-db/to-memory@0.10.0` — deleted
- `@noy-db/to-browser-local@0.10.0` — deleted
- `@noy-db/to-browser-idb@0.10.0` — deleted
- `@noy-db/to-aws-s3@0.10.0` — deleted
- `@noy-db/to-aws-dynamo@0.10.0` — deleted
- `create-noy-db@0.10.0` — deleted

**Still live at 0.10.0 (good — keep these):**
- `@noy-db/hub@0.10.0` ✓
- `@noy-db/vue@0.10.0` ✓
- `@noy-db/pinia@0.10.0` ✓
- `@noy-db/nuxt@0.10.0` ✓

**Old package names — stuck, deprecated, need npm support to fully remove:**

| Package | Remaining versions | Status |
|---|---|---|
| `@noy-db/hub` | 0.1.0–0.9.0 | All deprecated ✓ |
| `@noy-db/file` | 0.1.0–0.3.0 (>72h), 0.5.0–0.9.0 | All deprecated ✓; E405 on unpublish |
| `@noy-db/memory` | 0.1.0 (>72h), 0.1.1–0.9.0 | All deprecated ✓ |
| `@noy-db/vue` | 0.1.0 (>72h), 0.1.1–0.9.0 | All deprecated ✓ |
| `@noy-db/pinia` | 0.3.0 (>72h), 0.4.0–0.9.0 | All deprecated ✓; E405 on unpublish |
| `@noy-db/nuxt` | 0.3.0 (>72h), 0.4.1–0.9.0 | Needs deprecation; E405 on unpublish |
| `@noy-db/s3` | 0.9.0 | Deprecated ✓; E422 on force-delete |
| `@noy-db/browser` | 0.9.0 | Deprecated ✓; E422 on force-delete |
| `@noy-db/dynamo` | 0.9.0 | Deprecated ✓; E422 on force-delete |
| `@noy-db/create` | all gone | ✓ fully unpublished |

**npm error codes reference:**
- **E405** — "has dependent packages in the registry" — another package peer-deps on this one
- **E422** — full package DELETE blocked (package first published >72h ago; npm policy)
- **EUSAGE** — refusing to delete last version without `--force`
- `@noy-db/nuxt@0.10.0` peer-deps on `@noy-db/vue`, `@noy-db/pinia`, `@noy-db/hub` — this is why pinia/vue old versions get E405

---

## v0.13.0 — Store expansion (next milestone)

New `to-*` packages that depend on v0.12 primitives. See ROADMAP.md for the full list (14 store packages planned).

Priority targets:
- `@noy-db/to-drive` — Google Drive bundle store (first `NoydbBundleStore` consumer)
- `@noy-db/to-webdav` — WebDAV bundle store (Nextcloud, ownCloud)
- `@noy-db/to-sqlite` — single-file SQLite (better than JSON > 10K records)
- `@noy-db/to-cloudflare-r2` — S3-compatible, no egress fees

Also: `vault.blobGC()`, true blob streaming, blob sync, `_blob` DEK rotation.

---

## Release-time invariants (hard-won — do not skip)

1. **Always use `pnpm release:version`** — never `pnpm changeset version` directly.
2. **Peer deps must be `workspace:*`** not `workspace:^` — prevents changeset pre-1.0 major-bump bug.
3. **New packages need lockfile updates before CI** — `pnpm install` locally, commit lockfile.
4. **Auth branches must rebase onto core branch, not main** when new core barrel exports added.
5. **happy-dom WebCrypto is occasionally flaky** — just re-run the CI job if `auth-oidc` fails.
6. **PR merge order matters** — core PR first, then auth PRs rebased onto updated main.

---

## Build commands

```bash
pnpm install                      # install all workspace deps
pnpm turbo build                  # build all packages
pnpm turbo test                   # run all tests
pnpm turbo lint                   # lint all packages
pnpm turbo typecheck              # typecheck all packages
pnpm vitest run packages/hub      # run core tests only
pnpm vitest run -t "session"      # run tests matching pattern

# Release (PAUSED — do not run until npm cleanup is complete and v0.11.0 is published)
pnpm release:version              # bump all packages to core's version
git add . && git commit -m "chore: release vX.Y.Z"
git push origin main && git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z
pnpm turbo build && pnpm changeset publish
```

---

## ESLint rules that bite

| Rule | What it requires |
|------|-----------------|
| `@typescript-eslint/no-unused-vars` | Prefix unused vars with `_` |
| `@typescript-eslint/no-explicit-any` | Use `unknown` instead of `any` |
| `@typescript-eslint/no-non-null-assertion` | Avoid `!` — narrow the type |
| `@typescript-eslint/no-unnecessary-type-assertion` | Don't cast when already narrowed |
| `import/no-cycle` | No circular imports |
| `no-restricted-syntax` (inline import) | No `import()` type refs inline — import at top |
