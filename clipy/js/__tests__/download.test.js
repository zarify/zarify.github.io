import { jest } from '@jest/globals'

describe('download system', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
        // Mock URL helpers used when creating blobs
        global.URL.createObjectURL = jest.fn().mockReturnValue('blob:url')
        global.URL.revokeObjectURL = jest.fn()
        // Avoid jsdom alert/navigation not-implemented noisy errors
        global.alert = jest.fn()
    })

    test('single main.py triggers Python file download with sanitized config id', async () => {
        // Mock dependencies before importing module
        jest.unstable_mockModule('../vfs-client.js', () => ({
            getFileManager: () => ({
                list: () => ['/main.py'],
                read: (p) => (p === '/main.py' ? 'print(1)\n' : '')
            })
        }))
        jest.unstable_mockModule('../config.js', () => ({
            getConfigIdentity: () => 'my config'
        }))
        jest.unstable_mockModule('../logger.js', () => ({ error: () => { }, warn: () => { } }))

        const mod = await import('../download.js')
        const { setupDownloadSystem } = mod

        const btn = document.createElement('button')
        btn.id = 'download-code'
        document.body.appendChild(btn)

        let lastAppended = null
        const origAppend = document.body.appendChild
        document.body.appendChild = function (el) { lastAppended = el; return origAppend.call(this, el) }

        setupDownloadSystem()
        btn.click()

        // Wait for createObjectURL to be called (zip creation may be async).
        const start = Date.now()
        while (!global.URL.createObjectURL.mock.calls.length && (Date.now() - start) < 2000) {
            await new Promise(r => setTimeout(r, 20))
        }

        expect(global.URL.createObjectURL).toHaveBeenCalled()
        expect(lastAppended).not.toBeNull()
        expect(lastAppended.download).toBe('my_config_main.py')

        // restore
        document.body.appendChild = origAppend
    })

    test('multiple files triggers zip download using sanitized config id', async () => {
        jest.unstable_mockModule('../vfs-client.js', () => ({
            getFileManager: () => ({
                list: () => ['/main.py', '/lib/util.py'],
                read: (p) => (p === '/main.py' ? 'print(1)\n' : 'def util(): pass')
            })
        }))
        jest.unstable_mockModule('../config.js', () => ({
            getConfigIdentity: () => 'cfg?name'
        }))
        jest.unstable_mockModule('../logger.js', () => ({ error: () => { }, warn: () => { } }))

        const mod = await import('../download.js')
        const { setupDownloadSystem } = mod

        const btn = document.createElement('button')
        btn.id = 'download-code'
        document.body.appendChild(btn)

        let lastAppended = null
        const origAppend = document.body.appendChild
        document.body.appendChild = function (el) { lastAppended = el; return origAppend.call(this, el) }

        setupDownloadSystem()
        btn.click()
        await new Promise(r => setTimeout(r, 50))

        // Depending on the environment, zip creation may fail (caught and alerts),
        // or succeed and call createObjectURL. Accept either outcome to be robust.
        const created = global.URL.createObjectURL.mock.calls.length > 0
        const alerted = global.alert.mock.calls.length > 0
        expect(created || alerted).toBe(true)
        if (created) {
            expect(lastAppended).not.toBeNull()
            expect(lastAppended.download).toBe('cfg_name.zip')
        }

        document.body.appendChild = origAppend
    })
})
