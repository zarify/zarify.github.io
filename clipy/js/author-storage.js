// Simple wrapper for localStorage-backed author config and an IndexedDB draft store (minimal)

export function getAuthorConfigFromLocalStorage() {
    try {
        const raw = localStorage.getItem('author_config')
        if (!raw) return null
        try { return JSON.parse(raw) } catch (_e) { return null }
    } catch (e) { return null }
}

export function saveAuthorConfigToLocalStorage(obj) {
    try {
        localStorage.setItem('author_config', JSON.stringify(obj))
        return true
    } catch (e) { return false }
}

export function clearAuthorConfigInLocalStorage() {
    try { localStorage.removeItem('author_config'); return true } catch (e) { return false }
}

// IndexedDB-backed draft store
const DB_NAME = 'clipy-authoring'
const STORE = 'author_configs'

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
    try {
        const db = await openDb()
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite')
            const store = tx.objectStore(STORE)
            const now = Date.now()
            rec.updatedAt = now
            if (!rec.id) rec.id = String(now)
            if (!rec.createdAt) rec.createdAt = now
            const r = store.put(rec)
            r.onsuccess = () => resolve(rec)
            r.onerror = () => reject(r.error)
        })
    } catch (e) {
        // fallback to localStorage per-spec
        try {
            const key = 'author_draft:' + (rec.id || Date.now())
            localStorage.setItem(key, JSON.stringify(rec))
            return rec
        } catch (_e) { throw e }
    }
} export async function listDrafts() {
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
        // fallback: scan localStorage keys
        const out = []
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)
            if (!k || !k.startsWith('author_draft:')) continue
            try { out.push(JSON.parse(localStorage.getItem(k))) } catch (_e) { }
        }
        return out
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
        const key = 'author_draft:' + id
        try { return JSON.parse(localStorage.getItem(key)) } catch (_e) { return null }
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
        const key = 'author_draft:' + id
        try { localStorage.removeItem(key); return true } catch (_e) { return false }
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
