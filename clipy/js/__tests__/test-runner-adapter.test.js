import { jest } from '@jest/globals'

describe('createRunFn (adapter)', () => {
    beforeEach(() => {
        jest.resetModules()
    })

    test('throws when getFileManager is missing', async () => {
        const mod = await import('../test-runner-adapter.js')
        const { createRunFn } = mod
        expect(() => createRunFn({})).toThrow('getFileManager required')
    })

    test('AST short-circuits and returns astResult/astPassed', async () => {
        await jest.unstable_mockModule('../ast-analyzer.js', () => ({
            analyzeCode: async (code, expr) => ({ analyzed: true, codeSample: code, expr })
        }))

        const mod = await import('../test-runner-adapter.js')
        const { createRunFn } = mod

        const fm = {
            read: (p) => 'print(42)',
            list: () => ['/main.py'],
            write: async () => { },
            delete: async () => { }
        }

        const runFn = createRunFn({ getFileManager: () => fm, MAIN_FILE: '/main.py', runPythonCode: async () => { }, getConfig: () => ({}) })

        const t = { astRule: { expression: 'x' } }
        const res = await runFn(t)
        expect(res.astResult).toMatchObject({ analyzed: true })
        expect(res.astPassed).toBe(true)
    })
})
