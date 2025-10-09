// Teacher verification interface for managing students and verification codes
import { generateVerificationCode } from './zero-knowledge-verification.js'
import { debug as logDebug } from './logger.js'
import { normalizeTestsForHash, canonicalizeForHash } from './normalize-tests.js'

// Storage key for student list (independent of configs)
const STUDENTS_LIST_KEY = 'teacher_students_list'

/**
 * Get the list of students from localStorage
 * @returns {string[]} Array of student IDs
 */
export function getStudentsList() {
    try {
        const stored = localStorage.getItem(STUDENTS_LIST_KEY)
        return stored ? JSON.parse(stored) : []
    } catch (e) {
        logDebug('Failed to get students list:', e)
        return []
    }
}

/**
 * Save the list of students to localStorage
 * @param {string[]} students - Array of student IDs
 */
export function saveStudentsList(students) {
    try {
        // Persist students in a stable, alphabetical order (case-insensitive)
        const sorted = (students || []).slice().sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }))
        localStorage.setItem(STUDENTS_LIST_KEY, JSON.stringify(sorted))
    } catch (e) {
        logDebug('Failed to save students list:', e)
    }
}

/**
 * Add a student to the list
 * @param {string} studentId - Student ID to add
 * @returns {boolean} True if added, false if already exists or invalid
 */
export function addStudent(studentId) {
    if (!studentId || !studentId.trim()) return false

    const students = getStudentsList()
    const trimmedId = studentId.trim()

    if (students.includes(trimmedId)) return false
    students.push(trimmedId)
    // Save will sort alphabetically
    saveStudentsList(students)
    return true
}

/**
 * Remove a student from the list
 * @param {string} studentId - Student ID to remove
 * @returns {boolean} True if removed, false if not found
 */
export function removeStudent(studentId) {
    const students = getStudentsList()
    const index = students.indexOf(studentId)

    if (index === -1) return false

    students.splice(index, 1)
    // Save will sort (no-op here but keeps persisted order deterministic)
    saveStudentsList(students)
    return true
}

/**
 * Clear all students from the list
 */
export function clearAllStudents() {
    saveStudentsList([])
}

/**
 * Normalize config the same way the main app does for verification code generation
 * @param {Object} cfg - Raw config from authoring interface
 * @returns {Object} Normalized config
 */
// Use shared normalization utilities (normalizeTestsForHash, canonicalizeForHash)

/**
 * Generate verification codes for all students given a test config
 * @param {Object} testConfig - The current test configuration
 * @returns {Promise<Array>} Array of {studentId, code} objects
 */
export async function generateCodesForAllStudents(testConfig) {
    const students = getStudentsList()
    const codes = []

    // Normalize tests deterministically and embed back into a shallow config
    const normalizedTests = normalizeTestsForHash(testConfig)
    const canonicalTestsJson = canonicalizeForHash(normalizedTests)
    const normalizedConfig = Object.assign({}, testConfig, { tests: normalizedTests })

    // If there are no tests, return entries with a message instead of codes
    let hasTests = false
    if (normalizedConfig.tests) {
        if (Array.isArray(normalizedConfig.tests)) {
            hasTests = normalizedConfig.tests.length > 0
        } else if (normalizedConfig.tests && typeof normalizedConfig.tests === 'object') {
            // grouped format: consider groups and ungrouped arrays; empty arrays mean no tests
            const groups = Array.isArray(normalizedConfig.tests.groups) ? normalizedConfig.tests.groups : []
            const ungrouped = Array.isArray(normalizedConfig.tests.ungrouped) ? normalizedConfig.tests.ungrouped : []
            if ((groups && groups.length > 0) || (ungrouped && ungrouped.length > 0)) hasTests = true
        }
    }
    if (!hasTests) {
        for (const studentId of students) {
            codes.push({ studentId, code: 'No tests available in this config' })
        }
        return codes
    }

    for (const studentId of students) {
        try {
            // Simulate all tests passing for code generation
            const allTestsPassed = true
            const code = await generateVerificationCode(normalizedConfig, studentId, allTestsPassed)
            codes.push({ studentId, code })
        } catch (e) {
            logDebug('Failed to generate code for student:', studentId, e)
            codes.push({ studentId, code: 'Error generating code' })
        }
    }

    return codes
}

/**
 * Initialize the verification tab UI
 * @param {Function} onStudentsChanged - Callback when students list changes
 */
export function initVerificationTab(onStudentsChanged = null) {
    const addBtn = document.getElementById('add-student-btn')
    const clearBtn = document.getElementById('clear-students-btn')
    const input = document.getElementById('new-student-id')

    if (!addBtn || !clearBtn || !input) {
        logDebug('Verification tab elements not found')
        return
    }

    // Add student button handler
    addBtn.addEventListener('click', () => {
        const studentId = input.value
        if (addStudent(studentId)) {
            input.value = ''
            renderStudentsList()
            if (onStudentsChanged) onStudentsChanged()
        } else {
            // Show feedback for duplicate/invalid
            const feedback = studentId.trim() ? 'Student already exists!' : 'Please enter a valid student ID'
            showTemporaryFeedback(feedback)
        }
    })

    // Enter key support for input
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addBtn.click()
        }
    })

    // Clear all button handler
    clearBtn.addEventListener('click', async () => {
        // Simple confirmation
        if (confirm('Are you sure you want to clear all students?')) {
            clearAllStudents()
            renderStudentsList()
            if (onStudentsChanged) onStudentsChanged()
        }
    })

    // Initial render
    renderStudentsList()
}

/**
 * Render the students list with verification codes
 * @param {Object} testConfig - Optional test config for generating codes
 */
export async function renderStudentsList(testConfig = null) {
    const container = document.getElementById('student-codes-list')
    if (!container) return

    const students = getStudentsList()

    if (students.length === 0) {
        // Render placeholder using safe DOM APIs instead of innerHTML
        const p = document.createElement('p')
        p.style.textAlign = 'center'
        p.style.color = '#666'
        p.style.fontStyle = 'italic'
        p.style.margin = '0'
        p.textContent = 'No students added yet.'
        // Clear existing children then append placeholder
        while (container.firstChild) container.removeChild(container.firstChild)
        container.appendChild(p)
        return
    }

    // Show loading state (use safe DOM APIs)
    while (container.firstChild) container.removeChild(container.firstChild)
    const loadingP = document.createElement('p')
    loadingP.style.textAlign = 'center'
    loadingP.style.color = '#666'
    loadingP.style.margin = '0'
    loadingP.textContent = 'Generating codes...'
    container.appendChild(loadingP)

    // Generate codes if we have a test config
    let codes = []
    if (testConfig) {
        codes = await generateCodesForAllStudents(testConfig)
    } else {
        // Just show student IDs without codes
        codes = students.map(studentId => ({ studentId, code: 'Load test config to see codes' }))
    }

    // Render the list using DOM methods to avoid innerHTML with dynamic content
    const wrapper = document.createElement('div')
    wrapper.style.display = 'grid'
    wrapper.style.gap = '8px'

    codes.forEach(({ studentId, code }) => {
        const item = document.createElement('div')

        if (code === 'No tests available in this config') {
            item.style.padding = '8px 12px'
            item.style.background = '#fff3cd'
            item.style.border = '1px solid #ffeeba'
            item.style.borderRadius = '4px'

            const row = document.createElement('div')
            row.style.display = 'flex'
            row.style.justifyContent = 'space-between'
            row.style.alignItems = 'center'

            const left = document.createElement('div')
            const strong = document.createElement('strong')
            strong.style.color = '#333'
            strong.textContent = studentId
            left.appendChild(strong)

            const note = document.createElement('div')
            note.style.color = '#856404'
            note.style.fontFamily = 'monospace'
            note.style.fontSize = '0.9em'
            note.style.marginTop = '4px'
            note.textContent = 'This configuration contains no tests. Add tests to generate verification codes.'
            left.appendChild(note)

            const removeBtn = document.createElement('button')
            removeBtn.className = 'remove-student-btn btn btn-small'
            removeBtn.dataset.student = studentId
            removeBtn.style.color = '#dc3545'
            removeBtn.style.borderColor = '#dc3545'
            removeBtn.textContent = 'Remove'

            row.appendChild(left)
            row.appendChild(removeBtn)
            item.appendChild(row)
        } else {
            item.style.display = 'flex'
            item.style.justifyContent = 'space-between'
            item.style.alignItems = 'center'
            item.style.padding = '8px 12px'
            item.style.background = 'white'
            item.style.border = '1px solid #ddd'
            item.style.borderRadius = '4px'

            const left = document.createElement('div')
            const strong = document.createElement('strong')
            strong.style.color = '#333'
            strong.textContent = studentId
            left.appendChild(strong)

            const codeDiv = document.createElement('div')
            codeDiv.style.color = '#666'
            codeDiv.style.fontFamily = 'monospace'
            codeDiv.style.fontSize = '0.9em'
            codeDiv.style.marginTop = '4px'
            codeDiv.textContent = String(code)
            left.appendChild(codeDiv)

            const removeBtn = document.createElement('button')
            removeBtn.className = 'remove-student-btn btn btn-small'
            removeBtn.dataset.student = studentId
            removeBtn.style.color = '#dc3545'
            removeBtn.style.borderColor = '#dc3545'
            removeBtn.textContent = 'Remove'

            item.appendChild(left)
            item.appendChild(removeBtn)
        }

        wrapper.appendChild(item)
    })

    // Replace container contents safely
    container.textContent = ''
    container.appendChild(wrapper)

    // Add remove handlers
    container.querySelectorAll('.remove-student-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const studentId = btn.dataset.student
            if (removeStudent(studentId)) {
                renderStudentsList(testConfig)
            }
        })
    })
}

/**
 * Show temporary feedback message
 * @param {string} message - Message to show
 */
function showTemporaryFeedback(message) {
    const input = document.getElementById('new-student-id')
    if (!input) return

    const originalPlaceholder = input.placeholder
    input.placeholder = message
    input.style.borderColor = '#dc3545'

    setTimeout(() => {
        input.placeholder = originalPlaceholder
        input.style.borderColor = '#ddd'
    }, 2000)
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}
