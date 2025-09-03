// MicroPython runtime management and interrupt system
import { appendTerminal, appendTerminalDebug, setTerminalInputEnabled } from './terminal.js'
import { $ } from './utils.js'
import { createInputHandler, createHostModule } from './input-handling.js'

// Global state
let runtimeAdapter = null
let executionState = {
    isRunning: false,
    currentAbortController: null,
    timeoutId: null,
    safetyTimeoutId: null
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
                console.log('No Python execution is currently running')
                return false
            }

            console.log('Interrupting Python execution...')
            const success = interruptMicroPythonVM()

            if (success) {
                console.log('KeyboardInterrupt sent to MicroPython VM')
                setExecutionRunning(false)
            } else {
                console.log('VM interrupt failed, falling back to AbortController')
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
                console.log('No runtime adapter available')
                return false
            }

            if (!runtimeAdapter.setYielding) {
                console.log('Yielding control not available (requires asyncify build)')
                return false
            }

            try {
                runtimeAdapter.setYielding(enabled)
                console.log(`✅ MicroPython yielding ${enabled ? 'enabled' : 'disabled'}`)

                if (enabled) {
                    console.log('💡 Yielding enabled - loops with time.sleep() should be interruptible')
                    console.log('💡 Browser should remain responsive during Python execution')
                } else {
                    console.log('⚠️ Yielding disabled - maximum speed but may not be interruptible')
                    console.log('⚠️ Browser may become unresponsive during long operations')
                }

                return true
            } catch (err) {
                console.log('❌ Failed to set yielding:', err)
                return false
            }
        }

        window.clearMicroPythonInterrupt = function () {
            if (!runtimeAdapter) {
                console.log('No runtime adapter available')
                return false
            }

            let success = false

            // Try asyncify clear interrupt method
            if (runtimeAdapter.clearInterrupt) {
                try {
                    runtimeAdapter.clearInterrupt()
                    console.log('✅ Interrupt state cleared with asyncify API')
                    success = true
                } catch (err) {
                    console.log('Asyncify clear interrupt failed:', err)
                }
            }

            // Try aggressive asyncify state reset
            if (runtimeAdapter._module) {
                const Module = runtimeAdapter._module

                // Reset asyncify internals if accessible
                if (Module.Asyncify) {
                    try {
                        console.log('Attempting to reset Asyncify state...')
                        if (Module.Asyncify.currData !== undefined) {
                            Module.Asyncify.currData = 0
                            console.log('✅ Asyncify.currData reset')
                        }
                        if (Module.Asyncify.state !== undefined) {
                            Module.Asyncify.state = 0  // Normal state
                            console.log('✅ Asyncify.state reset')
                        }
                        success = true
                    } catch (err) {
                        console.log('Asyncify state reset failed:', err)
                    }
                }

                // REPL reset
                if (typeof Module.ccall === 'function') {
                    try {
                        Module.ccall('mp_js_repl_init', 'null', [], [])
                        console.log('✅ REPL state reset')
                        success = true
                    } catch (err) {
                        console.log('REPL reset failed:', err)
                    }
                }
            }

            // Also try to clean up any pending input state
            try {
                if (window.__ssg_pending_input) {
                    console.log('Cleaning up pending input state...')
                    delete window.__ssg_pending_input
                }
                setExecutionRunning(false)
                success = true
            } catch (err) {
                console.log('Failed to clean up input state:', err)
            }

            if (!success) {
                console.log('❌ Could not clear interrupt state - may need page refresh')
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

            console.log('MicroPython Interrupt Status:', status)
            return status
        }

        // State clearing function to reset Python globals between runs
        window.clearMicroPythonState = function () {
            if (!runtimeAdapter || !runtimeAdapter._module) {
                console.log('❌ No runtime adapter or module available for state clearing')
                return false
            }

            try {
                // Access MicroPython instance globals
                const mpInstance = runtimeAdapter._module
                if (!mpInstance.globals || !mpInstance.globals.__dict__) {
                    console.log('❌ Unable to access MicroPython globals.__dict__')
                    return false
                }

                const globalsDict = mpInstance.globals.__dict__
                const builtins = ['__builtins__', '__name__', '__doc__', '__package__', '__loader__', '__spec__']

                // Get all keys and filter out built-ins
                const userKeys = Object.keys(globalsDict).filter(key =>
                    !builtins.includes(key) && !key.startsWith('_')
                )

                // Delete user-defined variables
                let cleared = 0
                for (const key of userKeys) {
                    try {
                        delete globalsDict[key]
                        cleared++
                    } catch (err) {
                        console.log(`❌ Failed to clear variable '${key}':`, err)
                    }
                }

                console.log(`✅ Cleared ${cleared} user variables from Python globals`)
                return true
            } catch (err) {
                console.log('❌ Failed to clear MicroPython state:', err)
                return false
            }
        }
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
                    const td = new TextDecoder()
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

                    const mpInstance = await localMod.loadMicroPython({
                        url: (cfg?.runtime?.wasm) || './vendor/micropython.wasm',
                        stdout, stderr, stdin, linebuffer: true,
                        inputHandler: inputHandler
                    })

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
                    try { window.__ssg_runtime_fs = mpInstance.FS } catch (e) { }

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
