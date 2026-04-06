import { defineConfig } from 'tsup'

export default defineConfig({
  // Single entry point — `index.ts` re-exports the module factory and
  // its option types. Runtime files are NOT bundled into dist; they're
  // referenced via @nuxt/kit's resolver at install time and ship as
  // separate files inside dist/runtime/.
  entry: ['src/index.ts'],
  // ESM-only: Nuxt 4 modules use `import.meta.url` which doesn't work
  // in CJS, and Nuxt itself is ESM-only as of v4. Shipping CJS would
  // be dead code that triggers a build warning.
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  target: 'es2022',
  // Mark Nuxt-internal modules as external so they're never bundled into
  // the module's dist. The consuming Nuxt project provides them.
  external: [
    '@nuxt/kit',
    '@nuxt/schema',
    'nuxt',
    'nuxt/app',
    '@noy-db/core',
    '@noy-db/pinia',
    '@noy-db/vue',
  ],
})
