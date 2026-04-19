// Input handling for terminal and Python execution
import { $, DebounceTimer } from './utils.js'
import { appendTerminal, appendTerminalDebug, setTerminalInputEnabled, findOrCreatePromptLine } from './terminal.js'

// Track current prompt for live input echo
let __ssg_current_prompt = null

// Setup terminal input form handling
export function setupInputHandling() {
    const stdinBox = $('stdin-box')
    const stdinSendBtn = $('stdin-send')
    const termForm = $('terminal-input-form')

    let submitting = false  // Prevent multiple simultaneous submissions
    let lastFocusTime = 0   // Track when input was last focused

    if (termForm && stdinBox) {
        termForm.addEventListener('submit', (ev) => {
            try {
                ev.preventDefault()

                const now = Date.now()
                const timeSinceFocus = now - lastFocusTime

                // Prevent submissions that happen too quickly after focusing (likely spurious)
                if (timeSinceFocus < 100) {
                    return
                }

                // Prevent multiple simultaneous submissions
                if (submitting) {
                    return
                }

                // Check if we have a pending input request
                if (!window.__ssg_pending_input) {
                    return
                }

                // Check if we're using direct Enter handler (bypass form submission)
                if (window.__ssg_pending_input._usingDirectHandler) {
                    return
                }

                submitting = true

                const val = (stdinBox.value || '').trim()
                stdinBox.value = ''
                setTerminalInputEnabled(false)
                appendTerminal(val, 'stdin')

                submitting = false

                // Track stdin input for feedback system
                if (typeof window.__ssg_stdin_history === 'string') {
                    window.__ssg_stdin_history += (window.__ssg_stdin_history ? '\n' : '') + val
                }

                window.__ssg_pending_input.resolve(val)
                delete window.__ssg_pending_input
            } catch (_e) {
                submitting = false  // Reset flag on error too
            }
        })

        // Track focus events
        stdinBox.addEventListener('focus', () => {
            lastFocusTime = Date.now()
        })
    }

    // Wire send button to trigger form submit (avoid duplicate handlers)
    if (stdinSendBtn && termForm) {
        stdinSendBtn.addEventListener('click', () => {
            try {
                // Trigger the form submit event instead of duplicating the logic
                termForm.dispatchEvent(new Event('submit'))
            } catch (_e) { }
        })
    }
}

// Create custom input handler for MicroPython runtime
export function createInputHandler() {
    return async function (promptText) {
        return new Promise((resolve) => {
            // Set up input collection
            window.__ssg_pending_input = {
                resolve: (value) => {
                    delete window.__ssg_pending_input
                    try { setTerminalInputEnabled(false) } catch (_e) { }

                    // Echo the input inline with the prompt
                    try {
                        const terminalOutput = $('terminal-output')
                        if (terminalOutput) {
                            const lines = terminalOutput.querySelectorAll('.terminal-line')
                            const lastLine = lines[lines.length - 1]
                            if (lastLine) {
                                // Append user input as a styled span to the last line (prompt)
                                if (value && value.trim()) {
                                    const userSpan = document.createElement('span')
                                    userSpan.className = 'term-stdin-user'
                                    userSpan.textContent = String(value)
                                    lastLine.appendChild(userSpan)
                                }
                                // Always add a new line after input (or after prompt if blank input)
                                appendTerminal('', 'stdout')
                            } else {
                                // Fallback: add input on separate line if no last line found
                                if (value && value.trim()) {
                                    appendTerminal(String(value), 'stdin')
                                } else {
                                    appendTerminal('', 'stdout')
                                }
                            }
                        } else {
                            // Fallback: add input on separate line if no terminal output found
                            if (value && value.trim()) {
                                appendTerminal(String(value), 'stdin')
                            } else {
                                appendTerminal('', 'stdout')
                            }
                        }
                    } catch (_e) {
                        // Fallback on any error
                        if (value && value.trim()) {
                            appendTerminal(String(value), 'stdin')
                        } else {
                            appendTerminal('', 'stdout')
                        }
                    }

                    resolve((value || '').trim())
                },
                promptText: promptText || '',
                _usingDirectHandler: true  // Mark that we're using direct approach
            }

            // Display the prompt immediately in the terminal
            if (promptText) {
                appendTerminal(promptText, 'stdout')
            }

            // Enable terminal input 
            try { setTerminalInputEnabled(true, promptText || '') } catch (_e) { }

            const stdinBox = $('stdin-box')
            if (stdinBox) {
                try {
                    stdinBox.value = ''

                    // Set up direct Enter key handler (bypass form submission)
                    const enterHandler = (e) => {
                        if (e.key === 'Enter' && window.__ssg_pending_input) {
                            e.preventDefault()
                            e.stopPropagation()

                            const value = (stdinBox.value || '').trim()

                            // Clean up the handlers
                            stdinBox.removeEventListener('keydown', enterHandler)
                            const form = $('terminal-input-form')
                            if (form) form.removeEventListener('submit', formHandler)
                            stdinBox.value = ''

                            // Track stdin input for feedback system
                            if (typeof window.__ssg_stdin_history === 'string') {
                                window.__ssg_stdin_history += (window.__ssg_stdin_history ? '\n' : '') + value
                            }

                            // Resolve the input
                            window.__ssg_pending_input.resolve(value)
                        }
                    }

                    // Also handle form submission (for tests and edge cases)
                    const formHandler = (e) => {
                        if (window.__ssg_pending_input && window.__ssg_pending_input._usingDirectHandler) {
                            e.preventDefault()
                            e.stopPropagation()

                            const value = (stdinBox.value || '').trim()

                            // Clean up the handlers
                            stdinBox.removeEventListener('keydown', enterHandler)
                            const form = $('terminal-input-form')
                            if (form) form.removeEventListener('submit', formHandler)
                            stdinBox.value = ''

                            // Track stdin input for feedback system
                            if (typeof window.__ssg_stdin_history === 'string') {
                                window.__ssg_stdin_history += (window.__ssg_stdin_history ? '\n' : '') + value
                            }

                            // Resolve the input
                            window.__ssg_pending_input.resolve(value)
                        }
                    }

                    stdinBox.addEventListener('keydown', enterHandler)
                    const form = $('terminal-input-form')
                    if (form) {
                        form.addEventListener('submit', formHandler)
                    }

                    // Focus the input field immediately
                    try {
                        stdinBox.focus()
                    } catch (_e) { }

                    // Also try again after a brief delay to ensure it works
                    setTimeout(() => {
                        try {
                            stdinBox.focus()
                        } catch (_e) { }
                    }, 10)
                } catch (_e) { }
            }
        })
    }
}

// Host module factory for MicroPython integration
export function createHostModule() {
    return {
        get_input: async function (promptText = '') {
            return new Promise((resolve) => {
                // store resolver temporarily on the window so UI handler can find it
                window.__ssg_pending_input = { resolve, promptText }
                // enable and focus the terminal inline input for immediate typing
                try { setTerminalInputEnabled(true, promptText || '') } catch (_e) { }
                const stdinBox = $('stdin-box')
                if (stdinBox) { try { stdinBox.focus() } catch (_e) { } }
            })
        }
    }
}
