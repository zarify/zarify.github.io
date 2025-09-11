// Adapter for author config persistence. Prefer unified-storage (IndexedDB)
// when available; fall back to synchronous localStorage APIs when IndexedDB
// is not present so existing tests and usage that expect sync behaviour keep
// working.
import { saveSetting, loadSetting, clearSetting } from './unified-storage.js'

// Always use unified-storage async APIs. Do not read/write localStorage.
// Tests should use the in-memory fallback provided by unified-storage.
let getAuthorConfigFromLocalStorage = async function () {
    try {
        const result = await loadSetting('author_config')
        return result
    } catch (e) {
        console.error('[author-storage] getAuthorConfigFromLocalStorage failed:', e)
        return null
    }
}

let saveAuthorConfigToLocalStorage = async function (obj) {
    try {
        await saveSetting('author_config', obj)
        return true
    } catch (e) {
        console.error('[author-storage] saveAuthorConfigToLocalStorage failed:', e)
        return false
    }
}

let clearAuthorConfigInLocalStorage = async function () {
    try {
        await clearSetting('author_config')
        return true
    } catch (e) {
        return false
    }
}

export { getAuthorConfigFromLocalStorage, saveAuthorConfigToLocalStorage, clearAuthorConfigInLocalStorage }

// IndexedDB-backed draft store
const DB_NAME = 'clipy-authoring'
const STORE = 'author_configs'

// In-memory fallback for drafts when IndexedDB is unavailable. Kept in-memory
// so we avoid writing to localStorage in production.
const inMemoryDrafts = new Map()

function openDb() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('IndexedDB unavailable'))

        try {
            const req = indexedDB.open(DB_NAME, 1)
            req.onupgradeneeded = (ev) => {
                const db = ev.target.result
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
            }
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error || new Error('IndexedDB open failed'))
            req.onblocked = () => reject(new Error('IndexedDB blocked'))
        } catch (e) {
            // In private browsing mode, indexedDB.open() might throw immediately
            reject(e)
        }
    })
}

export async function saveDraft(rec) {
    // Ensure id and timestamps exist regardless of storage backend
    const now = Date.now()
    if (!rec.id) rec.id = String(now)
    if (!rec.createdAt) rec.createdAt = now
    rec.updatedAt = now

    try {
        const db = await openDb()
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite')
            const store = tx.objectStore(STORE)
            const r = store.put(rec)
            r.onsuccess = () => resolve(rec)
            r.onerror = () => reject(r.error)
        })
    } catch (e) {
        // fallback to in-memory map
        try {
            inMemoryDrafts.set(rec.id, rec)
            return rec
        } catch (_e) { throw e }
    }
}

export async function listDrafts() {
    try {
        const db = await openDb()
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly')
            const store = tx.objectStore(STORE)
            const req = store.getAll()
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
        })
    } catch (e) {
        // fallback: read from in-memory drafts map
        return Array.from(inMemoryDrafts.values())
    }
}

export async function loadDraft(id) {
    try {
        const db = await openDb()
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readonly')
            const store = tx.objectStore(STORE)
            const req = store.get(id)
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
        })
    } catch (e) {
        try { return inMemoryDrafts.get(id) || null } catch (_e) { return null }
    }
}

export async function deleteDraft(id) {
    try {
        const db = await openDb()
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite')
            const store = tx.objectStore(STORE)
            const req = store.delete(id)
            req.onsuccess = () => resolve(true)
            req.onerror = () => reject(req.error)
        })
    } catch (e) {
        try { inMemoryDrafts.delete(id); return true } catch (_e) { return false }
    }
}

// Find existing draft by config ID and version
export async function findDraftByConfigIdAndVersion(configId, configVersion) {
    if (!configId) return null

    try {
        const drafts = await listDrafts()
        return drafts.find(draft => {
            const config = draft.config || {}
            return config.id === configId && config.version === configVersion
        })
    } catch (e) {
        return null
    }
}
