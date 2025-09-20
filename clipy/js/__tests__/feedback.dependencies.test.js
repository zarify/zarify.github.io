import { jest } from '@jest/globals'

describe('feedback dependency semantics', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
    })

    test('requiresMatched true vs false (object deps only)', async () => {
        const mod = await import('../feedback-ui.js')
        const { setFeedbackConfig, setFeedbackMatches } = mod

        const host = document.createElement('div')
        host.id = 'fdbk-list'
        document.body.appendChild(host)

        // Configure entries:
        // a: base
        // b: requires a matched
        // c: requires a NOT matched
        // d: legacy string dependency on a
        setFeedbackConfig({
            feedback: [
                { id: 'a', title: 'A', when: ['run', 'edit'] },
                { id: 'b', title: 'B', when: ['run', 'edit'], dependencies: [{ id: 'a', requiresMatched: true }] },
                { id: 'c', title: 'C', when: ['run', 'edit'], dependencies: [{ id: 'a', requiresMatched: false }] },
                { id: 'd', title: 'D', when: ['run', 'edit'], dependencies: [{ id: 'a', requiresMatched: true }] }
            ]
        })

        // Case 1: a present -> b and d should be matched, c should NOT
        setFeedbackMatches([
            { id: 'a', message: 'm-a' },
            { id: 'b', message: 'm-b' },
            { id: 'c', message: 'm-c' },
            { id: 'd', message: 'm-d' }
        ])

        const wrapB = host.querySelector('[data-id="b"]')
        const wrapC = host.querySelector('[data-id="c"]')
        const wrapD = host.querySelector('[data-id="d"]')

        expect(wrapB).not.toBeNull()
        expect(wrapD).not.toBeNull()
        expect(wrapC).not.toBeNull()

        expect(wrapB.classList.contains('matched')).toBe(true)
        expect(wrapD.classList.contains('matched')).toBe(true)
        expect(wrapC.classList.contains('matched')).toBe(false)

        // Case 2: only b present (no a) -> b/d filtered out, c not matched
        setFeedbackMatches([
            { id: 'b', message: 'm-b' }
        ])

        const wrapBAfter = host.querySelector('[data-id="b"]')
        expect(wrapBAfter).not.toBeNull()
        // should NOT be matched since its dependency a is missing
        expect(wrapBAfter.classList.contains('matched')).toBe(false)
    })
})
