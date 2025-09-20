import { jest } from '@jest/globals'

// Reproducer: stderr-feedback rule scoped to fileTarget should trigger when
// evaluateFeedbackOnRun is called with stderr text and filename includes '/main.py'

describe('feedback stderr run-time reproducer', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
    })

    test('stderr string pattern with fileTarget matches when filename present', async () => {
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const cfg = {
            feedback: [
                {
                    id: 'fs1',
                    title: 'stderr trace',
                    when: ['run'],
                    pattern: { type: 'string', target: 'stderr', expression: 'Traceback', fileTarget: '/main.py' },
                    message: 'Found traceback',
                    severity: 'error'
                }
            ]
        }

        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnRun, on, off } = mod

        resetFeedback(cfg)
        const cb = jest.fn()
        on('matches', cb)

        const res = await evaluateFeedbackOnRun({ stderr: 'Traceback (most recent call last):\n...', filename: ['/main.py'] })
        expect(res.length).toBe(1)
        expect(res[0].id).toBe('fs1')
        expect(cb).toHaveBeenCalled()
        off('matches', cb)
    })

    test('stderr string pattern with fileTarget does not match when filename missing', async () => {
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const cfg = {
            feedback: [
                {
                    id: 'fs2',
                    title: 'stderr trace missing file',
                    when: ['run'],
                    pattern: { type: 'string', target: 'stderr', expression: 'Traceback', fileTarget: '/main.py' },
                    message: 'Found traceback',
                    severity: 'error'
                }
            ]
        }

        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnRun } = mod

        resetFeedback(cfg)
        const res = await evaluateFeedbackOnRun({ stderr: 'Traceback: boom', filename: ['other.py'] })
        expect(res.length).toBe(0)
    })
})
