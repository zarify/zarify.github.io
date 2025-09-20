/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'

describe('ASTAnalyzer function_calls analysis', () => {
    beforeEach(() => {
        jest.resetModules()
    })

    test('aggregate function_calls returns print and user functions', async () => {
        const mod = await import('../ast-analyzer.js')
        const { ASTAnalyzer } = mod
        const a = new ASTAnalyzer()
        await a.initialize()

        const code = `def foo():\n    print('hi')\n\ndef bar():\n    foo()\n    print('x')\nprint('done')\n`
        const ast = await a.parse(code)
        const res = a.analyze(ast, 'function_calls')
        expect(res).toBeTruthy()
        expect(res.count).toBeGreaterThanOrEqual(2)
        const names = res.functions.map(f => f.name).filter(Boolean)
        // only functions that are actually called should appear
        expect(names).toEqual(expect.arrayContaining(['print', 'foo']))

        const printEntry = res.functions.find(f => f.name === 'print')
        expect(printEntry).toBeTruthy()
        expect(printEntry.count).toBeGreaterThanOrEqual(3)
        expect(Array.isArray(printEntry.lines)).toBe(true)
    })

    test('target-specific function_calls: builtin print', async () => {
        const mod = await import('../ast-analyzer.js')
        const { getASTAnalyzer } = mod
        const a = await getASTAnalyzer()

        const code = `print(1)\nprint(2)\n`
        const ast = await a.parse(code)
        const res = a.analyze(ast, 'function_calls:print')
        expect(res).toBeTruthy()
        expect(res.name).toBe('print')
        expect(res.count).toBe(2)
        expect(res.isBuiltin).toBe(true)
        expect(Array.isArray(res.lines)).toBe(true)
    })

    test('target-specific function_calls: user-defined but not called', async () => {
        const mod = await import('../ast-analyzer.js')
        const { ASTAnalyzer } = mod
        const a = new ASTAnalyzer()
        await a.initialize()

        const code = `def lonely():\n    pass\n`
        const ast = await a.parse(code)
        const res = a.analyze(ast, 'function_calls:lonely')
        // defined but not called should return object with count 0
        expect(res).toBeTruthy()
        expect(res.name).toBe('lonely')
        expect(res.count).toBe(0)
        expect(res.defined).toBeTruthy()
        expect(res.defined.parameters).toBe(0)
    })

    test('attribute calls produce qualified names', async () => {
        const mod = await import('../ast-analyzer.js')
        const { ASTAnalyzer } = mod
        const a = new ASTAnalyzer()
        await a.initialize()

        const code = `class C:\n    def m(self):\n        pass\n\nc = C()\nc.m()\n`
        const ast = await a.parse(code)
        const res = a.analyze(ast, 'function_calls')
        expect(res).toBeTruthy()
        // Expect something like 'c.m' or 'C.m' or similar qualified name to appear
        const names = res.functions.map(f => f.name).filter(Boolean)
        // at least one name should contain a dot for attribute
        expect(names.some(n => n.includes('.'))).toBe(true)
    })
})
