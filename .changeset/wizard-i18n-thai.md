---
"@noy-db/create": minor
---

Wizard now speaks Thai (closes #36).

The `@noy-db/create` wizard's prompts, notes, and confirmations are translated to Thai. Pick a language explicitly:

```bash
npm create @noy-db my-app --lang th
```

Or let the wizard auto-detect from the standard POSIX locale env vars (`LC_ALL`, `LC_MESSAGES`, `LANG`, `LANGUAGE`) — a developer who already has `LANG=th_TH.UTF-8` in their shell rc gets Thai automatically with no flag.

```bash
LANG=th_TH.UTF-8 npm create @noy-db my-app
```

### What's translated

Everything the user sees in the interactive flow: project-name prompt, adapter selection (with localized labels), sample-data confirm, augment-mode notes and diff confirm, dry-run / done outros.

### What's NOT translated (on purpose)

- **Validation errors and stack traces** — these stay English regardless of locale so that bug reports filed by Thai-speaking users look the same in an issue tracker as bug reports filed by English-speaking users. A maintainer who only speaks one of the two languages can still triage either.
- **Generated project source code** — template files (`package.json`, `nuxt.config.ts`, store, page) stay English since translating TS source would create a fork with no upside.
- **Technical identifiers** — `modules`, `noydb:`, framework names, adapter names (`browser` / `file` / `memory`) stay English in the Thai labels too. That's how Thai developers actually write code.

### Architecture

- New `packages/create-noy-db/src/wizard/i18n/` module with `types.ts` (the `WizardMessages` interface, 26 keys), `en.ts`, `th.ts`, and `index.ts` (POSIX env-var detection + bundle loader).
- Public API: `detectLocale`, `loadMessages`, `parseLocaleFlag`, `SUPPORTED_LOCALES`, types `Locale` and `WizardMessages` re-exported from the package root.
- New `--lang en|th` flag on the `create` bin.
- New `WizardOptions.locale` for tests + downstream tooling that wants to pin a locale instead of touching `process.env`.

### Tests

21 new tests in `packages/create-noy-db/__tests__/i18n.test.ts`:

- **Key parity** — every shipped locale bundle has the exact same set of keys as English (catches the case where TS would let an extra key through because the interface still satisfies).
- **Non-empty values** — every translated string is a non-empty string (catches forgotten translations that compile fine).
- **POSIX detection precedence** — `LC_ALL` > `LC_MESSAGES` > `LANG` > `LANGUAGE`, with encoding/modifier/region stripping (`th_TH.UTF-8@euro` → `th`).
- **Unsupported locales fall back to `en`** — `fr_FR`, `C`, `POSIX`, etc. never throw.
- **`--lang` parsing** — accepts `en` / `th`, case-insensitive, throws with a helpful message for unsupported values.
- **End-to-end** — `runWizard({ locale: 'th', yes: true })` produces the same project files as English mode (proves the wizard accepts the locale and generates the same template output).

Adding a third language in the future is now ~30 lines: write the `<locale>.ts` bundle, register it in `BUNDLES`, add it to `SUPPORTED_LOCALES`. The key-parity test catches any drift in CI.

Part of v0.5.0.
