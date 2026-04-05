import type { NoydbAdapter, EncryptedEnvelope, CompartmentSnapshot } from '@noydb/core'
import { ConflictError } from '@noydb/core'

export interface BrowserOptions {
  /** Storage key prefix. Default: 'noydb'. */
  prefix?: string
  /** Force a specific storage backend. Default: auto-detect. */
  backend?: 'localStorage' | 'indexedDB'
}

/**
 * Create a browser storage adapter.
 * Uses localStorage for small datasets (<5MB) or IndexedDB for larger ones.
 *
 * Key scheme: `{prefix}:{compartment}:{collection}:{id}`
 */
export function browser(options: BrowserOptions = {}): NoydbAdapter {
  const prefix = options.prefix ?? 'noydb'

  // Detect best backend
  const useIndexedDB = options.backend === 'indexedDB' ||
    (options.backend !== 'localStorage' && typeof indexedDB !== 'undefined')

  if (useIndexedDB && typeof indexedDB !== 'undefined') {
    return createIndexedDBAdapter(prefix)
  }

  return createLocalStorageAdapter(prefix)
}

// ─── localStorage Backend ──────────────────────────────────────────────

function createLocalStorageAdapter(prefix: string): NoydbAdapter {
  function key(compartment: string, collection: string, id: string): string {
    return `${prefix}:${compartment}:${collection}:${id}`
  }

  function collectionPrefix(compartment: string, collection: string): string {
    return `${prefix}:${compartment}:${collection}:`
  }

  function compartmentPrefix(compartment: string): string {
    return `${prefix}:${compartment}:`
  }

  return {
    async get(compartment, collection, id) {
      const data = localStorage.getItem(key(compartment, collection, id))
      if (!data) return null
      return JSON.parse(data) as EncryptedEnvelope
    },

    async put(compartment, collection, id, envelope, expectedVersion) {
      const k = key(compartment, collection, id)

      if (expectedVersion !== undefined) {
        const existing = localStorage.getItem(k)
        if (existing) {
          const current = JSON.parse(existing) as EncryptedEnvelope
          if (current._v !== expectedVersion) {
            throw new ConflictError(current._v, `Version conflict: expected ${expectedVersion}, found ${current._v}`)
          }
        }
      }

      localStorage.setItem(k, JSON.stringify(envelope))
    },

    async delete(compartment, collection, id) {
      localStorage.removeItem(key(compartment, collection, id))
    },

    async list(compartment, collection) {
      const pfx = collectionPrefix(compartment, collection)
      const ids: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k?.startsWith(pfx)) {
          ids.push(k.slice(pfx.length))
        }
      }
      return ids
    },

    async loadAll(compartment) {
      const pfx = compartmentPrefix(compartment)
      const snapshot: CompartmentSnapshot = {}

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!k?.startsWith(pfx)) continue

        const rest = k.slice(pfx.length)
        const colonIdx = rest.indexOf(':')
        if (colonIdx < 0) continue

        const collection = rest.slice(0, colonIdx)
        const id = rest.slice(colonIdx + 1)

        if (collection.startsWith('_')) continue

        if (!snapshot[collection]) snapshot[collection] = {}
        const data = localStorage.getItem(k)
        if (data) {
          snapshot[collection]![id] = JSON.parse(data) as EncryptedEnvelope
        }
      }

      return snapshot
    },

    async saveAll(compartment, data) {
      for (const [collection, records] of Object.entries(data)) {
        for (const [id, envelope] of Object.entries(records)) {
          localStorage.setItem(
            key(compartment, collection, id),
            JSON.stringify(envelope),
          )
        }
      }
    },

    async ping() {
      try {
        const testKey = `${prefix}:__ping__`
        localStorage.setItem(testKey, '1')
        localStorage.removeItem(testKey)
        return true
      } catch {
        return false
      }
    },
  }
}

// ─── IndexedDB Backend ─────────────────────────────────────────────────

function createIndexedDBAdapter(prefix: string): NoydbAdapter {
  const DB_NAME = `${prefix}_noydb`
  const STORE_NAME = 'records'
  let dbPromise: Promise<IDBDatabase> | null = null

  function openDB(): Promise<IDBDatabase> {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1)
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME)
          }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    }
    return dbPromise
  }

  function key(compartment: string, collection: string, id: string): string {
    return `${compartment}:${collection}:${id}`
  }

  function tx(mode: IDBTransactionMode): Promise<{ store: IDBObjectStore; complete: Promise<void> }> {
    return openDB().then(db => {
      const transaction = db.transaction(STORE_NAME, mode)
      const store = transaction.objectStore(STORE_NAME)
      const complete = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
      return { store, complete }
    })
  }

  function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  return {
    async get(compartment, collection, id) {
      const { store } = await tx('readonly')
      const result = await idbRequest(store.get(key(compartment, collection, id)))
      return (result as EncryptedEnvelope | undefined) ?? null
    },

    async put(compartment, collection, id, envelope, expectedVersion) {
      const k = key(compartment, collection, id)

      if (expectedVersion !== undefined) {
        const { store: readStore } = await tx('readonly')
        const existing = await idbRequest(readStore.get(k)) as EncryptedEnvelope | undefined
        if (existing && existing._v !== expectedVersion) {
          throw new ConflictError(existing._v, `Version conflict: expected ${expectedVersion}, found ${existing._v}`)
        }
      }

      const { store, complete } = await tx('readwrite')
      store.put(envelope, k)
      await complete
    },

    async delete(compartment, collection, id) {
      const { store, complete } = await tx('readwrite')
      store.delete(key(compartment, collection, id))
      await complete
    },

    async list(compartment, collection) {
      const pfx = `${compartment}:${collection}:`
      const { store } = await tx('readonly')
      const keys = await idbRequest(store.getAllKeys()) as string[]
      return keys
        .filter(k => typeof k === 'string' && k.startsWith(pfx))
        .map(k => k.slice(pfx.length))
    },

    async loadAll(compartment) {
      const pfx = `${compartment}:`
      const { store } = await tx('readonly')
      const keys = await idbRequest(store.getAllKeys()) as string[]
      const snapshot: CompartmentSnapshot = {}

      for (const k of keys) {
        if (typeof k !== 'string' || !k.startsWith(pfx)) continue
        const rest = k.slice(pfx.length)
        const colonIdx = rest.indexOf(':')
        if (colonIdx < 0) continue

        const collection = rest.slice(0, colonIdx)
        const id = rest.slice(colonIdx + 1)
        if (collection.startsWith('_')) continue

        if (!snapshot[collection]) snapshot[collection] = {}
        const data = await idbRequest(store.get(k)) as EncryptedEnvelope
        if (data) snapshot[collection]![id] = data
      }

      return snapshot
    },

    async saveAll(compartment, data) {
      const { store, complete } = await tx('readwrite')
      for (const [collection, records] of Object.entries(data)) {
        for (const [id, envelope] of Object.entries(records)) {
          store.put(envelope, key(compartment, collection, id))
        }
      }
      await complete
    },

    async ping() {
      try {
        await openDB()
        return true
      } catch {
        return false
      }
    },
  }
}
