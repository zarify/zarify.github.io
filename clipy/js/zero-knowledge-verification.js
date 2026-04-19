// Zero-knowledge verification system for student solutions
// Implements the system described in ../project/zero-knowledge-verification.md

import { debug as logDebug } from './logger.js'
import { normalizeTestsForHash, canonicalizeForHash } from './normalize-tests.js'

// Simple word list for human-readable codes (BIP39-inspired but shorter)
const WORD_LIST = [
    'apple', 'banana', 'cherry', 'dragon', 'eagle', 'forest', 'galaxy', 'harbor',
    'island', 'jungle', 'kitten', 'lemon', 'magic', 'ninja', 'ocean', 'piano',
    'quest', 'robot', 'sunset', 'tiger', 'umbrella', 'violet', 'wizard', 'xenon',
    'yellow', 'zebra', 'anchor', 'bridge', 'castle', 'diamond', 'engine', 'flame',
    'garden', 'hammer', 'iceberg', 'jewel', 'knight', 'ladder', 'mountain', 'needle',
    'oxygen', 'palace', 'quartz', 'river', 'storm', 'temple', 'unicorn', 'valley',
    'winter', 'x-ray', 'yacht', 'zephyr', 'arctic', 'breeze', 'crystal', 'desert',
    'eclipse', 'falcon', 'glacier', 'horizon', 'infinity', 'jasper', 'kingdom', 'liberty'
]

// Storage key for student identifier
const STUDENT_ID_KEY = 'student_identifier'

/**
 * Get the current student identifier from localStorage
 * @returns {string|null} The student identifier or null if not set
 */
export function getStudentIdentifier() {
    try {
        return localStorage.getItem(STUDENT_ID_KEY)
    } catch (e) {
        logDebug('Failed to get student identifier:', e)
        return null
    }
}

/**
 * Set the student identifier in localStorage
 * @param {string} identifier - The student identifier
 */
export function setStudentIdentifier(identifier) {
    try {
        if (identifier && identifier.trim()) {
            localStorage.setItem(STUDENT_ID_KEY, identifier.trim())
        } else {
            localStorage.removeItem(STUDENT_ID_KEY)
        }
    } catch (e) {
        logDebug('Failed to set student identifier:', e)
    }
}

/**
 * Generate a hash of the test suite configuration
 * @param {Object} testConfig - The test configuration object
 * @returns {Promise<string>} SHA-256 hash of the test suite
 */
async function generateTestSuiteHash(testConfig) {
    if (!testConfig || !testConfig.tests) {
        return ''
    }

    // Create a normalized representation of the tests for consistent hashing
    let normalizedTests = []
    try {
        normalizedTests = normalizeTestsForHash(testConfig)
    } catch (e) {
        logDebug('Error normalizing test config for hash:', e)
        normalizedTests = []
    }

    // Canonicalize (sort keys) for deterministic JSON string
    const testString = canonicalizeForHash(normalizedTests)

    // Generate SHA-256 hash
    try {
        const encoder = new TextEncoder()
        const data = encoder.encode(testString)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
        return hashHex.substring(0, 16) // Use first 16 chars for brevity
    } catch (e) {
        logDebug('Error generating hash:', e)
        return 'fallback-hash'
    }
}

/**
 * Normalize a test object for consistent hashing
 * @param {Object} test - Test object
 * @returns {Object} Normalized test object
 */
function normalizeTest(test) {
    if (!test) return {}

    return {
        id: test.id || '',
        description: test.description || '',
        stdin: test.stdin || '',
        expected_stdout: test.expected_stdout || '',
        expected_stderr: test.expected_stderr || '',
        timeoutMs: test.timeoutMs || 5000,
        // Include AST test specifics if present
        ast: test.ast || null
    }
}

/**
 * Get current date as a string for timestamp inclusion
 * @returns {string} Date in YYYY-MM-DD format
 */
function getCurrentDateString() {
    const now = new Date()
    return now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0')
}

/**
 * Convert hash to human-readable word code
 * @param {string} hashHex - Hexadecimal hash string
 * @returns {string} Three-word code
 */
function hashToWords(hashHex) {
    if (!hashHex || hashHex.length < 6) {
        return 'unknown-code-error'
    }

    try {
        // Use first 6 characters of hash to generate 3 words
        const chunk1 = parseInt(hashHex.substring(0, 2), 16) % WORD_LIST.length
        const chunk2 = parseInt(hashHex.substring(2, 4), 16) % WORD_LIST.length
        const chunk3 = parseInt(hashHex.substring(4, 6), 16) % WORD_LIST.length

        return `${WORD_LIST[chunk1]}-${WORD_LIST[chunk2]}-${chunk3}`
    } catch (e) {
        logDebug('Error converting hash to words:', e)
        return 'error-generating-code'
    }
}

/**
 * Generate zero-knowledge verification code for successful test completion
 * @param {Object} testConfig - The test configuration
 * @param {string} studentId - Student identifier  
 * @param {boolean} allTestsPassed - Whether all tests passed
 * @returns {Promise<string|null>} Verification code or null if not applicable
 */
export async function generateVerificationCode(testConfig, studentId, allTestsPassed) {
    // Only generate code if all tests passed and student ID is set
    if (!allTestsPassed || !studentId) {
        return null
    }

    try {
        const testSuiteHash = await generateTestSuiteHash(testConfig)
        const timestamp = getCurrentDateString()

        // Combine inputs for final hash
        const combinedInput = `${testSuiteHash}:${studentId}:${timestamp}`

        const encoder = new TextEncoder()
        const data = encoder.encode(combinedInput)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

        // Convert to human-readable words
        const verificationCode = hashToWords(hashHex)

        logDebug('Generated verification code:', verificationCode, 'for student:', studentId)

        return verificationCode
    } catch (e) {
        logDebug('Error generating verification code:', e)
        return null
    }
}

/**
 * Verify a student's code against expected parameters
 * @param {string} providedCode - The code provided by the student
 * @param {Object} testConfig - The test configuration
 * @param {string} studentId - Student identifier
 * @returns {Promise<boolean>} Whether the code is valid
 */
export async function verifyStudentCode(providedCode, testConfig, studentId) {
    if (!providedCode || !testConfig || !studentId) {
        return false
    }

    try {
        const expectedCode = await generateVerificationCode(testConfig, studentId, true)
        return expectedCode === providedCode
    } catch (e) {
        logDebug('Error verifying student code:', e)
        return false
    }
}

/**
 * Check if verification code should be shown
 * @param {Array} testResults - Array of test results
 * @returns {boolean} True if all tests passed
 */
export function shouldShowVerificationCode(testResults) {
    if (!Array.isArray(testResults) || testResults.length === 0) {
        return false
    }

    // Filter out skipped tests and check if all remaining tests passed
    const executedTests = testResults.filter(r => !r.skipped)
    return executedTests.length > 0 && executedTests.every(r => r.passed === true)
}
