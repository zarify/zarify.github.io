// Real execution instrumentation for record/replay debugging
import { appendTerminalDebug } from './terminal.js'
import { getPythonASTAnalyzer } from './python-ast-analyzer.js'

/**
 * Instrument Python source code t                    instrumentedLines.push(`${indent}    _trace_execution(${originalLineNumber}, _trace_vars, _trace_filename)`)
                    instrumentedLines.push(`${indent}except Exception as _trace_err:`)
                    instrumentedLines.push(`${indent}    print(f"[TRACE CAPTURE ERROR] Line ${originalLineNumber}: {_trace_err}")`)

                    // Now add the return statement itself
                    instrumentedLines.push(lines[i])ure execution traces
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
    async instrumentCode(sourceCode, runtimeAdapter = null, filename = '/main.py') {
        try {
            appendTerminalDebug(`Instrumenting Python code for execution tracing: ${filename}`)

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
            instrumentedLines.push(`_trace_filename = ${JSON.stringify(filename)}`)
            instrumentedLines.push('')

            // Add trace function with multiple communication methods
            instrumentedLines.push('def _trace_execution(line_no, vars_dict, filename):')
            instrumentedLines.push('    try:')
            instrumentedLines.push('        # Method 1: Try MicroPython js module')
            instrumentedLines.push('        try:')
            instrumentedLines.push('            import js')
            instrumentedLines.push('            if hasattr(js, "_record_execution_step"):')
            instrumentedLines.push('                js._record_execution_step(line_no, vars_dict, filename)')
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
            instrumentedLines.push('            trace_data = {"__TRACE__": {"line": line_no, "vars": vars_dict, "file": filename}}')
            instrumentedLines.push('            print(f"[TRACE_DATA_CREATED] {type(trace_data)}")  # Debug: data object created')
            instrumentedLines.push('            json_str = json.dumps(trace_data)')
            instrumentedLines.push('            print(f"[TRACE_JSON_DUMPS_OK] length={len(json_str)}")  # Debug: JSON conversion worked')
            instrumentedLines.push('            print("__EXECUTION_TRACE__" + json_str)')
            instrumentedLines.push('            print(f"[TRACE_JSON_SENT] Line {line_no} in {filename}")  # Debug: JSON sent')
            instrumentedLines.push('        except Exception as json_err:')
            instrumentedLines.push('            print(f"[TRACE JSON ERROR] Line {line_no} in {filename}: {type(json_err).__name__}: {json_err}")')
            instrumentedLines.push('    except Exception as e:')
            instrumentedLines.push('        print(f"[TRACE ERROR] Line {line_no} in {filename}: {e}")  # Show tracing errors')
            instrumentedLines.push('')

            // Record how many header lines we've added before the user's code
            const headerLinesBeforeUserCode = instrumentedLines.length

            // Collect all variable names from AST analysis to use for explicit capturing
            const allVariableNames = new Set()
            const astFoundVariables = this.astAnalyzer && this.astAnalyzer.lineVariableMap && this.astAnalyzer.lineVariableMap.size > 0

            if (astFoundVariables) {
                // Use AST analysis results (preferred - most accurate)
                const builtins = new Set(['print', 'range', 'len', 'str', 'int', 'float', 'list', 'dict', 'set',
                    'tuple', 'bool', 'type', 'isinstance', 'hasattr', 'getattr', 'setattr',
                    'min', 'max', 'sum', 'abs', 'round', 'sorted', 'reversed', 'enumerate',
                    'zip', 'map', 'filter', 'any', 'all', 'open', 'input', 'repr', 'chr', 'ord'])

                for (const [lineNum, info] of this.astAnalyzer.lineVariableMap) {
                    for (const varName of info.defined) {
                        if (!builtins.has(varName)) {
                            allVariableNames.add(varName)
                        }
                    }
                    for (const varName of info.used) {
                        if (!builtins.has(varName)) {
                            allVariableNames.add(varName)
                        }
                    }
                }
                appendTerminalDebug(`AST analysis found ${allVariableNames.size} variables: ${Array.from(allVariableNames).join(', ')}`)
            }

            // If AST analysis didn't find variables, extract them heuristically from source
            if (allVariableNames.size === 0) {
                console.warn('🔍 HEURISTIC FALLBACK - AST found no variables')
                appendTerminalDebug('AST analysis found no variables, using heuristic extraction')

                // Extract variable names from source code using regex patterns
                const varPattern = /\b([a-z_][a-z0-9_]*)\b/gi
                const matches = sourceCode.matchAll(varPattern)

                // Also identify loop variables in comprehensions to exclude them
                // Matches list [x for x in ...], generator (x for x in ...), 
                // dict {k:v for k,v in ...}, set {x for x in ...}, and nested comprehensions
                const comprehensionLoopVars = new Set()
                const comprehensionPattern = /[\[\{(].*?\bfor\s+([a-zA-Z_]\w*)\s+in\b.*?[\]\})]/gi
                for (const match of sourceCode.matchAll(comprehensionPattern)) {
                    comprehensionLoopVars.add(match[1])
                }

                // Also extract lambda parameters to exclude them
                const lambdaParams = new Set()
                const lambdaPattern = /\blambda\s+([^:]+):/g
                for (const match of sourceCode.matchAll(lambdaPattern)) {
                    // Parse lambda parameters (can be: lambda x: ..., lambda x,y: ..., lambda x,y,z: ...)
                    const params = match[1].split(',').map(p => p.trim().split('=')[0].trim())
                    params.forEach(p => lambdaParams.add(p))
                }

                for (const match of matches) {
                    const varName = match[1]
                    // Skip Python keywords and builtins
                    const keywords = ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally',
                        'with', 'as', 'import', 'from', 'return', 'yield', 'pass', 'break', 'continue',
                        'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False', 'lambda', 'global', 'nonlocal', 'assert',
                        'print', 'range', 'len', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple',
                        'isinstance', 'type', 'hasattr', 'getattr', 'setattr', 'repr']
                    // Skip loop variables from comprehensions and lambda parameters (misleading - only shows last value)
                    if (!keywords.includes(varName) && !comprehensionLoopVars.has(varName) && !lambdaParams.has(varName)) {
                        allVariableNames.add(varName)
                    }
                }
                console.log(`🔍 Heuristic extraction found ${allVariableNames.size} potential variables:`, Array.from(allVariableNames))
                appendTerminalDebug(`Heuristic extraction found ${allVariableNames.size} potential variables`)
            }

            const hasVariableNames = allVariableNames.size > 0
            if (hasVariableNames) {
                appendTerminalDebug(`Using ${allVariableNames.size} variables for explicit capture: ${Array.from(allVariableNames).join(', ')}`)
            } else {
                appendTerminalDebug('Warning: No variables found, will use locals() fallback')
            }

            // Instrument each line
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim()
                const originalLineNumber = i + 1 // Keep original line numbers for display

                if (line === '' || line.startsWith('#')) {
                    instrumentedLines.push(lines[i])
                    continue
                }

                // Check if this is a return statement (needs special handling)
                const isReturnStatement = line.startsWith('return ')

                // For return statements, add tracing BEFORE the return
                // For other statements, add tracing AFTER the statement
                if (isReturnStatement && this.isExecutableLine(line)) {
                    const indent = this.getIndentation(lines[i])

                    // Add trace code BEFORE the return statement
                    instrumentedLines.push(`${indent}try:`)
                    instrumentedLines.push(`${indent}    # Capture variables before return`)
                    instrumentedLines.push(`${indent}    _trace_vars = {}`)

                    if (hasVariableNames) {
                        for (const varName of allVariableNames) {
                            if (varName.startsWith('_')) continue
                            instrumentedLines.push(`${indent}    try:`)
                            instrumentedLines.push(`${indent}        ${varName}`)
                            instrumentedLines.push(`${indent}        if isinstance(${varName}, str):`)
                            instrumentedLines.push(`${indent}            _trace_vars['${varName}'] = repr(${varName})`)
                            instrumentedLines.push(`${indent}        elif isinstance(${varName}, (int, float, bool)):`)
                            instrumentedLines.push(`${indent}            _trace_vars['${varName}'] = ${varName}`)
                            instrumentedLines.push(`${indent}        elif ${varName} is None:`)
                            instrumentedLines.push(`${indent}            _trace_vars['${varName}'] = None`)
                            instrumentedLines.push(`${indent}        else:`)
                            instrumentedLines.push(`${indent}            _trace_vars['${varName}'] = repr(${varName})`)
                            instrumentedLines.push(`${indent}    except: pass`)
                        }
                    } else {
                        instrumentedLines.push(`${indent}    _local_vars = locals()`)
                        instrumentedLines.push(`${indent}    for _var_name in _local_vars:`)
                        instrumentedLines.push(`${indent}        if not _var_name.startswith('_'):`)
                        instrumentedLines.push(`${indent}            try:`)
                        instrumentedLines.push(`${indent}                _var_value = _local_vars[_var_name]`)
                        instrumentedLines.push(`${indent}                if isinstance(_var_value, str):`)
                        instrumentedLines.push(`${indent}                    _trace_vars[_var_name] = repr(_var_value)`)
                        instrumentedLines.push(`${indent}                elif isinstance(_var_value, (int, float, bool)):`)
                        instrumentedLines.push(`${indent}                    _trace_vars[_var_name] = _var_value`)
                        instrumentedLines.push(`${indent}                elif _var_value is None:`)
                        instrumentedLines.push(`${indent}                    _trace_vars[_var_name] = None`)
                        instrumentedLines.push(`${indent}                else:`)
                        instrumentedLines.push(`${indent}                    _trace_vars[_var_name] = repr(_var_value)`)
                        instrumentedLines.push(`${indent}            except: pass`)
                    }

                    instrumentedLines.push(`${indent}    _trace_execution(${originalLineNumber}, _trace_vars, _trace_filename)`)
                    instrumentedLines.push(`${indent}except Exception as _trace_err:`)
                    instrumentedLines.push(`${indent}    print(f"[TRACE CAPTURE ERROR] Line ${originalLineNumber}: {_trace_err}")`)

                    // Now add the return statement itself
                    instrumentedLines.push(lines[i])
                } else {
                    // Add the original line first
                    instrumentedLines.push(lines[i])

                    // Add tracing call after executable lines (for non-return statements)
                    if (this.isExecutableLine(line)) {
                        const indent = this.getIndentation(lines[i])

                        instrumentedLines.push(`${indent}try:`)
                        instrumentedLines.push(`${indent}    # Capture variables after line execution`)
                        instrumentedLines.push(`${indent}    _trace_vars = {}`)

                        if (hasVariableNames) {
                            // Method 1: Explicit variable capture by name (MicroPython-compatible)
                            // This works around MicroPython's limitation where locals() only returns globals in functions
                            for (const varName of allVariableNames) {
                                // Skip variables that start with underscore (internal)
                                if (varName.startsWith('_')) continue

                                instrumentedLines.push(`${indent}    try:`)
                                instrumentedLines.push(`${indent}        ${varName}  # Reference to check if variable exists`)
                                instrumentedLines.push(`${indent}        # Store value with proper representation`)
                                instrumentedLines.push(`${indent}        if isinstance(${varName}, str):`)
                                instrumentedLines.push(`${indent}            _trace_vars['${varName}'] = repr(${varName})`)
                                instrumentedLines.push(`${indent}        elif isinstance(${varName}, (int, float, bool)):`)
                                instrumentedLines.push(`${indent}            _trace_vars['${varName}'] = ${varName}`)
                                instrumentedLines.push(`${indent}        elif ${varName} is None:`)
                                instrumentedLines.push(`${indent}            _trace_vars['${varName}'] = None`)
                                instrumentedLines.push(`${indent}        else:`)
                                instrumentedLines.push(`${indent}            _trace_vars['${varName}'] = repr(${varName})`)
                                instrumentedLines.push(`${indent}    except: pass  # Variable doesn't exist in this scope`)
                            }
                        } else {
                            // Method 2: Fallback using globals() + locals() attempt
                            // Note: locals() doesn't work in MicroPython functions, but at least works at module level
                            instrumentedLines.push(`${indent}    _local_vars = locals()`)
                            instrumentedLines.push(`${indent}    for _var_name in _local_vars:`)
                            instrumentedLines.push(`${indent}        if not _var_name.startswith('_'):`)
                            instrumentedLines.push(`${indent}            try:`)
                            instrumentedLines.push(`${indent}                _var_value = _local_vars[_var_name]`)
                            instrumentedLines.push(`${indent}                if isinstance(_var_value, str):`)
                            instrumentedLines.push(`${indent}                    _trace_vars[_var_name] = repr(_var_value)`)
                            instrumentedLines.push(`${indent}                elif isinstance(_var_value, (int, float, bool)):`)
                            instrumentedLines.push(`${indent}                    _trace_vars[_var_name] = _var_value`)
                            instrumentedLines.push(`${indent}                elif _var_value is None:`)
                            instrumentedLines.push(`${indent}                    _trace_vars[_var_name] = None`)
                            instrumentedLines.push(`${indent}                else:`)
                            instrumentedLines.push(`${indent}                    _trace_vars[_var_name] = repr(_var_value)`)
                            instrumentedLines.push(`${indent}            except: pass`)
                        }

                        instrumentedLines.push(`${indent}    _trace_execution(${originalLineNumber}, _trace_vars, _trace_filename)`)
                        instrumentedLines.push(`${indent}except Exception as _trace_err:`)
                        instrumentedLines.push(`${indent}    print(f"[TRACE CAPTURE ERROR] Line ${originalLineNumber}: {_trace_err}")`)
                    }
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
        const skipKeywords = ['def ', 'class ', 'if ', 'elif ', 'else:', 'try:', 'except:', 'finally:',
            'with ', 'for ', 'while ', 'global ', 'nonlocal ', 'lambda ', 'assert ']
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
        window._record_execution_step = (lineNumber, varsDict, filename) => {
            try {
                const file = filename || '/main.py'
                appendTerminalDebug(`JS Trace callback: Line ${lineNumber} in ${file}, raw vars: ${JSON.stringify(varsDict)}`)

                if (!this.hooks) {
                    appendTerminalDebug('No hooks available for recording')
                    return
                }

                // Convert Python variables dict to Map
                const allVariables = new Map()
                if (varsDict && typeof varsDict === 'object') {
                    appendTerminalDebug(`Processing ${Object.keys(varsDict).length} variables from Python`)
                    for (const [name, value] of Object.entries(varsDict)) {
                        // Filter out internal variables and module objects (noise for students)
                        const isInternalVar = name.startsWith('_') || name === 'k'
                        const isModuleObject = typeof value === 'string' && value.startsWith('<module ')

                        if (!isInternalVar && !isModuleObject) {
                            allVariables.set(name, value)
                            appendTerminalDebug(`Added variable: ${name} = ${value}`)
                        } else {
                            appendTerminalDebug(`Filtered out variable: ${name} (internal=${isInternalVar}, module=${isModuleObject})`)
                        }
                    }
                }

                // Show ALL captured variables, not just AST-relevant ones
                // Since we're explicitly capturing by name, if a variable was captured,
                // it's because it exists in scope and should be shown
                appendTerminalDebug(`Trace: Line ${lineNumber} in ${file}, captured ${allVariables.size} variables: ${Array.from(allVariables.keys()).join(', ')}`)

                // Call the recording hook with ALL captured variables AND the filename
                if (this.hooks.onExecutionStep) {
                    this.hooks.onExecutionStep(lineNumber, allVariables, 'global', file)
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