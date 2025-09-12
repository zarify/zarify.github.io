import { jest } from '@jest/globals'

describe('test-runner utilities', () => {
    beforeEach(() => {
        jest.resetModules()
    })

    test('matchExpectation handles string contains and regex object', async () => {
        const mod = await import('../test-runner.js')
        const { matchExpectation } = mod
        expect(matchExpectation('hello world', 'hello').matched).toBe(true)
        expect(matchExpectation('foo 123', { type: 'regex', expression: '\\d+' }).matched).toBe(true)
        expect(matchExpectation('exact', { type: 'exact', expression: 'exact' }).matched).toBe(true)
        expect(matchExpectation('nope', 'missing').matched).toBe(false)
    })

    test('runTests runs using injected runFn and returns results', async () => {
        const mod = await import('../test-runner.js')
        const { runTests } = mod
        const fakeRun = async (t) => ({ stdout: 'ok:' + (t.id || ''), stderr: '', durationMs: 1 })
        const results = await runTests([{ id: 't1', expected_stdout: 'ok' }], { runFn: fakeRun })
        expect(results.length).toBe(1)
        expect(results[0].passed).toBe(true)
    })
})
