import { jest } from '@jest/globals'

describe('feedback aggregation tests', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
    })

    test('combines edit and run matches and emits combined matches', async () => {
        // Minimal logger stub
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))

        const cfg = {
            feedback: [
                { id: 'e1', title: 'edit rule', when: ['edit'], pattern: { type: 'string', target: 'code', expression: 'HELLO' }, message: 'm1', severity: 'info' },
                { id: 'r1', title: 'run rule', when: ['run'], pattern: { type: 'string', target: 'stdout', expression: 'WORLD' }, message: 'm2', severity: 'warn' }
            ]
        }

        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit, evaluateFeedbackOnRun, on, off } = mod

        resetFeedback(cfg)
        const cb = jest.fn()
        on('matches', cb)

        // Trigger edit match
        const resEdit = await evaluateFeedbackOnEdit('this HELLO code', '/main.py')
        expect(resEdit.length).toBe(1)
        expect(resEdit[0].id).toBe('e1')
        expect(cb).toHaveBeenCalled()

        cb.mockClear()

        // Trigger run match; emitted combined matches should include both
        const resRun = await evaluateFeedbackOnRun({ stdout: 'some WORLD output' })
        expect(resRun.length).toBe(1)
        // the 'matches' event should have been emitted with combined results
        expect(cb).toHaveBeenCalled()
        const calls = cb.mock.calls.map(c => c[0])
        const last = calls[calls.length - 1]
        const ids = last.map(m => m.id)
        expect(ids).toEqual(expect.arrayContaining(['e1', 'r1']))

        off('matches', cb)
    })
})
