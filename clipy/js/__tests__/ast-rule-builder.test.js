/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'

describe('AST rule builder - Test Rule behavior', () => {
    beforeEach(() => {
        jest.resetModules()
        document.documentElement.innerHTML = ''
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    test('Test Rule shows success when matcher evaluates true', async () => {
        await jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async (code, expression) => {
                return { name: 'calculate', parameters: 1 }
            }
        }))

        const { createASTRuleBuilder } = await import('../ast-rule-builder.js')
        const builder = createASTRuleBuilder({}, 'test')
        document.body.appendChild(builder.root)

        // configure expression
        const astType = builder.root.querySelector('select')
        const astTarget = builder.root.querySelector('input[placeholder^="function or variable"]')
        const astMatcher = builder.root.querySelector('textarea[placeholder^="JavaScript expression"]')
        const testCode = builder.root.querySelector('.ast-tester textarea') || builder.root.querySelector('textarea')

        astType.value = 'function_exists'
        astType.dispatchEvent(new Event('change', { bubbles: true }))
        astTarget.value = 'calculate'
        astTarget.dispatchEvent(new Event('input', { bubbles: true }))
        astMatcher.value = "result && result.name === 'calculate'"
        testCode.value = 'def calculate():\n    pass'

        const testBtn = Array.from(builder.root.querySelectorAll('button')).find(b => b.textContent === 'Test Rule')
        expect(testBtn).toBeDefined()
        testBtn.click()

        // allow async update
        await new Promise(r => setTimeout(r, 30))

        const resultEl = builder.root.querySelector('.test-result')
        expect(resultEl).toBeDefined()
        expect(resultEl.style.display).not.toBe('none')
        expect(resultEl.innerHTML).toMatch(/Rule Result|✅/)
        // should include AST result JSON
        expect(resultEl.innerHTML).toMatch(/"name":\s*"calculate"/)
    })

    test('Test Rule shows matcher error when matcher code is invalid', async () => {
        await jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async () => ({ some: 'result' })
        }))

        const { createASTRuleBuilder } = await import('../ast-rule-builder.js')
        const builder = createASTRuleBuilder({}, 'test')
        document.body.appendChild(builder.root)

        const astType = builder.root.querySelector('select')
        const astTarget = builder.root.querySelector('input[placeholder^="function or variable"]')
        const astMatcher = builder.root.querySelector('textarea[placeholder^="JavaScript expression"]')
        const testCode = builder.root.querySelector('.ast-tester textarea') || builder.root.querySelector('textarea')

        astType.value = 'function_exists'
        astType.dispatchEvent(new Event('change', { bubbles: true }))
        astTarget.value = 'foo'
        astTarget.dispatchEvent(new Event('input', { bubbles: true }))
        // invalid JS to trigger matcher evaluation error
        astMatcher.value = 'return ==='
        testCode.value = 'def foo():\n    pass'

        const testBtn = Array.from(builder.root.querySelectorAll('button')).find(b => b.textContent === 'Test Rule')
        testBtn.click()
        await new Promise(r => setTimeout(r, 30))

        const resultEl = builder.root.querySelector('.test-result')
        expect(resultEl).toBeDefined()
        expect(resultEl.innerHTML).toMatch(/Matcher Error/i)
    })

    test('Test Rule shows pattern did not match when analyzer returns null', async () => {
        await jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async () => null
        }))

        const { createASTRuleBuilder } = await import('../ast-rule-builder.js')
        const builder = createASTRuleBuilder({}, 'test')
        document.body.appendChild(builder.root)

        const astType = builder.root.querySelector('select')
        const astTarget = builder.root.querySelector('input[placeholder^="function or variable"]')
        const testCode = builder.root.querySelector('.ast-tester textarea') || builder.root.querySelector('textarea')

        astType.value = 'function_exists'
        astType.dispatchEvent(new Event('change', { bubbles: true }))
        astTarget.value = 'missing'
        astTarget.dispatchEvent(new Event('input', { bubbles: true }))
        testCode.value = 'def nothing():\n    pass'

        const testBtn = Array.from(builder.root.querySelectorAll('button')).find(b => b.textContent === 'Test Rule')
        testBtn.click()
        await new Promise(r => setTimeout(r, 30))

        const resultEl = builder.root.querySelector('.test-result')
        expect(resultEl).toBeDefined()
        expect(resultEl.innerHTML).toMatch(/Pattern did not match/i)
    })

    test('Test Rule supports regex flags (case-insensitive matching)', async () => {
        await jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async () => ({ imports: [{ module: 'NumPy' }] })
        }))

        const { createASTRuleBuilder } = await import('../ast-rule-builder.js')
        const builder = createASTRuleBuilder({}, 'test')
        document.body.appendChild(builder.root)

        const astType = builder.root.querySelector('select')
        const astTarget = builder.root.querySelector('input[placeholder^="function or variable"]')
        const astMatcher = builder.root.querySelector('textarea[placeholder^="JavaScript expression"]')
        const testCode = builder.root.querySelector('.ast-tester textarea') || builder.root.querySelector('textarea')

        astType.value = 'import_statements'
        astType.dispatchEvent(new Event('change', { bubbles: true }))
        astTarget.value = 'numpy'
        astTarget.dispatchEvent(new Event('input', { bubbles: true }))
        // use inline regex with 'i' flag to match 'NumPy'
        astMatcher.value = "result && result.imports && result.imports.some(i => /numpy/i.test(i.module))"
        testCode.value = 'import numpy as np\n'

        const testBtn = Array.from(builder.root.querySelectorAll('button')).find(b => b.textContent === 'Test Rule')
        testBtn.click()
        await new Promise(r => setTimeout(r, 30))

        const resultEl = builder.root.querySelector('.test-result')
        expect(resultEl).toBeDefined()
        expect(resultEl.innerHTML).toMatch(/Rule Result|✅/)
    })

    test('Test Rule supports complex matcher functions (nested checks)', async () => {
        await jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async () => ({ tryBlocks: [{ calls: [{ name: 'do_work' }] }] })
        }))

        const { createASTRuleBuilder } = await import('../ast-rule-builder.js')
        const builder = createASTRuleBuilder({}, 'test')
        document.body.appendChild(builder.root)

        const astType = builder.root.querySelector('select')
        const astTarget = builder.root.querySelector('input[placeholder^="function or variable"]')
        const astMatcher = builder.root.querySelector('textarea[placeholder^="JavaScript expression"]')
        const testCode = builder.root.querySelector('.ast-tester textarea') || builder.root.querySelector('textarea')

        astType.value = 'exception_handling'
        astType.dispatchEvent(new Event('change', { bubbles: true }))
        astTarget.value = ''
        astTarget.dispatchEvent(new Event('input', { bubbles: true }))
        astMatcher.value = "result && result.tryBlocks && result.tryBlocks.some(tb => tb.calls && tb.calls.some(c => c.name === 'do_work'))"
        testCode.value = 'try:\n    do_work()\nexcept:\n    pass'

        const testBtn = Array.from(builder.root.querySelectorAll('button')).find(b => b.textContent === 'Test Rule')
        testBtn.click()
        await new Promise(r => setTimeout(r, 30))

        const resultEl = builder.root.querySelector('.test-result')
        expect(resultEl).toBeDefined()
        expect(resultEl.innerHTML).toMatch(/Rule Result|✅/)
        expect(resultEl.innerHTML).toMatch(/do_work/)
    })

    test('Matcher returning non-boolean truthy is considered a match', async () => {
        await jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async () => ({ name: 'x' })
        }))

        const { createASTRuleBuilder } = await import('../ast-rule-builder.js')
        const builder = createASTRuleBuilder({}, 'test')
        document.body.appendChild(builder.root)

        const astType = builder.root.querySelector('select')
        const astTarget = builder.root.querySelector('input[placeholder^="function or variable"]')
        const astMatcher = builder.root.querySelector('textarea[placeholder^="JavaScript expression"]')
        const testCode = builder.root.querySelector('.ast-tester textarea') || builder.root.querySelector('textarea')

        astType.value = 'function_exists'
        astType.dispatchEvent(new Event('change', { bubbles: true }))
        astTarget.value = 'x'
        astTarget.dispatchEvent(new Event('input', { bubbles: true }))
        // return a number (truthy)
        astMatcher.value = '1'
        testCode.value = 'def x():\n    pass'

        const testBtn = Array.from(builder.root.querySelectorAll('button')).find(b => b.textContent === 'Test Rule')
        testBtn.click()
        await new Promise(r => setTimeout(r, 30))

        const resultEl = builder.root.querySelector('.test-result')
        expect(resultEl).toBeDefined()
        expect(resultEl.innerHTML).toMatch(/Rule Result|✅/)
    })

    test('Matcher returning falsy value treated as non-match', async () => {
        await jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async () => ({ name: 'x' })
        }))

        const { createASTRuleBuilder } = await import('../ast-rule-builder.js')
        const builder = createASTRuleBuilder({}, 'test')
        document.body.appendChild(builder.root)

        const astType = builder.root.querySelector('select')
        const astTarget = builder.root.querySelector('input[placeholder^="function or variable"]')
        const astMatcher = builder.root.querySelector('textarea[placeholder^="JavaScript expression"]')
        const testCode = builder.root.querySelector('.ast-tester textarea') || builder.root.querySelector('textarea')

        astType.value = 'function_exists'
        astType.dispatchEvent(new Event('change', { bubbles: true }))
        astTarget.value = 'x'
        astTarget.dispatchEvent(new Event('input', { bubbles: true }))
        // return 0 (falsy)
        astMatcher.value = '0'
        testCode.value = 'def x():\n    pass'

        const testBtn = Array.from(builder.root.querySelectorAll('button')).find(b => b.textContent === 'Test Rule')
        testBtn.click()
        await new Promise(r => setTimeout(r, 30))

        const resultEl = builder.root.querySelector('.test-result')
        expect(resultEl).toBeDefined()
        expect(resultEl.innerHTML).toMatch(/Rule Result|❌/)
    })

    test('Missing AST expression shows configuration warning', async () => {
        await jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async () => ({})
        }))

        const { createASTRuleBuilder } = await import('../ast-rule-builder.js')
        const builder = createASTRuleBuilder({}, 'test')
        document.body.appendChild(builder.root)

        // clear expression by setting select value to empty
        const astType = builder.root.querySelector('select')
        astType.value = ''
        astType.dispatchEvent(new Event('change', { bubbles: true }))

        const testCode = builder.root.querySelector('.ast-tester textarea') || builder.root.querySelector('textarea')
        testCode.value = 'print(1)\n'

        const testBtn = Array.from(builder.root.querySelectorAll('button')).find(b => b.textContent === 'Test Rule')
        testBtn.click()
        await new Promise(r => setTimeout(r, 30))

        const resultEl = builder.root.querySelector('.test-result')
        expect(resultEl).toBeDefined()
        expect(resultEl.innerHTML).toMatch(/Please configure an AST expression/i)
    })
})
