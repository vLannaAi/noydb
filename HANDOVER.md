# Session handover

> **Purpose:** pass context from one Claude Code session to the next
> without needing to re-discover the project state from scratch. Read
> this first if you're picking up work on noy-db with no prior
> session memory.
>
> **Updated:** 2026-04-09, right after v0.6.0 shipped.

## What this project is

NOYDB ("None Of Your Damn Business") is a zero-knowledge, offline-
first, encrypted document store with pluggable backends and
multi-user access control. TypeScript monorepo targeting Node 18+
and modern browsers. See `SPEC.md` for the full design reference and
`docs/architecture.md` for the reader-facing architecture doc.

**First consumer:** an established regional accounting-firm platform.
Per the auto-memory client-privacy constraint, **never name the
client** — use generic terms like "accounting firm" or "first
consumer" in commits, docs, and comments. Grep for the client's
actual name before any commit or publish that touches user-facing
copy.

## Where things stand right now

### v0.6.0 shipped to npm on 2026-04-09

All 10 `@noy-db/*` packages are live on npm at `0.6.0`. The release
closed the v0.6 milestone (8 feature issues + 1 meta-issue #87) and
added:

- **Joins:** `.query().join()` (eager, #73), multi-FK chaining (#75),
  `Query.live()` with merged change streams (#74), streaming
  `.scan().join()` (#76)
- **Aggregations v1:** reducers + `.aggregate()` + `.live()` (#97),
  `.groupBy()` with cardinality caps (#98), `scan().aggregate()`
  memory-bounded streaming (#99)
- **`.noydb` container format:** minimum-disclosure binary wrapper
  around `compartment.dump()` with ULID handles and brotli/gzip
  compression (#100)

558/558 core tests passing. Zero new dependencies. See:
- `docs/v0.6/release-notes-draft.md` — full changelog
- `docs/v0.6/merge-runbook.md` — the runbook that was executed
- `docs/v0.6/retrospective.md` — **READ THIS BEFORE THE NEXT RELEASE**

### Main branch state

```
main  4b39f86  chore: release v0.6.0
```

Clean working tree. Local `feat/v0.6/*` branches are all deleted.
No worktrees. No in-flight PRs. Milestone v0.6.0 is closed.

### Published npm versions

```
@noy-db/core@0.6.0
@noy-db/memory@0.6.0
@noy-db/file@0.6.0
@noy-db/dynamo@0.6.0
@noy-db/s3@0.6.0
@noy-db/browser@0.6.0
@noy-db/vue@0.6.0
@noy-db/nuxt@0.6.0
@noy-db/pinia@0.6.0
@noy-db/create@0.6.0
```

Verified via `npm view @noy-db/<pkg> version`.

### GitHub release

https://github.com/vLannaAi/noy-db/releases/tag/v0.6.0

## What's next — v0.7 — Identity & sessions

Per ROADMAP.md, the next release focus is **identity & sessions**
(the original v0.5 epic that slipped to make room for core enhancements
and the query DSL). The v0.7 milestone on GitHub is
https://github.com/vLannaAi/noy-db/milestone/5 — 7 open issues, 1
closed.

Theme: solve "passphrase unlock is awkward for client portals" via:
- **Session tokens** (#109) — unlock once with passphrase or
  biometric, get a JWE valid for N minutes. KEK wrapped with a
  session-scoped non-extractable WebCrypto key. Closing the tab
  destroys the session.
- **`@noy-db/auth-oidc`** (#112) — OAuth/OIDC bridge with
  split-key connector (Bitwarden-style)
- **`@noy-db/auth-webauthn`** (#111) — hardware-key keyrings
  (WebAuthn + PRF + BE-flag guards)
- **Magic-link unlock** (#113) — one-shot read-only viewer session
  for client portals
- **Session policies** (#114) — idle/absolute timeouts, requireReAuthFor,
  lockOnBackground, role overrides
- **`_sync_credentials`** reserved collection (#110) — encrypted
  per-adapter OAuth token store

## ⚠️ Release-time fixes that MUST happen before the next publish

These are in the retrospective already but they're important enough to
surface here. **Do not run `pnpm changeset publish` for v0.7 without
addressing these first.**

### 1. Update the runbook — pre-rebase stacked PRs

The v0.6 runbook had a step-by-step merge sequence that assumed
`gh pr edit --base main` could run *after* the previous branch was
deleted. It cannot — GitHub auto-closes downstream stacked PRs the
moment their base branch disappears. One PR (#116) auto-closed
mid-sequence and was unrecoverable via the PR machinery (its commit
rode along with #120's merge, saving the day).

**Fix for v0.7:** add a pre-rebase loop at the top of the merge
sequence that rebases every downstream stacked PR to `main` **before**
starting the merges. See `docs/v0.6/retrospective.md` §"Surprise #1"
for the exact commands.

### 2. Fix the changeset version computation OR add a wrapper script

`pnpm changeset version` in the v0.6 release computed `major` bumps
for adapter packages (`0.5.0 → 1.0.0`), not `minor` (`0.5.0 → 0.6.0`),
because of a changeset CLI heuristic that major-bumps dependents
whenever a peer dep changes, regardless of constraint looseness. In
pre-1.0 semver this is catastrophic — `v1.0` is reserved for the LTS
release per ROADMAP.

**Mitigation shipped in v0.6:** all 8 adapter peer deps were converted
from `"workspace:^"` to `"workspace:*"`. This doesn't fix the
heuristic (I tested) but it does make published constraints permissive.

**Still needed for v0.7:**
- Option A (quick): copy the manual-override recipe from
  `docs/v0.6/retrospective.md` §"Surprise #2" into the v0.7 runbook
- Option B (permanent): write `scripts/release.mjs` that runs
  `pnpm changeset version` and then normalizes all `@noy-db/*`
  versions to match `@noy-db/core`. A sketch is in the retrospective.
  Wire it as `pnpm release:version` in the root `package.json`.

**Option B is strongly preferred** — the manual override is a 5-minute
tedious edit loop, and it will bite every future release until
automated away.

### 3. Write `docs/v0.7/merge-runbook.md`

Copy `docs/v0.6/merge-runbook.md` as a starting point but apply these
corrections from the retrospective:

1. Pre-rebase loop at the top of Stack 1
2. Pre-merge mergeability check for independent PRs
3. Use `pnpm release:version` (or the manual override) instead of raw
   `pnpm changeset version`
4. Sanity-check grep for stray `1.0.0` versions after the version step
5. `gh run watch --exit-status` for all CI waits instead of background
   bash `sleep`
6. `npm view` verification loop after publish

## Key invariants that cross sessions

These are enforced by code review and documented in `SPEC.md`, but
worth reinforcing here because they've caused regressions in the past:

- **Zero crypto dependencies.** All cryptography is Web Crypto API
  (`crypto.subtle`). Never add npm crypto packages. Never add `ulid`
  or similar — the v0.6 ULID generator is hand-rolled in
  `packages/core/src/bundle/ulid.ts` (~30 lines, zero deps).
- **KEK never persisted.** In-memory only. `_keyring` stores
  WRAPPED DEKs (via AES-KW), not the KEK itself.
- **Adapters only see ciphertext.** Encryption happens in core before
  data reaches any adapter. The only exception is the `_keyring` and
  `_meta` collections which use the same envelope shape but bypass
  AES-GCM (see `Compartment.getBundleHandle()` for how `_meta/handle`
  uses this pattern).
- **Partition-awareness seams (#87).** Every `JoinLeg` carries
  `partitionScope: 'all'` and every reducer factory accepts a
  `{ seed }` parameter. These are plumbed but dormant in v0.6 —
  they're load-bearing for v0.10 partition-aware execution. **Do not
  remove either** or the v0.10 work will silently break. Tests in
  `query-aggregate.test.ts` and `query-join.test.ts` pin the no-op
  behavior.
- **Peer-dep convention.** Adapter packages use
  `"@noy-db/core": "workspace:*"` in `peerDependencies` (not
  `"workspace:^"`). The monorepo ships in lockstep so the looser
  constraint is safe; it also prevents the changeset pre-1.0
  major-bump heuristic from biting every release.

## Project layout (high level)

```
noy-db/
├── SPEC.md                              # Source of truth — read first
├── ROADMAP.md                           # Version timeline + milestones
├── CLAUDE.md                            # Session-level project guidance
├── HANDOVER.md                          # This file
├── CHANGELOG.md                         # Per-package changelogs live under packages/*/
├── docs/
│   ├── architecture.md                  # Reader-facing architecture
│   ├── adapters.md                      # Built-in + custom adapters
│   ├── getting-started.md               # Quick start
│   ├── deployment-profiles.md           # Pick your stack
│   ├── end-user-features.md             # Consumer-facing feature list
│   ├── noydb-for-ai.md                  # AI assistant reference
│   └── v0.6/
│       ├── release-notes-draft.md       # v0.6 full changelog
│       ├── merge-runbook.md             # Merge sequence (needs v0.7 corrections)
│       └── retrospective.md             # v0.6 release lessons
├── packages/
│   ├── core/                            # @noy-db/core
│   │   ├── src/
│   │   │   ├── bundle/                  # v0.6 #100 container format
│   │   │   │   ├── bundle.ts            # write/read primitives
│   │   │   │   ├── format.ts            # byte layout + header validator
│   │   │   │   └── ulid.ts              # hand-rolled ULID generator
│   │   │   ├── query/
│   │   │   │   ├── builder.ts           # Query<T> class (joins, aggregate, groupBy)
│   │   │   │   ├── join.ts              # v0.6 #73 eager join planner
│   │   │   │   ├── live.ts              # v0.6 #74 LiveQuery primitive
│   │   │   │   ├── reducers.ts          # v0.6 #97 count/sum/avg/min/max
│   │   │   │   ├── aggregate.ts         # v0.6 #97 Aggregation + LiveAggregation
│   │   │   │   ├── groupby.ts           # v0.6 #98 GroupedQuery
│   │   │   │   ├── scan-builder.ts      # v0.6 #99+#76 ScanBuilder (streaming)
│   │   │   │   ├── predicate.ts         # Operator evaluation + readPath
│   │   │   │   └── indexes.ts           # Secondary index store
│   │   │   ├── compartment.ts           # Compartment class + getBundleHandle()
│   │   │   ├── collection.ts            # Collection<T> + scan() + query()
│   │   │   ├── noydb.ts                 # createNoydb + queryAcross
│   │   │   ├── crypto.ts                # Web Crypto wrappers
│   │   │   ├── keyring.ts               # Wrap/unwrap DEKs
│   │   │   ├── ledger/                  # Hash-chained audit ledger (v0.4)
│   │   │   ├── sync.ts                  # Dirty tracking, push/pull
│   │   │   ├── errors.ts                # NoydbError + subtypes
│   │   │   ├── refs.ts                  # ref() declarations
│   │   │   ├── schema.ts                # Standard Schema v1
│   │   │   ├── biometric.ts             # WebAuthn integration
│   │   │   ├── cache/                   # LRU for lazy hydration
│   │   │   └── index.ts                 # Public barrel
│   │   └── __tests__/                   # 558/558 tests
│   ├── memory/                          # @noy-db/memory (testing)
│   ├── file/                            # @noy-db/file + bundle helpers
│   ├── dynamo/                          # @noy-db/dynamo
│   ├── s3/                              # @noy-db/s3
│   ├── browser/                         # @noy-db/browser
│   ├── vue/                             # @noy-db/vue
│   ├── pinia/                           # @noy-db/pinia
│   ├── nuxt/                            # @noy-db/nuxt
│   ├── create-noy-db/                   # @noy-db/create scaffolder
│   ├── test-adapter-conformance/        # Shared conformance test suite
│   └── typescript-config/               # Shared tsconfig
├── playground/                          # Private example apps
├── .changeset/                          # Config only; active changesets are empty
└── turbo.json                           # Turbo task config
```

## Commands the next session will need

```bash
# Daily development
pnpm install                             # install all workspace deps
pnpm turbo test --filter=@noy-db/core    # run core tests
pnpm turbo lint typecheck build          # full check
pnpm -F @noy-db/core test -t "aggregate" # run tests matching a pattern

# Working on features
git checkout -b feat/v0.7/<issue-number>-<slug>
pnpm changeset                           # create a changeset for your PR
# (edit the changeset to mark '@noy-db/core': minor)

# Verify nothing regressed
pnpm turbo test lint typecheck build --filter=@noy-db/core --force

# Releasing (see docs/v0.6/retrospective.md for the gotchas)
pnpm changeset version                   # generate CHANGELOGs
# ⚠️  VERIFY all @noy-db/* versions before committing
pnpm changeset publish
```

## Useful links

- **Repo:** https://github.com/vLannaAi/noy-db
- **npm org:** https://www.npmjs.com/org/noy-db
- **v0.6 milestone (closed):** https://github.com/vLannaAi/noy-db/milestone/4
- **v0.7 milestone (next):** https://github.com/vLannaAi/noy-db/milestone/5
- **v0.6 release:** https://github.com/vLannaAi/noy-db/releases/tag/v0.6.0

## Auto-memory references

The shared Claude auto-memory at
`~/.claude/projects/-Users-vicio--github-noy-db/memory/` has entries
worth re-reading at the start of any session:

- `user_profile.md` — vLannaAi/vlanna, building platform for a
  private accounting-firm client, visual-first, fast iteration style
- `feedback_security.md` — user has shared credentials before; always
  warn and refuse to use
- `feedback_client_privacy.md` — never reference the accounting-firm
  client by name; use generic terms; grep before commit/publish
- `project_status.md` — needs an update to reflect v0.6.0 shipped (do
  this at the start of the next session if it still says v0.5.0)

## One-line summary

**v0.6.0 is shipped and clean. v0.7 is next and is identity-focused.
Read `docs/v0.6/retrospective.md` before any release work.**

---

*Generated 2026-04-09 at the end of the v0.6.0 release session.
Author: Claude Opus 4.6 (1M context) paired with vLannaAi.*
