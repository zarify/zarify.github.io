import { jest } from '@jest/globals'

describe('feedback-ui edge cases', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
    })

    test('grouped config renders groups and numbered titles in modal', async () => {
        const mod = await import('../feedback-ui.js')
        const { initializeFeedbackUI, setFeedbackConfig } = mod

        initializeFeedbackUI()

        const host = document.createElement('div')
        host.id = 'fdbk-list'
        document.body.appendChild(host)

        // Grouped test configuration
        const cfg = {
            tests: {
                groups: [
                    { name: 'Group A', tests: [{ id: 'a1', description: 'Test A1' }, { id: 'a2', description: 'Test A2' }] },
                    { name: 'Group B', tests: [{ id: 'b1', description: 'Test B1' }] }
                ],
                ungrouped: [{ id: 'u1', description: 'Ungrouped 1' }],
                showGroupsToUsers: true
            },
            feedback: []
        }

        setFeedbackConfig(cfg)

        // Create results: one failing in Group A, one passing in Group B, one ungrouped
        const results = [
            { id: 'a1', passed: false, description: 'Test A1', stdout: '', stderr: '' },
            { id: 'b1', passed: true, description: 'Test B1' },
            { id: 'u1', passed: false, description: 'Ungrouped 1' }
        ]

        // Show modal
        window.__ssg_show_test_results(results)

        const modal = document.getElementById('test-results-modal')
        expect(modal).not.toBeNull()

        // Group headers should appear for groups that have visible results
        const groupHeaders = Array.from(modal.querySelectorAll('.test-group-section h3')).map(n => n.textContent)
        expect(groupHeaders).toEqual(expect.arrayContaining(['Group A', 'Group B']))

        // Ensure numbered title text appears for grouped tests (e.g., "1.1")
        // Expect modal text to include a numbered prefix like "1.1" for grouped numbering
        const hasNumberPrefix = /\b1\.\d+/.test(modal.textContent)
        expect(hasNumberPrefix).toBe(true)

        // Cleanup
        if (typeof window.__ssg_close_test_results === 'function') window.__ssg_close_test_results()
    })

    test('verification code is displayed when all tests pass and identity present', async () => {
        // Mock verification module before importing feedback-ui
        jest.unstable_mockModule('../zero-knowledge-verification.js', () => ({
            getStudentIdentifier: () => 'student-xyz',
            shouldShowVerificationCode: (results) => true,
            generateVerificationCode: async (cfg, id, passed) => 'abc123'
        }))

        // Also mock logger to silence debug
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, warn: () => { }, error: () => { } }))

        const mod = await import('../feedback-ui.js')
        const { initializeFeedbackUI, setFeedbackConfig } = mod

        initializeFeedbackUI()

        const host = document.createElement('div')
        host.id = 'fdbk-list'
        document.body.appendChild(host)

        const cfg = { tests: [{ id: 't1' }], feedback: [] }
        setFeedbackConfig(cfg)

        const results = [{ id: 't1', passed: true, description: 't1' }]

        // Show modal which should trigger verification code display
        await window.__ssg_show_test_results(results)

        const modal = document.getElementById('test-results-modal')
        expect(modal).not.toBeNull()

        const vdiv = modal.querySelector('#verification-code-display')
        const vtext = modal.querySelector('#verification-code-text')
        // Should be visible and uppercase
        expect(vdiv).not.toBeNull()
        expect(vdiv.style.display).toBe('block')
        expect(vtext.textContent).toBe('ABC123')

        if (typeof window.__ssg_close_test_results === 'function') window.__ssg_close_test_results()
    })

    test('appendTestOutput accumulates chunks and modal refresh shows updated stdout', async () => {
        const mod = await import('../feedback-ui.js')
        const { initializeFeedbackUI, setFeedbackConfig, setTestResults, appendTestOutput } = mod

        initializeFeedbackUI()

        const host = document.createElement('div')
        host.id = 'fdbk-list'
        document.body.appendChild(host)

        const cfg = { tests: [{ id: 't1', description: 'T1', expected_stdout: 'expected' }], feedback: [] }
        setFeedbackConfig(cfg)

        const results = [{ id: 't1', passed: false, description: 'T1', stdout: '', stderr: '' }]
        setTestResults(results)

        // Show modal initially
        window.__ssg_show_test_results(results)

        // Stream two chunks without newlines; module will insert a newline between them
        appendTestOutput({ id: 't1', type: 'stdout', text: 'first' })
        appendTestOutput({ id: 't1', type: 'stdout', text: 'second' })

        // Refresh modal view to pick up internal _testResults changes
        window.__ssg_show_test_results()

        const modal = document.getElementById('test-results-modal')
        expect(modal).not.toBeNull()

        // Find the Actual code element (first .test-code inside a .test-compare)
        const actualCode = modal.querySelector('.test-compare .test-code')
        expect(actualCode).not.toBeNull()
        // The two chunks should be separated by a newline per appendTestOutput logic
        expect(actualCode.textContent).toBe('first\nsecond')

        if (typeof window.__ssg_close_test_results === 'function') window.__ssg_close_test_results()
    })
})
