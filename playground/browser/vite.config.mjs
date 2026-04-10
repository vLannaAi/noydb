import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    include: ['@noy-db/hub', '@noy-db/to-browser-local', '@noy-db/to-memory'],
  },
})
