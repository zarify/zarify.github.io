import { jest } from '@jest/globals'

describe('feedback edge-case tests', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
        // clear any global mem
        try { delete window.__ssg_mem } catch (_) { }
    })

    test('bad regex expression is ignored (no crash)', async () => {
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const cfg = { feedback: [{ id: 'badre', title: 't', when: ['edit'], pattern: { type: 'regex', target: 'code', expression: '[unclosed(' }, message: 'm', severity: 'info' }] }
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit } = mod
        resetFeedback(cfg)
        const res = await evaluateFeedbackOnEdit('some text with [unclosed(', '/main.py')
        expect(res).toBeDefined()
        expect(Array.isArray(res)).toBe(true)
        expect(res.length).toBe(0)
    })

    test('AST matcher creation failure is handled gracefully (no crash, no matches)', async () => {
        // analyzeCode returns a result but matcher is invalid JS so new Function will throw
        jest.unstable_mockModule('../ast-analyzer.js', () => ({ analyzeCode: async () => ({ foo: 1 }), getASTAnalyzer: async () => ({ parse: async () => ({}), analyze: () => null }) }))
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const cfg = { feedback: [{ id: 'astfail', title: 't', when: ['edit'], pattern: { type: 'ast', target: 'code', expression: 'expr', matcher: ')(bad syntax' }, message: 'm', severity: 'info' }] }
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit } = mod
        resetFeedback(cfg)
        const res = await evaluateFeedbackOnEdit('def x(): pass', '/main.py')
        expect(Array.isArray(res)).toBe(true)
        expect(res.length).toBe(0)
    })

    test('analyzeCode throwing is handled (no crash, no matches)', async () => {
        jest.unstable_mockModule('../ast-analyzer.js', () => ({ analyzeCode: async () => { throw new Error('boom') }, getASTAnalyzer: async () => ({ parse: async () => ({}), analyze: () => null }) }))
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const cfg = { feedback: [{ id: 'astex', title: 't', when: ['edit'], pattern: { type: 'ast', target: 'code', expression: 'expr' }, message: 'm', severity: 'info' }] }
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit } = mod
        resetFeedback(cfg)
        const res = await evaluateFeedbackOnEdit('def x(): pass', '/main.py')
        expect(Array.isArray(res)).toBe(true)
        expect(res.length).toBe(0)
    })

    test('fileTarget reads from window.__ssg_mem when FileManager absent', async () => {
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        // ensure no FileManager
        try { delete window.FileManager } catch (_) { }
        window.__ssg_mem = { '/other.py': 'hello from other' }
        const cfg = { feedback: [{ id: 'ft1', title: 't', when: ['edit'], pattern: { type: 'string', target: 'code', fileTarget: 'other.py', expression: 'hello from' }, message: 'm', severity: 'info' }] }
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit } = mod
        resetFeedback(cfg)
        const res = await evaluateFeedbackOnEdit('', '/main.py')
        expect(Array.isArray(res)).toBe(true)
        expect(res.length).toBe(1)
        expect(res[0].file).toBe('/other.py')
    })
})
