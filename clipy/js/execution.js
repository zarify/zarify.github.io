// Python code execution engine
import { appendTerminal, appendTerminalDebug, setTerminalInputEnabled, activateSideTab, enableStderrBuffering, replaceBufferedStderr, flushStderrBufferRaw, clearTerminal } from './terminal.js'
import { getRuntimeAdapter, setExecutionRunning, getExecutionState, interruptMicroPythonVM } from './micropython.js'
import { getFileManager, MAIN_FILE, markExpectedWrite, setSystemWriteMode } from './vfs-client.js'
import { transformAndWrap, mapTracebackAndShow, highlightMappedTracebackInEditor, clearAllErrorHighlights, clearAllFeedbackHighlights } from './code-transform.js'
import { getExecutionRecorder } from './execution-recorder.js'

// Helper to safely stringify thrown values. Some runtimes (wasm/emscripten)
// can throw non-Error values (eg. `throw Infinity;`). This ensures logs show
// a readable message and any available stack information.
function stringifyError(err) {
    try {
        if (err instanceof Error) {
            // sanitize stack traces before returning so callers don't append
            // raw vendor/runtime frames into the terminal.
            return err.message + (err.stack ? '\n' + _sanitizeAppendable(err.stack) : '')
        }
        // For plain objects, attempt JSON; otherwise fallback to String()
        if (err && typeof err === 'object') {
            try { return JSON.stringify(err) } catch (_e) { /* fallthrough */ }
        }
        // Non-object throws (numbers, strings, etc.)
        return String(err) + (typeof err === 'number' ? ' (non-Error thrown)' : '')
    } catch (_e) {
        return Object.prototype.toString.call(err)
    }
}

// Helper to sanitize error-like values before appending to terminal
function _sanitizeAppendable(x) {
    try {
        const s = (x && typeof x === 'string') ? x : String(x)
        if (!s) return s

        // If this looks like a Python traceback, extract the contiguous
        // Python block and return that (dropping JS frames that may follow).
        if (/Traceback \(most recent call last\):/.test(s) || /^\s*File\s+\"/.test(s)) {
            const lines = s.split('\n')
            const pythonHeaderRE = /^Traceback \(most recent call last\):/
            const pythonFileRE = /^\s*File\s+\"/
            const pythonExceptionRE = /^[A-Za-z_][\w\.]*:.*$/
            const jsLikeRE = /(?:@http|https?:\/\/|\/js\/|\.mjs\b|node_modules|\/vendor\/|micropython|at\s+|@)/i

            let inPython = false
            const keep = []
            for (const line of lines) {
                if (!inPython && pythonHeaderRE.test(line)) {
                    inPython = true
                    keep.push(line)
                    continue
                }
                if (inPython) {
                    if (pythonFileRE.test(line) || /^\s+/.test(line) || pythonExceptionRE.test(line) || line.trim() === '') {
                        keep.push(line)
                        continue
                    }
                    // stop if we hit obvious JS-like frames
                    if (jsLikeRE.test(line)) break
                    // otherwise cautiously accept
                    keep.push(line)
                    continue
                }
                // Accept a lone final exception line even without header
                if (pythonExceptionRE.test(line) && !jsLikeRE.test(line)) {
                    keep.push(line)
                }
            }
            if (keep.length > 0) return keep.join('\n')
        }

        // Otherwise, filter out JS/vendor frames and noisy URLs
        const lines = s.split('\n')
        const out = []
        for (const line of lines) {
            if (!line) continue
            // Drop known vendor/runtime or JS frames
            if (/\/vendor\//.test(line) || /node_modules\//.test(line) || /proxy_convert_mp_to_js_obj_jsside/.test(line)) continue
            if (/https?:\/\//.test(line) || /@http/.test(line) || /\/js\//.test(line) || /\.mjs\b/.test(line) || /\bat\b.*\(/i.test(line)) continue
            if (line.length > 2000) continue
            out.push(line)
        }
        if (out.length === 0) return '[runtime stack frames hidden]'
        return out.join('\n')
    } catch (_e) { return String(x) }
}

export async function executeWithTimeout(executionPromise, timeoutMs, safetyTimeoutMs = 5000) {
    const executionState = getExecutionState()

    // Create abort controller for this execution
    const abortController = new AbortController()
    executionState.currentAbortController = abortController

    let vmInterruptAttempted = false

    const timeoutPromise = new Promise((_, reject) => {
        executionState.timeoutId = setTimeout(() => {
            abortController.abort()
            reject(new Error(`Execution timeout after ${Math.round(timeoutMs / 1000)} seconds. The program may contain an infinite loop or be taking too long to complete.`))
        }, timeoutMs)
    })

    // Safety mechanism: Try VM interrupt before falling back to abort
    const safetyPromise = new Promise((_, reject) => {
        executionState.safetyTimeoutId = setTimeout(() => {
            if (!vmInterruptAttempted && !abortController.signal.aborted) {
                vmInterruptAttempted = true
                appendTerminal(`>>> Safety timeout reached after ${Math.round(safetyTimeoutMs / 1000)}s, attempting VM interrupt...`, 'runtime')

                // Try to interrupt the VM first
                const interrupted = interruptMicroPythonVM()
                if (!interrupted) {
                    appendTerminal('>>> VM interrupt failed, forcing abort...', 'runtime')
                    abortController.abort()
                }

                // Still reject after attempting interrupt to trigger error handling
                setTimeout(() => {
                    reject(new Error(`Safety timeout: Execution appears stuck in tight loop after ${Math.round(safetyTimeoutMs / 1000)} seconds`))
                }, 500) // Give VM interrupt time to work
            }
        }, safetyTimeoutMs)
    })

    try {
        const result = await Promise.race([executionPromise, timeoutPromise, safetyPromise])
        clearTimeout(executionState.timeoutId)
        clearTimeout(executionState.safetyTimeoutId)
        return result
    } catch (error) {
        clearTimeout(executionState.timeoutId)
        clearTimeout(executionState.safetyTimeoutId)

        if (abortController.signal.aborted) {
            throw new Error('Execution was cancelled by user or timeout')
        }
        throw error
    }
}

/**
 * Instrument all Python files in the workspace for execution tracing
 * This must be called AFTER files are synced but BEFORE mounting
 */
async function instrumentAllPythonFiles(recordingEnabled, recorder, currentRuntimeAdapter) {
    if (!recordingEnabled || !recorder) {
        return
    }

    try {
        const { getPythonInstrumentor } = await import('./python-instrumentor.js')
        const instrumentor = getPythonInstrumentor()
        const FileManager = getFileManager()
        const fs = window.__ssg_runtime_fs

        if (!FileManager || !fs) {
            appendTerminalDebug('Cannot instrument files: FileManager or runtime FS not available')
            return
        }

        const files = FileManager.list()
        // Instrument all Python files EXCEPT main.py (which will be instrumented separately from the editor)
        const pythonFiles = files.filter(f => f.endsWith('.py') && f !== MAIN_FILE)

        appendTerminalDebug(`Found ${pythonFiles.length} Python files to instrument (excluding ${MAIN_FILE}): ${pythonFiles.join(', ')}`)

        for (const filepath of pythonFiles) {
            try {
                const sourceCode = FileManager.read(filepath)
                if (!sourceCode) {
                    appendTerminalDebug(`Skipping empty file: ${filepath}`)
                    continue
                }

                appendTerminalDebug(`Instrumenting ${filepath}...`)
                const instrResult = await instrumentor.instrumentCode(sourceCode, currentRuntimeAdapter, filepath)

                if (instrResult && typeof instrResult === 'object' && typeof instrResult.code === 'string') {
                    // Write the instrumented version to the runtime FS
                    try {
                        markExpectedWrite(filepath, instrResult.code)
                        try { window.__ssg_suppress_notifier = true } catch (_e) { }
                        fs.writeFile(filepath, instrResult.code)
                        try { window.__ssg_suppress_notifier = false } catch (_e) { }
                        appendTerminalDebug(`Successfully instrumented and wrote ${filepath} to runtime FS`)
                    } catch (writeErr) {
                        appendTerminalDebug(`Failed to write instrumented ${filepath}: ${writeErr}`)
                    }
                } else if (typeof instrResult === 'string') {
                    // Backwards compatibility: instrumentor returned string
                    try {
                        markExpectedWrite(filepath, instrResult)
                        try { window.__ssg_suppress_notifier = true } catch (_e) { }
                        fs.writeFile(filepath, instrResult)
                        try { window.__ssg_suppress_notifier = false } catch (_e) { }
                        appendTerminalDebug(`Successfully instrumented and wrote ${filepath} to runtime FS (legacy)`)
                    } catch (writeErr) {
                        appendTerminalDebug(`Failed to write instrumented ${filepath}: ${writeErr}`)
                    }
                }
            } catch (instrErr) {
                appendTerminalDebug(`Failed to instrument ${filepath}: ${instrErr}`)
            }
        }

        appendTerminalDebug('Finished instrumenting all Python files')
    } catch (error) {
        appendTerminalDebug('Error instrumenting Python files: ' + error)
    }
}

// Sync VFS files before execution
async function syncVFSBeforeRun(recordingEnabled, recorder, currentRuntimeAdapter) {
    try {
        const backend = window.__ssg_vfs_backend
        const fs = window.__ssg_runtime_fs
        const FileManager = getFileManager()

        // First, ensure any UI FileManager contents are pushed into the backend so mount sees them
        try {
            if (backend && typeof backend.write === 'function' && typeof FileManager?.list === 'function') {
                try {
                    setSystemWriteMode(true)
                    const files = FileManager.list()
                    for (const p of files) {
                        try {
                            const c = FileManager.read(p)
                            // suppress notifier echoes while we push UI files into backend
                            try { window.__ssg_suppress_notifier = true } catch (_e) { }
                            await backend.write(p, c == null ? '' : c)
                            try { window.__ssg_suppress_notifier = false } catch (_e) { }
                        } catch (_e) { /* ignore per-file */ }
                    }
                } finally {
                    setSystemWriteMode(false)
                }
                appendTerminalDebug('Synced UI FileManager -> backend (pre-run)')
            } else if (fs && typeof fs.writeFile === 'function' && typeof FileManager?.list === 'function') {
                // no async backend available; write directly into runtime FS from UI FileManager
                const files = FileManager.list()
                for (const p of files) {
                    try {
                        const content = FileManager.read(p) || ''
                        try { markExpectedWrite(p, content) } catch (_e) { }
                        try { window.__ssg_suppress_notifier = true } catch (_e) { }
                        fs.writeFile(p, content)
                        try { window.__ssg_suppress_notifier = false } catch (_e) { }
                    } catch (_e) { }
                }
                appendTerminalDebug('Synced UI FileManager -> runtime FS (pre-run)')
            }
        } catch (_e) {
            appendTerminal('Pre-run sync error: ' + _e)
            appendTerminal('Pre-run sync error: ' + _e, 'runtime')
        }

        if (backend && typeof backend.mountToEmscripten === 'function' && fs) {
            appendTerminalDebug('Ensuring VFS is mounted into MicroPython FS (pre-run)')
            // Mark expected writes for backend files so mount echoes are ignored by the notifier.
            try {
                const bk = await backend.list()
                for (const p of bk) {
                    try {
                        const c = await backend.read(p)
                        markExpectedWrite(p, c || '')
                    } catch (_e) { }
                }
            } catch (_e) { }

            let mounted = false
            for (let attempt = 0; attempt < 3 && !mounted; attempt++) {
                try {
                    try { window.__ssg_suppress_notifier = true } catch (_e) { }
                    try { setSystemWriteMode(true) } catch (_e) { }
                    await backend.mountToEmscripten(fs)
                    try { setSystemWriteMode(false) } catch (_e) { }
                    try { window.__ssg_suppress_notifier = false } catch (_e) { }
                    mounted = true
                    appendTerminalDebug('VFS mounted into MicroPython FS (pre-run)')
                } catch (merr) {
                    try { setSystemWriteMode(false) } catch (_e) { }
                    appendTerminalDebug('VFS pre-run mount attempt #' + (attempt + 1) + ' failed: ' + String(merr))
                    await new Promise(r => setTimeout(r, 150))
                }
            }
            if (!mounted) appendTerminalDebug('Warning: VFS pre-run mount attempts exhausted')
        }

        // NEW: Instrument all Python files for recording AFTER mounting so they don't get overwritten
        await instrumentAllPythonFiles(recordingEnabled, recorder, currentRuntimeAdapter)
    } catch (_m) {
        appendTerminal('VFS pre-run mount error: ' + _sanitizeAppendable(_m), 'runtime')
    }
}

// Sync VFS files after execution
async function syncVFSAfterRun() {
    try {
        // PERFORMANCE: Skip expensive sync if this was likely a read-only operation
        if (window.__ssg_skip_sync_after_run) {
            appendTerminalDebug('VFS sync skipped (read-only operation detected)')
            return
        }

        const backend = window.__ssg_vfs_backend
        const fs = window.__ssg_runtime_fs

        if (backend && typeof backend.syncFromEmscripten === 'function' && fs) {
            await backend.syncFromEmscripten(fs)
            appendTerminalDebug('VFS synced from runtime FS after execution')
        } else {
            // ensure localStorage fallback is updated for MAIN_FILE so tests can read it
            // Only update the legacy localStorage mirror when IndexedDB is not available
            try {
                if (typeof window !== 'undefined' && !window.indexedDB) {
                    // Prefer the authoritative FileManager copy of MAIN_FILE when available.
                    try {
                        const FileManager = getFileManager()
                        let mainContent = null
                        if (FileManager && typeof FileManager.read === 'function') {
                            mainContent = FileManager.read(MAIN_FILE)
                        }
                        // Fallback to the current editor content only if FileManager doesn't have MAIN_FILE
                        if (mainContent == null) {
                            const cm = window.cm
                            const textarea = document.getElementById('code')
                            mainContent = (cm ? cm.getValue() : (textarea ? textarea.value : ''))
                        }
                        const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}')
                        map[MAIN_FILE] = mainContent || ''
                        localStorage.setItem('ssg_files_v1', JSON.stringify(map))
                    } catch (_e) {
                        // Best-effort fallback: write current editor content if anything fails
                        const cm = window.cm
                        const textarea = document.getElementById('code')
                        const cur = (cm ? cm.getValue() : (textarea ? textarea.value : ''))
                        const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}')
                        map['/main.py'] = cur
                        localStorage.setItem('ssg_files_v1', JSON.stringify(map))
                    }
                }
            } catch (_e) { }
        }
    } catch (e) {
        appendTerminal('VFS sync after run failed: ' + _sanitizeAppendable(e), 'runtime')
    }
}

export async function runPythonCode(code, cfg) {
    const runtimeAdapter = getRuntimeAdapter()

    if (getExecutionState().isRunning) {
        appendTerminal('>>> Execution already in progress...', 'runtime')
        return
    }

    // Clear any previous terminal content (including noisy runtime-init messages)
    try { if (typeof clearTerminal === 'function') clearTerminal() } catch (_e) { }

    // Dismiss any active replay (clear decorations) when starting a run
    try {
        if (typeof window !== 'undefined' && window.ReplayEngine && typeof window.ReplayEngine.stopReplay === 'function') {
            try { window.ReplayEngine.stopReplay() } catch (_e2) { /* ignore */ }
            appendTerminalDebug('Stopped active replay before run')
        }
    } catch (_e) { appendTerminalDebug('Failed to stop replay before run: ' + _e) }

    setExecutionRunning(true)
    appendTerminal('>>> Running...', 'runtime')

    // NEW: Recording integration point
    const recorder = getExecutionRecorder()
    appendTerminalDebug(`Checking recording config - cfg exists: ${!!cfg}, features: ${JSON.stringify(cfg?.features)}, recordReplay: ${cfg?.features?.recordReplay}`)

    // Clear any previous recording to ensure fresh start
    if (recorder && recorder.hasActiveRecording()) {
        recorder.clearRecording()
        appendTerminalDebug('Previous recording cleared for fresh start')
    }

    const recordingEnabled = cfg?.features?.recordReplay !== false &&
        recorder && recorder.constructor.isSupported()

    if (recordingEnabled) {
        recorder.startRecording(code, cfg)
        appendTerminalDebug('Execution recording enabled for this run')

        // Set up Python code instrumentation for real tracing
        try {
            const { getPythonInstrumentor } = await import('./python-instrumentor.js')
            const instrumentor = getPythonInstrumentor()
            instrumentor.setHooks(recorder.getExecutionHooks())
            instrumentor.setupTraceCallback()
            appendTerminalDebug('Python instrumentation enabled for recording')
        } catch (e) {
            appendTerminalDebug('Failed to setup Python instrumentation: ' + e)
        }
    } else {
        appendTerminalDebug(`Recording not enabled - recordReplay: ${cfg?.features?.recordReplay}, supported: ${recorder ? recorder.constructor.isSupported() : 'no recorder'}`)
    }

    // PERFORMANCE: Detect likely read-only operations to skip expensive VFS sync
    const codeStr = String(code || '').trim()
    const isReadOnlyOperation = /^(import\s+os|from\s+os|os\.listdir|os\.getcwd|os\.path\.|print\s*\()/m.test(codeStr) &&
        !/write|open\s*\(|file\s*=|with\s+open/m.test(codeStr) &&
        codeStr.length < 200 // Only apply to short snippets

    if (isReadOnlyOperation) {
        window.__ssg_skip_sync_after_run = true
        appendTerminalDebug('Detected read-only operation, will skip expensive sync')
    } else {
        window.__ssg_skip_sync_after_run = false
    }

    // Initialize stdin history tracking for feedback system
    window.__ssg_stdin_history = ''

    // Clear Python state before each execution to ensure fresh start
    try {
        if (window.clearMicroPythonState) {
            // Decide whether we should insist on a provably-clean runtime.
            // For real MicroPython runtimes (which expose `_module`/FS or
            // yielding support) we enforce `requireClean: true` so the
            // runtime is restarted deterministically. For simple test/mock
            // adapters that don't represent a full runtime, avoid forcing a
            // restart to keep tests fast and predictable.
            const currentAdapter = getRuntimeAdapter()
            // Heuristic: treat as a real runtime only if it exposes the async
            // runner, explicit yielding support, a ccall hook, or a FS object.
            const looksLikeRealRuntime = !!(currentAdapter && (
                typeof currentAdapter.runPythonAsync === 'function' ||
                (currentAdapter._module && (typeof currentAdapter._module.ccall === 'function' || currentAdapter._module.FS))
            ))
            const clearOpts = { fallbackToRestart: true, requireClean: !!looksLikeRealRuntime }

            const result = await window.clearMicroPythonState(clearOpts)
            if (result) {
                appendTerminalDebug('MicroPython state cleared successfully')
            } else {
                appendTerminalDebug('Soft reset failed - will try manual clearing')

                // Fallback to manual clearing if soft reset fails
                // Re-acquire runtime adapter just before attempting manual clear
                const adapterForClear = getRuntimeAdapter()
                if (adapterForClear && (typeof adapterForClear.runPythonAsync === 'function' || typeof adapterForClear.run === 'function')) {
                    try {
                        const clearCode = `
# Aggressive manual clearing - carefully remove user modules and globals
import sys
import gc

try:
    _essential_modules = {'sys', 'gc', 'builtins', '__main__', 'micropython', 'host', 'host_notify'}
    # Build a list first to avoid mutation during iteration
    _modules_to_clear = [name for name in list(sys.modules.keys()) if name not in _essential_modules and not name.startswith('_')]
    for name in _modules_to_clear:
        try:
            del sys.modules[name]
        except Exception:
            pass
except Exception:
    pass

try:
    _essential_globals = {'__builtins__', '__name__', '__doc__', '__package__', '__loader__', '__spec__'}
    _g = globals()
    _to_clear = [name for name in list(_g.keys()) if name not in _essential_globals and not name.startswith('__')]
    for name in _to_clear:
        try:
            del _g[name]
        except Exception:
            pass
except Exception:
    pass

try:
    gc.collect()
except Exception:
    pass

# Explicitly clear __main__ module contents to remove persisted top-level variables
try:
    import sys as _sys_mod
    _main = _sys_mod.modules.get('__main__')
    if _main is not None:
        try:
            _md = getattr(_main, '__dict__', {})
            for _k in list(_md.keys()):
                if not _k.startswith('__'):
                    try:
                        del _md[_k]
                    except Exception:
                        pass
        except Exception:
            pass
except Exception:
    pass
`
                        // Prefer async clear if available. When only synchronous
                        // `run` is present, wrap with a short timeout so we don't
                        // block forever on adapters that return non-resolving
                        // promises (tests sometimes provide such adapters).
                        try {
                            if (typeof adapterForClear.runPythonAsync === 'function') {
                                await adapterForClear.runPythonAsync(clearCode)
                            } else if (typeof adapterForClear.run === 'function') {
                                await Promise.race([
                                    adapterForClear.run(clearCode),
                                    new Promise((_, rej) => setTimeout(() => rej(new Error('clear-timeout')), 200))
                                ])
                            }
                        } catch (e) {
                            if (String(e).includes('clear-timeout')) {
                                appendTerminalDebug('Manual clear timed out; proceeding')
                            } else {
                                throw e
                            }
                        }
                        appendTerminalDebug('Manual globals clearing completed')
                    } catch (clearErr) {
                        appendTerminalDebug('Manual globals clearing failed: ' + clearErr)
                    }
                }
            }
        } else {
            appendTerminalDebug('No clearMicroPythonState function available - trying manual clearing')

            // Manual clearing fallback when no clearMicroPythonState available
            // Re-acquire runtime adapter before manual clear when no clearMicroPythonState
            const adapterForClearFallback = getRuntimeAdapter()
            if (adapterForClearFallback && (typeof adapterForClearFallback.runPythonAsync === 'function' || typeof adapterForClearFallback.run === 'function')) {
                try {
                    const clearCode = `
# Aggressive manual clearing - carefully remove user modules and globals
import sys
import gc

try:
    _essential_modules = {'sys', 'gc', 'builtins', '__main__', 'micropython', 'host', 'host_notify'}
    _modules_to_clear = [name for name in list(sys.modules.keys()) if name not in _essential_modules and not name.startswith('_')]
    for name in _modules_to_clear:
        try:
            del sys.modules[name]
        except Exception:
            pass
except Exception:
    pass

try:
    _essential_globals = {'__builtins__', '__name__', '__doc__', '__package__', '__loader__', '__spec__'}
    _g = globals()
    _to_clear = [name for name in list(_g.keys()) if name not in _essential_globals and not name.startswith('__')]
    for name in _to_clear:
        try:
            del _g[name]
        except Exception:
            pass
except Exception:
    pass

try:
    gc.collect()
except Exception:
    pass
`
                    try {
                        if (typeof adapterForClearFallback.runPythonAsync === 'function') {
                            await adapterForClearFallback.runPythonAsync(clearCode)
                        } else if (typeof adapterForClearFallback.run === 'function') {
                            await Promise.race([
                                adapterForClearFallback.run(clearCode),
                                new Promise((_, rej) => setTimeout(() => rej(new Error('clear-timeout')), 200))
                            ])
                        }
                    } catch (e) {
                        if (String(e).includes('clear-timeout')) {
                            appendTerminalDebug('Manual clear timed out; proceeding')
                        } else {
                            throw e
                        }
                    }
                    appendTerminalDebug('Manual globals clearing completed')
                } catch (clearErr) {
                    appendTerminalDebug('Manual globals clearing failed: ' + clearErr)
                }
            }
        }
    } catch (err) {
        appendTerminalDebug('⚠️ State clearing failed:', err)
    }

    // Use current runtime adapter reference for execution  
    const currentRuntimeAdapter = getRuntimeAdapter()

    // clear any existing editor warnings
    try {
        if (typeof clearAllErrorHighlights === 'function') clearAllErrorHighlights()
        if (typeof clearAllFeedbackHighlights === 'function') clearAllFeedbackHighlights()
    } catch (_e) { }

    // Get timeout from config (default 30 seconds)
    const timeoutSeconds = cfg?.execution?.timeoutSeconds || 30
    const timeoutMs = timeoutSeconds * 1000

    // Safety timeout for infinite loops (default 30 seconds, configurable)
    const safetyTimeoutSeconds = cfg?.execution?.safetyTimeoutSeconds || 30
    const safetyTimeoutMs = Math.min(safetyTimeoutSeconds * 1000, timeoutMs)

    // disable terminal input by default; enable only if runtime requests input
    try { setTerminalInputEnabled(false) } catch (_e) { }

    // Activate terminal tab automatically when running
    try { activateSideTab('terminal') } catch (_e) { }

    try {
        if (currentRuntimeAdapter) {
            // Clear any previous captured stderr/mapping state to avoid stale data
            // (If a previous run produced a mapped traceback, these globals
            // could cause feedback to fire on later clean runs.)
            try { delete window.__ssg_last_raw_stderr_buffer } catch (_e) { }
            try { window.__ssg_last_mapped = '' } catch (_e) { }
            try { window.__ssg_last_mapped_event = null } catch (_e) { }
            try { window.__ssg_final_stderr = '' } catch (_e) { }
            try { window.__ssg_stderr_buffer = [] } catch (_e) { }
            try { window.__ssg_suppress_raw_stderr_until = 0 } catch (_e) { }
            try { window.__ssg_appending_mapped = false } catch (_e) { }
            try { window.__ssg_mapping_in_progress = false } catch (_e) { }

            // Sync VFS before execution (and instrument all Python files if recording is enabled)
            await syncVFSBeforeRun(recordingEnabled, recorder, currentRuntimeAdapter)

            // Check if this is asyncify MicroPython (runPythonAsync available)
            const isAsyncify = currentRuntimeAdapter && (typeof currentRuntimeAdapter.runPythonAsync === 'function')

            let codeToRun = code
            let headerLines = 0
            let needsTransformation = false

            if (isAsyncify) {
                // With asyncify, we can run the code directly without transformation!
                appendTerminalDebug('Using asyncify MicroPython - no transformation needed')
                codeToRun = code
                // No transformation means no header lines to subtract from tracebacks
                headerLines = 0
            } else {
                // Non-asyncify runtime: transform input() to await host.get_input()
                appendTerminalDebug('Using transform-based approach for input() handling')
                const transformed = transformAndWrap(code)
                codeToRun = transformed.code
                headerLines = transformed.headerLines
                needsTransformation = true
            }

            // NEW: Instrument code for recording if enabled
            if (recordingEnabled && recorder) {
                try {
                    const { getPythonInstrumentor } = await import('./python-instrumentor.js')
                    const instrumentor = getPythonInstrumentor()
                    const instrResult = await instrumentor.instrumentCode(codeToRun, currentRuntimeAdapter, MAIN_FILE)
                    // instrumentCode now returns { code, headerLines } on success
                    if (instrResult && typeof instrResult === 'object' && typeof instrResult.code === 'string') {
                        codeToRun = instrResult.code
                        // accumulate headerLines so mapping subtracts the right offset
                        const instrumentationHeaders = Number(instrResult.headerLines) || 0
                        // Preserve the headerLines value that came from transformAndWrap
                        const transformWrapperHeaderLines = Number(headerLines || 0)
                        headerLines = (headerLines || 0) + instrumentationHeaders
                        // If the instrumentor provided an explicit line map, adjust
                        // its values so they refer to the original user source line
                        // numbers (subtract the transform wrapper header lines).
                        try {
                            if (instrResult.lineMap && typeof instrResult.lineMap === 'object') {
                                const adjusted = {}
                                for (const [k, v] of Object.entries(instrResult.lineMap || {})) {
                                    try {
                                        const orig = Number(v) || 0
                                        // Subtract the transform wrapper header lines so
                                        // the resulting map values correspond to the
                                        // user's original source lines.
                                        adjusted[String(k)] = Math.max(1, orig - transformWrapperHeaderLines)
                                    } catch (_e) { adjusted[String(k)] = Number(v) }
                                }
                                window.__ssg_instrumented_line_map = adjusted
                            } else {
                                window.__ssg_instrumented_line_map = null
                            }
                        } catch (_e) { try { window.__ssg_instrumented_line_map = instrResult.lineMap || null } catch (__e) { } }
                        appendTerminalDebug(`HeaderLines updated: base=${headerLines - instrumentationHeaders}, instrumentation=${instrumentationHeaders}, total=${headerLines}`)
                    } else if (typeof instrResult === 'string') {
                        // Backwards compatibility: plugin returned string
                        codeToRun = instrResult
                    }
                    appendTerminalDebug('Python code instrumented for execution tracing')
                } catch (e) {
                    appendTerminalDebug('Failed to instrument code: ' + e)
                }
            }

            // Set up the execution context BEFORE running the code so terminal direct append can use it
            try {
                window.__ssg_last_mapped_event = {
                    when: Date.now(),
                    headerLines: headerLines || 0,
                    sourcePath: MAIN_FILE || null,
                    mapped: ''
                }

                // Clear any existing state from previous mappings so this execution
                // can have its tracebacks properly mapped instead of suppressed/blocked
                delete window.__ssg_suppress_raw_stderr_until
                window.__ssg_mapping_in_progress = false
                // Note: Don't clear stderr_buffering here as enableStderrBuffering() sets it intentionally
            } catch (_e) { }            // Enable stderr buffering so we can replace raw runtime tracebacks with mapped ones
            try { enableStderrBuffering() } catch (_e) { }

            // Create a per-run promise that the terminal can resolve when
            // it publishes the canonical final stderr. This reduces the
            // race window where mapping finishes just after feedback samples
            // the globals. The terminal will set `__ssg_final_stderr_resolve`
            // and resolve `__ssg_final_stderr_promise` when it appends the
            // mapped stderr.
            try {
                try { delete window.__ssg_final_stderr_promise } catch (_e) { }
                try { delete window.__ssg_final_stderr_resolve } catch (_e) { }
                window.__ssg_final_stderr_promise = new Promise((resolve) => { try { window.__ssg_final_stderr_resolve = resolve } catch (_e) { } })
            } catch (_e) { }

            // Try asyncify execution first (preferred path)
            if (isAsyncify && !needsTransformation) {
                appendTerminalDebug('Executing with asyncify runPythonAsync - native input() support')
                try {
                    let out = ''

                    // NEW: Hook into asyncify path for recording
                    const executionHooks = recordingEnabled ?
                        recorder.getExecutionHooks() : null

                    if (typeof currentRuntimeAdapter.runPythonAsync === 'function') {
                        out = await executeWithTimeout(currentRuntimeAdapter.runPythonAsync(codeToRun, executionHooks), timeoutMs, safetyTimeoutMs)
                    } else {
                        // Fallback to regular run method
                        out = await executeWithTimeout(currentRuntimeAdapter.run(codeToRun), timeoutMs, safetyTimeoutMs)
                    }
                    const runtimeOutput = out === undefined ? '' : String(out)
                    if (runtimeOutput) appendTerminal(runtimeOutput, 'stdout')
                    // If the runtime printed a traceback to stdout/stderr while
                    // we were buffering, attempt to map those buffered lines
                    // back to the user's source using the accumulated header
                    // offset. This covers runtimes that print tracebacks
                    // instead of throwing (so the normal catch/mapping path
                    // is not triggered).
                    try {
                        const rawBuf = Array.isArray(window.__ssg_stderr_buffer) ? window.__ssg_stderr_buffer : []
                        if (rawBuf && rawBuf.length) {
                            try {
                                const mapped = mapTracebackAndShow(rawBuf.join('\n'), headerLines, MAIN_FILE)
                                // Debug: Log what mapped value we got
                                try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'execution_mapped_value', mapped: mapped, mappedType: typeof mapped, mappedPreview: (mapped == null) ? null : String(mapped).slice(0, 200) }) } catch (_e) { }
                                try { replaceBufferedStderr(mapped) } catch (_e) {
                                    // Debug: Log exception in first call
                                    try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'execution_first_call_exception', error: String(_e), mapped: mapped }) } catch (_e2) { }
                                    replaceBufferedStderr(null)
                                }
                            } catch (_e) {
                                // Debug: Log exception in outer try
                                try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'execution_outer_exception', error: String(_e) }) } catch (_e2) { }
                                try { replaceBufferedStderr(null) } catch (_e2) { }
                            }
                        }
                    } catch (_e) { }
                    // Feedback evaluation moved to end of execution to include all data
                } catch (asyncifyErr) {
                    const errMsg = stringifyError(asyncifyErr)

                    // Handle abort errors from instrumentation (common with record/replay)
                    if (errMsg.includes('Aborted(native code called abort())')) {
                        appendTerminalDebug('Instrumentation caused abort - this is normal for record/replay mode')
                        return // Clean exit for instrumentation-related aborts
                    }

                    // Handle KeyboardInterrupt (from VM interrupt) specially  
                    if (errMsg.includes('KeyboardInterrupt')) {
                        appendTerminal('>>> Execution interrupted by user (KeyboardInterrupt)', 'runtime')
                        return // Clean exit for user-initiated interrupts
                    }

                    // Handle safety timeout (VM stuck in tight loop)
                    if (errMsg.includes('Safety timeout') || errMsg.includes('tight loop')) {
                        appendTerminal('>>> Execution stopped: Code appears to be stuck in an infinite loop', 'runtime')
                        appendTerminal('>>> Tip: Add time.sleep() calls in loops to allow interrupts to work', 'runtime')
                        return // Clean exit for safety timeout
                    }

                    // Handle execution timeout
                    if (errMsg.includes('Execution timeout')) {
                        appendTerminal('>>> Execution timeout: Program took too long to complete', 'runtime')
                        return // Clean exit for timeout
                    }

                    // Handle cancellation
                    if (errMsg.includes('cancelled by user')) {
                        appendTerminal('>>> Execution cancelled by user', 'runtime')
                        return // Clean exit for user cancellation
                    }

                    // Handle specific "async operation in flight" error
                    if (errMsg.includes('We cannot start an async operation when one is already flight') ||
                        errMsg.includes('async operation') || errMsg.includes('already flight')) {
                        appendTerminal('Runtime Error: Previous execution was interrupted and left the runtime in an inconsistent state.', 'runtime')
                        appendTerminal('Attempting automatic runtime recovery...', 'runtime')

                        let recovered = false

                        // Try aggressive asyncify recovery
                        if (currentRuntimeAdapter && currentRuntimeAdapter.clearInterrupt) {
                            try {
                                appendTerminalDebug('Clearing interrupt state with asyncify API...')
                                currentRuntimeAdapter.clearInterrupt()
                                appendTerminalDebug('✅ Basic interrupt state cleared')
                            } catch (err) {
                                appendTerminalDebug('Asyncify clear interrupt failed: ' + err)
                            }
                        }

                        // Try to reset asyncify state by reinitializing the runtime adapter
                        try {
                            if (currentRuntimeAdapter && currentRuntimeAdapter._module) {
                                appendTerminalDebug('Attempting to reset asyncify state...')

                                // Try to access and reset asyncify internals if possible
                                const Module = currentRuntimeAdapter._module
                                if (Module.Asyncify) {
                                    appendTerminalDebug('Found Asyncify object, attempting state reset...')
                                    try {
                                        // Reset asyncify state variables if accessible
                                        if (Module.Asyncify.currData) Module.Asyncify.currData = 0
                                        if (Module.Asyncify.state) Module.Asyncify.state = 0  // Normal state
                                        appendTerminalDebug('✅ Asyncify state variables reset')
                                        recovered = true
                                    } catch (e) {
                                        appendTerminalDebug('Asyncify state reset failed: ' + e)
                                    }
                                }

                                // Try REPL reinitialization
                                if (typeof Module.ccall === 'function') {
                                    try {
                                        Module.ccall('mp_js_repl_init', 'null', [], [])
                                        appendTerminalDebug('✅ REPL reinitialized')
                                        recovered = true
                                    } catch (e) {
                                        appendTerminalDebug('REPL reinit failed: ' + e)
                                    }
                                }
                            }
                        } catch (resetErr) {
                            appendTerminalDebug('Asyncify reset attempt failed: ' + resetErr)
                        }

                        if (recovered) {
                            appendTerminal('✅ Runtime state cleared successfully', 'runtime')
                            appendTerminal('You can try running code again. If problems persist, refresh the page.', 'runtime')
                        } else {
                            appendTerminal('⚠️ Automatic recovery failed. You may need to refresh the page if the next execution fails.', 'runtime')
                        }

                        appendTerminalDebug('Technical details: ' + errMsg)
                    } else if (errMsg.includes('EOFError')) {
                        appendTerminal('Input Error: Input operation was interrupted.', 'runtime')
                        appendTerminal('This is normal when stopping execution during input().', 'runtime')

                        // Try to clean up input state
                        try {
                            if (window.__ssg_pending_input) {
                                appendTerminalDebug('Cleaning up pending input state...')
                                delete window.__ssg_pending_input
                            }
                            setTerminalInputEnabled(false)
                        } catch (_e) { }
                    } else {
                        // For Python errors, map and show the traceback (so editors can react)
                        if (errMsg.includes('Traceback')) {
                            try {
                                // Mark that mapping is in progress so terminal appends of raw runtime tracebacks
                                // (which may arrive slightly late) can be suppressed until we replace them.
                                try { window.__ssg_mapping_in_progress = true } catch (_e) { }
                                try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'about_to_map_line755', headerLines: headerLines || 0, sourcePath: MAIN_FILE || null, rawPreview: String(errMsg || '').slice(0, 200) }) } catch (_e) { }

                                let mapped = null
                                try {
                                    try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'before_mapTracebackAndShow', errMsg: String(errMsg || '').slice(0, 100) }) } catch (_e) { }
                                    mapped = mapTracebackAndShow(errMsg, headerLines, MAIN_FILE)
                                    try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'after_mapTracebackAndShow', mappedType: typeof mapped, mappedIsString: typeof mapped === 'string', mappedLength: (mapped && mapped.length) || 0, mappedPreview: (mapped == null) ? null : String(mapped).slice(0, 200) }) } catch (_e) { }
                                } catch (mapErr) {
                                    try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'mapTracebackAndShow_exception', error: String(mapErr), stack: mapErr.stack }) } catch (_e) { }
                                }

                                try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'mapped_result', headerLines: headerLines || 0, sourcePath: MAIN_FILE || null, rawPreview: String(errMsg || '').slice(0, 200), mappedPreview: (mapped == null) ? null : String(mapped).slice(0, 200) }) } catch (_e) { }
                                try { window.__ssg_last_mapped = String(mapped || '') } catch (_e) { }
                                try { window.__ssg_last_mapped_event = { when: Date.now(), headerLines: headerLines || 0, sourcePath: MAIN_FILE || null, mapped: String(mapped || '') } } catch (_e) { }
                                try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'execution_replace_call', mappedType: typeof mapped, mappedPreview: (typeof mapped === 'string') ? mapped.slice(0, 200) : null }) } catch (_e) { }
                                // Replace buffered raw stderr with mapped traceback
                                try { replaceBufferedStderr(mapped) } catch (_e) { }

                                // CRITICAL FIX: Ensure the traceback actually appears in the terminal
                                // If the replacement mechanism failed, directly append the mapped traceback
                                if (mapped && typeof mapped === 'string') {
                                    setTimeout(() => {
                                        const terminalOut = document.getElementById('terminal-output')
                                        if (terminalOut && !terminalOut.textContent.includes('NameError') && !terminalOut.textContent.includes('Traceback')) {
                                            // The traceback didn't make it to the terminal, append it directly
                                            appendTerminal(mapped, 'stderr')
                                            appendTerminalDebug('Direct traceback append after replacement failure')
                                        }
                                    }, 100)
                                }
                            } catch (_e) {
                                // Fallback: if mapping fails, flush buffered raw stderr
                                try { flushStderrBufferRaw() } catch (_e2) { }
                                appendTerminal(errMsg, 'stderr')
                            } finally {
                                try { window.__ssg_mapping_in_progress = false } catch (_e) { }
                            }
                        } else {
                            // For non-Python errors, show with context
                            // Strip vendor runtime frames (e.g., vendor/micropython.mjs)
                            const cleaned = String(errMsg || '').split('\n').filter(l => !/vendor\/micropython\.mjs/.test(l)).join('\n')
                            appendTerminal('Execution error: ' + cleaned, 'runtime')
                            throw asyncifyErr
                        }
                    }
                }
            } else {
                // Traditional transformed execution
                try {
                    // If transformed code expects input, focus the stdin box and wire Enter->send
                    if (/await host.get_input\(/.test(codeToRun)) {
                        const stdinBox = document.getElementById('stdin-box')
                        if (stdinBox) {
                            // Let the terminal inline form handle Enter/submit. Just focus the input.
                            try { stdinBox.focus() } catch (_e) { }
                        }
                    }

                    // Check for async capability if needed
                    if (needsTransformation && /\bawait host.get_input\(/.test(codeToRun)) {
                        try {
                            // Probe parse of a tiny async snippet
                            await currentRuntimeAdapter.run('async def __ssg_probe():\n    pass')
                        } catch (probeErr) {
                            const pm = String(probeErr || '')
                            if (/syntax|invalid|bad input|indent/i.test(pm)) {
                                throw new Error('no async runner available')
                            }
                        }
                    }

                    const out = await executeWithTimeout(currentRuntimeAdapter.run(codeToRun), timeoutMs, safetyTimeoutMs)
                    const runtimeOutput = out === undefined ? '' : String(out)
                    if (runtimeOutput) appendTerminal(runtimeOutput, 'stdout')
                    // Map any buffered traceback output that arrived during
                    // execution so printed tracebacks are replaced with
                    // mapped versions using the current headerLines offset.
                    try {
                        const rawBuf = Array.isArray(window.__ssg_stderr_buffer) ? window.__ssg_stderr_buffer : []
                        if (rawBuf && rawBuf.length) {
                            try {
                                const mapped = mapTracebackAndShow(rawBuf.join('\n'), headerLines, MAIN_FILE)
                                try { replaceBufferedStderr(mapped) } catch (_e) { replaceBufferedStderr(null) }
                            } catch (_e) {
                                try { replaceBufferedStderr(null) } catch (_e2) { }
                            }
                        }
                    } catch (_e) { }
                    // Feedback evaluation moved to end of execution to include all data
                } catch (e) {
                    const msg = stringifyError(e || '')

                    // If no async runner is available, handle with fallback logic
                    if (/no async runner available/i.test(msg)) {
                        // TODO: Implement fallback split-run strategy here if needed
                        appendTerminal('Error: This runtime does not support async input handling', 'runtime')
                        appendTerminal('Consider using an asyncify-enabled MicroPython runtime', 'runtime')
                        throw e
                    } else {
                        try {
                            try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'about_to_map_line842', headerLines: headerLines || 0, sourcePath: MAIN_FILE || null, rawPreview: String(e || '').slice(0, 200) }) } catch (_e) { }

                            let mapped = null
                            try {
                                try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'before_mapTracebackAndShow_842', errorMsg: String(e || '').slice(0, 100) }) } catch (_e) { }
                                mapped = mapTracebackAndShow(String(e), headerLines, MAIN_FILE)
                                try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'after_mapTracebackAndShow_842', mappedType: typeof mapped, mappedIsString: typeof mapped === 'string', mappedLength: (mapped && mapped.length) || 0, mappedPreview: (mapped == null) ? null : String(mapped).slice(0, 200) }) } catch (_e) { }
                            } catch (mapErr) {
                                try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'mapTracebackAndShow_exception_842', error: String(mapErr), stack: mapErr.stack }) } catch (_e) { }
                            }

                            try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'mapped_result', headerLines: headerLines || 0, sourcePath: MAIN_FILE || null, rawPreview: String(e || '').slice(0, 200), mappedPreview: (mapped == null) ? null : String(mapped).slice(0, 200) }) } catch (_e) { }
                            try { window.__ssg_last_mapped = String(mapped || '') } catch (_e) { }
                            try { window.__ssg_last_mapped_event = { when: Date.now(), headerLines: headerLines || 0, sourcePath: MAIN_FILE || null, mapped: String(mapped || '') } } catch (_e) { }
                            try {
                                if (mapped) {
                                    // Attempt editor highlight/open for mapped tracebacks
                                    try { highlightMappedTracebackInEditor(mapped) } catch (_err) { }
                                    // Replace buffered stderr with mapped text
                                    try { replaceBufferedStderr(mapped) } catch (_e) { }
                                }
                            } catch (_e) { }
                        } catch (_) {
                            // Flush buffered raw stderr if mapping fails
                            try { flushStderrBufferRaw() } catch (_e2) { }
                            appendTerminal('Runtime error: ' + _sanitizeAppendable(e), 'runtime')
                        }
                    }
                }
                // On success path (no thrown errors), flush any buffered stderr just in case
                try { flushStderrBufferRaw() } catch (_e) { }
            }

            // Sync VFS after execution
            await syncVFSAfterRun()

            // Notify Feedback subsystem with run-time captures: stdout, stderr, stdin, and filenames
            try {
                if (window.Feedback && typeof window.Feedback.evaluateFeedbackOnRun === 'function') {
                    try {
                        const outEl = document.getElementById('terminal-output')
                        const stdoutFull = outEl ? (outEl.textContent || '') : ''
                        // Proper stderr separation: extract the actual error text that was displayed
                        let stderrFull = ''
                        try {
                            // Prefer the mapped traceback when it's informative (mapped
                            // text generally contains the user-facing exception and
                            // mapped file/line info). Fall back to the raw buffered
                            // stderr only when it contains an actual traceback or
                            // exception message (to avoid noisy vendor-frame-only
                            // buffers masking mapped errors).
                            try {
                                // If a per-run canonical stderr promise exists, wait a short
                                // bounded time for it to resolve so we prefer the terminal's
                                // authoritative value when available.
                                const awaitWithTimeout = (p, ms) => {
                                    if (!p) return Promise.resolve(undefined)
                                    return Promise.race([
                                        p,
                                        new Promise((resolve) => setTimeout(() => resolve(undefined), ms))
                                    ])
                                }
                                try {
                                    if (window.__ssg_final_stderr_promise && typeof window.__ssg_final_stderr_promise.then === 'function') {
                                        // Wait up to 80ms for terminal to publish final stderr
                                        const resolved = await awaitWithTimeout(window.__ssg_final_stderr_promise, 80)
                                        if (typeof resolved === 'string' && resolved.trim().length > 0) {
                                            try { window.__ssg_final_stderr = String(resolved || '') } catch (_e) { }
                                        }
                                    }
                                } catch (_e) { }

                                // Prefer a canonical final stderr slot when available
                                const finalCanonical = (typeof window.__ssg_final_stderr === 'string') ? String(window.__ssg_final_stderr || '') : ''
                                const mappedCandidate = (typeof window.__ssg_last_mapped === 'string') ? String(window.__ssg_last_mapped || '') : ''
                                const rawBuf = (window.__ssg_last_raw_stderr_buffer && Array.isArray(window.__ssg_last_raw_stderr_buffer)) ? window.__ssg_last_raw_stderr_buffer.join('\n') : ''

                                const looksLikeException = (s) => {
                                    if (!s) return false
                                    // Traceback header or typical Python exception line (e.g. "NameError: ...")
                                    if (/Traceback \(most recent call last\):/.test(s)) return true
                                    if (/^[A-Za-z0-9_].*?:/.test(s)) return true
                                    return false
                                }

                                // If a canonical final stderr is present, prefer it
                                if (finalCanonical && finalCanonical.trim().length > 0) {
                                    stderrFull = finalCanonical
                                } else if (mappedCandidate.trim().length > 0 && looksLikeException(mappedCandidate)) {
                                    stderrFull = mappedCandidate
                                } else if (rawBuf && looksLikeException(rawBuf)) {
                                    // Fallback to raw buffer only when it contains real
                                    // traceback/exception information
                                    stderrFull = rawBuf
                                } else if (mappedCandidate.trim().length > 0) {
                                    // If mapped is present but not clearly an exception,
                                    // still prefer it over noisy raw buffers so feedback
                                    // rules that target mapped text can fire.
                                    stderrFull = mappedCandidate
                                } else {
                                    stderrFull = ''
                                }

                                // Extra fallback: if neither mappedCandidate nor the
                                // preserved raw buffer contained useful information,
                                // try to extract any trailing mapped traceback that
                                // was already appended into the terminal DOM. This
                                // covers a race where replaceBufferedStderr appended
                                // mapped text but the mapping state slots weren't
                                // populated by the time we sampled them above.
                                if ((!stderrFull || !stderrFull.trim()) && typeof document !== 'undefined') {
                                    try {
                                        const outEl = document.getElementById('terminal-output')
                                        const terminalText = outEl ? (outEl.textContent || '') : ''
                                        if (terminalText) {
                                            // Prefer a full traceback block if present
                                            const tbIdx = terminalText.lastIndexOf('Traceback (most recent call last):')
                                            if (tbIdx !== -1) {
                                                stderrFull = terminalText.slice(tbIdx).trim()
                                            } else {
                                                // Otherwise look for a trailing exception line
                                                const lines = terminalText.split('\n')
                                                for (let i = lines.length - 1; i >= 0; i--) {
                                                    const l = (lines[i] || '').trim()
                                                    if (/^[A-Za-z_][\w\.]*:/.test(l)) {
                                                        const start = Math.max(0, i - 8)
                                                        stderrFull = lines.slice(start).join('\n').trim()
                                                        break
                                                    }
                                                }
                                            }
                                        }
                                    } catch (_e) { /* best-effort fallback only */ }
                                }
                            } catch (_e) { stderrFull = '' }
                        } catch (_e) { stderrFull = '' }

                        // Capture stdin inputs from the execution session
                        const stdinFull = (typeof window.__ssg_stdin_history === 'string') ? window.__ssg_stdin_history : ''
                        // gather filenames from FileManager or localStorage mirror
                        let filenamesArr = []
                        try {
                            const FileManager = getFileManager()
                            if (FileManager && typeof FileManager.list === 'function') {
                                const files = FileManager.list() || []
                                if (Array.isArray(files)) filenamesArr = files.slice()
                            }
                        } catch (_e) {
                            try {
                                const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}')
                                filenamesArr = Object.keys(map || {})
                            } catch (_e2) { filenamesArr = [] }
                        }
                        window.Feedback.evaluateFeedbackOnRun({ stdout: stdoutFull, stderr: stderrFull, stdin: stdinFull, filename: filenamesArr })
                    } catch (_e) { /* swallow feedback errors */ }
                }
            } catch (_e) { }
        } else {
            appendTerminal('Runtime error: no runtime adapter available', 'runtime')
        }
    } catch (e) {
        try {
            const full = stringifyError(e)

            // If this looks like a Python traceback, let the existing
            // mapping flow handle it so editors can be updated.
            if (/Traceback|<stdin>|<string>/.test(full)) {
                try {
                    // Attempt to map and show the traceback (mapTracebackAndShow
                    // will handle appending the mapped traceback to the terminal)
                    try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'mapTracebackAndShow_945_call', headerLines: headerLines || 0, fullPreview: String(full || '').slice(0, 200) }) } catch (_e) { }
                    mapTracebackAndShow(full, headerLines || 0, MAIN_FILE)
                } catch (_mapErr) {
                    // If mapping fails, fall back to showing only the first line
                    const first = (full || '').split('\n')[0] || String(full)
                    appendTerminal('Transform/run error: ' + first, 'runtime')
                }
            } else {
                // Non-Python errors: show only the top-level message to avoid
                // leaking vendor/app JS stack frames into the user-facing
                // terminal. If the developer has enabled the debug flag,
                // reveal the full stack for troubleshooting.
                const firstLine = (full || '').split('\n')[0] || String(full)
                appendTerminal('Transform/run error: ' + firstLine, 'runtime')
                try {
                    if (typeof window !== 'undefined' && window.__ssg_debug_show_vendor_frames) {
                        // show the full (unsanitized) text in debug mode
                        appendTerminal(full, 'runtime')
                    }
                } catch (_e) { }
            }
        } catch (_e) {
            appendTerminal('Transform/run error: ' + stringifyError(e), 'runtime')
        }
        try { setTerminalInputEnabled(false) } catch (_e) { }
    } finally {
        // NEW: Finalize recording and show replay controls
        if (recordingEnabled && recorder) {
            recorder.finalizeRecording()

            // Clean up Python instrumentation
            try {
                const { getPythonInstrumentor } = await import('./python-instrumentor.js')
                const instrumentor = getPythonInstrumentor()
                instrumentor.cleanup()
            } catch (e) {
                appendTerminalDebug('Failed to cleanup Python instrumentation: ' + e)
            }

            // Clean up execution monitoring hooks
            try {
                if (window.__ssg_execution_intercepted) {
                    // Call cleanup function from micropython.js
                    if (typeof window.cleanupExecutionStepMonitoring === 'function') {
                        window.cleanupExecutionStepMonitoring()
                    }
                }
            } catch (e) {
                appendTerminalDebug('Failed to cleanup execution monitoring: ' + e)
            }

            // Show replay controls if recording is available
            try {
                if (recorder.hasActiveRecording() && window.ReplayUI) {
                    window.ReplayUI.updateReplayControls(true)
                    appendTerminalDebug('Replay controls enabled - recording available')
                }
            } catch (e) {
                appendTerminalDebug('Failed to update replay controls: ' + e)
            }
        }

        // Always reset execution state
        setExecutionRunning(false)
    }
}
