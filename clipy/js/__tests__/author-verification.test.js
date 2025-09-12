import { jest } from '@jest/globals'

describe('author-verification unit tests', () => {
    beforeEach(() => {
        jest.resetModules()
        localStorage.clear()
    })

    test('students list save/get/add/remove/clear behaviors', async () => {
        const mod = await import('../author-verification.js')
        const { getStudentsList, saveStudentsList, addStudent, removeStudent, clearAllStudents } = mod

        // save and get
        saveStudentsList(['bob', 'alice'])
        expect(getStudentsList()).toEqual(['alice', 'bob'])

        // add student
        expect(addStudent('carol')).toBe(true)
        expect(getStudentsList()).toEqual(['alice', 'bob', 'carol'])
        // duplicate add returns false
        expect(addStudent('carol')).toBe(false)

        // remove
        expect(removeStudent('bob')).toBe(true)
        expect(getStudentsList()).toEqual(['alice', 'carol'])
        expect(removeStudent('nonexistent')).toBe(false)

        // clear
        clearAllStudents()
        expect(getStudentsList()).toEqual([])
    })

    test('generateCodesForAllStudents uses generateVerificationCode and normalization', async () => {
        // Mock dependent modules before importing author-verification
        jest.unstable_mockModule('../zero-knowledge-verification.js', () => ({
            generateVerificationCode: async (cfg, studentId, allTestsPassed) => `CODE-${studentId}-${allTestsPassed ? 1 : 0}`
        }))
        jest.unstable_mockModule('../normalize-tests.js', () => ({
            normalizeTestsForHash: (cfg) => cfg.tests || [],
            canonicalizeForHash: (tests) => JSON.stringify(tests)
        }))
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { } }))

        const mod = await import('../author-verification.js')
        const { generateCodesForAllStudents, saveStudentsList } = mod

        // seed students
        saveStudentsList(['s1', 's2'])
        const codes = await generateCodesForAllStudents({ tests: [{ id: 't' }] })
        expect(Array.isArray(codes)).toBe(true)
        expect(codes.length).toBe(2)
        expect(codes.find(c => c.studentId === 's1').code).toBe('CODE-s1-1')
        expect(codes.find(c => c.studentId === 's2').code).toBe('CODE-s2-1')
    })
})
