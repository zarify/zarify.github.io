/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'

describe('author-tests expanded coverage', () => {
    beforeEach(() => {
        jest.resetModules()
        document.documentElement.innerHTML = ''
        localStorage.clear()
        window.Config = { current: {} }
    })

    afterEach(() => {
        delete window.Config
        jest.clearAllMocks()
        if (global.alert) delete global.alert
    })

    test('createDefaultASTTest returns ast-shaped object', async () => {
        const mod = await import('../ast-test-builder.js')
        const def = mod.createDefaultASTTest()
        expect(def).toBeDefined()
        expect(def.type).toBe('ast')
        expect(def.astRule).toBeDefined()
        expect(typeof def.id).toBe('string')
    })

    test('Add AST test button saves an AST test into textarea and window.Config', async () => {
        // mock modal helpers
        jest.unstable_mockModule('../modals.js', () => ({
            openModal: (m) => { m.setAttribute('aria-hidden', 'false') },
            closeModal: (m) => { m.setAttribute('aria-hidden', 'true') }
        }))

        const ta = document.createElement('textarea')
        ta.id = 'tests-editor'
        document.body.appendChild(ta)

        // import after mock
        const mod = await import('../author-tests.js')
        const mod2 = await import('../author-tests.js')
        mod2.initAuthorTests()

        const addASTButton = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Add AST test')
        expect(addASTButton).toBeDefined()
        addASTButton.click()

        // find Save button in modal and click
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Save')
        expect(saveBtn).toBeDefined()
        saveBtn.click()

        // textarea should contain the AST test
        const parsed = JSON.parse(document.getElementById('tests-editor').value)
        expect(parsed.ungrouped && parsed.ungrouped.length).toBeGreaterThanOrEqual(1)
        const t = parsed.ungrouped[parsed.ungrouped.length - 1]
        expect(t.type).toBe('ast')
        expect(window.Config.current.tests.ungrouped.slice(-1)[0].type).toBe('ast')
    })

    test('files JSON toggle parses JSON and renders file list in editor modal', async () => {
        jest.unstable_mockModule('../modals.js', () => ({
            openModal: (m) => { m.setAttribute('aria-hidden', 'false') },
            closeModal: (m) => { m.setAttribute('aria-hidden', 'true') }
        }))

        const ta = document.createElement('textarea')
        ta.id = 'tests-editor'
        document.body.appendChild(ta)

        const mod = await import('../author-tests.js')
        const mod2 = await import('../author-tests.js')
        mod2.initAuthorTests()

        const addButton = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Add test')
        expect(addButton).toBeDefined()
        addButton.click()

        // find the Edit JSON toggle inside modal
        const toggleBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Edit JSON')
        expect(toggleBtn).toBeDefined()
        toggleBtn.click()

        // locate the files JSON textarea by placeholder
        const filesJsonTa = Array.from(document.querySelectorAll('textarea')).find(t => (t.placeholder || '').startsWith('{'))
        expect(filesJsonTa).toBeDefined()

        // set JSON content and dispatch input
        filesJsonTa.value = JSON.stringify({ '/data.txt': 'hello' }, null, 2)
        filesJsonTa.dispatchEvent(new Event('input', { bubbles: true }))

        // click toggle to switch back to Visual Editor
        const visualBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Visual Editor')
        expect(visualBtn).toBeDefined()
        visualBtn.click()

        // now the file list should include an input with the path
        const filePathInput = Array.from(document.querySelectorAll('input[type="text"]')).find(i => i.value === '/data.txt')
        expect(filePathInput).toBeDefined()
    })
})
