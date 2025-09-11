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

// Quiet specific tagged debug messages unless window.__SSG_DEBUG is true.
// This wrapper filters console.debug calls whose first argument is a
// string starting with [app], [runner], or [sandbox]. Other debug calls
// are passed through unchanged.
try {
    (function () {
        if (typeof console === 'undefined' || typeof console.debug !== 'function') return
        const _origDebug = console.debug.bind(console)
        console.debug = function (...args) {
            try {
                const first = args && args.length ? args[0] : null
                if (typeof first === 'string' && (first.startsWith('[app]') || first.startsWith('[runner]') || first.startsWith('[sandbox]'))) {
                    if (typeof window !== 'undefined' && window.__SSG_DEBUG) {
                        return _origDebug(...args)
                    }
                    return
                }
            } catch (_e) { }
            return _origDebug(...args)
        }
    })()
} catch (_e) { }

// Additional features
import { setupSnapshotSystem } from './js/snapshots.js'
import { setupDownloadSystem } from './js/download.js'
import { showStorageInfo } from './js/storage-manager.js'
import { resetFeedback, evaluateFeedbackOnEdit, evaluateFeedbackOnRun, on as feedbackOn, off as feedbackOff } from './js/feedback.js'
import { initializeFeedbackUI, setFeedbackMatches, setFeedbackConfig } from './js/feedback-ui.js'

// Check if authoring mode is enabled via URL parameter
function isAuthoringEnabled() {
    try {
        const params = new URLSearchParams(window.location.search)
        // Check for various authoring parameter formats
        const hasAuthorParam = params.has('author') ||
            params.get('authoring') === 'true' ||
            params.get('author') === 'true' ||
            params.has('authoring')

        // Also check if returning from authoring page
        const returningFromAuthor = sessionStorage.getItem('returningFromAuthor') === 'true'

        return hasAuthorParam || returningFromAuthor
    } catch (e) {
        return false
    }
}

// Add author flag to URL if not present when authoring is enabled
function ensureAuthorFlag() {
    try {
        if (isAuthoringEnabled()) {
            const params = new URLSearchParams(window.location.search)
            if (!params.has('author') && !params.has('authoring')) {
                // Add author flag to current URL
                params.set('author', 'true')
                const newUrl = window.location.pathname + '?' + params.toString()
                window.history.replaceState({}, '', newUrl)
            }
        }
    } catch (e) {
        logWarn('Failed to ensure author flag:', e)
    }
}

// Expose global functions for tests and debugging
try {
    window.__ssg_transform = transformAndWrap
    // Expose Config object for tests
    window.Config = {
        current: null,
        getConfigIdentity,
        getConfigKey,
        validateAndNormalizeConfig
    }
    // Expose storage info for debugging
    window.showStorageInfo = showStorageInfo
    // Expose config debug helper
    window.debugCurrentConfig = debugCurrentConfig
    // Expose snapshot storage debug helper
    try {
        const { debugSnapshotStorage } = await import('./js/snapshots.js')
        window.debugSnapshotStorage = debugSnapshotStorage
    } catch (_e) { }
    // Expose highlight helpers for tests/debugging
    try { window.highlightMappedTracebackInEditor = highlightMappedTracebackInEditor } catch (_e) { }
    try { window.highlightFeedbackLine = highlightFeedbackLine } catch (_e) { }
} catch (_e) { }

// Startup debug helper - enable by setting `window.__ssg_debug_startup = true`
try {
    if (typeof window !== 'undefined') {
        window.__ssg_debug_startup = window.__ssg_debug_startup || false
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
        // 2. Saved current_config from unified storage
        // 3. Default sample config
        let cfg = null
        try {
            if (typeof window !== 'undefined') {
                try {
                    const params = new URLSearchParams(window.location.search)
                    const cfgParam = params.get('config')
                    if (cfgParam) {
                        try {
                            // Users may provide an encoded URL; attempt decodeURIComponent safely
                            let toLoad = cfgParam
                            try { toLoad = decodeURIComponent(cfgParam) } catch (_e) { }
                            cfg = await loadConfigFromStringOrUrl(toLoad)
                            dbg('dbg: loaded config from ?config= parameter')
                        } catch (e) {
                            logWarn('Failed to load config from ?config= parameter:', e)
                            // Surface the error to the user by opening the config modal
                            try { showConfigError('Failed to load configuration from URL: ' + (e && e.message ? e.message : e), document.getElementById('config-modal')) } catch (_e) { }
                            // fall back to normal load below
                        }
                    }
                } catch (_e) { }
            }
        } catch (_e) { }

        // If no URL config, try loading saved current config
        if (!cfg) {
            try {
                logInfo('main: attempting to load current config from unified storage')
                const savedConfig = await loadCurrentConfig()
                if (savedConfig) {
                    cfg = savedConfig
                    // Set this as the current config so helpers reflect the right identity
                    setCurrentConfig(cfg)
                    logInfo('main: loaded config from unified storage:', cfg.id, cfg.version)
                } else {
                    logInfo('main: no current config found in unified storage')
                }
            } catch (e) {
                logWarn('Failed to load current config:', e)
            }
        }

        // Fall back to default sample config
        if (!cfg) {
            logInfo('main: no saved config, loading default sample config')
            cfg = await loadConfig()
            logInfo('main: loaded default config:', cfg.id, cfg.version)
        }

        // Save the loaded config as current (whether from URL, unified storage, or default)
        try {
            setCurrentConfig(cfg)
            await saveCurrentConfig(cfg)
            // Debug what was actually saved
            logDebug('=== Config Loading Debug ===')
            logDebug('Final loaded config:', cfg.id, cfg.version)
            debugCurrentConfig()
        } catch (e) {
            logWarn('Failed to save current config:', e)
        }

        initializeInstructions(cfg)

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
                        } catch (_e) { }
                        if (window.Feedback && typeof window.Feedback.evaluateFeedbackOnRun === 'function') {
                            for (const r of results) {
                                if (!r.passed) {
                                    try { window.Feedback.evaluateFeedbackOnRun({ stdout: r.stdout || '', stderr: r.stderr || '' }) } catch (_e) { }
                                }
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

                        // Reload canonical config
                        let newCfg = null
                        if (mod && typeof mod.resetToLoadedConfig === 'function') {
                            newCfg = await mod.resetToLoadedConfig()
                        } else {
                            newCfg = (await mod.loadConfig())
                        }

                        // Replace filesystem contents with what's defined in the config.
                        try {
                            const vfs = await import('./js/vfs-client.js')
                            const getFileManager = vfs.getFileManager
                            const MAIN_FILE = vfs.MAIN_FILE
                            const FileManager = (typeof getFileManager === 'function') ? getFileManager() : null
                            if (FileManager) {
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
                            }
                        } catch (e) {
                            try { appendTerminal('Failed to reset filesystem: ' + e, 'runtime') } catch (_e) { }
                        }

                        // Refresh tabs/editor to reflect programmatic filesystem changes
                        try {
                            if (window.TabManager && typeof window.TabManager.syncWithFileManager === 'function') {
                                try { await window.TabManager.syncWithFileManager() } catch (_e) { }
                            }
                        } catch (_e) { }

                        // Force-refresh the content of the visible editor/tab
                        try {
                            if (window.TabManager && typeof window.TabManager.refreshOpenTabContents === 'function') {
                                try { window.TabManager.refreshOpenTabContents() } catch (_e) { }
                            }
                        } catch (_e) { }

                        // Update global config reference used elsewhere
                        try { window.Config = window.Config || {}; window.Config.current = newCfg } catch (_e) { }
                        // Refresh feedback UI with new config if available
                        try { if (typeof window.__ssg_set_feedback_config === 'function') window.__ssg_set_feedback_config(newCfg) } catch (_e) { }
                        try { appendTerminal('Workspace reset to loaded configuration', 'runtime') } catch (_e) { }
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
                // DEBUG: print tests shapes so we can see ast rule presence
                try {
                    const summary = (tests || []).map(t => ({ id: t && t.id, type: t && t.type, keys: Object.keys(t || {}) }))
                    logDebug('[app] running tests summary:', JSON.stringify(summary, null, 2))
                } catch (_e) { }
                await runPythonCode(code, cfg)
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
        async function applyConfigToWorkspace(newCfg) {
            try {
                const vfs = await import('./js/vfs-client.js')
                const getFileManager = vfs.getFileManager
                const MAIN_FILE = vfs.MAIN_FILE
                const FileManager = (typeof getFileManager === 'function') ? getFileManager() : null
                if (FileManager) {
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
                }

                // Save this config as the current config for future sessions
                try {
                    saveCurrentConfig(newCfg)
                } catch (_e) { }

                // Update global config reference BEFORE checking for snapshots
                // This ensures getSnapshotsForCurrentConfig() uses the new config's identity
                try { setCurrentConfig(newCfg) } catch (_e) { try { window.Config = window.Config || {}; window.Config.current = newCfg } catch (_e2) { } }

                // Try to restore the latest snapshot for this NEW config (if compatible)
                try {
                    const { getSnapshotsForCurrentConfig } = await import('./js/snapshots.js')
                    const snapshots = getSnapshotsForCurrentConfig()
                    if (snapshots && snapshots.length > 0) {
                        // Get the most recent snapshot
                        const latestSnapshot = snapshots[snapshots.length - 1]
                        const snapshotConfigVersion = latestSnapshot.metadata?.configVersion
                        const currentConfigVersion = newCfg?.version

                        if (isConfigCompatibleWithSnapshot(currentConfigVersion, snapshotConfigVersion)) {
                            // Restore the snapshot files for this config
                            if (latestSnapshot.files && FileManager) {
                                for (const [path, content] of Object.entries(latestSnapshot.files)) {
                                    try {
                                        await FileManager.write(path, content)
                                    } catch (_e) { }
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

                // Refresh tabs/editor and ensure MAIN_FILE remains selected
                try { if (window.TabManager && typeof window.TabManager.syncWithFileManager === 'function') await window.TabManager.syncWithFileManager() } catch (_e) { }
                try { if (window.TabManager && typeof window.TabManager.refreshOpenTabContents === 'function') window.TabManager.refreshOpenTabContents() } catch (_e) { }
                try { if (window.TabManager && typeof window.TabManager.selectTab === 'function') window.TabManager.selectTab(MAIN_FILE) } catch (_e) { }

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
                } catch (_e) { }
                try { appendTerminal('Workspace configured: ' + (newCfg && newCfg.title ? newCfg.title : 'loaded'), 'runtime') } catch (_e) { }
            } catch (e) {
                try { appendTerminal('Failed to apply configuration: ' + e, 'runtime') } catch (_e) { }
            }
        }

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

        // Wire config modal UI (open on header click, server list population, URL load, file upload/drop)
        try {
            // Prefer the visible config title element for activation so
            // interactive controls inside the header (reset button, student ID input)
            // don't accidentally open the config modal via event bubbling.
            const configInfoEl = document.querySelector('.config-title-line') || document.querySelector('.config-info')
            const configModal = document.getElementById('config-modal')
            if (configInfoEl && configModal) {
                // Handle authoring mode setup
                ensureAuthorFlag()
                const authoringEnabled = isAuthoringEnabled()

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
                            const items = await fetchAvailableServerConfigs()
                            listContainer.innerHTML = ''
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
                        const val = input ? input.value : ''
                        if (!val) return
                        const normalized = await loadConfigFromStringOrUrl(val)
                        await applyConfigToWorkspace(normalized)
                        if (configModal) closeModal(configModal)
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
