// Lightweight VFS: IndexedDB-backed file storage with localStorage fallback.
// Exports: async function init(options) -> { list, read, write, delete, mountToEmscripten }

const DB_NAME = 'ssg_vfs_db'
const STORE_NAME = 'files'

function normalizePath(p) {
    if (typeof p !== 'string') p = String(p || '')
    p = p.trim().replace(/\\/g, '/')
    if (!p) return '/'
    if (!p.startsWith('/')) p = '/' + p
    // collapse multiple slashes
    p = p.replace(/\/+/g, '/')
    const parts = []
    for (const seg of p.split('/')) {
        if (seg === '' || seg === '.') continue
        if (seg === '..') throw new Error('path traversal not allowed')
        parts.push(seg)
    }
    return '/' + parts.join('/')
}

function listFilesFromFS(FS, root = '/') {
    if (!FS) return []
    // prefer a test shim
    if (typeof FS._listFiles === 'function') return FS._listFiles().map(p => normalizePath(p))
    const out = []
    const stack = [root || '/']
    while (stack.length) {
        const dir = stack.pop()
        let entries = []
        try { entries = FS.readdir(dir) } catch (e) { continue }
        for (const ent of entries) {
            if (ent === '.' || ent === '..') continue
            const full = (dir === '/' ? '' : dir) + '/' + ent
            try {
                let isDir = false
                if (typeof FS.isDir === 'function') {
                    isDir = FS.isDir(full)
                } else {
                    try { FS.readdir(full); isDir = true } catch (_) { isDir = false }
                }
                if (isDir) stack.push(full)
                else out.push(normalizePath(full))
            } catch (e) {
                try { FS.readFile(full); out.push(normalizePath(full)) } catch (_) { }
            }
        }
    }
    return out
}

function openIndexedDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('IndexedDB not available'))
        const req = indexedDB.open(DB_NAME, 1)
        req.onupgradeneeded = () => {
            const db = req.result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'path' })
            }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error || new Error('IndexedDB open failed'))
    })
}

function promisifyRequest(req) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

async function createIndexedDBBackend() {
    const db = await openIndexedDB()
    return {
        async list() {
            const tx = db.transaction(STORE_NAME, 'readonly')
            const store = tx.objectStore(STORE_NAME)
            const req = store.getAllKeys()
            const keys = await promisifyRequest(req)
            return keys.map(k => { try { return normalizePath(k) } catch (e) { return k } }).sort()
        },
        async read(path) {
            const p = normalizePath(path)
            const tx = db.transaction(STORE_NAME, 'readonly')
            const store = tx.objectStore(STORE_NAME)
            const req = store.get(p)
            const rec = await promisifyRequest(req)
            return rec ? rec.content : null
        },
        async write(path, content) {
            const p = normalizePath(path)
            const tx = db.transaction(STORE_NAME, 'readwrite')
            const store = tx.objectStore(STORE_NAME)
            const now = Date.now()
            const req = store.put({ path: p, content, mtime: now })
            await promisifyRequest(req)
        },
        async delete(path) {
            const p = normalizePath(path)
            const tx = db.transaction(STORE_NAME, 'readwrite')
            const store = tx.objectStore(STORE_NAME)
            const req = store.delete(p)
            await promisifyRequest(req)
        },
        async mountToEmscripten(FS) {
            if (!FS || typeof FS.writeFile !== 'function') return
            const keys = await this.list()
            for (const p of keys) {
                try {
                    const content = await this.read(p) || ''
                    const parts = p.split('/')
                    parts.pop()
                    let dir = ''
                    for (const seg of parts) { if (!seg) continue; dir += '/' + seg; try { FS.mkdir(dir) } catch (_) { } }
                    FS.writeFile(p, content)
                } catch (e) {
                    if (window.__ssg_debug_logs) {
                        try { const { warn: logWarn } = await import('./logger.js'); logWarn('VFS: mount skip', p, e) } catch (_e) { console.warn('VFS: mount skip', p, e) }
                    }
                }
            }
        },
        async syncFromEmscripten(FS) {
            if (!FS) return
            const files = listFilesFromFS(FS, '/')
            for (const p of files) {
                try {
                    const content = typeof FS.readFile === 'function' ? FS.readFile(p, { encoding: 'utf8' }) : null
                    if (content != null) await this.write(p, content)
                } catch (e) {
                    if (window.__ssg_debug_logs) {
                        try { const { warn: logWarn } = await import('./logger.js'); logWarn('VFS: sync skip', p, e) } catch (_e) { console.warn('VFS: sync skip', p, e) }
                    }
                }
            }
        }
    }
}

// LocalStorage fallback (synchronous API wrapped in promises)
const LS_KEY = 'ssg_files_v1'
function createLocalStorageBackend() {
    function load() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch (e) { return {} } }
    function save(m) { localStorage.setItem(LS_KEY, JSON.stringify(m)) }
    return {
        async list() { return Object.keys(load()).map(k => { try { return normalizePath(k) } catch (e) { return k } }).sort() },
        async read(path) { try { const m = load(); return m[normalizePath(path)] || null } catch (e) { return null } },
        async write(path, content) { try { const m = load(); m[normalizePath(path)] = content; save(m) } catch (e) { throw e } },
        async delete(path) { try { const m = load(); delete m[normalizePath(path)]; save(m) } catch (e) { /* ignore */ } },
        async mountToEmscripten(FS) { if (!FS || typeof FS.writeFile !== 'function') return; const keys = await this.list(); for (const p of keys) { try { const content = await this.read(p) || ''; const parts = p.split('/'); parts.pop(); let dir = ''; for (const seg of parts) { if (!seg) continue; dir += '/' + seg; try { FS.mkdir(dir) } catch (_) { } } FS.writeFile(p, content) } catch (e) { console.warn('VFS: mount skip', p, e) } } },
        async syncFromEmscripten(FS) { if (!FS) return; const files = listFilesFromFS(FS, '/'); for (const p of files) { try { const content = typeof FS.readFile === 'function' ? FS.readFile(p, { encoding: 'utf8' }) : null; if (content != null) await this.write(p, content) } catch (e) { console.warn('VFS: sync skip', p, e) } } }
    }
}

// Export local storage backend for testing
export { createLocalStorageBackend }

export async function init(options = {}) {
    // Try IndexedDB backend first
    try {
        const backend = await createIndexedDBBackend()
        return backend
    } catch (e) {
        // fallback to localStorage backend
        if (window.__ssg_debug_logs) console.warn('VFS: IndexedDB unavailable, falling back to localStorage:', e)
        return createLocalStorageBackend()
    }
}

export default { init }
