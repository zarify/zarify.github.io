import { jest } from '@jest/globals'

describe('feedback-ui basic behavior', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
    })

    test('renders placeholders and run-tests control when no feedback/tests', async () => {
        const mod = await import('../feedback-ui.js')
        const { setFeedbackConfig } = mod

        const host = document.createElement('div')
        host.id = 'fdbk-list'
        document.body.appendChild(host)

        setFeedbackConfig({ feedback: [] })

        const runBtn = document.getElementById('run-tests-btn')
        expect(runBtn).not.toBeNull()
        expect(runBtn.disabled).toBe(true)
        expect(runBtn.getAttribute('aria-disabled')).toBe('true')

        // Expect the edit section to have a placeholder
        const editPlaceholder = host.querySelector('.feedback-section.feedback-edit-section .feedback-msg-hidden')
        expect(editPlaceholder).not.toBeNull()
        expect(editPlaceholder.textContent).toContain('(no editor feedback)')
    })

    test('run-tests enabled when tests present', async () => {
        const mod = await import('../feedback-ui.js')
        const { setFeedbackConfig } = mod

        const host = document.createElement('div')
        host.id = 'fdbk-list'
        document.body.appendChild(host)

        setFeedbackConfig({ feedback: [], tests: [{ id: 't1' }, { id: 't2' }] })

        const runBtn = document.getElementById('run-tests-btn')
        expect(runBtn).not.toBeNull()
        expect(runBtn.disabled).toBe(false)
        expect(runBtn.title).toBe('Run 2 tests')
        expect(runBtn.getAttribute('aria-disabled')).toBe('false')
    })

    test('matched feedback shows message and clicking emits event', async () => {
        const mod = await import('../feedback-ui.js')
        const { setFeedbackConfig, setFeedbackMatches } = mod

        const host = document.createElement('div')
        host.id = 'fdbk-list'
        document.body.appendChild(host)

        setFeedbackConfig({ feedback: [{ id: 'fb1', title: 'My feedback', when: ['edit', 'run'], visibleByDefault: true }] })

        setFeedbackMatches([{ id: 'fb1', message: 'matched message' }])

        const matchedMsg = host.querySelector('.feedback-msg-matched')
        expect(matchedMsg).not.toBeNull()
        expect(matchedMsg.textContent).toContain('matched message')

        // Listen for dispatched event
        let captured = null
        window.addEventListener('ssg:feedback-click', function cb(e) { captured = e.detail; window.removeEventListener('ssg:feedback-click', cb) })

        const wrapper = host.querySelector('[data-id="fb1"]')
        expect(wrapper).not.toBeNull()
        // Simulate click
        wrapper.click()

        expect(captured).not.toBeNull()
        expect(captured.id).toBe('fb1')
        expect(captured.match).not.toBeNull()
        expect(captured.match.message).toBe('matched message')
    })

    test('initializeFeedbackUI exposes modal loading controls and creates modal', async () => {
        const mod = await import('../feedback-ui.js')
        const { initializeFeedbackUI } = mod

        initializeFeedbackUI()
        // show loading modal via exposed helper
        expect(typeof window.__ssg_show_test_results_loading).toBe('function')
        window.__ssg_show_test_results_loading()

        const modal = document.getElementById('test-results-modal')
        expect(modal).not.toBeNull()
        const loading = modal.querySelector('.test-results-loading')
        expect(loading).not.toBeNull()
        expect(loading.textContent).toContain('Running tests...')

        // close for cleanup
        if (typeof window.__ssg_close_test_results === 'function') window.__ssg_close_test_results()
    })
})
