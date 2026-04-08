# @noy-db/create

## 0.5.0

### Minor Changes — Scaffolder polish

The v0.5 release ships three substantive improvements to the wizard and the `noy-db` CLI. All of these landed incrementally through the v0.5 cycle as feature PRs against the dev branches; this is the unified release note.

- **Wizard now speaks Thai** (#36). The `@noy-db/create` wizard's prompts, notes, and confirmations are translated to Thai. Pick a language explicitly with `npm create @noy-db my-app --lang th`, or let the wizard auto-detect from the standard POSIX locale env vars (`LC_ALL`, `LC_MESSAGES`, `LANG`, `LANGUAGE`) — a developer who already has `LANG=th_TH.UTF-8` in their shell rc gets Thai automatically with no flag. **What's translated:** every prompt and note the user sees in the interactive flow (project name, adapter selection with localized labels, sample-data confirm, augment-mode notes and diff confirm, dry-run/done outros). **What's NOT translated (on purpose):** validation errors and stack traces stay in English regardless of locale so bug reports filed by Thai-speaking users look the same as bug reports filed by English-speaking users — a maintainer who only speaks one of the two can still triage either. Generated project source code stays in English. Technical identifiers (modules, `noydb:`, framework names, adapter names `browser`/`file`/`memory`) stay English in the Thai labels too, matching how Thai developers actually write code. **Architecture:** new `src/wizard/i18n/` module with `types.ts` (the `WizardMessages` interface, 26 keys), `en.ts`, `th.ts`, and `index.ts` (POSIX env-var detection + sync bundle loader so tsup can tree-shake unused locales). **Public API:** `detectLocale`, `loadMessages`, `parseLocaleFlag`, `SUPPORTED_LOCALES`, types `Locale` and `WizardMessages` re-exported from the package root. New `WizardOptions.locale` for tests and downstream tooling that want to pin a locale instead of touching `process.env`. **Adding a third language** is now ~30 lines: write the `<locale>.ts` bundle, register it in `BUNDLES`, add it to `SUPPORTED_LOCALES`. The key-parity test catches any drift in CI.

- **Wizard augment mode for existing Nuxt 4 projects** (#37). Run `npm create @noy-db` from inside an existing Nuxt 4 project root, and the wizard patches `nuxt.config.ts` in place instead of only creating new projects. Auto-detects by looking for **both** `nuxt.config.{ts,js,mjs}` and a `package.json` that lists `nuxt` in any dependency section. When both are present it enters augment mode; otherwise it falls back to the classic fresh-project path. **What augment mode does** (via [magicast](https://github.com/unjs/magicast) AST rewriting): adds `'@noy-db/nuxt'` to the `modules` array (creating the array if missing), adds `noydb: { adapter, pinia: true, devtools: true }` (only if not already present), preserves unrelated config keys / comments / formatting, shows a colored unified diff before any write, asks for confirmation (`y/n`) unless `--yes` is passed, and prints the install command for the `@noy-db/*` packages the config now depends on. **Safe behaviors:** idempotent (re-running on an already-augmented project is a no-op), preserves custom config (a pre-existing `noydb:` key is left untouched — only adds the module to `modules`), `--dry-run` prints the diff without writing, unsupported shapes (opaque exports, non-array `modules`, malformed configs) bail with a clear error. New `--force-fresh` escape hatch forces the classic fresh-project path even when cwd looks like an existing Nuxt project. **New options** on `runWizard()`: `dryRun`, `forceFresh`. **New exports:** `detectNuxtProject`, `augmentNuxtConfig`, `writeAugmentedConfig`. **Dependencies added:** `magicast@^0.3.5`, `diff@^7.0.0`.

- **CLI subcommands: `rotate`, `add user`, `backup`** (#38). Three new `noy-db` bin subcommands for routine key-management and backup tasks. **`noy-db rotate`** rotates DEKs for one or more collections in a compartment — generates fresh keys, re-encrypts every record, and re-wraps the new keys into every user's keyring. Unlike `revoke({ rotateKeys: true })`, nobody is removed — everyone keeps their current permissions with fresh key material. **`noy-db add user <id> <role>`** grants a new user access to a compartment, prompting for the caller's passphrase and then the new user's passphrase (confirmed). `operator` and `client` roles require an explicit `--collections invoices:rw,clients:ro` flag. **`noy-db backup <target>`** dumps a compartment to a local file via the v0.4 verifiable-backup format — target accepts `file://` URIs or plain paths, parent directories are created on demand. All three subcommands use the file adapter, prompt for the passphrase via `@clack/prompts` `password()` (never echoes, never logs), accept dependency injection for the passphrase reader / Noydb factory / adapter (so tests run synchronously without touching stdin or disk), and close the Noydb instance in a `finally` block to clear the KEK from memory on the way out.

- **Template `@noy-db/*` deps bumped to `^0.5.0`.** The `create-noy-db` scaffolder emits a `package.json` for the generated project; that template's `@noy-db/*` dependency strings have been updated to reference the 0.5 line so freshly-scaffolded projects install the current release.

### Composition with `@noy-db/core@0.5.0`

The wizard-augment changes and the CLI subcommands were already ready at v0.4.1 close; they just hadn't shipped yet. They are released here alongside the core-side features (`exportStream`/`exportJSON` #72, admin-grants-admin #62, cross-compartment queries #63) so the whole v0.5 line ships as a coherent release rather than two staggered ones.

### Stats

- 106 tests in `@noy-db/create` (+38 across the v0.5 epic: 19 for augment mode, 21 for i18n, 15 for CLI subcommands, minus overlap)

## 0.4.1

### Patch Changes

- **Peer dep fix**: changed `peerDependencies` spec from `workspace:*` to `workspace:^` so published packages accept any semver-compatible `@noy-db/*` version rather than pinning to the exact version the workspace was built against. Without this fix, installing `@noy-db/core@0.4.0` alongside `@noy-db/memory@0.3.0` produced an `ERESOLVE` error because memory's peer dep was published as the literal `"0.3.0"` string.

- **Version line unified**: every `@noy-db/*` package is now on the **0.4.1** line. Previously the line was mixed (core/pinia on 0.4.0, adapters on 0.3.0, vue on 0.2.0, create on 0.3.2). No functional code changes — this is a manifest-only release to make v0.4 actually installable.

## 0.3.2

### Patch Changes

- **Fix `noy-db verify` broken on npm installs.** In v0.3.1, `@noy-db/core` and `@noy-db/memory` were declared as `devDependencies` instead of `dependencies`. The wizard (`create` bin) worked fine because it only writes files, but the `noy-db verify` command imports both packages at runtime and threw `ERR_MODULE_NOT_FOUND` as soon as a user installed `@noy-db/create` from npm and ran `pnpm exec noy-db verify`.

  The fix moves both to `dependencies` so they land in `node_modules/@noy-db/create/node_modules/` on install. No API changes, no code changes beyond the manifest.

  **v0.3.1 has been deprecated on npm.** Please upgrade:

  ```bash
  pnpm add -D @noy-db/create@latest
  ```

## 0.3.1

### Minor Changes

- **Initial release of `@noy-db/create`** — wizard + CLI tool for noy-db (closes #7, closes #9).

  Ships **two bins** from a single package:

  **`create`** — wizard for new projects, invoked via npm's scoped-initializer idiom:

  ```bash
  npm  create @noy-db my-app
  pnpm create @noy-db my-app
  yarn create @noy-db my-app
  bun  create @noy-db my-app
  ```

  Interactive mode asks 3 questions (project name, adapter, sample-data yes/no) and generates a fully wired Nuxt 4 + Pinia + encrypted-store starter. Non-interactive `--yes` mode skips every prompt and uses defaults.

  **`noy-db`** — ongoing CLI tool for existing projects, invoked via `pnpm exec noy-db <command>` or `npx noy-db <command>`:

  - `noy-db add <collection>` — scaffolds `app/stores/<name>.ts` and `app/pages/<name>.vue`. Refuses to overwrite existing files (atomic — either both land or neither does).
  - `noy-db verify` — end-to-end crypto round-trip check against an in-memory adapter. Exits non-zero if any step diverges. Validates that `@noy-db/core`, `@noy-db/memory`, and the local Node version all agree on Web Crypto.

  **Nuxt 4 only.** The template generates a Nuxt 4 project using `@noy-db/nuxt@^0.3.0` and `@noy-db/pinia@^0.3.0`. No Vite, no vanilla Vue, no other frameworks.

  **Why scoped?** Publishing inside the `@noy-db` scope lets us reuse the existing npm token (which has create-package rights inside the scope only). An unscoped `create-noy-db` package would have required a new wider-scoped token. See the PR discussion on #33 + the fix PR for details.

  **Scope deferred to a follow-up** (tracked in new issues):
  - Thai i18n of prompts
  - Magicast AST patching of existing `nuxt.config.ts`
  - Additional `noy-db` subcommands: `rotate`, `seed`, `backup`, `add user`
  - E2E CI matrix across macOS/Linux/Windows × Node 20/22

  The v0.3.1 release covers the 80% of the adoption story that's actually load-bearing: generating a fresh project that builds, and adding collections to an existing project from the command line.
