import { jest } from '@jest/globals'

describe('logger.js', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
    })

    test('warn and error always call console.warn/error', async () => {
        const mod = await import('../logger.js')
        const spyWarn = jest.spyOn(console, 'warn').mockImplementation(() => { })
        const spyErr = jest.spyOn(console, 'error').mockImplementation(() => { })

        mod.warn('w')
        mod.error('e')

        expect(spyWarn).toHaveBeenCalled()
        expect(spyErr).toHaveBeenCalled()

        spyWarn.mockRestore()
        spyErr.mockRestore()
    })

    test('debug and info respect window.__SSG_DEBUG flag', async () => {
        const mod = await import('../logger.js')
        const spyDbg = jest.spyOn(console, 'debug').mockImplementation(() => { })
        const spyLog = jest.spyOn(console, 'log').mockImplementation(() => { })

        // ensure disabled by default
        if (typeof window !== 'undefined') delete window.__SSG_DEBUG
        mod.debug('x')
        mod.info('y')
        expect(spyDbg).not.toHaveBeenCalled()
        expect(spyLog).not.toHaveBeenCalled()

        // enable and check
        mod.setDebug(true)
        mod.debug('x')
        mod.info('y')
        // debug prefers console.debug but falls back to log; either may be called
        expect(spyDbg.mock.calls.length + spyLog.mock.calls.length).toBeGreaterThan(0)

        spyDbg.mockRestore()
        spyLog.mockRestore()
    })
})
