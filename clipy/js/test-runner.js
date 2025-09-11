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
import { debug as logDebug } from './logger.js'

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
    if (typeof expected === 'object' && expected.type === 'exact') {
        // Exact match - the entire output must match exactly
        const expectedText = String(expected.expression || '')
        return { matched: s === expectedText, detail: null }
    }
    // string compare - contains (default behavior)
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
            // Debug: log the raw runFn result so we can diagnose empty stdout/stderr
            try { logDebug('[runTests] raw runResult for', String(t.id || ''), runResult) } catch (_e) { }
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
            try { logDebug('[runTests] test', String(t.id || ''), 'stdout(actual):', String(res.stdout).slice(0, 200), 'expected_stdout:', res.expected_stdout) } catch (_e) { }

            // Timeout handling
            if (typeof t.timeoutMs === 'number' && duration > t.timeoutMs) {
                res.passed = false
                res.reason = 'timeout'
                results.push(res)
                continue
            }

            // Check expected_stdout and expected_stderr (both optional)
            // Support short-circuit AST tests: if runFn returned astPassed, use it
            let ok = true
            let details = {}
            if (runResult && typeof runResult.astPassed === 'boolean') {
                ok = !!runResult.astPassed
                // include astResult for debugging details
                if (runResult.astResult) details.ast = runResult.astResult
                res.passed = ok
                res.details = Object.keys(details).length ? details : undefined
                results.push(res)
                continue
            }

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
if (typeof module !== 'undefined' && module.exports) module.exports = { runTests, matchExpectation, runGroupedTests, computeMismatchReason }
export { runTests, matchExpectation, runGroupedTests, computeMismatchReason }

/**
 * Run grouped tests with conditional execution support
 * @param {Object} testConfig - The grouped test configuration
 * @param {Object} options - Same options as runTests
 * @returns {Promise<Object>} Results with groupResults and flatResults
 */
async function runGroupedTests(testConfig, options = {}) {
    try {
        const groupResults = []
        const flatResults = []

        // Helper function to check if a test/group should run
        function shouldRun(item, previousResults) {
            // Debug: show what we're checking and what the previous results look like
            try {
                const idOrName = item && (item.id || item.name) ? (item.id || item.name) : '<unknown>'
                logDebug('[test-runner] shouldRun check for', idOrName, 'runIf=', item?.conditional?.runIf, 'prevCount=', previousResults ? previousResults.length : 0)
            } catch (_e) { }

            if (!item.conditional || item.conditional.runIf === 'always') {
                return { shouldRun: true, reason: null }
            }

            if (item.conditional.alwaysRun) {
                return { shouldRun: true, reason: null }
            }

            if (item.conditional.runIf === 'previous_passed') {
                const previous = previousResults && previousResults.length ? previousResults[previousResults.length - 1] : null
                try { logDebug('[test-runner] previous_passed check, last previous=', previous ? previous.id || previous.description || '<anon>' : null, 'passed=', previous ? previous.passed : null) } catch (_e) { }
                if (!previous || !previous.passed) {
                    return { shouldRun: false, reason: 'previous_test_failed' }
                }
            }

            if (item.conditional.runIf === 'previous_group_passed') {
                const previousGroup = groupResults[groupResults.length - 1]
                try { logDebug('[test-runner] previous_group_passed check, previousGroup=', previousGroup ? previousGroup.name || previousGroup.id : null, 'passed=', previousGroup ? previousGroup.passed : null) } catch (_e) { }
                if (!previousGroup || !previousGroup.passed) {
                    return { shouldRun: false, reason: 'previous_group_failed' }
                }
            }

            return { shouldRun: true, reason: null }
        }

        // Process groups
        if (testConfig.groups) {
            for (const group of testConfig.groups) {
                const groupResult = {
                    id: group.id,
                    name: group.name,
                    passed: false,
                    skipped: false,
                    skipReason: null,
                    testResults: [],
                    testsRun: 0,
                    testsPassed: 0,
                    testsSkipped: 0
                }

                // Check if group should run
                const groupCheck = shouldRun(group, flatResults)
                if (!groupCheck.shouldRun) {
                    groupResult.skipped = true
                    groupResult.skipReason = groupCheck.reason

                    try { logDebug('[test-runner] skipping entire group', group.name, 'reason:', groupCheck.reason) } catch (_e) { }

                    // Mark all tests in group as skipped
                    for (const test of group.tests) {
                        const testResult = {
                            id: test.id,
                            description: test.description,
                            passed: null,
                            skipped: true,
                            skipReason: 'group_skipped',
                            stdout: null,
                            stderr: null,
                            durationMs: 0
                        }
                        groupResult.testResults.push(testResult)
                        flatResults.push(testResult)
                        groupResult.testsSkipped++
                    }

                    groupResults.push(groupResult)
                    continue
                }

                // Run tests in group sequentially so "previous_passed" semantics
                // correctly inspect the immediately previous test's result.
                const skippedThisGroup = []
                const queuedIds = []

                for (let testIdx = 0; testIdx < group.tests.length; testIdx++) {
                    const test = group.tests[testIdx]

                    // First test in group should always run (unless explicitly set otherwise)
                    let testCheck
                    if (testIdx === 0 && test.conditional?.runIf === 'previous_passed') {
                        // Override: first test in group runs automatically
                        testCheck = { shouldRun: true, reason: null }
                    } else {
                        // Use the combined previous results (flatResults includes earlier groups
                        // and groupResult.testResults contains earlier tests/skips in this group)
                        const combinedPrevious = flatResults.concat(groupResult.testResults)
                        testCheck = shouldRun(test, combinedPrevious)
                    }

                    if (!testCheck.shouldRun) {
                        try { logDebug('[test-runner] skipping test', test.id, 'in group', group.name, 'reason:', testCheck.reason) } catch (_e) { }
                        skippedThisGroup.push({ id: test.id, reason: testCheck.reason })
                        const testResult = {
                            id: test.id,
                            description: test.description,
                            passed: null,
                            skipped: true,
                            skipReason: testCheck.reason,
                            stdout: null,
                            stderr: null,
                            durationMs: 0
                        }
                        groupResult.testResults.push(testResult)
                        flatResults.push(testResult)
                        groupResult.testsSkipped++
                        // continue to next test
                        continue
                    }

                    // If we get here, this test will be executed now. Run it and append
                    // its result immediately so subsequent tests can see its outcome.
                    try { queuedIds.push(test.id) } catch (_e) { }
                    try { logDebug('[test-runner] executing 1 test for group', group.name, test.id) } catch (_e) { }
                    const testResults = await runTests([test], options)
                    for (const result of testResults) {
                        groupResult.testResults.push(result)
                        flatResults.push(result)
                        groupResult.testsRun++
                        if (result.passed) groupResult.testsPassed++
                    }
                }

                // Report queued vs skipped for this group
                try { logDebug('[test-runner] group', group.name, 'queued:', queuedIds, 'skipped:', skippedThisGroup) } catch (_e) { }

                // Group passes if all run tests passed
                groupResult.passed = groupResult.testsRun > 0 && groupResult.testsPassed === groupResult.testsRun
                groupResults.push(groupResult)
            }
        }

        // Process ungrouped tests
        if (testConfig.ungrouped) {
            for (const test of testConfig.ungrouped) {
                const testCheck = shouldRun(test, flatResults)
                if (!testCheck.shouldRun) {
                    const testResult = {
                        id: test.id,
                        description: test.description,
                        passed: null,
                        skipped: true,
                        skipReason: testCheck.reason,
                        stdout: null,
                        stderr: null,
                        durationMs: 0
                    }
                    flatResults.push(testResult)
                } else {
                    const testResults = await runTests([test], options)
                    flatResults.push(...testResults)
                }
            }
        }

        logDebug('[test-runner] runGroupedTests returning:', { groupResults: groupResults.length, flatResults: flatResults.length })
        return {
            groupResults,
            flatResults,
            totalTests: flatResults.length,
            totalPassed: flatResults.filter(r => r.passed === true).length,
            totalSkipped: flatResults.filter(r => r.skipped === true).length,
            totalFailed: flatResults.filter(r => r.passed === false).length
        }

    } catch (error) {
        console.error('[test-runner] Error in runGroupedTests:', error)
        return {
            groupResults: [],
            flatResults: [],
            totalTests: 0,
            totalPassed: 0,
            totalSkipped: 0,
            totalFailed: 0,
            error: error.message
        }
    }
}
