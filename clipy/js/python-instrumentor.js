// Real execution instrumentation for record/replay debugging
import { appendTerminalDebug } from './terminal.js'
import { getPythonASTAnalyzer } from './python-ast-analyzer.js'

/**
 * Instrument Python source code to capture execution traces
 */
export class PythonInstrumentor {
    constructor() {
        this.hooks = null
        this.lineCounter = 0
        this.variableState = new Map()
        this.astAnalyzer = getPythonASTAnalyzer()
        this.sourceCode = ''
    }

    /**
     * Set execution hooks for recording
     */
    setHooks(hooks) {
        this.hooks = hooks
        this.lineCounter = 0
        this.variableState.clear()
    }

    /**
     * Instrument Python source code to add tracing
     */
    async instrumentCode(sourceCode, runtimeAdapter = null) {
        try {
            appendTerminalDebug('Instrumenting Python code for execution tracing')

            this.sourceCode = sourceCode

            // First, analyze the AST to understand variable usage per line
            // This now uses JavaScript AST analysis instead of Python
            await this.astAnalyzer.analyzeSource(sourceCode, runtimeAdapter)

            const lines = sourceCode.split('\n')
            const instrumentedLines = []

            // Add tracing setup at the start
            instrumentedLines.push('# Execution tracing setup')
            instrumentedLines.push('import sys')
            instrumentedLines.push('_trace_vars = {}')
            instrumentedLines.push('')

            // Add trace function with multiple communication methods
            instrumentedLines.push('def _trace_execution(line_no, vars_dict):')
            instrumentedLines.push('    try:')
            instrumentedLines.push('        # Method 1: Try MicroPython js module')
            instrumentedLines.push('        try:')
            instrumentedLines.push('            import js')
            instrumentedLines.push('            if hasattr(js, "_record_execution_step"):')
            instrumentedLines.push('                js._record_execution_step(line_no, vars_dict)')
            instrumentedLines.push('                return')
            instrumentedLines.push('        except: pass')
            instrumentedLines.push('        ')
            instrumentedLines.push('        # Method 2: Print structured data that can be parsed')
            instrumentedLines.push('        print("[TRACE_JSON_START]")  # Debug marker')
            instrumentedLines.push('        try:')
            instrumentedLines.push('            import json')
            instrumentedLines.push('            print("[TRACE_JSON_IMPORT_OK]")  # Debug: json import worked')
            instrumentedLines.push('        except Exception as import_err:')
            instrumentedLines.push('            print(f"[TRACE_JSON_IMPORT_ERROR] {import_err}")')
            instrumentedLines.push('            return  # Skip JSON if import failed')
            instrumentedLines.push('        ')
            instrumentedLines.push('        try:')
            instrumentedLines.push('            trace_data = {"__TRACE__": {"line": line_no, "vars": vars_dict}}')
            instrumentedLines.push('            print(f"[TRACE_DATA_CREATED] {type(trace_data)}")  # Debug: data object created')
            instrumentedLines.push('            json_str = json.dumps(trace_data)')
            instrumentedLines.push('            print(f"[TRACE_JSON_DUMPS_OK] length={len(json_str)}")  # Debug: JSON conversion worked')
            instrumentedLines.push('            print("__EXECUTION_TRACE__" + json_str)')
            instrumentedLines.push('            print(f"[TRACE_JSON_SENT] Line {line_no}")  # Debug: JSON sent')
            instrumentedLines.push('        except Exception as json_err:')
            instrumentedLines.push('            print(f"[TRACE JSON ERROR] Line {line_no}: {type(json_err).__name__}: {json_err}")')
            instrumentedLines.push('    except Exception as e:')
            instrumentedLines.push('        print(f"[TRACE ERROR] Line {line_no}: {e}")  # Show tracing errors')
            instrumentedLines.push('')

            // Record how many header lines we've added before the user's code
            const headerLinesBeforeUserCode = instrumentedLines.length

            // Instrument each line
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim()
                const originalLineNumber = i + 1 // Keep original line numbers for display

                if (line === '' || line.startsWith('#')) {
                    instrumentedLines.push(lines[i])
                    continue
                }

                // Add the original line first
                instrumentedLines.push(lines[i])

                // Add tracing call after executable lines
                if (this.isExecutableLine(line)) {
                    const indent = this.getIndentation(lines[i])

                    // Capture local variables and trace with ORIGINAL line number
                    instrumentedLines.push(`${indent}try:`)
                    instrumentedLines.push(`${indent}    # Capture variables after line execution`)
                    instrumentedLines.push(`${indent}    _local_vars = locals()`)
                    instrumentedLines.push(`${indent}    _trace_vars = {}`)
                    instrumentedLines.push(`${indent}    for _var_name in _local_vars:`)
                    instrumentedLines.push(`${indent}        if not _var_name.startswith('_'):`)
                    instrumentedLines.push(`${indent}            try:`)
                    instrumentedLines.push(`${indent}                _var_value = _local_vars[_var_name]`)
                    instrumentedLines.push(`${indent}                # Store values with proper representation for display`)
                    instrumentedLines.push(`${indent}                if isinstance(_var_value, str):`)
                    instrumentedLines.push(`${indent}                    _trace_vars[_var_name] = repr(_var_value)  # Keep quotes for strings`)
                    instrumentedLines.push(`${indent}                elif isinstance(_var_value, (int, float, bool)):`)
                    instrumentedLines.push(`${indent}                    _trace_vars[_var_name] = _var_value  # Store primitives as-is`)
                    instrumentedLines.push(`${indent}                elif _var_value is None:`)
                    instrumentedLines.push(`${indent}                    _trace_vars[_var_name] = None`)
                    instrumentedLines.push(`${indent}                else:`)
                    instrumentedLines.push(`${indent}                    _trace_vars[_var_name] = repr(_var_value)  # Use repr for complex types`)
                    instrumentedLines.push(`${indent}            except Exception as _repr_err:`)
                    instrumentedLines.push(`${indent}                _trace_vars[_var_name] = f'<error: {_repr_err}>'`)
                    instrumentedLines.push(`${indent}    _trace_execution(${originalLineNumber}, _trace_vars)`)
                    instrumentedLines.push(`${indent}except Exception as _trace_err:`)
                    instrumentedLines.push(`${indent}    print(f"[TRACE CAPTURE ERROR] Line ${originalLineNumber}: {_trace_err}")`)
                }
            }

            const instrumentedCode = instrumentedLines.join('\n')
            appendTerminalDebug(`Instrumented ${lines.length} lines of Python code`)

            // Calculate the actual headerLines by finding where the first user line appears
            // in the final instrumented code
            const instrumentedCodeLines = instrumentedCode.split('\n')
            const firstUserLine = lines[0]
            let actualHeaderLines = headerLinesBeforeUserCode

            // Find where the first user line actually appears in the instrumented code
            for (let i = headerLinesBeforeUserCode; i < instrumentedCodeLines.length; i++) {
                try {
                    if (instrumentedCodeLines[i].trim() === String(firstUserLine).trim()) {
                        actualHeaderLines = i
                        break
                    }
                } catch (_e) { }
            }

            // Build an explicit instrumented-line -> original-line mapping so
            // callers can accurately map tracebacks back to the user's source
            // even when instrumentation inserts extra lines between user lines.
            const instrumentedToOriginal = {}
            try {
                // More robust mapping: search for the trimmed original line text
                // within the instrumented code lines. This handles indentation
                // and wrapper/header differences that change leading whitespace.
                let searchPos = 0
                for (let origIdx = 0; origIdx < lines.length; origIdx++) {
                    const target = String(lines[origIdx] || '').trim()
                    if (!target) continue // skip blank original lines
                    for (let i = searchPos; i < instrumentedCodeLines.length; i++) {
                        try {
                            if (String(instrumentedCodeLines[i] || '').trim() === target) {
                                instrumentedToOriginal[i + 1] = origIdx + 1
                                searchPos = i + 1
                                break
                            }
                        } catch (_e) { }
                    }
                }
            } catch (_e) { /* best-effort; ignore mapping failures */ }

            appendTerminalDebug(`Instrumentation: ${headerLinesBeforeUserCode} lines before user code, first user line found at position ${actualHeaderLines}`)
            appendTerminalDebug(`Total instrumented lines: ${instrumentedCodeLines.length}, original lines: ${lines.length}`)

            // Debug: show the instrumented code (disabled for cleaner output)
            if (window.__SSG_DEBUG_INSTRUMENTATION) {
                console.log('=== INSTRUMENTED CODE ===')
                console.log(instrumentedCode)
                console.log('=== END INSTRUMENTED CODE ===')
            }

            // Return both the instrumented code and how many header lines were
            // prepended so callers (traceback mapping) can adjust line numbers.
            // Also return an explicit instrumented->original line map for
            // accurate mappings when tracing has injected extra lines.
            return { code: instrumentedCode, headerLines: actualHeaderLines, lineMap: instrumentedToOriginal }

        } catch (error) {
            appendTerminalDebug('Failed to instrument Python code: ' + error)
            return sourceCode // Return original on error
        }
    }

    /**
     * Check if a line is executable (not just a comment or empty)
     */
    isExecutableLine(line) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === '') return false
        if (trimmed.startsWith('#')) return false

        // Skip control flow keywords that don't execute immediately
        const skipKeywords = ['def ', 'class ', 'if ', 'elif ', 'else:', 'try:', 'except:', 'finally:', 'with ', 'for ', 'while ']
        for (const keyword of skipKeywords) {
            if (trimmed.startsWith(keyword)) return false
        }

        // Include assignment statements (this is the key fix for input() assignments)
        const includePatterns = [
            /^\w+\s*=.*/, // assignment statements (including name = input(...))
            /^print\s*\(/, // print calls  
            /^\w+\(/, // function calls
            /^return\s+/, // return statements
            /^import\s+/, // import statements
            /^from\s+.*import/, // from...import statements
        ]

        for (const pattern of includePatterns) {
            if (pattern.test(trimmed)) return true
        }

        // If it's not a skip keyword and looks like an expression, include it
        return trimmed.length > 0 && !trimmed.endsWith(':')
    }

    /**
     * Get indentation level of a line
     */
    getIndentation(line) {
        const match = line.match(/^(\s*)/)
        return match ? match[1] : ''
    }

    /**
     * Set up JavaScript callback for receiving trace data
     */
    setupTraceCallback() {
        // Create a global function that Python can call
        window._record_execution_step = (lineNumber, varsDict) => {
            try {
                appendTerminalDebug(`JS Trace callback: Line ${lineNumber}, raw vars: ${JSON.stringify(varsDict)}`)

                if (!this.hooks) {
                    appendTerminalDebug('No hooks available for recording')
                    return
                }

                // Convert Python variables dict to Map
                const allVariables = new Map()
                if (varsDict && typeof varsDict === 'object') {
                    appendTerminalDebug(`Processing ${Object.keys(varsDict).length} variables from Python`)
                    for (const [name, value] of Object.entries(varsDict)) {
                        // Include ALL user variables now, with less aggressive filtering
                        if (!name.startsWith('_') && name !== 'k') { // Only filter obvious internal vars
                            allVariables.set(name, value)
                            appendTerminalDebug(`Added variable: ${name} = ${value}`)
                        } else {
                            appendTerminalDebug(`Filtered out variable: ${name}`)
                        }
                    }
                }

                // Use AST analyzer to get only relevant variables for this line
                const relevantVariables = this.astAnalyzer.getRelevantVariables(lineNumber, allVariables)

                appendTerminalDebug(`Trace: Line ${lineNumber}, All vars: ${allVariables.size}, Relevant: ${relevantVariables.size}`)
                appendTerminalDebug(`Relevant variables: ${JSON.stringify(Object.fromEntries(relevantVariables))}`)

                // Call the recording hook with filtered variables
                if (this.hooks.onExecutionStep) {
                    this.hooks.onExecutionStep(lineNumber, relevantVariables, 'global')
                } else {
                    appendTerminalDebug('No onExecutionStep hook available')
                }

            } catch (error) {
                appendTerminalDebug('Error in trace callback: ' + error)
            }
        }

        appendTerminalDebug('Python trace callback setup complete')
    }

    /**
     * Clean up tracing
     */
    cleanup() {
        delete window._record_execution_step
        this.hooks = null
        this.variableState.clear()
        this.astAnalyzer.clear()
        this.sourceCode = ''
        // Clear any exported mapping helper
        try { delete this._lastLineMap } catch (_e) { }
        appendTerminalDebug('Python instrumentation cleanup complete')
    }
}

// Global instance
let globalInstrumentor = null

/**
 * Get the global Python instrumentor
 */
export function getPythonInstrumentor() {
    if (!globalInstrumentor) {
        globalInstrumentor = new PythonInstrumentor()
    }
    return globalInstrumentor
}