---
"@noy-db/nuxt": minor
---

Initial release of `@noy-db/nuxt` — Nuxt 4 module for noy-db.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@noy-db/nuxt'],
  noydb: {
    adapter: 'browser',
    sync: { adapter: 'dynamo', table: 'noydb-prod' },
    auth: { mode: 'biometric' },
  },
})
```

**Nuxt 4+ exclusive.** No Nuxt 3 compatibility shim — Nuxt 3 users should consume `@noy-db/vue` and `@noy-db/pinia` directly with a hand-written plugin.

What ships:

- **Module factory** built on `@nuxt/kit` v4's `defineNuxtModule`. Typed `noydb:` config key with autocomplete in `nuxt.config.ts` (via TypeScript module augmentation of `@nuxt/schema`).
- **Auto-imports** for the @noy-db/vue composables (`useNoydb`, `useCollection`, `useSync`) and the @noy-db/pinia helpers (`defineNoydbStore`, `createNoydbPiniaPlugin`, `setActiveNoydb`, `getActiveNoydb`). Pinia helpers are opt-out via `pinia: false`.
- **Client-only runtime plugin** (`mode: 'client'`). Nuxt never loads it on the server, so the SSR bundle never imports any code that touches `crypto.subtle`.
- **Runtime config exposure** — the typed `noydb:` options are passed through to `useRuntimeConfig().public.noydb` for downstream composables.

What does NOT ship in v0.3 (deferred to v0.4):

- Devtools tab via `@nuxt/devtools-kit`
- Optional Nitro server proxy (`/api/_noydb/[...]`)
- Optional Nitro scheduled backup task
- Eager Noydb auto-instantiation (requires the user's passphrase callback, which can't be serialized through runtime config)

Closes #8.
