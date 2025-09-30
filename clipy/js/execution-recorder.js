// Execution recording and replay system for debugging
import { appendTerminalDebug } from './terminal.js'

/**
 * Data structure representing a single execution step
 */
export class ExecutionStep {
    constructor(lineNumber, variables = new Map(), scope = 'global', timestamp = null) {
        this.lineNumber = lineNumber      // 1-based line number
        this.variables = variables        // Map of variable name -> VariableState
        this.scope = scope               // 'global', 'function:name', etc.
        this.timestamp = timestamp || performance.now()
        this.stackDepth = 0             // Function call depth
        this.executionType = 'line'     // 'line', 'call', 'return', 'exception'
    }
}

/**
 * Data structure representing the complete execution trace
 */
export class ExecutionTrace {
    constructor() {
        this.steps = []           // Array of ExecutionStep objects
        this.metadata = {
            startTime: null,
            endTime: null,
            totalLines: 0,
            sourceCode: '',
            recordingLimits: {}
        }
    }

    addStep(step) {
        this.steps.push(step)
    }

    getStep(index) {
        return this.steps[index]
    }

    getStepCount() {
        return this.steps.length
    }

    setMetadata(key, value) {
        this.metadata[key] = value
    }

    getMetadata(key) {
        return this.metadata[key]
    }
}

/**
 * Variable state serialization utility
 */
export class VariableStateCapture {
    static simplifyValue(value, maxDepth = 2, currentDepth = 0) {
        // Handle null and undefined
        if (value === null) return null
        if (value === undefined) return undefined

        // Handle primitive types
        if (typeof value === 'string') {
            return value.length > 200 ? value.substring(0, 197) + '...' : value
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return value
        }

        // Prevent infinite recursion
        if (currentDepth >= maxDepth) {
            return `[Object depth limit reached]`
        }

        // Handle arrays
        if (Array.isArray(value)) {
            if (value.length === 0) return []
            if (value.length > 10) {
                const preview = value.slice(0, 10).map(item =>
                    this.simplifyValue(item, maxDepth, currentDepth + 1)
                )
                return [...preview, `... ${value.length - 10} more items`]
            }
            return value.map(item => this.simplifyValue(item, maxDepth, currentDepth + 1))
        }

        // Handle objects
        if (typeof value === 'object') {
            const keys = Object.keys(value)
            if (keys.length === 0) return {}
            if (keys.length > 10) {
                const limited = {}
                for (let i = 0; i < 10; i++) {
                    const key = keys[i]
                    limited[key] = this.simplifyValue(value[key], maxDepth, currentDepth + 1)
                }
                limited['...'] = `${keys.length - 10} more keys`
                return limited
            }
            const simplified = {}
            for (const key of keys) {
                simplified[key] = this.simplifyValue(value[key], maxDepth, currentDepth + 1)
            }
            return simplified
        }

        // Convert other types to string representation
        return String(value)
    }

    static captureFromRuntime() {
        // This will be implemented when we integrate with MicroPython runtime
        // For now, return empty map
        return new Map()
    }
}

/**
 * Main execution recorder class
 */
export class ExecutionRecorder {
    constructor() {
        this.currentTrace = null
        this.isRecording = false
        this.recordingEnabled = true
        this.config = {
            maxSteps: 1000,
            maxVariables: 50,
            maxDepth: 3,
            maxStringLength: 200
        }
        this.executionHooks = null
    }

    /**
     * Check if the recorder is supported in current environment
     */
    static isSupported() {
        // Check for required APIs
        if (!window.performance || !window.performance.now) {
            return false
        }

        // Check for CodeMirror with required features
        if (!window.cm || typeof window.cm.addLineWidget !== 'function') {
            return false
        }

        return true
    }

    /**
     * Start recording execution
     */
    startRecording(sourceCode = '', config = {}) {
        if (!this.recordingEnabled || this.isRecording) {
            return false
        }

        try {
            this.currentTrace = new ExecutionTrace()
            this.currentTrace.setMetadata('startTime', performance.now())
            this.currentTrace.setMetadata('sourceCode', sourceCode)
            this.currentTrace.setMetadata('recordingLimits', { ...this.config, ...config })

            this.isRecording = true
            appendTerminalDebug('Execution recording started')
            return true
        } catch (error) {
            appendTerminalDebug('Failed to start recording: ' + error)
            return false
        }
    }

    /**
     * Stop recording execution
     */
    stopRecording() {
        if (!this.isRecording) {
            return false
        }

        try {
            this.currentTrace.setMetadata('endTime', performance.now())
            this.isRecording = false
            appendTerminalDebug(`Recording stopped with ${this.currentTrace.getStepCount()} steps`)
            return true
        } catch (error) {
            appendTerminalDebug('Failed to stop recording: ' + error)
            return false
        }
    }

    /**
     * Finalize recording (called when execution completes)
     */
    finalizeRecording() {
        if (this.isRecording) {
            this.stopRecording()
        }
    }

    /**
     * Clear current recording
     */
    clearRecording() {
        this.currentTrace = null
        this.isRecording = false
        appendTerminalDebug('Recording cleared')
    }

    /**
     * Record a single execution step
     */
    recordStep(lineNumber, variables = new Map(), scope = 'global', executionType = 'line') {
        if (!this.isRecording || !this.currentTrace) {
            return
        }

        // Check if we've exceeded recording limits
        if (this.currentTrace.getStepCount() >= this.config.maxSteps) {
            appendTerminalDebug('Recording limit reached, stopping recording')
            this.stopRecording()
            return
        }

        try {
            const step = new ExecutionStep(lineNumber, variables, scope)
            step.executionType = executionType
            this.currentTrace.addStep(step)

            if (this.currentTrace.getStepCount() % 100 === 0) {
                appendTerminalDebug(`Recorded ${this.currentTrace.getStepCount()} execution steps`)
            }
        } catch (error) {
            appendTerminalDebug('Failed to record step: ' + error)
        }
    }

    /**
     * Get execution hooks for runtime integration
     */
    getExecutionHooks() {
        if (!this.isRecording) {
            return null
        }

        return {
            onExecutionStep: (lineNumber, variables, scope) => {
                this.recordStep(lineNumber, variables, scope)
            },
            onExecutionComplete: () => {
                this.finalizeRecording()
            },
            onExecutionError: (error) => {
                appendTerminalDebug('Execution error during recording: ' + error)

                // CRITICAL FIX: Also display the error in the terminal, not just debug logs
                // The error contains the traceback that the user needs to see
                if (error && typeof error === 'object' && error.message) {
                    // For Error objects, try to extract and map the traceback
                    const errorMessage = error.message || String(error)
                    if (errorMessage.includes('Traceback') || errorMessage.includes('Error:')) {
                        // This looks like a Python error that should be mapped and displayed
                        try {
                            // Import the mapping function and terminal utilities
                            import('./terminal.js').then(terminalModule => {
                                const { appendTerminal } = terminalModule
                                import('./code-transform.js').then(transformModule => {
                                    const { mapTracebackAndShow } = transformModule
                                    // Get the header lines from the last execution context
                                    const headerLines = (window.__ssg_last_mapped_event && window.__ssg_last_mapped_event.headerLines) || 0
                                    appendTerminalDebug(`Mapping error with headerLines: ${headerLines}`)
                                    const mapped = mapTracebackAndShow(errorMessage, headerLines, '/main.py')
                                    if (mapped) {
                                        appendTerminal(mapped, 'stderr')
                                    } else {
                                        appendTerminal(errorMessage, 'stderr')
                                    }
                                }).catch(() => {
                                    // Fallback: just display the raw error
                                    appendTerminal(errorMessage, 'stderr')
                                })
                            }).catch(() => {
                                // Fallback: display raw error if imports fail
                                console.error('Recording error:', error)
                            })
                        } catch (e) {
                            // Last resort: console log
                            console.error('Failed to display recording error:', error)
                        }
                    }
                } else {
                    // For string errors, display them directly
                    const errorStr = String(error)
                    if (errorStr.includes('Traceback') || errorStr.includes('Error:')) {
                        try {
                            import('./terminal.js').then(terminalModule => {
                                const { appendTerminal } = terminalModule
                                appendTerminal(errorStr, 'stderr')
                            })
                        } catch (e) {
                            console.error('Recording error display failed:', error)
                        }
                    }
                }

                this.finalizeRecording()
            }
        }
    }

    /**
     * Check if currently recording
     */
    isCurrentlyRecording() {
        return this.isRecording
    }

    /**
     * Check if there's an active recording available
     */
    hasActiveRecording() {
        return this.currentTrace !== null && this.currentTrace.getStepCount() > 0
    }

    /**
     * Get the current execution trace
     */
    getTrace() {
        return this.currentTrace
    }

    /**
     * Invalidate current recording (called when code changes)
     */
    invalidateRecording() {
        if (this.hasActiveRecording()) {
            appendTerminalDebug('Recording invalidated due to code changes')
            this.clearRecording()
        }
    }

    /**
     * Configure recording limits
     */
    setConfig(newConfig) {
        this.config = { ...this.config, ...newConfig }
    }

    /**
     * Enable or disable recording
     */
    setEnabled(enabled) {
        this.recordingEnabled = enabled
        if (!enabled && this.isRecording) {
            this.stopRecording()
        }
    }
}

// Global instance
let globalRecorder = null

/**
 * Get the global execution recorder instance
 */
export function getExecutionRecorder() {
    if (!globalRecorder) {
        globalRecorder = new ExecutionRecorder()
    }
    return globalRecorder
}

/**
 * Configure the recorder based on the provided config
 */
export function configureExecutionRecorder(config) {
    const recorder = getExecutionRecorder()

    try {
        const recordReplayFeature = config?.features?.recordReplay
        appendTerminalDebug(`Configuring recorder - config exists: ${!!config}, recordReplay: ${recordReplayFeature}`)

        if (config?.features?.recordReplay !== false) {
            const limits = config?.features?.recordingLimits || {}
            recorder.setConfig(limits)
            recorder.setEnabled(true)
            appendTerminalDebug('Execution recorder enabled with config')
        } else {
            recorder.setEnabled(false)
            appendTerminalDebug('Execution recorder disabled by config')
        }
    } catch (error) {
        appendTerminalDebug('Failed to configure recorder: ' + error)
    }

    return recorder
}

/**
 * Initialize the execution recorder system
 */
export function initializeExecutionRecorder() {
    const recorder = getExecutionRecorder()

    // Expose globally for integration with other modules
    window.ExecutionRecorder = recorder

    // Configure based on current config if available
    const config = window.currentConfig || (window.Config && window.Config.current)
    configureExecutionRecorder(config)

    // Set up automatic cleanup when editor content changes
    try {
        if (window.cm && typeof window.cm.on === 'function') {
            window.cm.on('change', () => {
                // Debounce to avoid clearing on every keystroke
                clearTimeout(window.__ssg_invalidate_timeout)
                window.__ssg_invalidate_timeout = setTimeout(() => {
                    if (recorder.hasActiveRecording()) {
                        recorder.invalidateRecording()
                    }
                }, 500) // 500ms delay
            })
            appendTerminalDebug('Auto-invalidation on editor change enabled')
        }
    } catch (e) {
        appendTerminalDebug('Failed to setup auto-invalidation: ' + e)
    }

    return recorder
}
