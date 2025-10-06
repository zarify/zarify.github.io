// File management and VFS integration (client-facing)
import { $ } from './utils.js'
import { appendTerminal, appendTerminalDebug } from './terminal.js'
import { warn as logWarn, error as logError, info as logInfo } from './logger.js'
import { safeSetItem } from './storage-manager.js'

// Global flag to allow system operations to bypass read-only restrictions
let systemWriteMode = false

// Helper: normalize a path for display to the user (strip any leading slashes)
function _displayPathForUser(path) {
    try {
        if (path == null) return String(path)
        return String(path).replace(/^\/+/g, '')
    } catch (_e) { return String(path) }
}

// Allow system operations to temporarily bypass read-only restrictions.
// This is exported so callers (execution flows, snapshots, tests) can
// enable system-write mode while performing controlled backend writes.
export function setSystemWriteMode(enabled) {
    systemWriteMode = !!enabled
    try { if (typeof window !== 'undefined') window.__ssg_system_write_mode = !!enabled } catch (_e) { }
}

// Helper to check if a file is read-only (excluding system operations)
function isFileReadOnlyForUserWrite(path) {
    try {
        // Allow system operations to bypass read-only restrictions
        if (systemWriteMode) return false

        // Get current config from global state
        const config = (typeof window !== 'undefined' && window.currentConfig) || null
        if (!config || !config.fileReadOnlyStatus) return false

        const normalizedPath = path.startsWith('/') ? path : `/${path}`
        return !!(config.fileReadOnlyStatus[normalizedPath] || config.fileReadOnlyStatus[normalizedPath.replace(/^\/+/, '')])
    } catch (_e) {
        return false
    }
}

function scheduleMirrorDelete(path, host = window) {
    try {
        if (typeof window !== 'undefined' && window.indexedDB) {
            import('./unified-storage.js').then(mod => {
                try { if (mod && typeof mod.deleteFile === 'function') mod.deleteFile(path).catch(() => { }) } catch (_e) { }
            }).catch(() => { /* ignore import failures */ })
            return { success: true }
        }

        try {
            const map = JSON.parse((host.localStorage.getItem('ssg_files_v1') || '{}'))
            delete map[path]
            const result = safeSetItem('ssg_files_v1', JSON.stringify(map))
            if (!result.success) logWarn('Failed to update localStorage mirror:', result.error)
            return result
        } catch (err) {
            return { success: false, error: err && err.message }
        }
    } catch (e) {
        return { success: false, error: e && e.message }
    }
}

// Main file path used across the app (protected, not deletable)
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
                        return
                    }
                } catch (_e) { }

                // Log the notification only to debug logs (avoid noisy terminal output)
                // notification: path written -> UI will handle enqueueing/opening

                // update mem and localStorage mirror for tests and fallbacks (always keep mem in sync)
                try {
                    if (typeof mem !== 'undefined') {
                        if (content == null) {
                            try { delete mem[n] } catch (_e) { }
                        } else {
                            mem[n] = content
                        }
                    }
                } catch (_e) { }
                try {
                    if (content == null) scheduleMirrorDelete(n)
                    else scheduleMirrorSave(n, content)
                } catch (_e) { }

                // If this was a deletion, inform the TabManager to close any open tab
                try {
                    if (content == null) {
                        try {
                            if (window.TabManager && typeof window.TabManager.closeTabSilent === 'function') {
                                try { window.TabManager.closeTabSilent(n) } catch (_e) { }
                            }
                            if (window.TabManager && typeof window.TabManager.syncWithFileManager === 'function') {
                                try { window.TabManager.syncWithFileManager() } catch (_e) { }
                            }
                        } catch (_e) { }
                    }
                } catch (_e) { }

                // Queue the path for the UI to open later via the existing pending-tabs flow,
                // but only for actual file writes (content != null) and only for valid Python files.
                // Filter out system files, temporary files, and non-.py files
                try {
                    if (n !== MAIN_FILE && content != null) {
                        // Only add Python files (.py or .txt) to pending tabs
                        // Exclude: /dev/*, traceback files, files without extensions, etc.
                        const isPythonFile = /\.py$/i.test(n)
                        const isTextFile = /\.txt$/i.test(n)
                        const isSystemFile = /^\/dev\//i.test(n) || /^\/tmp\//i.test(n) || /^\/temp\//i.test(n)
                        const looksLikeTraceback = /traceback/i.test(n) || /KeyboardInterrupt/i.test(n) || n.includes('File ""')

                        if ((isPythonFile || isTextFile) && !isSystemFile && !looksLikeTraceback) {
                            try { window.__ssg_pending_tabs = (window.__ssg_pending_tabs || []).concat([n]) } catch (_e) { }
                        } else if (looksLikeTraceback) {
                            // Log that we're blocking a traceback file
                            try { appendTerminalDebug('[vfs] Blocking traceback file from pending tabs: ' + n.substring(0, 100)) } catch (_e) { }
                        }
                    }
                } catch (_e) { }                // Ensure the pending list is deduplicated but keep entries for the UI to consume.
                try { window.__ssg_pending_tabs = Array.from(new Set(window.__ssg_pending_tabs || [])) } catch (_e) { }
                try { setTimeout(() => { try { flushPendingTabs() } catch (_e) { } }, 10) } catch (_e) { }
            } catch (_e) { }
        }
    })()
}

// Test-friendly factory: set up notification system on a provided host object
// Returns the notifier function that was installed on the host.
export function createNotificationSystem(host = window) {
    try {
        // Initialize expected writes tracking
        if (!host.__ssg_expected_writes) {
            host.__ssg_expected_writes = new Map()
        }

        // expose a global notifier the UI side will implement
        host.__ssg_notify_file_written = host.__ssg_notify_file_written || (function () {
            const lastNotified = new Map()
            const DEBOUNCE_MS = 120
            return function (path, content) {
                try {
                    try {
                        if (host.__ssg_suppress_notifier) {
                            return
                        }
                    } catch (_e) { }
                    if (typeof path !== 'string') return
                    const n = '/' + path.replace(/^\/+/, '')

                    try {
                        const prev = lastNotified.get(n) || 0
                        const now = Date.now()
                        if (now - prev < DEBOUNCE_MS) return
                        lastNotified.set(n, now)
                    } catch (_e) { }

                    try {
                        if (consumeExpectedWriteIfMatchesHost(n, content, host)) {
                            return
                        }
                    } catch (_e) { }

                    // notification: path written - consumed or forwarded to UI

                    try {
                        if (typeof mem !== 'undefined') {
                            if (content == null) {
                                try { delete mem[n] } catch (_e) { }
                            } else {
                                mem[n] = content
                            }
                        }
                    } catch (_e) { }
                    try {
                        if (content == null) scheduleMirrorDelete(n, host)
                        else scheduleMirrorSave(n, content, host)
                    } catch (_e) { }

                    // If this was a deletion, instruct the TabManager on the host
                    // to close any associated tab and sync state.
                    try {
                        if (content == null) {
                            try {
                                if (host && host.TabManager && typeof host.TabManager.closeTabSilent === 'function') {
                                    try { host.TabManager.closeTabSilent(n) } catch (_e) { }
                                }
                                if (host && host.TabManager && typeof host.TabManager.syncWithFileManager === 'function') {
                                    try { host.TabManager.syncWithFileManager() } catch (_e) { }
                                }
                            } catch (_e) { }
                        }
                    } catch (_e) { }

                    try { host.__ssg_pending_tabs = Array.from(new Set(host.__ssg_pending_tabs || [])) } catch (_e) { }
                    try { setTimeout(() => { try { flushPendingTabs() } catch (_e) { } }, 10) } catch (_e) { }
                } catch (_e) { }
            }
        })()
        return host.__ssg_notify_file_written
    } catch (e) {
        return null
    }
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

function consumeExpectedWriteIfMatchesHost(path, content, host) {
    try {
        const map = host.__ssg_expected_writes
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

// Safe decoder for Uint8Array / ArrayBuffer values returned by some FS implementations
function safeDecode(buf) {
    if (buf == null) return buf
    try {
        if (typeof buf === 'string') return buf
        if (buf instanceof ArrayBuffer) buf = new Uint8Array(buf)
        if (ArrayBuffer.isView(buf)) {
            if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(buf)
            try {
                // Node fallback
                // eslint-disable-next-line no-restricted-globals
                const util = typeof require === 'function' ? require('util') : null
                if (util && util.TextDecoder) return new util.TextDecoder('utf-8').decode(buf)
            } catch (_e) { }
            try { return Buffer.from(buf).toString('utf8') } catch (_e) { return String(buf) }
        }
        return String(buf)
    } catch (e) { return String(buf) }
}

export function markExpectedWrite(p, content, host = window) {
    try {
        const n = _normPath(p)
        host.__ssg_expected_writes = host.__ssg_expected_writes || new Map()
        host.__ssg_expected_writes.set(n, { content: String(content || ''), ts: Date.now() })
    } catch (_e) { }
}

// Simple FileManager shim (localStorage-backed initially) created via factory
let FileManager = createFileManager(window)

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

    // Expose MAIN_FILE existence will be ensured after backend init to avoid
    // writing the legacy localStorage mirror synchronously during page load.

    // Try to initialize real VFS backend (IndexedDB preferred) and migrate existing local files
    try {
        const vfsMod = await import('./vfs-backend.js')
        const backend = await vfsMod.init()
        backendRef = backend

        // Ensure MAIN_FILE exists using the initialized backend (so we avoid
        // creating the legacy localStorage mirror synchronously on page load).
        try {
            setSystemWriteMode(true)
            const existingMain = await backend.read(MAIN_FILE).catch(() => null)
            if (existingMain == null) {
                await backend.write(MAIN_FILE, cfg?.starter || '# main program (auto-created)\n')
            }

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
        } catch (_e) { /* ignore backend write failures */ }
        finally {
            setSystemWriteMode(false)
        }

        // build an in-memory snapshot adapter
        mem = {}
        try {
            const names = await backend.list()
            for (const n of names) {
                try {
                    // Skip known runtime/system paths that may have been
                    // persisted by older versions (e.g. /dev/null from the
                    // interpreter). Prevent loading them into the in-memory
                    // mirror so tabs are not opened for these pseudo-files.
                    if (/^\/dev\//i.test(n) || /^\/proc\//i.test(n) || /^\/tmp\//i.test(n) || /^\/temp\//i.test(n)) {
                        if (window.__ssg_debug_logs) try { console.info('[VFS] Skipping persisted system file when populating mem:', n) } catch (_e) { }
                        continue
                    }
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
                try {
                    const n = _normPath(path)
                    const v = mem[n]
                    return v == null ? null : v
                } catch (_e) { return null }
            },
            write(path, content) {
                try {
                    const n = _normPath(path)

                    // Check for read-only protection (user writes only)
                    if (isFileReadOnlyForUserWrite(n)) {
                        logWarn('Attempt to write to read-only file ignored:', path)
                        return Promise.resolve()
                    }

                    if (n === MAIN_FILE && (content == null || content === '')) {
                        // protect main file from being cleared accidentally
                        logWarn('Attempt to clear protected main file ignored:', path)
                        return Promise.resolve()
                    }

                    const prev = mem[n]
                    // If content didn't change, return early
                    try { if (prev === content) return Promise.resolve() } catch (_e) { }

                    // update in-memory copy first
                    mem[n] = content

                    // update localStorage mirror for tests and fallbacks
                    try {
                        scheduleMirrorSave(n, content)
                    } catch (_e) { }

                    // mark expected write so the notifier can ignore the echo
                    try { markExpectedWrite(n, content) } catch (_e) { }

                    return backend.write(n, content).then(res => {
                        try { // notify host about write
                            try { if (typeof window.__ssg_notify_file_written === 'function') window.__ssg_notify_file_written(n, content) } catch (_e) { }
                        } catch (_e) { }
                        return res
                    }).catch(e => {
                        logError('VFS write failed', e)
                        throw e
                    })
                } catch (e) { return Promise.reject(e) }
            },
            delete(path) {
                try {
                    const n = _normPath(path)
                    if (n === MAIN_FILE) {
                        logWarn('Attempt to delete protected main file ignored:', path)
                        return Promise.resolve()
                    }

                    // Block deletion of read-only files for user-initiated deletes
                    try {
                        if (isFileReadOnlyForUserWrite(n)) {
                            logWarn('Attempt to delete read-only file blocked:', n)
                            const err = new Error('Permission denied: read-only file ' + _displayPathForUser(n))
                            err.errno = 13
                            return Promise.reject(err)
                        }
                    } catch (_e) { }

                    delete mem[n]

                    try {
                        scheduleMirrorDelete(n)
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

                    return backend.delete(n).then(res => {
                        try { if (typeof window.__ssg_notify_file_written === 'function') window.__ssg_notify_file_written(n, null) } catch (_e) { }
                        return res
                    }).catch(e => {
                        logError('VFS delete failed', e)
                        throw e
                    })
                } catch (e) { return Promise.reject(e) }
            }
        }

        // VFS backend initialized
    } catch (e) {
        // VFS init failed, using localStorage FileManager
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

// Create a FileManager bound to a host object (defaults to window). Useful for tests.
export function createFileManager(host = window) {
    const KEY = 'ssg_files_v1'

    function _load() {
        try {
            // Prefer an in-memory unified-storage mirror if present (used in some tests)
            try {
                const memVal = (host.__ssg_unified_inmemory && host.__ssg_unified_inmemory[KEY]) || null
                if (memVal) return memVal
            } catch (_e) { }
            return JSON.parse(host.localStorage.getItem(KEY) || '{}')
        } catch (e) { return {} }
    }

    function _save(m) {
        // In modern browsers with IndexedDB available, avoid writing the
        // legacy localStorage mirror from this synchronous factory. The
        // unified storage system or the async backend will persist files.
        // Only perform localStorage writes when IndexedDB is not present
        // (tests or very old browsers).
        try {
            if (typeof window !== 'undefined' && window.indexedDB) {
                // Keep an in-memory copy for any immediate synchronous reads
                // within the same JS context (some tests may inspect this).
                try { host.__ssg_unified_inmemory = host.__ssg_unified_inmemory || {}; host.__ssg_unified_inmemory[KEY] = m } catch (_e) { }
                return
            }
        } catch (_e) { }

        const result = safeSetItem(KEY, JSON.stringify(m))
        if (!result.success) throw new Error(result.error || 'Storage quota exceeded')
    }

    function _norm(p) { if (!p) return p; return p.startsWith('/') ? p : ('/' + p) }

    return {
        key: KEY,
        list() { try { return Object.keys(_load()).sort() } catch (e) { return [] } },
        read(path) { try { const m = _load(); const v = m[_norm(path)]; return v == null ? null : v } catch (e) { return null } },
        write(path, content) {
            try {
                const n = _norm(path)

                // Check for read-only protection (user writes only)
                if (isFileReadOnlyForUserWrite(n)) {
                    logWarn('Attempt to write to read-only file ignored:', path)
                    return Promise.resolve()
                }

                const m = _load()
                m[n] = content
                _save(m)
                return Promise.resolve()
            } catch (e) { return Promise.reject(e) }
        },
        delete(path) {
            try {
                const n = _norm(path)
                if (n === MAIN_FILE) {
                    try { logWarn('Attempt to delete protected main file ignored:', path) } catch (_e) { }
                    return Promise.resolve()
                }

                // Block deletion of read-only files for user-initiated deletes
                try {
                    if (isFileReadOnlyForUserWrite(n)) {
                        try { logWarn('Attempt to delete read-only file blocked:', n) } catch (_e) { }
                        const err = new Error('Permission denied: read-only file ' + _displayPathForUser(n))
                        err.errno = 13
                        return Promise.reject(err)
                    }
                } catch (_e) { }

                const m = _load()
                delete m[_norm(path)]
                _save(m)
                return Promise.resolve()
            } catch (e) { return Promise.reject(e) }
        }
    }
}

// Lightweight factory returning helpers scoped for testing or multiple instances.
export function createVfsClient(options = {}) {
    const host = options.host || window
    return {
        createNotificationSystem: (h = host) => createNotificationSystem(h),
        createFileManager: (h = host) => createFileManager(h),
        markExpectedWrite: (p, c, h = host) => markExpectedWrite(p, c, h),
        // expose some of the existing module API for convenience
        initializeVFS: (cfg) => initializeVFS(cfg),
        getFileManager: () => getFileManager(),
        getBackendRef: () => getBackendRef(),
        getMem: () => getMem(),
        settleVfsReady: () => settleVfsReady()
    }
}
