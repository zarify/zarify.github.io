import { jest } from '@jest/globals'

describe('AST matcher auto-eval', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
        try { delete window.__ssg_mem } catch (_) { }
    })

    test('auto-evaluate sets nonBoolean dataset when matcher returns non-boolean truthy', async () => {
        // Mock analyzer and logger so auto-eval doesn't try to call real analysis
        jest.unstable_mockModule('../ast-analyzer.js', () => ({ analyzeCode: async () => ({ name: 'M' }), getASTAnalyzer: async () => ({ parse: async () => ({}), analyze: () => null }) }))
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))

        const mod = await import('../ast-rule-builder.js')
        const { createASTRuleBuilder } = mod

        // Provide an existing pattern with matcher that returns a non-boolean truthy value
        const existing = { expression: 'function_exists:do', matcher: "({ matched: true })" }
        const builder = createASTRuleBuilder(existing, 'feedback')
        document.body.appendChild(builder.root)

        // Wait longer than the auto-eval initial delay (250ms) to allow evaluation
        await new Promise(r => setTimeout(r, 400))

        const resultEl = builder.root.querySelector('.test-result')
        expect(resultEl).toBeTruthy()
        // dataset flag should be set
        expect(resultEl.dataset.nonBoolean).toBeDefined()
        expect(resultEl.dataset.nonBoolean).toBe('1')
        // textual indication should mention non-boolean
        expect(resultEl.textContent).toMatch(/non-boolean/i)
    })
})
