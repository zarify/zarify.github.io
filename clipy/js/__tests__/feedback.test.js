import { jest } from '@jest/globals'

describe('feedback unit tests', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
    })

    test('evaluateFeedbackOnEdit string pattern matching and event emit', async () => {
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const cfg = { feedback: [{ id: 'f1', title: 't', when: ['edit'], pattern: { type: 'string', target: 'code', expression: 'hello' }, message: 'msg', severity: 'info' }] }
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit, on, off } = mod

        resetFeedback(cfg)
        const cb = jest.fn()
        on('matches', cb)
        const res = await evaluateFeedbackOnEdit('hello world', '/main.py')
        expect(res.length).toBe(1)
        expect(res[0].id).toBe('f1')
        expect(cb).toHaveBeenCalled()
        off('matches', cb)
    })

    test('evaluateFeedbackOnEdit regex line matching returns line numbers', async () => {
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const cfg = { feedback: [{ id: 'f2', title: 't', when: ['edit'], pattern: { type: 'regex', target: 'code', expression: 'world' }, message: 'm', severity: 'info' }] }
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit } = mod
        resetFeedback(cfg)
        const code = 'line1\nhello world\nbye'
        const res = await evaluateFeedbackOnEdit(code, '/main.py')
        expect(res.length).toBeGreaterThan(0)
        expect(res[0].line).toBe(2)
    })

    test('evaluateFeedbackOnRun filename matching works for array and newline strings', async () => {
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const cfg = { feedback: [{ id: 'f3', title: 't', when: ['run'], pattern: { type: 'string', target: 'filename', expression: 'file1.py' }, message: 'm', severity: 'info' }] }
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnRun } = mod
        resetFeedback(cfg)
        const res1 = await evaluateFeedbackOnRun({ filename: ['file1.py'] })
        expect(res1.length).toBe(1)
        const res2 = await evaluateFeedbackOnRun({ filename: 'file2.py\nfile1.py' })
        expect(res2.length).toBe(1)
    })

    test('evaluateFeedback uses AST analyzer and formats message with groups', async () => {
        // Mock analyzeCode to return a shaped result
        jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async (text, expr) => ({ name: 'X', count: 2, functions: [{ name: 'f' }], details: [1] }),
            getASTAnalyzer: async () => ({ parse: async (c) => ({}), analyze: () => null })
        }))
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const cfg = { feedback: [{ id: 'f4', title: 't', when: ['edit'], pattern: { type: 'ast', target: 'code', expression: 'expr', matcher: '' }, message: 'found $1', severity: 'info' }] }
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit } = mod
        resetFeedback(cfg)
        const res = await evaluateFeedbackOnEdit('def foo(): pass', '/main.py')
        expect(res.length).toBe(1)
        expect(res[0].message).toContain('found')
    })
})
