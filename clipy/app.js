// Main application orchestrator - lightweight modular structure
// This replaces the monolithic main.js with organized, maintainable modules

// Core utilities and configuration
import { loadConfig, initializeInstructions, getConfig, getConfigIdentity, getConfigKey, validateAndNormalizeConfig, fetchAvailableServerConfigs, loadConfigFromStringOrUrl, loadConfigFromFile, setCurrentConfig, saveCurrentConfig, loadCurrentConfig, clearCurrentConfig, isConfigCompatibleWithSnapshot, debugCurrentConfig } from './js/config.js'
import { $ } from './js/utils.js'
// Zero-knowledge verification system
import { getStudentIdentifier, setStudentIdentifier } from './js/zero-knowledge-verification.js'

import { openModal, closeModal } from './js/modals.js'

// Terminal and UI
import { initializeTerminal, setupSideTabs, setupClearTerminalButton } from './js/terminal.js'
import { initializeEditor } from './js/editor.js'
import { initializeAutosave } from './js/autosave.js'

// File and tab management  
import { initializeVFS, MAIN_FILE } from './js/vfs-client.js'
import { initializeTabManager } from './js/tabs.js'

// Runtime and execution
import {
    loadMicroPythonRuntime,
    setupMicroPythonAPI,
    setupStopButton,
    setupKeyboardInterrupt
} from './js/micropython.js'
import { runPythonCode } from './js/execution.js'
import { runTests } from './js/test-runner.js'
import { setupInputHandling } from './js/input-handling.js'

import { debug as logDebug, info as logInfo, warn as logWarn, error as logError, setDebug as setLogDebug } from './js/logger.js'

// Code transformation 
import { transformAndWrap, highlightMappedTracebackInEditor, highlightFeedbackLine, clearAllErrorHighlights, clearAllFeedbackHighlights } from './js/code-transform.js'

// Additional features
import { setupSnapshotSystem } from './js/snapshots.js'
import { setupDownloadSystem } from './js/download.js'
import { showStorageInfo } from './js/storage-manager.js'
import { resetFeedback, evaluateFeedbackOnEdit, evaluateFeedbackOnRun, on as feedbackOn, off as feedbackOff } from './js/feedback.js'
import { initializeFeedbackUI, setFeedbackMatches, setFeedbackConfig } from './js/feedback-ui.js'

// Record/Replay debugging system
import { initializeExecutionRecorder } from './js/execution-recorder.js'
import { initializeReplaySystem } from './js/replay-ui.js'

// Startup debug helper - enable by setting `window.__ssg_debug_startup = true`
try {
    if (typeof window !== 'undefined') {
        window.__ssg_debug_startup = window.__ssg_debug_startup || false
    }
} catch (_e) { }

// Watcher: if a remote config list is assigned later at runtime, ensure we
// create the header select. This handles the case where other startup code
// sets `window.__ssg_remote_config_list` after this module evaluated.
try {
    if (typeof window !== 'undefined') {
        let watchAttempts = 0
        const maxWatchAttempts = 60 // ~6s
        const watchInterval = setInterval(() => {
            try {
                watchAttempts++
                const remote = window.__ssg_remote_config_list
                const existing = document.getElementById('config-select-header')
                if (remote && Array.isArray(remote.items) && !existing) {
                    const serverItems = remote.items.map((it, i) => ({ label: typeof it === 'string' ? it : (it.label || String(it)), value: '__list::' + i }))
                    try { createOrUpdateHeaderSelect(serverItems, true) } catch (_e) { }
                    clearInterval(watchInterval)
                    return
                }
                if (watchAttempts >= maxWatchAttempts) clearInterval(watchInterval)
            } catch (_e) {
                try { clearInterval(watchInterval) } catch (_err) { }
            }
        }, 100)
    }
} catch (_e) { }

function dbg(...args) {
    try {
        if (typeof window !== 'undefined' && window.__ssg_debug_startup) {
            // Prefer centralized debug when global debug is enabled, otherwise
            // fall back to console.log for the special startup flag so
            // developers can enable early startup logging independently.
            try {
                if (typeof window !== 'undefined' && window.__SSG_DEBUG) {
                    logDebug(...args)
                } else {
                    console.log(...args)
                }
            } catch (_e) {
                try { console.log(...args) } catch (_e2) { }
            }
        }
    } catch (_e) { }
}

// Main initialization function
async function main() {
    try {
        logInfo('🚀 Initializing Clipy application...')
        // Suppress automatic terminal auto-switching during startup
        try { if (typeof window !== 'undefined') window.__ssg_suppress_terminal_autoswitch = true } catch (_e) { }

        // 0. Migrate existing localStorage data to unified storage
        try {
            const { migrateFromLocalStorage, initUnifiedStorage } = await import('./js/unified-storage.js')
            await initUnifiedStorage()
            await migrateFromLocalStorage()
            logInfo('Storage migration completed')
        } catch (e) {
            logWarn('Storage migration failed (continuing anyway):', e)
        }

        // 1. Load configuration
        // Priority order:
        // 1. URL ?config= parameter (overrides everything)
        // 2. Default sample config
        //
        // NOTE: Previously the app attempted to automatically restore the "last
        // loaded" config from unified storage (or from a saved remote config
        // list). That automatic restore caused incorrect fetches and 404s when
        // the saved value referenced local authoring resources or remote lists
        // that should not be implicitly loaded. To avoid these edge cases the
        // automatic restore behavior has been removed: the app will only load
        // a config provided via the `?config=` URL parameter, or fall back to
        // the default server-provided sample config. Selections are still
        // persisted for convenience, but they are no longer auto-applied on
        // startup.
        // Helper: resolve a list item path relative to a list URL.
        // Behavior:
        // - If `item` is an absolute URL (starts with http or //), return it unchanged.
        // - If `item` starts with './' or '/' resolve it against the list URL's base.
        // - If the list URL is remote (http/https) and `item` is a plain filename,
        //   resolve it relative to the list URL so remote lists fetch from the
        //   originating host. If the list URL is local, leave plain filenames
        //   unchanged so the centralized loader can treat them as local names.
        function resolveListItemPath(item, listUrl) {
            try {
                if (!item) return item
                const s = String(item)
                if (/^(https?:)?\/\//i.test(s)) return s
                if (!listUrl) return s
                const base = listUrl.endsWith('/') ? listUrl : listUrl.replace(/[^/]*$/, '')
                const listIsRemote = /^(https?:)?\/\//i.test(listUrl)
                if (s.startsWith('./') || s.startsWith('/')) {
                    try { return new URL(s, base).href } catch (_e) { return s }
                }
                if (listIsRemote) {
                    try { return new URL(s, base).href } catch (_e) { return s }
                }
                // Local list and plain filename: return unchanged and let centralized loader handle it
                return s
            } catch (_e) {
                return item
            }
        }

        let cfg = null
        try {
            if (typeof window !== 'undefined') {
                try {
                    const params = new URLSearchParams(window.location.search)
                    const cfgParam = params.get('config')
                    // Single ?config parameter: may point to either a single config JSON,
                    // or a config-list resource (array or object with files/listName). Detect by fetching.
                    if (cfgParam) {
                        try {
                            let toLoad = cfgParam
                            try { toLoad = decodeURIComponent(cfgParam) } catch (_e) { }
                            // Resolve only explicit relative paths to an absolute URL.
                            // If the param is a plain filename (e.g. `printing-press.json`),
                            // leave it as-is and let `loadConfigFromStringOrUrl` map it to
                            // `./config/<name>`. This prevents treating filenames as
                            // root-relative URLs (which caused 404s).
                            try {
                                if (!/^(https?:)?\/\//i.test(toLoad)) {
                                    if (toLoad.startsWith('./') || toLoad.startsWith('/')) {
                                        try { toLoad = new URL(toLoad, window.location.href).href } catch (_e) { }
                                    } else {
                                        // Plain filename: do not convert to a page-relative URL.
                                    }
                                }
                            } catch (_e) { }

                            // If this looks like a plain filename (no URL and not an
                            // explicit relative path), delegate to the centralized
                            // loader which will fetch from `./config/<name>`.
                            if (!/^(https?:)?\/\//i.test(toLoad) && !toLoad.startsWith('./') && !toLoad.startsWith('/')) {
                                try {
                                    const normalized = await loadConfigFromStringOrUrl(toLoad)
                                    cfg = normalized
                                    try { if (typeof window !== 'undefined') window.__ssg_explicit_single_config = true } catch (_e) { }
                                    dbg('dbg: loaded config from ?config parameter (plain filename)')
                                } catch (e) {
                                    logWarn('Failed to load config from ?config= parameter (plain filename):', e)
                                    try { showConfigError('Failed to load configuration: ' + (e && e.message ? e.message : e), document.getElementById('config-modal')) } catch (_e) { }
                                }
                            } else {
                                const r = await fetch(toLoad)
                                if (r && r.ok) {
                                    const raw = await r.json()
                                    // Only treat as remote list if the resource is the new object shape with `files`
                                    if (raw && typeof raw === 'object' && Array.isArray(raw.files)) {
                                        const items = raw.files
                                        const listName = raw.listName ? String(raw.listName) : null
                                        window.__ssg_remote_config_list = { url: toLoad, items: items, listName }
                                        try { if (typeof window !== 'undefined') delete window.__ssg_explicit_single_config } catch (_e) { }
                                        if (items && items.length > 0) {
                                            let first = items[0]
                                            try {
                                                first = resolveListItemPath(first, toLoad)
                                            } catch (_e) { }
                                            try {
                                                const normalized = await loadConfigFromStringOrUrl(first)
                                                cfg = normalized
                                                // Mark that we successfully loaded the first item from
                                                // the remote config list so the UI can reflect the
                                                // origin and pre-select the corresponding dropdown
                                                // entry (e.g. '__list::0').
                                                try { window.__ssg_loaded_from_list_index = 0 } catch (_e2) { }
                                                try {
                                                    if (window.__ssg_remote_config_list) window.__ssg_remote_config_list.loadedIndex = 0
                                                } catch (_e3) { }
                                                dbg('dbg: loaded first config from ?config (list resource)')
                                            } catch (e) {
                                                logWarn('Failed to load first config from remote list:', e)
                                                try { showConfigError('Failed to load first configuration from list: ' + (e && e.message ? e.message : e), document.getElementById('config-modal')) } catch (_e) { }
                                            }
                                        } else {
                                            throw new Error('Config list is empty')
                                        }
                                    } else {
                                        // Treat as single config
                                        try {
                                            const normalized = await loadConfigFromStringOrUrl(toLoad)
                                            cfg = normalized
                                            try { if (typeof window !== 'undefined') window.__ssg_explicit_single_config = true } catch (_e) { }
                                            dbg('dbg: loaded config from ?config parameter')
                                        } catch (e) {
                                            logWarn('Failed to load config from ?config= parameter:', e)
                                            try { showConfigError('Failed to load configuration from URL: ' + (e && e.message ? e.message : e), document.getElementById('config-modal')) } catch (_e) { }
                                        }
                                    }
                                } else {
                                    throw new Error('Failed to fetch: ' + (r && r.status))
                                }
                            }
                        } catch (e) {
                            logWarn('Failed to load config from ?config= parameter:', e)
                        }
                    }
                } catch (_e) { }
            }
        } catch (_e) { }

        // Fall back: try loading the server config index (config/index.json)
        // as a config list so the default page demonstrates navigation across
        // listed configs. If that fails, fall back to the single sample config.
        if (!cfg) {
            logInfo('main: no config from URL, attempting to load config index list')
            try {
                const items = await fetchAvailableServerConfigs()
                if (items && items.length > 0) {
                    try {
                        const indexUrl = new URL('./config/index.json', window.location.href).href
                        // Preserve any existing listName that may have been set by
                        // `fetchAvailableServerConfigs()` (it fetches the index.json
                        // and may attach a listName). Avoid clobbering it with null.
                        const existingName = (typeof window !== 'undefined' && window.__ssg_remote_config_list && window.__ssg_remote_config_list.listName) ? window.__ssg_remote_config_list.listName : null
                        window.__ssg_remote_config_list = { url: indexUrl, items: items, listName: existingName }
                        let first = items[0]
                        try { first = resolveListItemPath(first, indexUrl) } catch (_e) { }
                        try {
                            const normalized = await loadConfigFromStringOrUrl(first)
                            cfg = normalized
                            // Mark that we successfully loaded the first item from
                            // the remote config list so the UI can reflect the
                            // origin and pre-select the corresponding dropdown
                            // entry (e.g. '__list::0').
                            try { window.__ssg_loaded_from_list_index = 0 } catch (_e2) { }
                            try {
                                if (window.__ssg_remote_config_list) window.__ssg_remote_config_list.loadedIndex = 0
                            } catch (_e3) { }
                            logInfo('main: loaded first config from index list:', cfg.id, cfg.version)
                        } catch (e) {
                            logWarn('Failed to load first config from index list:', e)
                        }
                    } catch (_e) { }
                } else {
                    logInfo('main: config index returned no items, falling back to sample')
                }
            } catch (e) {
                logWarn('Failed to fetch config index, falling back to sample:', e)
            }

            if (!cfg) {
                logInfo('main: loading default sample config')
                cfg = await loadConfig()
                logInfo('main: loaded default config:', cfg.id, cfg.version)
            }
        }

        // Save the loaded config as current (whether from URL, unified storage, or default)
        try {
            setCurrentConfig(cfg)
            // Make config globally available for read-only checks
            try { window.currentConfig = cfg } catch (_e) { }
            await saveCurrentConfig(cfg)
            // Debug what was actually saved
            logDebug('=== Config Loading Debug ===')
            logDebug('Final loaded config:', cfg.id, cfg.version)
            debugCurrentConfig()
        } catch (e) {
            logWarn('Failed to save current config:', e)
        }

        initializeInstructions(cfg)

        // Update success indicators initially (may be updated later when snapshots load)
        try { updateSuccessIndicators() } catch (_e) { }

        // Expose current config globally for tests
        try { window.Config.current = cfg } catch (_e) { }

        // DEBUG: trace progress
        try { dbg('dbg: after loadConfig') } catch (_e) { }

        // 2. Initialize core UI components
        initializeTerminal()
        setupSideTabs()
        setupClearTerminalButton()

        // 3. Initialize editor
        const cm = initializeEditor()
        try { dbg('dbg: after initializeEditor', !!cm) } catch (_e) { }
        const textarea = $('code')

        // 4. Initialize file system and tabs
        const { FileManager } = await initializeVFS(cfg)
        try { dbg('dbg: after initializeVFS', !!FileManager) } catch (_e) { }
        const TabManager = initializeTabManager(cm, textarea)

        // Ensure MAIN_FILE exists in the FileManager. If it doesn't, populate
        // it with the config starter so tests that rely on the starter output
        // (for example t-hello) will execute the user's MAIN_FILE content.
        try {
            const { MAIN_FILE } = await import('./js/vfs-client.js')
            try {
                const exists = !!(FileManager && FileManager.read && FileManager.read(MAIN_FILE))
                if (!exists && FileManager && typeof cfg.starter === 'string') {
                    try { FileManager.write(MAIN_FILE, cfg.starter) } catch (_e) { }
                }
            } catch (_e) { }
        } catch (_e) { }

        try { dbg('dbg: after initializeTabManager', !!TabManager) } catch (_e) { }

        // Expose TabManager globally for compatibility
        try { window.TabManager = TabManager } catch (e) { }

        // Temporary debugging: surface config/read-only propagation to console
        try {
            // Apply config to TabManager (if present)
            try { if (TabManager && typeof TabManager.updateConfig === 'function') TabManager.updateConfig(cfg) } catch (_e) { }

            // Listen for tab-open events so we can observe what tabs are being opened
            try {
                window.addEventListener('ssg:tab-opened', (ev) => {
                    try { if (typeof window !== 'undefined' && window.__SSG_DEBUG) console.info('[debug] ssg:tab-opened ->', ev && ev.detail) } catch (_e) { }
                })
            } catch (_e) { }
        } catch (_e) { }

        // Ensure TabManager sees the current config (read-only file statuses etc.).
        // setCurrentConfig will notify TabManager.updateConfig if available.
        try {
            if (typeof setCurrentConfig === 'function' && cfg) {
                setCurrentConfig(cfg)
            }
        } catch (_e) { }

        // Prefer sandboxed iframe-based tests by default for better isolation.
        try { if (typeof window !== 'undefined' && typeof window.__ssg_use_sandboxed_tests === 'undefined') window.__ssg_use_sandboxed_tests = true } catch (_e) { }

        // Expose feedback highlight clear helper for tests and debugging
        try {
            if (typeof window.clearAllFeedbackHighlights !== 'function') {
                window.clearAllFeedbackHighlights = function () {
                    try { if (typeof clearAllFeedbackHighlights === 'function') clearAllFeedbackHighlights() } catch (_e) { }
                }
            }
            if (typeof window.clearAllErrorHighlights !== 'function') {
                window.clearAllErrorHighlights = function () {
                    try { if (typeof clearAllErrorHighlights === 'function') clearAllErrorHighlights() } catch (_e) { }
                }
            }
        } catch (_e) { }

        // Ensure workspace is clean BEFORE attempting to restore a snapshot
        // or materialize config files. This prevents leftover files from a
        // previously-loaded config (for example when switching via the URL)
        // from persisting into the new workspace when no snapshot exists.
        try {
            if (FileManager) {
                try {
                    const { setSystemWriteMode } = await import('./js/vfs-client.js')
                    try {
                        setSystemWriteMode(true)
                        const existing = (typeof FileManager.list === 'function') ? FileManager.list() : []
                        for (const p of existing) {
                            try {
                                if (!p) continue
                                if (p === MAIN_FILE) continue
                                if (typeof FileManager.delete === 'function') await FileManager.delete(p)
                            } catch (_e) { /* non-fatal - continue */ }
                        }
                    } finally {
                        try { setSystemWriteMode(false) } catch (_e) { }
                    }
                } catch (_e) {
                    // Fallback: try deleting without system write mode
                    try {
                        const existing = (typeof FileManager.list === 'function') ? FileManager.list() : []
                        for (const p of existing) {
                            try {
                                if (!p) continue
                                if (p === MAIN_FILE) continue
                                if (typeof FileManager.delete === 'function') await FileManager.delete(p)
                            } catch (_e2) { /* non-fatal */ }
                        }
                    } catch (_e2) { /* ignore */ }
                }
            }
        } catch (_e) { /* keep startup resilient */ }

        // Restore from the special 'current' snapshot if it exists
        try {
            const { restoreCurrentSnapshotIfExists } = await import('./js/snapshots.js')
            try { dbg('dbg: after import snapshots') } catch (_e) { }
            const _restored = await restoreCurrentSnapshotIfExists()
            try { dbg('dbg: after restoreCurrentSnapshotIfExists', _restored) } catch (_e) { }

            // After snapshot restore, clean up any tabs that were opened for files
            // that don't exist in the current FileManager (handles config switches)
            try {
                if (TabManager && typeof TabManager.syncWithFileManager === 'function') {
                    await TabManager.syncWithFileManager()
                }
            } catch (_e) { }

            // If no snapshot was restored, ensure any files declared in the
            // loaded configuration are materialized into the FileManager so
            // tabs are created and the runtime can see them (os.listdir, imports).
            try {
                if (!_restored) {
                    try {
                        // Use the FileManager instance returned from initializeVFS
                        if (FileManager && typeof FileManager.write === 'function') {
                            // Ensure MAIN_FILE is populated with the starter (best-effort)
                            try { await FileManager.write(MAIN_FILE, cfg?.starter || '') } catch (_e) { }

                            // Write extra files from the config.files map
                            try {
                                if (cfg && cfg.files && typeof cfg.files === 'object') {
                                    // When materializing files from a loaded configuration make
                                    // sure app/system writes bypass user-level read-only guards
                                    // so the runtime sees the files regardless of file flags.
                                    // When materializing files from a loaded configuration make
                                    // sure app/system writes bypass user-level read-only guards
                                    // so the runtime sees the files regardless of file flags.
                                    try { const { setSystemWriteMode } = await import('./js/vfs-client.js'); setSystemWriteMode(true) } catch (_e) { }
                                    try {
                                        for (const [p, content] of Object.entries(cfg.files)) {
                                            try { await FileManager.write(p, String(content || '')) } catch (_e) { }
                                        }

                                        // Ensure backend (IndexedDB/localStorage backend) also
                                        // persists these files so later mounts into the runtime
                                        // will include them. Use the backend directly if available
                                        // to avoid any user-write guards and to force persistence.
                                        try {
                                            const backend = (typeof window !== 'undefined') ? window.__ssg_vfs_backend : null
                                            if (backend && typeof backend.write === 'function') {
                                                try { const { setSystemWriteMode } = await import('./js/vfs-client.js'); setSystemWriteMode(true) } catch (_e) { }
                                                for (const [p, content] of Object.entries(cfg.files)) {
                                                    try {
                                                        const path = (p && p.startsWith('/')) ? p : ('/' + String(p).replace(/^\/+/, ''))
                                                        await backend.write(path, String(content || ''))
                                                        // mark expected write and notify runtime to keep mem in sync
                                                        try { if (typeof window.__ssg_notify_file_written === 'function') window.__ssg_notify_file_written(path, String(content || '')) } catch (_e) { }
                                                    } catch (_e) { }
                                                }
                                                try { const { setSystemWriteMode } = await import('./js/vfs-client.js'); setSystemWriteMode(false) } catch (_e) { }
                                            }
                                        } catch (_e) { }
                                    } catch (_e) { }
                                    try { const { setSystemWriteMode } = await import('./js/vfs-client.js'); setSystemWriteMode(false) } catch (_e) { }
                                }
                            } catch (_e) { }
                        }
                    } catch (e) {
                        try { if (typeof appendTerminal === 'function') appendTerminal('Failed to populate files from config: ' + e, 'runtime') } catch (_e) { }
                    }

                    // Refresh tabs/editor to reflect programmatic filesystem changes
                    try {
                        if (window.TabManager && typeof window.TabManager.syncWithFileManager === 'function') {
                            try { await window.TabManager.syncWithFileManager() } catch (_e) { }
                        }
                    } catch (_e) { }

                    try {
                        if (window.TabManager && typeof window.TabManager.refreshOpenTabContents === 'function') {
                            try { window.TabManager.refreshOpenTabContents() } catch (_e) { }
                        }
                    } catch (_e) { }
                }
            } catch (_e) { }
        } catch (_e) { /* ignore snapshot restore failures at startup */ }

        // 5. Initialize autosave
        initializeAutosave()

        // 6. Load MicroPython runtime
        const runtimeAdapter = await loadMicroPythonRuntime(cfg)
        try { dbg('dbg: after loadMicroPythonRuntime', !!runtimeAdapter) } catch (_e) { }

        // Expose runtimeAdapter globally for tests
        try { window.runtimeAdapter = runtimeAdapter } catch (e) { }

        // Expose minimal Feedback API for tests and wire UI
        try { window.Feedback = { resetFeedback, evaluateFeedbackOnEdit, evaluateFeedbackOnRun, on: feedbackOn, off: feedbackOff } } catch (_e) { }
        try {
            initializeFeedbackUI();
            feedbackOn('matches', (m) => { try { setFeedbackMatches(m) } catch (_e) { } })
            // Update UI config when Feedback subsystem is reset at runtime
            feedbackOn('reset', (payload) => { try { setFeedbackConfig(payload && payload.config ? payload.config : payload) } catch (_e) { } })
        } catch (_e) { }

        // Provide the feedback config to the UI so it can render visibleByDefault titles
        try { setFeedbackConfig(cfg) } catch (_e) { }

        // Now initialize Feedback subsystem with the config so it can evaluate and emit matches
        try {
            if (window.Feedback && typeof window.Feedback.resetFeedback === 'function') window.Feedback.resetFeedback(cfg)
            // Re-apply full configuration to the UI after Feedback.resetFeedback
            // because resetFeedback emits a 'reset' event with a normalized feedback-only
            // payload which would otherwise overwrite the UI's full config (including tests).
            try { setFeedbackConfig(cfg) } catch (_e) { }
        } catch (_e) { }

        // Initial feedback evaluation for starter content
        try {
            const content = (cm ? cm.getValue() : (textarea ? textarea.value : ''))
            const path = (window.TabManager && window.TabManager.getActive && window.TabManager.getActive()) || '/main.py'
            try { if (window.Feedback && window.Feedback.evaluateFeedbackOnEdit) window.Feedback.evaluateFeedbackOnEdit(content, path) } catch (_e) { }
        } catch (_e) { }

        // Wire feedback UI clicks to open/select files and apply highlights.
        // The UI dispatches `ssg:feedback-click` events with the entry payload
        // and an optional `match` object. Use the existing helpers to open the
        // tab and highlight the mapped line when possible.
        try {
            window.addEventListener('ssg:feedback-click', (ev) => {
                try {
                    const payload = ev && ev.detail ? ev.detail : null
                    if (!payload) return
                    const match = payload.match || null
                    // Prefer payload.match.file if present (edit-time matcher)
                    if (match && match.file) {
                        try { highlightFeedbackLine(match.file, match.line || 1) } catch (_e) { }
                        return
                    }
                    // Fall back to entry-level file/line fields
                    if (payload.file && typeof payload.line === 'number') {
                        try { highlightFeedbackLine(payload.file, payload.line) } catch (_e) { }
                        return
                    }
                    // If the entry specified an explicit action (e.g. open-file), perform it
                    if (payload.action && payload.action.type === 'open-file' && payload.action.path) {
                        try {
                            const p = payload.action.path
                            if (window.TabManager && typeof window.TabManager.openTab === 'function') window.TabManager.openTab(p, { select: false })
                            if (window.TabManager && typeof window.TabManager.selectTab === 'function') window.TabManager.selectTab(p)
                        } catch (_e) { }
                    }
                } catch (_e) { }
            })
        } catch (_e) { }

        // Listen for Run tests button and execute author-defined tests if present
        try {
            window.addEventListener('ssg:run-tests-click', async () => {
                try { logDebug('[app] received ssg:run-tests-click') } catch (_e) { }
                try {
                    const cfg = window.Config && window.Config.current ? window.Config.current : null
                    try { logDebug('[app] config available:', !!cfg, 'tests:', cfg && cfg.tests) } catch (_e) { }

                    // Handle both legacy and grouped test formats
                    let isGroupedFormat = false
                    let testsConfig = null
                    let testCount = 0

                    if (cfg && cfg.tests) {
                        if (Array.isArray(cfg.tests)) {
                            // Legacy format: direct array of tests
                            testsConfig = cfg.tests
                            testCount = testsConfig.length
                        } else if (cfg.tests.groups || cfg.tests.ungrouped) {
                            // Grouped format: object with groups and ungrouped arrays
                            isGroupedFormat = true
                            testsConfig = cfg.tests
                            const groupCount = (testsConfig.groups || []).reduce((sum, g) => sum + (g.tests || []).length, 0)
                            const ungroupedCount = (testsConfig.ungrouped || []).length
                            testCount = groupCount + ungroupedCount
                        }
                    }

                    try { logDebug('[app] current config', !!cfg, isGroupedFormat ? 'grouped' : 'legacy', testCount) } catch (_e) { }

                    if (!testsConfig || testCount === 0) {
                        try { appendTerminal('No tests defined in config', 'runtime') } catch (_e) { }
                        return
                    }

                    // Define runFn that will either use the sandboxed iframe runner (preferred)
                    // or fall back to the adapter factory. This is feature-flagged by
                    // window.__ssg_use_sandboxed_tests.
                    try {
                        const vfs = await import('./js/vfs-client.js')
                        const getFileManager = vfs.getFileManager
                        const MAIN_FILE = vfs.MAIN_FILE

                        let runFn = null
                        if (window.__ssg_use_sandboxed_tests) {
                            // Use sandboxed iframe runner (Phase 1)
                            try {
                                const sandbox = await import('./js/test-runner-sandbox.js')
                                const FileManager = (typeof getFileManager === 'function') ? getFileManager() : null
                                const runtimeUrl = (cfg && cfg.runtime && cfg.runtime.url) || './vendor/micropython.mjs'
                                // Convert runtime URL to be relative to tests/ directory since iframe runs there
                                const testsRelativeRuntimeUrl = runtimeUrl.startsWith('./') ? '../' + runtimeUrl.slice(2) : runtimeUrl

                                // Create snapshot with ALL user workspace files, not just main.py
                                const snapshot = {}
                                if (FileManager) {
                                    try {
                                        const allFiles = (typeof FileManager.list === 'function') ? FileManager.list() : []
                                        for (const filePath of allFiles) {
                                            try {
                                                const content = FileManager.read(filePath)
                                                if (content !== null) {
                                                    snapshot[filePath] = content
                                                }
                                            } catch (e) {
                                                logWarn('[app] failed to read file for snapshot:', filePath, e)
                                            }
                                        }
                                    } catch (e) {
                                        logWarn('[app] failed to list files for snapshot:', e)
                                        // Fallback to just main file
                                        const mainContent = FileManager.read(MAIN_FILE) || ''
                                        snapshot[MAIN_FILE] = mainContent
                                    }
                                } else {
                                    logWarn('[app] no FileManager available for snapshot')
                                }

                                logDebug('[app] creating sandboxed runFn with snapshot keys:', Object.keys(snapshot))
                                runFn = sandbox.createSandboxedRunFn({ runtimeUrl: testsRelativeRuntimeUrl, filesSnapshot: snapshot })
                            } catch (e) {
                                appendTerminal('Failed to initialize sandboxed runner: ' + e, 'runtime')
                                logWarn('[app] sandboxed runFn init failed, falling back to adapter', e)
                                // fall through to adapter
                            }
                        }

                        if (!runFn) {
                            const adapterMod = await import('./js/test-runner-adapter.js')
                            const createRunFn = adapterMod && adapterMod.createRunFn ? adapterMod.createRunFn : adapterMod.default && adapterMod.default.createRunFn
                            runFn = createRunFn({ getFileManager, MAIN_FILE, runPythonCode, getConfig: () => (window.Config && window.Config.current) ? window.Config.current : {} })
                            logDebug('[app] using adapter runFn')
                        }

                        // Show loading modal immediately so it doesn't block Run button
                        try { if (typeof window.__ssg_show_test_results_loading === 'function') window.__ssg_show_test_results_loading() } catch (_e) { }

                        // Import the appropriate runner function based on test format
                        let runnerFunction = null
                        let testData = null

                        if (isGroupedFormat) {
                            const testRunnerMod = await import('./js/test-runner.js')
                            runnerFunction = testRunnerMod.runGroupedTests
                            testData = testsConfig
                            // DEBUG: log grouped test structure
                            try {
                                const groupSummary = (testsConfig.groups || []).map(g => ({ name: g.name, count: (g.tests || []).length, runIf: g.conditional?.runIf }))
                                const ungroupedCount = (testsConfig.ungrouped || []).length
                                logDebug('[app] grouped tests summary - groups:', groupSummary, 'ungrouped:', ungroupedCount)
                                logDebug('[app] about to call runGroupedTests with:', testData)
                            } catch (_e) { }
                        } else {
                            const testRunnerMod = await import('./js/test-runner.js')
                            runnerFunction = testRunnerMod.runTests || testRunnerMod.default
                            testData = testsConfig
                            // DEBUG: log test shapes to help diagnose AST test detection
                            try {
                                const summary = (testsConfig || []).map(t => ({ id: t && t.id, type: t && t.type, keys: Object.keys(t || {}) }))
                                logDebug('[app] legacy tests summary before runTests:', summary)
                            } catch (_e) { }
                        }

                        // Run tests using the appropriate runner function
                        let runnerResult
                        try {
                            runnerResult = await runnerFunction(testData, { runFn })
                        } catch (error) {
                            console.error('[app] Error during test execution:', error)
                            try { appendTerminal('Test execution failed: ' + error.message, 'runtime') } catch (_e) { }
                            return
                        }

                        // Handle different return formats
                        let results
                        if (isGroupedFormat && runnerResult && runnerResult.flatResults) {
                            // Grouped runner returns {flatResults, groupResults, ...}
                            results = runnerResult.flatResults
                        } else {
                            // Legacy runner returns array directly
                            results = runnerResult
                        }

                        try { appendTerminal('Test run complete. ' + results.length + ' tests executed.', 'runtime') } catch (_e) { }

                        // Update UI with results and feed failures into Feedback
                        try {
                            if (typeof window.__ssg_set_test_results === 'function') {
                                try { logDebug('[app] publishing test results', results && results.length) } catch (_e) { }
                                window.__ssg_set_test_results(results)
                                try { logDebug('[app] published test results') } catch (_e) { }
                            }
                            // Explicitly open/refresh the modal now that results exist
                            try { if (typeof window.__ssg_show_test_results === 'function') window.__ssg_show_test_results(results) } catch (_e) { }
                            // If every test passed, save a special success snapshot for this config/version
                            try {
                                const allPassed = Array.isArray(results) && results.length > 0 && results.every(r => !!r.passed)
                                if (allPassed) {
                                    try {
                                        const { getFileManager } = await import('./js/vfs-client.js')
                                        const FileManager = (typeof getFileManager === 'function') ? getFileManager() : null
                                        const snap = { ts: Date.now(), files: {}, config: (window.Config && window.Config.current) ? `${window.Config.current.id}@${window.Config.current.version}` : null, metadata: { configVersion: (window.Config && window.Config.current) ? window.Config.current.version : null } }
                                        if (FileManager && typeof FileManager.list === 'function') {
                                            try {
                                                const names = FileManager.list()
                                                for (const n of names) {
                                                    try { const v = await Promise.resolve(FileManager.read(n)); if (v != null) snap.files[n] = v } catch (_e) { }
                                                }
                                            } catch (_e) { }
                                        }
                                        try {
                                            const { saveSuccessSnapshotForCurrentConfig } = await import('./js/snapshots.js')
                                            await saveSuccessSnapshotForCurrentConfig(snap)
                                            appendTerminal('Success snapshot saved for ' + (snap.config || ''), 'runtime')
                                        } catch (e) {
                                            // Non-fatal: log and continue
                                            try { appendTerminal('Failed to save success snapshot: ' + e, 'runtime') } catch (_e) { }
                                        }
                                    } catch (e) { try { appendTerminal('Failed to create success snapshot: ' + e, 'runtime') } catch (_e) { } }
                                }
                            } catch (_e) { }
                        } catch (_e) { }
                        if (window.Feedback && typeof window.Feedback.evaluateFeedbackOnRun === 'function') {
                            for (const r of results) {
                                // Evaluate feedback for runs that either failed or
                                // produced stderr even when they passed (so authors
                                // can write rules that target stderr output).
                                try {
                                    const hadStderr = !!(r.stderr && String(r.stderr).trim().length > 0)
                                    if (!r.passed || hadStderr) {
                                        try { window.Feedback.evaluateFeedbackOnRun({ stdout: r.stdout || '', stderr: r.stderr || '', stdin: r.stdin || '', filename: r.filename || '' }) } catch (_e) { }
                                    }
                                } catch (_e) { }
                            }
                        }
                        return
                    } catch (_e) {
                        try { appendTerminal('Test run failed to start: ' + _e, 'runtime') } catch (_err) { }
                        return
                    }
                } catch (_err) { }
            })
        } catch (_e) { }

        // 7. Setup runtime APIs and controls
        setupMicroPythonAPI()
        setupStopButton()
        setupKeyboardInterrupt()

        // 7.5. Initialize record/replay debugging system
        try {
            initializeExecutionRecorder()
            initializeReplaySystem()
            logInfo('Record/replay system initialized')
        } catch (e) {
            logWarn('Failed to initialize record/replay system:', e)
        }

        // 8. Setup input handling
        setupInputHandling()

        // 9. Setup snapshot and download systems
        setupSnapshotSystem()
        setupDownloadSystem()

        // 10. Initialize student identifier input
        initializeStudentIdentifier()

        // 11. Wire reset config button if present: restore loaded config from remote and refresh UI
        try {
            const resetBtn = document.getElementById('reset-config-btn')
            if (resetBtn) {
                resetBtn.addEventListener('click', async () => {
                    try {
                        const mod = await import('./js/config.js')
                        const { showConfirmModal } = await import('./js/modals.js')
                        const ok = await showConfirmModal('Reset workspace', 'Reset workspace to the loaded configuration? This will overwrite current files.')
                        if (!ok) return

                        // Reload canonical config (use resetToLoadedConfig if available)
                        let newCfg = null
                        if (mod && typeof mod.resetToLoadedConfig === 'function') {
                            // When invoked from the Reset button we want to force the
                            // workspace to the canonical config files and NOT restore
                            // any existing snapshots for that config (users expect a
                            // true reset to defaults). Pass a marker via opts to
                            // applyConfigToWorkspace below.
                            newCfg = await mod.resetToLoadedConfig()
                        } else {
                            newCfg = (await mod.loadConfig())
                        }



                        // Delegate the heavy lifting to the centralized helper which
                        // applies the config to the workspace (manages FS, snapshots,
                        // tab sync, and feedback updates).
                        try {
                            if (typeof applyConfigToWorkspace === 'function') {
                                // In the context of the explicit Reset button click
                                // we must ensure snapshots are NOT auto-restored so
                                // the workspace is returned to the config defaults.
                                await applyConfigToWorkspace(newCfg, { skipSnapshotRestore: true })
                            } else {
                                // Fallback: attempt basic apply if helper missing
                                const vfs = await import('./js/vfs-client.js')
                                const getFileManager = vfs.getFileManager
                                const MAIN_FILE = vfs.MAIN_FILE
                                const FileManager = (typeof getFileManager === 'function') ? getFileManager() : null
                                if (FileManager && typeof FileManager.write === 'function') {
                                    try {
                                        const { setSystemWriteMode } = await import('./js/vfs-client.js')
                                        try {
                                            setSystemWriteMode(true)
                                            try { await FileManager.write(MAIN_FILE, newCfg?.starter || '') } catch (_e) { }
                                            try {
                                                if (newCfg && newCfg.files && typeof newCfg.files === 'object') {
                                                    for (const [p, content] of Object.entries(newCfg.files)) {
                                                        try { await FileManager.write(p, String(content || '')) } catch (_e) { }
                                                    }
                                                }
                                            } catch (_e) { }
                                        } finally {
                                            try { setSystemWriteMode(false) } catch (_e) { }
                                        }
                                    } catch (_e) {
                                        // fallback without system mode
                                        try { await FileManager.write(MAIN_FILE, newCfg?.starter || '') } catch (_e) { }
                                        try {
                                            if (newCfg && newCfg.files && typeof newCfg.files === 'object') {
                                                for (const [p, content] of Object.entries(newCfg.files)) {
                                                    try { await FileManager.write(p, String(content || '')) } catch (_e) { }
                                                }
                                            }
                                        } catch (_e) { }
                                    }
                                }
                                try { if (window.TabManager && typeof window.TabManager.syncWithFileManager === 'function') await window.TabManager.syncWithFileManager() } catch (_e) { }
                                try { if (window.TabManager && typeof window.TabManager.refreshOpenTabContents === 'function') window.TabManager.refreshOpenTabContents() } catch (_e) { }
                                try { window.Config = window.Config || {}; window.Config.current = newCfg } catch (_e) { }
                                try { appendTerminal('Workspace reset to loaded configuration', 'runtime') } catch (_e) { }
                            }
                        } catch (e) {
                            try { appendTerminal('Failed to apply reset configuration: ' + e, 'runtime') } catch (_e) { }
                        }
                    } catch (e) {
                        try { appendTerminal('Failed to reset config: ' + e, 'runtime') } catch (_e) { }
                    }
                })
            }
        } catch (_e) { }

        // 12. Wire up the Run button
        const runBtn = $('run')
        if (runBtn) {
            runBtn.addEventListener('click', async () => {
                // Save current active tab's content before running
                try {
                    const activePath = TabManager.getActive()
                    if (activePath) {
                        const current = (cm ? cm.getValue() : (textarea ? textarea.value : ''))
                        await FileManager.write(activePath, current)
                    }

                    // Only persist MAIN_FILE from the editor if the active tab is MAIN_FILE
                    // or if MAIN_FILE does not yet exist in the FileManager. This prevents
                    // accidentally overwriting /main.py with the contents of another open tab
                    // (e.g. when a traceback caused the editor to open a different file).
                    try {
                        const mainExists = !!FileManager.read(MAIN_FILE)
                        if (activePath === MAIN_FILE || !mainExists) {
                            const currentMain = (cm ? cm.getValue() : (textarea ? textarea.value : ''))
                            await FileManager.write(MAIN_FILE, currentMain)
                        }
                    } catch (_e) {
                        // best-effort: if FileManager.read/write fail, avoid overwriting main
                    }
                } catch (_) { /* ignore write errors */ }

                // Get the main file content and run it
                const code = FileManager.read(MAIN_FILE) || ''
                // Get current config for execution
                const currentConfig = (window.Config && window.Config.current) ? window.Config.current : {}
                // DEBUG: print tests shapes so we can see ast rule presence
                try {
                    const summary = (tests || []).map(t => ({ id: t && t.id, type: t && t.type, keys: Object.keys(t || {}) }))
                    logDebug('[app] running tests summary:', JSON.stringify(summary, null, 2))
                } catch (_e) { }
                await runPythonCode(code, currentConfig)
            })
        }

        // Keyboard shortcut: Ctrl+Enter (Windows/Linux) or Cmd+Enter (macOS) to run when editor has focus
        try {
            document.addEventListener('keydown', (ev) => {
                try {
                    if (ev.key !== 'Enter') return
                    if (!(ev.ctrlKey || ev.metaKey)) return
                    // Only trigger when editor has focus to avoid accidental runs
                    const editorHasFocus = (cm && typeof cm.hasFocus === 'function') ? cm.hasFocus() : (document.activeElement === textarea)
                    if (!editorHasFocus) return
                    ev.preventDefault()
                    if (runBtn && typeof runBtn.click === 'function') {
                        runBtn.click()
                    }
                } catch (_e) { }
            })
        } catch (_e) { }

        // Top-level helper: apply a loaded/normalized config to the workspace (rewrite FS & refresh UI)
        // `opts` supports:
        // - skipSnapshotRestore: when true, do not attempt to restore saved snapshots for the config
        async function applyConfigToWorkspace(newCfg, opts = {}) {
            const skipSnapshotRestore = !!(opts && opts.skipSnapshotRestore)
            try {
                // Clear any existing highlights (error highlights from previous runs
                // and feedback-based highlights) so the newly-loaded configuration
                // starts with a clean editor state.
                try {
                    if (typeof clearAllErrorHighlights === 'function') clearAllErrorHighlights()
                } catch (_e) { }
                try {
                    if (typeof clearAllFeedbackHighlights === 'function') clearAllFeedbackHighlights()
                } catch (_e) { }
                // Close any open tabs for files that will be removed by the
                // incoming configuration. Do this up-front so we don't rely on
                // other callers to perform cleanup. Use closeTabSilent so the
                // UI doesn't prompt the user or attempt to delete files again.
                try {
                    if (window.TabManager && typeof window.TabManager.list === 'function') {
                        try {
                            const open = window.TabManager.list() || []
                            for (const p of open) {
                                try {
                                    if (!p) continue
                                    // Defer MAIN_FILE handling to normal sync; skip it here
                                    const vfs = await import('./js/vfs-client.js')
                                    const MAIN_FILE = vfs.MAIN_FILE
                                    if (p === MAIN_FILE) continue
                                    try { window.TabManager.closeTabSilent(p) } catch (_e) { }
                                } catch (_e) { }
                            }
                        } catch (_e) { }
                    }
                    try { window.__ssg_pending_tabs = [] } catch (_e) { }
                } catch (_e) { }

                const vfs = await import('./js/vfs-client.js')
                const getFileManager = vfs.getFileManager
                const MAIN_FILE = vfs.MAIN_FILE
                const FileManager = (typeof getFileManager === 'function') ? getFileManager() : null
                // Suppress autosave while we perform programmatic filesystem
                // operations so the editor's debounced autosave doesn't overwrite
                // the freshly-applied files (notably /main.py).
                try { if (typeof window !== 'undefined') window.__ssg_suppress_autosave = true } catch (_e) { }
                if (FileManager) {
                    // When applying a configuration programmatically we must
                    // bypass user-level read-only protections so system writes
                    // and deletes succeed. Use setSystemWriteMode to allow this.
                    try {
                        const { setSystemWriteMode } = await import('./js/vfs-client.js')
                        try {
                            setSystemWriteMode(true)

                            // Delete all files except MAIN_FILE
                            try {
                                const existing = (typeof FileManager.list === 'function') ? FileManager.list() : []
                                for (const p of existing) {
                                    try {
                                        if (p === MAIN_FILE) continue
                                        if (typeof FileManager.delete === 'function') await FileManager.delete(p)
                                    } catch (_e) { }
                                }
                            } catch (_e) { }

                            // Write MAIN_FILE and extra files
                            try {
                                if (typeof FileManager.write === 'function') {
                                    await FileManager.write(MAIN_FILE, newCfg?.starter || '')
                                }
                            } catch (_e) { }

                            try {
                                if (newCfg && newCfg.files && typeof newCfg.files === 'object') {
                                    for (const [p, content] of Object.entries(newCfg.files)) {
                                        try { await FileManager.write(p, String(content || '')) } catch (_e) { }
                                    }
                                }
                            } catch (_e) { }
                        } finally {
                            try { setSystemWriteMode(false) } catch (_e) { }
                        }
                    } catch (_e) {
                        // If setSystemWriteMode import fails just attempt writes normally
                        try {
                            const existing = (typeof FileManager.list === 'function') ? FileManager.list() : []
                            for (const p of existing) {
                                try {
                                    if (p === MAIN_FILE) continue
                                    if (typeof FileManager.delete === 'function') await FileManager.delete(p)
                                } catch (_e) { }
                            }
                        } catch (_e) { }
                        try {
                            if (typeof FileManager.write === 'function') {
                                await FileManager.write(MAIN_FILE, newCfg?.starter || '')
                            }
                        } catch (_e) { }
                        try {
                            if (newCfg && newCfg.files && typeof newCfg.files === 'object') {
                                for (const [p, content] of Object.entries(newCfg.files)) {
                                    try { await FileManager.write(p, String(content || '')) } catch (_e) { }
                                }
                            }
                        } catch (_e) { }
                    }
                }
                // Re-enable autosave after we've synchronized tabs/editor with FileManager
                try { if (typeof window !== 'undefined') window.__ssg_suppress_autosave = false } catch (_e) { }
                // Save this config as the current config for future sessions
                try {
                    saveCurrentConfig(newCfg)
                } catch (_e) { }

                // NOTE: Persisting the last-loaded config selection has been
                // intentionally disabled to avoid automatic restore and avoid
                // accidental fetches of authoring/local or off-site resources.

                // Update global config reference BEFORE checking for snapshots
                // This ensures getSnapshotsForCurrentConfig() uses the new config's identity
                try {
                    setCurrentConfig(newCfg)
                    // Make config globally available for read-only checks
                    window.currentConfig = newCfg
                } catch (_e) { try { window.Config = window.Config || {}; window.Config.current = newCfg } catch (_e2) { } }

                // Reconfigure execution recorder with new config
                try {
                    const { configureExecutionRecorder } = await import('./js/execution-recorder.js')
                    configureExecutionRecorder(newCfg)
                } catch (_e) { }

                // Try to restore the latest snapshot for this NEW config (if compatible).
                // For explicit Reset operations we skip restoring snapshots so the
                // workspace reflects the config defaults. Other flows (loading a
                // config via UI) keep the existing behavior and may restore a
                // latest snapshot if available.
                if (!skipSnapshotRestore) {
                    try {
                        const { getSnapshotsForCurrentConfig } = await import('./js/snapshots.js')
                        const snapshots = await getSnapshotsForCurrentConfig()
                        if (snapshots && snapshots.length > 0) {
                            // Get the most recent snapshot
                            const latestSnapshot = snapshots[snapshots.length - 1]
                            const snapshotConfigVersion = latestSnapshot.metadata?.configVersion
                            const currentConfigVersion = newCfg?.version

                            if (isConfigCompatibleWithSnapshot(currentConfigVersion, snapshotConfigVersion)) {
                                // Before restoring snapshot contents, ensure any
                                // remaining files are removed so the snapshot becomes
                                // the single source of truth. Do not delete MAIN_FILE
                                // here because snapshot may include it; we'll overwrite it.
                                if (FileManager) {
                                    try {
                                        const { setSystemWriteMode } = await import('./js/vfs-client.js')
                                        try {
                                            setSystemWriteMode(true)
                                            const existing = (typeof FileManager.list === 'function') ? FileManager.list() : []
                                            for (const p of existing) {
                                                try {
                                                    if (!p) continue
                                                    if (p === MAIN_FILE) continue
                                                    if (typeof FileManager.delete === 'function') await FileManager.delete(p)
                                                } catch (_e) { /* non-fatal */ }
                                            }
                                        } finally {
                                            try { setSystemWriteMode(false) } catch (_e) { }
                                        }
                                    } catch (_e) {
                                        // Fallback deletion without system mode
                                        try {
                                            const existing = (typeof FileManager.list === 'function') ? FileManager.list() : []
                                            for (const p of existing) {
                                                try {
                                                    if (!p) continue
                                                    if (p === MAIN_FILE) continue
                                                    if (typeof FileManager.delete === 'function') await FileManager.delete(p)
                                                } catch (_e2) { /* non-fatal */ }
                                            }
                                        } catch (_e2) { /* ignore */ }
                                    }
                                }

                                // Restore the snapshot files for this config. Use system
                                // write mode so read-only flags don't block restoration.
                                if (latestSnapshot.files && FileManager) {
                                    try {
                                        const { setSystemWriteMode } = await import('./js/vfs-client.js')
                                        try {
                                            setSystemWriteMode(true)
                                            for (const [path, content] of Object.entries(latestSnapshot.files)) {
                                                try { await FileManager.write(path, content) } catch (_e) { }
                                            }
                                        } finally {
                                            try { setSystemWriteMode(false) } catch (_e) { }
                                        }
                                    } catch (_e) {
                                        // fallback: try writes without system mode
                                        for (const [path, content] of Object.entries(latestSnapshot.files)) {
                                            try { await FileManager.write(path, content) } catch (_e) { }
                                        }
                                    }
                                }
                                try { appendTerminal('Restored latest snapshot for ' + (newCfg?.title || newCfg?.id || 'config'), 'runtime') } catch (_e) { }
                            } else {
                                try { appendTerminal('Config version changed - using default files instead of snapshot', 'runtime') } catch (_e) { }
                            }
                        } else {
                            try { appendTerminal('No snapshots found for ' + (newCfg?.title || newCfg?.id || 'config') + ' - using default files', 'runtime') } catch (_e) { }
                        }
                    } catch (_e) { }
                }

                // Refresh tabs/editor and ensure MAIN_FILE remains selected
                try { if (window.TabManager && typeof window.TabManager.syncWithFileManager === 'function') await window.TabManager.syncWithFileManager() } catch (_e) { }
                try { if (window.TabManager && typeof window.TabManager.refreshOpenTabContents === 'function') window.TabManager.refreshOpenTabContents() } catch (_e) { }
                try { if (window.TabManager && typeof window.TabManager.selectTab === 'function') window.TabManager.selectTab(MAIN_FILE) } catch (_e) { }

                // After tabs and editor refresh, clear highlights again to ensure
                // no stale line decorations remain from the previous config.
                try {
                    if (typeof clearAllErrorHighlights === 'function') clearAllErrorHighlights()
                } catch (_e) { }
                try {
                    if (typeof clearAllFeedbackHighlights === 'function') clearAllFeedbackHighlights()
                } catch (_e) { }

                // Update UI components (setCurrentConfig was already called above)
                try { initializeInstructions(newCfg) } catch (_e) { }
                // Update Feedback subsystem and UI so feedback/tests from the
                // newly-applied config fully replace any previous state.
                try {
                    // Apply the full config to the feedback UI first so tests and
                    // other non-feedback fields are available. resetFeedback may
                    // emit a 'reset' event with a feedback-only payload which
                    // would otherwise overwrite the full UI config; call it
                    // after resetting and then re-apply to ensure the UI keeps
                    // the author-provided tests array intact.
                    if (typeof setFeedbackConfig === 'function') setFeedbackConfig(newCfg)
                } catch (_e) { }
                try {
                    if (window.Feedback && typeof window.Feedback.resetFeedback === 'function') await window.Feedback.resetFeedback(newCfg)
                    // Re-apply the full config to the feedback UI after resetFeedback
                    // completes so tests (and other fields) remain present in the UI.
                    try { if (typeof setFeedbackConfig === 'function') setFeedbackConfig(newCfg) } catch (_e) { }
                    // Restore previous behavior: when a new config is applied programmatically
                    // evaluate edit-time feedback immediately so feedback entries appear
                    // without requiring a manual user edit. Use the current editor/tab
                    // helpers to obtain content and path (best-effort fallbacks).
                    try {
                        const content = (cm ? cm.getValue() : (textarea ? textarea.value : ''))
                        const path = (window.TabManager && window.TabManager.getActive && window.TabManager.getActive()) || '/main.py'
                        try { if (window.Feedback && window.Feedback.evaluateFeedbackOnEdit) window.Feedback.evaluateFeedbackOnEdit(content, path) } catch (_e) { }
                    } catch (_e) { }
                } catch (_e) { }
                try { appendTerminal('Workspace configured: ' + (newCfg && newCfg.title ? newCfg.title : 'loaded'), 'runtime') } catch (_e) { }
                try { updateSuccessIndicators() } catch (_e) { }
            } catch (e) {
                try { appendTerminal('Failed to apply configuration: ' + e, 'runtime') } catch (_e) { }
            }
        }

        // Expose applyConfigToWorkspace on `window` so dynamically-attached handlers
        // (created in other scopes or before module evaluation completes) can safely
        // reference it. This is a safe, non-invasive export that avoids scoping
        // surprises in browsers while keeping the internal function intact.
        try {
            if (typeof window !== 'undefined' && typeof applyConfigToWorkspace === 'function') {
                try { window.applyConfigToWorkspace = applyConfigToWorkspace } catch (_e) { }
            }
        } catch (_e) { }

        // Helper to surface config errors in the config modal (inline) and terminal
        function showConfigError(message, openModalEl) {
            try {
                // Set inline error element if present
                const errEl = document.getElementById('config-error')
                if (errEl) {
                    errEl.textContent = message
                    errEl.style.display = 'block'
                }
                // Also write to terminal for visibility in logs
                try { appendTerminal(message, 'runtime') } catch (_e) { }
                // If we have a modal element, ensure it's visible so the user can act
                if (openModalEl) {
                    try { openModal(openModalEl) } catch (_e) { }
                }
            } catch (_e) { }
        }

        // Wire config header and modal UI (header dropdown/open on header click, server list population, URL load, file upload/drop)
        try {
            // Prefer the visible config title element for activation so
            // interactive controls inside the header (reset button, student ID input)
            // don't accidentally open the config modal via event bubbling.
            const configInfoEl = document.querySelector('.config-title-line') || document.querySelector('.config-info')
            const configModal = document.getElementById('config-modal')
            if (configInfoEl && configModal) {
                // Handle authoring mode setup
                // Ensure authoring flag helpers exist. These helpers are defensive
                // and check the URL, sessionStorage, and a global override so tests
                // and different embed contexts can enable authoring reliably.
                try {
                    // Define helpers if they aren't already present (for tests or other modules)
                    if (typeof window !== 'undefined') {
                        if (typeof window.ensureAuthorFlag !== 'function') {
                            // ensureAuthorFlag: make URL `?author` authoritative for the current load.
                            // Behavior:
                            // - If `window.__ssg_force_author` is explicitly set, respect that value.
                            // - Else if the URL contains `?author`, enable authoring for this session (set sessionStorage).
                            // - Otherwise remove any existing sessionStorage flag so a prior visit does not persist authoring.
                            window.ensureAuthorFlag = function ensureAuthorFlag() {
                                try {
                                    // Global override takes precedence
                                    if (typeof window.__ssg_force_author !== 'undefined') {
                                        if (window.__ssg_force_author) {
                                            try { sessionStorage.setItem('ssg_author', '1') } catch (_e) { }
                                        } else {
                                            try { sessionStorage.removeItem('ssg_author') } catch (_e) { }
                                        }
                                        return
                                    }

                                    // URL param authoritative for this load
                                    try {
                                        const params = new URLSearchParams(window.location.search)
                                        if (params.has('author')) {
                                            try { sessionStorage.setItem('ssg_author', '1') } catch (_e) { }
                                            return
                                        }
                                    } catch (_e) { }

                                    // No param and no global override: clear any previous session flag
                                    try { sessionStorage.removeItem('ssg_author') } catch (_e) { }
                                } catch (_e) { }
                            }
                        }

                        if (typeof window.isAuthoringEnabled !== 'function') {
                            // isAuthoringEnabled: check explicit global override first,
                            // then check URL param (current load), then sessionStorage.
                            // Because ensureAuthorFlag clears sessionStorage when the URL
                            // param is absent, a fresh load without `?author` will
                            // correctly disable authoring even if a previous session
                            // had it enabled.
                            window.isAuthoringEnabled = function isAuthoringEnabled() {
                                try {
                                    if (typeof window.__ssg_force_author !== 'undefined') return !!window.__ssg_force_author

                                    try {
                                        const params = new URLSearchParams(window.location.search)
                                        if (params.has('author')) return true
                                    } catch (_e) { }

                                    try {
                                        if (sessionStorage.getItem('ssg_author') === '1') return true
                                    } catch (_e) { }
                                } catch (_e) { }
                                return false
                            }
                        }
                    }
                } catch (_e) { }

                // Ensure any URL-based flag is materialized into session storage
                try { if (typeof window !== 'undefined' && typeof window.ensureAuthorFlag === 'function') window.ensureAuthorFlag() } catch (_e) { }

                // If authoring is not enabled (no global override and no session flag),
                // clear any stale session flag so authoring doesn't persist across visits.
                try {
                    if (typeof window !== 'undefined' && typeof window.isAuthoringEnabled === 'function') {
                        if (!window.isAuthoringEnabled()) {
                            try { sessionStorage.removeItem('ssg_author') } catch (_e) { }
                        }
                    }
                } catch (_e) { }

                const authoringEnabled = (typeof window !== 'undefined' && typeof window.isAuthoringEnabled === 'function') ? window.isAuthoringEnabled() : false

                // Log authoring mode status
                if (authoringEnabled) {
                    logInfo('✨ Authoring mode enabled - config modal available')
                } else {
                    logInfo('👤 User mode - config modal disabled')
                }

                // Update cursor style based on authoring mode
                if (authoringEnabled) {
                    configInfoEl.classList.add('authoring-enabled')
                } else {
                    configInfoEl.classList.remove('authoring-enabled')
                }

                // Replace config-title-line contents with a dropdown when NOT authoring
                try {
                    const titleLine = document.querySelector('.config-title-line')
                    const container = titleLine && titleLine.parentElement ? titleLine.parentElement : null
                    if (titleLine && container) {
                        // Remove any existing interactive attributes (handled elsewhere)
                        try { titleLine.removeAttribute('role'); titleLine.removeAttribute('tabindex'); titleLine.removeAttribute('title') } catch (_e) { }

                        // If an explicit single config was requested via ?config=,
                        // prefer showing its static title. If a remote config list
                        // exists (server index or config-list resource), prefer the
                        // dropdown so the user can navigate list items.
                        try {
                            const curCfgEarly = (typeof window !== 'undefined' && window.Config && window.Config.current) ? window.Config.current : null
                            const explicitSingleEarly = (typeof window !== 'undefined' && window.__ssg_explicit_single_config)
                            const hasRemoteListEarly = (typeof window !== 'undefined' && window.__ssg_remote_config_list && Array.isArray(window.__ssg_remote_config_list.items) && window.__ssg_remote_config_list.items.length > 0)
                            if ((explicitSingleEarly || curCfgEarly) && !hasRemoteListEarly) {
                                try {
                                    const existing = document.getElementById('config-select-header')
                                    if (existing && existing.parentElement) existing.parentElement.removeChild(existing)
                                } catch (_e) { }
                                try {
                                    const label = (curCfgEarly && curCfgEarly.title ? String(curCfgEarly.title) : (curCfgEarly ? String(curCfgEarly.id || 'Configuration') : 'Configuration'))
                                    const ver = (curCfgEarly && curCfgEarly.version) ? (' (v' + String(curCfgEarly.version) + ')') : ''
                                    titleLine.style.display = ''
                                    titleLine.textContent = label + ver
                                    titleLine.setAttribute && titleLine.setAttribute('title', label + ver)
                                } catch (_e) { }
                            }
                        } catch (_e) { }

                        // If authoring is enabled, ensure an Author button exists that opens the config modal
                        // If not authoring, keep the element hidden (do not remove) so tests that expect its presence
                        // in the DOM won't fail; simply toggle its visibility.
                        let authorBtn = document.getElementById('header-author-btn')
                        if (authoringEnabled) {
                            if (!authorBtn) {
                                authorBtn = document.createElement('button')
                                authorBtn.id = 'header-author-btn'
                                authorBtn.className = 'btn'
                                authorBtn.style.marginRight = '6px'
                                authorBtn.textContent = 'Author'
                                authorBtn.addEventListener('click', (ev) => {
                                    try {
                                        try { openHandler && typeof openHandler === 'function' ? openHandler(ev) : (() => { const cm = document.getElementById('config-modal'); if (cm) openModal(cm) })() } catch (_e) {
                                            const cm = document.getElementById('config-modal')
                                            if (cm) openModal(cm)
                                        }
                                    } catch (e) { logError('Failed to open config modal via header Author button:', e) }
                                })
                                // Insert the author button before the header select if it already exists
                                // so the DOM order is deterministic regardless of initialization timing.
                                const reference = container.querySelector('#config-select-header') || titleLine
                                container.insertBefore(authorBtn, reference)
                            }
                            // Ensure it's visible when authoring is enabled
                            try {
                                // Use inline-block so it appears inline with the title text
                                authorBtn.style.display = 'inline-block'
                                authorBtn.removeAttribute && authorBtn.removeAttribute('hidden')
                                authorBtn.setAttribute && authorBtn.setAttribute('aria-hidden', 'false')
                            } catch (_e) { }
                        } else {
                            // Hide the button when not authoring (preserve element in DOM)
                            if (!authorBtn) {
                                // Create a hidden placeholder so tests that query the DOM find the element
                                try {
                                    authorBtn = document.createElement('button')
                                    authorBtn.id = 'header-author-btn'
                                    authorBtn.className = 'btn'
                                    authorBtn.style.display = 'none'
                                    authorBtn.style.marginRight = '6px'
                                    // Do not attach click handler when not authoring
                                    const reference = container ? (container.querySelector('#config-select-header') || titleLine) : null
                                    if (container && reference) container.insertBefore(authorBtn, reference)
                                } catch (_e) { }
                            } else {
                                try {
                                    // keep hidden via inline style so it overrides CSS default if needed
                                    authorBtn.style.display = 'none'
                                    try { authorBtn.setAttribute('hidden', ''); authorBtn.setAttribute('aria-hidden', 'true') } catch (_e) { }
                                } catch (_e) { }
                            }
                        }

                        // Create a select dropdown showing available configs (used for both authoring and regular user modes)
                        // Prepare server items (from remote list if present). Enhance labels by
                        // attempting to fetch each config's metadata (title/version) for a nicer label.
                        let serverItems = []
                        if (window.__ssg_remote_config_list && Array.isArray(window.__ssg_remote_config_list.items)) {
                            const listUrl = window.__ssg_remote_config_list.url
                            const base = listUrl.endsWith('/') ? listUrl : listUrl.replace(/[^/]*$/, '')
                            for (let i = 0; i < window.__ssg_remote_config_list.items.length; i++) {
                                const raw = window.__ssg_remote_config_list.items[i]
                                let display = String(raw)
                                try {
                                    const resolved = /^(https?:)?\/\//i.test(String(raw)) ? String(raw) : new URL(String(raw), base).href
                                    const r = await fetch(resolved)
                                    if (r && r.ok) {
                                        try {
                                            const parsed = await r.json()
                                            const title = parsed && parsed.title ? String(parsed.title) : null
                                            const ver = parsed && parsed.version ? String(parsed.version) : null
                                            if (title) display = ver ? (title + ' (v' + ver + ')') : title
                                        } catch (_e) { }
                                    }
                                } catch (_e) { }
                                serverItems.push({ label: display, value: '__list::' + i })
                            }
                        } else {
                            try {
                                const items = await fetchAvailableServerConfigs()
                                for (let i = 0; i < (items || []).length; i++) {
                                    const it = items[i]
                                    let display = String(it)
                                    try {
                                        // Try to fetch the config to get title/version
                                        const resolved = /^(https?:)?\/\//i.test(String(it)) ? String(it) : ('./config/' + encodeURIComponent(String(it)))
                                        const r = await fetch(resolved)
                                        if (r && r.ok) {
                                            try {
                                                const parsed = await r.json()
                                                const title = parsed && parsed.title ? String(parsed.title) : null
                                                const ver = parsed && parsed.version ? String(parsed.version) : null
                                                if (title) display = ver ? (title + ' (v' + ver + ')') : title
                                            } catch (_e) { }
                                        }
                                    } catch (_e) { }
                                    serverItems.push({ label: display, value: String(it) })
                                }
                            } catch (_e) { serverItems = [] }
                        }

                        // If only one config is available, auto-load it (already handled for configList case), and don't show a dropdown
                        // Additionally: if the app already has a single loaded config (window.Config.current),
                        // prefer showing its title/id/version in the header instead of a dropdown. This covers
                        // cases where a single config was loaded via ?config= or the index-first-item path.
                        try {
                            const curCfg = (typeof window !== 'undefined' && window.Config && window.Config.current) ? window.Config.current : null
                            const hasRemoteList = (typeof window !== 'undefined' && window.__ssg_remote_config_list && Array.isArray(window.__ssg_remote_config_list.items) && window.__ssg_remote_config_list.items.length > 0)
                            // If a config is already loaded (for example via ?config= or index-first-item),
                            // prefer showing its title in the header instead of a dropdown only when
                            // there is NOT an available remote config list. If a remote list exists we
                            // want to keep the dropdown so users can navigate other items in the list.
                            if (curCfg && !hasRemoteList) {
                                // Remove any existing select dropdown
                                try {
                                    const existing = document.getElementById('config-select-header')
                                    if (existing && existing.parentElement) existing.parentElement.removeChild(existing)
                                } catch (_e) { }

                                // Show the titleLine as a static display with config title/version
                                try {
                                    titleLine.style.display = ''
                                    const label = (curCfg.title ? String(curCfg.title) : String(curCfg.id || 'Configuration')) + (curCfg.version ? (' (v' + String(curCfg.version) + ')') : '')
                                    titleLine.textContent = label
                                    titleLine.setAttribute && titleLine.setAttribute('title', label)
                                } catch (_e) { }
                            }
                        } catch (_e) { }

                        const singleServerItem = (serverItems && serverItems.length === 1) ? serverItems[0] : null
                        // Only auto-load the single server item if we do NOT already have a current config
                        if (singleServerItem && !window.__ssg_remote_config_list && !(typeof window !== 'undefined' && window.Config && window.Config.current)) {
                            // Try to load this single server item now
                            try {
                                let toLoad = singleServerItem.value
                                // If it's a plain filename, resolve it via loadConfigFromStringOrUrl which already handles relative names
                                const normalized = await loadConfigFromStringOrUrl(toLoad)
                                await applyConfigToWorkspace(normalized)
                            } catch (e) {
                                try { showConfigError('Failed to load configuration: ' + (e && e.message ? e.message : e), configModal) } catch (_e) { }
                            }
                        } else {
                            // If multiple items exist, create the select dropdown
                            // Build the header select when either:
                            // - there is a remote config list from the server (we want navigation), or
                            // - there are multiple serverItems and no current config loaded
                            const explicitSingle = (typeof window !== 'undefined' && window.__ssg_explicit_single_config)
                            const hasRemoteList = (typeof window !== 'undefined' && window.__ssg_remote_config_list && Array.isArray(window.__ssg_remote_config_list.items) && window.__ssg_remote_config_list.items.length > 0)
                            const shouldBuildSelect = (!explicitSingle && ((hasRemoteList && serverItems && serverItems.length >= 1) || (serverItems && serverItems.length > 1 && !(typeof window !== 'undefined' && window.Config && window.Config.current))))
                            if (shouldBuildSelect) {
                                let select = document.getElementById('config-select-header')
                                if (!select) {
                                    select = document.createElement('select')
                                    select.id = 'config-select-header'
                                    select.className = 'config-select-header'
                                    // replace titleLine with the select in the layout while keeping titleLine for fallback
                                    container.insertBefore(select, titleLine)
                                    titleLine.style.display = 'none'
                                    select.addEventListener('change', async (ev) => {
                                        try {
                                            const val = select.value
                                            if (!val) return
                                            let toLoad = val
                                            if (val.startsWith('__list::') && window.__ssg_remote_config_list) {
                                                const idx = parseInt(val.split('::')[1], 10)
                                                let source = window.__ssg_remote_config_list.items[idx]
                                                if (!source) return
                                                try {
                                                    const listUrl = window.__ssg_remote_config_list.url
                                                    const base = listUrl.endsWith('/') ? listUrl : listUrl.replace(/[^/]*$/, '')
                                                    const listIsRemote = /^(https?:)?\/\//i.test(listUrl)
                                                    if (!/^(https?:)?\/\//i.test(source)) {
                                                        if (source.startsWith('./') || source.startsWith('/')) {
                                                            source = new URL(source, base).href
                                                        } else if (listIsRemote) {
                                                            // Resolve plain filenames relative to remote list URL
                                                            source = new URL(source, base).href
                                                        } else {
                                                            // Leave plain filename unchanged to be processed by centralized loader
                                                        }
                                                    }
                                                } catch (_e) { }
                                                toLoad = source
                                            }
                                            const normalized = await loadConfigFromStringOrUrl(toLoad)
                                            await applyConfigToWorkspace(normalized)
                                        } catch (e) {
                                            const msg = 'Failed to load selected configuration: ' + (e && e.message ? e.message : e)
                                            try { showConfigError(msg, configModal) } catch (_e) { }
                                        }
                                    })
                                }

                                // Populate options
                                select.innerHTML = ''
                                const optPlaceholder = document.createElement('option')
                                optPlaceholder.value = ''
                                optPlaceholder.textContent = 'Select configuration…'
                                select.appendChild(optPlaceholder)
                                // Cache to avoid duplicate storage reads while populating
                                const successCache = new Map()
                                async function labelWithSuccess(label, value) {
                                    try {
                                        // Value may be '__list::idx' for remote lists; we only
                                        // decorate when the option corresponds to a concrete
                                        // config identity like 'id@version' or a filename that
                                        // will resolve to a config; for server items we try
                                        // a best-effort match using the label or value.
                                        const { getSuccessSnapshotForConfig } = await import('./js/snapshots.js')
                                        let identity = null
                                        // If value looks like id@version, use directly
                                        if (typeof value === 'string' && value.includes('@')) identity = value
                                        // If label contains '(vX)' try to synthesize id@version using value
                                        if (!identity && typeof value === 'string' && value && !value.startsWith('__list::')) {
                                            // Use value as config id or path; try to load metadata in modal population phase
                                            identity = value
                                        }
                                        if (!identity) return label
                                        if (successCache.has(identity)) {
                                            return successCache.get(identity) ? (label + ' ★') : label
                                        }
                                        const snap = await getSuccessSnapshotForConfig(identity)
                                        const has = !!snap
                                        successCache.set(identity, has)
                                        return has ? (label + ' ★') : label
                                    } catch (_e) { return label }
                                }

                                // Populate options synchronously; decorations will be
                                // applied asynchronously by `refreshConfigSelectBadges`
                                for (const it of serverItems) {
                                    const opt = document.createElement('option')
                                    opt.value = it.value
                                    opt.textContent = it.label
                                    select.appendChild(opt)
                                }
                                // Apply badges asynchronously (non-blocking)
                                try { setTimeout(() => { try { refreshConfigSelectBadges() } catch (_e) { } }, 0) } catch (_e) { }
                                // If remote configList was used, select the first item visually
                                // and ensure it's loaded into the workspace if nothing is loaded yet.
                                try {
                                    if (hasRemoteList) {
                                        // select the first item visually but keep it user-changeable
                                        select.value = '__list::0'
                                        // If no config is currently loaded, auto-load the first list item
                                        if (!(typeof window !== 'undefined' && window.Config && window.Config.current)) {
                                            try {
                                                const idx = 0
                                                let source = window.__ssg_remote_config_list.items[idx]
                                                try { source = resolveListItemPath(source, window.__ssg_remote_config_list && window.__ssg_remote_config_list.url) } catch (_e) { }
                                                const normalized = await loadConfigFromStringOrUrl(source)
                                                await applyConfigToWorkspace(normalized)
                                            } catch (_e) {
                                                // If loading the first item fails, leave the select visible so user can try others
                                                dbg('dbg: failed to auto-load first remote list item', _e)
                                            }
                                        }
                                    }
                                } catch (_e) { }
                            }
                        }
                    }
                } catch (_e) { }
                // Final safeguard: if a config is already loaded, ensure the
                // header shows the static title and remove any select dropdown
                // that might have been created by earlier logic (handles timing
                // races where the select was inserted despite a loaded config).
                try {
                    const curCfgFinal = (typeof window !== 'undefined' && window.Config && window.Config.current) ? window.Config.current : null
                    const hasRemoteListFinal = (typeof window !== 'undefined' && window.__ssg_remote_config_list && Array.isArray(window.__ssg_remote_config_list.items) && window.__ssg_remote_config_list.items.length > 0)
                    if (curCfgFinal && !hasRemoteListFinal) {
                        try {
                            // Remove any select elements inside the container to cover
                            // cases where a select was inserted without the expected id.
                            if (container && container.querySelectorAll) {
                                const selects = Array.from(container.querySelectorAll('select, .config-select-header'))
                                for (const s of selects) {
                                    try { if (s && s.parentElement) s.parentElement.removeChild(s) } catch (_e) { }
                                }
                            }
                            // Also remove any global element with the id just in case
                            const existing = document.getElementById('config-select-header')
                            if (existing && existing.parentElement) existing.parentElement.removeChild(existing)
                        } catch (_e) { }
                        try {
                            const label = (curCfgFinal.title ? String(curCfgFinal.title) : String(curCfgFinal.id || 'Configuration')) + (curCfgFinal.version ? (' (v' + String(curCfgFinal.version) + ')') : '')
                            if (titleLine) {
                                titleLine.style.display = ''
                                titleLine.textContent = label
                                titleLine.setAttribute && titleLine.setAttribute('title', label)
                            }
                        } catch (_e) { }
                    }
                } catch (_e) { }

                // Clear session flag after checking
                try {
                    sessionStorage.removeItem('returningFromAuthor')
                } catch (e) {
                    logWarn('Failed to clear session flag:', e)
                }

                // Click and keyboard handler to open modal
                const openHandler = async (ev) => {
                    try {
                        // Check if authoring mode is enabled
                        if (!isAuthoringEnabled()) {
                            logDebug('[app] config modal disabled - authoring mode not enabled')
                            return
                        }

                        logDebug('[app] config header activated', ev && ev.type)
                        openModal(configModal)

                        // Show/hide author page button based on authoring mode
                        const authorPageBtn = document.getElementById('config-author-page')
                        if (authorPageBtn) {
                            authorPageBtn.style.display = isAuthoringEnabled() ? 'inline-block' : 'none'
                        }

                        // Verify the modal became visible; if not, force it and log
                        try {
                            const vis = configModal.getAttribute && configModal.getAttribute('aria-hidden')
                            logDebug('[app] configModal aria-hidden after open:', vis)
                            if (vis !== 'false') {
                                logDebug('[app] forcing modal visible')
                                configModal.setAttribute('aria-hidden', 'false')
                            }
                        } catch (_e) { }

                        // Populate combined configurations list (server + authoring)
                        const listContainer = document.getElementById('config-server-list')
                        if (listContainer) {
                            listContainer.textContent = 'Loading...'
                            let items = null
                            try {
                                items = await fetchAvailableServerConfigs()
                                listContainer.innerHTML = ''

                                // If fetchAvailableServerConfigs returned no items, try a direct
                                // fallback to ./config/index.json (handles environments where
                                // relative resolution differs). If that file matches the new
                                // object-with-`files` shape, populate window.__ssg_remote_config_list
                                // and use its files.
                                if ((!items || items.length === 0) && typeof fetch === 'function') {
                                    // Try multiple fallback locations for index.json to handle
                                    // different static hosting setups and relative resolution
                                    // differences between environments.
                                    const candidates = [
                                        './config/index.json',
                                        'config/index.json',
                                        '/config/index.json',
                                        '../config/index.json'
                                    ]
                                    // Also include any previously-known window.__ssg_remote_config_list.url
                                    try {
                                        if (window && window.__ssg_remote_config_list && window.__ssg_remote_config_list.url) {
                                            candidates.push(window.__ssg_remote_config_list.url)
                                        }
                                    } catch (_e) { }

                                    let found = false
                                    for (const cand of candidates) {
                                        try {
                                            dbg('[app] attempting fallback fetch for config index:', cand)
                                            const fallbackRes = await fetch(cand)
                                            dbg('[app] fallback fetch result:', cand, fallbackRes && fallbackRes.status)
                                            if (fallbackRes && fallbackRes.ok) {
                                                const fallbackBody = await fallbackRes.json()
                                                if (fallbackBody && typeof fallbackBody === 'object' && Array.isArray(fallbackBody.files)) {
                                                    try { if (typeof window !== 'undefined') window.__ssg_remote_config_list = window.__ssg_remote_config_list || { url: cand, items: fallbackBody.files, listName: fallbackBody.listName || null } } catch (_e) { }
                                                    items = fallbackBody.files
                                                    found = true
                                                    dbg('[app] fallback fetch succeeded for:', cand, 'items:', items && items.length)
                                                    break
                                                } else {
                                                    dbg('[app] fallback fetch returned JSON but not object-with-files for:', cand)
                                                }
                                            }
                                        } catch (err) {
                                            dbg('[app] fallback fetch error for', cand, err && err.message)
                                            // continue to next candidate
                                        }
                                    }
                                    if (!found) dbg('[app] no fallback candidate produced a valid remote config list')
                                }
                            } catch (e) {
                                // Clear the loading placeholder and show an inline error, but
                                // don't return early — continue to populate any authoring config
                                listContainer.innerHTML = ''
                                let errorEl = document.getElementById('config-server-error')
                                if (!errorEl) {
                                    errorEl = document.createElement('div')
                                    errorEl.id = 'config-server-error'
                                    errorEl.style.color = 'var(--text-error, #b00020)'
                                    errorEl.style.fontSize = '0.9em'
                                    errorEl.style.marginTop = '6px'
                                    listContainer.parentNode.insertBefore(errorEl, listContainer.nextSibling)
                                }
                                errorEl.textContent = 'Failed to load server configuration list: ' + (e && e.message ? e.message : e)
                                try { appendTerminal('Failed to load server configuration list: ' + (e && e.message ? e.message : e), 'runtime') } catch (_e) { }
                                items = []
                            }
                            // error area
                            let errorEl = document.getElementById('config-server-error')
                            if (!errorEl) {
                                errorEl = document.createElement('div')
                                errorEl.id = 'config-server-error'
                                errorEl.style.color = 'var(--text-error, #b00020)'
                                errorEl.style.fontSize = '0.9em'
                                errorEl.style.marginTop = '6px'
                                listContainer.parentNode.insertBefore(errorEl, listContainer.nextSibling)
                            }
                            errorEl.textContent = ''

                            let hasConfigs = false

                            // Add authoring config first if available (try unified storage then localStorage)
                            try {
                                const AUTHOR_CONFIG_KEY = 'author_config'
                                let raw = null
                                try {
                                    // Prefer unified-storage async API if available
                                    const { loadSetting } = await import('./js/unified-storage.js')
                                    raw = await loadSetting(AUTHOR_CONFIG_KEY)
                                } catch (_e) {
                                    // unified storage not available; do nothing (no localStorage read in production)
                                }
                                if (raw) {
                                    try {
                                        // Use `raw` directly
                                        // Handle tests parsing
                                        if (raw && typeof raw.tests === 'string' && raw.tests.trim()) {
                                            const parsedTests = JSON.parse(raw.tests)
                                            if (Array.isArray(parsedTests)) raw.tests = parsedTests
                                        }

                                        // Handle tests parsing
                                        try {
                                            if (raw && typeof raw.tests === 'string' && raw.tests.trim()) {
                                                const parsedTests = JSON.parse(raw.tests)
                                                if (Array.isArray(parsedTests)) raw.tests = parsedTests
                                            }
                                        } catch (_e) { /* leave raw.tests as-is if parsing fails */ }

                                        // Sanitize test entries
                                        try {
                                            if (raw && Array.isArray(raw.tests)) {
                                                raw.tests = raw.tests.map(t => {
                                                    if (!t || typeof t !== 'object') return t
                                                    const clean = Object.assign({}, t)
                                                    if (clean.expected_stdout === null) delete clean.expected_stdout
                                                    if (clean.expected_stderr === null) delete clean.expected_stderr
                                                    if (clean.setup === null) delete clean.setup
                                                    if (clean.stdin === null) delete clean.stdin
                                                    if (!clean.id) clean.id = ('t-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7))

                                                    return clean
                                                })
                                            }
                                        } catch (_e) { }

                                        const normalized = validateAndNormalizeConfig(raw)
                                        if (normalized) {
                                            const btn = document.createElement('button')
                                            btn.className = 'btn'
                                            btn.style.display = 'block'
                                            btn.style.width = '100%'
                                            btn.style.textAlign = 'left'
                                            btn.style.marginBottom = '4px'
                                            btn.style.background = '#f8f9fa'
                                            btn.style.border = '1px solid #e9ecef'
                                            btn.textContent = `${normalized.title || normalized.id} ${normalized.version ? ('v' + normalized.version + ' ') : ''}(local)`
                                            btn.addEventListener('click', async () => {
                                                try {
                                                    await applyConfigToWorkspace(normalized)
                                                    closeModal(configModal)
                                                } catch (e) {
                                                    const msg = 'Failed to load local author config: ' + (e && e.message ? e.message : e)
                                                    try { showConfigError(msg, configModal) } catch (_err) { }
                                                }
                                            })
                                            listContainer.appendChild(btn)
                                            hasConfigs = true
                                        }
                                    } catch (e) {
                                        // Malformed author config or failed validation
                                        logWarn('Invalid local author config in storage', e)
                                        try { showConfigError('Invalid local author config in storage', configModal) } catch (_e) { }
                                    }
                                }
                            } catch (_e) { }

                            // Add server configs
                            if (!items || !items.length) {
                                if (!hasConfigs) {
                                    listContainer.textContent = '(no configurations available)'
                                }
                            } else {
                                for (const name of items) {
                                    try {
                                        // Try to fetch the config metadata (title/version) for a nicer display.
                                        let meta = null
                                        try {
                                            const url = /^https?:\/\//i.test(name) ? name : './config/' + encodeURIComponent(name)
                                            const r = await fetch(url)
                                            if (r && r.ok) {
                                                try { meta = await r.json() } catch (_e) { meta = null }
                                            }
                                        } catch (_e) { meta = null }

                                        const displayTitle = (meta && meta.title) ? meta.title : name
                                        const versionText = (meta && meta.version) ? ('v' + meta.version) : ''
                                        const label = versionText ? `${displayTitle} ${versionText}` : displayTitle

                                        const btn = document.createElement('button')
                                        btn.className = 'btn'
                                        btn.style.display = 'block'
                                        btn.style.width = '100%'
                                        btn.style.textAlign = 'left'
                                        btn.style.marginBottom = '4px'
                                        btn.textContent = label
                                            // Best-effort: asynchronously check if this config has a success snapshot
                                            ; (async () => {
                                                try {
                                                    const { getSuccessSnapshotForConfig } = await import('./js/snapshots.js')
                                                    // Construct a likely identity: prefer meta.id@meta.version if available,
                                                    // otherwise use the raw name source which is passed into the click handler.
                                                    let identity = null
                                                    if (meta && meta.id && meta.version) identity = `${meta.id}@${meta.version}`
                                                    if (!identity) identity = name
                                                    const snap = await getSuccessSnapshotForConfig(identity)
                                                    if (snap) {
                                                        const star = document.createElement('span')
                                                        star.textContent = ' ★'
                                                        star.style.color = '#2e7d32'
                                                        star.style.marginLeft = '6px'
                                                        btn.appendChild(star)
                                                    }
                                                } catch (_e) { }
                                            })()
                                        // keep original filename/identifier available for click handler
                                        btn.dataset.configSource = name
                                        btn.addEventListener('click', async () => {
                                            try {
                                                const source = btn.dataset.configSource || name
                                                const normalized = await loadConfigFromStringOrUrl(source)
                                                await applyConfigToWorkspace(normalized)
                                                closeModal(configModal)
                                            } catch (e) {
                                                // keep modal open and show inline error (use enhanced error message from config.js)
                                                try {
                                                    const msg = 'Failed to load config: ' + (e && e.message ? e.message : e)
                                                    if (errorEl) errorEl.textContent = msg
                                                    logError('Failed to load config', e)
                                                    // Also set the global inline config error so it's visible when modal is opened next
                                                    try { showConfigError(msg, configModal) } catch (_e) { }
                                                } catch (_err) { }
                                            }
                                        })
                                        listContainer.appendChild(btn)
                                        hasConfigs = true
                                    } catch (_e) { }
                                }
                            }
                        }
                    } catch (_e) { }
                }
                // attach activation handlers
                configInfoEl.addEventListener('click', openHandler)
                configInfoEl.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openHandler(ev) }
                })
            }

            // URL load button
            const urlBtn = document.getElementById('config-load-url')
            if (urlBtn) {
                urlBtn.addEventListener('click', async () => {
                    try {
                        const input = document.getElementById('config-url-input')
                        const val = input ? String(input.value || '').trim() : ''
                        if (!val) return

                        // Resolve a possibly-relative URL against the current location
                        let resolved = val
                        try { resolved = decodeURIComponent(val) } catch (_e) { resolved = val }
                        try {
                            if (!/^(https?:)?\/\//i.test(resolved)) {
                                // treat plain names or relative paths as relative to current page
                                if (resolved.startsWith('./') || resolved.startsWith('/')) {
                                    resolved = new URL(resolved, window.location.href).href
                                } else {
                                    // prefix './' so new URL resolves relative to current path
                                    resolved = new URL('./' + resolved, window.location.href).href
                                }
                            }
                        } catch (_e) { /* if URL resolution fails, leave as-is and let fetch error */ }

                        // Fetch the provided URL first so we can detect whether the
                        // resource is an array (config list), an object with files/listName, or a single config object.
                        const res = await fetch(resolved)
                        if (!res || !res.ok) throw new Error('Failed to fetch: ' + (res && res.status))
                        let raw
                        try { raw = await res.json() } catch (e) { throw new Error('Failed to parse JSON from ' + resolved + ': ' + e.message) }

                        if (raw && typeof raw === 'object' && Array.isArray(raw.files)) {
                            // Treat as a remote config list (new object shape only)
                            const items = raw.files
                            const listName = raw.listName ? String(raw.listName) : null
                            window.__ssg_remote_config_list = { url: resolved, items: items, listName }

                            // Auto-load the first item by default (resolve relative to list URL)
                            if (items.length > 0) {
                                let first = items[0]
                                try {
                                    const listBase = resolved.endsWith('/') ? resolved : resolved.replace(/[^/]*$/, '')
                                    if (!/^(https?:)?\/\//i.test(first)) {
                                        first = new URL(first, listBase).href
                                    }
                                } catch (_e) { }
                                try {
                                    const normalized = await loadConfigFromStringOrUrl(first)
                                    await applyConfigToWorkspace(normalized)
                                } catch (e) {
                                    try { showConfigError('Failed to load first configuration from list: ' + (e && e.message ? e.message : e), configModal) } catch (_e) { }
                                }
                            }

                            // Update or create header dropdown to reflect the loaded list
                            try {
                                const titleLine = document.querySelector('.config-title-line')
                                const container = titleLine && titleLine.parentElement ? titleLine.parentElement : null
                                if (container && titleLine) {
                                    let select = document.getElementById('config-select-header')
                                    if (!select) {
                                        select = document.createElement('select')
                                        select.id = 'config-select-header'
                                        select.className = 'config-select-header'
                                        container.insertBefore(select, titleLine)
                                        titleLine.style.display = 'none'
                                        select.addEventListener('change', async (ev) => {
                                            try {
                                                const val2 = select.value
                                                if (!val2) return
                                                let toLoad = val2
                                                if (val2.startsWith('__list::') && window.__ssg_remote_config_list) {
                                                    const idx = parseInt(val2.split('::')[1], 10)
                                                    let source = window.__ssg_remote_config_list.items[idx]
                                                    if (!source) return
                                                    try {
                                                        const listUrl = window.__ssg_remote_config_list.url
                                                        const base = listUrl.endsWith('/') ? listUrl : listUrl.replace(/[^/]*$/, '')
                                                        source = /^(https?:)?\/\//i.test(source) ? source : new URL(source, base).href
                                                    } catch (_e) { }
                                                    toLoad = source
                                                }
                                                const normalized = await loadConfigFromStringOrUrl(toLoad)
                                                await applyConfigToWorkspace(normalized)
                                            } catch (e) {
                                                const msg = 'Failed to load selected configuration: ' + (e && e.message ? e.message : e)
                                                try { showConfigError(msg, configModal) } catch (_e) { }
                                            }
                                        })
                                    }

                                    // Populate options
                                    select.innerHTML = ''
                                    const optPlaceholder = document.createElement('option')
                                    optPlaceholder.value = ''
                                    optPlaceholder.textContent = 'Select configuration…'
                                    select.appendChild(optPlaceholder)
                                    for (let i = 0; i < items.length; i++) {
                                        const it = String(items[i])
                                        const opt = document.createElement('option')
                                        opt.value = '__list::' + i
                                        opt.textContent = it
                                        select.appendChild(opt)
                                    }
                                    if (items.length > 0) select.value = '__list::0'
                                }
                            } catch (_e) { }

                            // Close modal after successful handling
                            if (configModal) closeModal(configModal)

                        } else if (raw && typeof raw === 'object') {
                            // Treat as a single config object
                            try {
                                const normalized = validateAndNormalizeConfig(raw)
                                await applyConfigToWorkspace(normalized)
                                if (configModal) closeModal(configModal)
                            } catch (e) {
                                try { showConfigError('Failed to load configuration from URL: ' + (e && e.message ? e.message : e), configModal) } catch (_e) { }
                            }
                        } else {
                            throw new Error('Unexpected JSON response')
                        }
                    } catch (e) {
                        try { showConfigError('Failed to load config from URL: ' + (e && e.message ? e.message : e), configModal) } catch (_e) { }
                    }
                })
            }

            // File picker and drop area - make entire modal droppable
            const filePickerBtn = document.getElementById('config-file-picker')
            const fileInput = document.getElementById('config-file-input')
            const dropArea = document.getElementById('config-drop-area')
            if (filePickerBtn && fileInput) {
                filePickerBtn.addEventListener('click', () => { try { fileInput.click() } catch (_e) { } })
                fileInput.addEventListener('change', async (ev) => {
                    try {
                        const f = ev && ev.target && ev.target.files ? ev.target.files[0] : null
                        if (!f) return
                        const normalized = await loadConfigFromFile(f)
                        await applyConfigToWorkspace(normalized)
                        if (configModal) closeModal(configModal)
                    } catch (e) {
                        try { showConfigError('Failed to load config file: ' + (e && e.message ? e.message : e), configModal) } catch (_e) { }
                    }
                })
            }

            // Make entire modal droppable for JSON files
            if (configModal) {
                let dragCounter = 0

                configModal.addEventListener('dragenter', (e) => {
                    e.preventDefault()
                    dragCounter++
                    configModal.classList.add('drag-over')
                })

                configModal.addEventListener('dragleave', (e) => {
                    e.preventDefault()
                    dragCounter--
                    if (dragCounter === 0) {
                        configModal.classList.remove('drag-over')
                    }
                })

                configModal.addEventListener('dragover', (e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'copy'
                })

                configModal.addEventListener('drop', async (e) => {
                    e.preventDefault()
                    dragCounter = 0
                    configModal.classList.remove('drag-over')
                    try {
                        const f = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null
                        if (!f) return
                        const normalized = await loadConfigFromFile(f)
                        await applyConfigToWorkspace(normalized)
                        closeModal(configModal)
                    } catch (err) {
                        try { showConfigError('Failed to load dropped config: ' + (err && err.message ? err.message : err), configModal) } catch (_e) { }
                    }
                })
            }

            // Keep the drop area for the visual hint
            if (dropArea) {
                dropArea.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' })
                dropArea.addEventListener('drop', async (e) => {
                    e.preventDefault()
                    try {
                        const f = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null
                        if (!f) return
                        const normalized = await loadConfigFromFile(f)
                        await applyConfigToWorkspace(normalized)
                        if (configModal) closeModal(configModal)
                    } catch (err) {
                        try { showConfigError('Failed to load dropped config: ' + (err && err.message ? err.message : err), configModal) } catch (_e) { }
                    }
                })
            }

            // Close button
            const configClose = document.getElementById('config-close')
            if (configClose && configModal) configClose.addEventListener('click', () => { try { closeModal(configModal) } catch (_e) { } })

            // Author page button
            const authorPageBtn = document.getElementById('config-author-page')
            if (authorPageBtn) {
                authorPageBtn.addEventListener('click', () => {
                    try {
                        // Set flag for return detection
                        sessionStorage.setItem('returningFromAuthor', 'true')
                        // Navigate to author page
                        window.location.href = 'author/'
                    } catch (e) {
                        logError('Failed to navigate to author page:', e)
                    }
                })
            }
        } catch (_e) { }

        logInfo('✅ Clipy application initialized successfully')
        // Clear startup suppression so user actions can switch to terminal normally
        try { if (typeof window !== 'undefined') window.__ssg_suppress_terminal_autoswitch = false } catch (_e) { }

    } catch (error) {
        logError('❌ Failed to initialize Clipy application:', error)

        // Show error to user
        const instructionsContent = $('instructions-content')
        if (instructionsContent) {
            instructionsContent.textContent = `Failed to initialize application: ${error.message || error}`
        }
    }
}

// Update DOM indicators for solved status: app title, config title line, and config list entries
async function updateSuccessIndicators() {
    try {
        const { getSuccessSnapshotForCurrentConfig } = await import('./js/snapshots.js')
        const success = !!(await getSuccessSnapshotForCurrentConfig())

        const appTitle = document.getElementById('app-title')
        const configTitleLine = document.querySelector('.config-title-line')

        function ensureIndicator(host) {
            if (!host) return
            let el = host.querySelector('.success-indicator')
            if (success) {
                if (!el) {
                    el = document.createElement('span')
                    el.className = 'success-indicator'
                    el.textContent = ' ★'
                    el.style.color = '#2e7d32'
                    el.style.fontWeight = '700'
                    el.style.marginLeft = '6px'
                    host.appendChild(el)
                }
            } else {
                if (el) try { el.parentElement && el.parentElement.removeChild(el) } catch (_e) { }
            }
        }

        ensureIndicator(appTitle)
        ensureIndicator(configTitleLine)

        // For config-select-header options, add a star to option labels when success
        try {
            const select = document.getElementById('config-select-header')
            if (select) {
                // If current config is a single loaded config, the select may be removed; ignore
                for (const opt of Array.from(select.options || [])) {
                    // Do not mutate placeholder option
                    if (!opt.value) continue
                    try {
                        const cur = (window.Config && window.Config.current) ? `${window.Config.current.id}@${window.Config.current.version}` : null
                        // Prefer attached identity when available
                        const optIdentity = (opt.dataset && opt.dataset.identity) ? opt.dataset.identity : (typeof opt.value === 'string' ? opt.value : null)
                        if (cur && optIdentity && optIdentity === cur && success) {
                            if (!opt.text.includes('★')) opt.text = opt.text + ' ★'
                        } else {
                            opt.text = opt.text.replace(/\s*★\s*$/, '')
                        }
                    } catch (_e) { }
                }
            }
        } catch (_e) { }
    } catch (e) {
        try { console.warn('updateSuccessIndicators failed', e) } catch (_e) { }
    }
}

// Helper to create or update the header select dropdown from a serverItems array
function createOrUpdateHeaderSelect(serverItems, hasRemoteList) {
    try {
        if (!serverItems || !Array.isArray(serverItems)) serverItems = []
        let select = document.getElementById('config-select-header')
        const titleLine = document.querySelector('.config-title-line')
        const container = titleLine && titleLine.parentElement ? titleLine.parentElement : null
        if (!container) return
        if (!select) {
            select = document.createElement('select')
            select.id = 'config-select-header'
            select.className = 'config-select-header'
            container.insertBefore(select, titleLine)
            if (titleLine) titleLine.style.display = 'none'
            select.addEventListener('change', async (ev) => {
                try {
                    // Debug: capture select state and remote list summary
                    const val = select.value
                    const optsDbg = Array.from(select.options || []).map(o => ({ value: o.value, text: o.text, identity: (o.dataset && o.dataset.identity) ? o.dataset.identity : null }))
                    const remoteList = (window.__ssg_remote_config_list && Array.isArray(window.__ssg_remote_config_list.items)) ? { url: window.__ssg_remote_config_list.url, length: window.__ssg_remote_config_list.items.length } : null
                    // debug logs removed

                    if (!val) return
                    let toLoad = val
                    if (val.startsWith('__list::') && window.__ssg_remote_config_list) {
                        const idx = parseInt(val.split('::')[1], 10)
                        let source = window.__ssg_remote_config_list.items[idx]
                        if (!source) return
                        try {
                            const listUrl = window.__ssg_remote_config_list.url
                            const base = listUrl.endsWith('/') ? listUrl : listUrl.replace(/[^/]*$/, '')
                            if (!/^(https?:)?\/\//i.test(source)) {
                                if (source.startsWith('./') || source.startsWith('/')) {
                                    source = new URL(source, base).href
                                } else if (/^(https?:)?\/\//i.test(listUrl)) {
                                    source = new URL(source, base).href
                                }
                            }
                        } catch (err) { /* ignore resolution errors */ }
                        toLoad = source
                    }

                    // Attempt to load and apply the selected config, logging any load errors
                    try {
                        // attempting to load selected config
                        const normalized = await loadConfigFromStringOrUrl(toLoad)
                        await applyConfigToWorkspace(normalized)
                    } catch (err) {
                        throw err
                    }
                } catch (e) {
                    const msg = 'Failed to load selected configuration: ' + (e && e.message ? e.message : e)
                    try { showConfigError(msg, document.getElementById('config-modal')) } catch (_e) { }
                }
            })
        }

        // Populate options synchronously
        select.innerHTML = ''
        const optPlaceholder = document.createElement('option')
        optPlaceholder.value = ''
        optPlaceholder.textContent = 'Select configuration…'
        select.appendChild(optPlaceholder)

        for (const it of serverItems) {
            const opt = document.createElement('option')
            if (typeof it === 'string') {
                opt.value = it
                opt.textContent = it
            } else {
                // expected shape: { label, value }
                opt.value = it.value || String(it)
                opt.textContent = it.label || String(it.value || it)
            }
            select.appendChild(opt)
        }

        try {
            // Debug: report options and their identities after population
            const postOpts = Array.from(select.options || []).map(o => ({ value: o.value, text: o.text, identity: (o.dataset && o.dataset.identity) ? o.dataset.identity : null }))
            // header select created
        } catch (_e) { }

        // If remote list, select first visually
        try {
            if (hasRemoteList && serverItems && serverItems.length > 0) {
                // serverItems for remote lists use '__list::idx' values
                select.value = '__list::0'
            }
        } catch (_e) { }

        // Attach best-effort identities to options synchronously and
        // trigger a single badge refresh. This keeps decoration simple:
        // - derive a stable identity for each option immediately (best-effort)
        // - store it in `data-identity` so future updates can match quickly
        // - perform badge decoration via `refreshConfigSelectBadges()` which
        //   already handles snapshot lookups and star toggling.
        try {
            const opts = Array.from(select.options || [])
            for (const opt of opts) {
                try {
                    if (!opt.value) continue
                    let identity = ''
                    if (typeof opt.value === 'string' && opt.value.indexOf('__list::') === 0 && window.__ssg_remote_config_list) {
                        const idx = parseInt(opt.value.split('::')[1], 10)
                        let source = window.__ssg_remote_config_list.items[idx]
                        if (!source) {
                            identity = opt.value
                        } else {
                            // Resolve relative to list URL when appropriate (best-effort)
                            try {
                                const listUrl = window.__ssg_remote_config_list.url
                                if (typeof source === 'string' && listUrl && /^(https?:)?\/\//i.test(listUrl) && !/^(https?:)?\/\//i.test(source)) {
                                    source = new URL(source, listUrl.endsWith('/') ? listUrl : listUrl.replace(/[^/]*$/, '')).href
                                }
                            } catch (_e) { }
                            identity = typeof source === 'string' ? source : String(source)
                        }
                    } else {
                        identity = typeof opt.value === 'string' ? opt.value : String(opt.value)
                    }
                    opt.dataset.identity = identity
                } catch (_e) { /* ignore individual option failures */ }
            }
            // Single async refresh to decorate stars based on current snapshot data
            try { setTimeout(() => { try { refreshConfigSelectBadges() } catch (_e) { } }, 0) } catch (_e) { }
        } catch (_e) { }
    } catch (e) {
        try { console.warn('createOrUpdateHeaderSelect failed', e) } catch (_e) { }
    }
}

// Listen for success snapshot changes to update UI
try {
    window.addEventListener && window.addEventListener('ssg:success-saved', (ev) => { try { const cfg = ev && ev.detail ? ev.detail.config : null; updateSuccessIndicators(); refreshConfigSelectBadges(cfg); refreshModalConfigListBadges(cfg) } catch (_e) { } })
    window.addEventListener && window.addEventListener('ssg:success-cleared', (ev) => { try { const cfg = ev && ev.detail ? ev.detail.config : null; updateSuccessIndicators(); refreshConfigSelectBadges(cfg); refreshModalConfigListBadges(cfg) } catch (_e) { } })
} catch (_e) { }

// Refresh just the header select option badges by re-checking success snapshots
async function refreshConfigSelectBadges(changedConfigIdentity) {
    try {
        const select = document.getElementById('config-select-header')
        if (!select) return
        const { getSuccessSnapshotForConfig } = await import('./js/snapshots.js')
        for (const opt of Array.from(select.options || [])) {
            try {
                if (!opt.value) continue

                // Derive a best-effort identity for this option. Prefer an
                // attached dataset.identity, otherwise resolve __list::idx -> source.
                let identity = (opt.dataset && opt.dataset.identity) ? opt.dataset.identity : null
                if (!identity) {
                    try {
                        if (typeof opt.value === 'string' && opt.value.indexOf('__list::') === 0 && window.__ssg_remote_config_list) {
                            const idx = parseInt(opt.value.split('::')[1], 10)
                            let source = window.__ssg_remote_config_list.items[idx]
                            if (source) {
                                try {
                                    const listUrl = window.__ssg_remote_config_list.url
                                    if (typeof source === 'string' && listUrl && /^(https?:)?\/\//i.test(listUrl) && !/^(https?:)?\/\//i.test(source)) {
                                        source = new URL(source, listUrl.endsWith('/') ? listUrl : listUrl.replace(/[^/]*$/, '')).href
                                    }
                                } catch (_e) { }
                                identity = typeof source === 'string' ? source : String(source)
                                opt.dataset.identity = identity
                            } else {
                                identity = opt.value
                                opt.dataset.identity = identity
                            }
                        } else {
                            identity = typeof opt.value === 'string' ? opt.value : String(opt.value)
                            opt.dataset.identity = identity
                        }
                    } catch (_e) {
                        identity = typeof opt.value === 'string' ? opt.value : String(opt.value)
                        try { opt.dataset.identity = identity } catch (_e2) { }
                    }
                }

                // If a snapshot exists under the derived identity, decorate now.
                let snap = null
                try {
                    snap = identity ? await getSuccessSnapshotForConfig(identity) : null
                } catch (_e) { snap = null }

                // If no snapshot found and identity looks like a remote URL, try
                // a best-effort fetch to obtain a canonical `id@version` identity
                // and re-check. This is background-only and won't block the UI.
                if (!snap && identity && /^(https?:)?\/\//i.test(String(identity))) {
                    (async () => {
                        try {
                            const r = await fetch(String(identity))
                            if (r && r.ok) {
                                try {
                                    const parsed = await r.json()
                                    if (parsed && parsed.id && parsed.version) {
                                        const canonical = `${parsed.id}@${parsed.version}`
                                        try { opt.dataset.identity = canonical } catch (_e) { }
                                        const snap2 = await getSuccessSnapshotForConfig(canonical)
                                        if (snap2) {
                                            if (!opt.text.includes('★')) opt.text = opt.text + ' ★'
                                            return
                                        }
                                    }
                                } catch (_e) { }
                            }
                        } catch (_e) { }
                    })()
                }

                // Apply or remove star based on snapshot check
                if (snap) {
                    if (!opt.text.includes('★')) opt.text = opt.text + ' ★'
                } else {
                    opt.text = opt.text.replace(/\s*★\s*$/, '')
                }
            } catch (_e) { }
        }
    } catch (_e) { }
}

// Refresh the modal config-server-list buttons to add/remove stars
async function refreshModalConfigListBadges(changedConfigIdentity) {
    try {
        const listContainer = document.getElementById('config-server-list')
        if (!listContainer) return
        const { getSuccessSnapshotForConfig } = await import('./js/snapshots.js')
        const buttons = Array.from(listContainer.querySelectorAll('button.btn'))
        for (const btn of buttons) {
            try {
                // Determine candidate identity: prefer dataset.configSource or button text
                const source = btn.dataset && btn.dataset.configSource ? btn.dataset.configSource : null
                let identity = null
                if (source) identity = source
                else {
                    // Try to extract id@version from button text (best-effort)
                    const txt = (btn.textContent || '').trim()
                    // Remove any existing star
                    const normalized = txt.replace(/\s*★\s*$/, '')
                    identity = normalized
                }
                if (!identity) continue
                if (changedConfigIdentity && !identity.includes(changedConfigIdentity) && identity !== changedConfigIdentity) {
                    // remove star if present
                    btn.textContent = (btn.textContent || '').replace(/\s*★\s*$/, '')
                    continue
                }
                const snap = await getSuccessSnapshotForConfig(identity)
                // Remove existing star nodes
                btn.textContent = (btn.textContent || '').replace(/\s*★\s*$/, '')
                if (snap) {
                    const star = document.createElement('span')
                    star.textContent = ' ★'
                    star.style.color = '#2e7d32'
                    star.style.marginLeft = '6px'
                    btn.appendChild(star)
                }
            } catch (_e) { }
        }
    } catch (_e) { }
}

// Safety: ensure header select exists when a remote config list is present but
// the dropdown was not inserted due to a timing race. Use short polling to
// wait for the header title container (`.config-title-line`) to be available
// and then create the select; try a few times then give up to avoid leaks.
try {
    if (typeof window !== 'undefined') {
        const remote = window.__ssg_remote_config_list
        if (remote && Array.isArray(remote.items) && !document.getElementById('config-select-header')) {
            let attempts = 0
            const maxAttempts = 20
            const interval = setInterval(() => {
                try {
                    attempts++
                    const titleLine = document.querySelector('.config-title-line')
                    if (titleLine) {
                        // Build serverItems with friendly labels and call the shared creator
                        const serverItems = remote.items.map((it, i) => ({ label: typeof it === 'string' ? it : (it.label || String(it)), value: '__list::' + i }))
                        try { createOrUpdateHeaderSelect(serverItems, true) } catch (_e) { }
                        clearInterval(interval)
                        return
                    }
                    if (attempts >= maxAttempts) {
                        clearInterval(interval)
                    }
                } catch (_e) {
                    try { clearInterval(interval) } catch (_err) { }
                }
            }, 50)
        }
    }
} catch (_e) { }

// Initialize the student identifier input field
function initializeStudentIdentifier() {
    try {
        const studentIdInput = document.getElementById('student-id-input')
        if (!studentIdInput) return

        // Keep layout simple: student-id container is inline and will flow
        // naturally after the config title. Avoid absolute positioning to
        // prevent overlap on narrow viewports.

        // Load saved student identifier
        const savedId = getStudentIdentifier()
        if (savedId) {
            studentIdInput.value = savedId
        }

        // Save on input change with debouncing
        let timeoutId = null
        studentIdInput.addEventListener('input', () => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(() => {
                setStudentIdentifier(studentIdInput.value)
                logDebug('Student identifier updated:', studentIdInput.value || '(cleared)')
            }, 500) // 500ms debounce
        })

        // Save immediately on blur
        studentIdInput.addEventListener('blur', () => {
            clearTimeout(timeoutId)
            setStudentIdentifier(studentIdInput.value)
        })

        // Initial alignment after DOM/setup
        try { if (typeof alignStudentId === 'function') alignStudentId() } catch (_e) { }

        logDebug('Student identifier input initialized')
    } catch (e) {
        logWarn('Failed to initialize student identifier:', e)
    }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main)
} else {
    main()
}
