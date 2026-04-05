# NOYDB Implementation Roadmap

## Context

NOYDB is a zero-knowledge, offline-first, encrypted document store defined by a 1260-line spec (`NOYDB_SPEC.md`). The repository currently contains **only** the spec, a `CLAUDE.md` guidance file, and an empty `docs/` directory. No git repo, no code, no tooling exists yet. This roadmap covers the full journey from empty directory to published npm packages.

The user's top priorities are: **(1)** comprehensive test/simulation coverage across all operational contexts, **(2)** lean production packages with zero test/debug code shipped, **(3)** minimal dependencies, **(4)** strict TypeScript with runtime environment enforcement, **(5)** community-ready (MIT license, docs, GitHub, npm).

---

## Phase 0 — Repository Scaffolding & Tooling

### 0.1 Git + Monorepo Init

```
git init
```

Create the following structure:

```
.gitignore                         # node_modules, dist, coverage, .turbo, *.tgz
.npmrc                             # engine-strict=true, strict-peer-dependencies=true
package.json                       # private root, pnpm workspaces, devDeps
pnpm-workspace.yaml                # packages: ["packages/*", "test-harnesses/*"]
turbo.json                         # tasks: build, test, lint, typecheck
tsconfig.base.json                 # strict TS shared config
LICENSE                            # MIT full text
README.md                          # skeleton (badges, project description, install)
SECURITY.md                        # extracted from spec's security model
CONTRIBUTING.md                    # how to contribute, run tests, add adapters
.github/
  workflows/
    ci.yml                         # lint + typecheck + test (Node 18/20/22 matrix) + build
    release.yml                    # changesets publish to npm on main merge
  CODEOWNERS
.changeset/
  config.json                      # access: public, linked: [["@noydb/*"]]
```

**Root package.json** — `private: true`, pnpm workspaces, devDeps:
- `turbo`, `typescript` (~5.7), `tsup`, `vitest`, `eslint`, `@typescript-eslint/*`, `@changesets/cli`
- Scripts: `build`, `test`, `test:ci`, `lint`, `typecheck`, `release`

**tsconfig.base.json** — strict mode:
- `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`
- `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`

### 0.2 Per-Package Template

Every package under `packages/` follows:

```
packages/{name}/
  src/index.ts                     # entry point
  __tests__/                       # tests (excluded from build and npm)
  package.json                     # see exports pattern below
  tsconfig.json                    # extends ../../tsconfig.base.json
  tsup.config.ts                   # entry: src/index.ts, format: [esm, cjs], dts: true
```

**package.json exports pattern** (dual ESM/CJS with types):
```json
{
  "type": "module",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  },
  "files": ["dist"],
  "engines": { "node": ">=18.0.0" }
}
```

The `"files": ["dist"]` field is the primary mechanism ensuring tests, `__tests__/`, `src/`, and devDeps never ship to npm.

### 0.3 ESLint + Vitest Config

**ESLint** — flat config (`eslint.config.mjs`), `@typescript-eslint/strict-type-checked` preset, key rules:
- `@typescript-eslint/no-explicit-any: error`
- `@typescript-eslint/no-floating-promises: error`

**Vitest** — root `vitest.config.ts` using `projects` feature:
```ts
export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.ts', 'test-harnesses/*/vitest.config.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] }
  }
})
```

### 0.4 CI/CD Pipeline

**ci.yml** — on push/PR to main:
1. pnpm install → lint → typecheck → test (Node 18/20/22 matrix) → build
2. Verify no test files in pack output: `pnpm pack --dry-run` assertion step

**release.yml** — on main merge with changesets:
1. Build → test → `changeset publish` → git tag → GitHub Release

---

## Phase 0.5 — Test Architecture (before any implementation)

This is the user's #1 priority. Define the test infrastructure first, then implement code to make tests pass.

### Test Harnesses (private workspace packages, never published)

```
test-harnesses/
  adapter-conformance/             # Parameterized adapter contract tests
  simulation-sync/                 # Two-instance sync scenarios
  simulation-concurrent/           # Concurrent write simulation
  simulation-offline-online/       # Network toggle / state transition tests
  simulation-filesystem/           # File adapter edge cases (USB, permissions, corrupt)
  simulation-multiuser/            # Multi-user grant/revoke/rotate scenarios
  benchmarks/                      # Performance benchmarks (vitest.bench)
```

Each is `"private": true` in package.json, included in `pnpm-workspace.yaml` but never published.

### Adapter Conformance Suite (`test-harnesses/adapter-conformance/`)

A single parameterized test factory that every adapter imports and runs:

```ts
export function runAdapterConformanceTests(
  name: string,
  factory: () => Promise<NoydbAdapter>,
  cleanup?: () => Promise<void>
) {
  describe(`Adapter Conformance: ${name}`, () => {
    // Basic CRUD (7 tests)
    // Optimistic concurrency (3 tests)
    // Bulk operations — loadAll/saveAll (4 tests)
    // Compartment/collection isolation (3 tests)
    // Edge cases — Unicode/Thai IDs, 1MB+ envelopes, special chars, 100 rapid writes (5 tests)
  })
}
```

Each adapter runs this with one import:
```ts
// packages/adapter-memory/__tests__/conformance.test.ts
import { runAdapterConformanceTests } from '@noydb/test-adapter-conformance'
runAdapterConformanceTests('memory', async () => memory())
```

### How Tests Stay Out of Production (5 layers)

1. **`"files": ["dist"]`** in each package.json — npm pack includes only dist/
2. **`__tests__/` outside src/** — tsup entry is `src/index.ts`, tests never bundled
3. **`test-harnesses/` are `"private": true`** — never published
4. **`.npmignore` safety net** — excludes `__tests__/`, `*.test.ts`, `vitest.config.ts`
5. **CI verification** — `pnpm pack --dry-run` assertion step checks no test files leak

---

## Phase 1 — Core + Memory + File Adapters (Single-User MVP)

### Files to create

**`packages/core/src/`** (10 files):

| File | Purpose |
|------|---------|
| `env-check.ts` | Runtime check: throws if Node <18 or `crypto.subtle` missing |
| `types.ts` | All interfaces: `NoydbAdapter`, `EncryptedEnvelope`, `CompartmentSnapshot`, `NoydbOptions`, `Conflict`, roles, permissions |
| `errors.ts` | `NoydbError` base + 10 subtypes (`DecryptionError`, `TamperedError`, `InvalidKeyError`, `NoAccessError`, `ReadOnlyError`, `PermissionDeniedError`, `ConflictError`, `NetworkError`, `NotFoundError`, `ValidationError`) |
| `crypto.ts` | `deriveKey` (PBKDF2 600K), `generateDEK`, `wrapKey`/`unwrapKey` (AES-KW), `encrypt`/`decrypt` (AES-256-GCM), `generateIV`, `generateSalt` — all via `crypto.subtle` |
| `keyring.ts` | Phase 1 stub: owner-only mode (create keyring, load, derive KEK, unwrap DEKs) |
| `collection.ts` | `Collection<T>` class: `get`/`put`/`delete`/`list`/`query`/`count` with encrypt/decrypt |
| `compartment.ts` | `Compartment` class: manages collections, `dump`/`load`/`export` |
| `noydb.ts` | `Noydb` class + `createNoydb()` factory |
| `events.ts` | Typed `EventEmitter` (on/off/emit for `change`, `error`) |
| `index.ts` | Re-exports public API + triggers `env-check` side effect |

**`packages/adapter-memory/src/index.ts`** — `memory()` factory backed by nested Maps

**`packages/adapter-file/src/index.ts`** — `jsonFile({ dir, pretty? })` factory using `node:fs/promises`

### Runtime Environment Enforcement

`packages/core/src/env-check.ts` — imported as side effect at top of `index.ts`:

```ts
function checkEnvironment(): void {
  // Node.js version check
  if (typeof process !== 'undefined' && process.versions?.node) {
    const major = parseInt(process.versions.node.split('.')[0], 10)
    if (major < 18) {
      throw new Error('@noydb/core requires Node.js 18+ for Web Crypto API (crypto.subtle)')
    }
  }
  // Web Crypto API availability (works in both Node and browser)
  if (typeof globalThis.crypto?.subtle === 'undefined') {
    throw new Error(
      '@noydb/core requires the Web Crypto API (crypto.subtle). ' +
      'Node.js 18+ or modern browser (Chrome 63+, Firefox 57+, Safari 13+) required.'
    )
  }
}
checkEnvironment()
```

Hard stop (throws), not warn — `crypto.subtle` is non-negotiable.

### Phase 1 Tests

**Unit tests** (`packages/core/__tests__/`):
- `crypto.test.ts` — encrypt/decrypt round-trip, wrong-key rejection, tamper detection, IV uniqueness, Unicode/Thai text, empty strings, 1MB payloads, PBKDF2 determinism, wrapKey/unwrapKey round-trip, performance (1000 encrypts < 500ms)
- `collection.test.ts` — CRUD with encryption, version increment, timestamp, `encrypt:false` mode
- `events.test.ts` — emits on put/delete, off() unsubscribes
- `errors.test.ts` — all error types extend NoydbError, correct codes

**Conformance tests:**
- `packages/adapter-memory/__tests__/conformance.test.ts`
- `packages/adapter-file/__tests__/conformance.test.ts` (uses temp dirs, cleaned up after)

**Simulation:**
- `test-harnesses/simulation-filesystem/` — read-only dir handling, missing dirs, truncated/empty/garbage JSON files, paths with spaces, deep nesting, 10K records performance, two adapters on same dir (concurrent _v check)

### Implementation Order (within Phase 1)

1. `types.ts` + `errors.ts` — interfaces and error classes
2. `crypto.ts` — implement + test in isolation
3. `adapter-memory` — implement + conformance tests
4. `events.ts` — typed emitter
5. `keyring.ts` — owner-only stub
6. `collection.ts` — CRUD with encryption
7. `compartment.ts` — manages collections, dump/load
8. `noydb.ts` + `env-check.ts` + `index.ts` — factory + env check
9. `adapter-file` — implement + conformance tests + filesystem simulation
10. Integration test: create → put → get → dump → load → verify

### Acceptance Criteria

- [ ] All adapter conformance tests pass for memory and file
- [ ] All crypto round-trip tests pass
- [ ] Full lifecycle works: `createNoydb` → `compartment` → `collection` → CRUD → dump → load
- [ ] `encrypt: false` dev mode works
- [ ] Env check throws on Node <18
- [ ] `pnpm turbo build` produces ESM + CJS + .d.ts for all 3 packages
- [ ] `pnpm pack --dry-run` shows zero test files in any package
- [ ] All filesystem simulation tests pass

---

## Phase 2 — Multi-User Access Control

### Changes

**`packages/core/src/keyring.ts`** — full implementation:
- `grant()`, `revoke()`, `rotateKeys()`, `changeSecret()`, `listUsers()`

**`packages/core/src/collection.ts`** — permission checks on every operation (rw vs ro)

**`packages/core/src/noydb.ts`** — expose grant/revoke/changeSecret at top level

### Phase 2 Tests

**Unit tests:**
- `keyring.test.ts` — grant creates keyring, wraps DEKs correctly; revoke deletes keyring; rotateKeys re-encrypts + re-wraps; changeSecret re-wraps with new KEK
- `access-control.test.ts` — full role/operation permission matrix (~20 test cases covering all 5 roles × operations)

**Simulation** (`test-harnesses/simulation-multiuser/`):
- Owner grants operator → operator reads/writes permitted, denied unpermitted
- Owner grants viewer → viewer reads, can't write
- Admin grants operator, cannot grant owner
- Revoke removes access (after re-open)
- Revoke with `rotateKeys: true` → old keyring copy useless
- Three users simultaneously on same compartment
- `changeSecret` → old passphrase fails, new works

### Acceptance Criteria

- [ ] Full permission matrix: every role/operation combination correct
- [ ] Key rotation after revoke renders old keyrings useless
- [ ] Multi-user simulation passes with 3 concurrent users

---

## Phase 3 — Sync Engine + DynamoDB Adapter

### Changes

**`packages/core/src/sync.ts`** — full SyncEngine:
- Dirty tracking (persistent at `_sync/dirty.json`)
- `push()`, `pull()`, `sync()` (pull-then-push), `syncStatus()`
- `resolveConflict()`, conflict strategies: `local-wins`, `remote-wins`, `version`, custom function

**`packages/core/src/events.ts`** — add sync events: `sync:push`, `sync:pull`, `sync:conflict`, `sync:online`, `sync:offline`

**`packages/adapter-dynamo/`** — `dynamo({ table, region?, endpoint? })` factory
- peerDep: `@aws-sdk/lib-dynamodb`
- Single-table: pk = compartment, sk = `{collection}#{id}`
- Optimistic concurrency via `ConditionExpression`

### Phase 3 Tests

**Unit tests:**
- `sync.test.ts` — dirty log append/persist/clear, conflict detection on version mismatch

**Conformance:**
- `packages/adapter-dynamo/__tests__/conformance.test.ts` — against DynamoDB Local (Docker)

**Simulations:**
- `test-harnesses/simulation-sync/` — Two NOYDB instances sharing a remote adapter:
  - A writes → pushes → B pulls → sees record
  - A and B write different records → both push+pull → both see all
  - A and B edit same record → conflict detected → strategies work
  - Dirty log survives restart
  - Delete syncs correctly
  - Interleaved puts and deletes
  - Empty remote (first push populates) / empty local (first pull hydrates)

- `test-harnesses/simulation-offline-online/` — Network toggle adapter wrapper:
  - Offline writes accumulate in dirty log
  - Going online triggers auto-push
  - Extended offline → online: all dirty records sync
  - Online → offline → online: no data loss
  - Push during intermittent connectivity (partial success)

**CI addition:**
- DynamoDB Local via Docker service container in `ci.yml`
- DynamoDB tests filtered by Vitest project so they only run when Docker available

### Acceptance Criteria

- [ ] Dirty log persists across restarts
- [ ] All conflict strategies work
- [ ] DynamoDB adapter passes full conformance suite
- [ ] Two-instance sync simulation passes
- [ ] Offline→online transitions work without data loss

---

## Phase 4 — Browser Adapter + WebAuthn + Vue Composables

### New Packages

**`packages/adapter-browser/`** — `browser()` factory
- localStorage for <5MB, IndexedDB via thin wrapper for larger
- Key scheme: `noydb:{compartment}:{collection}:{id}`

**`packages/vue/`** — Vue/Nuxt integration (peerDep: `vue`)
- `plugin.ts` — Vue/Nuxt plugin providing Noydb instance
- `useNoydb.ts` — composable returning injected instance
- `useCollection.ts` — reactive collection data (auto-refetch on change events)
- `useSync.ts` — reactive sync status + push/pull methods

### Core Updates

- `biometric.ts` — WebAuthn enrollment/unlock (wraps KEK with credential-derived key)
- `sync.ts` — auto-sync: `online`/`offline` event listeners, optional periodic interval

### Phase 4 Tests

- Browser adapter conformance in jsdom/happy-dom environment
- Biometric tests with mocked WebAuthn API
- Vue composable tests with `vue-test-utils`

---

## Phase 5 — S3 Adapter + Polish + Publish

### New Package

**`packages/adapter-s3/`** — `s3({ bucket, prefix?, region? })` factory
- peerDep: `@aws-sdk/client-s3`
- Optimistic concurrency via ETags

### Core Additions

- Passphrase strength validation (minimum entropy check)
- Session timeout: clear KEK/DEKs after configurable duration
- `db.close()` — explicit key clearing

### Documentation

| Doc | Phase added |
|-----|-------------|
| `README.md` full (badges, install profiles, quick start, API) | Phase 5 (finalized) |
| `docs/getting-started.md` | Phase 5 |
| `docs/api-reference.md` (typedoc-generated) | Phase 5 |
| `docs/security-model.md` | Phase 5 |
| `docs/adapters.md` | Phase 3 (started), Phase 5 (complete) |
| `docs/sync.md` | Phase 3 |
| `docs/multi-user.md` | Phase 2 |
| JSDoc on all public API | Incremental, every phase |
| `CONTRIBUTING.md` | Phase 0 |

### Final Quality Gates

- [ ] All 5 adapters pass conformance suite
- [ ] All 6 simulation harnesses pass
- [ ] Benchmarks recorded as baseline
- [ ] 90%+ code coverage on core
- [ ] `pnpm pack --dry-run` clean for every package
- [ ] Typedoc generation succeeds
- [ ] First npm publish: `@noydb/core@0.1.0` + all adapter packages

---

## Dependency Budget

| Package | Runtime deps | Peer deps |
|---------|:------------:|:---------:|
| @noydb/core | **0** | — |
| @noydb/memory | **0** | @noydb/core |
| @noydb/file | **0** (uses `node:fs/promises`) | @noydb/core |
| @noydb/dynamo | **0** | @noydb/core, @aws-sdk/lib-dynamodb |
| @noydb/s3 | **0** | @noydb/core, @aws-sdk/client-s3 |
| @noydb/browser | **0** | @noydb/core |
| @noydb/vue | **0** | @noydb/core, vue |

Zero runtime dependencies across all packages. AWS SDKs and Vue are peer deps.

---

## Verification Plan

After each phase, run:

```bash
pnpm turbo lint                    # zero warnings
pnpm turbo typecheck               # zero errors
pnpm turbo test                    # all tests pass
pnpm turbo build                   # ESM + CJS + .d.ts generated

# Verify lean production packages:
for pkg in packages/*/; do
  cd "$pkg" && pnpm pack --dry-run 2>&1 | grep -E '\.(test|spec)\.' && echo "FAIL: test files in $pkg" && exit 1
  cd -
done
```

For DynamoDB tests (Phase 3+): `docker run -d -p 8000:8000 amazon/dynamodb-local` then `pnpm vitest run --project adapter-dynamo`
