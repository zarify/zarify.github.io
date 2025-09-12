import { jest } from '@jest/globals'

describe('feedback.validateConfig tests', () => {
    beforeEach(() => {
        jest.resetModules()
    })

    test('validateConfig throws on non-object', async () => {
        const mod = await import('../feedback.js')
        const { validateConfig } = mod
        expect(() => validateConfig(null)).toThrow()
        expect(() => validateConfig('string')).toThrow()
    })

    test('validateConfig throws when feedback item missing fields', async () => {
        const mod = await import('../feedback.js')
        const { validateConfig } = mod
        const bad = { feedback: [{ id: 'x' }] }
        expect(() => validateConfig(bad)).toThrow()
    })

    test('validateConfig throws on unsupported pattern.type or target', async () => {
        const mod = await import('../feedback.js')
        const { validateConfig } = mod
        const badType = { feedback: [{ id: 'a', title: 't', when: ['edit'], pattern: { type: 'weird', target: 'code', expression: '' } }] }
        const badTarget = { feedback: [{ id: 'b', title: 't', when: ['edit'], pattern: { type: 'string', target: 'weird', expression: '' } }] }
        expect(() => validateConfig(badType)).toThrow()
        expect(() => validateConfig(badTarget)).toThrow()
    })

    test('validateConfig accepts valid minimal config', async () => {
        const mod = await import('../feedback.js')
        const { validateConfig } = mod
        const ok = { feedback: [{ id: 'ok', title: 't', when: ['edit'], pattern: { type: 'string', target: 'code', expression: 'x' } }] }
        expect(() => validateConfig(ok)).not.toThrow()
    })
})
