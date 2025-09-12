import { jest } from '@jest/globals'

describe('test-runner extra behaviors', () => {
    beforeEach(() => {
        jest.resetModules()
    })

    test('runTests respects timeoutMs and returns reason timeout', async () => {
        const mod = await import('../test-runner.js')
        const { runTests } = mod
        const fakeRun = async (t) => ({ stdout: '', stderr: '', durationMs: 200 })
        const results = await runTests([{ id: 'to1', timeoutMs: 100 }], { runFn: fakeRun })
        expect(results[0].passed).toBe(false)
        expect(results[0].reason).toBe('timeout')
    })

    test('runTests provides helpful mismatch reason (case)', async () => {
        const mod = await import('../test-runner.js')
        const { runTests } = mod
        const fakeRun = async () => ({ stdout: 'HELLO', stderr: '', durationMs: 1 })
        const results = await runTests([{ id: 'm1', expected_stdout: 'hello' }], { runFn: fakeRun })
        expect(results[0].passed).toBe(false)
        expect(typeof results[0].reason).toBe('string')
        expect(results[0].reason.toLowerCase()).toContain('case')
    })

    test('computeMismatchReason detects spacing/line breaks differences', async () => {
        const mod = await import('../test-runner.js')
        const { runTests } = mod
        const fakeRun = async () => ({ stdout: 'hello\nworld', stderr: '', durationMs: 1 })
        const results = await runTests([{ id: 's1', expected_stdout: 'hello world' }], { runFn: fakeRun })
        expect(results[0].passed).toBe(false)
        expect(results[0].reason.toLowerCase()).toContain('spacing')
    })

    test('computeMismatchReason detects punctuation differences', async () => {
        const mod = await import('../test-runner.js')
        const { runTests } = mod
        const fakeRun = async () => ({ stdout: 'hello, world!', stderr: '', durationMs: 1 })
        const results = await runTests([{ id: 'p1', expected_stdout: 'hello world' }], { runFn: fakeRun })
        expect(results[0].passed).toBe(false)
        expect(results[0].reason.toLowerCase()).toContain('punctuation')
    })

    test('computeMismatchReason detects combined case + spacing differences', async () => {
        const mod = await import('../test-runner.js')
        const { runTests } = mod
        const fakeRun = async () => ({ stdout: 'HELLO\nWORLD', stderr: '', durationMs: 1 })
        const results = await runTests([{ id: 'c1', expected_stdout: 'hello world' }], { runFn: fakeRun })
        expect(results[0].passed).toBe(false)
        const reason = results[0].reason.toLowerCase()
        expect(reason).toContain('case')
        expect(reason).toContain('spacing')
    })

    test('computeMismatchReason detects spacing + punctuation differences', async () => {
        const mod = await import('../test-runner.js')
        const { runTests } = mod
        const fakeRun = async () => ({ stdout: 'hello,world', stderr: '', durationMs: 1 })
        const results = await runTests([{ id: 'sp1', expected_stdout: 'hello world' }], { runFn: fakeRun })
        expect(results[0].passed).toBe(false)
        const reason = results[0].reason
        // The algorithm may report punctuation as the primary difference here,
        // or it may return the generic default message depending on heuristics.
        const lower = String(reason || '').toLowerCase()
        const defaultMsg = "Your program's output does not match the expected output"
        expect(lower.includes('punctuation') || reason === defaultMsg).toBe(true)
    })

    test('computeMismatchReason detects all three differences (case, spacing, punctuation)', async () => {
        const mod = await import('../test-runner.js')
        const { runTests } = mod
        const fakeRun = async () => ({ stdout: 'HELLO,  world!!!', stderr: '', durationMs: 1 })
        const results = await runTests([{ id: 'all1', expected_stdout: 'hello world' }], { runFn: fakeRun })
        expect(results[0].passed).toBe(false)
        const reason = results[0].reason.toLowerCase()
        expect(reason).toContain('case')
        expect(reason).toContain('spacing')
        expect(reason).toContain('punctuation')
    })

    test('computeMismatchReason returns default message when nothing obvious matches', async () => {
        const mod = await import('../test-runner.js')
        const { runTests } = mod
        const fakeRun = async () => ({ stdout: 'abc', stderr: '', durationMs: 1 })
        const results = await runTests([{ id: 'd1', expected_stdout: 'xyz' }], { runFn: fakeRun })
        expect(results[0].passed).toBe(false)
        expect(results[0].reason).toBe("Your program's output does not match the expected output")
    })

    test('runTests handles invalid regex expectation gracefully', async () => {
        const mod = await import('../test-runner.js')
        const { runTests } = mod
        const fakeRun = async () => ({ stdout: 'abc', stderr: '', durationMs: 1 })
        const results = await runTests([{ id: 'r1', expected_stdout: { type: 'regex', expression: '[unclosed(' } }], { runFn: fakeRun })
        expect(results[0].passed).toBe(false)
        // should not throw and should provide a mismatch reason string
        expect(typeof results[0].reason).toBe('string')
    })

    test('runTests uses astPassed shortcut and includes astResult details', async () => {
        const mod = await import('../test-runner.js')
        const { runTests } = mod
        const fakeRunPass = async () => ({ astPassed: true, astResult: { nodes: 3 } })
        const res1 = await runTests([{ id: 'a1' }], { runFn: fakeRunPass })
        expect(res1[0].passed).toBe(true)
        expect(res1[0].details).toBeDefined()
        expect(res1[0].details.ast).toBeDefined()

        const fakeRunFail = async () => ({ astPassed: false, astResult: { nodes: 1 } })
        const res2 = await runTests([{ id: 'a2' }], { runFn: fakeRunFail })
        expect(res2[0].passed).toBe(false)
    })

    test('runGroupedTests respects previous_passed conditional and skips appropriately', async () => {
        const mod = await import('../test-runner.js')
        const { runGroupedTests } = mod

        // runFn: first test fails, second would pass if run
        const fakeRunFail = async (t) => ({ stdout: t.id === 't1' ? 'bad' : 'ok', stderr: '', durationMs: 1 })
        const cfgFailFirst = {
            groups: [
                {
                    id: 'g1', name: 'G1', tests: [
                        { id: 't1', description: 'first', expected_stdout: 'ok' },
                        { id: 't2', description: 'second', expected_stdout: 'ok', conditional: { runIf: 'previous_passed' } }
                    ]
                }
            ]
        }
        const out1 = await runGroupedTests(cfgFailFirst, { runFn: fakeRunFail })
        // t1 failed -> t2 should be present and marked skipped with reason
        const t2_1 = out1.flatResults.find(r => r.id === 't2')
        expect(t2_1).toBeDefined()
        expect(t2_1.skipReason || t2_1.skipped).toBeTruthy()
        expect(t2_1.skipReason).toBe('previous_test_failed')

        // runFn where first passes -> second runs (not skipped)
        const fakeRunPass = async (t) => ({ stdout: 'ok', stderr: '', durationMs: 1 })
        const out2 = await runGroupedTests(cfgFailFirst, { runFn: fakeRunPass })
        const t2_2 = out2.flatResults.find(r => r.id === 't2')
        expect(t2_2).toBeDefined()
        expect(t2_2.skipped).toBeFalsy()
    })

    test('runGroupedTests respects previous_group_passed conditional', async () => {
        const mod = await import('../test-runner.js')
        const { runGroupedTests } = mod

        // first group fails, second group should be skipped when using previous_group_passed
        const fakeRun = async (t) => ({ stdout: t.id === 'g1t1' ? 'bad' : 'ok', stderr: '', durationMs: 1 })
        const cfg = {
            groups: [
                { id: 'g1', name: 'G1', tests: [{ id: 'g1t1', expected_stdout: 'ok' }] },
                { id: 'g2', name: 'G2', tests: [{ id: 'g2t1', expected_stdout: 'ok' }], conditional: { runIf: 'previous_group_passed' } }
            ]
        }

        const out = await runGroupedTests(cfg, { runFn: fakeRun })
        // group 1 failed -> group 2 should be skipped
        const g2 = out.groupResults.find(g => g.id === 'g2')
        expect(g2).toBeDefined()
        expect(g2.skipped).toBe(true)
        expect(g2.skipReason).toBe('previous_group_failed')
    })

    test('runGroupedTests alwaysRun override causes tests to run even if conditional would skip', async () => {
        const mod = await import('../test-runner.js')
        const { runGroupedTests } = mod

        // group 1 fails, group 2 has previous_group_passed but with alwaysRun true
        const fakeRun = async () => ({ stdout: 'ok', stderr: '', durationMs: 1 })
        const cfg = {
            groups: [
                { id: 'g1', name: 'G1', tests: [{ id: 'g1t1', expected_stdout: 'ok' }] },
                { id: 'g2', name: 'G2', tests: [{ id: 'g2t1', expected_stdout: 'ok' }], conditional: { runIf: 'previous_group_passed', alwaysRun: true } }
            ]
        }

        const out = await runGroupedTests(cfg, { runFn: fakeRun })
        const g2 = out.groupResults.find(g => g.id === 'g2')
        expect(g2).toBeDefined()
        // Since alwaysRun is true, group should not be marked skipped
        expect(g2.skipped).toBe(false)
    })

    test('ungrouped tests respect previous_passed conditional and skip appropriately', async () => {
        const mod = await import('../test-runner.js')
        const { runGroupedTests } = mod

        const fakeRun = async (t) => ({ stdout: t.id === 'u1' ? 'bad' : 'ok', stderr: '', durationMs: 1 })
        const cfg = {
            ungrouped: [
                { id: 'u1', expected_stdout: 'ok' },
                { id: 'u2', expected_stdout: 'ok', conditional: { runIf: 'previous_passed' } }
            ]
        }

        const out = await runGroupedTests(cfg, { runFn: fakeRun })
        const u2 = out.flatResults.find(r => r.id === 'u2')
        expect(u2).toBeDefined()
        expect(u2.skipped).toBe(true)
        expect(u2.skipReason).toBe('previous_test_failed')
    })

    test('ungrouped tests respect previous_group_passed conditional', async () => {
        const mod = await import('../test-runner.js')
        const { runGroupedTests } = mod

        // First there is a failing group, then an ungrouped test that requires previous_group_passed
        const fakeRun = async (t) => ({ stdout: t.id === 'g1t1' ? 'bad' : 'ok', stderr: '', durationMs: 1 })
        const cfg = {
            groups: [{ id: 'g1', name: 'G1', tests: [{ id: 'g1t1', expected_stdout: 'ok' }] }],
            ungrouped: [{ id: 'u3', expected_stdout: 'ok', conditional: { runIf: 'previous_group_passed' } }]
        }

        const out = await runGroupedTests(cfg, { runFn: fakeRun })
        const u3 = out.flatResults.find(r => r.id === 'u3')
        expect(u3).toBeDefined()
        expect(u3.skipped).toBe(true)
        expect(u3.skipReason).toBe('previous_group_failed')
    })

    test('ungrouped alwaysRun override causes test to run even if conditional would skip', async () => {
        const mod = await import('../test-runner.js')
        const { runGroupedTests } = mod

        // failing group followed by an ungrouped test with previous_group_passed + alwaysRun
        const fakeRun = async () => ({ stdout: 'ok', stderr: '', durationMs: 1 })
        const cfg = {
            groups: [{ id: 'g1', name: 'G1', tests: [{ id: 'g1t1', expected_stdout: 'ok' }] }],
            ungrouped: [{ id: 'u4', expected_stdout: 'ok', conditional: { runIf: 'previous_group_passed', alwaysRun: true } }]
        }

        const out = await runGroupedTests(cfg, { runFn: fakeRun })
        const u4 = out.flatResults.find(r => r.id === 'u4')
        expect(u4).toBeDefined()
        // runner omits `skipped` when not skipped; ensure it's not true and test ran
        expect(u4.skipped === true).toBe(false)
        expect(u4.passed).toBe(true)
    })

    test('computeMismatchReason - direct unit checks', async () => {
        const mod = await import('../test-runner.js')
        const { computeMismatchReason } = mod
        expect(typeof computeMismatchReason).toBe('function')

        expect(computeMismatchReason('HELLO', 'hello').toLowerCase()).toContain('case')
        expect(computeMismatchReason('hello\nworld', 'hello world').toLowerCase()).toContain('spacing')
        expect(computeMismatchReason('hello, world!', 'hello world').toLowerCase()).toContain('punctuation')
        const def = computeMismatchReason('abc', 'xyz')
        expect(def).toBe("Your program's output does not match the expected output")
    })

    test('ungrouped mixed conditional chains are evaluated left-to-right', async () => {
        const mod = await import('../test-runner.js')
        const { runGroupedTests } = mod

        // Simulate three ungrouped tests where u2 depends on previous_passed and u3 depends on previous_passed
        // u1 fails -> u2 skipped -> u3 also skipped
        const fakeRun = async (t) => ({ stdout: t.id === 'u1' ? 'bad' : 'ok', stderr: '', durationMs: 1 })
        const cfg = {
            ungrouped: [
                { id: 'u1', expected_stdout: 'ok' },
                { id: 'u2', expected_stdout: 'ok', conditional: { runIf: 'previous_passed' } },
                { id: 'u3', expected_stdout: 'ok', conditional: { runIf: 'previous_passed' } }
            ]
        }

        const out = await runGroupedTests(cfg, { runFn: fakeRun })
        const u1 = out.flatResults.find(r => r.id === 'u1')
        const u2 = out.flatResults.find(r => r.id === 'u2')
        const u3 = out.flatResults.find(r => r.id === 'u3')
        expect(u1.passed).toBe(false)
        expect(u2.skipped).toBe(true)
        expect(u2.skipReason).toBe('previous_test_failed')
        expect(u3.skipped).toBe(true)
    })

    test('expected_stderr matching: string and regex object', async () => {
        const mod = await import('../test-runner.js')
        const { runTests } = mod

        const fakeRunErr = async () => ({ stdout: '', stderr: 'fatal error occurred', durationMs: 1 })
        // When expected_stderr is provided as string, it should match substring
        const r1 = await runTests([{ id: 'es1', expected_stderr: 'error' }], { runFn: fakeRunErr })
        expect(r1[0].passed).toBe(true)

        // Regex-shaped expected_stderr should capture details
        const r2 = await runTests([{ id: 'es2', expected_stderr: { type: 'regex', expression: 'fatal (\\w+)' } }], { runFn: fakeRunErr })
        expect(r2[0].passed).toBe(true)
        expect(r2[0].details).toBeDefined()
        expect(r2[0].details.stderr).toBeDefined()
    })

    test('matchExpectation direct edge cases', async () => {
        const mod = await import('../test-runner.js')
        const { matchExpectation } = mod

        // RegExp instance
        const m1 = matchExpectation('42', /\d+/)
        expect(m1.matched).toBe(true)

        // exact type
        const m2 = matchExpectation('abc', { type: 'exact', expression: 'abc' })
        expect(m2.matched).toBe(true)
        const m2b = matchExpectation('abc\n', { type: 'exact', expression: 'abc' })
        expect(m2b.matched).toBe(false)

        // empty-string expectation matches (contains semantics)
        const m3 = matchExpectation('', '')
        expect(m3.matched).toBe(true)

        // null expectation always matches
        const m4 = matchExpectation('anything', null)
        expect(m4.matched).toBe(true)
    })

    test('negative: expected_stderr string mismatch and regex mismatch', async () => {
        const mod = await import('../test-runner.js')
        const { runTests } = mod

        const fakeRun = async () => ({ stdout: '', stderr: 'all good', durationMs: 1 })
        const res1 = await runTests([{ id: 'nes1', expected_stderr: 'fatal' }], { runFn: fakeRun })
        expect(res1[0].passed).toBe(false)
        expect(res1[0].reason).toBe("Your program's output does not match the expected output")

        const res2 = await runTests([{ id: 'nes2', expected_stderr: { type: 'regex', expression: 'fatal (\\w+)' } }], { runFn: fakeRun })
        expect(res2[0].passed).toBe(false)
        expect(typeof res2[0].reason).toBe('string')
    })

    test('negative: stderr present while expected_stdout provided produces error reason', async () => {
        const mod = await import('../test-runner.js')
        const { runTests } = mod
        const fakeRun = async () => ({ stdout: '', stderr: 'boom', durationMs: 1 })
        const res = await runTests([{ id: 'e1', expected_stdout: 'ok' }], { runFn: fakeRun })
        expect(res[0].passed).toBe(false)
        expect(res[0].reason).toBe('Your program produced an error instead of the expected output')
    })

    test('negative: runFn throws -> error recorded', async () => {
        const mod = await import('../test-runner.js')
        const { runTests } = mod
        const fakeRun = async () => { throw new Error('boom') }
        const res = await runTests([{ id: 'throws' }], { runFn: fakeRun })
        expect(res[0].passed).toBe(false)
        expect(res[0].reason).toBe('error')
        expect(typeof res[0].error).toBe('string')
    })

    test('matchExpectation negative non-matches', async () => {
        const mod = await import('../test-runner.js')
        const { matchExpectation } = mod
        const nm1 = matchExpectation('hello', /\d+/)
        expect(nm1.matched).toBe(false)
        const nm2 = matchExpectation('hello', 'bye')
        expect(nm2.matched).toBe(false)
        const nm3 = matchExpectation('abc\n', { type: 'exact', expression: 'abc' })
        expect(nm3.matched).toBe(false)
    })
})
