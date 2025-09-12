import { jest } from '@jest/globals'

/**
 * @jest-environment jsdom
 */

describe('ASTAnalyzer basic behaviors', () => {
    beforeEach(() => {
        jest.resetModules()
    })

    test('parse valid code and count functions', async () => {
        const mod = await import('../ast-analyzer.js')
        const { ASTAnalyzer } = mod
        const a = new ASTAnalyzer()
        await a.initialize()

        const code = `def foo(x):\n    return x\n\ndef bar():\n    return foo(1)\n`
        const ast = await a.parse(code)
        expect(ast).toBeTruthy()

        const fc = a.analyze(ast, 'function_count:')
        expect(fc).toBeTruthy()
        expect(fc.count).toBeGreaterThanOrEqual(2)
        expect(Array.isArray(fc.functions)).toBe(true)
        const names = fc.functions.map(f => f.name)
        expect(names).toEqual(expect.arrayContaining(['foo', 'bar']))
    })

    test('detect function existence and call sites', async () => {
        const mod = await import('../ast-analyzer.js')
        const { getASTAnalyzer } = mod
        const a = await getASTAnalyzer()

        const code = `def foo():\n    pass\n\ndef baz():\n    foo()\n    foo()\n`
        const ast = await a.parse(code)
        const res = a.analyze(ast, 'function_exists:foo')
        expect(res).toBeTruthy()
        expect(res.name).toBe('foo')
        expect(res.parameters).toBe(0)
        // called lines should include the callers
        expect(Array.isArray(res.called)).toBe(true)
        expect(res.called.length).toBeGreaterThanOrEqual(1)
    })

    test('variable analysis detects assignments, usages and modifications', async () => {
        const mod = await import('../ast-analyzer.js')
        const { ASTAnalyzer } = mod
        const a = new ASTAnalyzer()
        await a.initialize()

        const code = `x = 1\nx += 2\nprint(x)\n`
        const ast = await a.parse(code)
        const r = a.analyze(ast, 'variable_usage:x')
        expect(r).toBeTruthy()
        expect(r.assigned).toBe(true)
        expect(r.used).toBe(true)
        expect(r.modified).toBe(true)
        expect(Array.isArray(r.assignments)).toBe(true)
        expect(Array.isArray(r.usages)).toBe(true)
    })

    test('analyze imports returns imports list', async () => {
        const mod = await import('../ast-analyzer.js')
        const { ASTAnalyzer } = mod
        const a = new ASTAnalyzer()
        await a.initialize()

        const code = `import os\nfrom sys import path, argv\n`
        const ast = await a.parse(code)
        const imp = a.analyze(ast, 'import_statements:*')
        expect(imp).toBeTruthy()
        expect(imp.count).toBeGreaterThanOrEqual(2)
        expect(Array.isArray(imp.imports)).toBe(true)
    })

    test('parse invalid code returns null', async () => {
        const mod = await import('../ast-analyzer.js')
        const { ASTAnalyzer } = mod
        const a = new ASTAnalyzer()
        await a.initialize()

        const bad = `def \n  `
        const ast = await a.parse(bad)
        expect(ast).toBeNull()
    })

    test('comprehensions are detected and target filtering works', async () => {
        const mod = await import('../ast-analyzer.js')
        const { ASTAnalyzer } = mod
        const a = new ASTAnalyzer()
        await a.initialize()

        const code = `squares = [x*x for x in range(10)]\ngen = (i for i in range(5))\n`
        const ast = await a.parse(code)
        const compsAll = a.analyze(ast, 'comprehensions:*')
        expect(compsAll).toBeTruthy()
        expect(compsAll.count).toBeGreaterThanOrEqual(1)

        // filter by target 'x' should find list comprehension
        const compsX = a.analyze(ast, 'comprehensions:x')
        expect(compsX).toBeTruthy()
        expect(compsX.count).toBeGreaterThanOrEqual(1)
    })

    test('magic numbers and long strings are reported by magic number analyzer', async () => {
        const mod = await import('../ast-analyzer.js')
        const { ASTAnalyzer } = mod
        const a = new ASTAnalyzer()
        await a.initialize()

        const code = `val = 9999\nmsg = """This is a very long string used in code to test detection"""\nsmall = 1\n`
        const ast = await a.parse(code)
        const mag = a.analyze(ast, 'magic_numbers:10')
        expect(mag).toBeTruthy()
        expect(mag.count).toBeGreaterThanOrEqual(1)
        expect(mag.magicNumbers.some(m => m.value === 9999)).toBe(true)
    })

    test('exception handling analysis indicates calls within try blocks', async () => {
        const mod = await import('../ast-analyzer.js')
        const { ASTAnalyzer } = mod
        const a = new ASTAnalyzer()
        await a.initialize()

        const code = `try:\n    dangerous()\nexcept Exception as e:\n    handle(e)\n`
        const ast = await a.parse(code)
        const res = a.analyze(ast, 'exception_handling:dangerous')
        expect(res).toBeTruthy()
        // withinTry should be true because dangerous() is inside try
        expect(res.withinTry).toBe(true)
        expect(Array.isArray(res.tryBlocks)).toBe(true)
    })

    test('class analysis extracts base classes, methods and docstrings', async () => {
        const mod = await import('../ast-analyzer.js')
        const { ASTAnalyzer } = mod
        const a = new ASTAnalyzer()
        await a.initialize()

        const code = `class Base:\n    """base doc"""\n    def b(self):\n        pass\n\nclass Child(Base):\n    def __init__(self):\n        """init doc"""\n        pass\n`
        const ast = await a.parse(code)
        const classes = a.analyze(ast, 'class_analysis:*')
        expect(classes).toBeTruthy()
        expect(classes.count).toBeGreaterThanOrEqual(2)
        const child = a.analyze(ast, 'class_analysis:Child')
        expect(child).toBeTruthy()
        expect(child.baseClasses).toContain('Base')
        expect(child.methods && child.methodCount >= 1).toBe(true)
    })

    test('docstring checker and complexity calculator return expected shapes', async () => {
        const mod = await import('../ast-analyzer.js')
        const { ASTAnalyzer } = mod
        const a = new ASTAnalyzer()
        await a.initialize()

        const code = `def f():\n    """doc"""\n    if True:\n        for i in range(3):\n            pass\n`
        const ast = await a.parse(code)
        const doc = a.analyze(ast, 'code_quality:has_docstring')
        expect(doc).toBeTruthy()
        // doc.details contains per-node summaries; functions.withDocstring counts functions with docstrings
        expect(doc.details && doc.details.length > 0).toBe(true)
        expect(doc.functions && doc.functions.withDocstring >= 1).toBe(true)

        const complexity = a.analyze(ast, 'code_quality:complexity')
        // complexity may be nested under generalQualityCheck; allow both shapes
        if (complexity && complexity.complexity) {
            expect(typeof complexity.complexity).toBe('number')
        } else {
            const gq = a.analyze(ast, 'general')
            // fallback case: call calculateComplexity directly
            const c = a.calculateComplexity(ast)
            expect(c).toBeTruthy()
            expect(typeof c.complexity).toBe('number')
        }
    })

    test('genericQuery finds Call nodes', async () => {
        const mod = await import('../ast-analyzer.js')
        const { ASTAnalyzer } = mod
        const a = new ASTAnalyzer()
        await a.initialize()

        const code = `print(1)\nfoo(2)\n`
        const ast = await a.parse(code)
        const calls = a.genericQuery(ast, 'Call')
        expect(calls).toBeTruthy()
        expect(calls.count).toBeGreaterThanOrEqual(2)
    })

})
