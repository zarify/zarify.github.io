/*
 * Minimal program test runner for Clipy
 * Exports:
 *  - runTests(tests, options)
 *  - matchExpectation(actual, expected) helper
 *
 * Design notes:
 *  - The runner is runtime-agnostic: it accepts an injected `runFn(test)` that
 *    performs the actual program execution and returns a Promise resolving to
 *    { stdout, stderr, filename, durationMs }
 *  - This makes the runner easily unit-testable in Node by providing a fake
 *    runFn.
 */

// Lightweight matcher for expected outputs. `expected` may be:
//  - a string -> we check `actual` includes the string
//  - an object { type: 'regex', expression: '...' } -> RegExp test
//  - a RegExp instance
function matchExpectation(actual, expected) {
    const s = String(actual || '')
    if (expected == null) return { matched: true }
    if (expected instanceof RegExp) {
        return { matched: !!s.match(expected), detail: null }
    }
    if (typeof expected === 'object' && expected.type === 'regex') {
        try {
            const re = new RegExp(expected.expression, expected.flags || '')
            const m = s.match(re)
            return { matched: !!m, detail: m || null }
        } catch (e) {
            return { matched: false, detail: null }
        }
    }
    // string compare - include
    if (typeof expected === 'string') {
        return { matched: s.indexOf(expected) !== -1 }
    }
    return { matched: false }
}

// Produce a human-readable mismatch reason for simple string expectations.
function computeMismatchReason(actual, expected) {
    try {
        const a = String(actual == null ? '' : actual)
        const e = String(expected == null ? '' : expected)

        // Helper functions to normalize text
        const norm = (s) => s.replace(/[\s\r\n]+/g, ' ').trim()
        const stripPunct = (s) => {
            try {
                return s.replace(/[\p{P}\p{S}]/gu, '') // remove punctuation & symbols
            } catch (_e) {
                return s.replace(/[.,;:!?'"()\[\]{}\-]/g, '') // fallback for older browsers
            }
        }

        // Check what types of fixes would make them match
        const differences = []

        // Would fixing case make them match?
        if (a.toLowerCase() === e.toLowerCase()) {
            differences.push('case')
        }

        // Would fixing spacing make them match? 
        if (norm(a) === norm(e)) {
            differences.push('spacing/line breaks')
        }

        // Would fixing punctuation make them match?
        if (stripPunct(a).trim() === stripPunct(e).trim()) {
            differences.push('punctuation')
        }

        // Would fixing case + spacing make them match?
        if (norm(a.toLowerCase()) === norm(e.toLowerCase()) && !differences.includes('case') && !differences.includes('spacing/line breaks')) {
            differences.push('case', 'spacing/line breaks')
        }

        // Would fixing case + punctuation make them match?
        if (stripPunct(a).toLowerCase().trim() === stripPunct(e).toLowerCase().trim() && !differences.includes('case') && !differences.includes('punctuation')) {
            differences.push('case', 'punctuation')
        }

        // Would fixing spacing + punctuation make them match?
        if (norm(stripPunct(a)) === norm(stripPunct(e)) && !differences.includes('spacing/line breaks') && !differences.includes('punctuation')) {
            differences.push('spacing/line breaks', 'punctuation')
        }

        // Would fixing all three make them match?
        if (norm(stripPunct(a).toLowerCase()) === norm(stripPunct(e).toLowerCase()) && differences.length === 0) {
            differences.push('case', 'spacing/line breaks', 'punctuation')
        }

        if (differences.length > 0) {
            // Remove duplicates and format nicely
            const uniqueDiffs = [...new Set(differences)]
            return `Your program's output differences: ${uniqueDiffs.join(', ')}`
        }

        return 'Your program\'s output does not match the expected output'
    } catch (_e) {
        return 'Your program\'s output does not match the expected output'
    }
}

/**
 * Run an array of tests.
 * Each test shape (minimal):
 *  { id, description, stdin, expected_stdout, expected_stderr, timeoutMs, setup }
 * options:
 *  - runFn: async function(test) -> { stdout, stderr, filename, durationMs }
 *  - setupFn: async function(setup) optional
 */
async function runTests(tests, options = {}) {
    if (!Array.isArray(tests)) throw new Error('tests must be an array')
    const runFn = typeof options.runFn === 'function' ? options.runFn : async () => { throw new Error('no runFn provided') }
    const setupFn = typeof options.setupFn === 'function' ? options.setupFn : null

    const results = []
    for (const t of tests) {
        const res = { id: t.id || null, description: t.description || '', passed: false, stdout: null, stderr: null, durationMs: null, reason: null }
        try {
            if (t.setup && setupFn) {
                try { await setupFn(t.setup) } catch (e) { /* continue but record */ res.reason = 'setup_failed' }
            }

            const start = Date.now()
            const runResult = await runFn(t)
            const end = Date.now()
            const duration = typeof runResult.durationMs === 'number' ? runResult.durationMs : (end - start)
            res.durationMs = duration
            res.stdout = runResult.stdout || ''
            res.stderr = runResult.stderr || ''
            res.filename = runResult.filename || null

            // Include the author-provided expected values in the result for
            // easier debugging/diagnostics by the UI or logs.
            try {
                res.expected_stdout = (t && typeof t.expected_stdout !== 'undefined') ? t.expected_stdout : null
                res.expected_stderr = (t && typeof t.expected_stderr !== 'undefined') ? t.expected_stderr : null
            } catch (_e) { res.expected_stdout = null; res.expected_stderr = null }

            // Debug trace: show what we're about to match so UI logs can be used
            // to diagnose surprising pass/fail outcomes.
            try { console.debug && console.debug('[runTests] test', String(t.id || ''), 'stdout(actual):', String(res.stdout).slice(0, 200), 'expected_stdout:', res.expected_stdout) } catch (_e) { }

            // Timeout handling
            if (typeof t.timeoutMs === 'number' && duration > t.timeoutMs) {
                res.passed = false
                res.reason = 'timeout'
                results.push(res)
                continue
            }

            // Check expected_stdout and expected_stderr (both optional)
            let ok = true
            let details = {}

            // If the program produced stderr but we expected stdout, this is a failure
            if (res.stderr && t.expected_stdout != null) {
                ok = false
                res.reason = 'Your program produced an error instead of the expected output'
            }

            if (t.expected_stdout != null && !res.stderr) {
                const m = matchExpectation(res.stdout, t.expected_stdout)
                if (!m.matched) ok = false
                // For regex-shaped expectations we do not include actual-vs-expected
                // details to avoid confusing the author; only keep match detail
                if (typeof t.expected_stdout === 'object' && t.expected_stdout.type === 'regex') {
                    details.stdout = m.detail || null
                } else {
                    details.stdout = m.detail || null
                }
                // Provide a more informative reason for plain-string mismatches
                if (!m.matched && (!res.reason || res.reason === 'mismatch')) {
                    if (typeof t.expected_stdout === 'string') {
                        res.reason = computeMismatchReason(res.stdout, t.expected_stdout)
                    } else {
                        res.reason = 'Your program\'s output does not match the expected output'
                    }
                }
            }
            if (t.expected_stderr != null) {
                const m = matchExpectation(res.stderr, t.expected_stderr)
                if (!m.matched) ok = false
                if (typeof t.expected_stderr === 'object' && t.expected_stderr.type === 'regex') {
                    details.stderr = m.detail || null
                } else {
                    details.stderr = m.detail || null
                }
                if (!m.matched && (!res.reason || res.reason === 'mismatch')) {
                    if (typeof t.expected_stderr === 'string') {
                        res.reason = computeMismatchReason(res.stderr, t.expected_stderr)
                    } else {
                        res.reason = 'Your program\'s output does not match the expected output'
                    }
                }
            }

            res.passed = ok
            if (!ok && !res.reason) res.reason = 'Your program\'s output does not match the expected output'
            if (Object.keys(details).length) res.details = details
        } catch (e) {
            res.passed = false
            res.reason = 'error'
            res.error = (e && e.message) ? e.message : String(e)
            // If an exception occurred outside runFn result, capture as stderr-like text
            try { res.stderr = res.stderr || String(e && e.stack ? e.stack : res.error) } catch (_e) { res.stderr = res.stderr || res.error }
        }
        results.push(res)
    }
    return results
}

// Expose for Node require and ES imports
if (typeof module !== 'undefined' && module.exports) module.exports = { runTests, matchExpectation }
export { runTests, matchExpectation }
