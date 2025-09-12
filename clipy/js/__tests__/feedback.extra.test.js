import { jest } from '@jest/globals'

describe('feedback extra tests', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
        try { delete window.__ssg_mem } catch (_) { }
    })

    test('invalid regex flags are ignored and do not crash', async () => {
        // silence logger
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const cfg = { feedback: [{ id: 'badflags', title: 't', when: ['edit'], pattern: { type: 'regex', target: 'code', expression: 'hello', flags: 'z!' }, message: 'm', severity: 'info' }] }
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit } = mod
        resetFeedback(cfg)
        const res = await evaluateFeedbackOnEdit('hello world', '/main.py')
        // invalid flags should make the regex fail-to-construct and be ignored (no matches)
        expect(Array.isArray(res)).toBe(true)
        expect(res.length).toBe(0)
    })

    test('message placeholders beyond available groups are replaced with empty string', async () => {
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit } = mod
        // regex with two capture groups
        const cfg = { feedback: [{ id: 'gaps', title: 't', when: ['edit'], pattern: { type: 'regex', target: 'code', expression: "(a)(b)", flags: '' }, message: 'g1=$1 g2=$2 g3=$3', severity: 'info' }] }
        resetFeedback(cfg)
        const res = await evaluateFeedbackOnEdit('ab', '/main.py')
        expect(res.length).toBe(1)
        expect(res[0].message).toBe('g1=a g2=b g3=')
    })

    test('AST analysis result is converted to match-like groups and used in message formatting', async () => {
        // mock ast-analyzer to return a rich object
        jest.unstable_mockModule('../ast-analyzer.js', () => ({ analyzeCode: async () => ({ name: 'ModuleX', count: 2, functions: [{ name: 'f1' }, { name: 'f2' }], details: [{}, {}] }), getASTAnalyzer: async () => ({ parse: async () => ({}), analyze: () => null }) }))
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit } = mod
        // message uses $1..$5 to extract elements produced by _convertASTToMatch
        const cfg = { feedback: [{ id: 'ast1', title: 't', when: ['edit'], pattern: { type: 'ast', target: 'code', expression: 'expr' }, message: 'j=$1 name=$2 count=$3 funcs=$4 details=$5', severity: 'info' }] }
        resetFeedback(cfg)
        const res = await evaluateFeedbackOnEdit('def f(): pass', '/main.py')
        expect(res.length).toBe(1)
        const msg = res[0].message
        // basic sanity checks for expected substrings (ordering depends on implementation)
        expect(msg).toContain('j=')
        // current implementation produces these substrings (observe output ordering)
        expect(msg).toContain('j=ModuleX')
        expect(msg).toContain('name=2')
        expect(msg).toContain('count=f1, f2')
        expect(msg).toContain('funcs=2')
        expect(msg).toContain('details=')
    })
})
