// Lightweight VFS: IndexedDB-backed file storage with localStorage fallback.
// Exports: async function init(options) -> { list, read, write, delete, mountToEmscripten }

const DB_NAME = 'ssg_vfs_db'
const STORE_NAME = 'files'

// Helper: decode ArrayBuffer/Uint8Array to UTF-8 string with fallbacks
function decodeToString(buf) {
    if (buf == null) return buf
    try {
        if (typeof buf === 'string') return buf
        // ArrayBuffer or TypedArray view
        if (buf instanceof ArrayBuffer) buf = new Uint8Array(buf)
        if (ArrayBuffer.isView(buf)) {
            if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(buf)
            try {
                // Node fallback
                const util = require && require('util')
                if (util && util.TextDecoder) return new util.TextDecoder('utf-8').decode(buf)
            } catch (_) { }
            try { return Buffer.from(buf).toString('utf8') } catch (_) { return String(buf) }
        }
        return String(buf)
    } catch (e) { return String(buf) }
}

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
                    // Try to get the node first to call isDir on the mode
                    try {
                        const lookup = FS.lookupPath(full)
                        if (lookup && lookup.node && lookup.node.mode) {
                            isDir = FS.isDir(lookup.node.mode)
                        }
                    } catch (_) {
                        // Fallback to original method if lookupPath fails
                        isDir = FS.isDir(full)
                    }
                } else {
                    // PERFORMANCE: Avoid expensive readdir test for directory detection
                    // Instead, try a lightweight stat-like operation first
                    try {
                        const lookup = FS.lookupPath(full)
                        if (lookup && lookup.node && lookup.node.mode) {
                            // Use the mode bits directly - directories typically have mode & 0o170000 === 0o040000
                            isDir = (lookup.node.mode & 61440) === 16384  // S_IFDIR = 0o040000 = 16384
                        } else {
                            // Last resort: expensive readdir test
                            try { FS.readdir(full); isDir = true } catch (_) { isDir = false }
                        }
                    } catch (_) {
                        // Last resort: expensive readdir test
                        try { FS.readdir(full); isDir = true } catch (_) { isDir = false }
                    }
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

            // PERFORMANCE: Check if we can avoid full filesystem scan
            // Only do full scan if we detect significant changes or it's been a while
            const now = Date.now()
            const lastFullSync = this._lastFullSync || 0
            const FULL_SYNC_INTERVAL = 30000 // 30 seconds
            const shouldDoFullSync = (now - lastFullSync) > FULL_SYNC_INTERVAL

            // Debug: log filesystem size to help diagnose performance issues
            if (window.__ssg_debug_logs) {
                try {
                    const quickCount = listFilesFromFS(FS, '/').length
                    console.log(`[VFS Debug] Filesystem has ${quickCount} files, shouldDoFullSync: ${shouldDoFullSync}`)
                } catch (e) {
                    console.log(`[VFS Debug] Could not count files: ${e.message}`)
                }
            }

            if (shouldDoFullSync) {
                // Full filesystem scan (expensive but comprehensive)
                const files = listFilesFromFS(FS, '/')
                this._lastFullSync = now

                for (const p of files) {
                    try {
                        // Skip known system/runtime paths (devices, proc, temp)
                        // These are created by the runtime (e.g. /dev/null) and
                        // must not be persisted into the backend or snapshots.
                        if (/^\/dev\//i.test(p) || /^\/proc\//i.test(p) || /^\/tmp\//i.test(p) || /^\/temp\//i.test(p)) {
                            if (window.__ssg_debug_logs) try { console.info('[VFS] Skipping system file during syncFromEmscripten:', p) } catch (_e) { }
                            continue
                        }

                        const raw = typeof FS.readFile === 'function' ? FS.readFile(p, { encoding: 'utf8' }) : null
                        const content = raw != null ? decodeToString(raw) : null
                        if (content != null) await this.write(p, content)
                    } catch (e) {
                        if (window.__ssg_debug_logs) {
                            try { const { warn: logWarn } = await import('./logger.js'); logWarn('VFS: sync skip', p, e) } catch (_e) { console.warn('VFS: sync skip', p, e) }
                        }
                    }
                }
            } else {
                // Quick sync: only sync known files that might have changed
                // Focus on commonly modified files like /main.py
                const priorityFiles = ['/main.py', '/output.txt', '/data.txt']

                for (const p of priorityFiles) {
                    try {
                        // Check if file exists before trying to read it
                        try {
                            FS.lookupPath(p)
                        } catch (_) {
                            continue // File doesn't exist, skip
                        }

                        const raw = typeof FS.readFile === 'function' ? FS.readFile(p, { encoding: 'utf8' }) : null
                        const content = raw != null ? decodeToString(raw) : null
                        if (content != null) await this.write(p, content)
                    } catch (e) {
                        // Silently continue for priority files that don't exist
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
        async syncFromEmscripten(FS) {
            if (!FS) return

            // PERFORMANCE: Apply same optimization as IndexedDB backend
            const now = Date.now()
            const lastFullSync = this._lastFullSync || 0
            const FULL_SYNC_INTERVAL = 30000 // 30 seconds
            const shouldDoFullSync = (now - lastFullSync) > FULL_SYNC_INTERVAL

            if (shouldDoFullSync) {
                const files = listFilesFromFS(FS, '/')
                this._lastFullSync = now
                for (const p of files) {
                    try {
                        // Skip known system/runtime paths (devices, proc, temp)
                        if (/^\/dev\//i.test(p) || /^\/proc\//i.test(p) || /^\/tmp\//i.test(p) || /^\/temp\//i.test(p)) {
                            if (window.__ssg_debug_logs) try { console.info('[VFS] Skipping system file during local syncFromEmscripten:', p) } catch (_e) { }
                            continue
                        }

                        const content = typeof FS.readFile === 'function' ? FS.readFile(p, { encoding: 'utf8' }) : null
                        if (content != null) await this.write(p, content)
                    } catch (e) {
                        console.warn('VFS: sync skip', p, e)
                    }
                }
            } else {
                // Quick sync of priority files only
                const priorityFiles = ['/main.py', '/output.txt', '/data.txt']
                for (const p of priorityFiles) {
                    try {
                        try { FS.lookupPath(p) } catch (_) { continue }
                        const content = typeof FS.readFile === 'function' ? FS.readFile(p, { encoding: 'utf8' }) : null
                        if (content != null) await this.write(p, content)
                    } catch (e) { /* silently continue */ }
                }
            }
        }
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
