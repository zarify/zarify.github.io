import { jest } from '@jest/globals'

describe('author-feedback small unit tests', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
    })

    test('parseFeedbackFromTextarea handles empty and invalid JSON', async () => {
        const mod = await import('../author-feedback.js')
        const { parseFeedbackFromTextarea } = mod
        const ta = document.createElement('textarea')
        ta.value = ''
        expect(parseFeedbackFromTextarea(ta)).toEqual([])

        ta.value = '{ invalid json'
        expect(parseFeedbackFromTextarea(ta)).toEqual([])

        ta.value = JSON.stringify({ feedback: [{ id: 'x' }] })
        expect(parseFeedbackFromTextarea(ta)).toEqual([{ id: 'x' }])
    })

    test('writeFeedbackToTextarea writes JSON and dispatches input event', async () => {
        const mod = await import('../author-feedback.js')
        const { writeFeedbackToTextarea } = mod
        const ta = document.createElement('textarea')
        const arr = [{ id: 'a', title: 'T' }]
        let called = false
        ta.addEventListener('input', () => { called = true })
        writeFeedbackToTextarea(ta, arr)
        expect(called).toBe(true)
        expect(JSON.parse(ta.value)).toEqual(arr)
    })

    test('getValidTargetsForWhen returns correct sets', async () => {
        const mod = await import('../author-feedback.js')
        const { getValidTargetsForWhen } = mod
        expect(getValidTargetsForWhen(['edit'])).toEqual(expect.arrayContaining(['code', 'filename']))
        expect(getValidTargetsForWhen(['run'])).toEqual(expect.arrayContaining(['stdout', 'stderr', 'stdin', 'filename']))
        expect(getValidTargetsForWhen([])).toEqual(expect.arrayContaining(['stdout', 'stderr', 'stdin', 'filename']))
    })
})
