# Session handover

> **Purpose:** context for the next Claude Code session. Read this first —
> it will save you 10 minutes of re-discovery.
>
> **Updated:** 2026-04-09 after v0.7.0 release.

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

## Current state: v0.7.0 shipped, v0.8 is next

```
main  dfb0636  docs: v0.7.0 post-release handover update
```

Working tree clean. All 12 `@noy-db/*` packages at **0.7.0** on npm.
GitHub release: https://github.com/vLannaAi/noy-db/releases/tag/v0.7.0

**688 tests passing** — 649 core + 18 auth-webauthn + 21 auth-oidc.

---

## What v0.7 added (already shipped — do not re-implement)

| Issue | Module | What it does |
|-------|--------|--------------|
| #109 | `core/session.ts` | Session tokens — unlock once, serialise a `SessionToken`, restore without re-entering passphrase |
| #110 | `core/sync-credentials.ts` | `_sync_credentials` reserved collection — encrypted per-adapter OAuth tokens, owner/admin only |
| #111 | `packages/auth-webauthn` | WebAuthn + PRF hardware-key keyrings (YubiKey, Touch ID, Passkey) |
| #112 | `packages/auth-oidc` | OIDC bridge with Bitwarden-style split-key connector |
| #113 | `core/magic-link.ts` | One-shot viewer sessions via HKDF-derived KEK |
| #114 | `core/session-policy.ts` | Idle/absolute timeouts, `requireReAuthFor`, `lockOnBackground` |
| #119 | `core/dev-unlock.ts` | Dev-mode sessionStorage/localStorage keyring cache with guardrails |

New packages also export `bufferToBase64`, `base64ToBuffer`, and
`UnlockedKeyring` from `@noy-db/core` — these are now public barrel exports.

---

## Next milestone: v0.8.0 — i18n & dictionaries

**5 open issues** in milestone v0.8.0:

| # | Title |
|---|-------|
| #81 | `dictKey` schema type + `_dict_*` reserved collection + dictionary admin ops |
| #82 | `i18nText` schema type — multi-language content fields with locale fallback |
| #83 | `plaintextTranslator` hook — consumer-supplied translation integration point |
| #84 | `exportStream()` bundles dictionary snapshot for self-consistent i18n exports |
| #85 | Query DSL integration for `dictKey` — type-enforced `groupBy` + locale-aware `join` |

**Design is in `ROADMAP.md §v0.8`** — read it before writing any code. Key decisions:
- Two distinct primitives: `dictKey('name')` (bounded enums) vs `i18nText({...})` (per-record prose)
- Dictionaries stored as reserved encrypted collection `_dict_<name>/` — same DEK as the compartment
- `groupBy(dictKey)` must group by stable key, not resolved label (type-enforced)
- `plaintextTranslator` is an integration point only — NOYDB ships no built-in translator
- Out of scope: pluralization, date/number formatting, RTL rendering, codegen

**Start here:** read `ROADMAP.md §v0.8`, then read the 5 open issues on GitHub
(`gh issue view 81 --repo vLannaAi/noy-db` etc.) before writing any code.

---

## Release-time invariants (hard-won — do not skip)

### 1. Always use `pnpm release:version`
Never run `pnpm changeset version` directly. The custom script in
`scripts/release.mjs` normalises all `@noy-db/*` packages to core's
canonical version, preventing changeset's pre-1.0 heuristic from
computing stray `1.0.0` bumps. This has burned us twice.

### 2. Peer deps must be `workspace:*` not `workspace:^`
All adapter and auth packages use `"@noy-db/core": "workspace:*"` in
`peerDependencies`. `workspace:^` triggers the changeset major-bump
heuristic. Do not revert.

### 3. New packages need lockfile updates before CI
When a new workspace package is added, run `pnpm install` locally,
commit the updated lockfile, and push it on the feature branch.
CI runs `--frozen-lockfile` and fails immediately without it.

### 4. Auth branches must rebase onto core branch, not main
When new core barrel exports are added in the same release (e.g. v0.7
added `bufferToBase64`/`base64ToBuffer`/`UnlockedKeyring`), auth package
branches must be rebased onto the core feature branch — not main — so
those exports are visible during CI. Rebase onto main only after the
core PR merges.

### 5. happy-dom WebCrypto is occasionally flaky in CI
The `auth-oidc` round-trip DEK test intermittently fails with
`Cipher job failed` (an AES-GCM OperationError from happy-dom's
WebCrypto mock). It passes locally every time and re-running the CI
job resolves it. Not worth fixing — just re-run the failed job.

### 6. PR merge order matters
Merge core PR first. After it lands on main, rebase auth PRs onto
updated main before merging them. `gh pr merge --merge --delete-branch`
is safe; never force-push main.

---

## Build commands

```bash
pnpm install                      # install all workspace deps
pnpm turbo build                  # build all packages
pnpm turbo test                   # run all tests
pnpm turbo lint                   # lint all packages (ESLint)
pnpm turbo typecheck              # typecheck all packages
pnpm vitest run packages/core     # run core tests only
pnpm vitest run -t "session"      # run tests matching pattern

# Release (when ready)
pnpm release:version              # bump all packages to core's version
grep -r '1\.0\.0' packages/*/package.json  # sanity check for stray 1.0.0
git add . && git commit -m "chore: release vX.Y.Z"
git push origin main
# wait for CI green
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin vX.Y.Z
pnpm turbo build                  # build before publish
pnpm changeset publish            # publish to npm
```

---

## Key files to read before starting v0.8

| File | Why |
|------|-----|
| `ROADMAP.md §v0.8` | Full feature design with examples and out-of-scope list |
| `SPEC.md §Package Structure` | Where new files go |
| `SPEC.md §Error Types` | Pattern for new error classes |
| `packages/core/src/sync-credentials.ts` | Pattern for reserved collections (v0.7 precedent) |
| `packages/core/src/index.ts` | Barrel exports — add new v0.8 exports here |
| `packages/core/src/types.ts` | Add new TypeScript interfaces here |
| `packages/core/src/errors.ts` | Add new error classes here |
| `docs/v0.7/merge-runbook.md` | Release process reference (adapt for v0.8) |

---

## ESLint rules that have bitten us

These rules cause CI failures if you miss them. Watch for them in new files:

| Rule | What it requires |
|------|-----------------|
| `@typescript-eslint/consistent-type-imports` | No inline `import('pkg').Type` — always a top-level `import type` |
| `@typescript-eslint/no-unnecessary-type-assertion` | Don't assert `!` if TypeScript can already narrow; check directly in ternary instead |
| `@typescript-eslint/no-unused-vars` | Remove every assigned-but-never-used variable |
| `ban-ts-comment` → `@ts-ignore` | Use `@ts-expect-error` — and only when there IS an actual error to suppress. If the cast already resolves the type, the directive is unused and tsc will fail with TS2578 |
| `exactOptionalPropertyTypes` | `readonly field?: Type` must be `readonly field: Type \| undefined` when assigning from an optional parameter |
