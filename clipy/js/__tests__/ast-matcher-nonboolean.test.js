import { jest } from '@jest/globals'

describe('AST matcher non-boolean handling', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
        try { delete window.__ssg_mem } catch (_) { }
    })

    test('AST tester UI shows warning when matcher returns non-boolean truthy', async () => {
        // mock analyzeCode to return a sample object
        jest.unstable_mockModule('../ast-analyzer.js', () => ({ analyzeCode: async () => ({ name: 'M' }), getASTAnalyzer: async () => ({ parse: async () => ({}), analyze: () => null }) }))
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))

        const mod = await import('../ast-rule-builder.js')
        const { createASTRuleBuilder } = mod

        const builder = createASTRuleBuilder({})
        document.body.appendChild(builder.root)

        // fill code and matcher
        const textarea = builder.root.querySelector('textarea')
        const expr = builder.root.querySelector('input[readonly]')
        const matcher = builder.root.querySelector('textarea')
        // set code
        const codeArea = builder.root.querySelector('.ast-tester textarea')
        codeArea.value = 'def f(): pass'
        // set matcher to return non-boolean truthy value (object)
        matcher.value = "({ matched: true })"

        // click Test Rule button
        const btn = builder.root.querySelector('button')
        btn.click()

        // allow async test handler to complete
        await new Promise(r => setTimeout(r, 10))

        const resultEl = builder.root.querySelector('.test-result')
        expect(resultEl).toBeTruthy()
        expect(resultEl.textContent).toMatch(/non-boolean/i)
    })

    test('feedback.evaluateFeedbackOnEdit treats non-boolean truthy matcher as NO match', async () => {
        // matcher expression returns an object (truthy). analyzeCode returns some object.
        jest.unstable_mockModule('../ast-analyzer.js', () => ({ analyzeCode: async () => ({ count: 1 }), getASTAnalyzer: async () => ({ parse: async () => ({}), analyze: () => null }) }))
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))

        const cfg = { feedback: [{ id: 'astobj', title: 't', when: ['edit'], pattern: { type: 'ast', target: 'code', expression: 'expr', matcher: '({val: result.count})' }, message: 'm $1', severity: 'info' }] }
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit } = mod
        resetFeedback(cfg)
        const res = await evaluateFeedbackOnEdit('def f(): pass', '/main.py')
        // Now non-boolean truthy should be treated as no-match per policy
        expect(Array.isArray(res)).toBe(true)
        expect(res.length).toBe(0)
    })
})
