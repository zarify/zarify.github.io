import { jest } from '@jest/globals'

describe('modals.js', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
    })

    test('openModal sets attributes, focuses first focusable and closeModal restores focus', async () => {
        const mod = await import('../modals.js')
        const { openModal, closeModal } = mod

        // Setup main and an external button to restore focus to
        const main = document.createElement('main')
        document.body.appendChild(main)
        const outside = document.createElement('button')
        outside.id = 'outside'
        document.body.appendChild(outside)
        outside.focus()

        // Modal with an input field
        const modal = document.createElement('div')
        modal.id = 'test-modal'
        const input = document.createElement('input')
        input.id = 'm-field'
        // jsdom reports offsetWidth/offsetHeight as 0; make it appear visible
        Object.defineProperty(input, 'offsetWidth', { value: 100 })
        Object.defineProperty(input, 'offsetHeight', { value: 20 })
        modal.appendChild(input)
        document.body.appendChild(modal)

        // Open modal
        openModal(modal)

        expect(modal.getAttribute('aria-modal')).toBe('true')
        expect(document.querySelector('main').getAttribute('aria-hidden')).toBe('true')
        expect(modal.getAttribute('tabindex')).toBe('-1')
        expect(document.activeElement).toBe(input)
        expect(modal.style.zIndex).toBeTruthy()

        // Close modal
        closeModal(modal)
        expect(modal.getAttribute('aria-modal')).toBeNull()
        // main should have aria-hidden removed
        expect(document.querySelector('main').hasAttribute('aria-hidden')).toBe(false)
        // focus restored to outside
        expect(document.activeElement).toBe(outside)
    })

    test('Tab and Shift+Tab trap focus inside modal; Escape closes', async () => {
        const mod = await import('../modals.js')
        const { openModal } = mod

        const main = document.createElement('main')
        document.body.appendChild(main)

        const modal = document.createElement('div')
        modal.id = 'trap-modal'
        const b1 = document.createElement('button')
        b1.id = 'b1'
        b1.textContent = 'one'
        const b2 = document.createElement('button')
        b2.id = 'b2'
        b2.textContent = 'two'
        // Make buttons appear visible to _getFocusable
        Object.defineProperty(b1, 'offsetWidth', { value: 40 })
        Object.defineProperty(b1, 'offsetHeight', { value: 10 })
        Object.defineProperty(b2, 'offsetWidth', { value: 40 })
        Object.defineProperty(b2, 'offsetHeight', { value: 10 })
        modal.appendChild(b1)
        modal.appendChild(b2)
        document.body.appendChild(modal)

        openModal(modal)

        // Focus last, press Tab -> should wrap to first
        b2.focus()
        expect(document.activeElement).toBe(b2)
        const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
        document.dispatchEvent(tabEvent)
        expect(document.activeElement).toBe(b1)

        // Focus first, Shift+Tab -> should wrap to last
        b1.focus()
        const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, shiftKey: true })
        document.dispatchEvent(shiftTab)
        expect(document.activeElement).toBe(b2)

        // Escape should close the modal (remove aria-modal)
        const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        document.dispatchEvent(esc)
        expect(modal.getAttribute('aria-modal')).toBeNull()
    })

    test('showInputModal falls back to window.prompt when DOM modal is missing', async () => {
        // Ensure no input-modal elements exist
        document.body.innerHTML = ''
        const promptSpy = jest.spyOn(window, 'prompt').mockImplementation(() => 'PROMPT-VALUE')

        const mod = await import('../modals.js')
        const val = await mod.showInputModal('Title', 'Message', 'def')

        expect(promptSpy).toHaveBeenCalled()
        expect(val).toBe('PROMPT-VALUE')

        promptSpy.mockRestore()
    })

    test('showInputModal resolves when OK clicked on DOM modal', async () => {
        const mod = await import('../modals.js')
        // Create DOM elements expected by showInputModal
        const modal = document.createElement('div')
        modal.id = 'input-modal'
        const title = document.createElement('div')
        title.id = 'input-modal-title'
        const desc = document.createElement('div')
        desc.id = 'input-modal-desc'
        const field = document.createElement('input')
        field.id = 'input-modal-field'
        const ok = document.createElement('button')
        ok.id = 'input-modal-ok'
        ok.textContent = 'OK'
        const cancel = document.createElement('button')
        cancel.id = 'input-modal-cancel'
        cancel.textContent = 'Cancel'

        modal.appendChild(title)
        modal.appendChild(desc)
        modal.appendChild(field)
        modal.appendChild(ok)
        modal.appendChild(cancel)
        document.body.appendChild(modal)

        // Call the helper and simulate OK click
        const p = mod.showInputModal('T', 'M', 'default')
        field.value = 'typed'
        ok.click()

        await expect(p).resolves.toBe('typed')
    })

    test('showConfirmModal falls back to window.confirm and DOM yes/no works', async () => {
        // Fallback path
        document.body.innerHTML = ''
        const confSpy = jest.spyOn(window, 'confirm').mockImplementation(() => true)
        const mod = await import('../modals.js')
        const rv = await mod.showConfirmModal('T', 'M')
        expect(confSpy).toHaveBeenCalled()
        expect(rv).toBe(true)
        confSpy.mockRestore()

        // DOM path
        const modal = document.createElement('div')
        modal.id = 'confirm-modal'
        const title = document.createElement('div')
        title.id = 'confirm-modal-title'
        const msg = document.createElement('div')
        msg.id = 'confirm-modal-message'
        const yes = document.createElement('button')
        yes.id = 'confirm-yes'
        yes.textContent = 'Yes'
        const no = document.createElement('button')
        no.id = 'confirm-no'
        no.textContent = 'No'

        modal.appendChild(title)
        modal.appendChild(msg)
        modal.appendChild(yes)
        modal.appendChild(no)
        document.body.appendChild(modal)

        const p = mod.showConfirmModal('X', 'Y')
        yes.click()
        await expect(p).resolves.toBe(true)
    })

    // --- Edge cases ---
    test('showInputModal cancel click resolves to null', async () => {
        const mod = await import('../modals.js')
        const modal = document.createElement('div')
        modal.id = 'input-modal'
        const title = document.createElement('div')
        title.id = 'input-modal-title'
        const desc = document.createElement('div')
        desc.id = 'input-modal-desc'
        const field = document.createElement('input')
        field.id = 'input-modal-field'
        const ok = document.createElement('button')
        ok.id = 'input-modal-ok'
        const cancel = document.createElement('button')
        cancel.id = 'input-modal-cancel'

        // Make field visible to focus logic
        Object.defineProperty(field, 'offsetWidth', { value: 50 })
        Object.defineProperty(field, 'offsetHeight', { value: 10 })

        modal.appendChild(title)
        modal.appendChild(desc)
        modal.appendChild(field)
        modal.appendChild(ok)
        modal.appendChild(cancel)
        document.body.appendChild(modal)

        const p = mod.showInputModal('T', 'M', 'default')
        cancel.click()
        await expect(p).resolves.toBeNull()
    })

    test('showInputModal Enter key within input confirms', async () => {
        const mod = await import('../modals.js')
        const modal = document.createElement('div')
        modal.id = 'input-modal'
        const title = document.createElement('div')
        title.id = 'input-modal-title'
        const desc = document.createElement('div')
        desc.id = 'input-modal-desc'
        const field = document.createElement('input')
        field.id = 'input-modal-field'
        const ok = document.createElement('button')
        ok.id = 'input-modal-ok'
        const cancel = document.createElement('button')
        cancel.id = 'input-modal-cancel'

        // Make field visible
        Object.defineProperty(field, 'offsetWidth', { value: 50 })
        Object.defineProperty(field, 'offsetHeight', { value: 10 })

        modal.appendChild(title)
        modal.appendChild(desc)
        modal.appendChild(field)
        modal.appendChild(ok)
        modal.appendChild(cancel)
        document.body.appendChild(modal)

        const p = mod.showInputModal('T', 'M', 'default')
        field.value = 'entered'
        // Dispatch Enter key on the field
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        await expect(p).resolves.toBe('entered')
    })

    test('showConfirmModal No button resolves false', async () => {
        const mod = await import('../modals.js')
        const modal = document.createElement('div')
        modal.id = 'confirm-modal'
        const title = document.createElement('div')
        title.id = 'confirm-modal-title'
        const msg = document.createElement('div')
        msg.id = 'confirm-modal-message'
        const yes = document.createElement('button')
        yes.id = 'confirm-yes'
        const no = document.createElement('button')
        no.id = 'confirm-no'

        // Make buttons visible
        Object.defineProperty(yes, 'offsetWidth', { value: 20 })
        Object.defineProperty(yes, 'offsetHeight', { value: 10 })
        Object.defineProperty(no, 'offsetWidth', { value: 20 })
        Object.defineProperty(no, 'offsetHeight', { value: 10 })

        modal.appendChild(title)
        modal.appendChild(msg)
        modal.appendChild(yes)
        modal.appendChild(no)
        document.body.appendChild(modal)

        const p = mod.showConfirmModal('A', 'B')
        no.click()
        await expect(p).resolves.toBe(false)
    })

    test('openModal focuses modal itself when no focusable children', async () => {
        const mod = await import('../modals.js')
        const main = document.createElement('main')
        document.body.appendChild(main)

        const modal = document.createElement('div')
        modal.id = 'nofocus-modal'
        document.body.appendChild(modal)

        mod.openModal(modal)
        // When no focusables, modal should be focused itself
        expect(document.activeElement).toBe(modal)
        // cleanup
        mod.closeModal(modal)
    })

    test('closeModal without previousActive does not throw and clears main aria-hidden', async () => {
        const mod = await import('../modals.js')
        const main = document.createElement('main')
        document.body.appendChild(main)
        const modal = document.createElement('div')
        modal.id = 'plain-modal'
        document.body.appendChild(modal)

        // Ensure main has aria-hidden then call closeModal (simulates odd state)
        main.setAttribute('aria-hidden', 'true')
        // Remove any previousActive to simulate missing focus target
        delete modal.__previousActive
        expect(() => mod.closeModal(modal)).not.toThrow()
        expect(main.hasAttribute('aria-hidden')).toBe(false)
    })
})
