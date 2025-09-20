/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'

describe('AST rule builder - function_calls test', () => {
    beforeEach(() => {
        jest.resetModules()
        document.documentElement.innerHTML = ''
    })

    test('Rule builder returns function_calls analysis for sample code', async () => {
        const { createASTRuleBuilder } = await import('../ast-rule-builder.js')
        const builder = createASTRuleBuilder({}, 'test')
        document.body.appendChild(builder.root)

        // configure expression to function_calls
        const astType = builder.root.querySelector('select')
        const astTarget = builder.root.querySelector('input[placeholder^="function or variable"]')
        const testCode = builder.root.querySelector('.ast-tester textarea') || builder.root.querySelector('textarea')

        astType.value = 'function_calls'
        astType.dispatchEvent(new Event('change', { bubbles: true }))
        astTarget.value = ''
        astTarget.dispatchEvent(new Event('input', { bubbles: true }))

        // user's snippet
        testCode.value = `def foo():\n    print("bar")\n\nprint(\"I'm going to call a function\")\nfoo()`

        const testBtn = Array.from(builder.root.querySelectorAll('button')).find(b => b.textContent === 'Test Rule')
        expect(testBtn).toBeDefined()
        testBtn.click()

        // allow async processing (analyzeCode runs asynchronously)
        await new Promise(r => setTimeout(r, 200))

        const resultEl = builder.root.querySelector('.test-result')
        expect(resultEl).toBeDefined()
        expect(resultEl.style.display).not.toBe('none')
        // should include AST result JSON with functions array and 'print' and 'foo'
        expect(resultEl.innerHTML).toMatch(/"functions"\s*:/)
        expect(resultEl.innerHTML).toMatch(/\"print\"|print\(/)
        expect(resultEl.innerHTML).toMatch(/\"foo\"|foo\(/)
    })
})
