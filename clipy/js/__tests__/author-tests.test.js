/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'

describe('author-tests UI and textarea sync', () => {
    beforeEach(() => {
        jest.resetModules()
        document.documentElement.innerHTML = ''
        localStorage.clear()
        // prepare a tests textarea
        const ta = document.createElement('textarea')
        ta.id = 'tests-editor'
        document.body.appendChild(ta)

        // lightweight modal helpers stub will be mocked per-test when needed
        window.Config = { current: {} }
    })

    afterEach(() => {
        delete window.Config
        jest.clearAllMocks()
    })

    test('initAuthorTests parses textarea and syncs to window.Config and group visibility', async () => {
        const ta = document.getElementById('tests-editor')
        const payload = {
            groups: [{ id: 'g1', name: 'G1', tests: [] }],
            ungrouped: [],
            showGroupsToUsers: false
        }
        ta.value = JSON.stringify(payload)

        const mod = await import('../author-tests.js')
        // call public initializer
        mod.initAuthorTests()

        // group visibility checkbox should reflect showGroupsToUsers
        const chk = document.getElementById('groups-visible-to-users')
        expect(chk).not.toBeNull()
        expect(chk.checked).toBe(false)

        // window.Config.current.tests should have been set
        expect(window.Config.current.tests).toBeDefined()
        expect(window.Config.current.tests.groups).toHaveLength(1)
    })

    test('editing the textarea updates window.Config.current.tests', async () => {
        const ta = document.getElementById('tests-editor')
        ta.value = ''

        const mod = await import('../author-tests.js')
        mod.initAuthorTests()

        // new value with an ungrouped test
        const newVal = { groups: [], ungrouped: [{ id: 't-x', description: 'hello' }], showGroupsToUsers: true }
        ta.value = JSON.stringify(newVal)
        ta.dispatchEvent(new Event('input', { bubbles: true }))

        expect(window.Config.current.tests).toBeDefined()
        expect(window.Config.current.tests.ungrouped).toHaveLength(1)
        expect(window.Config.current.tests.ungrouped[0].description).toBe('hello')

        // also ensure JSON view updated (rendered as pre element)
        const jsonView = document.getElementById('tests-json-view')
        expect(jsonView).not.toBeNull()
        expect(jsonView.textContent).toContain('hello')
    })

    test('add button opens new-test modal and Save persists a new ungrouped test', async () => {
        // mock modal helpers so openModal doesn't throw and closeModal is noop
        jest.unstable_mockModule('../modals.js', () => ({
            openModal: (m) => { m.setAttribute('aria-hidden', 'false'); },
            closeModal: (m) => { m.setAttribute('aria-hidden', 'true'); }
        }))

        const mod = await import('../author-tests.js')
        // re-importing dynamic module from within jest.unstable_mockModule context
        const mod2 = await import('../author-tests.js')
        mod2.initAuthorTests()

        const addBtn = document.querySelector('#author-tests-ui .btn') || document.getElementById('add-file')
        // prefer the Add test button created by initAuthorTests
        const addButton = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Add test')
        expect(addButton).toBeDefined()

        // Click Add test to open modal
        addButton.click()

        // Modal should exist and contain a Save button
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Save')
        expect(saveBtn).toBeDefined()

        // Click Save to persist the default new test
        saveBtn.click()

        // textarea should now contain a test
        const ta = document.getElementById('tests-editor')
        expect(ta.value).toBeTruthy()
        const parsed = JSON.parse(ta.value)
        expect(parsed.ungrouped && parsed.ungrouped.length).toBeGreaterThanOrEqual(1)
        expect(window.Config.current.tests.ungrouped.length).toBeGreaterThanOrEqual(1)
        expect(window.Config.current.tests.ungrouped[0].description).toBe('New test')
    })
})
