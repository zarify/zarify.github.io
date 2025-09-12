import { jest } from '@jest/globals'

describe('author-feedback flags validation', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
    })

    test('invalid flags show error in modal and prevent save', async () => {
        // load module
        const mod = await import('../author-feedback.js')
        const { initAuthorFeedback } = mod

        // create a textarea that the UI expects
        const ta = document.createElement('textarea')
        ta.id = 'feedback-editor'
        ta.value = '[]'
        document.body.appendChild(ta)

        // initialize the author UI
        initAuthorFeedback()

        // Click 'Add feedback' button
        const addBtn = document.querySelector('#author-feedback-ui .btn')
        expect(addBtn).toBeTruthy()
        addBtn.click()

        // The modal should be added to the DOM. Find the flags input (labelled)
        const modal = document.querySelector('.modal')
        expect(modal).toBeTruthy()
        // Switch pattern type to regex so flags are validated (UI defaults to 'string')
        const patternType = modal.querySelector('select')
        // find the pattern type select by checking for option values
        const selects = Array.from(modal.querySelectorAll('select'))
        const pType = selects.find(s => Array.from(s.options).some(o => o.value === 'regex'))
        expect(pType).toBeTruthy()
        pType.value = 'regex'
        pType.dispatchEvent(new Event('change', { bubbles: true }))

        const flagsInput = modal.querySelector('input[placeholder="e.g. i"]')
        expect(flagsInput).toBeTruthy()

        // Set invalid flags
        flagsInput.value = 'z!' // invalid characters

        // Click Save button in modal header actions
        const saveBtn = modal.querySelector('.modal-header-actions .btn.btn-primary') || modal.querySelector('button.btn.btn-primary')
        // There may be multiple .btn elements; find the one with text 'Save'
        let save = saveBtn
        if (!save) {
            const candidates = Array.from(modal.querySelectorAll('button'))
            save = candidates.find(b => b.textContent && b.textContent.trim() === 'Save')
        }
        expect(save).toBeTruthy()

        // Click save and assert error text appears
        save.click()
        // error element is next to editor content; find any text node with 'Invalid regex flags'
        const err = modal.querySelector('div')
        const hasError = modal.textContent.includes('Invalid regex flags')
        expect(hasError).toBe(true)
    })

    test('valid single flag saves and updates textarea', async () => {
        const mod = await import('../author-feedback.js')
        const { initAuthorFeedback } = mod
        const ta = document.createElement('textarea')
        ta.id = 'feedback-editor'
        ta.value = '[]'
        document.body.appendChild(ta)
        initAuthorFeedback()
        const addBtn = document.querySelector('#author-feedback-ui .btn')
        addBtn.click()
        const modal = document.querySelector('.modal')
        // switch to regex
        const selects = Array.from(modal.querySelectorAll('select'))
        const pType = selects.find(s => Array.from(s.options).some(o => o.value === 'regex'))
        pType.value = 'regex'
        pType.dispatchEvent(new Event('change', { bubbles: true }))
        const flagsInput = modal.querySelector('input[placeholder="e.g. i"]')
        flagsInput.value = 'i'
        // set a simple expression and title so saved item is visible
        const expr = modal.querySelector('input[type=text]')
        expr.value = 'hello'
        const title = modal.querySelector('input')
        title.value = 'Title'
        // click Save
        let save = Array.from(modal.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Save')
        save.click()
        // modal should be closed: check textarea updated
        const parsed = JSON.parse(document.getElementById('feedback-editor').value || '[]')
        expect(Array.isArray(parsed)).toBe(true)
        expect(parsed.length).toBeGreaterThan(0)
        expect(parsed[parsed.length - 1].pattern.flags).toBe('i')
    })

    test('valid multiple flags saves and persists', async () => {
        const mod = await import('../author-feedback.js')
        const { initAuthorFeedback } = mod
        const ta = document.createElement('textarea')
        ta.id = 'feedback-editor'
        ta.value = '[]'
        document.body.appendChild(ta)
        initAuthorFeedback()
        const addBtn = document.querySelector('#author-feedback-ui .btn')
        addBtn.click()
        const modal = document.querySelector('.modal')
        const selects = Array.from(modal.querySelectorAll('select'))
        const pType = selects.find(s => Array.from(s.options).some(o => o.value === 'regex'))
        pType.value = 'regex'
        pType.dispatchEvent(new Event('change', { bubbles: true }))
        const flagsInput = modal.querySelector('input[placeholder="e.g. i"]')
        flagsInput.value = 'gm'
        const exprs = modal.querySelectorAll('input[type=text]')
        // second text input is the expression; first is title/id inputs - set expression
        if (exprs.length > 1) exprs[1].value = 'X'
        // set title explicit
        const firstInput = modal.querySelector('input')
        firstInput.value = 'Multi'
        let save = Array.from(modal.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Save')
        save.click()
        const parsed = JSON.parse(document.getElementById('feedback-editor').value || '[]')
        expect(parsed.length).toBeGreaterThan(0)
        expect(parsed[parsed.length - 1].pattern.flags).toBe('gm')
    })

    test('editing existing item persists flags on save', async () => {
        const mod = await import('../author-feedback.js')
        const { initAuthorFeedback } = mod

        const ta = document.createElement('textarea')
        ta.id = 'feedback-editor'
        const initial = [{ id: 'e1', title: 'Existing', when: ['edit'], pattern: { type: 'string', target: 'code', expression: 'foo', flags: '' }, message: 'm', severity: 'info' }]
        ta.value = JSON.stringify(initial, null, 2)
        document.body.appendChild(ta)

        initAuthorFeedback()

        // find the Edit button on the rendered card
        const cardButtons = Array.from(document.querySelectorAll('.feedback-entry button'))
        const editBtn = cardButtons.find(b => b.textContent && b.textContent.trim() === 'Edit')
        expect(editBtn).toBeTruthy()
        editBtn.click()

        const modal = document.querySelector('.modal')
        expect(modal).toBeTruthy()

        // switch to regex type in the modal
        const selects = Array.from(modal.querySelectorAll('select'))
        const pType = selects.find(s => Array.from(s.options).some(o => o.value === 'regex'))
        expect(pType).toBeTruthy()
        pType.value = 'regex'
        pType.dispatchEvent(new Event('change', { bubbles: true }))

        const flagsInput = modal.querySelector('input[placeholder="e.g. i"]')
        expect(flagsInput).toBeTruthy()
        flagsInput.value = 'i'
        flagsInput.dispatchEvent(new Event('input', { bubbles: true }))

        // ensure expression exists (modal may have multiple text inputs)
        const textInputs = Array.from(modal.querySelectorAll('input[type=text]'))
        if (textInputs.length > 1) {
            // The last text input is the flags field; the expression input is
            // typically the second-to-last. Use that to set the expression.
            const exprInput = textInputs[textInputs.length - 2]
            exprInput.value = 'foo'
            exprInput.dispatchEvent(new Event('input', { bubbles: true }))
        }
        // click Save
        let save = Array.from(modal.querySelectorAll('button')).find(b => b.textContent && b.textContent.trim() === 'Save')
        expect(save).toBeTruthy()
        // ensure patternType change is processed
        pType.dispatchEvent(new Event('change', { bubbles: true }))
        save.click()
        // allow microtasks (modal close/save handlers) to run
        await Promise.resolve()
        // textarea should be updated
        const parsed = JSON.parse(document.getElementById('feedback-editor').value || '[]')
        expect(Array.isArray(parsed)).toBe(true)
        expect(parsed.length).toBe(1)
        expect(parsed[0].id).toBe('e1')
        expect(parsed[0].pattern.flags).toBe('i')
    })
})
