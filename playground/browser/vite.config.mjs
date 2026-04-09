import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    include: ['@noy-db/core', '@noy-db/store-browser', '@noy-db/store-memory'],
  },
})
