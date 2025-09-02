// File management and VFS integration (client-facing)
import { $ } from './utils.js'
import { appendTerminal, appendTerminalDebug } from './terminal.js'
import { safeSetItem } from './storage-manager.js'

// Name of the protected main program file (normalized)
export const MAIN_FILE = '/main.py'

// VFS runtime references (populated during async VFS init)
let backendRef = null
let mem = null

// Expose a promise that resolves when the VFS/mem/backend has been initialized
let vfsReadyResolve = null
let vfsReadyReject = null
let vfsReadySettled = false
window.__ssg_vfs_ready = new Promise((res, rej) => {
    vfsReadyResolve = res
    vfsReadyReject = rej
})

// Helper to settle the global VFS-ready promise when runtime FS becomes available
function resolveVFSReady(backend, memRef) {
    if (vfsReadySettled) return
    vfsReadySettled = true
    backendRef = backend
    mem = memRef
    setupNotificationSystem()
    if (vfsReadyResolve) vfsReadyResolve({ backend, mem })
}

// Function to manually settle VFS ready promise
function settleVfsReady() {
    if (vfsReadySettled) return
    vfsReadySettled = true
    if (vfsReadyResolve) vfsReadyResolve({ backend: backendRef, mem })
}

/**
 * Set up file change notification system
 */
function setupNotificationSystem() {
    // Initialize expected writes tracking
    if (!window.__ssg_expected_writes) {
        window.__ssg_expected_writes = new Map()
    }

    // expose a global notifier the UI side will implement
    window.__ssg_notify_file_written = window.__ssg_notify_file_written || (function () {
        // debounce rapid notifications per-path to avoid notifier->UI->save->notifier loops
        const lastNotified = new Map()
        const DEBOUNCE_MS = 120
        return function (path, content) {
            try {
                // global suppress guard: if set, ignore runtime-originated notifications
                try {
                    if (window.__ssg_suppress_notifier) {
                        try { appendTerminalDebug && appendTerminalDebug('[notify] globally suppressed: ' + String(path)) } catch (_e) { }
                        return
                    }
                } catch (_e) { }
                if (typeof path !== 'string') return
                const n = '/' + path.replace(/^\/+/, '')

                // debounce duplicates
                try {
                    const prev = lastNotified.get(n) || 0
                    const now = Date.now()
                    if (now - prev < DEBOUNCE_MS) return
                    lastNotified.set(n, now)
                } catch (_e) { }

                // If this notification matches an expected write we performed recently,
                // consume it and skip further UI processing to avoid echo loops.
                try {
                    if (consumeExpectedWriteIfMatches(n, content)) {
                        try { appendTerminalDebug && appendTerminalDebug('[notify] ignored expected write: ' + n) } catch (_e) { }
                        return
                    }
                } catch (_e) { }

                // Log the notification only to debug logs (avoid noisy terminal output)
                try { appendTerminalDebug('notify: ' + n) } catch (_e) { }

                // update mem and localStorage mirror for tests and fallbacks (always keep mem in sync)
                try { if (typeof mem !== 'undefined') { mem[n] = content } } catch (_e) { }
                try {
                    const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}')
                    map[n] = content
                    const result = safeSetItem('ssg_files_v1', JSON.stringify(map))
                    if (!result.success) {
                        console.warn('Failed to update localStorage mirror:', result.error)
                    }
                } catch (_e) { }

                // Queue the path for the UI to open later via the existing pending-tabs flow.
                // Avoid calling TabManager.openTab/refresh directly from here to prevent
                // write->notify->UI-write recursion and timing races. The UI reload/sync
                // logic will process `__ssg_pending_tabs` and open tabs at a safe point.
                try {
                    if (n !== MAIN_FILE) {
                        try { window.__ssg_pending_tabs = (window.__ssg_pending_tabs || []).concat([n]) } catch (_e) { }
                    }
                } catch (_e) { }

                // Ensure the pending list is deduplicated but keep entries for the UI to consume.
                try { window.__ssg_pending_tabs = Array.from(new Set(window.__ssg_pending_tabs || [])) } catch (_e) { }
                try { setTimeout(() => { try { flushPendingTabs() } catch (_e) { } }, 10) } catch (_e) { }
            } catch (_e) { }
        }
    })()
}

/**
 * Flush pending tabs (should be called by tab manager)
 */
function flushPendingTabs() {
    // This will be implemented by the tab manager
    try {
        if (window.TabManager && typeof window.TabManager.flushPendingTabs === 'function') {
            window.TabManager.flushPendingTabs()
        }
    } catch (_e) { }
}

/**
 * Check if a write matches an expected write and consume it if so
 */
function consumeExpectedWriteIfMatches(path, content) {
    try {
        const map = window.__ssg_expected_writes
        if (map && typeof map.get === 'function') {
            const rec = map.get(path)
            if (rec && String(rec.content || '') === String(content || '')) {
                map.delete(path)
                return true
            }
        }
    } catch (_e) { }
    return false
}

// Track expected writes we performed into the runtime FS
try { window.__ssg_expected_writes = window.__ssg_expected_writes || new Map() } catch (_e) { }

function _normPath(p) {
    if (!p) return p
    return p.startsWith('/') ? p : ('/' + p)
}

export function markExpectedWrite(p, content) {
    try {
        const n = _normPath(p)
        window.__ssg_expected_writes.set(n, { content: String(content || ''), ts: Date.now() })
    } catch (_e) { }
}

// Simple FileManager shim (localStorage-backed initially)
let FileManager = {
    key: 'ssg_files_v1',
    _load() {
        try {
            return JSON.parse(localStorage.getItem(this.key) || '{}')
        } catch (e) {
            return {}
        }
    },
    _save(m) {
        const result = safeSetItem(this.key, JSON.stringify(m))
        if (!result.success) {
            throw new Error(result.error || 'Storage quota exceeded')
        }
    },
    _norm(p) { if (!p) return p; return p.startsWith('/') ? p : ('/' + p) },

    list() { return Object.keys(this._load()).sort() },
    read(path) {
        const m = this._load()
        return m[this._norm(path)] || null
    },
    write(path, content) {
        const m = this._load()
        m[this._norm(path)] = content
        this._save(m)
        return Promise.resolve()
    },
    delete(path) {
        if (this._norm(path) === MAIN_FILE) {
            console.warn('Attempt to delete protected main file ignored:', path)
            return Promise.resolve()
        }
        const m = this._load()
        delete m[this._norm(path)]
        this._save(m)
        return Promise.resolve()
    }
}

// Convenience helper: wait for a file to appear in mem/runtime/backend
window.waitForFile = async function (path, timeoutMs = 2000) {
    const n = path && path.startsWith('/') ? path : ('/' + path)
    const start = Date.now()
    const td = new TextDecoder()

    while (Date.now() - start < timeoutMs) {
        try {
            // check mem first (synchronous)
            if (mem && Object.prototype.hasOwnProperty.call(mem, n)) return mem[n]
        } catch (_e) { }

        try {
            const fs = window.__ssg_runtime_fs
            if (fs) {
                try {
                    if (typeof fs.readFile === 'function') {
                        const data = fs.readFile(n)
                        if (data !== undefined) return (typeof data === 'string') ? data : td.decode(data)
                    } else if (typeof fs.readFileSync === 'function') {
                        const data = fs.readFileSync(n)
                        if (data !== undefined) return (typeof data === 'string') ? data : td.decode(data)
                    }
                } catch (_e) { }
            }
        } catch (_e) { }

        try {
            if (backendRef && typeof backendRef.read === 'function') {
                const d = await backendRef.read(n).catch(() => null)
                if (d != null) return d
            }
        } catch (_e) { }

        await new Promise(r => setTimeout(r, 120))
    }
    throw new Error('waitForFile timeout: ' + path)
}

// Initialize VFS system
export async function initializeVFS(cfg) {
    // Setup notification system immediately
    setupNotificationSystem()

    // Expose the local FileManager immediately so tests and early scripts can access it
    try { window.FileManager = FileManager } catch (e) { }

    // Ensure MAIN_FILE exists with starter content
    if (!FileManager.read(MAIN_FILE)) {
        FileManager.write(MAIN_FILE, cfg?.starter || '# main program (auto-created)\n')
    }

    // Try to initialize real VFS backend (IndexedDB preferred) and migrate existing local files
    try {
        const vfsMod = await import('./vfs-backend.js')
        const backend = await vfsMod.init()
        backendRef = backend

        // migrate existing localStorage-based files into backend if missing
        const localFiles = FileManager.list()
        for (const p of localFiles) {
            try {
                const existing = await backend.read(p)
                if (existing == null) {
                    await backend.write(p, FileManager.read(p))
                }
            } catch (e) { /* ignore per-file errors */ }
        }

        // build an in-memory snapshot adapter
        mem = {}
        try {
            const names = await backend.list()
            for (const n of names) {
                try {
                    mem[n] = await backend.read(n)
                } catch (e) {
                    mem[n] = null
                }
            }
        } catch (e) { /* ignore if list/read fail */ }

        // Expose mem for debugging/tests
        try {
            window.__ssg_mem = mem
            window.mem = mem
        } catch (_e) { }

        // Replace FileManager with backend-integrated version
        FileManager = {
            list() { return Object.keys(mem).sort() },
            read(path) {
                const n = path && path.startsWith('/') ? path : ('/' + path)
                return mem[n] || null
            },
            write(path, content) {
                const n = path && path.startsWith('/') ? path : ('/' + path)
                const prev = mem[n]

                // If content didn't change, return early
                try { if (prev === content) return Promise.resolve() } catch (_e) { }

                // update in-memory copy first
                mem[n] = content

                // update localStorage mirror for tests and fallbacks
                try {
                    const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}')
                    map[n] = content
                    const result = safeSetItem('ssg_files_v1', JSON.stringify(map))
                    if (!result.success) {
                        console.warn('Failed to update localStorage mirror:', result.error)
                    }
                } catch (_e) { }

                return backend.write(n, content).catch(e => {
                    console.error('VFS write failed', e)
                    throw e
                })
            },
            delete(path) {
                const n = path && path.startsWith('/') ? path : ('/' + path)
                if (n === MAIN_FILE) {
                    console.warn('Attempt to delete protected main file ignored:', path)
                    return Promise.resolve()
                }

                delete mem[n]

                try {
                    const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}')
                    delete map[n]
                    const result = safeSetItem('ssg_files_v1', JSON.stringify(map))
                    if (!result.success) {
                        console.warn('Failed to update localStorage mirror:', result.error)
                    }
                } catch (_e) { }

                // also attempt to remove from interpreter FS
                try {
                    const fs = window.__ssg_runtime_fs
                    if (fs) {
                        try {
                            if (typeof fs.unlink === 'function') fs.unlink(n)
                            else if (typeof fs.unlinkSync === 'function') fs.unlinkSync(n)
                        } catch (_e) { }
                    }
                } catch (_e) { }

                return backend.delete(n).catch(e => {
                    console.error('VFS delete failed', e)
                    throw e
                })
            }
        }

        appendTerminalDebug('VFS backend initialized successfully')
    } catch (e) {
        appendTerminalDebug('VFS init failed, using localStorage FileManager: ' + e)
    }

    // Update the global FileManager reference
    try { window.FileManager = FileManager } catch (e) { }

    // Expose VFS backend for tests  
    try { window.__ssg_vfs_backend = backendRef } catch (e) { }

    // Settle VFS ready promise
    try { settleVfsReady() } catch (_e) { }

    return { FileManager, backend: backendRef, mem }
}

// Export FileManager getter
export function getFileManager() {
    return FileManager
}

export function getBackendRef() {
    return backendRef
}

export function getMem() {
    return mem
}

export { settleVfsReady }
