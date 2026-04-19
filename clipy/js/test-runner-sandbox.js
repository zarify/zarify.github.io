// Parent-side helper to create a sandboxed runFn that uses per-test iframes.
export function createSandboxedRunFn({ runtimeUrl = './vendor/micropython.mjs', filesSnapshot = {}, iframeSrc = './tests/runner.html', timeoutMsDefault = 20000 } = {}) {
    return function runFn(test) {
        return new Promise(async (resolve) => {
            // quiet: removed noisy debug log
            // Short-circuit AST-only tests in the parent so they don't need
            // an iframe execution. This mirrors adapter behaviour and keeps
            // AST evaluation fast and deterministic.
            try {
                // Detect AST rule in a few possible shapes authors/configs may use
                let astRuleObj = null
                if (test) {
                    if (test.astRule) astRuleObj = test.astRule
                    else if (test.pattern && test.pattern.astRule) astRuleObj = test.pattern.astRule
                    else if (test.pattern && (test.pattern.expression || test.pattern.matcher)) astRuleObj = test.pattern
                    else if (test.type === 'ast' && test.astRule) astRuleObj = test.astRule
                }

                // Defensive fallback: some configs may place expression/matcher
                // at the test root or under different keys. If test.type === 'ast'
                // but we didn't find a nested rule, try to reconstruct one.
                if (!astRuleObj && test && test.type === 'ast') {
                    const candidateExpression = test.expression || (test.pattern && (test.pattern.expression || test.pattern.expr)) || test.ast_expression || null
                    const candidateMatcher = test.matcher || (test.pattern && test.pattern.matcher) || test.ast_matcher || null
                    if (candidateExpression || candidateMatcher) astRuleObj = { expression: candidateExpression || '', matcher: candidateMatcher || '' }
                }

                // If test.type === 'ast' we should treat this as an AST test
                // even if a nested astRule object is not present in the shape.
                if (test && test.type === 'ast') {
                    if (!astRuleObj) astRuleObj = (test.astRule || test.pattern || {})
                }

                // Use explicit parentheses to avoid JS operator precedence surprises
                if ((test && test.type === 'ast') || astRuleObj) {
                    // parent short-circuit for AST test
                    // proceed using astRuleObj (may be empty object)
                    try {
                        // Determine code to analyze: prefer test.main, then read from FileManager
                        // which now reads directly from IndexedDB (single source of truth, fixes KAN-25).
                        let code = ''
                        if (typeof test.main === 'string' && test.main.trim()) {
                            code = test.main
                        } else {
                            // Read from FileManager - now async and always reads from backend
                            try {
                                const { getFileManager, MAIN_FILE } = await import('./vfs-client.js')
                                const FileManager = (typeof getFileManager === 'function') ? getFileManager() : null
                                if (FileManager && typeof FileManager.read === 'function') {
                                    code = (await FileManager.read(MAIN_FILE || '/main.py')) || ''
                                }
                            } catch (e) {
                                // Import or read failed - code remains empty
                                code = ''
                            }
                        }
                        // Import analyzer and evaluate
                        const { analyzeCode } = await import('./ast-analyzer.js')
                        let result = null
                        try {
                            // using astRuleObj for test
                            const expr = (astRuleObj && astRuleObj.expression) || ''
                            if (expr) result = await analyzeCode(code, expr)
                            else result = null
                            // analysis result computed
                        } catch (err) {
                            // analysis failed
                            if (typeof appendTerminal === 'function') try { appendTerminal('AST analysis failed: ' + String(err).split('\n').filter(l => !/vendor\//.test(l)).slice(0, 5).join('\n'), 'runtime') } catch (_e) { }
                            throw err
                        }
                        let passed = false
                        if (astRuleObj && astRuleObj.matcher && typeof astRuleObj.matcher === 'string' && astRuleObj.matcher.trim()) {
                            try {
                                const evaluateMatch = new Function('result', `try { return ${astRuleObj.matcher.trim()} } catch (e) { console.warn('AST matcher error:', e && e.message); return false }`)
                                passed = !!evaluateMatch(result)
                            } catch (err) { passed = false }
                        } else {
                            // If there's no matcher, consider a truthy result as a pass.
                            passed = !!result
                        }
                        // provide verbose debug info to the host so UI can surface
                        const out = { stdout: JSON.stringify(result || null), stderr: '', durationMs: 0, astPassed: passed, astResult: result }
                        // short-circuit result ready
                        resolve(out)
                        return
                    } catch (e) { resolve({ stdout: '', stderr: String(e || ''), durationMs: 0, astPassed: false }); return }
                }
            } catch (_e) {
                // fall through to iframe execution on unexpected errors
            }
            const iframe = document.createElement('iframe')
            iframe.style.display = 'none'
            // Allow same-origin so the iframe can load module scripts from the same dev server
            // (this avoids CORS issues when serving with a vanilla static server)
            iframe.sandbox = 'allow-scripts allow-same-origin'
            iframe.src = iframeSrc
            document.body.appendChild(iframe)

            // Prepare a per-run stdin queue so multi-line string stdin ("a\nb")
            // is fed one line per prompt instead of re-sending the whole
            // string for each stdinRequest. If the author supplied an array,
            // copy it so we don't mutate their object.
            let stdinQueue = null
            if (Array.isArray(test && test.stdin)) {
                stdinQueue = (test.stdin || []).slice()
            } else if (test && typeof test.stdin === 'string') {
                // split on LF; preserve empty strings for trailing/newline cases
                stdinQueue = String(test.stdin).split('\n')
            } else {
                stdinQueue = []
            }

            const msgListener = (ev) => {
                try { if (ev.source !== iframe.contentWindow) return } catch (e) { return }
                const m = ev.data || {}
                if (m.type === 'loaded') {
                    // Normalize runtimeUrl: authors may supply the raw .wasm URL
                    // in their config. The iframe runner must import a JS module
                    // (e.g. micropython.mjs) so the module can locate/instantiate
                    // the wasm. Convert *.wasm -> *.mjs when present.
                    let runtimeUrlToSend = runtimeUrl
                    try {
                        if (runtimeUrlToSend && typeof runtimeUrlToSend === 'string' && /\.wasm(\?|$)/i.test(runtimeUrlToSend)) {
                            runtimeUrlToSend = runtimeUrlToSend.replace(/\.wasm(\?|$)/i, '.mjs$1')
                        }
                    } catch (_e) { }

                    // send init with normalized runtime url and snapshot files
                    iframe.contentWindow.postMessage({ type: 'init', runtimeUrl: runtimeUrlToSend, files: filesSnapshot }, '*')
                } else if (m.type === 'ready') {
                    // start the test
                    // remember current test id for streaming messages
                    iframe.__ssg_current_test_id = test && test.id ? test.id : null
                    iframe.contentWindow.postMessage({ type: 'runTest', test }, '*')
                } else if (m.type === 'stdout' || m.type === 'stderr' || m.type === 'debug') {
                    // Stream output into Feedback UI if available
                    try {
                        const tid = iframe.__ssg_current_test_id || (test && test.id)
                        if (typeof window.__ssg_append_test_output === 'function') {
                            window.__ssg_append_test_output({ id: tid, type: m.type, text: m.text })
                        }
                    } catch (e) { }
                    // stream output forwarded to host UI (quiet)
                } else if (m.type === 'stdinRequest') {
                    // If the runner provided a prompt string, surface it to the host UI
                    try {
                        const tid = iframe.__ssg_current_test_id || (test && test.id)
                        if (m.prompt) {
                            // Surface prompt to any UI helpers
                            if (typeof window.__ssg_show_stdin_prompt === 'function') {
                                try { window.__ssg_show_stdin_prompt({ id: tid, prompt: m.prompt }) } catch (e) { }
                            }
                            // Also emit the prompt as a stdout stream so host
                            // matchers that expect prompt+input can match against
                            // the combined output (prompt forwarded, input echoed
                            // by the iframe runner).
                            try {
                                if (typeof window.__ssg_append_test_output === 'function') {
                                    window.__ssg_append_test_output({ id: tid, type: 'stdout', text: m.prompt })
                                }
                            } catch (e) { }
                        }
                    } catch (e) { }

                    // reply with the next queued stdin item (if any). This
                    // ensures multi-line string stdin is consumed one line at
                    // a time per prompt. If the queue is empty, reply with
                    // an empty string.
                    let v = ''
                    try {
                        if (stdinQueue && stdinQueue.length) {
                            v = stdinQueue.shift() || ''
                        } else {
                            v = ''
                        }
                    } catch (e) { v = '' }
                    iframe.contentWindow.postMessage({ type: 'stdinResponse', value: String(v) }, '*')
                } else if (m.type === 'testResult') {
                    // child testResult received
                    // Attach expected values from the original `test` object if present
                    try {
                        if (test && typeof test.expected_stdout !== 'undefined' && typeof m.expected_stdout === 'undefined') m.expected_stdout = test.expected_stdout
                        if (test && typeof test.expected_stderr !== 'undefined' && typeof m.expected_stderr === 'undefined') m.expected_stderr = test.expected_stderr
                    } catch (_e) { }
                    cleanup()
                    resolve(m)
                } else if (m.type === 'error') {
                    // child error received
                    cleanup()
                    resolve({ id: test.id, passed: false, stdout: '', stderr: String(m.error), durationMs: 0, reason: m.error })
                }
            }

            const cleanup = () => {
                try { window.removeEventListener('message', msgListener) } catch (e) { }
                try { iframe.remove() } catch (e) { }
            }

            // global timeout guard in parent to ensure recovery
            const watchdog = setTimeout(() => {
                try {
                    iframe.contentWindow.postMessage({ type: 'terminate' }, '*')
                } catch (e) { }
                cleanup()
                resolve({ id: test.id, passed: false, stdout: '', stderr: 'timeout (parent)', durationMs: timeoutMsDefault, reason: 'timeout' })
            }, (test.timeoutMs || timeoutMsDefault) + 500)

            window.addEventListener('message', msgListener)

            // ensure we clean on resolve
            const origResolve = resolve
            resolve = (res) => {
                clearTimeout(watchdog)
                origResolve(res)
            }
        })
    }
}
