/*
 * Factory to create a runFn used by the Run-tests UI.
 * This module isolates the logic so it can be unit-tested.
 */
import { debug as logDebug, info as logInfo, warn as logWarn, error as logError } from './logger.js'
import { setSystemWriteMode } from './vfs-client.js'
import { appendTerminal } from './terminal.js'

export function createRunFn({ getFileManager, MAIN_FILE, runPythonCode, getConfig }) {
    if (!getFileManager) throw new Error('getFileManager required')

    return async function runFn(t) {
        try {
            // Short-circuit AST tests: if the test has an `astRule` object,
            // evaluate it against the MAIN_FILE (or test.main if provided)
            if (t && t.astRule) {
                try {
                    const FileManager = getFileManager()
                    let code = ''
                    if (typeof t.main === 'string' && t.main.trim()) {
                        code = t.main
                    } else {
                        try { code = FileManager.read(MAIN_FILE) || '' } catch (_e) { code = '' }
                    }
                    const { analyzeCode } = await import('./ast-analyzer.js')
                    const result = await analyzeCode(code, (t.astRule && t.astRule.expression) || '')
                    let passed = false
                    if (t.astRule && t.astRule.matcher && typeof t.astRule.matcher === 'string' && t.astRule.matcher.trim()) {
                        try {
                            const evaluateMatch = new Function('result', `try { return ${t.astRule.matcher.trim()} } catch (e) { console.warn('AST matcher error:', e && e.message); return false }`)
                            passed = !!evaluateMatch(result)
                        } catch (_e) { passed = false }
                    } else {
                        // If no matcher provided, treat presence of result as pass
                        passed = !!result
                    }
                    return { stdout: JSON.stringify(result || null), stderr: '', durationMs: 0, astPassed: passed, astResult: result }
                } catch (e) {
                    return { stdout: '', stderr: String(e || ''), durationMs: 0, astPassed: false }
                }
            }
            const FileManager = getFileManager()

            // Snapshot current files
            const origFiles = {}
            try {
                const names = FileManager.list() || []
                for (const n of names) {
                    try { origFiles[n] = await Promise.resolve(FileManager.read(n)) } catch (_e) { origFiles[n] = null }
                }
                try { logDebug('DEBUG origFiles snapshot keys:', Object.keys(origFiles)) } catch (_e) { }
            } catch (_e) { }

            // Suppress notifier while mutating FS for the test
            try { window.__ssg_suppress_notifier = true } catch (_e) { }

            // Write setup and main (system operation - bypass read-only protection)
            try {
                setSystemWriteMode(true)
                if (t.setup && typeof t.setup === 'object') {
                    for (const [p, content] of Object.entries(t.setup)) {
                        try { await FileManager.write(p, content) } catch (_e) { }
                    }
                }
                if (t.main !== undefined) {
                    try { await FileManager.write(MAIN_FILE, t.main) } catch (_e) { }
                }
            } catch (_e) { }
            finally {
                setSystemWriteMode(false)
            }

            // Read code and clear runtime globals
            let code = ''
            try { code = FileManager.read(MAIN_FILE) || '' } catch (_e) { code = '' }
            try { if (typeof window.clearMicroPythonState === 'function') window.clearMicroPythonState() } catch (_e) { }

            // Setup stdin queue
            const stdinQueue = []
            if (typeof t.stdin === 'string') {
                const parts = t.stdin.split(/\r?\n/)
                for (const p of parts) stdinQueue.push(p)
            } else if (Array.isArray(t.stdin)) {
                for (const p of t.stdin) stdinQueue.push(String(p))
            }

            // Run program and concurrently feed stdin if runtime requests it.
            let runError = null
            const cfgLocal = (getConfig && typeof getConfig === 'function') ? getConfig() : {}
            const runPromise = (async () => {
                try {
                    await runPythonCode(code, cfgLocal)
                } catch (err) {
                    runError = err
                }
            })()

            // feeder
            let feederStopped = false
            const feeder = (async () => {
                try {
                    const start = Date.now()
                    const timeout = typeof t.timeoutMs === 'number' ? t.timeoutMs + 2000 : (cfgLocal?.execution?.timeoutSeconds ? (cfgLocal.execution.timeoutSeconds * 1000 + 2000) : 32000)
                    while (!feederStopped) {
                        try {
                            if (window.__ssg_pending_input && typeof window.__ssg_pending_input.resolve === 'function') {
                                const next = stdinQueue.length ? stdinQueue.shift() : ''
                                try {
                                    window.__ssg_pending_input.resolve(next)
                                } catch (_e) { }
                                // Echo the supplied input into the terminal output so
                                // expectations that include the user's typed response
                                // (e.g. prompt + input) can be asserted against stdout.
                                try {
                                    if (next && typeof next === 'string') {
                                        try {
                                            // Use canonical terminal append so output is sanitized
                                            appendTerminal(next + '\n', 'stdout')
                                        } catch (_err) {
                                            // Fallback to legacy direct DOM write if appendTerminal not available
                                            const outEl = document.getElementById('terminal-output')
                                            if (outEl) {
                                                outEl.textContent = (outEl.textContent || '') + next + '\n'
                                            }
                                        }
                                    }
                                } catch (_e) { }
                            }
                        } catch (_e) { }
                        if (Date.now() - start > timeout) break
                        await new Promise(r => setTimeout(r, 40))
                    }
                } catch (_e) { }
            })()

            try { await runPromise } catch (_e) { }
            feederStopped = true
            try { await Promise.race([feeder, new Promise(r => setTimeout(r, 60))]) } catch (_e) { }

            // Collect outputs
            const outEl = document.getElementById('terminal-output')
            const stdoutFull = outEl ? (outEl.textContent || '') : ''
            const stderrFull = (typeof window.__ssg_last_mapped === 'string' && window.__ssg_last_mapped) ? window.__ssg_last_mapped : ''

            // Restore files
            try {
                const postList = FileManager.list() || []
                try { logDebug('DEBUG postList before restore:', postList) } catch (_e) { }
                for (const p of postList) {
                    if (!Object.prototype.hasOwnProperty.call(origFiles, p)) {
                        try { await FileManager.delete(p) } catch (_e) { }
                    }
                }
                try {
                    setSystemWriteMode(true)
                    for (const p of Object.keys(origFiles)) {
                        try {
                            const desired = origFiles[p]
                            if (desired == null) {
                                try { if (p !== MAIN_FILE) await FileManager.delete(p) } catch (_e) { }
                            } else {
                                try { await FileManager.write(p, desired) } catch (_e) { }
                            }
                        } catch (_e) { }
                    }
                } finally {
                    setSystemWriteMode(false)
                }
                try { logDebug('DEBUG after restore main:', await FileManager.read(MAIN_FILE)) } catch (_e) { }
            } catch (_e) { }

            try { window.__ssg_suppress_notifier = false } catch (_e) { }
            try { if (typeof window.clearMicroPythonState === 'function') window.clearMicroPythonState() } catch (_e) { }

            if (runError) return { stdout: stdoutFull, stderr: String(runError || stderrFull), durationMs: 0, filename: (FileManager && typeof FileManager.list === 'function') ? (FileManager.list() || []) : [] }
            return { stdout: stdoutFull, stderr: stderrFull, durationMs: 0, filename: (FileManager && typeof FileManager.list === 'function') ? (FileManager.list() || []) : [] }
        } catch (e) {
            try { window.__ssg_suppress_notifier = false } catch (_e) { }
            return { stdout: '', stderr: String(e || ''), durationMs: 0 }
        }
    }
}

export default { createRunFn }
