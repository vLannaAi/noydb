import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    include: ['@noydb/core', '@noydb/browser', '@noydb/memory'],
  },
})
