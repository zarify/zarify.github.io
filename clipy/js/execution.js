// Python code execution engine
import { appendTerminal, appendTerminalDebug, setTerminalInputEnabled, activateSideTab, enableStderrBuffering, replaceBufferedStderr, flushStderrBufferRaw } from './terminal.js'
import { getRuntimeAdapter, setExecutionRunning, getExecutionState, interruptMicroPythonVM } from './micropython.js'
import { getFileManager, MAIN_FILE, markExpectedWrite, setSystemWriteMode } from './vfs-client.js'
import { transformAndWrap, mapTracebackAndShow, highlightMappedTracebackInEditor, clearAllErrorHighlights, clearAllFeedbackHighlights } from './code-transform.js'

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

// Sync VFS files before execution
async function syncVFSBeforeRun() {
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
    } catch (_m) {
        appendTerminal('VFS pre-run mount error: ' + _m, 'runtime')
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
        appendTerminal('VFS sync after run failed: ' + e, 'runtime')
    }
}

export async function runPythonCode(code, cfg) {
    const runtimeAdapter = getRuntimeAdapter()

    if (getExecutionState().isRunning) {
        appendTerminal('>>> Execution already in progress...', 'runtime')
        return
    }

    setExecutionRunning(true)
    appendTerminal('>>> Running...', 'runtime')

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
            window.clearMicroPythonState()
        }
    } catch (err) {
        appendTerminalDebug('⚠️ State clearing failed:', err)
    }

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
        if (runtimeAdapter) {
            // Sync VFS before execution
            await syncVFSBeforeRun()

            // Check if this is asyncify MicroPython (runPythonAsync available)
            const isAsyncify = runtimeAdapter && (typeof runtimeAdapter.runPythonAsync === 'function')

            let codeToRun = code
            let headerLines = 0
            let needsTransformation = false

            if (isAsyncify) {
                // With asyncify, we can run the code directly without transformation!
                appendTerminalDebug('Using asyncify MicroPython - no transformation needed')
                codeToRun = code
                headerLines = 0
            } else {
                // Non-asyncify runtime: transform input() to await host.get_input()
                appendTerminalDebug('Using transform-based approach for input() handling')
                const transformed = transformAndWrap(code)
                codeToRun = transformed.code
                headerLines = transformed.headerLines
                needsTransformation = true
            }

            // Enable stderr buffering so we can replace raw runtime tracebacks with mapped ones
            try { enableStderrBuffering() } catch (_e) { }

            // Try asyncify execution first (preferred path)
            if (isAsyncify && !needsTransformation) {
                appendTerminalDebug('Executing with asyncify runPythonAsync - native input() support')
                try {
                    let out = ''
                    if (typeof runtimeAdapter.runPythonAsync === 'function') {
                        out = await executeWithTimeout(runtimeAdapter.runPythonAsync(codeToRun), timeoutMs, safetyTimeoutMs)
                    } else {
                        // Fallback to regular run method
                        out = await executeWithTimeout(runtimeAdapter.run(codeToRun), timeoutMs, safetyTimeoutMs)
                    }
                    const runtimeOutput = out === undefined ? '' : String(out)
                    if (runtimeOutput) appendTerminal(runtimeOutput, 'stdout')
                    // Feedback evaluation moved to end of execution to include all data
                } catch (asyncifyErr) {
                    const errMsg = String(asyncifyErr)

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
                        if (runtimeAdapter && runtimeAdapter.clearInterrupt) {
                            try {
                                appendTerminalDebug('Clearing interrupt state with asyncify API...')
                                runtimeAdapter.clearInterrupt()
                                appendTerminalDebug('✅ Basic interrupt state cleared')
                            } catch (err) {
                                appendTerminalDebug('Asyncify clear interrupt failed: ' + err)
                            }
                        }

                        // Try to reset asyncify state by reinitializing the runtime adapter
                        try {
                            if (runtimeAdapter && runtimeAdapter._module) {
                                appendTerminalDebug('Attempting to reset asyncify state...')

                                // Try to access and reset asyncify internals if possible
                                const Module = runtimeAdapter._module
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
                                try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'about_to_map', headerLines: headerLines || 0, sourcePath: MAIN_FILE || null, rawPreview: String(errMsg || '').slice(0, 200) }) } catch (_e) { }
                                const mapped = mapTracebackAndShow(errMsg, headerLines, MAIN_FILE)
                                try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'mapped_result', headerLines: headerLines || 0, sourcePath: MAIN_FILE || null, rawPreview: String(errMsg || '').slice(0, 200), mappedPreview: (mapped == null) ? null : String(mapped).slice(0, 200) }) } catch (_e) { }
                                try { window.__ssg_last_mapped = String(mapped || '') } catch (_e) { }
                                try { window.__ssg_last_mapped_event = { when: Date.now(), headerLines: headerLines || 0, sourcePath: MAIN_FILE || null, mapped: String(mapped || '') } } catch (_e) { }
                                try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'execution_replace_call', mappedType: typeof mapped, mappedPreview: (typeof mapped === 'string') ? mapped.slice(0, 200) : null }) } catch (_e) { }
                                // Replace buffered raw stderr with mapped traceback
                                try { replaceBufferedStderr(mapped) } catch (_e) { }
                            } catch (_e) {
                                // Fallback: if mapping fails, flush buffered raw stderr
                                try { flushStderrBufferRaw() } catch (_e2) { }
                                appendTerminal(errMsg, 'stderr')
                            } finally {
                                try { window.__ssg_mapping_in_progress = false } catch (_e) { }
                            }
                        } else {
                            // For non-Python errors, show with context
                            appendTerminal('Execution error: ' + errMsg, 'runtime')
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
                            await runtimeAdapter.run('async def __ssg_probe():\n    pass')
                        } catch (probeErr) {
                            const pm = String(probeErr || '')
                            if (/syntax|invalid|bad input|indent/i.test(pm)) {
                                throw new Error('no async runner available')
                            }
                        }
                    }

                    const out = await executeWithTimeout(runtimeAdapter.run(codeToRun), timeoutMs, safetyTimeoutMs)
                    const runtimeOutput = out === undefined ? '' : String(out)
                    if (runtimeOutput) appendTerminal(runtimeOutput, 'stdout')
                    // Feedback evaluation moved to end of execution to include all data
                } catch (e) {
                    const msg = String(e || '')

                    // If no async runner is available, handle with fallback logic
                    if (/no async runner available/i.test(msg)) {
                        // TODO: Implement fallback split-run strategy here if needed
                        appendTerminal('Error: This runtime does not support async input handling', 'runtime')
                        appendTerminal('Consider using an asyncify-enabled MicroPython runtime', 'runtime')
                        throw e
                    } else {
                        try {
                            try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'about_to_map', headerLines: headerLines || 0, sourcePath: MAIN_FILE || null, rawPreview: String(e || '').slice(0, 200) }) } catch (_e) { }
                            const mapped = mapTracebackAndShow(String(e), headerLines, MAIN_FILE)
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
                            appendTerminal('Runtime error: ' + e, 'runtime')
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
                        // Prefer the mapped traceback when available, but fall back to
                        // any buffered/raw stderr so feedback rules that look for
                        // strings like "Traceback" can still match even if mapping
                        // did not produce a mapped result.
                        let stderrFull = ''
                        try {
                            const mapped = (typeof window.__ssg_last_mapped === 'string' && window.__ssg_last_mapped) ? window.__ssg_last_mapped : ''
                            const rawBuf = Array.isArray(window.__ssg_last_raw_stderr_buffer) && window.__ssg_last_raw_stderr_buffer.length ? window.__ssg_last_raw_stderr_buffer : (Array.isArray(window.__ssg_stderr_buffer) ? window.__ssg_stderr_buffer : [])
                            const buffered = (Array.isArray(rawBuf) && rawBuf.length) ? rawBuf.join('\n') : ''
                            if (mapped && buffered) {
                                // Combine mapped and raw buffered stderr so rules that
                                // look for original runtime markers (e.g. "Traceback")
                                // still match even when mapping produced a cleaned
                                // traceback string.
                                stderrFull = mapped + '\n' + buffered
                            } else if (mapped) {
                                stderrFull = mapped
                            } else if (buffered) {
                                stderrFull = buffered
                            } else if (outEl) {
                                // As a last resort, extract terminal lines that look
                                // like stderr/traceback fragments from the DOM.
                                try {
                                    const parts = Array.from(outEl.children || []).map(n => n.textContent || '')
                                    stderrFull = parts.filter(t => /Traceback|<stdin>|<string>/i.test(t)).join('\n')
                                } catch (_e) { stderrFull = '' }
                            }
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
        appendTerminal('Transform/run error: ' + e, 'runtime')
        try { setTerminalInputEnabled(false) } catch (_e) { }
    } finally {
        // Always reset execution state
        setExecutionRunning(false)
    }
}
