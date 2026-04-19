// CodeMirror editor initialization and management
import { $ } from './utils.js'
import { getConfig } from './config.js'
import { info as logInfo, warn as logWarn, error as logError } from './logger.js'

let cm = null
let textarea = null

export function initializeEditor() {
    const config = getConfig()

    // Get DOM elements
    textarea = $('code')
    const host = $('editor-host')

    if (!textarea || !host) {
        logError('Required editor elements not found')
        return null
    }

    // Set initial content
    textarea.value = config?.starter || '# write Python here'

    // Initialize CodeMirror editor if available
    if (window.CodeMirror) {
        cm = window.CodeMirror(host, {
            value: textarea.value,
            // Default to no mode; we'll enable python mode only for .py files
            mode: null,
            lineNumbers: true,
            gutters: ['CodeMirror-linenumbers'],
            fixedGutter: true,
            lineNumberFormatter: function (line) {
                return String(line);
            },
            indentUnit: 4,
            smartIndent: false,
            // Wrap long lines instead of allowing horizontal scrolling/expansion
            lineWrapping: true,
            scrollbarStyle: 'native',
            theme: 'default'
        })

        // Ctrl-Enter to run
        cm.setOption('extraKeys', {
            'Ctrl-Enter': () => {
                const runBtn = $('run')
                if (runBtn) runBtn.click()
            }
        })

        // Expose globally for debugging
        try {
            window.cm = cm
            // Expose mode helper for other modules (avoid import cycles)
            window.setEditorModeForPath = setEditorModeForPath
            // Expose read-only helper for other modules (avoid import cycles)
            window.setEditorReadOnlyMode = setReadOnlyMode
            logInfo('CodeMirror initialized:', {
                readOnly: cm.getOption('readOnly'),
                value: cm.getValue(),
                mode: cm.getOption('mode')
            })
        } catch (e) {
            logError('Error exposing CodeMirror:', e)
        }

        // Position textarea outside visible area but still detectable by tests
        const mainTextarea = document.getElementById('code');
        if (mainTextarea) {
            mainTextarea.style.position = 'absolute';
            mainTextarea.style.top = '-9999px';  // Move way off screen
            mainTextarea.style.left = '-9999px';
            mainTextarea.style.width = '1px';
            mainTextarea.style.height = '1px';
            mainTextarea.style.opacity = '1';  // Keep opaque for Playwright
            mainTextarea.style.zIndex = '1';   // Normal z-index
            mainTextarea.style.pointerEvents = 'auto';
            mainTextarea.style.background = 'transparent';
            mainTextarea.style.border = 'none';
            mainTextarea.style.resize = 'none';
            mainTextarea.style.color = 'black';
            mainTextarea.style.outline = 'none';
            mainTextarea.style.display = 'block';
        }

        // Sync CodeMirror changes back to textarea for test compatibility
        cm.on('change', () => {
            textarea.value = cm.getValue()
            textarea.dispatchEvent(new Event('input', { bubbles: true }))

            // NEW: Invalidate recording when code changes, BUT only if we're NOT currently replaying
            // During replay, file switches shouldn't clear the recording - only a new Run should
            const isReplaying = window.ReplayEngine?.isReplaying
            if (!isReplaying && window.ExecutionRecorder?.hasActiveRecording()) {
                window.ExecutionRecorder.invalidateRecording()
                updateReplayUI(false) // Hide replay controls
            }

            // Debounced feedback evaluation (real-time edit feedback)
            try { scheduleFeedbackEvaluation() } catch (_e) { }
        })

        // Sync textarea changes to CodeMirror (for tests that fill the textarea)
        textarea.addEventListener('input', () => {
            if (cm.getValue() !== textarea.value) {
                cm.setValue(textarea.value)
            }
            try { scheduleFeedbackEvaluation() } catch (_e) { }
        })

        // Watch for programmatic changes to textarea value property (for Playwright fills)
        let lastValue = textarea.value
        const checkForProgrammaticChanges = () => {
            if (textarea.value !== lastValue) {
                lastValue = textarea.value
                if (cm.getValue() !== textarea.value) {
                    cm.setValue(textarea.value)
                }
            }
        }
        setInterval(checkForProgrammaticChanges, 50)  // Check more frequently

        // Debounced feedback evaluation helper
        let _fbTimer = null
        function scheduleFeedbackEvaluation(delay = 300) {
            try {
                // If the editor change was caused by a programmatic tab switch
                // (selectTab -> setValue) we set a suppression flag so we can
                // avoid treating that programmatic update as a user edit.
                // When suppressed, skip scheduling feedback evaluation which
                // would otherwise clear run-time matches immediately after a run.
                try { if (typeof window !== 'undefined' && window.__ssg_suppress_clear_highlights) return } catch (_e) { }
                if (_fbTimer) clearTimeout(_fbTimer)
                _fbTimer = setTimeout(() => {
                    try {
                        const content = cm ? cm.getValue() : (textarea ? textarea.value : '')
                        const path = (window.TabManager && window.TabManager.getActive && window.TabManager.getActive()) || '/main.py'
                        if (window.Feedback && typeof window.Feedback.evaluateFeedbackOnEdit === 'function') {
                            try { window.Feedback.evaluateFeedbackOnEdit(content, path) } catch (_e) { }
                        }
                    } catch (_e) { }
                }, delay)
            } catch (_e) { }
        }

        return cm
    } else {
        logWarn('CodeMirror not available, using textarea fallback')
        return null
    }
}

// Helper: configure the editor mode and indent behavior based on file path
export function setEditorModeForPath(path) {
    try {
        if (!cm) return
        if (!path) {
            cm.setOption('mode', null)
            cm.setOption('smartIndent', false)
            return
        }
        const name = path.startsWith('/') ? path.slice(1) : path
        const parts = name.split('.')
        const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
        if (ext === 'py') {
            cm.setOption('mode', 'python')
            cm.setOption('smartIndent', true)
            cm.setOption('indentUnit', 4)
        } else {
            // Use plain text mode and disable smart auto-indenting for non-Python files
            cm.setOption('mode', null)
            cm.setOption('smartIndent', false)
        }
    } catch (_e) { }
}

export function getCodeMirror() {
    return cm
}

export function getTextarea() {
    return textarea
}

export function getCurrentContent() {
    if (cm) return cm.getValue()
    if (textarea) return textarea.value
    return ''
}

export function setCurrentContent(content) {
    if (cm) cm.setValue(content)
    else if (textarea) textarea.value = content
}

export function setReadOnlyMode(isReadOnly) {
    if (cm) {
        cm.setOption('readOnly', isReadOnly)
        // Add visual styling for read-only state
        if (isReadOnly) {
            cm.getWrapperElement().classList.add('cm-readonly')
        } else {
            cm.getWrapperElement().classList.remove('cm-readonly')
        }
    } else if (textarea) {
        textarea.readOnly = isReadOnly
    }
}

/**
 * Update replay UI controls visibility
 */
export function updateReplayUI(hasRecording) {
    const replayControls = document.getElementById('replay-controls')
    const replayStartBtn = document.getElementById('replay-start')

    if (replayControls && replayStartBtn) {
        if (hasRecording) {
            replayControls.style.display = 'flex'
            replayStartBtn.disabled = false
        } else {
            replayControls.style.display = 'none'
            replayStartBtn.disabled = true
        }
    }
}
