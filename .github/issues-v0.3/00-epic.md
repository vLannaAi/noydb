# v0.3 — Pinia-first DX + query & scale (tracking epic)

**Milestone:** `v0.3.0`
**Branch:** `v0.3-dev`

## Goal

> Zero to working encrypted Pinia store in under two minutes. A Vue/Nuxt/Pinia developer either runs `npm create noy-db` (greenfield) or installs `@noy-db/nuxt` (existing project), and gets a fully wired reactive encrypted store without writing boilerplate. Opt into advanced features (query DSL, indexes, sync) incrementally.

## Sub-issues

Adoption surface (items 1–5):

- [ ] #1 — `create-noy-db` guided scaffolder
- [ ] #2 — `@noy-db/nuxt` Nuxt 4 module (auto-imports, SSR safety, devtools tab)
- [ ] #3 — `nuxi noydb <cmd>` extension (add / rotate / verify / seed / backup)
- [ ] #4 — `@noy-db/pinia` `defineNoydbStore` greenfield path
- [ ] #5 — `@noy-db/pinia` augmentation plugin (`noydb:` option for existing stores)

Power surface (items 6–9):

- [ ] #6 — Reactive query DSL in `@noy-db/core`
- [ ] #7 — Encrypted secondary indexes in `@noy-db/core`
- [ ] #8 — Paginated `listPage()` + streaming `scan()` in `@noy-db/core` + adapters
- [ ] #9 — Lazy collection hydration + LRU eviction in `@noy-db/core`

Wrap-up:

- [ ] #10 — Reference Nuxt 4 accounting demo in `playground/nuxt/`
- [ ] #11 — Docs updates (architecture, getting-started, end-user-features, deployment-profiles)
- [ ] #12 — Changeset, release prep, npm publish, tag `v0.3.0`

## How to contribute

1. Claim an issue by commenting on it.
2. Branch from `v0.3-dev` (e.g. `git checkout -b feat/v0.3/define-noydb-store v0.3-dev`).
3. Open a PR back to `v0.3-dev` with a changeset entry.
4. Squash merge once CI is green and at least one reviewer approves.

## Definition of done (22 testable criteria)

**Scaffolder:**
- [ ] `npm create noy-db@latest` works on Node 20+ across macOS, Linux, Windows
- [ ] All four package managers (npm, pnpm, yarn, bun) detected and used for install
- [ ] Generated Nuxt 4 starter passes `dev` + `build` + `typecheck` cleanly
- [ ] End-to-end install + verify under 60 seconds on a warm npm cache
- [ ] Privacy guard pre-commit hook installed only on opt-in
- [ ] Passphrases never written to disk; AWS credentials never requested
- [ ] Wizard re-runnable inside an existing project to add collections
- [ ] Prompts available in English and Thai
- [ ] CI matrix exercises a representative subset of (framework × adapter × sync × auth) combinations

**Nuxt module:**
- [ ] One-line install: `pnpm add @noy-db/nuxt` + `modules: ['@noy-db/nuxt']` produces a working encrypted store with no other code
- [ ] All composables auto-imported without manual `import` statements
- [ ] Server bundle contains zero references to `crypto.subtle`, `decrypt`, or DEK/KEK symbols (CI-verified)
- [ ] Devtools tab shows live compartment state in dev and is absent in production
- [ ] `nuxi noydb <command>` namespace registered when the module is installed
- [ ] Type-checks against `nuxt.config.ts` with autocomplete on every option
- [ ] Reference Nuxt 4 accounting demo in `playground/nuxt/` works with one config block

**Pinia integration:**
- [ ] `defineNoydbStore` works as a drop-in for `defineStore` in a clean Vue 3 + Pinia project
- [ ] Existing Pinia stores opt in via the `noydb:` option without component changes
- [ ] Devtools, `storeToRefs`, SSR, and `pinia-plugin-persistedstate` all keep working

**Power features:**
- [ ] Query DSL passes a parity test against `Array.filter` for 50 random predicates
- [ ] Indexed queries are measurably faster than linear scans on a 10K-record benchmark
- [ ] Streaming `scan()` handles a 100K-record collection in under 200MB peak memory
- [ ] Reference Vue/Nuxt accounting demo in `playground/` uses **only** the Pinia API — no direct `Compartment`/`Collection` calls

## Cross-cutting requirements

- Bundle budgets enforced in CI: `@noy-db/core` <30 KB gzipped, each adapter <10 KB.
- Every new package ships with `__tests__/`, ≥90% statement coverage, and at least one end-to-end integration test against `@noy-db/memory`. The packages `dynamo`, `s3`, and `vue` (currently zero tests, `--passWithNoTests`) must NOT grow that list — new packages start with real coverage from day one.
- All work respects the *Guiding principles* in `ROADMAP.md` and the invariants in `NOYDB_SPEC.md`.

## Labels

`release: v0.3`, `epic`, `type: tracking`
