import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createNoydb } from '@noy-db/hub'
import { browserIdbStore } from '@noy-db/to-browser-idb'
import { setActiveNoydb } from '@noy-db/in-pinia'
import App from './App.vue'

// Bootstrap NOYDB before creating the Vue app so the active instance is
// available when stores are first instantiated.
const db = await createNoydb({
  store: browserIdbStore({ prefix: 'noydb-pinia-demo' }),
  user: 'demo-owner',
  secret: 'pinia-playground-passphrase-2026',
})

setActiveNoydb(db)

createApp(App).use(createPinia()).mount('#app')
