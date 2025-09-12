import { jest } from '@jest/globals'

describe('tabs.js basic behavior', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
    })

    test('openTab normalizes path, sets active and sets window.__ssg_last_tab_opened', async () => {
        await jest.unstable_mockModule('../vfs-client.js', () => ({ getFileManager: () => ({ read: () => '' }), MAIN_FILE: '/main.py' }))
        await jest.unstable_mockModule('../terminal.js', () => ({ appendTerminalDebug: () => { } }))
        await jest.unstable_mockModule('../modals.js', () => ({ showConfirmModal: async () => true, showInputModal: async () => null }))

        const tabs = await import('../tabs.js')
        const { openTab, list, getActive } = tabs

        document.body.innerHTML = '<div id="tabs-left"></div>'

        const spyDispatch = jest.spyOn(window, 'dispatchEvent')
        await openTab('foo.py')

        expect(list()).toContain('/foo.py')
        expect(getActive()).toBe('/foo.py')
        expect(window.__ssg_last_tab_opened).toBeDefined()
        expect(window.__ssg_last_tab_opened.path).toBe('/foo.py')

        spyDispatch.mockRestore()
    })

    test('closeTab deletes file when confirmed and removes tab', async () => {
        // fake FileManager with delete spy
        const fakeFM = {
            data: {},
            delete: jest.fn(),
            read: (p) => ''
        }
        await jest.unstable_mockModule('../vfs-client.js', () => ({ getFileManager: () => fakeFM, MAIN_FILE: '/main.py' }))
        await jest.unstable_mockModule('../modals.js', () => ({ showConfirmModal: async () => true, showInputModal: async () => null }))
        await jest.unstable_mockModule('../terminal.js', () => ({ appendTerminalDebug: () => { } }))

        const tabs = await import('../tabs.js')
        const { openTab, list, closeTab, getActive } = tabs

        document.body.innerHTML = '<div id="tabs-left"></div>'

        await openTab('/a.txt')
        await openTab('/b.txt')

        expect(list()).toEqual(expect.arrayContaining(['/a.txt', '/b.txt']))

        await closeTab('/a.txt')

        expect(fakeFM.delete).toHaveBeenCalledWith('/a.txt')
        expect(list()).not.toContain('/a.txt')
        // active should still be /b.txt
        expect(getActive()).toBe('/b.txt')
    })

    test('createNew writes new file and opens tab when input modal returns a name', async () => {
        const writes = []
        const fakeFM = {
            write: jest.fn((p, content) => { writes.push({ p, content }) }),
            read: (p) => ''
        }
        await jest.unstable_mockModule('../vfs-client.js', () => ({ getFileManager: () => fakeFM, MAIN_FILE: '/main.py' }))
        await jest.unstable_mockModule('../modals.js', () => ({ showInputModal: async () => 'newfile.py', showConfirmModal: async () => true }))
        await jest.unstable_mockModule('../terminal.js', () => ({ appendTerminalDebug: () => { } }))

        const tabs = await import('../tabs.js')
        const { createNew, list } = tabs

        document.body.innerHTML = '<div id="tabs-left"></div>'

        await createNew()

        expect(fakeFM.write).toHaveBeenCalledWith('/newfile.py', '')
        expect(list()).toContain('/newfile.py')
    })
})
