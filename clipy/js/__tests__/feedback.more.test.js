import { jest } from '@jest/globals'

describe('feedback more tests', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
        try { delete window.__ssg_mem } catch (_) { }
    })

    test('emit swallows listener exceptions and still calls other listeners', async () => {
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const cfg = { feedback: [{ id: 'e1', title: 't', when: ['edit'], pattern: { type: 'string', target: 'code', expression: 'x' }, message: 'm' }] }
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit, on, off } = mod
        resetFeedback(cfg)

        const bad = jest.fn(() => { throw new Error('boom') })
        const good = jest.fn()
        on('matches', bad)
        on('matches', good)
        await evaluateFeedbackOnEdit('x', '/main.py')
        expect(good).toHaveBeenCalled()
        // cleanup
        off('matches', bad); off('matches', good)
    })

    test('evaluateFeedbackOnEdit clears prior runMatches before computing edit matches', async () => {
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const cfg = {
            feedback: [
                { id: 'r1', title: 'run', when: ['run'], pattern: { type: 'string', target: 'stdout', expression: 'VAL' }, message: 'm' },
                { id: 'e1', title: 'edit', when: ['edit'], pattern: { type: 'string', target: 'code', expression: 'NOPE' }, message: 'm2' }
            ]
        }
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnRun, evaluateFeedbackOnEdit, on } = mod
        resetFeedback(cfg)

        const seen = []
        const cb = (data) => { seen.push(Array.isArray(data) ? data.slice() : data) }
        on('matches', cb)

        // produce a run match
        await evaluateFeedbackOnRun({ stdout: 'VAL' })
        expect(seen.length).toBeGreaterThan(0)
        expect(seen[seen.length - 1].length).toBeGreaterThan(0)

        // now call edit eval which should clear runMatches first and produce empty edit matches
        const edits = await evaluateFeedbackOnEdit('something', '/main.py')
        expect(Array.isArray(edits)).toBe(true)
        expect(edits.length).toBe(0)

        // the last emitted matches call should be an empty array (combined matches cleared)
        expect(seen[seen.length - 1].length).toBe(0)
    })

    test('formatMessage supports $10 placeholder', async () => {
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit } = mod
        // regex with 10 capture groups
        const expr = '(a)(b)(c)(d)(e)(f)(g)(h)(i)(j)'
        const cfg = { feedback: [{ id: 'g10', title: 't', when: ['edit'], pattern: { type: 'regex', target: 'code', expression: expr, flags: '' }, message: 'g10=$10', severity: 'info' }] }
        resetFeedback(cfg)
        const res = await evaluateFeedbackOnEdit('abcdefghij', '/main.py')
        expect(res.length).toBe(1)
        expect(res[0].message).toBe('g10=j')
    })

    test('duplicate regex flags do not construct a RegExp and produce no matches', async () => {
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))
        const cfg = { feedback: [{ id: 'dupflags', title: 't', when: ['edit'], pattern: { type: 'regex', target: 'code', expression: 'hello', flags: 'ii' }, message: 'm' }] }
        const mod = await import('../feedback.js')
        const { resetFeedback, evaluateFeedbackOnEdit } = mod
        resetFeedback(cfg)
        const res = await evaluateFeedbackOnEdit('hello world', '/main.py')
        expect(Array.isArray(res)).toBe(true)
        expect(res.length).toBe(0)
    })
})
