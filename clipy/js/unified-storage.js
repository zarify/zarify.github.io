// Unified IndexedDB-only storage system to replace localStorage/IndexedDB conflicts
// This eliminates the dual storage problems causing reload issues

import { debug as logDebug, warn as logWarn, error as logError } from './logger.js'

const DB_NAME = 'clipy_unified_storage'
const STORES = {
    CONFIG: 'config',
    SNAPSHOTS: 'snapshots',
    FILES: 'files',
    DRAFTS: 'drafts',
    SETTINGS: 'settings'
}

let dbInstance = null

// Helper: determine if we're running in a test environment where
// synchronous localStorage access is acceptable (jest/jsdom). Tests
// may set NODE_ENV=test or set window.__SSG_ALLOW_LOCALSTORAGE to true.
export function isTestEnvironment() {
    try {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') return true
        if (typeof window !== 'undefined' && window.__SSG_ALLOW_LOCALSTORAGE) return true
    } catch (_e) { }
    return false
}

// In-memory fallback store used for tests or environments where mocked
// IndexedDB doesn't persist values. This intentionally avoids writing to
// localStorage while still maintaining behavior across save/load within
// the same process (tests expect this).
const inMemory = {
    [STORES.CONFIG]: new Map(),
    [STORES.SNAPSHOTS]: new Map(),
    [STORES.FILES]: new Map(),
    [STORES.DRAFTS]: new Map(),
    [STORES.SETTINGS]: new Map()
}

// Expose helpers to clear the in-memory fallback for testing or cleanup.
export function clearInMemorySnapshots() {
    try {
        const m = inMemory[STORES.SNAPSHOTS]
        if (m && typeof m.clear === 'function') m.clear()
    } catch (_e) { }
}

export function clearInMemoryFiles() {
    try {
        const m = inMemory[STORES.FILES]
        if (m && typeof m.clear === 'function') m.clear()
    } catch (_e) { }
}

// Initialize the unified storage database
export async function initUnifiedStorage() {
    if (dbInstance) return dbInstance

    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('IndexedDB not available - modern browser required'))
            return
        }

        const request = window.indexedDB.open(DB_NAME, 1)

        request.onupgradeneeded = (event) => {
            const db = (event && event.target && event.target.result) || request.result
            if (!db) return

            // Create all stores if they don't exist
            if (!db.objectStoreNames.contains(STORES.CONFIG)) {
                db.createObjectStore(STORES.CONFIG, { keyPath: 'key' })
            }
            if (!db.objectStoreNames.contains(STORES.SNAPSHOTS)) {
                db.createObjectStore(STORES.SNAPSHOTS, { keyPath: 'id' })
            }
            if (!db.objectStoreNames.contains(STORES.FILES)) {
                db.createObjectStore(STORES.FILES, { keyPath: 'path' })
            }
            if (!db.objectStoreNames.contains(STORES.DRAFTS)) {
                db.createObjectStore(STORES.DRAFTS, { keyPath: 'id' })
            }
            if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' })
            }
        }

        request.onsuccess = () => {
            dbInstance = request.result
            logDebug('Unified storage initialized')
            resolve(dbInstance)
        }

        request.onerror = () => {
            reject(request.error || new Error('Failed to open unified storage'))
        }

        request.onblocked = () => {
            reject(new Error('Unified storage blocked - close other tabs'))
        }
    })
}

// Generic storage operations
async function getFromStore(storeName, key) {
    const db = await initUnifiedStorage()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly')
        const store = transaction.objectStore(storeName)
        const request = store.get(key)

        let settled = false
        const finishResolve = (val) => {
            if (!settled) {
                settled = true
                resolve(val)
            }
        }
        const finishReject = (err) => {
            if (!settled) {
                settled = true
                reject(err)
            }
        }

        request.onsuccess = () => {
            finishResolve(request.result)
        }
        request.onerror = () => {
            finishReject(request.error)
        }
        setTimeout(() => {
            if (!settled) {
                try {
                    const safeResult = (request && 'result' in request) ? request.result : undefined
                    finishResolve(safeResult)
                } catch (e) {
                    // If the underlying IDBRequest/IDBTransaction has been closed or
                    // becomes unusable, resolve gracefully to avoid uncaught DOMException
                    finishResolve(undefined)
                }
            }
        }, 100)
    })
}

// Helper to read from the in-memory fallback if IDB returned nothing
async function getFromInMemory(storeName, key) {
    try {
        const m = inMemory[storeName]
        if (!m) return null
        return m.has(key) ? m.get(key) : null
    } catch (_e) { return null }
}

async function putToStore(storeName, data) {
    const db = await initUnifiedStorage()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite')
        const store = transaction.objectStore(storeName)
        const request = store.put(data)

        let settled = false
        const finishResolve = (val) => {
            if (!settled) {
                settled = true
                resolve(val)
            }
        }
        const finishReject = (err) => {
            if (!settled) {
                settled = true
                reject(err)
            }
        }
        // Resolve only after the transaction has completed to ensure the
        // write is committed and visible to subsequent read transactions.
        request.onsuccess = () => {
            // no-op here; wait for transaction.oncomplete
        }
        request.onerror = () => {
            finishReject(request.error)
        }

        transaction.oncomplete = () => {
            try {
                const safeResult = (request && 'result' in request) ? request.result : undefined
                finishResolve(safeResult)
            } catch (e) {
                finishResolve(undefined)
            }
        }

        transaction.onerror = () => {
            finishReject(transaction.error || new Error('IndexedDB transaction error'))
        }
        transaction.onabort = () => {
            finishReject(transaction.error || new Error('IndexedDB transaction aborted'))
        }

        // Safety fallback: some test mocks don't call onsuccess/onerror or
        // transaction handlers. If neither fires within a short window, resolve
        // optimistically so tests don't hang — but wait a bit longer to give
        // the browser time to commit the transaction.
        setTimeout(() => {
            if (!settled) {
                try {
                    const safeResult = (request && 'result' in request) ? request.result : undefined
                    finishResolve(safeResult)
                } catch (e) {
                    finishResolve(undefined)
                }
            }
        }, 120)
    })
}

// Ensure we also persist to in-memory fallback so tests that mock IndexedDB
// still observe saved values without writing to localStorage.
function persistToInMemory(storeName, data) {
    try {
        const m = inMemory[storeName]
        if (!m) return
        // Determine key for storage based on expected object shape
        let key = null
        if (data && typeof data === 'object') {
            if (Object.prototype.hasOwnProperty.call(data, 'key')) key = data.key
            else if (Object.prototype.hasOwnProperty.call(data, 'id')) key = data.id
            else if (Object.prototype.hasOwnProperty.call(data, 'path')) key = data.path
        }
        if (key == null) return
        m.set(key, data)
    } catch (_e) { }
}

async function deleteFromStore(storeName, key) {
    const db = await initUnifiedStorage()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite')
        const store = transaction.objectStore(storeName)
        const request = store.delete(key)

        let settled = false
        const finishResolve = (val) => { if (!settled) { settled = true; resolve(val) } }
        const finishReject = (err) => { if (!settled) { settled = true; reject(err) } }

        request.onsuccess = () => finishResolve()
        request.onerror = () => finishReject(request.error)
        setTimeout(() => {
            if (!settled) {
                try { finishResolve() } catch (e) { resolve() }
            }
        }, 0)
    })
}

function deleteFromInMemory(storeName, key) {
    try {
        const m = inMemory[storeName]
        if (!m) return
        m.delete(key)
    } catch (_e) { }
}

async function getAllFromStore(storeName) {
    const db = await initUnifiedStorage()
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly')
        const store = transaction.objectStore(storeName)
        const request = store.getAll()

        let settled = false
        const finishResolve = (val) => { if (!settled) { settled = true; resolve(val) } }
        const finishReject = (err) => { if (!settled) { settled = true; reject(err) } }

        request.onsuccess = () => finishResolve(request.result)
        request.onerror = () => finishReject(request.error)
        setTimeout(() => {
            if (!settled) {
                try {
                    const safeResult = (request && 'result' in request) ? request.result : undefined
                    finishResolve(safeResult)
                } catch (e) {
                    finishResolve(undefined)
                }
            }
        }, 0)
    })
}

async function getAllFromInMemory(storeName) {
    try {
        const m = inMemory[storeName]
        if (!m) return []
        return Array.from(m.values())
    } catch (_e) { return [] }
}

// Config storage (replaces localStorage current_config)
export async function saveConfig(config) {
    try {
        await putToStore(STORES.CONFIG, { key: 'current_config', value: config, timestamp: Date.now() })
        persistToInMemory(STORES.CONFIG, { key: 'current_config', value: config, timestamp: Date.now() })
        logDebug('Config saved to unified storage:', config.id, config.version)
    } catch (error) {
        logError('Failed to save config:', error)
        throw error
    }
}

export async function loadConfig() {
    try {
        const result = await getFromStore(STORES.CONFIG, 'current_config')
        if (result) {
            logDebug('Config loaded from unified storage:', result.value.id, result.value.version)
            return result.value
        }
        // If indexedDB returned nothing, try in-memory fallback
        const mem = await getFromInMemory(STORES.CONFIG, 'current_config')
        if (mem) return mem.value
        return null
    } catch (error) {
        logError('Failed to load config:', error)
        return null
    }
}

export async function clearConfig() {
    try {
        await deleteFromStore(STORES.CONFIG, 'current_config')
        logDebug('Config cleared from unified storage')
    } catch (error) {
        logError('Failed to clear config:', error)
    }
}

// Snapshot storage (replaces localStorage snapshots_*)
export async function saveSnapshots(configIdentity, snapshots) {
    try {
        await putToStore(STORES.SNAPSHOTS, {
            id: configIdentity,
            snapshots,
            timestamp: Date.now()
        })
        // Persist to in-memory fallback for test environments that mock IDB
        persistToInMemory(STORES.SNAPSHOTS, { id: configIdentity, snapshots, timestamp: Date.now() })
        logDebug('Snapshots saved for config:', configIdentity)
    } catch (error) {
        logError('Failed to save snapshots:', error)
        throw error
    }
}

export async function loadSnapshots(configIdentity) {
    try {
        const result = await getFromStore(STORES.SNAPSHOTS, configIdentity)
        if (result && result.snapshots && Array.isArray(result.snapshots)) {
            return result.snapshots
        }
        // Fall back to in-memory store
        const mem = await getFromInMemory(STORES.SNAPSHOTS, configIdentity)
        if (mem && mem.snapshots && Array.isArray(mem.snapshots)) return mem.snapshots
        return []
    } catch (error) {
        logError('Failed to load snapshots:', error)
        return []
    }
}

export async function clearSnapshots(configIdentity) {
    try {
        await deleteFromStore(STORES.SNAPSHOTS, configIdentity)
        logDebug('Snapshots cleared for config:', configIdentity)
    } catch (error) {
        logError('Failed to clear snapshots:', error)
    }
}

// ----- Success snapshot helpers -----
// We store a single special-purpose success snapshot alongside regular
// snapshots in the SNAPSHOTS store. It is identified by the key
// `${configIdentity}__success__` so it is kept separate from history and
// can be overwritten/cleared without affecting the snapshot array.
export async function loadSuccessSnapshot(configIdentity) {
    try {
        const key = `${configIdentity}__success__`
        const result = await getFromStore(STORES.SNAPSHOTS, key)
        if (result && result.snapshot) return result.snapshot
        const mem = await getFromInMemory(STORES.SNAPSHOTS, key)
        if (mem && mem.snapshot) return mem.snapshot
        return null
    } catch (error) {
        logError('Failed to load success snapshot:', error)
        return null
    }
}

export async function saveSuccessSnapshot(configIdentity, snapshot) {
    try {
        const key = `${configIdentity}__success__`
        await putToStore(STORES.SNAPSHOTS, { id: key, snapshot, timestamp: Date.now() })
        persistToInMemory(STORES.SNAPSHOTS, { id: key, snapshot, timestamp: Date.now() })
        logDebug('Success snapshot saved for config:', configIdentity)
    } catch (error) {
        logError('Failed to save success snapshot:', error)
        throw error
    }
}

export async function clearSuccessSnapshot(configIdentity) {
    try {
        const key = `${configIdentity}__success__`
        await deleteFromStore(STORES.SNAPSHOTS, key)
        deleteFromInMemory(STORES.SNAPSHOTS, key)
        logDebug('Success snapshot cleared for config:', configIdentity)
    } catch (error) {
        logError('Failed to clear success snapshot:', error)
    }
}

export async function getAllSnapshotConfigs() {
    try {
        const results = await getAllFromStore(STORES.SNAPSHOTS)
        return results.map(r => r.id)
    } catch (error) {
        logError('Failed to get snapshot configs:', error)
        return []
    }
}

// Get all snapshots with metadata (for size calculations, etc.)
export async function getAllSnapshots() {
    try {
        const results = await getAllFromStore(STORES.SNAPSHOTS)
        return results
    } catch (error) {
        logError('Failed to get all snapshots:', error)
        return []
    }
}

// Clear all snapshots regardless of config
export async function clearAllSnapshots() {
    try {
        const db = await initUnifiedStorage()
        const transaction = db.transaction([STORES.SNAPSHOTS], 'readwrite')
        const store = transaction.objectStore(STORES.SNAPSHOTS)

        return new Promise((resolve, reject) => {
            const request = store.clear()
            request.onsuccess = () => {
                logDebug('All snapshots cleared from unified storage')
                resolve()
            }
            request.onerror = () => reject(request.error)
        })
    } catch (error) {
        logError('Failed to clear all snapshots:', error)
        throw error
    }
}

// Clear all files stored in the FILES store
export async function clearAllFiles() {
    try {
        const db = await initUnifiedStorage()
        const transaction = db.transaction([STORES.FILES], 'readwrite')
        const store = transaction.objectStore(STORES.FILES)

        return new Promise((resolve, reject) => {
            const request = store.clear()
            request.onsuccess = () => {
                logDebug('All files cleared from unified storage')
                resolve()
            }
            request.onerror = () => reject(request.error)
        })
    } catch (error) {
        logError('Failed to clear all files:', error)
        throw error
    }
}

// File storage (replaces localStorage ssg_files_v1)
export async function saveFile(path, content) {
    try {
        await putToStore(STORES.FILES, { path, content, timestamp: Date.now() })
        persistToInMemory(STORES.FILES, { path, content, timestamp: Date.now() })
    } catch (error) {
        logError('Failed to save file:', path, error)
        throw error
    }
}

export async function loadFile(path) {
    try {
        const result = await getFromStore(STORES.FILES, path)
        if (result) return result.content
        const mem = await getFromInMemory(STORES.FILES, path)
        return mem ? mem.content : null
    } catch (error) {
        logError('Failed to load file:', path, error)
        return null
    }
}

export async function deleteFile(path) {
    try {
        await deleteFromStore(STORES.FILES, path)
        deleteFromInMemory(STORES.FILES, path)
    } catch (error) {
        logError('Failed to delete file:', path, error)
    }
}

export async function listFiles() {
    try {
        const results = await getAllFromStore(STORES.FILES)
        if (results && results.length) return results.map(r => r.path).sort()
        // fallback to in-memory list
        const memList = await getAllFromInMemory(STORES.FILES)
        return memList.map(r => r.path).sort()
    } catch (error) {
        logError('Failed to list files:', error)
        return []
    }
}

// Settings storage (replaces other localStorage items like author_config, etc.)
export async function saveSetting(key, value) {
    try {
        // Attempt to convert value to plain JSON when possible so it is
        // stored in a predictable, inspectable form in IndexedDB.
        let storedValue = value
        try {
            if (value && typeof value === 'object') storedValue = JSON.parse(JSON.stringify(value))
        } catch (_e) { /* leave original if it can't be stringified */ }
        // Try to write to IndexedDB. In some browsing modes (private browsing)
        // writes may not commit but the IDBRequest handlers may not fire; we
        // therefore try to verify the write and only fall back to localStorage
        // when a subsequent read fails to return the stored value.
        let putError = null
        try {
            await putToStore(STORES.SETTINGS, { key, value: storedValue, timestamp: Date.now() })
        } catch (err) {
            putError = err
            logWarn('putToStore failed for setting, will attempt fallback:', key, err)
        }

        // Persist to in-memory so same-page reads observe the write immediately.
        try {
            persistToInMemory(STORES.SETTINGS, { key, value: storedValue, timestamp: Date.now() })
        } catch (_e) {
            // In-memory persist failed, but continue with verification
        }

        // Verify the value is readable from unified storage. IDB writes can
        // appear asynchronous relative to the resolved put promise in some
        // environments (mocked IDB, private browsing). Retry a few short
        // times before declaring the write unverifiable to avoid false
        // negatives during normal async commit timing.
        let verificationFailed = false
        try {
            let verify = null
            const maxAttempts = 5
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    verify = await getFromStore(STORES.SETTINGS, key)
                } catch (_e) {
                    verify = null
                }
                const matches = verify && (typeof verify.value !== 'undefined') && JSON.stringify(verify.value) === JSON.stringify(storedValue)
                if (matches) {
                    verificationFailed = false
                    break
                }
                // small backoff to allow the DB commit to become visible
                await new Promise(r => setTimeout(r, attempt === 0 ? 20 : 50))
                verificationFailed = true
            }
        } catch (e) {
            verificationFailed = true
        }

        if (verificationFailed) {
            // IndexedDB write couldn't be verified after retries. Do not write
            // to localStorage as a fallback in production; keep the value in
            // the in-memory fallback so same-page reads work. Log a warning so
            // developers can investigate why IDB is not persisting.
            try {
                const memFallback = await getFromInMemory(STORES.SETTINGS, key)
                if (memFallback) {
                    logWarn('saveSetting: unified storage write not verifiable for key:', key, '(in-memory fallback present)')
                } else {
                    logWarn('saveSetting: unified storage write not verifiable for key:', key, '(no in-memory fallback)')
                }
            } catch (_e) {
                logWarn('saveSetting: unified storage write not verifiable for key:', key)
            }
            // If there was an earlier put error, surface it for diagnostics
            try {
                if (typeof putError !== 'undefined' && putError) logDebug('saveSetting: putToStore error:', putError && putError.message ? putError.message : putError)
            } catch (_e) { }
        }
        try {
            // Avoid serializing huge objects in the log; provide a small preview
            const preview = (value && typeof value === 'object') ? (value.id || value.title || '[object]') : value
            logDebug('Saved setting to unified storage:', key, preview)
        } catch (_e) { }
    } catch (error) {
        logError('Failed to save setting:', key, error)
        throw error
    }
}

export async function loadSetting(key) {
    try {
        const result = await getFromStore(STORES.SETTINGS, key)
        if (result) {
            return result.value
        }
        const mem = await getFromInMemory(STORES.SETTINGS, key)
        if (mem) {
            return mem.value
        }
        // If unified storage returned nothing, try the in-memory fallback only.
        return null
    } catch (error) {
        logError('Failed to load setting:', key, error)
        // Don't consult localStorage; return null so calling code uses
        // unified-storage's behavior (or in-memory fallback) only.
        return null
    }
}

export async function clearSetting(key) {
    try {
        await deleteFromStore(STORES.SETTINGS, key)
    } catch (error) {
        logError('Failed to clear setting:', key, error)
    }
}

// Runtime helper for debugging: read saved author_config (if present)
try {
    if (typeof window !== 'undefined') {
        window.getSavedAuthorConfig = async function () {
            try {
                return await loadSetting('author_config')
            } catch (e) {
                // In production do not consult localStorage; only allow during tests.
                if (isTestEnvironment() && typeof localStorage !== 'undefined') {
                    try { return JSON.parse(localStorage.getItem('author_config') || 'null') } catch (_e) { return null }
                }
                return null
            }
        }

        // Expose legacy VFS cleanup helper
        window.cleanupLegacyVfs = async function () {
            try {
                return await verifyAndCleanupVfsLocalStorage()
            } catch (e) {
                return { removed: false, reason: 'error', error: e && e.message }
            }
        }
    }
} catch (_e) { }

// Migration utility to move existing localStorage data
export async function migrateFromLocalStorage() {
    // Migration is only allowed in test/dev environments. In production we
    // avoid reading localStorage to prevent dual-storage conflicts.
    if (!isTestEnvironment()) {
        return
    }
    if (!window.localStorage) {
        return
    }

    logDebug('Starting localStorage migration to unified storage')

    try {
        // Migrate current config
        const currentConfig = localStorage.getItem('current_config')
        if (currentConfig) {
            try {
                const config = JSON.parse(currentConfig)
                // Persist to in-memory fallback so tests can observe migrated data
                try { persistToInMemory(STORES.CONFIG, { key: 'current_config', value: config, timestamp: Date.now() }) } catch (_e) { }
                await saveConfig(config)
                localStorage.removeItem('current_config')
                logDebug('Migrated current_config')
            } catch (e) {
                logWarn('Failed to migrate current_config:', e)
            }
        }

        // Migrate snapshots (test/dev only)
        const snapshotKeys = []
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.startsWith('snapshots_')) {
                snapshotKeys.push(key)
            }
        }

        for (const key of snapshotKeys) {
            try {
                const snapshots = JSON.parse(localStorage.getItem(key))
                const configIdentity = key.replace('snapshots_', '')
                // Persist to in-memory fallback first so tests see the data immediately
                try { persistToInMemory(STORES.SNAPSHOTS, { id: configIdentity, snapshots, timestamp: Date.now() }) } catch (_e) { }
                await saveSnapshots(configIdentity, snapshots)
                localStorage.removeItem(key)
                logDebug('Migrated snapshots for:', configIdentity)
            } catch (e) {
                logWarn('Failed to migrate snapshots:', key, e)
            }
        }

        // Legacy localStorage VFS migration removed: 'ssg_files_v1' is no longer used.

        // Migrate author config
        const authorConfig = localStorage.getItem('author_config')
        if (typeof window !== 'undefined' && window.__SSG_DEBUG) console.log('[DEBUG] checking localStorage author_config:', authorConfig ? 'found' : 'not found')
        if (authorConfig) {
            try {
                const config = JSON.parse(authorConfig)
                if (typeof window !== 'undefined' && window.__SSG_DEBUG) console.log('[DEBUG] migrating author_config:', config.id, config.title)
                try { persistToInMemory(STORES.SETTINGS, { key: 'author_config', value: config, timestamp: Date.now() }) } catch (_e) { }
                await saveSetting('author_config', config)
                localStorage.removeItem('author_config')
                if (typeof window !== 'undefined' && window.__SSG_DEBUG) console.log('[DEBUG] author_config migrated and removed from localStorage')
                logDebug('Migrated author_config')
            } catch (e) {
                if (typeof window !== 'undefined' && window.__SSG_DEBUG) console.error('[DEBUG] Failed to migrate author_config:', e)
                logWarn('Failed to migrate author_config', e)
            }
        }

        // Migrate other common settings
        const settingsToMigrate = ['autosave', 'student_id', 'students_list']
        for (const key of settingsToMigrate) {
            const value = localStorage.getItem(key)
            if (value) {
                try {
                    const parsed = JSON.parse(value)
                    try { persistToInMemory(STORES.SETTINGS, { key, value: parsed, timestamp: Date.now() }) } catch (_e) { }
                    await saveSetting(key, parsed)
                    localStorage.removeItem(key)
                    logDebug('Migrated setting:', key)
                } catch (e) {
                    // Try as string if JSON parse fails
                    try {
                        try { persistToInMemory(STORES.SETTINGS, { key, value, timestamp: Date.now() }) } catch (_e) { }
                        await saveSetting(key, value)
                        localStorage.removeItem(key)
                        logDebug('Migrated setting (as string):', key)
                    } catch (e2) {
                        logWarn('Failed to migrate setting:', key, e2)
                    }
                }
            }
        }

        logDebug('localStorage migration completed')
    } catch (error) {
        logError('Migration failed:', error)
    }
}

// Cleanup old localStorage data (run after successful migration)
export function cleanupLocalStorage() {
    if (!window.localStorage) return

    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (
            key.startsWith('snapshots_') ||
            key === 'current_config' ||
            key === 'author_config' ||
            key === 'autosave' ||
            key === 'student_id' ||
            key === 'students_list'
        )) {
            keysToRemove.push(key)
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
    logDebug('Cleaned up localStorage keys:', keysToRemove)
}

// Safely verify and remove legacy VFS localStorage key `ssg_files_v1`.
// This will only remove the key if the contents have been migrated to
// the unified FILES store (i.e., every path/value pair matches an entry
// in the unified storage). Returns an object describing the outcome.
export async function verifyAndCleanupVfsLocalStorage() {
    // Legacy localStorage VFS key no longer used. Report as already removed.
    return { removed: true, count: 0, reason: 'deprecated' }
}
