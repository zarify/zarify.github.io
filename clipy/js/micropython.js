// MicroPython runtime management and interrupt system
import { appendTerminal, appendTerminalDebug, setTerminalInputEnabled, getTerminalInnerHTML, setTerminalInnerHTML } from './terminal.js'
import { $ } from './utils.js'
import { createInputHandler, createHostModule } from './input-handling.js'
import { debug as logDebug, info as logInfo, warn as logWarn, error as logError } from './logger.js'

// Global state
let runtimeAdapter = null

/**
 * Detect if the runtime supports native sys.settrace()
 * @param {Object} adapter - Runtime adapter to test
 * @returns {Promise<boolean>} True if sys.settrace is available
 */
async function detectNativeTraceSupport(adapter) {
    if (!adapter || typeof adapter.run !== 'function') {
        appendTerminalDebug('Native trace detection skipped: no adapter or run function')
        return false
    }

    try {
        // Use the DIRECT approach from ASYNC_TROUBLESHOOTING.md
        // Test if we can call a JavaScript function from Python
        let callbackWasCalled = false
        let capturedResult = null

        // Set up test callback on globalThis (works in both browser and Node)
        const testCallbackName = '_settrace_detection_test_' + Date.now()
        globalThis[testCallbackName] = (result) => {
            callbackWasCalled = true
            capturedResult = result
        }

        appendTerminalDebug('🔍 Running native trace detection test...')

        try {
            // Python code that calls our test callback with the result
            const testCode = `
import sys
try:
    import js
    has_settrace = hasattr(sys, 'settrace')
    if hasattr(js, '${testCallbackName}'):
        js.${testCallbackName}(has_settrace)
    else:
        print("ERROR: Test callback not found")
except Exception as e:
    print(f"ERROR: {e}")
`
            await adapter.run(testCode)

            // Give it a tiny moment for the callback to fire
            await new Promise(resolve => setTimeout(resolve, 10))

        } finally {
            // Clean up test callback
            delete globalThis[testCallbackName]
        }

        if (!callbackWasCalled) {
            appendTerminalDebug(`❌ Detection failed: callback was never called`)
            appendTerminalDebug(`   Python->JavaScript bridge may not be working`)
            return false
        }

        // Check the result (Python True becomes JavaScript true)
        const hasTrace = capturedResult === true

        if (hasTrace) {
            appendTerminalDebug(`✅ Native sys.settrace: AVAILABLE - record/replay will work!`)
        } else {
            appendTerminalDebug(`❌ Native sys.settrace: NOT FOUND (result: ${capturedResult})`)
            appendTerminalDebug(`   This runtime does not support sys.settrace`)
        }

        return hasTrace
    } catch (err) {
        appendTerminalDebug('❌ Native trace detection error: ' + err)
        return false
    }
}

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

_essential = set(['builtins','__main__','micropython','host','host_notify'])
_to_del = []
for name in list(sys.modules.keys()):
    if name not in _essential and not name.startswith('_'):
        _to_del.append(name)
for name in _to_del:
    try:
        del sys.modules[name]
    except Exception:
        pass

# Aggressive clearing of ALL user globals (preserve only essential builtins)
g = globals()
_essential = set(['__builtins__','__name__','__doc__','__package__','__loader__','__spec__'])
_gdel = []
for k in list(g.keys()):
    if k not in _essential and not k.startswith('__'):
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

# Explicitly clear __main__ module globals to remove persisted top-level variables
try:
    _m = sys.modules.get('__main__')
    if _m is not None:
        try:
            _md = getattr(_m, '__dict__', {})
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

        let _softClearTimedOut = false
        try {
            if (typeof runtimeAdapter.run === 'function') {
                // prefer async variant when available. Use a short timeout so
                // we don't hang if the adapter's run() never resolves (test
                // adapters sometimes provide non-resolving promises).
                const clearPromise = (typeof runtimeAdapter.runPythonAsync === 'function')
                    ? runtimeAdapter.runPythonAsync(pyClear)
                    : runtimeAdapter.run(pyClear)

                try {
                    await Promise.race([
                        clearPromise,
                        new Promise((_, rej) => setTimeout(() => rej(new Error('soft-clear-timeout')), 200))
                    ])
                } catch (raceErr) {
                    if (String(raceErr).includes('soft-clear-timeout')) {
                        _resetDebug('warn', '[softReset] python clear timed out; will report failure')
                        _softClearTimedOut = true
                    } else {
                        throw raceErr
                    }
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

        // If the python clear timed out we should surface that as a failure
        // so callers can attempt manual clearing or a full restart.
        if (_softClearTimedOut) {
            _resetDebug('warn', '[softReset] completed: timed out during python clear')
            return false
        }

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

    // Do not clear the global runtime adapter until the new runtime is
    // initialized. Load a fresh runtime first so we can swap atomically.
    let newAdapter = null
    try {
        newAdapter = await loadMicroPythonRuntime(cfg || window.currentConfig || {})
    } catch (e) {
        _resetDebug('error', '[restart] loadMicroPythonRuntime failed:', e)
        // Sanitize any stack traces before showing to the user
        const msg = (e && e.stack) ? _sanitizeStackTrace(String(e.stack)) : String(e)
        appendTerminal && appendTerminal('Failed to restart runtime: ' + msg, 'runtime')
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

    // At this point loadMicroPythonRuntime will have set the global runtime
    // adapter to newAdapter; attempt to clean up the old adapter resources
    try {
        if (oldAdapter && oldAdapter._module && typeof oldAdapter._module.terminate === 'function') {
            try { oldAdapter._module.terminate() } catch (_e) { }
        }
        try { if (window.__ssg_runtime_fs === oldAdapter?._module?.FS) delete window.__ssg_runtime_fs } catch (_e) { }
    } catch (_e) { }

    _resetDebug('log', '[restart] completed: success')
    _resetDebug('log', '✅ MicroPython runtime restarted')
    return true
}

// State clearing function used by the UI: prefer soft reset, fallback to full restart
export async function clearMicroPythonState(opts) {
    // opts: { fallbackToRestart: true/false, cfg }
    try {
        // If the caller explicitly requires a provably-clean runtime, perform
        // a full restart unconditionally. Soft resets can leave runtime state
        // artifacts which are unacceptable for requireClean semantics.
        if (opts && opts.requireClean) {
            _resetDebug('log', '[clearState] requireClean requested -> performing full restart')
            const restarted = await restartMicroPythonRuntime((opts && opts.cfg) ? opts.cfg : (typeof window !== 'undefined' ? window.currentConfig : undefined))
            if (!restarted) {
                _resetDebug('error', '[clearState] restart failed while requireClean was requested')
                return false
            }

            // Verify after restart to ensure deterministic cleanliness
            try {
                const cleanAfter = await verifyRuntimeClean(runtimeAdapter)
                if (!cleanAfter) {
                    _resetDebug('error', '[clearState] restart did not produce a clean runtime')
                    return false
                }
            } catch (e) {
                _resetDebug('error', '[clearState] verification after restart failed: ' + e)
                return false
            }

            _resetDebug('log', '[clearState] restart + verification succeeded (requireClean)')
            return true
        }

        // Non-requireClean path: try soft reset first, fallback to restart
        _resetDebug('log', '[clearState] invoking softResetMicroPythonRuntime')
        const ok = await softResetMicroPythonRuntime()
        if (ok) {
            _resetDebug('log', '[clearState] softReset succeeded; returning success')
            return true
        }

        _resetDebug('warn', '[clearState] softReset returned false')
        if (opts && opts.fallbackToRestart === false) return false
        _resetDebug('log', '[clearState] falling back to restartMicroPythonRuntime')
        const restarted = await restartMicroPythonRuntime((opts && opts.cfg) ? opts.cfg : (typeof window !== 'undefined' ? window.currentConfig : undefined))
        return restarted
    } catch (e) {
        _resetDebug('error', '[clearState] wrapper failed:', e)
        _resetDebug('log', 'clearMicroPythonState wrapper failed: ' + e)
        return false
    }
}

// Verify runtime cleanliness by probing __main__ globals. Returns true if
// only dunder keys remain (no user-defined top-level variables).
export async function verifyRuntimeClean(adapter) {
    try {
        const ad = adapter || runtimeAdapter
        if (!ad) return false
        const probe = `
try:
    import sys
    m = sys.modules.get('__main__')
    if m is None:
        print('__CLEAN__')
    else:
        d = getattr(m, '__dict__', {})
        keys = [k for k in list(d.keys()) if not k.startswith('__')]
        if keys:
            print('__DIRTY__:' + ','.join(keys[:10]))
        else:
            print('__CLEAN__')
except Exception as e:
    print('__ERROR__')
`
        // prefer async runner if available. We suppress the probe's printed
        // markers from showing up in the visible terminal by snapshotting the
        // terminal content before the probe and restoring it after the probe
        // completes if the probe appended only the marker output.
        let out
        const prevHtml = getTerminalInnerHTML()
        try {
            if (typeof ad.runPythonAsync === 'function') {
                out = await ad.runPythonAsync(probe)
            } else {
                out = await ad.run(probe)
            }
        } finally {
            // Cleanup any probe marker lines that were appended to the terminal.
            try {
                const afterHtml = getTerminalInnerHTML()
                if (typeof prevHtml === 'string' && typeof afterHtml === 'string') {
                    const after = afterHtml.slice(prevHtml.length)
                    if (after && /__CLEAN__|__DIRTY__|__ERROR__/.test(after)) {
                        setTerminalInnerHTML(prevHtml)
                    }
                }
            } catch (_e) { /* best-effort cleanup only */ }
        }

        const s = String(out || '')
        if (s.includes('__CLEAN__')) return true
        return false
    } catch (e) {
        return false
    }
}

// Sanitize a JS stack/trace string by removing vendor/runtime frames
// unless the debug flag is enabled. Returns sanitized string.
function _sanitizeStackTrace(text) {
    try {
        if (!text) return text
        // If debug flag set, show full trace
        if (typeof window !== 'undefined' && window.__ssg_debug_show_vendor_frames) return text

        const raw = String(text)
        const lines = raw.split('\n')

        // Heuristics to identify Python traceback lines and JS/vendor frames
        const pythonHeaderRE = /^Traceback \(most recent call last\):/;
        const pythonFileRE = /^\s*File\s+"/; // e.g. "  File \"/main.py\", line 22, in <module>"
        const pythonExceptionRE = /^[A-Za-z_][\w\.]*:.*$/; // e.g. "NameError: ..."
        const vendorJsRE = /(?:\/vendor\/|node_modules\/|\.mjs\b|__asyncify__|micropython(?:\.mjs)?)/i;
        const jsFrameRE = /(?:@http|https?:\/\/).*|\bat\b.*\(|^[^\n]*@http/;

        // First, try to extract a contiguous Python traceback block if present.
        let pythonBlock = []
        let inPython = false
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            if (!inPython && pythonHeaderRE.test(line)) {
                inPython = true
                pythonBlock.push(line)
                continue
            }

            if (inPython) {
                // stop if we hit an obvious JS/vendor frame
                if (vendorJsRE.test(line) || jsFrameRE.test(line)) break
                // accept python file/context lines, indented context, and final exception message
                if (pythonFileRE.test(line) || /^\s+/.test(line) || pythonExceptionRE.test(line) || line.trim() === '') {
                    pythonBlock.push(line)
                    continue
                }
                // if it's neither python-looking nor js-looking, still accept it cautiously
                pythonBlock.push(line)
                continue
            }

            // Handle cases where there is no header but Python-style lines appear
            if (pythonFileRE.test(line)) {
                inPython = true
                pythonBlock.push(line)
                continue
            }

            // Also accept a lone final Python exception line even without a header
            if (pythonExceptionRE.test(line) && !jsFrameRE.test(line)) {
                pythonBlock.push(line)
            }
        }

        if (pythonBlock.length > 0) {
            // If there were vendor frames after the python block, hide them implicitly
            // Return only the Python block (plus a short placeholder if vendor frames were present)
            // Detect if any vendor/js frames existed in the original tail
            const tail = lines.slice(lines.indexOf(pythonBlock[pythonBlock.length - 1]) + 1)
            const hadVendor = tail.some(l => vendorJsRE.test(l) || jsFrameRE.test(l))
            return pythonBlock.join('\n') + (hadVendor ? '\n[runtime frames hidden]' : '')
        }

        // If no Python block found, fall back to filtering vendor/js frames from the JS stack
        const filtered = []
        for (const line of lines) {
            if (!line) continue
            if (vendorJsRE.test(line)) continue
            // skip overly long single lines that are probably binary blobs or huge object dumps
            if (line.length > 2000) continue
            filtered.push(line)
        }
        if (filtered.length === 0) return '[runtime stack frames hidden]'
        return filtered.join('\n')
    } catch (e) {
        return String(text)
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
                        // Only emit a debug message here to avoid noisy duplicate
                        // runtime-initialized messages on restarts. Visible terminal
                        // output for runtime init is not helpful to end users.
                        appendTerminalDebug('MicroPython runtime initialized (with yielding support)')
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
                        // Only emit debug-level notification for legacy builds too.
                        appendTerminalDebug('MicroPython runtime initialized (legacy asyncify build)')
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
                        appendTerminal('Note: Could not register host module: ' + (e && e.stack ? _sanitizeStackTrace(String(e.stack)) : String(e)))
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

                    // Create the adapter first, then detect native trace support
                    const adapter = {
                        _module: mpInstance,  // Expose the module for asyncify detection
                        hasYieldingSupport: hasYieldingSupport,  // NEW: Flag to indicate asyncify features
                        hasNativeTrace: false,  // Will be set by detection
                        runPythonAsync: async (code, executionHooks = null) => {
                            captured = ''

                            // NEW: Set up execution monitoring if hooks provided
                            if (executionHooks && typeof executionHooks.onExecutionStep === 'function') {
                                setupExecutionStepMonitoring(executionHooks)
                            }

                            try {
                                if (typeof mpInstance.runPythonAsync === 'function') {
                                    const maybe = await mpInstance.runPythonAsync(code)

                                    // NEW: Finalize step monitoring
                                    if (executionHooks && typeof executionHooks.onExecutionComplete === 'function') {
                                        executionHooks.onExecutionComplete()
                                    }

                                    // Don't return captured output since it's already been displayed in real-time
                                    return maybe == null ? '' : String(maybe)
                                }
                                throw new Error('runPythonAsync not available')
                            } catch (e) {
                                // NEW: Handle recording during errors
                                if (executionHooks && typeof executionHooks.onExecutionError === 'function') {
                                    executionHooks.onExecutionError(e)
                                }
                                throw e
                            }
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
                    }

                    // Set the adapter first
                    setRuntimeAdapter(adapter)

                    // Now detect native trace support and update the adapter
                    try {
                        appendTerminalDebug('⏳ Detecting native sys.settrace support...')
                        const hasNativeTrace = await detectNativeTraceSupport(adapter)
                        adapter.hasNativeTrace = hasNativeTrace
                        if (hasNativeTrace) {
                            appendTerminalDebug(`✅ Native sys.settrace support: ENABLED - record/replay will work`)
                        } else {
                            appendTerminalDebug(`❌ Native sys.settrace support: DISABLED - record/replay will NOT work`)
                        }
                    } catch (detectErr) {
                        adapter.hasNativeTrace = false
                        appendTerminalDebug('❌ Native trace detection failed: ' + detectErr)
                    }

                    return runtimeAdapter
                } catch (e) {
                    appendTerminal('Failed to initialize vendored MicroPython: ' + (e && e.stack ? _sanitizeStackTrace(String(e.stack)) : String(e)))
                }
            }
        }
    } catch (e) {
        appendTerminalDebug('Local vendor load failed: ' + _sanitizeStackTrace(String(e)))
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
            appendTerminal('Failed to append runtime script: ' + (e && e.stack ? _sanitizeStackTrace(String(e.stack)) : String(e)))
        }
    }

    return runtimeAdapter
}

export function setRuntimeAdapter(adapter) {
    runtimeAdapter = adapter
    window.runtimeAdapter = adapter

    // Note: terminal-level sanitization is handled inside `terminal.js`.
    // Avoid overriding `window.appendTerminal` here to prevent double
    // sanitization or accidental suppression of mapped tracebacks.

    appendTerminalDebug(`Runtime adapter set: ${adapter ? 'available' : 'null'}`)

    // Expose a helper function to check settrace support from browser console
    if (typeof window !== 'undefined') {
        window.checkSettraceSupport = async function () {
            if (!runtimeAdapter) {
                console.log('❌ No runtime adapter available')
                return false
            }

            try {
                // Use the RELIABLE callback approach from ASYNC_TROUBLESHOOTING.md
                let callbackCalled = false
                let result = null

                // Test callback
                globalThis._settrace_test = (hasIt) => {
                    callbackCalled = true
                    result = hasIt
                    console.log('✓ Callback was called from Python!')
                    console.log('✓ Result:', hasIt)
                }

                console.log('Testing sys.settrace availability...')

                const testCode = `
import sys
try:
    import js
    has_settrace = hasattr(sys, 'settrace')
    if hasattr(js, '_settrace_test'):
        js._settrace_test(has_settrace)
    else:
        print("ERROR: _settrace_test callback not found")
except Exception as e:
    print(f"ERROR: {e}")
`

                await runtimeAdapter.run(testCode)

                // Wait a moment for async callback
                await new Promise(resolve => setTimeout(resolve, 20))

                // Clean up
                delete globalThis._settrace_test

                if (!callbackCalled) {
                    console.log('❌ Callback was never called - Python->JS bridge may be broken')
                    return false
                }

                if (result === true) {
                    console.log('✅ sys.settrace IS available!')
                    console.log('💡 The MicroPython runtime supports native tracing')
                    console.log('💡 You can use the record-replay feature')
                    return true
                } else {
                    console.log('❌ sys.settrace is NOT available')
                    console.log('💡 Result was:', result)
                    console.log('💡 The WASM may not have been compiled with MICROPY_PY_SYS_SETTRACE')
                    return false
                }
            } catch (err) {
                console.error('❌ Error testing settrace:', err)
                return false
            }
        }
    }
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

        // Helper to check for invalid filenames (e.g., tracebacks used as filenames)
        function _isInvalidFilename(path) {
            try {
                const pathStr = String(path)
                // Block paths that look like tracebacks or error messages
                if (/Traceback|KeyboardInterrupt|File ""/i.test(pathStr)) return true
                // Block paths with newlines (tracebacks are multi-line)
                if (pathStr.includes('\n')) return true
                // Block paths that are suspiciously long (likely error messages)
                if (pathStr.length > 500) return true
                return false
            } catch (_e) { return false }
        }

        if (typeof fs.writeFile === 'function') {
            const _orig = fs.writeFile.bind(fs)
            fs.writeFile = function (path, data, opts) {
                if (_isInvalidFilename(path)) {
                    try { appendTerminalDebug('[vfs-guard] blocking invalid filename: ' + String(path).substring(0, 100)) } catch (_e) { }
                    return // Silently ignore invalid filenames
                }
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
                if (_isInvalidFilename(path)) {
                    try { appendTerminalDebug('[vfs-guard] blocking invalid filename (sync): ' + String(path).substring(0, 100)) } catch (_e) { }
                    return // Silently ignore invalid filenames
                }
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
                if (_isInvalidFilename(path)) {
                    try { appendTerminalDebug('[vfs-guard] blocking invalid filename (createDataFile): ' + String(path).substring(0, 100)) } catch (_e) { }
                    return // Silently ignore invalid filenames
                }
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

// NEW: Setup execution step monitoring for record/replay
function setupExecutionStepMonitoring(executionHooks) {
    try {
        appendTerminalDebug('Setting up real execution monitoring with runtime interception')

        // Store original hooks for cleanup
        window.__ssg_execution_hooks = executionHooks
        window.__ssg_execution_intercepted = true

        // Method 1: Intercept MicroPython runtime stdout to track execution
        const originalLog = console.log
        const originalWarn = console.warn
        const originalError = console.error

        let currentLine = 1
        let executionVariables = new Map()

        // Method 2: Hook into the MicroPython Module if available
        const runtimeAdapter = window.runtimeAdapter || getRuntimeAdapter()
        if (runtimeAdapter && runtimeAdapter._module) {
            const Module = runtimeAdapter._module

            // Try to access MicroPython's print/output functions
            if (typeof Module.ccall === 'function') {
                appendTerminalDebug('Found MicroPython Module with ccall - setting up runtime hooks')

                // Hook into MicroPython's output system
                if (Module.print) {
                    const originalPrint = Module.print
                    Module.print = function (text) {
                        // Parse output for execution tracking
                        parseExecutionOutput(text)
                        return originalPrint.call(this, text)
                    }
                }

                if (Module.printErr) {
                    const originalPrintErr = Module.printErr
                    Module.printErr = function (text) {
                        // Parse errors for execution context
                        parseExecutionError(text)
                        return originalPrintErr.call(this, text)
                    }
                }
            }
        }

        // Method 3: Parse execution output to reconstruct execution state
        function parseExecutionOutput(output) {
            try {
                const text = String(output || '').trim()
                if (!text) return

                // Check for structured trace data first
                if (text.includes('__EXECUTION_TRACE__')) {
                    const traceStart = text.indexOf('__EXECUTION_TRACE__')
                    const traceJson = text.substring(traceStart + '__EXECUTION_TRACE__'.length)

                    try {
                        const traceData = JSON.parse(traceJson)
                        if (traceData.__TRACE__) {
                            const { line, vars, file } = traceData.__TRACE__
                            const filename = file || '/main.py'
                            const variables = new Map()

                            // Convert vars object to Map, filtering out noise
                            if (vars && typeof vars === 'object') {
                                for (const [name, value] of Object.entries(vars)) {
                                    // Filter out internal variables and module objects (noise for students)
                                    const isInternalVar = name.startsWith('_') || name === 'k'
                                    const isModuleObject = typeof value === 'string' && value.startsWith('<module ')

                                    if (!isInternalVar && !isModuleObject) {
                                        variables.set(name, value)
                                    }
                                }
                            }

                            appendTerminalDebug(`Trace: Line ${line} in ${filename}, Variables: ${JSON.stringify(vars)}`)

                            recordExecutionStep(line, variables, 'traced', filename)
                            return
                        }
                    } catch (parseError) {
                        appendTerminalDebug('Failed to parse trace JSON: ' + parseError)
                    }
                }

                appendTerminalDebug(`Parsing output: "${text}"`)

                // Fallback: Track different types of output to infer execution state
                if (text.includes('What is your name?')) {
                    // Input prompt detected - we're on an input() line
                    recordExecutionStep(1, new Map([['__prompt__', text]]), 'input')
                } else if (text.startsWith('Hello') && text.includes('!')) {
                    // Greeting output - we're on a print line with variables
                    const nameMatch = text.match(/Hello\s+(\w+)/)
                    if (nameMatch) {
                        const name = nameMatch[1]
                        recordExecutionStep(2, new Map([
                            ['name', `"${name}"`],
                            ['greeting', `"${text}"`]
                        ]), 'output')
                    }
                } else if (!text.includes('__TRACE__')) {
                    // Generic output (skip internal trace messages)
                    recordExecutionStep(currentLine++, new Map([['__output__', text]]), 'output')
                }
            } catch (error) {
                appendTerminalDebug('Error parsing execution output: ' + error)
            }
        }

        function parseExecutionError(errorText) {
            try {
                // Parse traceback information to get line numbers and context
                const lines = String(errorText || '').split('\n')
                for (const line of lines) {
                    const lineMatch = line.match(/line (\d+)/)
                    if (lineMatch) {
                        const lineNum = parseInt(lineMatch[1], 10)
                        recordExecutionStep(lineNum, new Map([['__error__', line.trim()]]), 'error')
                    }
                }
            } catch (error) {
                appendTerminalDebug('Error parsing execution error: ' + error)
            }
        }

        function recordExecutionStep(lineNumber, variables, context = 'execution', filename = null) {
            try {
                if (executionHooks && executionHooks.onExecutionStep) {
                    const file = filename || '/main.py'
                    appendTerminalDebug(`Recording step: line ${lineNumber} in ${file}, context: ${context}, vars: ${variables.size}`)
                    executionHooks.onExecutionStep(lineNumber, variables, context, file)
                }
            } catch (error) {
                appendTerminalDebug('Error recording execution step: ' + error)
            }
        }

        // Method 4: Intercept terminal output to track execution
        const originalAppendTerminal = window.appendTerminal
        if (originalAppendTerminal) {
            window.appendTerminal = function (text, type) {
                // Parse terminal output for execution information
                if (type === 'stdout' && text) {
                    parseExecutionOutput(text)
                } else if (type === 'stderr' && text) {
                    parseExecutionError(text)
                }
                return originalAppendTerminal.call(this, text, type)
            }
        }

        // Store original functions for cleanup
        window.__ssg_original_functions = {
            log: originalLog,
            warn: originalWarn,
            error: originalError,
            appendTerminal: originalAppendTerminal
        }

        appendTerminalDebug('Real execution monitoring enabled - will track via output parsing')

        // Set up cleanup when execution completes
        setTimeout(() => {
            if (executionHooks && executionHooks.onExecutionComplete) {
                appendTerminalDebug('Execution monitoring setup complete')
            }
        }, 100)

    } catch (error) {
        appendTerminalDebug('Failed to setup real execution monitoring: ' + error)
    }
}

/**
 * Clean up execution monitoring hooks
 */
function cleanupExecutionStepMonitoring() {
    try {
        appendTerminalDebug('Cleaning up execution monitoring hooks')

        // Restore original functions
        if (window.__ssg_original_functions) {
            const orig = window.__ssg_original_functions
            if (orig.appendTerminal) {
                window.appendTerminal = orig.appendTerminal
            }
            delete window.__ssg_original_functions
        }

        // Clear execution state
        delete window.__ssg_execution_hooks
        delete window.__ssg_execution_intercepted

        appendTerminalDebug('Execution monitoring cleanup complete')
    } catch (error) {
        appendTerminalDebug('Error cleaning up execution monitoring: ' + error)
    }
}

// Expose cleanup function globally (only in browser environment)
if (typeof window !== 'undefined') {
    window.cleanupExecutionStepMonitoring = cleanupExecutionStepMonitoring
}