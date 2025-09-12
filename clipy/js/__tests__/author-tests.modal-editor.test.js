/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'

describe('author-tests modal file editor behaviors', () => {
    beforeEach(() => {
        jest.resetModules()
        document.documentElement.innerHTML = ''
        localStorage.clear()
        window.Config = { current: {} }
    })

    afterEach(() => {
        delete window.Config
        jest.clearAllMocks()
        if (global.prompt) delete global.prompt
    })

    test('New File -> Save adds file content to the test files and persists when saving test', async () => {
        // mock modal helpers
        jest.unstable_mockModule('../modals.js', () => ({
            openModal: (m) => { m.setAttribute('aria-hidden', 'false') },
            closeModal: (m) => { m.setAttribute('aria-hidden', 'true') }
        }))

        const ta = document.createElement('textarea')
        ta.id = 'tests-editor'
        document.body.appendChild(ta)

        // import module after mock
        const mod = await import('../author-tests.js')
        const mod2 = await import('../author-tests.js')
        mod2.initAuthorTests()

        // Click Add test
        const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Add test')
        expect(addBtn).toBeDefined()
        addBtn.click()

        // In the editor form, click 'New File' button
        const newFileBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'New File')
        expect(newFileBtn).toBeDefined()
        newFileBtn.click()

        // Find the file editor modal by locating the h3 with 'Edit: ' prefix
        const fileHeader = Array.from(document.querySelectorAll('h3')).find(h => h.textContent && h.textContent.startsWith('Edit: '))
        expect(fileHeader).toBeDefined()
        // Walk up until we find a container that actually contains the file editor textarea
        let fileModal = fileHeader
        while (fileModal && fileModal.querySelectorAll && fileModal.querySelectorAll('textarea').length === 0) {
            fileModal = fileModal.parentElement
        }
        expect(fileModal).toBeDefined()
        const textareas = Array.from(fileModal.querySelectorAll('textarea'))
        expect(textareas.length).toBeGreaterThan(0)
        const editorTa = textareas[0]
        editorTa.value = 'file-contents-123'

        // find Save button within file modal
        const saveBtn = Array.from(fileModal.querySelectorAll('button')).find(b => b.textContent === 'Save')
        expect(saveBtn).toBeDefined()
        saveBtn.click()

        // Now click Save on the outer modal to persist the test
        const outerSave = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Save')
        expect(outerSave).toBeDefined()
        outerSave.click()

        // textarea should now contain the new test with files object
        const parsed = JSON.parse(document.getElementById('tests-editor').value)
        const saved = parsed.ungrouped && parsed.ungrouped[parsed.ungrouped.length - 1]
        expect(saved).toBeDefined()
        expect(saved.files).toBeDefined()
        const keys = Object.keys(saved.files)
        expect(keys.length).toBeGreaterThanOrEqual(1)
        const firstPath = keys[0]
        expect(saved.files[firstPath]).toBe('file-contents-123')
    })

    test('New File -> Cancel does not add file to the test', async () => {
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

        const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Add test')
        addBtn.click()

        const newFileBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'New File')
        newFileBtn.click()

        const modals = Array.from(document.querySelectorAll('.modal'))
        const fileModal = modals[modals.length - 1]
        const textareas = Array.from(fileModal.querySelectorAll('textarea'))
        const editorTa = textareas[0]
        editorTa.value = 'should-not-save'

        // find Cancel button in file modal and click
        const cancelBtn = Array.from(fileModal.querySelectorAll('button')).find(b => b.textContent === 'Cancel')
        expect(cancelBtn).toBeDefined()
        cancelBtn.click()

        // Save outer modal (persist test) and ensure no files present
        const outerSave = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Save')
        outerSave.click()

        const parsed = JSON.parse(document.getElementById('tests-editor').value)
        const saved = parsed.ungrouped && parsed.ungrouped[parsed.ungrouped.length - 1]
        // files should be undefined or empty
        expect(saved.files == null || Object.keys(saved.files).length === 0).toBe(true)
    })
})
