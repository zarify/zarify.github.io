// Copied runner for src/ path so dev server can serve it at /tests/runner.js

try {

    const log = (...args) => { try { if (typeof window !== 'undefined' && window.__SSG_DEBUG) console.debug('[runner]', ...args) } catch (e) { } }

    let mpInstance = null
    let runtimeAdapter = null
    let stdoutBuf = []
    let stderrBuf = []
    // Snapshot of files provided by the parent during init (used for AST analysis fallback)
    let initialFilesSnapshot = null
    // Support multiple pending stdin waiters while ensuring only a single
    // stdinRequest is posted to the parent. pendingStdinResolves holds all
    // resolver callbacks; stdinRequested prevents duplicate requests.
    let pendingStdinResolves = []
    let stdinRequested = false

    function post(o) {
        try { window.parent.postMessage(o, location.origin) } catch (e) { try { window.parent.postMessage(o, '*') } catch (_) { } }
    }

    async function initRuntime(runtimeUrl) {
        log('initRuntime', runtimeUrl)
        try {
            // Try to import the runtime module and prefer its exported loader function.
            let loaderFn = null
            try {
                const mod = await import(runtimeUrl)
                if (mod && typeof mod.loadMicroPython === 'function') loaderFn = mod.loadMicroPython
            } catch (e) { log('import failed', e) }

            // Fallback to globalThis if the module sets loadMicroPython globally
            if (!loaderFn && typeof globalThis.loadMicroPython === 'function') loaderFn = globalThis.loadMicroPython

            if (loaderFn) {
                // (module inputHandler will be set after we declare it) - don't set it here
                const stdout = (chunk) => {
                    const text = (typeof chunk === 'string') ? chunk : (new TextDecoder().decode(chunk || new Uint8Array()))
                    stdoutBuf.push(text)
                    post({ type: 'stdout', text })
                }
                const stderr = (chunk) => {
                    const text = (typeof chunk === 'string') ? chunk : (new TextDecoder().decode(chunk || new Uint8Array()))
                    stderrBuf.push(text)
                    post({ type: 'stderr', text })
                }
                // Define inputHandler first so stdin can delegate to it when available.
                const inputHandler = async function (promptText = '') {
                    return new Promise((resolve) => {
                        // Queue this resolver so multiple callers (some runtimes
                        // call both stdin() and inputHandler) all receive the
                        // same stdin response without causing duplicate requests.
                        pendingStdinResolves.push(resolve)
                        try {
                            const ptxt = promptText == null ? '' : String(promptText)
                            if (ptxt !== '') {
                                stdoutBuf.push(ptxt)
                                post({ type: 'stdout', text: ptxt })
                            }
                        } catch (_e) { }
                        // Only post a single stdinRequest for this round.
                        if (!stdinRequested) {
                            stdinRequested = true
                            post({ type: 'stdinRequest', prompt: promptText || '' })
                        }

                        // safety timeout: resolve all queued resolvers empty after 20s
                        setTimeout(() => {
                            if (pendingStdinResolves && pendingStdinResolves.length) {
                                try { pendingStdinResolves.forEach(r => { try { r('') } catch (_) { } }) } catch (_) { }
                                pendingStdinResolves = []
                                stdinRequested = false
                            }
                        }, 20000)
                    })
                }

                // Custom stdin: delegate to inputHandler when present to avoid dual-calls
                const stdin = () => {
                    // Use the shared inputHandler mechanism so callers benefit
                    // from the single-request semantics.
                    if (typeof inputHandler === 'function') {
                        try {
                            return Promise.resolve(inputHandler('')).then(v => (v == null ? '' : String(v)))
                        } catch (e) {
                            post({ type: 'debug', text: 'stdin delegation failed: ' + String(e) })
                        }
                    }

                    return new Promise((resolve) => {
                        // Legacy fallback: queue resolver and post a request if
                        // none is outstanding.
                        pendingStdinResolves.push(resolve)
                        if (!stdinRequested) {
                            stdinRequested = true
                            post({ type: 'stdinRequest', prompt: '' })
                        }
                        setTimeout(() => {
                            if (pendingStdinResolves && pendingStdinResolves.length) {
                                try { pendingStdinResolves.forEach(r => { try { r('') } catch (_) { } }) } catch (_) { }
                                pendingStdinResolves = []
                                stdinRequested = false
                            }
                        }, 20000)
                    })
                }

                // Initialize the runtime and capture the mpInstance
                try {
                    // Ensure Module.inputHandler is populated for runtimes that probe Module
                    try { globalThis.Module = globalThis.Module || {}; globalThis.Module.inputHandler = inputHandler } catch (e) { }
                    mpInstance = await loaderFn({ url: '../vendor/micropython.wasm', stdout, stderr, stdin, linebuffer: true, inputHandler })
                } catch (e) {
                    post({ type: 'error', error: String(e) })
                    return false
                }

                runtimeAdapter = {
                    _module: mpInstance,
                    run: async (code) => {
                        if (!mpInstance) throw new Error('mpInstance not initialized')
                        if (typeof mpInstance.runPythonAsync === 'function') return await mpInstance.runPythonAsync(code)
                        if (typeof mpInstance.runPython === 'function') return mpInstance.runPython(code)
                        return ''
                    },
                    runPythonAsync: async (code) => {
                        if (!mpInstance) throw new Error('mpInstance not initialized')
                        if (typeof mpInstance.runPythonAsync === 'function') return await mpInstance.runPythonAsync(code)
                        throw new Error('runPythonAsync not available')
                    },
                    interruptExecution: (mpInstance && mpInstance.interruptExecution) ? mpInstance.interruptExecution.bind(mpInstance) : null
                }

                return true
            }

            post({ type: 'error', error: 'No loadMicroPython available after import' })
            return false
        } catch (err) {
            post({ type: 'error', error: String(err) })
            return false
        }
    }

    function writeFilesToFS(files) {
        try {
            if (!mpInstance || !mpInstance.FS) return
            for (const p of Object.keys(files || {})) {
                try {
                    try {
                        const preview = (typeof files[p] === 'string') ? String(files[p]).slice(0, 200) : (files[p] && files[p].length ? ('<binary:' + files[p].length + '>') : '<empty>')
                        post({ type: 'debug', text: 'writeFilesToFS: ' + String(p) + ' len=' + (typeof files[p] === 'string' ? String(files[p]).length : (files[p] && files[p].length ? files[p].length : 0)) + ' preview=' + preview })
                    } catch (e) { post({ type: 'debug', text: 'writeFilesToFS: ' + String(p) }) }
                    const dir = p.split('/').slice(0, -1).join('/') || '/'
                    try { mpInstance.FS.mkdirTree(dir) } catch (e) { }
                    const data = files[p]
                    if (typeof data === 'string') {
                        mpInstance.FS.writeFile(p, data)
                    } else if (data instanceof Uint8Array) {
                        mpInstance.FS.writeFile(p, data)
                    }
                } catch (e) {
                    log('writeFilesToFS error', p, e)
                }
            }
        } catch (e) { log('writeFilesToFS outer error', e) }
    }

    // Helper to detect if we're in author/test-authoring mode vs user/student mode.
    // Author mode shows detailed error messages for __pre.py and __post.py failures.
    // User mode shows generic "contact instructor" messages to protect test integrity.
    // NOTE: This runs in an iframe, so we check the PARENT window's location.
    function isAuthorMode() {
        try {
            // Check parent window's URL path for '/author/'
            if (typeof window !== 'undefined' && window.parent && window.parent.location && window.parent.location.pathname) {
                const parentPath = String(window.parent.location.pathname)
                post({ type: 'debug', text: 'isAuthorMode: checking parent pathname: ' + parentPath })
                if (parentPath.includes('/author/')) {
                    post({ type: 'debug', text: 'isAuthorMode: AUTHOR MODE detected (path includes /author/)' })
                    return true
                }
            }
            // Check parent window's URL query params for 'author'
            if (typeof window !== 'undefined' && window.parent && window.parent.location && window.parent.location.search) {
                const parentSearch = String(window.parent.location.search)
                post({ type: 'debug', text: 'isAuthorMode: checking parent search params: ' + parentSearch })
                const params = new URLSearchParams(parentSearch)
                if (params.has('author')) {
                    post({ type: 'debug', text: 'isAuthorMode: AUTHOR MODE detected (query param)' })
                    return true
                }
            }
            post({ type: 'debug', text: 'isAuthorMode: USER MODE (default)' })
        } catch (e) {
            // If detection fails (e.g., cross-origin restrictions), default to user mode (safer)
            post({ type: 'debug', text: 'isAuthorMode: Error during detection (defaulting to USER MODE): ' + String(e) })
            return false
        }
        return false
    }

    async function handleRunTest(test) {
        stdoutBuf = []
        stderrBuf = []
        pendingStdinResolves = []
        stdinRequested = false
        const start = Date.now()
        const authorMode = isAuthorMode()
        post({ type: 'debug', text: 'handleRunTest: authorMode = ' + authorMode })

        try {
            if (test.setup && typeof test.setup === 'object') {
                writeFilesToFS(test.setup)
            }
            if (test.files && typeof test.files === 'object') {
                writeFilesToFS(test.files)
            }
            const mainToRun = (test.main && typeof test.main === 'string') ? test.main : null

            // Helper to run an import expression directly. Previously we executed
            // a Python wrapper string which caused the runtime to report the
            // wrapper as the traceback source (e.g. "<stdin>"). Running the
            // import expression directly ensures tracebacks refer to the actual
            // module files (for example "/main.py"). We rely on the host-side
            // heuristic that moves tracebacks from stdout->stderr when needed.
            // Returns { error: null } on success or { error: errorObject } on failure.
            const runImport = async (importExpr) => {
                try {
                    await runtimeAdapter.run(importExpr)
                    return { error: null }
                } catch (e) {
                    // Some runtimes surface Python tracebacks by rejecting the
                    // promise with an error whose message contains the traceback.
                    // Capture that text, filter out wrapper-inserted lines like
                    // `File "<stdin>"`, and treat the result as stderr so the
                    // host can display it without the import wrapper noise.
                    try {
                        const raw = String(e || '')
                        const filtered = raw.split('\n').filter(l => !l.includes('File "<stdin>"')).join('\n')
                        if (filtered) {
                            stderrBuf.push(filtered)
                            post({ type: 'stderr', text: filtered })
                        }
                    } catch (_err) { }
                    // Return the error object for caller to decide how to handle
                    return { error: e }
                }
            }

            // Check if __pre.py and __post.py exist in test.setup or test.files
            let hasPrePy = false
            let hasPostPy = false
            try {
                if (test.setup && typeof test.setup === 'object') {
                    if (test.setup['/__pre.py'] || test.setup['__pre.py']) hasPrePy = true
                    if (test.setup['/__post.py'] || test.setup['__post.py']) hasPostPy = true
                }
                if (test.files && typeof test.files === 'object') {
                    if (test.files['/__pre.py'] || test.files['__pre.py']) hasPrePy = true
                    if (test.files['/__post.py'] || test.files['__post.py']) hasPostPy = true
                }
            } catch (e) {
                log('Error detecting pre/post files', e)
            }

            // Track errors from each execution step
            let preError = null
            let mainError = null
            let postError = null

            // STEP 1: Execute __pre.py if present
            if (hasPrePy) {
                post({ type: 'debug', text: '__pre.py detected, executing pre-setup' })
                const result = await runImport('import __pre')
                if (result.error) {
                    preError = result.error
                    post({ type: 'debug', text: '__pre.py execution failed' })
                    // Early termination: if pre fails, don't run main or post
                    const duration = Date.now() - start
                    const assemble = (buf) => {
                        if (!buf || !buf.length) return ''
                        let out = ''
                        for (let i = 0; i < buf.length; i++) {
                            const cur = String(buf[i] || '')
                            if (i === 0) { out += cur; continue }
                            const prev = out.length ? out[out.length - 1] : ''
                            const nextFirst = cur.length ? cur[0] : ''
                            const prevEndsWhitespace = prev && (/\s/.test(prev))
                            const nextStartsWhitespace = nextFirst && (/\s/.test(nextFirst))
                            if (!prevEndsWhitespace && !nextStartsWhitespace) out += '\n'
                            out += cur
                        }
                        return out
                    }
                    const stderrJoined = assemble(stderrBuf)
                    const errorMsg = authorMode
                        ? '❌ Test setup failed (__pre.py)\n\n' + stderrJoined
                        : 'Test configuration error. Please contact your instructor.'
                    return {
                        id: test.id,
                        passed: false,
                        stdout: assemble(stdoutBuf),
                        stderr: errorMsg,
                        durationMs: duration,
                        reason: 'preConfigError',
                        preConfigError: true
                    }
                } else {
                    post({ type: 'debug', text: '__pre.py execution completed successfully' })
                }
            }

            // STEP 2: Execute main.py
            if (mainToRun) {
                // Write the inline main to /main.py inside the runtime FS so the
                // traceback filename will point to /main.py when printed.
                try { writeFilesToFS({ '/main.py': mainToRun }) } catch (e) { }
                post({ type: 'debug', text: 'executing main.py' })
                const result = await runImport('import main')
                if (result.error) {
                    mainError = result.error
                    post({ type: 'debug', text: 'main.py execution failed, will still attempt __post.py if present' })
                } else {
                    post({ type: 'debug', text: 'main.py execution completed' })
                }
            } else if (test.entry && typeof test.entry === 'string') {
                const mod = test.entry.replace(/\.[^/.]+$/, '')
                post({ type: 'debug', text: 'executing entry module: ' + mod })
                const result = await runImport(`import ${mod}`)
                if (result.error) {
                    mainError = result.error
                    post({ type: 'debug', text: 'entry module execution failed' })
                } else {
                    post({ type: 'debug', text: 'entry module execution completed' })
                }
            } else {
                // If no main/entry provided, attempt to import /main.py directly.
                // Some runtime FS implementations may not expose lookupPath or
                // behave inconsistently, so attempt the import and let it fail
                // gracefully if the file doesn't exist.
                try {
                    post({ type: 'debug', text: 'attempting import main' })
                    const result = await runImport('import main')
                    if (result.error) {
                        mainError = result.error
                    }
                    post({ type: 'debug', text: 'import main completed' })
                } catch (e) {
                    post({ type: 'debug', text: 'import main failed: ' + String(e) })
                    // ignore -- handled below via buffers/heuristic
                }
            }

            // STEP 3: Execute __post.py if present (even if main failed)
            if (hasPostPy) {
                post({ type: 'debug', text: '__post.py detected, executing post-verification' })
                const result = await runImport('import __post')
                if (result.error) {
                    postError = result.error
                    post({ type: 'debug', text: '__post.py execution failed' })
                } else {
                    post({ type: 'debug', text: '__post.py execution completed successfully' })
                }
            }

            // Diagnostic debug: report buffer sizes and small previews so the
            // host can see whether the runtime emitted any output.
            // removed verbose afterRun debug posts

            const duration = Date.now() - start

            // Heuristic: some MicroPython runtimes emit exception tracebacks
            // through the stdout callback. If stderr is empty but stdout
            // contains a traceback, move the traceback suffix into stderr so
            // the host can treat it as stderr.
            try {
                if ((!stderrBuf || stderrBuf.length === 0) && stdoutBuf && stdoutBuf.length) {
                    const joined = stdoutBuf.join('')
                    const tbIdx = joined.indexOf('Traceback (most recent call last):')
                    const tbIdxAlt = tbIdx === -1 ? joined.indexOf('Traceback') : tbIdx
                    if (tbIdxAlt !== -1) {
                        const before = joined.slice(0, tbIdxAlt)
                        const after = joined.slice(tbIdxAlt)
                        // replace buffers
                        stdoutBuf = before ? [before] : []
                        stderrBuf = after ? [after] : []
                    }
                }
            } catch (e) { /* best-effort, don't fail the test harness */ }

            // Assemble streamed chunks robustly: insert a single '\n' between
            // adjacent chunks when neither side already contains a newline at
            // the boundary. This preserves runtime-provided newlines while
            // avoiding accidental concatenation like 'Hello Rob' + '42!'.
            const assemble = (buf) => {
                if (!buf || !buf.length) return ''
                let out = ''
                for (let i = 0; i < buf.length; i++) {
                    const cur = String(buf[i] || '')
                    if (i === 0) {
                        out += cur
                        continue
                    }
                    const prev = out.length ? out[out.length - 1] : ''
                    const nextFirst = cur.length ? cur[0] : ''
                    // If previous ends with any whitespace (space/newline/tab)
                    // or next starts with whitespace, don't insert an extra
                    // newline. This keeps prompts that end with a space
                    // directly adjacent to the user's echoed input.
                    const prevEndsWhitespace = prev && (/\s/.test(prev))
                    const nextStartsWhitespace = nextFirst && (/\s/.test(nextFirst))
                    if (!prevEndsWhitespace && !nextStartsWhitespace) out += '\n'
                    out += cur
                }
                return out
            }

            // Determine test result based on execution errors
            // Priority: postError > mainError (if no post) > success
            if (postError) {
                // __post.py failed - this always fails the test
                const stderrJoined = assemble(stderrBuf)
                let errorMsg

                if (authorMode) {
                    // Enhanced error reporting for authors
                    let contextInfo = '❌ Test verification failed (__post.py)'
                    contextInfo += '\n\n📋 Execution context: '
                    if (hasPrePy) {
                        contextInfo += '__pre.py → main.py → __post.py'
                    } else {
                        contextInfo += 'main.py → __post.py'
                    }

                    if (mainError) {
                        contextInfo += '\n   ⚠️  Warning: main.py also failed during execution'
                        contextInfo += '\n   This may have caused __post.py verification to fail.'
                        contextInfo += '\n   Consider fixing main.py errors first.'
                    } else {
                        if (hasPrePy) {
                            contextInfo += '\n   ✓ __pre.py executed successfully'
                        }
                        contextInfo += '\n   ✓ main.py executed successfully'
                        contextInfo += '\n   ✗ __post.py failed during verification'
                    }

                    contextInfo += '\n\n' + '─'.repeat(50) + '\n'
                    errorMsg = contextInfo + '\n' + stderrJoined
                } else {
                    errorMsg = 'Test configuration error. Please contact your instructor.'
                }

                return {
                    id: test.id,
                    passed: false,
                    stdout: assemble(stdoutBuf),
                    stderr: errorMsg,
                    durationMs: duration,
                    reason: 'postConfigError',
                    postConfigError: true,
                    mainAlsoFailed: !!mainError
                }
            } else if (mainError) {
                // main.py failed but __post.py succeeded (or wasn't present)
                // In author mode with pre/post files, provide enhanced debugging context
                const stderrJoined = assemble(stderrBuf)
                let errorMsg = stderrJoined

                if (authorMode && (hasPrePy || hasPostPy)) {
                    // Enhanced error reporting for authors when using pre/post execution
                    let contextInfo = '⚠️  Test execution failed in main.py'
                    if (hasPrePy && hasPostPy) {
                        contextInfo += '\n\n📋 Execution context: __pre.py → main.py → __post.py'
                        contextInfo += '\n   ✓ __pre.py executed successfully'
                        contextInfo += '\n   ✗ main.py failed (see error below)'
                        contextInfo += '\n   ℹ️  __post.py was still executed but may have encountered issues due to main.py failure'
                    } else if (hasPrePy) {
                        contextInfo += '\n\n📋 Execution context: __pre.py → main.py'
                        contextInfo += '\n   ✓ __pre.py executed successfully'
                        contextInfo += '\n   ✗ main.py failed (see error below)'
                    } else if (hasPostPy) {
                        contextInfo += '\n\n📋 Execution context: main.py → __post.py'
                        contextInfo += '\n   ✗ main.py failed (see error below)'
                        contextInfo += '\n   ℹ️  __post.py was still executed'
                    }

                    contextInfo += '\n\n' + '─'.repeat(50) + '\n'
                    errorMsg = contextInfo + '\n' + stderrJoined
                }

                return {
                    id: test.id,
                    passed: false,
                    stdout: assemble(stdoutBuf),
                    stderr: errorMsg,
                    durationMs: duration,
                    reason: String(mainError)
                }
            }

            // All steps succeeded (or no errors encountered)
            return { id: test.id, passed: true, stdout: assemble(stdoutBuf), stderr: assemble(stderrBuf), durationMs: duration }
        } catch (err) {
            const duration = Date.now() - start
            const assemble = (buf) => {
                if (!buf || !buf.length) return ''
                let out = ''
                for (let i = 0; i < buf.length; i++) {
                    const cur = String(buf[i] || '')
                    if (i === 0) { out += cur; continue }
                    const prev = out.length ? out[out.length - 1] : ''
                    const nextFirst = cur.length ? cur[0] : ''
                    const prevEndsWhitespace = prev && (/\s/.test(prev))
                    const nextStartsWhitespace = nextFirst && (/\s/.test(nextFirst))
                    if (!prevEndsWhitespace && !nextStartsWhitespace) out += '\n'
                    out += cur
                }
                return out
            }
            const stderrJoined = assemble(stderrBuf)
            return { id: test.id, passed: false, stdout: assemble(stdoutBuf), stderr: (stderrJoined ? (stderrJoined + '\n' + String(err)) : String(err)), durationMs: duration, reason: String(err) }
        }
    }

    window.addEventListener('message', async (ev) => {
        try { if (ev?.source !== window.parent) return } catch (e) { }
        const msg = ev.data || {}
        try {
            if (msg.type === 'init') {
                const ok = await initRuntime(msg.runtimeUrl || '../vendor/micropython.mjs')
                if (ok) {
                    // Persist initial snapshot for AST runner fallback and write files
                    try { if (msg.files && typeof msg.files === 'object') { initialFilesSnapshot = msg.files; writeFilesToFS(msg.files) } } catch (e) { log('write init files failed', e) }
                    post({ type: 'ready' })
                }
            } else if (msg.type === 'runTest') {
                const timeout = (msg.test && msg.test.timeoutMs) || 20000
                let finished = false
                const timer = setTimeout(async () => {
                    if (finished) return
                    finished = true
                    try {
                        if (runtimeAdapter && runtimeAdapter.interruptExecution) {
                            try { runtimeAdapter.interruptExecution() } catch (e) { }
                        }
                    } catch (e) { }
                    post({ type: 'error', error: 'timeout' })
                }, timeout)

                // Child-runner AST short-circuit: if this looks like an AST test,
                // evaluate it here so parent doesn't need to rely on its detection.
                try {
                    const test = msg.test || {}
                    let astRuleObj = null
                    if (test.astRule) astRuleObj = test.astRule
                    else if (test.pattern && test.pattern.astRule) astRuleObj = test.pattern.astRule
                    else if (test.pattern && (test.pattern.expression || test.pattern.matcher)) astRuleObj = test.pattern
                    else if (test.type === 'ast' && test.astRule) astRuleObj = test.astRule

                    if (!astRuleObj && test && test.type === 'ast') {
                        const candidateExpression = test.expression || (test.pattern && (test.pattern.expression || test.pattern.expr)) || test.ast_expression || null
                        const candidateMatcher = test.matcher || (test.pattern && test.pattern.matcher) || test.ast_matcher || null
                        if (candidateExpression || candidateMatcher) astRuleObj = { expression: candidateExpression || '', matcher: candidateMatcher || '' }
                    }

                    if ((test && test.type === 'ast') || astRuleObj) {
                        // Determine source code to analyze
                        let code = ''
                        if (typeof test.main === 'string' && test.main.trim()) code = test.main
                        else if (initialFilesSnapshot && typeof initialFilesSnapshot === 'object') {
                            const mainKeys = ['/main.py', 'main.py', '/main', 'main']
                            for (const k of mainKeys) { if (Object.prototype.hasOwnProperty.call(initialFilesSnapshot, k)) { code = String(initialFilesSnapshot[k] || ''); break } }
                        }

                        // Try to get analyzeCode: try relative imports then window fallback
                        let analyzeFn = null
                        try {
                            try { const mod = await import('../js/ast-analyzer.js'); if (mod && mod.analyzeCode) analyzeFn = mod.analyzeCode } catch (_) { }
                            if (!analyzeFn) try { const mod2 = await import('/src/js/ast-analyzer.js'); if (mod2 && mod2.analyzeCode) analyzeFn = mod2.analyzeCode } catch (_) { }
                        } catch (_) { }
                        if (!analyzeFn && typeof window.analyzeCode === 'function') analyzeFn = window.analyzeCode

                        let result = null
                        if (analyzeFn && (astRuleObj && astRuleObj.expression)) {
                            try { result = await analyzeFn(code, astRuleObj.expression) } catch (e) { result = null }
                        }

                        let passed = false
                        if (astRuleObj && astRuleObj.matcher && typeof astRuleObj.matcher === 'string' && astRuleObj.matcher.trim()) {
                            try {
                                const evaluateMatch = new Function('result', `try { return ${astRuleObj.matcher.trim()} } catch (e) { console.warn('AST matcher error:', e && e.message); return false }`)
                                passed = !!evaluateMatch(result)
                            } catch (err) { passed = false }
                        } else {
                            passed = !!result
                        }

                        const out = { id: test.id, passed: passed, stdout: JSON.stringify(result || null), stderr: '', durationMs: 0, astPassed: passed, astResult: result }
                        // Post result and skip runtime execution
                        post({ type: 'testResult', ...out })
                        clearTimeout(timer)
                        finished = true
                        return
                    }
                } catch (e) {
                    // fallthrough to runtime execution on error
                }

                const result = await handleRunTest(msg.test)
                if (!finished) {
                    finished = true
                    clearTimeout(timer)
                    post({ type: 'testResult', ...result })
                }
            } else if (msg.type === 'stdinResponse') {
                if (pendingStdinResolves && pendingStdinResolves.length) {
                    try {
                        const v = msg.value == null ? '' : String(msg.value)
                        // resolve all queued resolvers with the same value
                        pendingStdinResolves.forEach(r => { try { r(v) } catch (_) { } })
                        pendingStdinResolves = []
                        stdinRequested = false
                        // Echo the input back into stdoutBuf once so the host
                        // can match prompt+input sequences. Mirror terminal: add newline.
                        try {
                            if (v !== '') {
                                const echo = v + '\n'
                                stdoutBuf.push(echo)
                                post({ type: 'stdout', text: echo })
                            }
                        } catch (_e) { }
                    } catch (_e) { }
                }
            } else if (msg.type === 'terminate') {
                try { post({ type: 'debug', text: 'terminate received' }) } catch (e) { }
                try { if (runtimeAdapter && runtimeAdapter.interruptExecution) runtimeAdapter.interruptExecution() } catch (e) { }
            }
        } catch (err) {
            post({ type: 'error', error: String(err) })
        }
    })


    post({ type: 'loaded' })
    try { post({ type: 'checkpoint', name: 'runner_loaded' }) } catch (_e) { }

} catch (e) {
    try { window.__runner_error = String(e) } catch (_e) { }
    try { console.error('runner top-level exception', e) } catch (_e) { }
}
