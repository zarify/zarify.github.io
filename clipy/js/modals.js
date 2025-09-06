// Modal management and accessibility helpers
import { $ } from './utils.js'

// Track current z-index for modal stacking
let currentZIndex = 1000

// Get focusable elements within a container
function _getFocusable(container) {
    return Array.from(container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement)
}

// Open modal with accessibility features
import { debug as logDebug } from './logger.js'

export function openModal(modal) {
    try {
        logDebug && logDebug('[modals] openModal', modal && modal.id)
        if (!modal) return

        // Set z-index for proper stacking
        currentZIndex += 10
        modal.style.zIndex = currentZIndex
        modal.__zIndex = currentZIndex

        // Record previously focused element for restore
        modal.__previousActive = document.activeElement
        modal.setAttribute('aria-hidden', 'false')
        modal.setAttribute('aria-modal', 'true')

        // Ensure modal is focusable
        if (!modal.hasAttribute('tabindex')) modal.setAttribute('tabindex', '-1')

        const focusables = _getFocusable(modal)
        if (focusables.length) focusables[0].focus()
        else modal.focus()

        // Key handling: trap tab and close on ESC
        modal.__keydownHandler = function (e) {
            if (e.key === 'Escape') {
                e.stopPropagation()
                e.preventDefault()
                closeModal(modal)
                return
            }
            if (e.key === 'Tab') {
                const focusList = _getFocusable(modal)
                if (!focusList.length) { e.preventDefault(); return }
                const first = focusList[0], last = focusList[focusList.length - 1]
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault()
                    last.focus()
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault()
                    first.focus()
                }
            }
        }
        document.addEventListener('keydown', modal.__keydownHandler, true)

        // Mark inert siblings by setting aria-hidden on main content to help screen readers
        try {
            const main = document.querySelector('main')
            if (main) main.setAttribute('aria-hidden', 'true')
        } catch (_e) { }
    } catch (_e) { }
}

// Close modal and restore focus
export function closeModal(modal) {
    try {
        logDebug && logDebug('[modals] closeModal', modal && modal.id)
        if (!modal) return

        modal.setAttribute('aria-hidden', 'true')
        modal.removeAttribute('aria-modal')

        // Reset z-index when closing
        if (modal.__zIndex) {
            modal.style.zIndex = ''
            delete modal.__zIndex
        }

        try {
            document.removeEventListener('keydown', modal.__keydownHandler, true)
        } catch (_e) { }

        try {
            if (modal.__previousActive && typeof modal.__previousActive.focus === 'function') {
                modal.__previousActive.focus()
            }
        } catch (_e) { }

        try {
            const main = document.querySelector('main')
            if (main) main.removeAttribute('aria-hidden')
        } catch (_e) { }
    } catch (_e) { }
}

// Accessible input modal helper: returns string or null if cancelled
export function showInputModal(title, message, defaultValue) {
    return new Promise((resolve) => {
        try {
            const modal = $('input-modal')
            const titleEl = $('input-modal-title')
            const desc = $('input-modal-desc')
            const field = $('input-modal-field')
            const ok = $('input-modal-ok')
            const cancel = $('input-modal-cancel')

            if (!modal || !titleEl || !desc || !field || !ok || !cancel) {
                const val = window.prompt(message || title || '')
                resolve(val)
                return
            }

            titleEl.textContent = title || 'Input'
            desc.textContent = message || ''
            field.value = defaultValue || ''
            openModal(modal)

            const onOk = () => { cleanup(); resolve(field.value) }
            const onCancel = () => { cleanup(); resolve(null) }

            function cleanup() {
                try { closeModal(modal) } catch (_e) { }
                try {
                    ok.removeEventListener('click', onOk)
                    cancel.removeEventListener('click', onCancel)
                    field.removeEventListener('keydown', keyHandler)
                } catch (_e) { }
            }

            ok.addEventListener('click', onOk)
            cancel.addEventListener('click', onCancel)

            // Allow Enter key within input to confirm
            const keyHandler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault()
                    onOk()
                }
            }
            field.addEventListener('keydown', keyHandler)
        } catch (e) {
            resolve(null)
        }
    })
}

// Confirmation modal helper (uses DOM modal created in index.html)
export function showConfirmModal(title, message) {
    return new Promise((resolve) => {
        try {
            const modal = $('confirm-modal')
            const titleEl = $('confirm-modal-title')
            const msg = $('confirm-modal-message')
            const yes = $('confirm-yes')
            const no = $('confirm-no')

            if (!modal || !titleEl || !msg || !yes || !no) {
                // Fallback to window.confirm if the modal is missing
                const ok = window.confirm(message || title || 'Confirm?')
                resolve(!!ok)
                return
            }

            titleEl.textContent = title || 'Confirm'
            msg.textContent = message || ''
            openModal(modal)

            const onYes = () => { cleanup(); resolve(true) }
            const onNo = () => { cleanup(); resolve(false) }

            function cleanup() {
                try { closeModal(modal) } catch (_e) { }
                try {
                    yes.removeEventListener('click', onYes)
                    no.removeEventListener('click', onNo)
                } catch (_e) { }
            }

            yes.addEventListener('click', onYes)
            no.addEventListener('click', onNo)
        } catch (e) {
            resolve(false)
        }
    })
}
