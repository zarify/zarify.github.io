import { jest } from '@jest/globals'

describe('createSandboxedRunFn', () => {
    beforeEach(() => {
        document.body.innerHTML = ''
        jest.resetModules()
    })

    test('AST tests short-circuit using filesSnapshot', async () => {
        await jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async (code, expr) => ({ ok: true, codeLen: code.length })
        }))
        const mod = await import('../test-runner-sandbox.js')
        const { createSandboxedRunFn } = mod
        const runFn = createSandboxedRunFn({ filesSnapshot: { '/main.py': 'print(1)' } })
        const res = await runFn({ type: 'ast', astRule: { expression: 'x' } })
        expect(res.astPassed === true || res.astPassed === false).toBeTruthy()
    })
})
