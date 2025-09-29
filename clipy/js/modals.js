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
            // Ensure the input modal exists. Some pages (like the authoring
            // page) may not include the static markup, so create it on-demand
            // to provide a consistent accessible input flow and avoid falling
            // back to window.prompt().
            let modal = $('input-modal')
            let titleEl = $('input-modal-title')
            let desc = $('input-modal-desc')
            let field = $('input-modal-field')
            let ok = $('input-modal-ok')
            let cancel = $('input-modal-cancel')

            if (!modal) {
                // Only create the modal on-demand for pages that resemble the
                // application (author page, main app) to avoid surprising test
                // environments or very minimal pages. Developers can force
                // creation by setting `window.__forceCreateInputModal = true`.
                const canCreate = !!(document.getElementById('file-tabs') || document.querySelector('.tabs') || window.__forceCreateInputModal)
                if (!canCreate) {
                    // Fallback for minimal environments (tests, tiny pages)
                    const val = window.prompt(message || title || '')
                    resolve(val)
                    return
                }

                modal = document.createElement('div')
                modal.id = 'input-modal'
                modal.className = 'modal'
                modal.setAttribute('role', 'dialog')
                modal.setAttribute('aria-hidden', 'true')
                modal.innerHTML = `
                    <div class="modal-content input-modal-content">
                        <div class="modal-header">
                            <h3 id="input-modal-title">Input</h3>
                            <button id="input-modal-close" class="btn modal-close-btn">×</button>
                        </div>
                        <div class="modal-body">
                            <p id="input-modal-desc" style="margin-top:0;margin-bottom:8px;color:#444"></p>
                            <input id="input-modal-field" type="text" />
                        </div>
                        <div class="modal-actions">
                            <button id="input-modal-cancel" class="btn">Cancel</button>
                            <button id="input-modal-ok" class="btn btn-primary">OK</button>
                        </div>
                    </div>
                `
                document.body.appendChild(modal)

                // Wire up the close button to behave like cancel
                const closeBtn = $('input-modal-close')
                if (closeBtn) closeBtn.addEventListener('click', () => {
                    try { closeModal(modal) } catch (_e) { }
                })

                // Re-query elements now that modal exists
                titleEl = $('input-modal-title')
                desc = $('input-modal-desc')
                field = $('input-modal-field')
                ok = $('input-modal-ok')
                cancel = $('input-modal-cancel')
            }

            titleEl.textContent = title || 'Input'
            desc.textContent = message || ''
            field.value = defaultValue || ''
            // Ensure a sensible maxlength to avoid accidental overflows
            if (!field.hasAttribute('maxlength')) field.setAttribute('maxlength', '255')
            openModal(modal)

            // Ensure the input receives keyboard focus and its contents
            // are selected so the user can immediately type/replace the value.
            // Use a short timeout to allow openModal focus handling to complete.
            try {
                setTimeout(() => {
                    try {
                        if (field && typeof field.focus === 'function') {
                            field.focus()
                            if (typeof field.select === 'function') field.select()
                        }
                    } catch (_e) { }
                }, 20)
            } catch (_e) { }

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
