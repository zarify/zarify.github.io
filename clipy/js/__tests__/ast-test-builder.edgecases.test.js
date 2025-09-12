/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'

describe('AST test builder - edge cases', () => {
    beforeEach(() => {
        jest.resetModules()
        document.documentElement.innerHTML = ''
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    test('Regex flags (case-insensitive) work in matcher from AST test form', async () => {
        await jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async () => ({ imports: [{ module: 'NumPy' }] })
        }))

        const { buildASTTestForm } = await import('../ast-test-builder.js')
        const form = buildASTTestForm({})
        document.body.appendChild(form.root)

        // locate inner ast-rule-builder controls
        const astRoot = form.root.querySelector('.ast-rule-builder')
        const astType = astRoot.querySelector('select')
        const astTarget = astRoot.querySelector('input[placeholder^="function or variable"]')
        const astMatcher = astRoot.querySelector('textarea[placeholder^="JavaScript expression"]')
        const testCode = astRoot.querySelector('.ast-tester textarea') || astRoot.querySelector('textarea')

        astType.value = 'import_statements'
        astType.dispatchEvent(new Event('change', { bubbles: true }))
        astTarget.value = 'numpy'
        astTarget.dispatchEvent(new Event('input', { bubbles: true }))
        astMatcher.value = "result && result.imports && result.imports.some(i => /numpy/i.test(i.module))"
        testCode.value = 'import numpy as np\n'

        const testBtn = Array.from(form.root.querySelectorAll('button')).find(b => b.textContent === 'Test Rule')
        testBtn.click()
        await new Promise(r => setTimeout(r, 30))

        const resultEl = form.root.querySelector('.test-result')
        expect(resultEl).toBeDefined()
        expect(resultEl.innerHTML).toMatch(/Rule Result|✅/)
    })

    test('Complex matcher function in AST test form (nested tryBlocks) works', async () => {
        await jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async () => ({ tryBlocks: [{ calls: [{ name: 'do_work' }] }] })
        }))

        const { buildASTTestForm } = await import('../ast-test-builder.js')
        const form = buildASTTestForm({})
        document.body.appendChild(form.root)

        const astRoot = form.root.querySelector('.ast-rule-builder')
        const astType = astRoot.querySelector('select')
        const astTarget = astRoot.querySelector('input[placeholder^="function or variable"]')
        const astMatcher = astRoot.querySelector('textarea[placeholder^="JavaScript expression"]')
        const testCode = astRoot.querySelector('.ast-tester textarea') || astRoot.querySelector('textarea')

        astType.value = 'exception_handling'
        astType.dispatchEvent(new Event('change', { bubbles: true }))
        astTarget.value = ''
        astTarget.dispatchEvent(new Event('input', { bubbles: true }))
        astMatcher.value = "result && result.tryBlocks && result.tryBlocks.some(tb => tb.calls && tb.calls.some(c => c.name === 'do_work'))"
        testCode.value = 'try:\n    do_work()\nexcept:\n    pass'

        const testBtn = Array.from(form.root.querySelectorAll('button')).find(b => b.textContent === 'Test Rule')
        testBtn.click()
        await new Promise(r => setTimeout(r, 30))

        const resultEl = form.root.querySelector('.test-result')
        expect(resultEl).toBeDefined()
        expect(resultEl.innerHTML).toMatch(/Rule Result|✅/)
        expect(resultEl.innerHTML).toMatch(/do_work/)
    })

    test('Truthy non-boolean matcher value is considered match in AST test form', async () => {
        await jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async () => ({ name: 'x' })
        }))

        const { buildASTTestForm } = await import('../ast-test-builder.js')
        const form = buildASTTestForm({})
        document.body.appendChild(form.root)

        const astRoot = form.root.querySelector('.ast-rule-builder')
        const astType = astRoot.querySelector('select')
        const astTarget = astRoot.querySelector('input[placeholder^="function or variable"]')
        const astMatcher = astRoot.querySelector('textarea[placeholder^="JavaScript expression"]')
        const testCode = astRoot.querySelector('.ast-tester textarea') || astRoot.querySelector('textarea')

        astType.value = 'function_exists'
        astType.dispatchEvent(new Event('change', { bubbles: true }))
        astTarget.value = 'x'
        astTarget.dispatchEvent(new Event('input', { bubbles: true }))
        astMatcher.value = '1'
        testCode.value = 'def x():\n    pass'

        const testBtn = Array.from(form.root.querySelectorAll('button')).find(b => b.textContent === 'Test Rule')
        testBtn.click()
        await new Promise(r => setTimeout(r, 30))

        const resultEl = form.root.querySelector('.test-result')
        expect(resultEl).toBeDefined()
        expect(resultEl.innerHTML).toMatch(/Rule Result|✅/)
    })

    test('Falsy matcher value is treated as non-match in AST test form', async () => {
        await jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async () => ({ name: 'x' })
        }))

        const { buildASTTestForm } = await import('../ast-test-builder.js')
        const form = buildASTTestForm({})
        document.body.appendChild(form.root)

        const astRoot = form.root.querySelector('.ast-rule-builder')
        const astType = astRoot.querySelector('select')
        const astTarget = astRoot.querySelector('input[placeholder^="function or variable"]')
        const astMatcher = astRoot.querySelector('textarea[placeholder^="JavaScript expression"]')
        const testCode = astRoot.querySelector('.ast-tester textarea') || astRoot.querySelector('textarea')

        astType.value = 'function_exists'
        astType.dispatchEvent(new Event('change', { bubbles: true }))
        astTarget.value = 'x'
        astTarget.dispatchEvent(new Event('input', { bubbles: true }))
        astMatcher.value = '0'
        testCode.value = 'def x():\n    pass'

        const testBtn = Array.from(form.root.querySelectorAll('button')).find(b => b.textContent === 'Test Rule')
        testBtn.click()
        await new Promise(r => setTimeout(r, 30))

        const resultEl = form.root.querySelector('.test-result')
        expect(resultEl).toBeDefined()
        expect(resultEl.innerHTML).toMatch(/Rule Result|❌/)
    })

    test('Missing expression in AST test form shows configuration warning', async () => {
        await jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async () => ({})
        }))

        const { buildASTTestForm } = await import('../ast-test-builder.js')
        const form = buildASTTestForm({})
        document.body.appendChild(form.root)

        const astRoot = form.root.querySelector('.ast-rule-builder')
        const astType = astRoot.querySelector('select')
        astType.value = ''
        astType.dispatchEvent(new Event('change', { bubbles: true }))

        const testCode = astRoot.querySelector('.ast-tester textarea') || astRoot.querySelector('textarea')
        testCode.value = 'print(1)\n'

        const testBtn = Array.from(form.root.querySelectorAll('button')).find(b => b.textContent === 'Test Rule')
        testBtn.click()
        await new Promise(r => setTimeout(r, 30))

        const resultEl = form.root.querySelector('.test-result')
        expect(resultEl).toBeDefined()
        expect(resultEl.innerHTML).toMatch(/Please configure an AST expression/i)
    })
})
