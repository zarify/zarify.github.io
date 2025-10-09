// Execution recording and replay system for debugging
import { appendTerminalDebug } from './terminal.js'
import { getFileManager } from './vfs-client.js'
import { normalizeFilename, makeLineKey } from './utils.js'

/**
 * Python bridge code for native sys.settrace() integration
 * This is injected once to enable native tracing via JavaScript callbacks
 */
const SETTRACE_BRIDGE_CODE = `
import sys

def _settrace_js_bridge(frame, event, arg):
    """Bridge sys.settrace to JavaScript _record_execution_step"""
    # Capture both 'line' and 'return' events to test if RETURN has correct values
    # Testing hypothesis: RETURN events may have correct f_locals unlike LINE events
    if event not in ('line', 'return'):
        return _settrace_js_bridge
    
    try:
        # Get execution context
        line_no = frame.f_lineno
        filename = frame.f_code.co_filename
        
        # Get variables from frame.f_locals
        # IMPORTANT: Our custom MicroPython implementation returns:
        # - At module level: globals dict
        # - Inside functions: parameters (by name) + local variables (as local_0, local_1, etc.)
        # See plan/MISSION_ACCOMPLISHED.md for details
        #
        # CRITICAL BUG: MicroPython VM has a bug where f_locals is cached and not refreshed
        # on backward jumps (loops). This causes ALL trace events to show stale values.
        # Values lag by exactly one iteration.
        #
        # Attempted workarounds (all failed):
        # - Accessing frame.f_code to trigger refresh: FAILED
        # - Calling locals() via eval: FAILED  
        # - Using RETURN events: FAILED (they also have stale f_locals)
        #
        # This appears to be an unfixable MicroPython VM bug. The only solution would be
        # to fix it in the MicroPython C code itself.
        #
        # Current workaround: Use two-steps-ahead look-ahead in replay (see replay-ui.js)
        locals_dict = frame.f_locals or {}
        
        # Build the variables dictionary
        vars_dict = {}
        
        for name in list(locals_dict.keys()):
            # Skip internal variables (but NOT local_N which we need!)
            if name.startswith('_'):
                continue
            
            value = locals_dict[name]
            
            # Skip module objects and internal runtime vars
            try:
                val_type = str(type(value))
                if "<class 'module'" in val_type or "<module" in val_type:
                    continue
                # Skip common internal runtime names
                if name in ('js', 'gc', 'sys', 'm', 'has_settrace', 'name'):
                    continue
            except:
                pass
            
            # Convert to serializable form
            try:
                if isinstance(value, str):
                    vars_dict[name] = repr(value)
                elif isinstance(value, (int, float, bool)):
                    vars_dict[name] = value
                elif value is None:
                    vars_dict[name] = None
                elif isinstance(value, (list, tuple, dict)):
                    vars_dict[name] = repr(value)
                else:
                    vars_dict[name] = repr(value)
            except:
                vars_dict[name] = str(type(value))
        
        # Call JavaScript callback
        try:
            import js
            if hasattr(js, '_record_execution_step'):
                js._record_execution_step(line_no, vars_dict, filename, event)
        except Exception as e:
            # Silently ignore JS callback errors
            pass
    
    except Exception as e:
        # Silently ignore trace errors to avoid breaking user code
        pass
    
    return _settrace_js_bridge

# Enable tracing
sys.settrace(_settrace_js_bridge)
`

/**
 * Enable native sys.settrace() tracing
 * @param {Object} adapter - Runtime adapter
 * @returns {Promise<void>}
 */
export async function enableNativeTrace(adapter) {
    if (!adapter || typeof adapter.run !== 'function') {
        const err = 'Invalid runtime adapter for native trace'
        appendTerminalDebug(`❌ ${err}`)
        throw new Error(err)
    }

    appendTerminalDebug('📝 Installing native sys.settrace bridge code...')
    try {
        await adapter.run(SETTRACE_BRIDGE_CODE)
        appendTerminalDebug('✅ Native sys.settrace bridge installed successfully')
    } catch (err) {
        appendTerminalDebug('❌ Failed to install native trace bridge: ' + err)
        throw err
    }
}

/**
 * Disable native sys.settrace() tracing
 * @param {Object} adapter - Runtime adapter
 * @returns {Promise<void>}
 */
export async function disableNativeTrace(adapter) {
    if (!adapter || typeof adapter.run !== 'function') {
        throw new Error('Invalid runtime adapter for native trace')
    }

    try {
        await adapter.run('import sys; sys.settrace(None)')
        appendTerminalDebug('Native sys.settrace disabled')
    } catch (err) {
        appendTerminalDebug('Failed to disable native trace: ' + err)
        throw err
    }
}

/**
 * Data structure representing a single execution step
 */
export class ExecutionStep {
    constructor(lineNumber, variables = new Map(), scope = 'global', timestamp = null, filename = null) {
        this.lineNumber = lineNumber      // 1-based line number
        // Normalize variables to Map regardless of whether callers pass a Map or plain object
        if (variables instanceof Map) {
            this.variables = variables
        } else if (variables && typeof variables === 'object') {
            const m = new Map()
            try {
                for (const k of Object.keys(variables)) {
                    m.set(k, variables[k])
                }
            } catch (e) {
                // If conversion fails, fall back to empty Map
            }
            this.variables = m
        } else {
            this.variables = new Map()
        }
        this.scope = scope               // 'global', 'function:name', etc.
        this.timestamp = timestamp || performance.now()
        this.stackDepth = 0             // Function call depth
        this.executionType = 'line'     // 'line', 'call', 'return', 'exception'
        this.filename = filename || '/main.py'  // File path where this step occurred
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
     * Debug helper: return a JSON-serializable snapshot of the current trace
     * with simplified variable values. Useful for debugging why names like
     * `n` are not present on collapsed comprehension steps.
     */
    dumpCurrentTrace() {
        if (!this.currentTrace) return null
        const out = {
            steps: [],
            metadata: this.currentTrace.metadata || {}
        }
        for (let i = 0; i < this.currentTrace.getStepCount(); i++) {
            const s = this.currentTrace.getStep(i)
            const vars = {}
            try {
                if (s && s.variables) {
                    if (s.variables && typeof s.variables.entries === 'function') {
                        for (const [k, v] of s.variables.entries()) {
                            vars[k] = VariableStateCapture.simplifyValue(v)
                        }
                    } else if (s.variables && typeof s.variables === 'object') {
                        for (const k of Object.keys(s.variables)) {
                            vars[k] = VariableStateCapture.simplifyValue(s.variables[k])
                        }
                    }
                }
            } catch (e) {
                // best-effort
            }
            out.steps.push({ lineNumber: s.lineNumber, filename: s.filename, executionType: s.executionType, collapsedIterations: s.collapsedIterations || 0, variables: vars })
        }
        return out
    }

    /**
     * Set up the JavaScript callback for native trace
     * This is called by Python's sys.settrace bridge
     * Based on tested implementation from micropython-tracer.js
     */
    setupNativeTraceCallback() {
        const self = this

        // Set up the global callback that Python will invoke
        if (typeof globalThis !== 'undefined') {
            try {
                globalThis._record_execution_step = (lineNo, varsDict, filename, event) => {
                    if (!self.isRecording) return

                    try {
                        // Convert PyProxy/dict to plain JavaScript Map
                        const varsMap = new Map()

                        if (varsDict && typeof varsDict === 'object') {
                            // Try to iterate over the dictionary
                            // Handle both PyProxy objects and plain objects
                            try {
                                // If it has entries() method (PyProxy)
                                if (typeof varsDict.entries === 'function') {
                                    for (const [key, value] of varsDict.entries()) {
                                        // Filter out internal variables
                                        if (!key.startsWith('_') && key !== 'sys') {
                                            try {
                                                varsMap.set(key, value)
                                            } catch (e) {
                                                // Skip unconvertible values
                                            }
                                        }
                                    }
                                }
                                // Otherwise treat as plain object
                                else {
                                    for (const key in varsDict) {
                                        if (!key.startsWith('_') && key !== 'sys') {
                                            varsMap.set(key, varsDict[key])
                                        }
                                    }
                                }
                            } catch (e) {
                                appendTerminalDebug('Error converting variables: ' + e)
                            }
                        }

                        // Log variable values for debugging with event type
                        const varDebug = Array.from(varsMap.entries()).map(([k, v]) => `${k}=${v}`).join(', ')
                        const eventType = event || 'line'
                        appendTerminalDebug(`  📊 [${eventType}] Line ${lineNo} vars: {${varDebug}}`)

                        // Record the step with event type
                        self.recordStep(lineNo, varsMap, 'global', eventType, filename)
                    } catch (err) {
                        appendTerminalDebug('Error in native trace callback: ' + err)
                    }
                }

                appendTerminalDebug('✅ Native trace callback registered on globalThis')
            } catch (err) {
                appendTerminalDebug('❌ Failed to setup native trace callback: ' + err)
            }
        }
    }

    /**
     * Clean up native trace callback
     */
    cleanupNativeTraceCallback() {
        if (typeof globalThis !== 'undefined') {
            try {
                delete globalThis._record_execution_step
                appendTerminalDebug('✅ Native trace callback cleaned up')
            } catch (err) {
                appendTerminalDebug('❌ Failed to cleanup native trace callback: ' + err)
            }
        }
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

            // Build a quick comprehension-line map so we can collapse per-iteration
            // trace events produced by comprehensions into a single logical step.
            // This keeps recordings concise and avoids showing internal loop
            // iterations that have no user-visible state.
            this.comprehensionLineMap = new Map()
            this._comprehensionBuffer = {}
            // Also file-aware perLineMap for multi-file support
            this.perLineMap = new Map()

            // Populate comprehensionLineMap asynchronously so recording start is fast.
            // For multi-file projects, we need to analyze ALL Python files in the workspace,
            // not just the main file, so comprehensions in imported modules are collapsed too.
            const analyzeAllFiles = async () => {
                try {
                    const analyzer = await import('./ast-analyzer.js').then(mod => mod.getASTAnalyzer())

                    // Get all Python files from the workspace
                    const fileManager = getFileManager()
                    const allFiles = await fileManager.list()
                    const pyFiles = allFiles.filter(f => f.endsWith('.py'))

                    appendTerminalDebug(`Analyzing ${pyFiles.length} Python files for comprehensions...`)

                    // Analyze each Python file
                    for (const filepath of pyFiles) {
                        try {
                            const content = await fileManager.read(filepath)
                            const ast = await analyzer.parse(content)

                            if (!ast) continue

                            const comps = analyzer.analyzeComprehensions(ast, '*')
                            const perLine = analyzer.getVariablesAndCallsPerLine(ast)

                            // Store per-line analysis with filename-qualified keys
                            for (const [lineNum, lineData] of perLine.entries()) {
                                const key = makeLineKey(filepath, Number(lineNum))
                                this.perLineMap.set(key, lineData)
                            }

                            // Process comprehensions with filename-qualified keys
                            const compArray = comps?.comprehensions || (Array.isArray(comps) ? comps : [])
                            for (const c of compArray) {
                                const lineno = Number(c.lineno)
                                const per = perLine.get(lineno) || {}
                                const assigned = per.assigned ? new Set(Array.from(per.assigned)) : new Set()
                                const referenced = per.referenced ? new Set(Array.from(per.referenced)) : new Set()
                                const targets = new Set(c.targets || [])

                                // CRITICAL: Remove comprehension targets from referenced set
                                // The AST includes iterator variables like 'i' in referenced, but they're
                                // internal to the comprehension and shouldn't be shown to users
                                for (const target of targets) {
                                    referenced.delete(target)
                                }

                                // Use normalized filename-qualified key for multi-file support
                                const key = makeLineKey(filepath, Number(lineno))
                                this.comprehensionLineMap.set(key, {
                                    assignedNames: assigned,
                                    referencedNames: referenced,
                                    compTargets: targets,
                                    filename: filepath
                                })

                                if (targets.size > 0) {
                                    appendTerminalDebug(`  🎯 Comprehension at ${key}: targets={${Array.from(targets).join(', ')}}, assigned={${Array.from(assigned).join(', ')}}, referenced={${Array.from(referenced).join(', ')}}`)
                                }
                            }
                        } catch (fileErr) {
                            appendTerminalDebug(`Failed to analyze ${filepath}: ${fileErr}`)
                        }
                    }

                    appendTerminalDebug(`Comprehension map built: ${this.comprehensionLineMap.size} comprehensions across ${pyFiles.length} files`)
                } catch (err) {
                    appendTerminalDebug('Comprehension analysis failed: ' + err)
                }
            }

            // Start analysis asynchronously
            analyzeAllFiles()

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
            // Flush any buffered comprehension iterations
            try { this._flushComprehensionBuffers() } catch (e) { appendTerminalDebug('Failed to flush comprehension buffers: ' + e) }

            // After flushing, augment collapsed steps with names from following
            // steps (e.g., copy `n` from the next step into a collapsed step)
            try { this._augmentCollapsedFromFollowing() } catch (e) { appendTerminalDebug('Failed to augment collapsed steps: ' + e) }

            // KAN-10 FIX: Remove bridge setup traces from the beginning
            // The settrace bridge installation generates phantom trace events before
            // user code runs. These appear as the first few steps in non-sequential order.
            // We identify and remove them by looking for the pattern where line 1
            // appears twice - the first occurrence is bridge setup, the second is actual user code.
            try { this._removeBridgeSetupTraces() } catch (e) { appendTerminalDebug('Failed to remove bridge setup traces: ' + e) }

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
     * KAN-10: Post-processing placeholder
     * 
     * Previously contained workarounds for MicroPython sys.settrace bugs.
     * These bugs have been fixed in the custom MicroPython runtime:
     * 
     * - Bug 1 (out-of-order traces): Fixed by invalidating line tracking on backward jumps
     * - Bug 2 (missing loop condition traces): Fixed by forcing LINE events on each iteration
     * 
     * The MicroPython VM now correctly emits LINE events for:
     * - Each iteration of loop bodies (multiple LINE events for same line number)
     * - Proper sequential ordering of trace events
     * 
     * No workarounds needed - traces are now correct from the runtime.
     */
    _removeBridgeSetupTraces() {
        // No-op: MicroPython runtime fixes applied
        // Keeping method name for backward compatibility with stopRecording() call
    }    /**
     * Finalize recording (called when execution completes)
     */
    finalizeRecording() {
        if (this.isRecording) {
            // Ensure buffered comprehension iterations are collapsed before stopping
            try { this._flushComprehensionBuffers() } catch (e) { appendTerminalDebug('Failed to flush comprehension buffers: ' + e) }
            try { this._augmentCollapsedFromFollowing() } catch (e) { appendTerminalDebug('Failed to augment collapsed steps: ' + e) }
            this.stopRecording()
        }
    }

    /**
     * Post-process the trace: for each collapsed comprehension step, copy
     * non-internal variable names from the immediately following step if
     * they are missing. This ensures referenced module-level names (like
     * `n`) are visible on the collapsed step.
     */
    _augmentCollapsedFromFollowing() {
        if (!this.currentTrace) return
        const count = this.currentTrace.getStepCount()
        for (let i = 0; i < count - 1; i++) {
            const s = this.currentTrace.getStep(i)
            const next = this.currentTrace.getStep(i + 1)
            if (!s || !next) continue
            if (!s.collapsedIterations || s.collapsedIterations <= 0) continue

            // Determine comprehension targets to avoid copying internal names
            // Use makeLineKey to produce a normalized filename-qualified key
            const compKey = makeLineKey(s.filename, s.lineNumber)
            const compInfo = this.comprehensionLineMap && this.comprehensionLineMap.get(compKey)
            const targets = (compInfo && compInfo.compTargets) ? compInfo.compTargets : new Set()

            // Debug comprehension target lookups
            if (s.collapsedIterations && s.collapsedIterations > 0) {
                // Don't reference undefined variables in debug output; show normalized compKey instead
                appendTerminalDebug(`  🎯 Augment lookup: step ${i} filename="${s.filename}", line=${s.lineNumber}, compKey="${compKey}", foundInfo=${!!compInfo}, targets={${Array.from(targets).join(', ')}}`)
            }

            const beforeVars = s.variables instanceof Map ? Array.from(s.variables.keys()) : Object.keys(s.variables || {})
            const addedVars = []

            try {
                if (!s.variables) s.variables = new Map()
                if (next.variables) {
                    if (typeof next.variables.entries === 'function') {
                        for (const [k, v] of next.variables.entries()) {
                            if (s.variables.has(k)) continue
                            if (targets.has(k)) continue
                            if (typeof k === 'string' && /^local_\d+$/.test(k)) continue
                            try {
                                s.variables.set(k, v)
                                addedVars.push(k)
                            } catch (e) { }
                        }
                    } else if (typeof next.variables === 'object') {
                        for (const k of Object.keys(next.variables)) {
                            if (s.variables.has(k)) continue
                            if (targets.has(k)) continue
                            if (typeof k === 'string' && /^local_\d+$/.test(k)) continue
                            try {
                                s.variables.set(k, next.variables[k])
                                addedVars.push(k)
                            } catch (e) { }
                        }
                    }
                }
            } catch (e) {
                // best-effort
            }

            if (addedVars.length > 0) {
                const afterVars = s.variables instanceof Map ? Array.from(s.variables.keys()) : Object.keys(s.variables || {})
                appendTerminalDebug(`  🔄 Augmented step ${i} (${compKey}, collapsed=${s.collapsedIterations}): before=[${beforeVars.join(', ')}], added=[${addedVars.join(', ')}], after=[${afterVars.join(', ')}], targets={${Array.from(targets).join(', ')}}`)
            }
        }

        // Additional pass: for earlier non-collapsed steps that are missing
        // assigned names (e.g. module-level assignments recorded before the
        // value is visible), try to copy those assigned names from the next
        // few steps. This specifically ensures lines like `n = 4` show `n` on
        // the step for that line even if the runtime emitted the value on a
        // later event.
        try {
            const lookahead = 4
            for (let i = 0; i < count; i++) {
                const s = this.currentTrace.getStep(i)
                if (!s) continue

                // KAN-10 FIX: For the LAST step, handle missing assigned variables
                // Since sys.settrace fires BEFORE line execution, the last line's
                // assignment is never captured. Try to infer the value from source.
                const isLastStep = (i === count - 1)

                // If the step already has variables, skip only if it contains assigned names
                const hasAnyVars = s.variables && ((typeof s.variables.size === 'number' && s.variables.size > 0) || (typeof s.variables === 'object' && Object.keys(s.variables).length > 0))
                // Determine assigned names for this line. Prefer per-line analysis
                // if available; otherwise fall back to a heuristic that treats
                // names appearing >=2 times in the next few steps as assigned.
                const perLineMap = this.perLineMap
                let assigned = new Set()
                if (perLineMap) {
                    // Use filename-qualified key for multi-file support
                    const perKey = makeLineKey(s.filename, s.lineNumber)
                    const per = perLineMap.get(perKey) || {}
                    assigned = per.assigned ? new Set(Array.from(per.assigned)) : new Set()
                    // If analyzer provided no assigned names, fall back to heuristic
                    // so we can still augment steps when the analyzer missed it.
                    if (!assigned || assigned.size === 0) {
                        // continue to heuristic below
                    } else {
                        // we have assigned names from analyzer
                    }
                }
                if (!perLineMap || !assigned || assigned.size === 0) {
                    // Heuristic: collect names that appear multiple times ahead
                    const counts = new Map()
                    for (let j = i + 1; j < Math.min(count, i + 1 + lookahead); j++) {
                        const nxt = this.currentTrace.getStep(j)
                        if (!nxt || !nxt.variables) continue
                        if (typeof nxt.variables.entries === 'function') {
                            for (const [k] of nxt.variables.entries()) {
                                if (typeof k === 'string' && /^local_\d+$/.test(k)) continue
                                counts.set(k, (counts.get(k) || 0) + 1)
                            }
                        } else if (typeof nxt.variables === 'object') {
                            for (const k of Object.keys(nxt.variables)) {
                                if (typeof k === 'string' && /^local_\d+$/.test(k)) continue
                                counts.set(k, (counts.get(k) || 0) + 1)
                            }
                        }
                    }
                    for (const [name, cnt] of counts.entries()) if (cnt >= 2) assigned.add(name)
                }
                if (!assigned || assigned.size === 0) continue

                // If step already contains all assigned names, skip
                let needs = []
                for (const name of assigned) {
                    try {
                        const exists = s.variables && (typeof s.variables.has === 'function' ? s.variables.has(name) : Object.prototype.hasOwnProperty.call(s.variables, name))
                        if (!exists) needs.push(name)
                    } catch (e) { needs.push(name) }
                }
                if (needs.length === 0) continue

                // Search forward for values. If we have per-line analysis use that
                // to copy only assigned names. If not, use a heuristic: copy
                // names that appear in multiple subsequent steps (>=2) within
                // the lookahead window — this avoids single-step noise.
                if (perLineMap) {
                    // Determine compTargets for this destination step to avoid copying internal names
                    const compKeyForS = makeLineKey(s.filename, s.lineNumber)
                    const compInfoForS = this.comprehensionLineMap && this.comprehensionLineMap.get(compKeyForS)
                    const targetsForS = (compInfoForS && compInfoForS.compTargets) ? compInfoForS.compTargets : new Set()
                    for (let j = i + 1; j < Math.min(count, i + 1 + lookahead); j++) {
                        const nxt = this.currentTrace.getStep(j)
                        if (!nxt || !nxt.variables) continue

                        // CRITICAL: Only copy variables from steps in the SAME file
                        // This prevents cross-file pollution (e.g., main.py line 1 getting dice.py variables)
                        if (s.filename !== nxt.filename) continue

                        if (typeof nxt.variables.entries === 'function') {
                            for (const [k, v] of nxt.variables.entries()) {
                                if (!needs.includes(k)) continue
                                if (typeof k === 'string' && /^local_\d+$/.test(k)) continue
                                if (targetsForS.has(k)) continue
                                try {
                                    if (!s.variables) s.variables = new Map()
                                    if (typeof s.variables.set === 'function') {
                                        s.variables.set(k, v)
                                    } else if (typeof s.variables === 'object') {
                                        s.variables[k] = v
                                    }
                                    appendTerminalDebug(`Forward-augmented step at line ${s.lineNumber} with name ${k} from step ${nxt.lineNumber}`)
                                    const idx = needs.indexOf(k)
                                    if (idx >= 0) needs.splice(idx, 1)
                                } catch (e) { }
                            }
                        } else if (typeof nxt.variables === 'object') {
                            for (const k of Object.keys(nxt.variables)) {
                                if (!needs.includes(k)) continue
                                if (typeof k === 'string' && /^local_\d+$/.test(k)) continue
                                if (targetsForS.has(k)) continue
                                try {
                                    if (!s.variables) s.variables = new Map()
                                    if (typeof s.variables.set === 'function') {
                                        s.variables.set(k, nxt.variables[k])
                                    } else if (typeof s.variables === 'object') {
                                        s.variables[k] = nxt.variables[k]
                                    }
                                    appendTerminalDebug(`Forward-augmented step at line ${s.lineNumber} with name ${k} from step ${nxt.lineNumber}`)
                                    const idx = needs.indexOf(k)
                                    if (idx >= 0) needs.splice(idx, 1)
                                } catch (e) { }
                            }
                        }

                        if (needs.length === 0) break
                    }
                } else {
                    // Heuristic fallback: count occurrences of each candidate name
                    // in the next few steps and copy those that appear >=2 times.
                    const counts = new Map()
                    for (let j = i + 1; j < Math.min(count, i + 1 + lookahead); j++) {
                        const nxt = this.currentTrace.getStep(j)
                        if (!nxt || !nxt.variables) continue

                        // CRITICAL: Only copy variables from steps in the SAME file
                        if (s.filename !== nxt.filename) continue

                        if (typeof nxt.variables.entries === 'function') {
                            for (const [k] of nxt.variables.entries()) {
                                if (typeof k === 'string' && /^local_\d+$/.test(k)) continue
                                counts.set(k, (counts.get(k) || 0) + 1)
                            }
                        } else if (typeof nxt.variables === 'object') {
                            for (const k of Object.keys(nxt.variables)) {
                                if (typeof k === 'string' && /^local_\d+$/.test(k)) continue
                                counts.set(k, (counts.get(k) || 0) + 1)
                            }
                        }
                    }
                    for (const [name, cnt] of counts.entries()) {
                        if (cnt < 2) continue
                        if (!needs.includes(name)) continue
                        // copy first-found value from SAME file only
                        for (let j = i + 1; j < Math.min(count, i + 1 + lookahead); j++) {
                            const nxt = this.currentTrace.getStep(j)
                            if (!nxt || !nxt.variables) continue

                            // CRITICAL: Only copy from same file
                            if (s.filename !== nxt.filename) continue

                            const val = (typeof nxt.variables.entries === 'function') ? (nxt.variables.get ? nxt.variables.get(name) : undefined) : nxt.variables[name]
                            if (val !== undefined) {
                                try {
                                    if (!s.variables) s.variables = new Map()
                                    if (typeof s.variables.set === 'function') {
                                        s.variables.set(name, val)
                                    } else if (typeof s.variables === 'object') {
                                        s.variables[name] = val
                                    }
                                    appendTerminalDebug(`Forward-augmented step at line ${s.lineNumber} with name ${name} (heuristic) from later step`)
                                } catch (e) { }
                                break
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // best-effort
        }

        // Final deterministic pass: for any step whose source-line analysis
        // indicates assigned names, ensure those assigned names appear on
        // that step by scanning forward for the first occurrence of a value
        // and copying it. This fixes cases where a "line" event is emitted
        // before the assignment actually executed (so the assignment-line
        // step initially lacks the assigned value). Conservatively copies
        // only the first-found value for each name.
        try {
            const perLineMapFinal = this.perLineMap
            if (perLineMapFinal) {
                for (let i = 0; i < count; i++) {
                    const s = this.currentTrace.getStep(i)
                    if (!s) continue
                    // Obtain assigned names for this source line
                    let assignedSet = new Set()
                    try {
                        // Use filename-qualified key for multi-file support
                        const perKey = makeLineKey(s.filename, s.lineNumber)
                        const per = perLineMapFinal.get(perKey) || {}
                        assignedSet = per.assigned ? new Set(Array.from(per.assigned)) : new Set()
                    } catch (e) {
                        // ignore
                    }
                    if (!assignedSet || assignedSet.size === 0) continue

                    // For assigned names, always update from the next step that has them
                    for (const name of assignedSet) {
                        // Scan forward for first occurrence of this name
                        for (let j = i + 1; j < count; j++) {
                            const nxt = this.currentTrace.getStep(j)
                            if (!nxt || !nxt.variables) continue

                            // CRITICAL: Only copy variables from steps in the SAME file
                            if (s.filename !== nxt.filename) continue

                            const val = (typeof nxt.variables.entries === 'function') ? (nxt.variables.get ? nxt.variables.get(name) : undefined) : nxt.variables[name]
                            if (val !== undefined) {
                                const currentVal = (typeof s.variables.entries === 'function') ? (s.variables.get ? s.variables.get(name) : undefined) : s.variables[name]
                                // Only update if types are the same (to avoid updating string to int, etc.)
                                if (currentVal !== undefined && typeof currentVal === typeof val) {
                                    try {
                                        if (!s.variables) s.variables = new Map()
                                        if (typeof s.variables.set === 'function') {
                                            s.variables.set(name, val)
                                        } else if (typeof s.variables === 'object') {
                                            s.variables[name] = val
                                        }
                                        appendTerminalDebug(`Final-augmented step at line ${s.lineNumber} with name ${name} from step ${nxt.lineNumber}`)
                                    } catch (e) { }
                                }
                                break
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // best-effort
        }

        // KAN-10 FIX: Special handling for the LAST step
        // Since sys.settrace fires BEFORE line execution, the last line's assignment
        // is never captured in variables. Try to parse simple literal assignments
        // from the source code and add them to the last step.
        try {
            if (count > 0 && this.currentTrace && this.currentTrace.metadata && this.currentTrace.metadata.sourceCode) {
                const lastStep = this.currentTrace.getStep(count - 1)
                if (lastStep) {
                    const sourceLines = this.currentTrace.metadata.sourceCode.split('\n')
                    const lineIndex = lastStep.lineNumber - 1
                    if (lineIndex >= 0 && lineIndex < sourceLines.length) {
                        const sourceLine = sourceLines[lineIndex].trim()
                        // Try to parse simple assignments like "b = 5" or "x = 'hello'"
                        const simpleAssignMatch = sourceLine.match(/^(\w+)\s*=\s*(.+)$/)
                        if (simpleAssignMatch) {
                            const varName = simpleAssignMatch[1]
                            const valueExpr = simpleAssignMatch[2].trim()

                            // Check if this variable is missing from the last step
                            const hasVar = lastStep.variables && (typeof lastStep.variables.has === 'function' ? lastStep.variables.has(varName) : Object.prototype.hasOwnProperty.call(lastStep.variables, varName))

                            if (!hasVar) {
                                // Try to evaluate simple literals
                                let value = undefined
                                try {
                                    // Handle numbers, strings, booleans, None
                                    if (/^-?\d+$/.test(valueExpr)) {
                                        value = parseInt(valueExpr, 10)
                                    } else if (/^-?\d+\.\d+$/.test(valueExpr)) {
                                        value = parseFloat(valueExpr)
                                    } else if (/^['"].*['"]$/.test(valueExpr)) {
                                        value = valueExpr  // Keep as repr string
                                    } else if (valueExpr === 'True') {
                                        value = true
                                    } else if (valueExpr === 'False') {
                                        value = false
                                    } else if (valueExpr === 'None') {
                                        value = null
                                    }

                                    if (value !== undefined) {
                                        if (!lastStep.variables) lastStep.variables = new Map()
                                        if (typeof lastStep.variables.set === 'function') {
                                            lastStep.variables.set(varName, value)
                                        } else if (typeof lastStep.variables === 'object') {
                                            lastStep.variables[varName] = value
                                        }
                                        appendTerminalDebug(`✨ Added last-line assignment ${varName}=${value} from source code`)
                                    }
                                } catch (e) {
                                    // Failed to parse - skip
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            // best-effort
        }
    }

    /**
     * KAN-14: Check if current line is unreachable after a control flow statement
     * (break/continue/return) in the same block
     * @private
     */
    _isUnreachableAfterControlFlow(lineNumber, filename) {
        if (!this.currentTrace || this.currentTrace.getStepCount() === 0) {
            return false
        }

        // Get source code to analyze indentation
        const sourceCode = this.currentTrace.getMetadata('sourceCode')
        if (!sourceCode) return false

        const lines = sourceCode.split('\n')
        const currentLineIndex = lineNumber - 1
        if (currentLineIndex < 0 || currentLineIndex >= lines.length) {
            return false
        }

        const currentLine = lines[currentLineIndex]
        const currentIndent = currentLine.length - currentLine.trimStart().length

        // Look back through recent steps to find control flow statements
        const lookback = Math.min(5, this.currentTrace.getStepCount())

        for (let i = this.currentTrace.getStepCount() - 1; i >= this.currentTrace.getStepCount() - lookback; i--) {
            const step = this.currentTrace.getStep(i)
            if (!step || step.filename !== filename) continue

            const stepLineIndex = step.lineNumber - 1
            if (stepLineIndex < 0 || stepLineIndex >= lines.length) continue

            const stepLine = lines[stepLineIndex].trim()
            const stepIndent = lines[stepLineIndex].length - lines[stepLineIndex].trimStart().length

            // Check if this step is a control flow statement
            const isControlFlow = stepLine.startsWith('break') ||
                stepLine.startsWith('continue') ||
                stepLine.startsWith('return')

            if (isControlFlow) {
                // Check if current line is at same or deeper indentation
                // This means it's in the same block as the control flow statement
                if (currentIndent >= stepIndent) {
                    // Verify we haven't exited and re-entered the block by checking
                    // intermediate indentations
                    let allDeeperOrEqual = true
                    for (let j = i + 1; j < this.currentTrace.getStepCount(); j++) {
                        const intermediateStep = this.currentTrace.getStep(j)
                        if (!intermediateStep || intermediateStep.filename !== filename) continue

                        const intLineIndex = intermediateStep.lineNumber - 1
                        if (intLineIndex < 0 || intLineIndex >= lines.length) continue

                        const intIndent = lines[intLineIndex].length - lines[intLineIndex].trimStart().length
                        if (intIndent < stepIndent) {
                            allDeeperOrEqual = false
                            break
                        }
                    }

                    if (allDeeperOrEqual) {
                        return true
                    }
                }

                // If we've exited to shallower indent, stop looking
                if (currentIndent < stepIndent) {
                    break
                }
            }
        }

        return false
    }

    /**
     * KAN-14: Check if this is a phantom trace in a loop's conditional block
     * This is the main KAN-14 bug: last line in loop body traced even when
     * conditional is FALSE
     * @private
     */
    _isPhantomConditionalTrace(lineNumber, variables, filename) {
        if (!this.currentTrace || this.currentTrace.getStepCount() === 0) {
            return false
        }

        const prevStep = this.currentTrace.getStep(this.currentTrace.getStepCount() - 1)
        if (!prevStep || prevStep.filename !== filename) {
            return false
        }

        // Get source code to analyze
        const sourceCode = this.currentTrace.getMetadata('sourceCode')
        if (!sourceCode) return false

        const lines = sourceCode.split('\n')
        const prevLineIndex = prevStep.lineNumber - 1
        const currentLineIndex = lineNumber - 1

        if (prevLineIndex < 0 || prevLineIndex >= lines.length ||
            currentLineIndex < 0 || currentLineIndex >= lines.length) {
            return false
        }

        const prevLine = lines[prevLineIndex].trim()
        const currentLine = lines[currentLineIndex]
        const prevIndent = lines[prevLineIndex].length - lines[prevLineIndex].trimStart().length
        const currentIndent = currentLine.length - currentLine.trimStart().length

        // Pattern 1: Previous line is a conditional and current line is in its body
        const isConditional = /^(if|elif|while)\s/.test(prevLine)

        if (isConditional && currentIndent > prevIndent) {
            // Check if condition evaluates to FALSE based on variable values
            const ifMatch = prevLine.match(/^(?:if|elif|while)\s+(.+):/)
            if (ifMatch) {
                const condition = ifMatch[1].trim()

                // Try to evaluate simple conditions like "i > 2", "x < 5", etc.
                const simpleCondMatch = condition.match(/^(\w+)\s*([><=!]+)\s*(\d+)$/)
                if (simpleCondMatch) {
                    const varName = simpleCondMatch[1]
                    const operator = simpleCondMatch[2]
                    const threshold = parseInt(simpleCondMatch[3])

                    // Get variable value from current variables
                    const varsMap = variables?.entries ? variables : new Map(Object.entries(variables || {}))
                    const varValue = varsMap.has ? varsMap.get(varName) : variables?.[varName]

                    if (varValue !== undefined && typeof varValue === 'number') {
                        // Evaluate condition
                        let conditionTrue = false
                        switch (operator) {
                            case '>': conditionTrue = varValue > threshold; break
                            case '<': conditionTrue = varValue < threshold; break
                            case '>=': conditionTrue = varValue >= threshold; break
                            case '<=': conditionTrue = varValue <= threshold; break
                            case '==': conditionTrue = varValue == threshold; break
                            case '!=': conditionTrue = varValue != threshold; break
                        }

                        // If condition is FALSE but we're tracing the body, it's a phantom
                        if (!conditionTrue) {
                            appendTerminalDebug(`  ⚠️ Phantom conditional detected: ${condition} evaluates to FALSE (${varName}=${varValue})`)
                            return true
                        }
                    }
                }
            }
        }

        // Pattern 2: Current line is at deeper indentation than previous, suggesting we jumped
        // into a nested block. Scan backwards to find the controlling conditional.
        // This catches the case where we trace Line 5 after Line 2 (while loop), but Line 5
        // is actually inside a nested if statement (Line 4) that we haven't traced yet.
        if (currentIndent > prevIndent && prevStep.lineNumber < lineNumber) {
            // Scan backwards from current line to find the immediate controlling conditional
            for (let i = currentLineIndex - 1; i >= 0; i--) {
                const scanLine = lines[i]
                const scanIndent = scanLine.length - scanLine.trimStart().length
                const scanTrimmed = scanLine.trim()

                // Stop if we've gone to shallower or equal indent as current line
                // (we've exited the block that contains the current line)
                if (scanIndent < currentIndent - 4) { // Allow for one level of nesting (4 spaces)
                    break
                }

                // Check if this line is a conditional that would control current line
                const isControllingConditional = /^(if|elif)\s/.test(scanTrimmed) &&
                    scanIndent === currentIndent - 4

                if (isControllingConditional) {
                    // Found the controlling conditional - check if it evaluates to FALSE
                    const ifMatch = scanTrimmed.match(/^(?:if|elif)\s+(.+):/)
                    if (ifMatch) {
                        const condition = ifMatch[1].trim()

                        // Try to evaluate simple conditions
                        const simpleCondMatch = condition.match(/^(\w+)\s*([><=!]+)\s*(\d+)$/)
                        if (simpleCondMatch) {
                            const varName = simpleCondMatch[1]
                            const operator = simpleCondMatch[2]
                            const threshold = parseInt(simpleCondMatch[3])

                            const varsMap = variables?.entries ? variables : new Map(Object.entries(variables || {}))
                            const varValue = varsMap.has ? varsMap.get(varName) : variables?.[varName]

                            if (varValue !== undefined && typeof varValue === 'number') {
                                let conditionTrue = false
                                switch (operator) {
                                    case '>': conditionTrue = varValue > threshold; break
                                    case '<': conditionTrue = varValue < threshold; break
                                    case '>=': conditionTrue = varValue >= threshold; break
                                    case '<=': conditionTrue = varValue <= threshold; break
                                    case '==': conditionTrue = varValue == threshold; break
                                    case '!=': conditionTrue = varValue != threshold; break
                                }

                                if (!conditionTrue) {
                                    appendTerminalDebug(`  ⚠️ Phantom conditional (nested) detected: line ${i + 1} condition "${condition}" evaluates to FALSE (${varName}=${varValue}), skipping line ${lineNumber}`)
                                    return true
                                }
                            }
                        }
                    }
                    // Found the controlling conditional - stop scanning
                    break
                }
            }
        }

        return false
    }

    /**
     * Internal: flush any buffered comprehension iterations into a single
     * execution step per comprehension line. Uses the last captured variables
     * for the final collapsed step and annotates metadata with collapsed count.
     */
    _flushComprehensionBuffers() {
        if (!this._comprehensionBuffer || !this.currentTrace) return
        for (const compKey of Object.keys(this._comprehensionBuffer)) {
            const b = this._comprehensionBuffer[compKey]
            if (!b) continue
            const vars = b.lastVars || new Map()
            // Try to include referenced and assigned names, but filter out internal
            // comprehension targets (e.g. the iteration variable `i`).
            const compInfo = this.comprehensionLineMap && this.comprehensionLineMap.get(compKey)
            const filtered = new Map()
            if (compInfo) {
                const assigned = compInfo.assignedNames || new Set()
                const referenced = compInfo.referencedNames || new Set()
                const targets = compInfo.compTargets || new Set()
                // Support both Map and plain object shapes for vars
                if (vars && typeof vars.entries === 'function') {
                    for (const [k, v] of vars.entries()) {
                        // Filter out comprehension targets AND MicroPython local_* internals
                        if (targets.has(k) || k.startsWith('local_')) continue
                        if (assigned.has(k) || referenced.has(k)) filtered.set(k, v)
                    }
                } else if (vars && typeof vars === 'object') {
                    for (const k of Object.keys(vars)) {
                        // Filter out comprehension targets AND MicroPython local_* internals
                        if (targets.has(k) || k.startsWith('local_')) continue
                        if (assigned.has(k) || referenced.has(k)) filtered.set(k, vars[k])
                    }
                }
                // If nothing matched (conservative fallback), include assigned names if present
                if (filtered.size === 0 && assigned.size > 0) {
                    if (vars && typeof vars.entries === 'function') {
                        for (const [k, v] of vars.entries()) {
                            // Skip local_* even in fallback
                            if (k.startsWith('local_')) continue
                            if (assigned.has(k)) filtered.set(k, v)
                        }
                    } else if (vars && typeof vars === 'object') {
                        for (const k of Object.keys(vars)) {
                            // Skip local_* even in fallback
                            if (k.startsWith('local_')) continue
                            if (assigned.has(k)) filtered.set(k, vars[k])
                        }
                    }
                }

                // Ensure referenced names are present when possible: if a referenced
                // name wasn't found in the buffered vars, try to take it from the
                // previously recorded step (which may contain module-level values
                // such as `n`) so the collapsed step shows values the user expects.
                try {
                    if (referenced && referenced.size > 0) {
                        for (const name of referenced) {
                            if (targets.has(name)) continue
                            if (filtered.has(name)) continue

                            let val = undefined
                            // Try: previous recorded step
                            try {
                                const prevIndex = this.currentTrace.getStepCount() - 1
                                if (prevIndex >= 0) {
                                    const prevStep = this.currentTrace.getStep(prevIndex)
                                    if (prevStep && prevStep.variables) {
                                        val = prevStep.variables.get ? prevStep.variables.get(name) : prevStep.variables[name]
                                    }
                                }
                            } catch (e) { }

                            // Try: scan all existing steps for the name
                            if (val === undefined) {
                                try {
                                    for (let si = 0; si < this.currentTrace.getStepCount(); si++) {
                                        const scheck = this.currentTrace.getStep(si)
                                        if (!scheck || !scheck.variables) continue
                                        const maybe = scheck.variables.get ? scheck.variables.get(name) : scheck.variables[name]
                                        if (maybe !== undefined) { val = maybe; break }
                                    }
                                } catch (e) {
                                    // ignore
                                }
                            }

                            if (val !== undefined) filtered.set(name, val)
                        }
                    }
                } catch (e) {
                    // ignore any lookup errors
                }
            }

            // Extract line number from key (format: "filename:lineNumber" or just lineNumber)
            const ln = compKey.includes(':') ? Number(compKey.split(':').pop()) : Number(compKey)
            const finalVars = (filtered && filtered.size > 0) ? filtered : vars
            const step = new ExecutionStep(ln, finalVars, 'global', null, b.filename || '/main.py')
            step.executionType = 'line'
            // annotate that this step collapsed N iterations
            step.collapsedIterations = b.iterations || 1
            this.currentTrace.addStep(step)
            appendTerminalDebug(`Flushed comprehension at ${compKey}: collapsed ${b.iterations} iterations into one step`)
        }
        this._comprehensionBuffer = {}
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
    recordStep(lineNumber, variables = new Map(), scope = 'global', executionType = 'line', filename = null) {
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
            // If this line is part of a comprehension we want to collapse
            // internal iteration steps (which usually have no user-visible
            // variable assignments) into a single step. We detect this by
            // consulting comprehensionLineMap built at recording start.
            // Use filename-qualified key for multi-file support
            const compKey = makeLineKey(filename, lineNumber)
            const compInfo = this.comprehensionLineMap && this.comprehensionLineMap.get(compKey)

            if (compInfo) {
                // Buffer iteration: store latest variables and note that we've seen an iteration
                const buf = this._comprehensionBuffer || (this._comprehensionBuffer = {})
                const b = buf[compKey] || { iterations: 0, lastVars: null, filename: filename }
                b.iterations++

                // Filter variables BEFORE buffering to exclude comprehension targets
                // and local_* internals. This prevents iterator variables like 'i' from
                // appearing in the collapsed step.
                const filteredVars = new Map()
                const assigned = compInfo.assignedNames || new Set()
                const referenced = compInfo.referencedNames || new Set()
                const targets = compInfo.compTargets || new Set()

                if (variables && typeof variables.entries === 'function') {
                    for (const [k, v] of variables.entries()) {
                        // Filter out comprehension targets AND MicroPython local_* internals
                        if (targets.has(k) || k.startsWith('local_')) continue
                        // Only include variables that are assigned or referenced on this line
                        if (assigned.has(k) || referenced.has(k)) filteredVars.set(k, v)
                    }
                } else if (variables && typeof variables === 'object') {
                    for (const k of Object.keys(variables)) {
                        // Filter out comprehension targets AND MicroPython local_* internals
                        if (targets.has(k) || k.startsWith('local_')) continue
                        // Only include variables that are assigned or referenced on this line
                        if (assigned.has(k) || referenced.has(k)) filteredVars.set(k, variables[k])
                    }
                }

                // Debug: log what we're buffering for comprehensions
                if (b.iterations <= 2) {  // Only log first 2 iterations to avoid spam
                    const varKeys = variables instanceof Map ? Array.from(variables.keys()) : Object.keys(variables || {})
                    const filteredKeys = Array.from(filteredVars.keys())
                    appendTerminalDebug(`  🔬 Buffering comprehension iteration ${b.iterations} at ${compKey}: incoming vars=[${varKeys.join(', ')}], filtered vars=[${filteredKeys.join(', ')}]`)
                }

                b.lastVars = filteredVars
                buf[compKey] = b

                // If this iteration includes any assignment to names that are
                // not internal comprehension targets (i.e., assignedNames contains
                // an actual variable), or the variables map contains those assigned
                // names, then flush immediately as this represents a visible change.
                // NOTE: Ignore local_* variables - these are MicroPython internal variables
                const assignedNames = compInfo.assignedNames || new Set()
                let flushNow = false
                for (const n of assignedNames) {
                    // Skip MicroPython internal local_* variables
                    if (n.startsWith('local_')) continue
                    if (variables && variables.has(n)) {
                        flushNow = true
                        break
                    }
                }

                if (flushNow) {
                    // Filter variables to include assigned/referenced names and
                    // exclude internal comprehension targets (e.g. `i`). This makes
                    // collapsed steps show referenced variables like `n`.
                    const compInfoNow = this.comprehensionLineMap && this.comprehensionLineMap.get(compKey)
                    let varsToUse = b.lastVars
                    if (compInfoNow && b.lastVars) {
                        const filteredNow = new Map()
                        const assignedNow = compInfoNow.assignedNames || new Set()
                        const referencedNow = compInfoNow.referencedNames || new Set()
                        const targetsNow = compInfoNow.compTargets || new Set()
                        // b.lastVars can be Map or plain object
                        if (b.lastVars && typeof b.lastVars.entries === 'function') {
                            for (const [k, v] of b.lastVars.entries()) {
                                // Filter out comprehension targets AND MicroPython local_* internals
                                if (targetsNow.has(k) || k.startsWith('local_')) continue
                                if (assignedNow.has(k) || referencedNow.has(k)) filteredNow.set(k, v)
                            }
                        } else if (b.lastVars && typeof b.lastVars === 'object') {
                            for (const k of Object.keys(b.lastVars)) {
                                // Filter out comprehension targets AND MicroPython local_* internals
                                if (targetsNow.has(k) || k.startsWith('local_')) continue
                                if (assignedNow.has(k) || referencedNow.has(k)) filteredNow.set(k, b.lastVars[k])
                            }
                        }
                        // If we found some filtered vars, use them. Otherwise we
                        // will try to augment referenced names from the previous
                        // recorded step below so module-level values like `n`
                        // are not lost when collapsing.
                        if (filteredNow.size > 0) {
                            varsToUse = filteredNow
                        }

                        // Augment referenced names from previous step if they're
                        // missing in the current buffered vars. This helps show
                        // referenced values (e.g. `n`) when the comprehension
                        // iteration variables don't include them.
                        try {
                            if (referencedNow && referencedNow.size > 0) {
                                const prevIndex = this.currentTrace.getStepCount() - 1
                                if (prevIndex >= 0) {
                                    const prevStep = this.currentTrace.getStep(prevIndex)
                                    if (prevStep && prevStep.variables) {
                                        for (const name of referencedNow) {
                                            if (targetsNow.has(name)) continue
                                            if (!filteredNow.has(name)) {
                                                try {
                                                    const val = prevStep.variables.get ? prevStep.variables.get(name) : undefined
                                                    if (val !== undefined) filteredNow.set(name, val)
                                                } catch (e) {
                                                    // ignore
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            // ignore lookup errors
                        }
                        if (filteredNow.size > 0) varsToUse = filteredNow
                    }
                    const step = new ExecutionStep(lineNumber, varsToUse, scope, null, filename)
                    step.executionType = executionType
                    this.currentTrace.addStep(step)
                    appendTerminalDebug(`Recorded (comprehension-flush) step ${this.currentTrace.getStepCount()}: line ${lineNumber} in ${filename || '/main.py'}, ${b.lastVars ? b.lastVars.size : 0} vars (collapsed ${b.iterations} iterations)`)
                    delete buf[compKey]
                } else {
                    // Otherwise do not add a step for each internal iteration
                    // (they will be collapsed later in finalizeRecording)
                    if (this.currentTrace.getStepCount() % 100 === 0) {
                        appendTerminalDebug(`Recorded ${this.currentTrace.getStepCount()} execution steps (comprehension buffering)`)
                    }
                }

                return
            }

            // Before adding a normal (non-comprehension) step, flush any
            // buffered comprehension lines that should appear before this
            // step in execution order. This ensures collapsed comprehension
            // steps are placed in the trace before subsequent lines (e.g., print).
            try {
                if (this._comprehensionBuffer) {
                    // Flush buffers for any keys that are not the current key
                    // and which were recorded earlier. We conservatively flush all
                    // buffered keys here to preserve ordering; buffers are small.
                    const currentCompKey = makeLineKey(filename, lineNumber)
                    const bufferedKeys = Object.keys(this._comprehensionBuffer)

                    for (const bufKey of bufferedKeys) {
                        // If buffered key equals current key skip (recently handled)
                        if (bufKey === currentCompKey) continue
                        const b = this._comprehensionBuffer[bufKey]
                        if (!b) continue
                        const vars2 = b.lastVars || new Map()
                        // Filter like in _flushComprehensionBuffers
                        const compInfo2 = this.comprehensionLineMap && this.comprehensionLineMap.get(bufKey)
                        let finalVars2 = vars2
                        if (compInfo2 && vars2) {
                            const f2 = new Map()
                            const assigned2 = compInfo2.assignedNames || new Set()
                            const referenced2 = compInfo2.referencedNames || new Set()
                            const targets2 = compInfo2.compTargets || new Set()
                            // vars2 may be Map or plain object
                            if (vars2 && typeof vars2.entries === 'function') {
                                for (const [k, v] of vars2.entries()) {
                                    // Filter out comprehension targets AND MicroPython local_* internals
                                    if (targets2.has(k) || k.startsWith('local_')) continue
                                    if (assigned2.has(k) || referenced2.has(k)) f2.set(k, v)
                                }
                            } else if (vars2 && typeof vars2 === 'object') {
                                for (const k of Object.keys(vars2)) {
                                    // Filter out comprehension targets AND MicroPython local_* internals
                                    if (targets2.has(k) || k.startsWith('local_')) continue
                                    if (assigned2.has(k) || referenced2.has(k)) f2.set(k, vars2[k])
                                }
                            }
                            // If we found some filtered vars use them; otherwise
                            // attempt to augment referenced names from previous
                            // recorded step so module-level values like `n` are
                            // preserved when collapsing.
                            if (f2.size === 0 && referenced2 && referenced2.size > 0) {
                                // Try to take referenced names from the incoming
                                // (about-to-be-added) `variables` for this normal step
                                // — this is the most up-to-date context and will
                                // contain module-level names like `n` in typical runs.
                                for (const name of referenced2) {
                                    if (targets2.has(name)) continue
                                    if (f2.has(name)) continue
                                    let val = undefined
                                    try {
                                        if (variables) {
                                            if (typeof variables.get === 'function') {
                                                val = variables.get(name)
                                            } else if (Object.prototype.hasOwnProperty.call(variables, name)) {
                                                val = variables[name]
                                            }
                                        }
                                    } catch (e) {
                                        // ignore
                                    }

                                    // Fallback: look into the previous recorded step
                                    if (val === undefined) {
                                        try {
                                            const prevIndex2 = this.currentTrace.getStepCount() - 1
                                            if (prevIndex2 >= 0) {
                                                const prevStep2 = this.currentTrace.getStep(prevIndex2)
                                                if (prevStep2 && prevStep2.variables) {
                                                    const maybe = prevStep2.variables.get ? prevStep2.variables.get(name) : prevStep2.variables[name]
                                                    if (maybe !== undefined) val = maybe
                                                }
                                            }
                                        } catch (e) {
                                            // ignore
                                        }
                                    }

                                    if (val === undefined) {
                                        // Final fallback: scan existing trace steps for the name
                                        try {
                                            for (let si = 0; si < this.currentTrace.getStepCount(); si++) {
                                                const scheck = this.currentTrace.getStep(si)
                                                if (!scheck || !scheck.variables) continue
                                                const maybe2 = scheck.variables.get ? scheck.variables.get(name) : scheck.variables[name]
                                                if (maybe2 !== undefined) {
                                                    val = maybe2
                                                    break
                                                }
                                            }
                                        } catch (e) {
                                            // ignore
                                        }
                                    }

                                    if (val !== undefined) f2.set(name, val)
                                }
                            }
                            if (f2.size > 0) finalVars2 = f2
                        }
                        // Extract line number from key (format: "filename:lineNumber" or just lineNumber)
                        const lineNumFromKey = bufKey.includes(':') ? Number(bufKey.split(':').pop()) : Number(bufKey)
                        const step2 = new ExecutionStep(lineNumFromKey, finalVars2, 'global', null, b.filename || filename)
                        step2.executionType = 'line'
                        step2.collapsedIterations = b.iterations || 1
                        this.currentTrace.addStep(step2)

                        const finalVarKeys = finalVars2 instanceof Map ? Array.from(finalVars2.keys()) : Object.keys(finalVars2 || {})
                        appendTerminalDebug(`Flushed comprehension (pre-step) at ${bufKey}: collapsed ${b.iterations} iterations, final vars=[${finalVarKeys.join(', ')}]`)
                    }
                    // Clear buffers after flushing
                    this._comprehensionBuffer = {}
                }
            } catch (e) {
                appendTerminalDebug('Failed to pre-flush comprehension buffers: ' + e)
            }

            const step = new ExecutionStep(lineNumber, variables, scope, null, filename)
            step.executionType = executionType

            // Skip phantom loop setup traces: avoid skipping during early startup/tests
            // where perLineMap (AST analysis) is not yet available. Only apply this
            // heuristic when we have per-line analysis data to consult; otherwise
            // record steps as-is (tests and simple runs expect these to be captured).
            const stepCount = this.currentTrace.getStepCount()
            if (this.perLineMap && this.perLineMap.size > 0 && stepCount > 0 && lineNumber > 1) {
                const varCount = variables ? (variables.size || Object.keys(variables).length || 0) : 0

                // Determine whether the source line actually has assigned or referenced names
                // according to the AST analysis. If it does, we must NOT skip the step
                // even if the runtime emitted no variables on the LINE event, because
                // the actual assigned value may appear on a subsequent step and we
                // rely on post-processing to augment the earlier step.
                let hasAstInterest = false
                try {
                    const perKey = makeLineKey(filename, lineNumber)
                    const lineAst = this.perLineMap.get(perKey)
                    if (lineAst) {
                        const assignedSet = lineAst.assigned || new Set()
                        const referencedSet = lineAst.referenced || new Set()
                        if ((assignedSet && assignedSet.size > 0) || (referencedSet && referencedSet.size > 0)) {
                            hasAstInterest = true
                        }
                    }
                } catch (e) {
                    // ignore AST lookup errors and be conservative
                    hasAstInterest = false
                }

                if (!hasAstInterest && varCount === 0) {
                    // Check if previous step was also from a different line (suggests loop setup)
                    const prevStep = this.currentTrace.getStep(stepCount - 1)
                    if (prevStep && prevStep.lineNumber !== lineNumber) {
                        appendTerminalDebug(`Skipped phantom loop setup step: line ${lineNumber} with no variables after line ${prevStep.lineNumber}`)
                        return
                    }
                }
            }

            // KAN-14 FIX: Filter phantom traces caused by MicroPython VM bugs
            // Phase 1: Check for unreachable code after break/continue/return
            if (this._isUnreachableAfterControlFlow(lineNumber, filename)) {
                appendTerminalDebug(`Skipped unreachable code after control flow: line ${lineNumber}`)
                return
            }

            // Phase 2: Check for phantom conditional traces (main KAN-14 bug)
            // MicroPython fires LINE events for last line in loop body even when
            // conditional is FALSE. We detect this by evaluating the condition.
            if (this._isPhantomConditionalTrace(lineNumber, variables, filename)) {
                appendTerminalDebug(`Skipped phantom conditional trace: line ${lineNumber}`)
                return
            }

            // Skip for-loop phantom traces: Python traces line AFTER loop before first iteration
            // to check if loop body should execute. If the line references variables that don't
            // exist yet (like loop-assigned variables), skip this phantom trace.
            // Example: for i in range(n): / rolls = roll(n) / print(rolls)
            // Trace shows: line 8 (for) → line 10 (print) → line 8 (for) → line 9 (rolls=...)
            // That first "line 10" event doesn't have 'rolls' yet - it's a phantom trace

            const lineKey = makeLineKey(filename, lineNumber)
            const lineAst = this.perLineMap?.get(lineKey)

            // Debug for line 10
            if (lineNumber === 10) {
                appendTerminalDebug(`🔍 Phantom check Line 10: lineKey="${lineKey}", hasPerLineMap=${!!this.perLineMap}, hasLineAst=${!!lineAst}, hasReferenced=${lineAst?.referenced?.size > 0}`)
            }

            if (lineAst && lineAst.referenced && lineAst.referenced.size > 0) {
                const varsMap = variables?.entries ? variables : new Map(Object.entries(variables || {}))
                let missingRefCount = 0
                let totalRefCount = 0
                const missingVars = []

                // Built-in functions that are always available
                const builtins = new Set([
                    'print', 'input', 'int', 'str', 'float', 'bool', 'len', 'range',
                    'list', 'dict', 'set', 'tuple', 'abs', 'min', 'max', 'sum', 'all',
                    'any', 'sorted', 'reversed', 'enumerate', 'zip', 'map', 'filter',
                    'open', 'type', 'isinstance', 'hasattr', 'getattr', 'setattr'
                ])

                for (const refName of lineAst.referenced) {
                    // Skip built-in functions (they're always available)
                    if (builtins.has(refName)) {
                        continue
                    }

                    // Skip variables that are ALSO assigned on this line
                    // Example: num_rolls = int(input()) assigns num_rolls but may also reference it
                    // We only care about variables that are ONLY referenced (not assigned)
                    if (lineAst.assigned && lineAst.assigned.has(refName)) {
                        continue
                    }

                    totalRefCount++
                    if (!varsMap.has(refName) && !(refName in (variables || {}))) {
                        missingRefCount++
                        missingVars.push(refName)
                    }
                }

                // Debug for line 10
                if (lineNumber === 10) {
                    appendTerminalDebug(`🔍 Phantom check Line 10: missing ${missingRefCount}/${totalRefCount} vars: [${missingVars.join(', ')}]`)
                }

                // If ALL of the (non-assigned) referenced variables are missing, this is likely a phantom trace
                if (totalRefCount > 0 && missingRefCount >= totalRefCount) {
                    appendTerminalDebug(`Skipped phantom for-loop trace: line ${lineNumber} missing ${missingRefCount}/${totalRefCount} referenced variables`)
                    return
                }
            }

            // Skip duplicate steps: same line, same variables, same execution type
            // This handles MicroPython tracing quirks where loop entry generates duplicate events
            // For 'for' loops, the duplicate may not be consecutive (loop header in between)
            if (stepCount > 0) {
                // Check last few steps (not just immediate previous) to catch non-consecutive duplicates
                const lookbackLimit = Math.min(5, stepCount) // Check up to 5 previous steps

                for (let i = 1; i <= lookbackLimit; i++) {
                    const prevStep = this.currentTrace.getStep(stepCount - i)
                    if (!prevStep ||
                        prevStep.lineNumber !== lineNumber ||
                        prevStep.executionType !== executionType ||
                        prevStep.filename !== filename) {
                        continue // Not a match, check next previous step
                    }

                    // Found same line/type/file - check if variables are identical
                    let varsIdentical = true
                    const prevVars = prevStep.variables || new Map()
                    const currVars = variables || new Map()

                    // Convert to arrays for comparison
                    const prevEntries = Array.from(prevVars.entries ? prevVars.entries() : Object.entries(prevVars))
                    const currEntries = Array.from(currVars.entries ? currVars.entries() : Object.entries(currVars))

                    if (prevEntries.length !== currEntries.length) {
                        varsIdentical = false
                    } else {
                        for (const [key, value] of currEntries) {
                            const prevValue = prevVars.get ? prevVars.get(key) : prevVars[key]
                            if (prevValue !== value) {
                                varsIdentical = false
                                break
                            }
                        }
                    }

                    if (varsIdentical) {
                        appendTerminalDebug(`Skipped duplicate step: line ${lineNumber}, matches step ${stepCount - i} (${i} steps back)`)
                        return // Don't add this duplicate step
                    }
                }
            }

            this.currentTrace.addStep(step)

            // If the step we just added follows a collapsed comprehension
            // step, retroactively augment that collapsed step with referenced
            // names found in this new step. This is a robust fallback for
            // situations where the referenced value (e.g. `n`) only appears
            // on the subsequent non-comprehension step.
            try {
                const curIndex = this.currentTrace.getStepCount() - 1
                const prevIndex = curIndex - 1
                if (prevIndex >= 0) {
                    const prevStep = this.currentTrace.getStep(prevIndex)
                    if (prevStep && prevStep.collapsedIterations && prevStep.collapsedIterations > 0) {
                        // Use normalized filename-qualified key for lookup
                        const compPrevKey = makeLineKey(prevStep.filename, prevStep.lineNumber)
                        const compInfoPrev = this.comprehensionLineMap && this.comprehensionLineMap.get(compPrevKey)
                        const targetsPrev = (compInfoPrev && compInfoPrev.compTargets) ? compInfoPrev.compTargets : new Set()
                        // Copy non-internal names from the new step into the collapsed
                        // step as a robust fallback. Exclude names that look like
                        // internal locals (local_\d+) and comprehension targets.
                        try {
                            if (step && step.variables) {
                                // iterate Map or plain object
                                if (typeof step.variables.entries === 'function') {
                                    for (const [k, v] of step.variables.entries()) {
                                        // Only copy from the same file to avoid cross-file pollution
                                        if (step.filename !== prevStep.filename) continue
                                        if (prevStep.variables.has(k)) continue
                                        if (targetsPrev.has(k)) continue
                                        if (typeof k === 'string' && /^local_\d+$/.test(k)) continue
                                        try {
                                            prevStep.variables.set(k, v)
                                            appendTerminalDebug(`Augmented collapsed step at line ${prevStep.lineNumber} with name ${k}`)
                                        } catch (e) { }
                                    }
                                } else if (typeof step.variables === 'object') {
                                    for (const k of Object.keys(step.variables)) {
                                        // Only copy from the same file to avoid cross-file pollution
                                        if (step.filename !== prevStep.filename) continue
                                        if (prevStep.variables.has(k)) continue
                                        if (targetsPrev.has(k)) continue
                                        if (typeof k === 'string' && /^local_\d+$/.test(k)) continue
                                        try {
                                            prevStep.variables.set(k, step.variables[k])
                                            appendTerminalDebug(`Augmented collapsed step at line ${prevStep.lineNumber} with name ${k}`)
                                        } catch (e) { }
                                    }
                                }
                            }
                        } catch (e) {
                            // ignore
                        }
                    }
                }
            } catch (e) {
                // ignore
            }

            // Additionally: retroactively augment a small window of earlier
            // steps (non-collapsed as well) when the newly-added step contains
            // values assigned on those earlier lines. This covers the common
            // sys.settrace behavior where a "line" event is emitted before
            // the assignment executes (so the assignment line's step may be
            // missing the assigned value). We consult the per-line analysis
            // (this.perLineMap) to determine which names were assigned on the
            // earlier line and copy matching values from the new step.
            try {
                const lookback = 3
                const perLineMap = this.perLineMap
                if (perLineMap && step && step.variables) {
                    // Iterate variables from the new step
                    if (typeof step.variables.entries === 'function') {
                        for (const [k, v] of step.variables.entries()) {
                            if (typeof k === 'string' && /^local_\d+$/.test(k)) continue
                            // Walk back a few steps to find an earlier assignment site
                            for (let idx = curIndex - 1; idx >= Math.max(0, curIndex - lookback); idx--) {
                                const prior = this.currentTrace.getStep(idx)
                                if (!prior) continue

                                // CRITICAL: Only augment steps in the SAME file
                                if (step.filename !== prior.filename) continue

                                // Avoid copying function-local values into module-level or other function scopes.
                                // If the source step is inside a function (its filename and scope indicate that),
                                // and the prior step is not in the same function scope, skip augmentation.
                                try {
                                    const srcIsFunction = !!(step.scope && String(step.scope).startsWith('function:'))
                                    const priorIsFunction = !!(prior.scope && String(prior.scope).startsWith('function:'))
                                    if (srcIsFunction !== priorIsFunction) {
                                        // different scope kinds (function vs module) - do not augment
                                        continue
                                    }
                                } catch (e) {
                                    // ignore and proceed conservatively
                                }

                                // Don't augment across loop boundaries (when line numbers go backwards)
                                // This prevents polluting previous iterations with future values
                                const priorLine = Number(prior.lineNumber)
                                const currentLine = Number(step.lineNumber)
                                const prevStepLine = idx > 0 ? Number(this.currentTrace.getStep(idx - 1).lineNumber) : priorLine

                                // Detect loop boundary: if we went from a higher line to a lower line
                                if (prevStepLine < priorLine && priorLine > currentLine) {
                                    // We've crossed a loop boundary (went backwards), stop looking back
                                    break
                                }

                                // Only consider earlier lines (not the same or later)
                                if (!(priorLine < currentLine)) continue
                                // Skip if already present
                                try {
                                    if (prior.variables && typeof prior.variables.has === 'function' && prior.variables.has(k)) continue
                                    if (prior.variables && !prior.variables.has && Object.prototype.hasOwnProperty.call(prior.variables, k)) continue
                                } catch (e) { }

                                // Check if this name was assigned on that prior line
                                try {
                                    // Use filename-qualified key for multi-file support
                                    const priorKey = makeLineKey(prior.filename, prior.lineNumber)
                                    const per = perLineMap.get(priorKey) || {}
                                    const assigned = per.assigned ? new Set(Array.from(per.assigned)) : new Set()
                                    if (!assigned.has(k)) continue
                                } catch (e) {
                                    continue
                                }

                                // Copy the value
                                try {
                                    if (!prior.variables) prior.variables = new Map()
                                    if (typeof prior.variables.set === 'function') {
                                        prior.variables.set(k, v)
                                    } else if (typeof prior.variables === 'object') {
                                        prior.variables[k] = v
                                    }
                                    appendTerminalDebug(`Retro-augmented prior step at line ${prior.lineNumber} with name ${k}`)
                                } catch (e) {
                                    // best-effort
                                }
                            }
                        }
                    } else if (typeof step.variables === 'object') {
                        for (const k of Object.keys(step.variables)) {
                            if (typeof k === 'string' && /^local_\d+$/.test(k)) continue
                            for (let idx = curIndex - 1; idx >= Math.max(0, curIndex - lookback); idx--) {
                                const prior = this.currentTrace.getStep(idx)
                                if (!prior) continue

                                // CRITICAL: Only augment steps in the SAME file
                                if (step.filename !== prior.filename) continue

                                // Don't augment across loop boundaries (when line numbers go backwards)
                                const priorLine = Number(prior.lineNumber)
                                const currentLine = Number(step.lineNumber)
                                const prevStepLine = idx > 0 ? Number(this.currentTrace.getStep(idx - 1).lineNumber) : priorLine

                                // Detect loop boundary: if we went from a higher line to a lower line
                                if (prevStepLine < priorLine && priorLine > currentLine) {
                                    break
                                }

                                if (!(priorLine < currentLine)) continue
                                try {
                                    if (prior.variables && typeof prior.variables.has === 'function' && prior.variables.has(k)) continue
                                    if (prior.variables && !prior.variables.has && Object.prototype.hasOwnProperty.call(prior.variables, k)) continue
                                } catch (e) { }
                                try {
                                    // Use filename-qualified key for multi-file support
                                    const priorKey = makeLineKey(prior.filename, prior.lineNumber)
                                    const per = perLineMap.get(priorKey) || {}
                                    const assigned = per.assigned ? new Set(Array.from(per.assigned)) : new Set()
                                    if (!assigned.has(k)) continue
                                } catch (e) { continue }
                                try {
                                    if (!prior.variables) prior.variables = new Map()
                                    if (typeof prior.variables.set === 'function') {
                                        prior.variables.set(k, step.variables[k])
                                    } else if (typeof prior.variables === 'object') {
                                        prior.variables[k] = step.variables[k]
                                    }
                                    appendTerminalDebug(`Retro-augmented prior step at line ${prior.lineNumber} with name ${k}`)
                                } catch (e) { }
                            }
                        }
                    }
                }
            } catch (e) {
                // best-effort
            }

            // Log every step for debugging multi-file recording
            appendTerminalDebug(`Recorded step ${this.currentTrace.getStepCount()}: line ${lineNumber} in ${filename || '/main.py'}, ${variables.size} vars`)

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
            onExecutionStep: (lineNumber, variables, scope, filename) => {
                this.recordStep(lineNumber, variables, scope, 'line', filename)
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
                // Skip invalidation if we're currently replaying - file switches
                // during replay should not clear the recording we're replaying!
                try {
                    if (window.ReplayEngine && window.ReplayEngine.isReplaying) {
                        return
                    }
                } catch (e) { /* ignore */ }

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
