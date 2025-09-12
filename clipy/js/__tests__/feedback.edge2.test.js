import { jest } from '@jest/globals'

describe('feedback additional edge-case tests', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
        try { delete window.__ssg_mem } catch (_) { }
    })

    test('unsupported pattern.type is ignored', async () => {
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const cfg = { feedback: [{ id: 'u1', title: 't', when: ['edit'], pattern: { type: 'weird', target: 'code', expression: 'x' }, message: 'm', severity: 'info' }] }
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit } = mod
        resetFeedback(cfg)
        const res = await evaluateFeedbackOnEdit('x', '/main.py')
        expect(Array.isArray(res)).toBe(true)
        expect(res.length).toBe(0)
    })

    test('multiple listeners invoked and off removes specific listener', async () => {
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const cfg = { feedback: [{ id: 'f1', title: 't', when: ['edit'], pattern: { type: 'string', target: 'code', expression: 'hi' }, message: 'm', severity: 'info' }] }
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit, on, off } = mod
        resetFeedback(cfg)
        const a = jest.fn(); const b = jest.fn()
        on('matches', a); on('matches', b)
        await evaluateFeedbackOnEdit('hi all', '/main.py')
        expect(a).toHaveBeenCalled(); expect(b).toHaveBeenCalled()
        // remove b
        off('matches', b)
        a.mockReset(); b.mockReset()
        await evaluateFeedbackOnEdit('hi again', '/main.py')
        expect(a).toHaveBeenCalled(); expect(b).not.toHaveBeenCalled()
    })

    test('resetFeedback emits reset with normalized config payload', async () => {
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const mod = await import('../feedback.js')
        const { resetFeedback, on } = mod
        const cb = jest.fn()
        on('reset', cb)
        // legacy object shape
        const legacy = { feedback: { regex: [{ id: 'r1', title: 'r', pattern: 'x', when: ['edit'] }] } }
        resetFeedback(legacy)
        expect(cb).toHaveBeenCalled()
        const arg = cb.mock.calls[0][0]
        expect(arg && arg.config && Array.isArray(arg.config.feedback)).toBe(true)
    })

    test('regex flags (i) perform case-insensitive match', async () => {
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const cfg = { feedback: [{ id: 'fg1', title: 't', when: ['edit'], pattern: { type: 'regex', target: 'code', expression: 'hello', flags: 'i' }, message: 'm', severity: 'info' }] }
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit } = mod
        resetFeedback(cfg)
        const res = await evaluateFeedbackOnEdit('HeLLo world', '/main.py')
        expect(res.length).toBeGreaterThan(0)
    })

    test('AST matcher can return boolean true to allow match and false to block', async () => {
        // analyzer returns object with count so matcher can evaluate
        jest.unstable_mockModule('../ast-analyzer.js', () => ({ analyzeCode: async () => ({ count: 1 }), getASTAnalyzer: async () => ({ parse: async () => ({}), analyze: () => null }) }))
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit } = mod

        // matcher returns false -> no match
        resetFeedback({ feedback: [{ id: 'ma1', title: 't', when: ['edit'], pattern: { type: 'ast', target: 'code', expression: 'expr', matcher: 'false' }, message: 'm', severity: 'info' }] })
        const resFalse = await evaluateFeedbackOnEdit('code', '/main.py')
        expect(resFalse.length).toBe(0)

        // matcher returns result.count > 0 -> match
        resetFeedback({ feedback: [{ id: 'ma2', title: 't', when: ['edit'], pattern: { type: 'ast', target: 'code', expression: 'expr', matcher: 'result.count > 0' }, message: 'm', severity: 'info' }] })
        const resTrue = await evaluateFeedbackOnEdit('code', '/main.py')
        expect(resTrue.length).toBe(1)
    })

    test('evaluateFeedbackOnRun formats $1/$2 from regex groups in stdout/stderr', async () => {
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const cfg = { feedback: [{ id: 's1', title: 't', when: ['run'], pattern: { type: 'regex', target: 'stdout', expression: 'Value:\\s*(\\d+)\\s+(OK)', flags: '' }, message: 'num=$1 status=$2', severity: 'info' }] }
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnRun } = mod
        resetFeedback(cfg)
        const out = { stdout: 'Value: 42 OK\nOther' }
        const res = await evaluateFeedbackOnRun(out)
        expect(res.length).toBe(1)
        expect(res[0].message).toContain('num=42')
        expect(res[0].message).toContain('status=OK')
    })

})
