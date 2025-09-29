// MicroPython runtime management and interrupt system
import { appendTerminal, appendTerminalDebug, setTerminalInputEnabled } from './terminal.js'
import { $ } from './utils.js'
import { createInputHandler, createHostModule } from './input-handling.js'
import { debug as logDebug, info as logInfo, warn as logWarn, error as logError } from './logger.js'

// Global state
let runtimeAdapter = null

// Helper: normalize a path for display to the user (strip any leading slashes)
function _displayPathForUser(path) {
    try {
        if (path == null) return String(path)
        const s = String(path)
        // remove any leading slashes so paths are reported relative to main.py
        return s.replace(/^\/+/g, '')
    } catch (_e) { return String(path) }
}

// Helper: throw a read-only permission error consistently. If the FS
// provides ErrnoError, prefer throwing that to match runtime expectations.
function _throwReadOnly(fs, path, isDir) {
    const display = _displayPathForUser(path)
    if (fs && typeof fs.ErrnoError === 'function') throw new fs.ErrnoError(13)
    const e = new Error('Permission denied: read-only ' + (isDir ? 'path ' : 'file ') + display)
    e.errno = 13
    throw e
}
let executionState = {
    isRunning: false,
    currentAbortController: null,
    timeoutId: null,
    safetyTimeoutId: null
}

// Debug gating for reset/instrumentation. Use window.__ssg_debug_reset or
// window.__ssg_debug_logs to enable verbose reset logs and terminal debug.
function _resetEnabled() {
    try {
        if (typeof window === 'undefined') return false
        return !!(window.__ssg_debug_reset === true || window.__ssg_debug_logs === true)
    } catch (_e) { return false }
}

function _resetDebug(level, ...args) {
    if (!_resetEnabled()) return
    try {
        const msg = args.map(a => { try { return String(a) } catch (_e) { return '' } }).join(' ')
        if (level === 'log' && console && typeof console.log === 'function') console.log(...args)
        else if (level === 'warn' && console && typeof console.warn === 'function') console.warn(...args)
        else if (level === 'error' && console && typeof console.error === 'function') console.error(...args)
        try { if (typeof appendTerminalDebug === 'function') appendTerminalDebug(msg) } catch (_e) { }
    } catch (_e) { }
}

export function setExecutionRunning(running) {
    executionState.isRunning = running
    const runBtn = $('run')
    const stopBtn = $('stop')

    if (runBtn) {
        runBtn.disabled = running
        runBtn.style.display = running ? 'none' : 'inline-flex'
    }
    if (stopBtn) {
        stopBtn.disabled = !running
        stopBtn.style.display = running ? 'inline-flex' : 'none'
    }

    // When stopping execution, clean up any pending input promises and terminal state
    if (!running) {
        try {
            // Resolve any pending input promises with empty string to allow graceful exit
            if (window.__ssg_pending_input && typeof window.__ssg_pending_input.resolve === 'function') {
                appendTerminalDebug('Cleaning up pending input promise')
                window.__ssg_pending_input.resolve('')
                delete window.__ssg_pending_input
            }
        } catch (_e) {
            appendTerminalDebug('Error cleaning up pending input: ' + _e)
        }

        try {
            // Reset terminal input state
            setTerminalInputEnabled(false)
            const stdinBox = $('stdin-box')
            if (stdinBox) {
                stdinBox.value = ''
                stdinBox.blur()
            }
        } catch (_e) {
            appendTerminalDebug('Error resetting terminal input: ' + _e)
        }

        try {
            // Clear any execution timeouts
            if (executionState.timeoutId) {
                clearTimeout(executionState.timeoutId)
                executionState.timeoutId = null
            }
            if (executionState.safetyTimeoutId) {
                clearTimeout(executionState.safetyTimeoutId)
                executionState.safetyTimeoutId = null
            }
        } catch (_e) {
            appendTerminalDebug('Error clearing timeout: ' + _e)
        }
    }
}

// Helper: Send KeyboardInterrupt to MicroPython VM
export function interruptMicroPythonVM() {
    if (!runtimeAdapter) {
        appendTerminalDebug('Cannot interrupt: no runtime adapter available')
        return false
    }

    // Check if we're in a vulnerable state (pending input)
    if (window.__ssg_pending_input) {
        appendTerminalDebug('Warning: Interrupting during input() - this may cause VM state issues')
        appendTerminal('⚠️ Interrupting during input may require recovery afterward', 'runtime')
    }

    // NEW: Try asyncify interrupt API first (much more reliable)
    if (runtimeAdapter.hasYieldingSupport && runtimeAdapter.interruptExecution) {
        try {
            appendTerminalDebug('Using asyncify interrupt API...')
            runtimeAdapter.interruptExecution()
            appendTerminalDebug('✅ VM interrupt sent via interruptExecution()')
            return true
        } catch (err) {
            appendTerminalDebug('Asyncify interrupt failed: ' + err)
            // Fall through to legacy method
        }
    }

    // Legacy fallback: try the old mp_sched_keyboard_interrupt method
    if (runtimeAdapter._module && typeof runtimeAdapter._module.ccall === 'function') {
        try {
            appendTerminalDebug('Falling back to legacy mp_sched_keyboard_interrupt...')
            runtimeAdapter._module.ccall('mp_sched_keyboard_interrupt', 'null', [], [])
            appendTerminalDebug('✅ VM interrupt sent via legacy API')
            return true
        } catch (err) {
            appendTerminalDebug('Legacy VM interrupt failed: ' + err)
        }
    }

    appendTerminalDebug('❌ No VM interrupt method available')
    return false
}

// Enhanced interrupt and yielding functions for asyncify builds
export function setupMicroPythonAPI() {
    try {
        // Store interrupt function globally for easy access
        window.__ssg_interrupt_vm = interruptMicroPythonVM

        // User-friendly interrupt function
        window.interruptPython = function () {
            if (!executionState.isRunning) {
                logInfo('No Python execution is currently running')
                return false
            }

            logInfo('Interrupting Python execution...')
            const success = interruptMicroPythonVM()

            if (success) {
                logInfo('KeyboardInterrupt sent to MicroPython VM')
                setExecutionRunning(false)
            } else {
                logWarn('VM interrupt failed, falling back to AbortController')
                if (executionState.currentAbortController) {
                    executionState.currentAbortController.abort()
                    setExecutionRunning(false)
                }
            }

            return success
        }

        // NEW: Expose yielding controls globally for debugging
        window.setMicroPythonYielding = function (enabled) {
            if (!runtimeAdapter) {
                logWarn('No runtime adapter available')
                return false
            }

            if (!runtimeAdapter.setYielding) {
                logWarn('Yielding control not available (requires asyncify build)')
                return false
            }

            try {
                runtimeAdapter.setYielding(enabled)
                logInfo(`✅ MicroPython yielding ${enabled ? 'enabled' : 'disabled'}`)

                if (enabled) {
                    logInfo('💡 Yielding enabled - loops with time.sleep() should be interruptible')
                    logInfo('💡 Browser should remain responsive during Python execution')
                } else {
                    logWarn('⚠️ Yielding disabled - maximum speed but may not be interruptible')
                    logWarn('⚠️ Browser may become unresponsive during long operations')
                }

                return true
            } catch (err) {
                logError('❌ Failed to set yielding:', err)
                return false
            }
        }

        window.clearMicroPythonInterrupt = function () {
            if (!runtimeAdapter) {
                logInfo('No runtime adapter available')
                return false
            }

            let success = false

            // Try asyncify clear interrupt method
            if (runtimeAdapter.clearInterrupt) {
                try {
                    runtimeAdapter.clearInterrupt()
                    logInfo('✅ Interrupt state cleared with asyncify API')
                    success = true
                } catch (err) {
                    logDebug('Asyncify clear interrupt failed:', err)
                }
            }

            // Try aggressive asyncify state reset
            if (runtimeAdapter._module) {
                const Module = runtimeAdapter._module

                // Reset asyncify internals if accessible
                if (Module.Asyncify) {
                    try {
                        logDebug('Attempting to reset Asyncify state...')
                        if (Module.Asyncify.currData !== undefined) {
                            Module.Asyncify.currData = 0
                            logDebug('✅ Asyncify.currData reset')
                        }
                        if (Module.Asyncify.state !== undefined) {
                            Module.Asyncify.state = 0  // Normal state
                            logDebug('✅ Asyncify.state reset')
                        }
                        success = true
                    } catch (err) {
                        logWarn('Asyncify state reset failed:', err)
                    }
                }

                // REPL reset
                if (typeof Module.ccall === 'function') {
                    try {
                        Module.ccall('mp_js_repl_init', 'null', [], [])
                        logDebug('✅ REPL state reset')
                        success = true
                    } catch (err) {
                        logWarn('REPL reset failed:', err)
                    }
                }
            }

            // Also try to clean up any pending input state
            try {
                if (window.__ssg_pending_input) {
                    logDebug('Cleaning up pending input state...')
                    delete window.__ssg_pending_input
                }
                setExecutionRunning(false)
                success = true
            } catch (err) {
                logWarn('Failed to clean up input state:', err)
            }

            if (!success) {
                logWarn('❌ Could not clear interrupt state - may need page refresh')
            }

            return success
        }

        // Status function to show what interrupt methods are available
        window.getMicroPythonInterruptStatus = function () {
            const status = {
                runtimeLoaded: !!runtimeAdapter,
                hasYieldingSupport: !!(runtimeAdapter?.hasYieldingSupport),
                hasLegacyInterrupt: !!(runtimeAdapter?._module?.ccall),
                isExecuting: executionState.isRunning,
                availableMethods: []
            }

            if (status.hasYieldingSupport) {
                status.availableMethods.push('asyncify interruptExecution()')
            }
            if (status.hasLegacyInterrupt) {
                status.availableMethods.push('legacy mp_sched_keyboard_interrupt()')
            }
            if (status.availableMethods.length === 0) {
                status.availableMethods.push('AbortController (non-VM)')
            }

            logInfo('MicroPython Interrupt Status:', status)
            return status
        }

        // Soft/reset functions moved to module top-level exports to avoid
        // exporting from inside a block scope. See top-level softResetMicroPythonRuntime/restartMicroPythonRuntime.
    } catch (_e) { }
}

// Setup stop button handler
export function setupStopButton() {
    const stopBtn = $('stop')
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            if (executionState.isRunning) {
                appendTerminal('>>> Execution cancelled by user', 'runtime')

                // Try to interrupt the MicroPython VM cleanly first
                const interrupted = interruptMicroPythonVM()

                // Clean up any pending input promises immediately
                try {
                    if (window.__ssg_pending_input) {
                        appendTerminalDebug('Cleaning up pending input after interrupt...')
                        if (typeof window.__ssg_pending_input.resolve === 'function') {
                            window.__ssg_pending_input.resolve('')
                        }
                        delete window.__ssg_pending_input
                    }
                    setTerminalInputEnabled(false)
                } catch (_e) { }

                // If VM interrupt failed, fall back to AbortController
                if (!interrupted && executionState.currentAbortController) {
                    try {
                        appendTerminalDebug('Falling back to AbortController...')
                        executionState.currentAbortController.abort()
                    } catch (_e) {
                        appendTerminalDebug('AbortController failed: ' + _e)
                    }
                }

                // Clean up execution state 
                setExecutionRunning(false)

                // For asyncify builds, attempt to clear interrupt state after processing
                if (interrupted && runtimeAdapter?.clearInterrupt) {
                    setTimeout(() => {
                        try {
                            appendTerminalDebug('Clearing interrupt state after processing...')
                            runtimeAdapter.clearInterrupt()
                            appendTerminalDebug('✅ Interrupt state cleared')

                            // IMPORTANT: Re-enable yielding after interrupt cleanup
                            if (runtimeAdapter.setYielding) {
                                try {
                                    runtimeAdapter.setYielding(true)
                                    appendTerminalDebug('✅ Yielding re-enabled after interrupt')
                                    window.__ssg_yielding_enabled = true
                                } catch (err) {
                                    appendTerminalDebug('❌ Failed to re-enable yielding: ' + err)
                                    window.__ssg_yielding_enabled = false
                                }
                            }
                        } catch (err) {
                            appendTerminalDebug('Failed to clear interrupt state: ' + err)
                        }
                    }, 200)
                } else if (!interrupted) {
                    // Try to reset the runtime to prevent "async operation in flight" errors
                    try {
                        // For asyncify MicroPython, try to reset by running a simple synchronous command
                        if (runtimeAdapter && typeof runtimeAdapter.run === 'function') {
                            setTimeout(async () => {
                                try {
                                    appendTerminalDebug('Attempting runtime reset...')
                                    // Run a simple non-async command to help reset the asyncify state
                                    await runtimeAdapter.run('# runtime reset')
                                    appendTerminalDebug('Runtime reset completed')
                                } catch (resetErr) {
                                    appendTerminalDebug('Runtime reset failed: ' + resetErr)
                                    // If reset fails, the user may need to refresh the page
                                    appendTerminal('Warning: Runtime may be in inconsistent state. If next execution fails, try refreshing the page.', 'runtime')
                                }
                            }, 150)
                        }
                    } catch (_e) {
                        appendTerminalDebug('Error during runtime reset: ' + _e)
                    }
                }
            }
        })
    }
}

// Top-level: Soft reset: try to put the VM into a clean, deterministic state
// without a full WASM re-initialization. If the soft reset fails,
// restartMicroPythonRuntime(cfg) can be used to recreate the VM.
export async function softResetMicroPythonRuntime() {
    if (!runtimeAdapter || !runtimeAdapter._module) {
        _resetDebug('log', '[softReset] no runtime adapter')
        _resetDebug('log', 'softReset: no runtime adapter')
        return false
    }

    try {
        _resetDebug('log', '[softReset] start')
        const Module = runtimeAdapter._module

        // 1) Try VM-level interrupt/clear APIs first (asyncify-enabled runtimes)
        try {
            if (typeof runtimeAdapter.clearInterrupt === 'function') {
                try { runtimeAdapter.clearInterrupt() } catch (_e) { }
            }
        } catch (_e) { }

        // 2) Try to reset Asyncify internals if exposed
        try {
            if (Module && Module.Asyncify) {
                try {
                    if (Module.Asyncify.currData !== undefined) Module.Asyncify.currData = 0
                    if (Module.Asyncify.state !== undefined) Module.Asyncify.state = 0
                } catch (_e) { }
            }
        } catch (_e) { }

        // 3) If the compiled module exposes a helper to reset REPL/state, call it
        try {
            if (typeof Module.ccall === 'function') {
                try { Module.ccall('mp_js_repl_init', 'null', [], []) } catch (_e) { }
            }
        } catch (_e) { }

        // 4) Run a conservative Python clearing snippet to remove user modules
        //    and globals (keeps built-ins). This is intentionally conservative
        //    to avoid blowing away runtime-provided modules.
        const pyClear = `
import sys
import gc

_builtin = set(['sys','gc','builtins','__main__','micropython','host','host_notify'])
_to_del = []
for name in list(sys.modules.keys()):
    if name not in _builtin and not name.startswith('_'):
        _to_del.append(name)
for name in _to_del:
    try:
        del sys.modules[name]
    except Exception:
        pass

# Clear user globals on __main__ while preserving known builtins
g = globals()
_preserve = set(['__builtins__','__name__','__doc__','__package__','__loader__','__spec__','sys','gc'])
_gdel = []
for k in list(g.keys()):
    if k not in _preserve and not k.startswith('_'):
        _gdel.append(k)
for k in _gdel:
    try:
        del g[k]
    except Exception:
        pass

try:
    gc.collect()
except Exception:
    pass
`

        try {
            if (typeof runtimeAdapter.run === 'function') {
                // prefer async variant when available
                if (typeof runtimeAdapter.runPythonAsync === 'function') {
                    await runtimeAdapter.runPythonAsync(pyClear)
                } else {
                    await runtimeAdapter.run(pyClear)
                }
            }
        } catch (err) {
            _resetDebug('warn', '[softReset] python clear failed:', err)
            _resetDebug('log', 'softReset: python clear failed: ' + err)
            // continue to other attempts; don't immediately fail
        }

        // 5) Re-enable yielding if available so interrupts remain possible
        try {
            if (typeof runtimeAdapter.setYielding === 'function') {
                try { runtimeAdapter.setYielding(true); window.__ssg_yielding_enabled = true } catch (_e) { window.__ssg_yielding_enabled = false }
            }
        } catch (_e) { }

        // 6) Re-register host modules if needed
        try {
            if (typeof Module.registerJsModule === 'function' && typeof createHostModule === 'function') {
                try { Module.registerJsModule('host', createHostModule()) } catch (_e) { }
                try { Module.registerJsModule('host_notify', { notify_file_written: (p, c) => { try { window.__ssg_notify_file_written && window.__ssg_notify_file_written(p, c) } catch (_e) { } } }) } catch (_e) { }
            }
        } catch (_e) { }

        _resetDebug('log', '[softReset] completed: success')
        _resetDebug('log', '✅ softResetMicroPythonRuntime completed')
        return true
    } catch (err) {
        _resetDebug('error', '[softReset] failed:', err)
        _resetDebug('log', 'softResetMicroPythonRuntime failed: ' + err)
        return false
    }
}

// Full restart: recreate the runtime instance from scratch and restore FS
export async function restartMicroPythonRuntime(cfg) {
    const oldAdapter = runtimeAdapter
    const snapshot = {}

    _resetDebug('log', '[restart] start')

    // snapshot runtime FS (best-effort)
    try {
        const fs = (oldAdapter && oldAdapter._module && oldAdapter._module.FS) ? oldAdapter._module.FS : window.__ssg_runtime_fs
        if (fs && typeof fs.readdir === 'function') {
            // simple recursive walk
            const walk = (dir) => {
                try {
                    const entries = fs.readdir(dir)
                    for (const e of entries) {
                        if (e === '.' || e === '..') continue
                        const path = dir === '/' ? '/' + e : dir + '/' + e
                        try {
                            const data = fs.readFile(path)
                            snapshot[path] = data
                        } catch (_e) {
                            try { walk(path) } catch (_e2) { }
                        }
                    }
                } catch (_e) { }
            }
            try { walk('/') } catch (_e) { }
        }
    } catch (_e) { _resetDebug('log', 'restart: snapshot failed: ' + _e) }

    // try graceful termination hooks
    try {
        if (oldAdapter && oldAdapter._module) {
            const mod = oldAdapter._module
            if (typeof mod.terminate === 'function') {
                try { mod.terminate() } catch (_e) { }
            }
            try { delete window.__ssg_runtime_fs } catch (_e) { }
        }
    } catch (_e) { }

    try { setRuntimeAdapter(null) } catch (_e) { }

    // load a fresh runtime
    let newAdapter = null
    try {
        newAdapter = await loadMicroPythonRuntime(cfg || window.currentConfig || {})
    } catch (e) {
        _resetDebug('error', '[restart] loadMicroPythonRuntime failed:', e)
        appendTerminal && appendTerminal('Failed to restart runtime: ' + e, 'runtime')
        _resetDebug('log', 'restart failed: ' + e)
        return false
    }

    // restore files into new FS (suppress notifications)
    try {
        window.__ssg_suppress_notifier = true
        const fs = newAdapter && newAdapter._module && newAdapter._module.FS ? newAdapter._module.FS : window.__ssg_runtime_fs
        if (fs) {
            for (const [path, data] of Object.entries(snapshot)) {
                try {
                    // create parent directories (best-effort)
                    const parts = path.split('/').slice(1, -1)
                    let cur = '/'
                    for (const p of parts) {
                        if (!p) continue
                        const next = cur === '/' ? '/' + p : cur + '/' + p
                        try { fs.mkdir(next) } catch (_e) { }
                        cur = next
                    }
                    if (typeof fs.writeFile === 'function') {
                        try { fs.writeFile(path, data) } catch (_e) { try { fs.writeFile(path, typeof data === 'string' ? data : new Uint8Array(data)) } catch (_e2) { } }
                    } else if (typeof fs.createDataFile === 'function') {
                        try { fs.createDataFile('/', path.replace(/^\/+/, ''), data, true, true) } catch (_e) { }
                    }
                } catch (_e) { _resetDebug('log', 'restart: restore failed ' + path + ' ' + _e) }
            }
        }
    } catch (_e) { appendTerminalDebug && appendTerminalDebug('restart restore failed: ' + _e) }
    finally { try { window.__ssg_suppress_notifier = false } catch (_e) { } }

    setRuntimeAdapter(newAdapter)
    _resetDebug('log', '[restart] completed: success')
    _resetDebug('log', '✅ MicroPython runtime restarted')
    return true
}

// State clearing function used by the UI: prefer soft reset, fallback to full restart
export async function clearMicroPythonState(opts) {
    // opts: { fallbackToRestart: true/false, cfg }
    try {
        _resetDebug('log', '[clearState] invoking softResetMicroPythonRuntime')
        const ok = await softResetMicroPythonRuntime()
        if (ok) {
            _resetDebug('log', '[clearState] softReset succeeded; no restart needed')
            return true
        }
        _resetDebug('warn', '[clearState] softReset returned false')
        if (opts && opts.fallbackToRestart === false) return false
        // fallback to full restart if soft reset didn't achieve a clean state
        _resetDebug('log', '[clearState] falling back to restartMicroPythonRuntime')
        return await restartMicroPythonRuntime((opts && opts.cfg) ? opts.cfg : (typeof window !== 'undefined' ? window.currentConfig : undefined))
    } catch (e) {
        _resetDebug('error', '[clearState] wrapper failed:', e)
        _resetDebug('log', 'clearMicroPythonState wrapper failed: ' + e)
        return false
    }
}

// Attach to window for legacy callers in the browser environment
if (typeof window !== 'undefined') {
    try { window.clearMicroPythonState = clearMicroPythonState } catch (_e) { }
}

// Add keyboard shortcut for VM interrupt (Ctrl+C)
export function setupKeyboardInterrupt() {
    document.addEventListener('keydown', (e) => {
        // Only handle Ctrl+C when execution is running and not typing in input field
        if (e.ctrlKey && e.key === 'c' && executionState.isRunning) {
            // Don't interrupt if user is typing in the stdin box
            const stdinBox = $('stdin-box')
            if (stdinBox && document.activeElement === stdinBox) {
                return // Let normal Ctrl+C behavior work in input field
            }

            e.preventDefault()
            e.stopPropagation()

            // Trigger the same interrupt logic as the stop button
            appendTerminal('>>> KeyboardInterrupt (Ctrl+C)', 'runtime')
            const interrupted = interruptMicroPythonVM()

            if (!interrupted && executionState.currentAbortController) {
                try {
                    appendTerminalDebug('Falling back to AbortController...')
                    executionState.currentAbortController.abort()
                } catch (_e) {
                    appendTerminalDebug('AbortController failed: ' + _e)
                }
            }

            setExecutionRunning(false)
        }
    })
}

export async function loadMicroPythonRuntime(cfg) {
    appendTerminalDebug('Loading MicroPython runtime...')

    // Load local vendored asyncify MicroPython directly: ./vendor/micropython.mjs
    try {
        let localMod = null
        try {
            // Import micropython.mjs directly to get loadMicroPython function
            await import('../vendor/micropython.mjs')
            if (globalThis.loadMicroPython) {
                localMod = { loadMicroPython: globalThis.loadMicroPython }
                appendTerminalDebug('Loaded asyncify runtime via direct import: ./vendor/micropython.mjs')
            } else {
                appendTerminalDebug('micropython.mjs imported but loadMicroPython not found on globalThis')
            }
        } catch (e) {
            appendTerminalDebug('Failed to import ./vendor/micropython.mjs: ' + e)
        }

        // build adapter from exports
        if (localMod) {
            // Prefer the modern loader API if present: loadMicroPython
            if (typeof localMod.loadMicroPython === 'function') {
                appendTerminalDebug('Vendor module provides loadMicroPython(); initializing runtime...')
                try {
                    let captured = ''
                    // Ensure TextDecoder is available in Node/Jest environments
                    let TextDecoderCtor = typeof TextDecoder !== 'undefined' ? TextDecoder : null
                    if (!TextDecoderCtor) {
                        try {
                            // dynamic import util.TextDecoder in Node
                            const utilMod = await import('util')
                            TextDecoderCtor = utilMod.TextDecoder
                        } catch (_e) {
                            TextDecoderCtor = null
                        }
                    }
                    const td = TextDecoderCtor ? new TextDecoderCtor() : { decode: (buf) => { try { return Buffer.from(buf).toString('utf8') } catch (_e) { return String(buf || '') } } }
                    const stdout = (chunk) => {
                        let content = ''

                        if (typeof chunk === 'string') {
                            content = chunk
                        } else if (chunk && (chunk instanceof Uint8Array || ArrayBuffer.isView(chunk))) {
                            content = td.decode(chunk)
                        } else if (typeof chunk === 'number') {
                            content = String(chunk)
                        } else {
                            content = String(chunk || '')
                        }

                        // Display output immediately to the terminal
                        if (content) {
                            appendTerminal(content, 'stdout')
                            try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'runtime_stdout', text: content.slice(0, 200) }) } catch (_e) { }
                        }

                        captured += content
                    }
                    const stderr = (chunk) => { stdout(chunk) }
                    // Note: stderr intentionally forwards to stdout above; we still log the intent
                    try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'runtime_stderr_hooked' }) } catch (_e) { }

                    // Custom stdin function to replace browser prompts with terminal input
                    // Prefer delegating to the async inputHandler when available to avoid
                    // duplicate/resolving races where both stdin and inputHandler are invoked
                    const stdin = () => {
                        // If we have an inputHandler (async path), delegate to it
                        if (typeof inputHandler === 'function') {
                            try {
                                appendTerminalDebug('Delegating legacy stdin to inputHandler')
                                return Promise.resolve(inputHandler('')).then((v) => {
                                    const val = (typeof v === 'string') ? v : (v == null ? '' : String(v))
                                    return val + '\n'
                                }).catch((err) => {
                                    appendTerminalDebug('Delegated inputHandler failed: ' + err)
                                    // Fallback to legacy pending-input behavior
                                    return new Promise((resolve) => {
                                        window.__ssg_pending_input = {
                                            resolve: (value) => {
                                                delete window.__ssg_pending_input
                                                try { setTerminalInputEnabled(false) } catch (_e) { }
                                                // Track stdin input for feedback system
                                                if (typeof window.__ssg_stdin_history === 'string') {
                                                    window.__ssg_stdin_history += (window.__ssg_stdin_history ? '\n' : '') + value
                                                }
                                                appendTerminal(`DEBUG: Resolving stdin with: ${value}`, 'runtime')
                                                resolve(value + '\n')
                                            },
                                            promptText: ''
                                        }
                                        try { setTerminalInputEnabled(true, ''); } catch (_e) { }
                                        const stdinBox = $('stdin-box')
                                        if (stdinBox) { try { stdinBox.focus() } catch (_e) { } }
                                    })
                                })
                            } catch (err) {
                                appendTerminalDebug('stdin delegation error: ' + err)
                                // fall through to legacy behavior below
                            }
                        }

                        // Legacy path if no inputHandler available
                        appendTerminal('DEBUG: Custom stdin function called!', 'runtime')
                        return new Promise((resolve) => {
                            // Set up input collection using the existing terminal input system
                            window.__ssg_pending_input = {
                                resolve: (value) => {
                                    delete window.__ssg_pending_input
                                    try { setTerminalInputEnabled(false) } catch (_e) { }
                                    // Track stdin input for feedback system
                                    if (typeof window.__ssg_stdin_history === 'string') {
                                        window.__ssg_stdin_history += (window.__ssg_stdin_history ? '\n' : '') + value
                                    }
                                    appendTerminal(`DEBUG: Resolving stdin with: ${value}`, 'runtime')
                                    // Return the input with newline as MicroPython expects
                                    resolve(value + '\n')
                                },
                                promptText: ''
                            }
                            // Enable terminal input immediately
                            try { setTerminalInputEnabled(true, ''); } catch (_e) { }
                            const stdinBox = $('stdin-box')
                            if (stdinBox) { try { stdinBox.focus() } catch (_e) { } }
                        })
                    }

                    // Set up custom input handler
                    const inputHandler = createInputHandler()

                    appendTerminalDebug('Calling vendor loadMicroPython with url: ' + ((cfg && cfg.runtime && cfg.runtime.wasm) || './vendor/micropython.wasm'))
                    const mpInstance = await localMod.loadMicroPython({
                        url: (cfg?.runtime?.wasm) || './vendor/micropython.wasm',
                        stdout, stderr, stdin, linebuffer: true,
                        inputHandler: inputHandler
                    })

                    // mpInstance returned
                    // NEW: Check if this is an asyncify build with yielding support
                    const hasYieldingSupport = typeof mpInstance.interruptExecution === 'function' &&
                        typeof mpInstance.setYielding === 'function' &&
                        typeof mpInstance.clearInterrupt === 'function'

                    if (hasYieldingSupport) {
                        appendTerminal('MicroPython runtime initialized (with yielding support)', 'runtime')
                        appendTerminalDebug('Detected asyncify build with interrupt and yielding support')

                        // Enable yielding by default for interruptibility
                        try {
                            mpInstance.setYielding(true)
                            appendTerminalDebug('✅ Yielding enabled for VM interrupt support')

                            // Verify yielding is actually enabled
                            setTimeout(() => {
                                try {
                                    appendTerminalDebug('Verifying yielding state...')
                                    // Add a flag to track if yielding is enabled
                                    window.__ssg_yielding_enabled = true
                                    appendTerminalDebug('✅ Yielding state tracking initialized')
                                } catch (e) {
                                    appendTerminalDebug('Yielding verification failed: ' + e)
                                }
                            }, 100)

                        } catch (e) {
                            appendTerminalDebug('❌ Failed to enable yielding: ' + e)
                            appendTerminal('Warning: Could not enable yielding - interrupts may not work properly', 'runtime')
                            window.__ssg_yielding_enabled = false
                        }
                    } else {
                        appendTerminal('MicroPython runtime initialized (legacy asyncify build)', 'runtime')
                        appendTerminalDebug('Legacy asyncify build - no yielding support detected')
                    }

                    // expose runtime FS for persistence sync
                    try {
                        window.__ssg_runtime_fs = mpInstance.FS
                        try { installRuntimeFsGuards(window.__ssg_runtime_fs) } catch (_e) { }
                    } catch (e) { }

                    // Register the host module
                    try {
                        const hostModule = createHostModule()

                        if (typeof mpInstance.registerJsModule === 'function') {
                            mpInstance.registerJsModule('host', hostModule)
                        } else {
                            window.__ssg_host = hostModule
                        }

                        appendTerminalDebug('Host module registered for compatibility')
                    } catch (e) {
                        appendTerminal('Note: Could not register host module: ' + e)
                    }

                    // Register notification module for VFS integration
                    try {
                        if (typeof mpInstance.registerJsModule === 'function') {
                            mpInstance.registerJsModule('host_notify', {
                                notify_file_written: (p, c) => {
                                    try {
                                        window.__ssg_notify_file_written(p, c)
                                    } catch (_e) { }
                                }
                            })
                        }
                        appendTerminalDebug('Notification module registered')
                    } catch (e) {
                        appendTerminalDebug('Could not register notification module: ' + e)
                    }

                    // Set up filesystem wrapping for notifications
                    try {
                        setupFilesystemNotifications(mpInstance)
                        appendTerminalDebug('Filesystem notifications configured')
                    } catch (e) {
                        appendTerminalDebug('Could not setup filesystem notifications: ' + e)
                    }

                    // Wrap runtime FS write APIs to enforce read-only protection for user code.
                    try {
                        const fs = mpInstance.FS
                        // Helper to check read-only (consult global config via window.currentConfig)
                        function _isPathReadOnlyForUser(path) {
                            try {
                                // System writes may temporarily enable system mode
                                if (typeof window !== 'undefined' && window.__ssg_system_write_mode) return false
                                const cfg = (typeof window !== 'undefined' && window.currentConfig) ? window.currentConfig : null
                                if (!cfg || !cfg.fileReadOnlyStatus) return false
                                const n = String(path).startsWith('/') ? path : ('/' + String(path).replace(/^\/+/, ''))
                                const bare = n.replace(/^\/+/, '')
                                return !!(cfg.fileReadOnlyStatus[n] || cfg.fileReadOnlyStatus[bare])
                            } catch (_e) { return false }
                        }

                        // Wrap writeFile (some runtimes expose writeFile)
                        if (fs && typeof fs.writeFile === 'function') {
                            const _origWriteFile = fs.writeFile.bind(fs)
                            fs.writeFile = function (path, data, opts) {
                                try {
                                    if (_isPathReadOnlyForUser(path)) {
                                        try { appendTerminalDebug('[vfs-guard] blocking writeFile to ' + _displayPathForUser(path)) } catch (_e) { }
                                        _throwReadOnly(fs, path, false)
                                    }
                                } catch (_e) { }
                                return _origWriteFile(path, data, opts)
                            }
                        }

                        // Wrap createDataFile
                        if (fs && typeof fs.createDataFile === 'function') {
                            const _origCreate = fs.createDataFile.bind(fs)
                            fs.createDataFile = function (parent, name, data, canRead, canWrite) {
                                const path = (parent === '/' ? '' : parent) + '/' + name
                                try {
                                    if (_isPathReadOnlyForUser(path)) {
                                        try { appendTerminalDebug('[vfs-guard] blocking createDataFile -> ' + _displayPathForUser(path)) } catch (_e) { }
                                        _throwReadOnly(fs, path, false)
                                    }
                                } catch (_e) { }
                                return _origCreate(parent, name, data, canRead, canWrite)
                            }
                        }

                        // Wrap low-level write (fd-based) if present
                        if (fs && typeof fs.write === 'function') {
                            const _origWrite = fs.write.bind(fs)
                            fs.write = function (fd, buffer, offset, length, position) {
                                try {
                                    const meta = fs.__ssg_fd_map && fs.__ssg_fd_map[fd]
                                    const path = meta && meta.path ? meta.path : null
                                    if (path && _isPathReadOnlyForUser(path)) {
                                        try { appendTerminalDebug('[vfs-guard] blocking fd write to ' + _displayPathForUser(path)) } catch (_e) { }
                                        _throwReadOnly(fs, path, false)
                                    }
                                } catch (_e) { }
                                return _origWrite(fd, buffer, offset, length, position)
                            }
                        }
                    } catch (_e) {
                        appendTerminalDebug('Failed to install runtime FS write guards: ' + _e)
                    }

                    setRuntimeAdapter({
                        _module: mpInstance,  // Expose the module for asyncify detection
                        hasYieldingSupport: hasYieldingSupport,  // NEW: Flag to indicate asyncify features
                        runPythonAsync: async (code) => {
                            captured = ''
                            try {
                                if (typeof mpInstance.runPythonAsync === 'function') {
                                    const maybe = await mpInstance.runPythonAsync(code)
                                    // Don't return captured output since it's already been displayed in real-time
                                    return maybe == null ? '' : String(maybe)
                                }
                                throw new Error('runPythonAsync not available')
                            } catch (e) { throw e }
                        },
                        run: async (code) => {
                            captured = ''
                            try {
                                // prefer async runner if available
                                if (typeof mpInstance.runPythonAsync === 'function') {
                                    const maybe = await mpInstance.runPythonAsync(code)
                                    // Don't return captured output since it's already been displayed in real-time
                                    return maybe == null ? '' : String(maybe)
                                }
                                if (typeof mpInstance.runPython === 'function') {
                                    const maybe = mpInstance.runPython(code)
                                    // Don't return captured output since it's already been displayed in real-time
                                    return maybe == null ? '' : String(maybe)
                                }
                                // Don't return captured output since it's already been displayed in real-time
                                return ''
                            } catch (e) { throw e }
                        },
                        // NEW: Expose the asyncify interrupt functions
                        interruptExecution: hasYieldingSupport ? mpInstance.interruptExecution.bind(mpInstance) : null,
                        setYielding: hasYieldingSupport ? mpInstance.setYielding.bind(mpInstance) : null,
                        clearInterrupt: hasYieldingSupport ? mpInstance.clearInterrupt.bind(mpInstance) : null
                    })

                    return runtimeAdapter
                } catch (e) {
                    appendTerminal('Failed to initialize vendored MicroPython: ' + e)
                }
            }
        }
    } catch (e) {
        appendTerminalDebug('Local vendor load failed: ' + e)
    }

    // If no local vendor adapter, try external runtime
    // Get runtime URL from config; prefer a JS module (.mjs) so dynamic import
    // resolves to a JS module that will internally locate the .wasm file.
    const runtimeUrl = cfg?.runtime?.url || './vendor/micropython.mjs'

    if (!runtimeUrl || typeof runtimeUrl !== 'string') {
        throw new Error('No valid MicroPython runtime URL specified in configuration')
    }
    if (runtimeUrl) {
        appendTerminalDebug('Loading external runtime: ' + runtimeUrl)
        try {
            const s = document.createElement('script')
            s.src = runtimeUrl
            // If the runtime is an ES module (.mjs), mark the script as a module so import.meta is allowed
            if (/\.mjs(\?|$)/i.test(runtimeUrl)) {
                s.type = 'module'
            }
            s.defer = true
            // allow cross-origin fetching where appropriate
            s.crossOrigin = 'anonymous'
            document.head.appendChild(s)
            appendTerminalDebug('Runtime loader script appended: ' + runtimeUrl)

            // Short polling fallback: some runtime loaders attach FS after a tick.
            // Poll for a short time and install guards when FS appears.
            try {
                const start = Date.now()
                const POLL_MS = 2000
                const interval = setInterval(() => {
                    try {
                        if (window.__ssg_runtime_fs) {
                            try { installRuntimeFsGuards(window.__ssg_runtime_fs) } catch (_e) { }
                            clearInterval(interval)
                            return
                        }
                        if (Date.now() - start > POLL_MS) {
                            clearInterval(interval)
                        }
                    } catch (_e) { clearInterval(interval) }
                }, 120)
            } catch (_e) { }

            // TODO: Add runtime probing logic here if needed
        } catch (e) {
            appendTerminal('Failed to append runtime script: ' + e)
        }
    }

    return runtimeAdapter
}

export function setRuntimeAdapter(adapter) {
    runtimeAdapter = adapter
    window.runtimeAdapter = adapter
    appendTerminalDebug(`Runtime adapter set: ${adapter ? 'available' : 'null'}`)
}

export function getRuntimeAdapter() {
    return runtimeAdapter
}

export function getExecutionState() {
    return executionState
}

// Set up filesystem wrapping to trigger notifications on file writes
function setupFilesystemNotifications(mpInstance) {
    try {
        const fs = mpInstance.FS
        if (!fs) {
            throw new Error('No FS object available')
        }

        // Initialize fd tracking map
        try { fs.__ssg_fd_map = fs.__ssg_fd_map || {} } catch (_e) { }

        // wrap open to remember fd -> { path, wrote }
        if (typeof fs.open === 'function') {
            const origOpen = fs.open.bind(fs)
            fs.open = function (path, flags, mode) {
                const fd = origOpen(path, flags, mode)
                try { fs.__ssg_fd_map[fd] = { path: path, wrote: false } } catch (_e) { }
                return fd
            }
        }

        // wrap write: after writing, attempt to read and notify
        if (typeof fs.write === 'function') {
            const origWrite = fs.write.bind(fs)
            fs.write = function (fd, buffer, offset, length, position) {
                const res = origWrite(fd, buffer, offset, length, position)
                try {
                    // mark this fd as having been written to
                    try { const meta = fs.__ssg_fd_map && fs.__ssg_fd_map[fd]; if (meta) meta.wrote = true } catch (_e) { }
                    const p = fs.__ssg_fd_map && fs.__ssg_fd_map[fd]
                    const path = p && p.path ? p.path : fd
                    // notify asynchronously to avoid re-entrant stack loops during close/read
                    setTimeout(() => {
                        try {
                            if (window.__ssg_suppress_notifier) return
                            if (typeof fs.readFile === 'function') {
                                try {
                                    const data = fs.readFile(path)
                                    const text = (typeof data === 'string') ? data : (new TextDecoder().decode(data))
                                    try { if (typeof window.__ssg_notify_file_written === 'function') window.__ssg_notify_file_written(path, text) } catch (_e) { }
                                } catch (_e) { }
                            }
                        } catch (_e) { }
                    }, 0)
                } catch (_e) { }
                return res
            }
        }

        // wrap close: after close, read the file and notify
        if (typeof fs.close === 'function') {
            const origClose = fs.close.bind(fs)
            fs.close = function (fd) {
                const res = origClose(fd)
                try {
                    const meta = fs.__ssg_fd_map && fs.__ssg_fd_map[fd]
                    if (meta) {
                        // only notify if this fd was written to (avoid notifications for pure reads)
                        if (meta.wrote) {
                            // schedule notify after current stack unwinds to avoid recursion
                            setTimeout(() => {
                                try {
                                    if (window.__ssg_suppress_notifier) return
                                    try {
                                        if (typeof fs.readFile === 'function') {
                                            const data = fs.readFile(meta.path)
                                            const text = (typeof data === 'string') ? data : (new TextDecoder().decode(data))
                                            try { if (typeof window.__ssg_notify_file_written === 'function') window.__ssg_notify_file_written(meta.path, text) } catch (_e) { }
                                        }
                                    } catch (_e) { }
                                } catch (_e) { }
                            }, 0)
                        }
                        try { delete fs.__ssg_fd_map[fd] } catch (_e) { }
                    }
                } catch (_e) { }
                return res
            }
        }

        // wrap createDataFile which some runtimes use to create files
        if (typeof fs.createDataFile === 'function') {
            const origCreateDataFile = fs.createDataFile.bind(fs)
            fs.createDataFile = function (parent, name, data, canRead, canWrite) {
                const res = origCreateDataFile(parent, name, data, canRead, canWrite)
                try {
                    const path = (parent === '/' ? '' : parent) + '/' + name
                    const text = (typeof data === 'string') ? data : (new TextDecoder().decode(data || new Uint8Array()))
                    try { if (typeof window.__ssg_notify_file_written === 'function') window.__ssg_notify_file_written(path, text) } catch (_e) { }
                } catch (_e) { }
                return res
            }
        }
    } catch (e) {
        throw new Error('Failed to setup filesystem notifications: ' + e)
    }
}

// Install runtime FS guards on a given FS object. This is factored out so
// it can be called both when the vendor loader returns the FS and when an
// externally-loaded runtime sets `window.__ssg_runtime_fs` later.
function installRuntimeFsGuards(fs) {
    try {
        if (!fs || fs.__ssg_guards_installed) return
        fs.__ssg_guards_installed = true

        // Debug: list available fs methods
        try {
            const keys = Object.keys(fs).filter(k => typeof fs[k] === 'function')
            appendTerminalDebug && appendTerminalDebug('[vfs-guard] installing on FS methods: ' + keys.join(','))
        } catch (_e) { }

        // Helper to check read-only (consult global config via window.currentConfig)
        function _isPathReadOnlyForUser(path) {
            try {
                if (typeof window !== 'undefined' && window.__ssg_system_write_mode) return false
                const cfg = (typeof window !== 'undefined' && window.currentConfig) ? window.currentConfig : null
                if (!cfg || !cfg.fileReadOnlyStatus) return false
                const n = String(path).startsWith('/') ? path : ('/' + String(path).replace(/^\/+/, ''))
                const bare = n.replace(/^\/+/, '')
                return !!(cfg.fileReadOnlyStatus[n] || cfg.fileReadOnlyStatus[bare])
            } catch (_e) { return false }
        }

        if (typeof fs.writeFile === 'function') {
            const _orig = fs.writeFile.bind(fs)
            fs.writeFile = function (path, data, opts) {
                if (_isPathReadOnlyForUser(path)) {
                    try { appendTerminalDebug('[vfs-guard] blocking writeFile to ' + _displayPathForUser(path)) } catch (_e) { }
                    _throwReadOnly(fs, path, false)
                }
                return _orig(path, data, opts)
            }
        }

        // Wrap writeFileSync if present
        if (typeof fs.writeFileSync === 'function') {
            const _orig = fs.writeFileSync.bind(fs)
            fs.writeFileSync = function (path, data, opts) {
                if (_isPathReadOnlyForUser(path)) {
                    try { appendTerminalDebug('[vfs-guard] blocking writeFileSync to ' + _displayPathForUser(path)) } catch (_e) { }
                    _throwReadOnly(fs, path, false)
                }
                return _orig(path, data, opts)
            }
        }

        if (typeof fs.createDataFile === 'function') {
            const _orig = fs.createDataFile.bind(fs)
            fs.createDataFile = function (parent, name, data, canRead, canWrite) {
                const path = (parent === '/' ? '' : parent) + '/' + name
                if (_isPathReadOnlyForUser(path)) {
                    try { appendTerminalDebug('[vfs-guard] blocking createDataFile -> ' + _displayPathForUser(path)) } catch (_e) { }
                    _throwReadOnly(fs, path, false)
                }
                return _orig(parent, name, data, canRead, canWrite)
            }
        }

        if (typeof fs.write === 'function') {
            const _orig = fs.write.bind(fs)
            fs.write = function (fd, buffer, offset, length, position) {
                const meta = fs.__ssg_fd_map && fs.__ssg_fd_map[fd]
                const path = meta && meta.path ? meta.path : null
                if (path && _isPathReadOnlyForUser(path)) {
                    try { appendTerminalDebug('[vfs-guard] blocking fd write to ' + _displayPathForUser(path)) } catch (_e) { }
                    _throwReadOnly(fs, path, false)
                }
                return _orig(fd, buffer, offset, length, position)
            }
        }

        // Block creation APIs which the runtime can use to create files (mknod/createNode)
        if (typeof fs.createNode === 'function') {
            const _origCreateNode = fs.createNode.bind(fs)
            fs.createNode = function (parent, name, mode, dev) {
                // parent may be a path string or a node object; normalize to a path
                let parentPath = null
                try {
                    if (typeof parent === 'string') parentPath = parent
                    else if (typeof fs.getPath === 'function') parentPath = fs.getPath(parent)
                    else if (parent && parent.name) {
                        // best-effort: walk parents to build a path
                        const parts = []
                        let cur = parent
                        while (cur && cur.name) { parts.unshift(cur.name); cur = cur.parent }
                        parentPath = '/' + parts.join('/')
                    }
                } catch (_e) { parentPath = null }

                const path = (parentPath === '/' ? '' : (parentPath || '')) + '/' + name
                if (_isPathReadOnlyForUser(path)) {
                    _throwReadOnly(fs, path, false)
                }

                return _origCreateNode(parent, name, mode, dev)
            }
        }

        if (typeof fs.mknod === 'function') {
            const _origMknod = fs.mknod.bind(fs)
            fs.mknod = function (path, mode, dev) {
                if (_isPathReadOnlyForUser(path)) {
                    _throwReadOnly(fs, path, false)
                }
                return _origMknod(path, mode, dev)
            }
        }

        // Wrap createStream to prevent creating writable streams on read-only paths
        if (typeof fs.createStream === 'function') {
            const _origCreateStream = fs.createStream.bind(fs)
            fs.createStream = function (node, flags, mode) {
                // attempt to resolve path from node
                let path = null
                try {
                    if (typeof fs.getPath === 'function') path = fs.getPath(node)
                    else if (node && node.name) {
                        // best-effort: walk parents
                        let parts = []
                        let cur = node
                        while (cur && cur.name) { parts.unshift(cur.name); cur = cur.parent }
                        path = '/' + parts.join('/')
                    }
                } catch (_e) { }
                // if flags indicate write/create (string or numeric), block
                let writeMode = false
                if (typeof flags === 'string' && /[wa+]/.test(flags)) writeMode = true
                if (typeof flags === 'number' && (flags & 3) !== 0) writeMode = true
                if (writeMode && path && _isPathReadOnlyForUser(path)) {
                    _throwReadOnly(fs, path, false)
                }
                return _origCreateStream(node, flags, mode)
            }
        }

        // If FS exposes stream_ops (shared stream op implementations), wrap write there
        try {
            if (fs.stream_ops && typeof fs.stream_ops.write === 'function') {
                const _origStreamWrite = fs.stream_ops.write.bind(fs.stream_ops)
                fs.stream_ops.write = function (stream, buffer, offset, length, position) {
                    let path = null
                    try { if (stream && stream.node && typeof fs.getPath === 'function') path = fs.getPath(stream.node) } catch (_e) { }
                    if (path && _isPathReadOnlyForUser(path)) {
                        _throwReadOnly(fs, path, false)
                    }
                    return _origStreamWrite(stream, buffer, offset, length, position)
                }
            }
        } catch (_e) { }

        // Wrap unlink/unlinkSync and rmdir/rmdirSync to block deletion of
        // read-only files/directories when invoked from user code.
        try {
            if (typeof fs.unlink === 'function') {
                const _origUnlink = fs.unlink.bind(fs)
                fs.unlink = function (path) {
                    if (_isPathReadOnlyForUser(path)) {
                        try { appendTerminal && appendTerminal('OSError: [Errno 13] Permission denied: ' + _displayPathForUser(path), 'stderr') } catch (_e) { }
                        _throwReadOnly(fs, path, false)
                    }
                    const res = _origUnlink(path)
                    // Notify host/UI that runtime removed the file so FileManager can sync
                    try { if (typeof window !== 'undefined' && typeof window.__ssg_notify_file_written === 'function') window.__ssg_notify_file_written(path, null) } catch (_e) { }
                    return res
                }
            }

            if (typeof fs.unlinkSync === 'function') {
                const _origUnlinkSync = fs.unlinkSync.bind(fs)
                fs.unlinkSync = function (path) {
                    if (_isPathReadOnlyForUser(path)) {
                        try { appendTerminal && appendTerminal('OSError: [Errno 13] Permission denied: ' + _displayPathForUser(path), 'stderr') } catch (_e) { }
                        _throwReadOnly(fs, path, false)
                    }
                    const res = _origUnlinkSync(path)
                    try { if (typeof window !== 'undefined' && typeof window.__ssg_notify_file_written === 'function') window.__ssg_notify_file_written(path, null) } catch (_e) { }
                    return res
                }
            }

            if (typeof fs.rmdir === 'function') {
                const _origRmdir = fs.rmdir.bind(fs)
                fs.rmdir = function (path) {
                    if (_isPathReadOnlyForUser(path)) {
                        try { appendTerminal && appendTerminal('OSError: [Errno 13] Permission denied: ' + _displayPathForUser(path), 'stderr') } catch (_e) { }
                        _throwReadOnly(fs, path, true)
                    }
                    return _origRmdir(path)
                }
            }

            if (typeof fs.rmdirSync === 'function') {
                const _origRmdirSync = fs.rmdirSync.bind(fs)
                fs.rmdirSync = function (path) {
                    if (_isPathReadOnlyForUser(path)) {
                        try { appendTerminal && appendTerminal('OSError: [Errno 13] Permission denied: ' + _displayPathForUser(path), 'stderr') } catch (_e) { }
                        _throwReadOnly(fs, path, true)
                    }
                    return _origRmdirSync(path)
                }
            }
        } catch (_e) { }

        // Wrap open to block write-mode opens
        if (typeof fs.open === 'function') {
            const _origOpen = fs.open.bind(fs)
            fs.open = function (path, flags, mode) {
                try {
                    // If flags is a string, detect write modes like 'w', 'a', '+'
                    if (typeof flags === 'string' && /[wa+]/.test(flags)) {
                        if (_isPathReadOnlyForUser(path)) {
                            try { appendTerminalDebug('[vfs-guard] blocking open(write) -> ' + _displayPathForUser(path) + ' flags:' + flags) } catch (_e) { }
                            _throwReadOnly(fs, path, false)
                        }
                    }
                    // If flags is numeric, best-effort: block if common write bits set (O_WRONLY|O_RDWR)
                    if (typeof flags === 'number') {
                        // POSIX O_WRONLY=1, O_RDWR=2; check low bits
                        const writeBits = (flags & 3)
                        if (writeBits !== 0) {
                            if (_isPathReadOnlyForUser(path)) {
                                try { appendTerminalDebug('[vfs-guard] blocking open(write numeric) -> ' + _displayPathForUser(path) + ' flags:' + flags) } catch (_e) { }
                                _throwReadOnly(fs, path, false)
                            }
                        }
                    }
                } catch (_e) { }
                return _origOpen(path, flags, mode)
            }
        }

        // After installing guards, add a lightweight tracer that wraps the
        // final function-valued properties on the FS object. This records
        // calls (method name + preview of args) to `window.__ssg_fs_call_log`
        // and emits a debug line via appendTerminalDebug. The tracer is
        // installed last so it wraps the final call-path the runtime uses
        // (including any guard wrappers installed above).
        // PERFORMANCE: Only install tracer if explicitly enabled for debugging
        try {
            const enableTracing = window.__ssg_enable_fs_tracing || window.__ssg_debug_logs
            if (!fs.__ssg_tracer_installed && enableTracing) {
                fs.__ssg_tracer_installed = true

                // small helper to stringify args safely and keep output short
                const _argPreview = (v) => {
                    try {
                        if (v === undefined) return 'undefined'
                        if (v === null) return 'null'
                        if (typeof v === 'string') return JSON.stringify(v).slice(0, 120)
                        if (typeof v === 'number' || typeof v === 'boolean') return String(v)
                        if (v && v.constructor && v.constructor.name === 'Uint8Array') return `Uint8Array(${v.length})`
                        return String(v).slice(0, 120)
                    } catch (_e) { return '[unstringifiable]' }
                }

                const fnKeys = Object.keys(fs).filter(k => typeof fs[k] === 'function')
                fnKeys.forEach((k) => {
                    try {
                        const _orig = fs[k]
                        // Use a non-arrow function so `new.target` is available to
                        // detect constructor invocations. If the runtime calls a
                        // function as a constructor (e.g. `new ErrnoError(...)`),
                        // we must forward that correctly using Reflect.construct
                        // instead of calling the function as a normal call which
                        // would throw "class constructors must be invoked with 'new'".
                        fs[k] = function () {
                            const args = Array.prototype.slice.call(arguments, 0)
                            try {
                                // lightweight trace: record minimal call info (non-noisy)
                                try { window.__ssg_fs_call_log = window.__ssg_fs_call_log || [] } catch (_e) { }
                                try { window.__ssg_fs_call_log.push({ when: Date.now(), method: k, args: args.slice(0, 3).map(_argPreview) }) } catch (_e) { }
                            } catch (_e) { }

                            try {
                                // If called as a constructor (new.target is defined),
                                // use Reflect.construct to create an instance of the
                                // original function/class. Otherwise, call normally.
                                if (typeof new.target !== 'undefined') {
                                    return Reflect.construct(_orig, args, new.target)
                                }
                                return _orig.apply(this, args)
                            } catch (err) {
                                // trace threw - no noisy output
                                throw err
                            }
                        }
                    } catch (_e) { }
                })

                try { appendTerminalDebug && appendTerminalDebug('[vfs-guard] runtime FS tracer installed') } catch (_e) { }
            }
        } catch (_e) { }

        try { appendTerminalDebug('Installed runtime FS guards') } catch (_e) { }
    } catch (e) {
        try { appendTerminalDebug('Failed to install runtime FS guards: ' + e) } catch (_e) { }
    }
}
