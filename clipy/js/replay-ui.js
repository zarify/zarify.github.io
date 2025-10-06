// Replay UI: Controls and visualization for execution replay
import { appendTerminalDebug } from './terminal.js'
import { getFileManager } from './vfs-client.js'
import { $, normalizeFilename, makeLineKey } from './utils.js'
import { ExecutionTrace } from './execution-recorder.js'

/**
 * Line decorator for CodeMirror integration
 */
export class ReplayLineDecorator {
    constructor(codemirror) {
        this.codemirror = codemirror
        this.activeWidgets = []
        this.currentExecutionLine = null
        this.lineReferenceMap = null  // Will be set by ReplayEngine
    }

    /**
     * Show variables at a specific line
     * @param {number} lineNumber - Line number to show variables for
     * @param {Map} variables - Variables at this step
     * @param {Object} executionTrace - The execution trace (needed to look ahead for assigned values)
     * @param {number} currentStepIndex - Current step index (needed to look ahead)
     * @param {string} filename - The filename for this step (used for multi-file AST lookup)
     */
    showVariablesAtLine(lineNumber, variables, executionTrace = null, currentStepIndex = -1, originalTrace = null, filename = null) {
        if (!this.codemirror || !variables || variables.size === 0) {
            appendTerminalDebug(`showVariablesAtLine: skipped - codemirror=${!!this.codemirror}, variables=${variables ? variables.size : 'null'}`)
            return
        }

        try {
            appendTerminalDebug(`showVariablesAtLine: line ${lineNumber}, ${variables.size} variables total`)
            if (filename && filename.includes('dice')) {
                appendTerminalDebug(`  🎯 Received variables: ${Array.from(variables.entries()).map(([k, v]) => `${k}=${v}`).join(', ')}`)
            }

            // Get the source text for the given line
            let lineText = ''
            try {
                lineText = this.codemirror.getLine(lineNumber - 1) || ''
            } catch (e) {
                lineText = ''
            }

            // Use cached AST analysis to determine which variables are assigned/referenced on this line
            const displayVars = new Map()
            const astData = this.getReferencedNamesForLine(lineNumber, filename)

            // Helper: Filter out built-in functions and internal variables
            const isBuiltinOrInternal = (name, value) => {
                // Filter out common built-in functions that shouldn't be shown
                const builtins = ['print', 'input', 'int', 'str', 'float', 'len', 'range', 'list', 'dict', 'set', 'tuple']
                if (builtins.includes(name)) return true

                // Filter out function objects (unless they're user-defined and assigned on this line)
                if (typeof value === 'string' && value.startsWith('<function') && !astData?.assigned.has(name)) return true

                return false
            }

            if (astData && (astData.assigned.size > 0 || astData.referenced.size > 0)) {

                // Strategy: Show both assigned AND referenced variables
                // SOLUTION: Use RETURN events for correct final values
                //
                // Python's sys.settrace has standard timing behavior:
                // - LINE events fire BEFORE line execution (show pre-execution state)
                // - RETURN events fire AFTER function return (show post-execution state)
                //
                // For loops, LINE events show stale values because they fire BEFORE the line runs.
                // But RETURN events capture the final state AFTER all execution completes.
                //
                // Evidence from debug logs (KAN-10 Comment #10048):
                // Execution: i=0 → i+=1 → i+=1 → i+=1 → done (should end with i=3)
                // Recorded:
                // - Step 3: [line] Line 3 vars: {i=0}  ← Before 1st i+=1 ✅
                // - Step 4: [line] Line 3 vars: {i=0}  ← Before 2nd i+=1 (stale by 1)
                // - Step 5: [line] Line 3 vars: {i=1}  ← Before 3rd i+=1 (stale by 1)  
                // - Step 6: [line] Line 3 vars: {i=2}  ← Before 4th i+=1 (stale by 1)
                // - Step 7: [return] Line 3 vars: {i=3} ← RETURN has correct final value! ✅
                //
                // Solution: Look for RETURN event in the trace and use its values for final iteration

                // Prepare to find RETURN event values on a per-variable basis.
                // Previously we grabbed the first RETURN in the whole trace which
                // could belong to an unrelated function and produced incorrect
                // values for other source lines. Instead, search the original
                // trace near the current original index for a RETURN that contains
                // the desired variable name.
                let originalIndex = -1
                if (originalTrace && currentStepIndex >= 0) {
                    // Map currentStepIndex (which counts non-RETURN steps) to the
                    // corresponding index inside originalTrace (which includes RETURNs).
                    let nonReturnCount = 0
                    for (let i = 0; i < originalTrace.getStepCount(); i++) {
                        const step = originalTrace.getStep(i)
                        if (step.executionType !== 'return') {
                            if (nonReturnCount === currentStepIndex) {
                                originalIndex = i
                                break
                            }
                            nonReturnCount++
                        }
                    }
                }

                const findReturnValue = (name, forwardLimit = 50) => {
                    if (!originalTrace) return undefined

                    // Prefer RETURN events after the current originalIndex (forward search)
                    const start = originalIndex >= 0 ? originalIndex + 1 : 0
                    const end = Math.min(originalTrace.getStepCount(), start + forwardLimit)
                    for (let j = start; j < end; j++) {
                        const s = originalTrace.getStep(j)
                        if (!s || s.executionType !== 'return') continue
                        try {
                            const vars = s.variables
                            if (!vars) continue
                            const val = (typeof vars.get === 'function') ? vars.get(name) : vars[name]
                            if (val !== undefined) {
                                appendTerminalDebug(`  ✅ Found RETURN event at step ${j} for '${name}': ${val}`)
                                return val
                            }
                        } catch (e) { /* ignore malformed return step */ }
                    }

                    // Fallback: search all RETURN events for this name (slower but safe)
                    for (let j = 0; j < originalTrace.getStepCount(); j++) {
                        const s = originalTrace.getStep(j)
                        if (!s || s.executionType !== 'return') continue
                        try {
                            const vars = s.variables
                            if (!vars) continue
                            const val = (typeof vars.get === 'function') ? vars.get(name) : vars[name]
                            if (val !== undefined) {
                                appendTerminalDebug(`  ✅ Found RETURN event elsewhere at step ${j} for '${name}': ${val}`)
                                return val
                            }
                        } catch (e) { /* ignore */ }
                    }

                    appendTerminalDebug(`  ❌ No RETURN event found for '${name}'`)
                    return undefined
                }

                // Get next step for one-step look-ahead
                // Since RETURN events are now filtered out, we don't need to check executionType
                let nextStepVars = null
                let nextStepSameFileVars = null  // Track next step in same file for assignments
                if (originalTrace && currentStepIndex >= 0) {
                    // Find the current step in originalTrace by counting non-return steps
                    let originalIndex = -1
                    let nonReturnCount = 0
                    for (let i = 0; i < originalTrace.getStepCount(); i++) {
                        const step = originalTrace.getStep(i)
                        if (step.executionType !== 'return') {
                            if (nonReturnCount === currentStepIndex) {
                                originalIndex = i
                                break
                            }
                            nonReturnCount++
                        }
                    }
                    if (originalIndex >= 0 && originalIndex < originalTrace.getStepCount() - 1) {
                        const nextStep = originalTrace.getStep(originalIndex + 1)
                        // For assigned variables, use next step even if different file, to get post-execution value
                        if (nextStep) {
                            // Translate local_* variables in next step to real names
                            const normalizedFilename = normalizeFilename(nextStep.filename)
                            nextStepVars = this.translateLocalVariables(nextStep.variables, nextStep.lineNumber, normalizedFilename)
                        }

                        // Also look ahead for next step in SAME file (for function call assignments)
                        // This handles cases like: rolls = roll(num_dice)
                        // Where the immediate next step enters the function, but we need the value
                        // after returning to the same file
                        const currentFilename = normalizeFilename(filename)
                        for (let j = originalIndex + 1; j < originalTrace.getStepCount(); j++) {
                            const futureStep = originalTrace.getStep(j)
                            if (futureStep.executionType === 'return') continue

                            const futureFilename = normalizeFilename(futureStep.filename)
                            if (futureFilename === currentFilename) {
                                // Found next step in same file
                                nextStepSameFileVars = this.translateLocalVariables(
                                    futureStep.variables,
                                    futureStep.lineNumber,
                                    futureFilename
                                )
                                break
                            }
                        }
                    }
                }

                appendTerminalDebug(`  📍 Line ${lineNumber}: assigned=${Array.from(astData.assigned).join(',')}, referenced=${Array.from(astData.referenced).join(',')}`)
                appendTerminalDebug(`  📍 Current step: ${Array.from(variables.entries()).map(([k, v]) => `${k}=${v}`).join(', ')}`)
                appendTerminalDebug(`  📍 Next step: ${nextStepVars ? Array.from(nextStepVars.entries()).map(([k, v]) => `${k}=${v}`).join(', ') : 'none'}`)
                appendTerminalDebug(`  📍 Next step (same file): ${nextStepSameFileVars ? Array.from(nextStepSameFileVars.entries()).map(([k, v]) => `${k}=${v}`).join(', ') : 'none'}`)
                appendTerminalDebug(`  📍 Return event lookups will be resolved per-variable (anchored near originalIndex ${originalIndex})`)

                // First, add all assigned variables
                for (const name of astData.assigned) {
                    // Skip built-ins
                    if (isBuiltinOrInternal(name, variables.get(name))) {
                        continue
                    }

                    // For assignments, ALWAYS use look-ahead to show after-execution value
                    // This is standard debugger behavior: show the result of executing the line
                    // Fallback chain: next-same-file → next step → RETURN event (if available) → current step
                    //
                    // Prefer next-same-file for function call assignments like: rolls = roll(num_dice)
                    // The immediate next step enters the function (different file), but we need
                    // the value after returning to continue execution in the current file
                    let value = nextStepSameFileVars?.get(name)

                    // If no same-file lookahead, try immediate next step
                    if (value === undefined) {
                        value = nextStepVars?.get(name)
                    }

                    // If no next step, try to find a RETURN event value for this name
                    if (value === undefined) {
                        try {
                            const rv = findReturnValue(name)
                            if (rv !== undefined) value = rv
                        } catch (e) { /* ignore */ }
                    }

                    // Final fallback to current step (shouldn't happen in normal cases)
                    if (value === undefined) {
                        value = variables.get(name)
                    }

                    // Special case: if variable not found but next step has local_N variables,
                    // the variable might be a newly assigned local variable inside a function
                    if (value === undefined && nextStepVars) {
                        // Check if any local_N exists in next step - if so, try to translate
                        const hasLocalVars = Array.from(nextStepVars.keys()).some(k => k.startsWith('local_'))
                        if (hasLocalVars && this.functionLocalMaps) {
                            // Find the function we're in by checking if any function map contains this variable
                            for (const [funcName, localVars] of Object.entries(this.functionLocalMaps)) {
                                const index = localVars.indexOf(name)
                                if (index !== -1) {
                                    const localName = `local_${index}`
                                    value = nextStepVars.get(localName)
                                    if (value !== undefined) {
                                        break
                                    }
                                }
                            }
                        }
                    }

                    if (value !== undefined) {
                        displayVars.set(name, value)
                    }
                }

                // Then, add referenced variables that aren't already in displayVars
                // Prefer look-ahead (next step or RETURN event) values when available.
                // If next-step isn't present (or is in a different file), attempt
                // a short forward search in the executionTrace for the first
                // occurrence of the variable. However, DO NOT perform cross-file
                // lookups for function-local variables (to avoid leaking locals
                // across frames).
                for (const name of astData.referenced) {
                    if (displayVars.has(name)) continue
                    // Skip built-ins/internal
                    const currentVal = variables && (variables.get ? variables.get(name) : (variables[name]))
                    if (isBuiltinOrInternal(name, currentVal)) continue

                    let chosen = undefined

                    // Prefer next-step (translated) values when present - these represent
                    // post-execution assigned values and avoid showing stale previous values
                    if (nextStepVars && typeof nextStepVars.get === 'function' && nextStepVars.has(name)) {
                        chosen = nextStepVars.get(name)
                        appendTerminalDebug(`  🔁 Using next-step lookahead for referenced '${name}': ${chosen}`)
                    }

                    // If no next-step value, try RETURN event vars (final values)
                    if (chosen === undefined) {
                        try {
                            const rv = findReturnValue(name)
                            if (rv !== undefined) {
                                chosen = rv
                                appendTerminalDebug(`  🔁 Using RETURN event for referenced '${name}': ${chosen}`)
                            }
                        } catch (e) { /* ignore */ }
                    }

                    // If still nothing, attempt a short forward search in executionTrace
                    // for the first occurrence of this variable (up to a limit). This
                    // allows lookahead across files when the assigned value occurs in
                    // a different file (common with helper modules). However, if the
                    // variable is a function-local in this file, restrict the search
                    // to the same file only to avoid leaking locals.
                    if (chosen === undefined && executionTrace && typeof currentStepIndex === 'number') {
                        try {
                            const lookaheadLimit = 20
                            let allowCrossFile = true
                            try {
                                // Determine whether this name is function-local at this line
                                const funcKey = makeLineKey(filename, lineNumber)
                                const functionName = this.lineFunctionMap && this.lineFunctionMap.get(funcKey)
                                if (functionName && this.functionLocalMaps && Array.isArray(this.functionLocalMaps[functionName])) {
                                    const localNames = this.functionLocalMaps[functionName]
                                    if (localNames && localNames.indexOf(name) !== -1) {
                                        // It's a function-local; do not search cross-file
                                        allowCrossFile = false
                                    }
                                }
                            } catch (e) {
                                // ignore - conservative default allows cross-file
                            }

                            for (let j = currentStepIndex + 1; j < Math.min(executionTrace.getStepCount(), currentStepIndex + 1 + lookaheadLimit); j++) {
                                const nxt = executionTrace.getStep(j)
                                if (!nxt || !nxt.variables) continue

                                if (!allowCrossFile && nxt.filename !== filename) continue

                                // Prefer translated local variables when available
                                let val = undefined
                                try {
                                    if (typeof nxt.variables.get === 'function') {
                                        val = nxt.variables.get(name)
                                    } else if (Object.prototype.hasOwnProperty.call(nxt.variables, name)) {
                                        val = nxt.variables[name]
                                    }
                                } catch (e) { val = undefined }

                                if (val !== undefined) {
                                    chosen = val
                                    appendTerminalDebug(`  🔎 Found forward-lookahead for '${name}' at step ${j} (file=${nxt.filename}): ${chosen}`)
                                    break
                                }
                            }
                        } catch (e) {
                            // ignore search errors
                        }
                    }

                    // Final fallback to current step (pre-execution) if still nothing
                    if (chosen === undefined) chosen = currentVal

                    if (chosen !== undefined) displayVars.set(name, chosen)
                }

                // Finally, evaluate and add subscript expressions (e.g., beats[h] = 1)
                if (astData.subscripts && astData.subscripts.length > 0) {
                    for (const { object, key } of astData.subscripts) {
                        try {
                            // Get the object value
                            const objValue = variables.get(object)
                            if (!objValue || typeof objValue !== 'string') {
                                continue
                            }

                            // Get the key value (could be a variable or a constant)
                            let keyValue = key
                            if (typeof key === 'string' && variables.has(key)) {
                                keyValue = variables.get(key)
                            }

                            // Try to evaluate the subscript
                            const result = this.evaluateSubscript(objValue, keyValue)
                            if (result !== undefined) {
                                // Add with a special format like "beats[h]"
                                const displayName = typeof key === 'string' && variables.has(key)
                                    ? `${object}[${key}]`
                                    : `${object}[${JSON.stringify(key)}]`
                                // Format the result: add quotes around strings to match Python repr
                                const formattedResult = typeof result === 'string'
                                    ? `'${result}'`
                                    : result
                                displayVars.set(displayName, formattedResult)
                            }
                        } catch (e) {
                            // Silently skip subscripts that can't be evaluated
                        }
                    }
                }
            } else if (astData) {
                // AST data exists but indicates no variables assigned or referenced on this line
                // Show nothing (e.g., return statement with a constant, pass, etc.)
            } else {
                // Fallback: if AST not available at all, show all variables (better than showing nothing)
                for (const [name, value] of variables) {
                    displayVars.set(name, value)
                }
            }

            if (displayVars.size === 0) {
                return
            }

            if (filename && filename.includes('dice')) {
                appendTerminalDebug(`  🎨 Final displayVars: ${Array.from(displayVars.entries()).map(([k, v]) => `${k}=${v}`).join(', ')}`)
            }

            // Create HTML element for variable display (each variable on its own row)
            const variableDisplay = this.formatVariablesForDisplay(displayVars)

            // Ensure value text doesn't overflow a reasonable width — cap to editor width
            // Add line widget below the specified line
            const widget = this.codemirror.addLineWidget(lineNumber - 1, variableDisplay, {
                coverGutter: false,
                noHScroll: true,
                above: false
            })
            this.activeWidgets.push(widget)
        } catch (error) {
            appendTerminalDebug('Failed to show variables at line: ' + error)
        }
    }

    /**
     * Evaluate a subscript expression like dict[key] or list[index]
     * @param {string} objValue - String representation of the object (e.g., "{1: 2, 3: 4}")
     * @param {*} keyValue - The key/index to look up
     * @returns {*} The subscript result, or undefined if evaluation fails
     */
    evaluateSubscript(objValue, keyValue) {
        try {
            // Parse the object string representation into a JavaScript object
            let obj

            // Handle dictionary format: {1: 2, 3: 4}
            if (objValue.startsWith('{') && objValue.endsWith('}')) {
                // Convert Python dict repr to JSON by replacing single quotes with double quotes
                // and handling numeric keys properly
                const jsonStr = objValue
                    .replace(/'/g, '"')
                    .replace(/(\d+):/g, '"$1":')  // Wrap numeric keys in quotes
                obj = JSON.parse(jsonStr)
            }
            // Handle list/tuple format: [1, 2, 3] or (1, 2, 3)
            else if ((objValue.startsWith('[') && objValue.endsWith(']')) ||
                (objValue.startsWith('(') && objValue.endsWith(')'))) {
                const jsonStr = objValue
                    .replace(/'/g, '"')
                    .replace(/^\(/, '[')
                    .replace(/\)$/, ']')
                obj = JSON.parse(jsonStr)
            }
            // Handle string format: 'hello' or "hello"
            else if ((objValue.startsWith("'") && objValue.endsWith("'")) ||
                (objValue.startsWith('"') && objValue.endsWith('"'))) {
                obj = objValue.slice(1, -1)
            }
            else {
                return undefined
            }

            // Look up the key/index
            // For objects (dicts), convert key to string for lookup
            if (typeof obj === 'object' && !Array.isArray(obj)) {
                return obj[String(keyValue)]
            }
            // For arrays/strings, use numeric index
            else if (Array.isArray(obj) || typeof obj === 'string') {
                const index = parseInt(keyValue)
                return isNaN(index) ? undefined : obj[index]
            }

            return undefined
        } catch (e) {
            return undefined
        }
    }

    /**
     * Highlight current execution line
     */
    highlightExecutionLine(lineNumber) {
        try {
            // Clear previous highlight
            if (this.currentExecutionLine !== null) {
                this.codemirror.removeLineClass(this.currentExecutionLine - 1, 'background', 'execution-current')
            }

            // Add new highlight
            if (lineNumber > 0) {
                this.codemirror.addLineClass(lineNumber - 1, 'background', 'execution-current')
                this.currentExecutionLine = lineNumber

                // Scroll to the line with proper margin
                // CodeMirror's scrollIntoView accepts a margin parameter (in pixels)
                // We want 3 lines of context above/below, plus space for variable widgets
                const lineHeight = this.codemirror.defaultTextHeight() || 18
                const contextLines = 3
                const widgetEstimate = 100  // Estimate for variable display widget
                const margin = (contextLines * lineHeight) + widgetEstimate

                this.codemirror.scrollIntoView(
                    { line: lineNumber - 1, ch: 0 },
                    margin  // This ensures we have space above AND below
                )
            }
        } catch (error) {
            appendTerminalDebug('Failed to highlight execution line: ' + error)
        }
    }

    /**
     * Get variable names to display for a specific line (using AST analysis)
     * Returns an object with { assigned: Set, referenced: Set }
     * Display logic should prioritize assigned variables
     */
    getReferencedNamesForLine(lineNumber, filename = null) {
        if (!this.lineReferenceMap) {
            return null
        }

        // Debug: Show what filename we received
        if (filename) {
            appendTerminalDebug(`  🔍 getReferencedNamesForLine called with filename="${filename}", lineNumber=${lineNumber}`)
        }

        // Normalize special filenames: <stdin> → /main.py
        let normalizedFilename = filename
        if (filename === '<stdin>') normalizedFilename = '/main.py'
        else if (filename && !filename.startsWith('/')) normalizedFilename = `/${filename}`
        // Use filename-qualified key for multi-file support
        const key = makeLineKey(normalizedFilename, lineNumber)
        if (!this.lineReferenceMap.has(key)) {
            appendTerminalDebug(`  ⚠️ getReferencedNamesForLine: key="${key}" NOT FOUND in lineReferenceMap`)
            appendTerminalDebug(`  📋 Available keys: ${Array.from(this.lineReferenceMap.keys()).slice(0, 5).join(', ')}...`)

            // Attempt a one-time rebuild of the lineReferenceMap from the
            // originalTrace metadata sourceCode (useful after config switches
            // where files may not yet be materialized). Avoid infinite loops
            // by checking a flag.
            try {
                if (!this._attemptedSeedFromTrace && this.originalTrace && this.originalTrace.metadata && this.originalTrace.metadata.sourceCode) {
                    this._attemptedSeedFromTrace = true
                    appendTerminalDebug('  ℹ️ Attempting to rebuild lineReferenceMap from originalTrace.metadata.sourceCode')
                    // buildLineReferenceMap is async but we can call it and await it synchronously
                    // within this function by using a synchronous Promise resolution pattern
                    // Note: buildLineReferenceMap handles its own errors
                    this.buildLineReferenceMap(this.originalTrace.metadata.sourceCode).catch((e) => {
                        appendTerminalDebug('  ⚠️ rebuild failed: ' + e)
                    })
                    // After scheduling rebuild, return null for now; future calls will use rebuilt map
                    return null
                }
            } catch (e) {
                appendTerminalDebug('  ⚠️ Error while attempting rebuild: ' + e)
            }

            return null
        }
        const lineData = this.lineReferenceMap.get(key)

        appendTerminalDebug(`  ✅ getReferencedNamesForLine: key="${key}" → assigned={${Array.from(lineData.assigned).join(', ')}}, referenced={${Array.from(lineData.referenced).join(', ')}}`)

        // Return both assigned and referenced sets
        // Also include function calls in referenced (functions being called are "referenced")
        const referencedWithCalls = new Set([...lineData.referenced, ...lineData.functionCalls])

        return {
            assigned: lineData.assigned || new Set(),
            referenced: referencedWithCalls,
            subscripts: lineData.subscripts || []
        }
    }

    /**
     * Translate local_N variables to real names using AST-based function maps
     * @param {Map} variables - Variable map from execution trace
     * @param {number} lineNumber - Current line number
     * @param {string} filename - Current filename for multi-file support
     * @returns {Map} Translated variable map
     */
    translateLocalVariables(variables, lineNumber, filename = null) {
        if (!variables || !this.functionLocalMaps || !this.lineFunctionMap) {
            return variables;
        }

        // Normalize special filenames: <stdin> → /main.py
        let normalizedFilename = filename
        if (filename === '<stdin>') {
            normalizedFilename = '/main.py'
        } else if (filename && !filename.startsWith('/')) {
            // Prepend "/" if missing
            normalizedFilename = `/${filename}`
        }

        // Determine which function this line belongs to (use filename-qualified key)
        const key = makeLineKey(filename, lineNumber)
        const functionName = this.lineFunctionMap.get(key);

        // DEBUG: Log translation attempts for dice.py
        if (filename && filename.includes('dice')) {
            appendTerminalDebug(`  🔤 translateLocalVariables: key=${key}, functionName=${functionName || 'NONE'}, hasLocalVars=${Array.from(variables.keys()).some(k => k.startsWith('local_'))}`)
        }

        if (!functionName) {
            // Module level - no translation needed
            return variables;
        }

        // Get the local variable map for this function
        const localVarNames = this.functionLocalMaps[functionName];
        if (!localVarNames || localVarNames.length === 0) {
            return variables;
        }

        // Translate local_N to real names, filtering out unmapped locals (stack temporaries)
        const translated = new Map();
        for (const [key, value] of variables) {
            if (key.startsWith('local_')) {
                const index = parseInt(key.substring(6));
                const realName = localVarNames[index];
                if (realName) {
                    translated.set(realName, value);
                }
                // else: Skip unmapped local_N (stack temporary) - don't include it
            } else {
                // Not a local_N variable - keep as is
                translated.set(key, value);
            }
        }

        return translated;
    }

    /**
     * Format variables for display
     */
    formatVariablesForDisplay(variables) {
        const container = document.createElement('div')
        container.className = 'variable-display'

        // limit number of variables shown to avoid huge widgets
        const maxDisplay = 10
        let count = 0

        // attempt to compute pixel widths so we can truncate values to fit
        let containerMaxPx = 400
        try {
            const editorWrapper = this.codemirror.getWrapperElement()
            if (editorWrapper && editorWrapper.clientWidth) {
                containerMaxPx = Math.max(200, Math.min(600, editorWrapper.clientWidth - 100))
            }
        } catch (e) {
            // ignore
        }

        // helper to measure text width in current page fonts
        const measureTextWidth = (text, className) => {
            const s = document.createElement('span')
            s.style.visibility = 'hidden'
            s.style.position = 'absolute'
            s.style.whiteSpace = 'nowrap'
            if (className) s.className = className
            s.textContent = text
            document.body.appendChild(s)
            const w = s.offsetWidth || 0
            document.body.removeChild(s)
            return w
        }

        const approxCharPx = Math.max(6, measureTextWidth('0', 'variable-value'))

        for (const [name, value] of variables) {
            if (count >= maxDisplay) {
                const more = document.createElement('div')
                more.className = 'variable-row variable-more'
                more.textContent = `... and ${variables.size - maxDisplay} more variables`
                container.appendChild(more)
                break
            }

            const row = document.createElement('div')
            row.className = 'variable-row'

            const nameEl = document.createElement('span')
            nameEl.className = 'variable-name'
            nameEl.textContent = name + ' = '

            const valueEl = document.createElement('span')
            valueEl.className = 'variable-value'
            // measure name width and compute available chars for the value
            const namePx = measureTextWidth(nameEl.textContent, 'variable-name')
            const availablePx = Math.max(50, containerMaxPx - namePx - 24)
            const maxChars = Math.max(8, Math.floor(availablePx / approxCharPx))
            valueEl.textContent = this.formatValue(value, maxChars)

            row.appendChild(nameEl)
            row.appendChild(valueEl)
            container.appendChild(row)
            count++
        }

        // Add minimal inline styles to prevent horizontal overflow if editor width known
        try {
            const editorWrapper = this.codemirror.getWrapperElement()
            if (editorWrapper && editorWrapper.clientWidth) {
                container.style.maxWidth = Math.max(200, Math.min(600, editorWrapper.clientWidth - 100)) + 'px'
            }
        } catch (e) {
            // ignore
        }

        return container
    }

    /**
     * Format a single value for display
     */
    formatValue(value, maxChars = 80) {
        if (value === null) return 'None'
        if (value === undefined) return 'undefined'
        // Strings: DO NOT add quotes — display raw/truncated string value as-is.
        if (typeof value === 'string') {
            return this.truncateString(value, maxChars)
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value)
        }
        if (Array.isArray(value)) {
            // Format inner values, then truncate the joined representation preserving brackets
            const inner = value.map(v => this.formatValue(v, Math.max(8, Math.floor(maxChars / Math.max(1, value.length))))).join(', ')
            return this.truncateWrapped(inner, '[', ']', maxChars)
        }
        if (typeof value === 'object') {
            const entries = Object.entries(value).slice(0, 3)
            const formatted = entries.map(([k, v]) => `${k}: ${this.formatValue(v, Math.max(8, Math.floor(maxChars / Math.max(1, entries.length))))}`).join(', ')
            const body = `${formatted}${Object.keys(value).length > 3 ? ', ...' : ''}`
            return this.truncateWrapped(body, '{', '}', maxChars)
        }
        return String(value)
    }

    /**
     * Truncate a plain string with ellipses if too long. Do not add quotes.
     */
    truncateString(s, max = 80) {
        if (s.length <= max) return s
        return `${s.slice(0, max - 3)}...`
    }

    /**
     * Truncate content that is displayed inside opening/closing wrappers (like [ ... ] or { ... })
     * and preserve the wrappers while placing ellipses before the closing wrapper if truncated.
     */
    truncateWrapped(content, open, close, max = 80) {
        const full = `${open}${content}${close}`
        if (full.length <= max) return full
        // keep the opening and the close, but shorten content and add ellipses before close
        const spaceForContent = max - open.length - close.length - 3 // for '...'
        const shortened = content.slice(0, Math.max(0, spaceForContent))
        return `${open}${shortened}...${close}`
    }

    /**
     * Escape a string for safe insertion into a regex pattern
     */
    escapeForRegex(str) {
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    /**
     * Clear all decorations
     */
    clearAllDecorations() {
        try {
            // Remove all line widgets
            for (const widget of this.activeWidgets) {
                widget.clear()
            }
            this.activeWidgets = []

            // Clear execution line highlight
            if (this.currentExecutionLine !== null) {
                this.codemirror.removeLineClass(this.currentExecutionLine - 1, 'background', 'execution-current')
                this.currentExecutionLine = null
            }
        } catch (error) {
            appendTerminalDebug('Failed to clear decorations: ' + error)
        }
    }
}

/**
 * Main replay engine class
 */
export class ReplayEngine {
    constructor() {
        this.executionTrace = null
        this._originalTrace = null  // Unfiltered trace with RETURN events (private)
        this.currentStepIndex = 0
        this.isReplaying = false
        this.lineDecorator = null
        this.ui = null
        this.currentFilename = '/main.py'  // Track which file is currently being shown
        this.lineReferenceMap = null  // Cache for AST-based line references
        appendTerminalDebug(`🏗️ ReplayEngine constructed - originalTrace is null`)
    }

    // Getter/setter to track originalTrace changes
    get originalTrace() {
        return this._originalTrace
    }

    set originalTrace(value) {
        const stack = new Error().stack.split('\n')[2] // Get caller info
        appendTerminalDebug(`🔄 originalTrace SETTER called from: ${stack.trim()}`)
        appendTerminalDebug(`   Old value: ${this._originalTrace ? `${this._originalTrace.getStepCount()} steps` : 'null'}`)
        appendTerminalDebug(`   New value: ${value ? `${value.getStepCount()} steps` : 'null'}`)
        this._originalTrace = value
    }

    /**
     * Filter out RETURN events from execution trace
     * RETURN events contain final values but aren't real execution steps
     */
    filterReturnEvents(originalTrace) {
        const filtered = new ExecutionTrace()

        // Copy metadata
        filtered.metadata = { ...originalTrace.metadata }

        // Copy only LINE events (skip RETURN events)
        for (let i = 0; i < originalTrace.getStepCount(); i++) {
            const step = originalTrace.getStep(i)
            if (step.executionType !== 'return') {
                filtered.addStep(step)
            }
        }

        return filtered
    }

    /**
     * Start replay with an execution trace
     */
    async startReplay(executionTrace) {
        if (!executionTrace || executionTrace.getStepCount() === 0) {
            appendTerminalDebug('Cannot start replay: no execution trace available')
            return false
        }

        try {
            // If already replaying with the same trace, just rewind to the start
            if (this.isReplaying && this.executionTrace === executionTrace) {
                appendTerminalDebug('Replay already active — rewinding to start')
                this.currentStepIndex = 0
                // Ensure originalTrace is set (might be missing if this is a rewind)
                appendTerminalDebug(`🔧 Rewind path - originalTrace currently: ${this.originalTrace ? 'exists' : 'null'}`)
                if (!this.originalTrace) {
                    this.originalTrace = executionTrace
                    appendTerminalDebug(`✅ originalTrace SET in rewind path with ${this.originalTrace.getStepCount()} steps`)
                } else {
                    appendTerminalDebug(`ℹ️ originalTrace already exists, keeping it`)
                }
                // Clear decorations and display first step
                if (this.lineDecorator) {
                    this.lineDecorator.clearAllDecorations()
                }
                // When rewinding, ensure we're on the correct file for the first step
                const firstStep = executionTrace.getStep(0)
                if (firstStep && firstStep.filename) {
                    this.ensureCorrectFileIsActive(firstStep.filename)
                }
                this.displayCurrentStep()
                this.updateUI()
                return true
            }

            // If a different trace or not currently replaying, (re)initialize state
            // Ensure any previous decorations are cleared before starting
            if (this.lineDecorator) {
                try { this.lineDecorator.clearAllDecorations() } catch (e) { /* ignore */ }
            }

            // Filter out RETURN events from the trace - they're metadata only, not execution steps
            // This ensures the UI (scrubber, step count, etc.) only shows real execution steps
            const filteredTrace = this.filterReturnEvents(executionTrace)
            appendTerminalDebug(`Filtered trace: ${executionTrace.getStepCount()} steps → ${filteredTrace.getStepCount()} steps (removed RETURN events)`)

            this.executionTrace = filteredTrace
            // NOTE: Don't set originalTrace yet - will set after file switch to avoid code change handlers
            this.currentStepIndex = 0
            this.isReplaying = true

            // Build AST line reference map from source code
            if (executionTrace.metadata && executionTrace.metadata.sourceCode) {
                await this.buildLineReferenceMap(executionTrace.metadata.sourceCode)
            }

            // Initialize line decorator and pass it the AST reference map
            if (window.cm) {
                this.lineDecorator = new ReplayLineDecorator(window.cm)
                this.lineDecorator.lineReferenceMap = this.lineReferenceMap
                this.lineDecorator.functionLocalMaps = this.functionLocalMaps
                this.lineDecorator.lineFunctionMap = this.lineFunctionMap
            }

            // Before showing replay UI and displaying the first step, ensure
            // we're viewing a Python code file (not a data file like .txt).
            // Get the first execution step to determine which file to show.
            const firstStep = executionTrace.getStep(0)
            if (firstStep && firstStep.filename) {
                this.ensureCorrectFileIsActive(firstStep.filename)
            }

            // NOW set originalTrace AFTER file switching is complete
            // This prevents it from being cleared if file switch triggers code change events
            appendTerminalDebug(`🔧 About to set originalTrace (currently: ${this.originalTrace ? 'exists' : 'null'})...`)
            this.originalTrace = executionTrace
            appendTerminalDebug(`✅ originalTrace SET with ${this.originalTrace.getStepCount()} steps`)

            // Show replay UI
            this.showReplayUI()

            // Reset scrubber to start when replay begins
            try {
                const scrubber = $('replay-scrubber')
                if (scrubber) {
                    scrubber.value = 0
                    scrubber.disabled = false
                }
            } catch (e) { /* ignore */ }

            // Display first step
            appendTerminalDebug(`🎬 About to display first step - originalTrace: ${this.originalTrace ? `${this.originalTrace.getStepCount()} steps` : 'NULL!'} `)
            this.displayCurrentStep()

            appendTerminalDebug(`Replay started with ${executionTrace.getStepCount()} steps`)
            return true
        } catch (error) {
            appendTerminalDebug('Failed to start replay: ' + error)
            return false
        }
    }

    /**
     * Build AST-based line reference map from all workspace Python files
     */
    async buildLineReferenceMap(sourceCode) {
        try {
            // Dynamically import AST analyzer
            const { getASTAnalyzer } = await import('./ast-analyzer.js')
            const analyzer = await getASTAnalyzer()

            // Initialize map for all files
            this.lineReferenceMap = new Map()
            this.functionLocalMaps = {}
            this.lineFunctionMap = new Map()

            // CRITICAL FIX: When building the line reference map during replay startup,
            // the trace metadata contains the ACTUAL source code that was recorded,
            // which may differ from the current FileManager files (especially after
            // config switches). We must seed from trace.metadata.sourceCode FIRST
            // to ensure replay uses the correct AST analysis that matches the recording.
            //
            // Previously we analyzed FileManager files first then seeded from sourceCode
            // as a fallback, but this caused replay to use stale AST data from a
            // different config (e.g., variable "bye" from config A when replaying
            // config B which has "num_dice").

            appendTerminalDebug(`🔍 buildLineReferenceMap called with sourceCode: ${sourceCode ? `${sourceCode.length} chars` : 'NONE'}`)

            // If a sourceCode string was provided (from executionTrace.metadata),
            // seed the /main.py entry FIRST so lookups use the recorded source.
            if (sourceCode && typeof sourceCode === 'string') {
                try {
                    const ast = await analyzer.parse(sourceCode)
                    const perLine = analyzer.getVariablesAndCallsPerLine(ast)
                    const comps = analyzer.analyzeComprehensions(ast, '*')
                    const compArray = comps?.comprehensions || (Array.isArray(comps) ? comps : [])

                    // Process perLine into normalized keys for /main.py
                    for (const [lineNum, lineData] of perLine.entries()) {
                        const ln = Number(lineNum)
                        const key = makeLineKey('/main.py', ln)
                        const dataCopy = {
                            assigned: new Set(lineData.assigned || []),
                            referenced: new Set(lineData.referenced || []),
                            functionCalls: new Set(lineData.functionCalls || []),
                            subscripts: Array.isArray(lineData.subscripts) ? lineData.subscripts.slice() : []
                        }
                        // Remove comprehension iterator targets for this file
                        const compTargets = new Set()
                        for (const c of compArray) {
                            if (Number(c.lineno) === ln) {
                                for (const t of (c.targets || [])) compTargets.add(t)
                            }
                        }
                        for (const t of compTargets) if (dataCopy.referenced.has(t)) dataCopy.referenced.delete(t)

                        this.lineReferenceMap.set(key, {
                            assigned: dataCopy.assigned,
                            referenced: dataCopy.referenced,
                            functionCalls: dataCopy.functionCalls,
                            subscripts: dataCopy.subscripts
                        })
                    }

                    appendTerminalDebug('✅ Seeded /main.py AST from trace metadata sourceCode')
                } catch (e) {
                    appendTerminalDebug('Failed to seed /main.py from sourceCode: ' + e)
                }
            }

            // Get all Python files from workspace (these may be from current config,
            // which could differ from the recording if user switched configs)
            const fileManager = getFileManager()
            const allFiles = await fileManager.list()
            const pyFiles = allFiles.filter(f => f.endsWith('.py'))

            appendTerminalDebug(`Building AST line reference map for ${pyFiles.length} Python files...`)

            // Analyze each Python file, BUT skip /main.py if we already seeded it
            // from trace metadata (to avoid overwriting with stale data).
            for (const filepath of pyFiles) {
                // Skip /main.py if we already seeded it from trace metadata
                if (filepath === '/main.py' && sourceCode && typeof sourceCode === 'string') {
                    appendTerminalDebug('  ⏭️  Skipping /main.py analysis (already seeded from trace metadata)')
                    continue
                }
                try {
                    const content = await fileManager.read(filepath)
                    const ast = await analyzer.parse(content)

                    if (!ast) continue

                    // Get per-line analysis for this file
                    const perLine = analyzer.getVariablesAndCallsPerLine(ast)

                    // Also get comprehensions so we can strip iterator targets
                    // from the per-line referenced set (they're internal and
                    // shouldn't be displayed by the UI or used for lookahead).
                    const comps = analyzer.analyzeComprehensions(ast, '*')
                    const compArray = comps?.comprehensions || (Array.isArray(comps) ? comps : [])
                    const compTargetsByLine = new Map()
                    for (const c of compArray) {
                        try {
                            const ln = Number(c.lineno)
                            const targets = new Set(c.targets || [])
                            compTargetsByLine.set(ln, targets)
                        } catch (e) { /* ignore malformed entries */ }
                    }

                    // Store with normalized filename-qualified keys, filtering
                    // out comprehension iterator targets from referenced sets.
                    for (const [lineNum, lineData] of perLine.entries()) {
                        const ln = Number(lineNum)
                        const key = makeLineKey(filepath, ln)

                        // Defensive copy of lineData so we don't mutate analyzer internals
                        const dataCopy = {
                            assigned: new Set(lineData.assigned || []),
                            referenced: new Set(lineData.referenced || []),
                            functionCalls: new Set(lineData.functionCalls || []),
                            subscripts: Array.isArray(lineData.subscripts) ? lineData.subscripts.slice() : []
                        }

                        const compTargets = compTargetsByLine.get(ln) || new Set()
                        if (compTargets.size > 0) {
                            // Remove any comprehension iterator targets from referenced
                            for (const t of compTargets) {
                                if (dataCopy.referenced.has(t)) dataCopy.referenced.delete(t)
                            }
                            appendTerminalDebug(`  🔧 Removed comprehension targets for ${key}: targets={${Array.from(compTargets).join(', ')}}`)
                        }

                        this.lineReferenceMap.set(key, {
                            assigned: dataCopy.assigned,
                            referenced: dataCopy.referenced,
                            functionCalls: dataCopy.functionCalls,
                            subscripts: dataCopy.subscripts
                        })
                    }

                    // Build function maps (merge across files)
                    const fileFunctionLocalMaps = analyzer.buildFunctionLocalMaps(ast)
                    const fileLineFunctionMap = analyzer.buildLineFunctionMap(ast)

                    // Merge functionLocalMaps (plain object)
                    Object.assign(this.functionLocalMaps, fileFunctionLocalMaps)

                    // Merge lineFunctionMap (Map) with filename-qualified keys
                    for (const [lineNum, funcName] of fileLineFunctionMap.entries()) {
                        const key = makeLineKey(filepath, Number(lineNum))
                        this.lineFunctionMap.set(key, funcName)
                    }
                } catch (fileErr) {
                    appendTerminalDebug(`Failed to analyze ${filepath}: ${fileErr}`)
                }
            }

            appendTerminalDebug(`Built AST line reference map: ${this.lineReferenceMap.size} entries across ${pyFiles.length} files`)
        } catch (error) {
            appendTerminalDebug('Error building AST line reference map: ' + error)
            this.lineReferenceMap = null
            this.functionLocalMaps = null
            this.lineFunctionMap = null
        }
    }

    /**
     * Stop replay and clean up
     */
    stopReplay() {
        if (!this.isReplaying) {
            return
        }

        appendTerminalDebug(`🛑 stopReplay() called - originalTrace currently: ${this.originalTrace ? 'exists' : 'null'}`)

        try {
            this.isReplaying = false

            // Clear decorations
            if (this.lineDecorator) {
                this.lineDecorator.clearAllDecorations()
            }

            // Hide replay UI
            this.hideReplayUI()

            // After stopping, if there is still a recorded trace available, mark the
            // start button as needing to be pressed (visual cue). Otherwise ensure
            // any special classes are removed.
            try {
                const replayStartBtn = $('replay-start')
                if (replayStartBtn) {
                    if (this.executionTrace) {
                        replayStartBtn.classList.remove('rewind')
                        replayStartBtn.classList.add('needs-start')
                        replayStartBtn.setAttribute('aria-label', 'Start replay')
                    } else {
                        replayStartBtn.classList.remove('rewind')
                        replayStartBtn.classList.remove('needs-start')
                        replayStartBtn.setAttribute('aria-label', 'No replay available')
                    }
                }
            } catch (e) { /* ignore */ }

            // Disable scrubber when not replaying
            try {
                const scrubber = $('replay-scrubber')
                if (scrubber) scrubber.disabled = true
            } catch (e) { /* ignore */ }

            appendTerminalDebug('Replay stopped')
        } catch (error) {
            appendTerminalDebug('Failed to stop replay: ' + error)
        }
    }

    /**
     * Step forward in replay
     */
    stepForward() {
        if (!this.isReplaying || !this.executionTrace) return false
        if (this.currentStepIndex < this.executionTrace.getStepCount() - 1) {
            this.currentStepIndex++
            this.displayCurrentStep()
            this.updateUI()
            return true
        }
        return false
    }

    /**
     * Step backward in replay
     */
    stepBackward() {
        if (!this.isReplaying || !this.executionTrace) {
            return false
        }

        if (this.currentStepIndex > 0) {
            this.currentStepIndex--
            this.displayCurrentStep()
            this.updateUI()
            return true
        }
        return false
    }

    /**
     * Jump to a specific step
     */
    jumpToStep(stepIndex) {
        if (!this.isReplaying || !this.executionTrace) {
            return false
        }

        const maxIndex = this.executionTrace.getStepCount() - 1
        if (stepIndex >= 0 && stepIndex <= maxIndex) {
            this.currentStepIndex = stepIndex
            this.displayCurrentStep()
            this.updateUI()
            return true
        }
        return false
    }

    /**
     * Jump to step by percentage
     */
    jumpToPercentage(percentage) {
        if (!this.isReplaying || !this.executionTrace) {
            return false
        }

        const totalSteps = this.executionTrace.getStepCount()
        const stepIndex = Math.round((percentage / 100) * (totalSteps - 1))
        return this.jumpToStep(stepIndex)
    }

    /**
     * Translate local_N variables to real names using AST-based function maps
     * @param {Map} variables - Variable map from execution trace
     * @param {number} lineNumber - Current line number
     * @param {string} filename - Current filename for multi-file support
     * @returns {Map} Translated variable map
     */
    translateLocalVariables(variables, lineNumber, filename = null) {
        if (!variables || !this.functionLocalMaps || !this.lineFunctionMap) {
            return variables;
        }

        // Normalize special filenames: <stdin> → /main.py
        let normalizedFilename = filename
        if (filename === '<stdin>') {
            normalizedFilename = '/main.py'
        } else if (filename && !filename.startsWith('/')) {
            // Prepend "/" if missing
            normalizedFilename = `/${filename}`
        }

        // Determine which function this line belongs to (use filename-qualified key)
        const key = makeLineKey(filename, lineNumber)
        const functionName = this.lineFunctionMap.get(key);
        if (!functionName) {
            // Module level - no translation needed
            return variables;
        }

        // Get the local variable map for this function
        const localVarNames = this.functionLocalMaps[functionName];
        if (!localVarNames || localVarNames.length === 0) {
            return variables;
        }

        // Translate local_N to real names, filtering out unmapped locals (stack temporaries)
        const translated = new Map();
        for (const [key, value] of variables) {
            if (key.startsWith('local_')) {
                const index = parseInt(key.substring(6));
                const realName = localVarNames[index];
                if (realName) {
                    translated.set(realName, value);
                }
                // else: Skip unmapped local_N (stack temporary) - don't include it
            } else {
                // Not a local_N variable - keep as is
                translated.set(key, value);
            }
        }

        return translated;
    }

    /**
     * Display the current step
     */
    displayCurrentStep() {
        appendTerminalDebug(`📺 displayCurrentStep() START - originalTrace: ${this.originalTrace ? `${this.originalTrace.getStepCount()} steps` : 'NULL!'}`)
        if (!this.isReplaying || !this.executionTrace || !this.lineDecorator) {
            return
        }

        try {
            const step = this.executionTrace.getStep(this.currentStepIndex)
            if (!step) {
                return
            }

            appendTerminalDebug(`Displaying step ${this.currentStepIndex}: line ${step.lineNumber} in ${step.filename || '/main.py'}`)

            // Ensure we're viewing the correct Python code file for this step.
            // This prevents highlighting lines in non-code files like .txt data files.
            if (step.filename) {
                appendTerminalDebug(`📁 About to ensureCorrectFileIsActive - originalTrace: ${this.originalTrace ? `${this.originalTrace.getStepCount()} steps` : 'NULL!'}`)
                this.ensureCorrectFileIsActive(step.filename)
                appendTerminalDebug(`📁 After ensureCorrectFileIsActive - originalTrace: ${this.originalTrace ? `${this.originalTrace.getStepCount()} steps` : 'NULL!'}`)
            }

            // Clear previous decorations
            this.lineDecorator.clearAllDecorations()

            // Highlight execution line
            this.lineDecorator.highlightExecutionLine(step.lineNumber)

            // Translate local_N variables to real names
            const translatedVariables = this.translateLocalVariables(step.variables, step.lineNumber, step.filename)

            // Show variables if available
            if (translatedVariables && translatedVariables.size > 0) {
                this.lineDecorator.showVariablesAtLine(step.lineNumber, translatedVariables, this.executionTrace, this.currentStepIndex, this.originalTrace, step.filename)
            }
        } catch (error) {
            appendTerminalDebug('Failed to display current step: ' + error)
        }
    }

    /**
     * Ensure the correct Python code file is active for replay. This prevents
     * highlighting lines in non-code files (like .txt data files).
     */
    ensureCorrectFileIsActive(targetFilename) {
        try {
            // Get the currently active file from TabManager
            const currentActiveFile = window.TabManager && typeof window.TabManager.getActive === 'function'
                ? window.TabManager.getActive()
                : null

            // Normalize target filename
            const normalizedTarget = targetFilename.startsWith('/') ? targetFilename : `/${targetFilename}`

            // Check if target is a Python code file (not a data file)
            const isTargetPythonFile = normalizedTarget.endsWith('.py')

            if (!isTargetPythonFile) {
                // appendTerminalDebug(`Target file ${normalizedTarget} is not a Python file, defaulting to /main.py`)
                this.switchToFile('/main.py')
                return
            }

            // If current file is not a Python code file, or it's a different file than the target, switch
            const isCurrentPythonFile = currentActiveFile && currentActiveFile.endsWith('.py')

            if (!isCurrentPythonFile || currentActiveFile !== normalizedTarget) {
                // appendTerminalDebug(`Switching from ${currentActiveFile || 'unknown'} to ${normalizedTarget} for replay`)
                this.switchToFile(normalizedTarget)
            } else {
                // Already on the correct file, just update our tracker
                this.currentFilename = normalizedTarget
            }
        } catch (error) {
            appendTerminalDebug('Failed to ensure correct file is active: ' + error)
            // Fall back to main.py on error
            try {
                this.switchToFile('/main.py')
            } catch (e) { /* ignore */ }
        }
    }

    /**
     * Switch to a different file tab
     */
    switchToFile(filename) {
        try {
            // Normalize the filename
            const normalizedFilename = filename.startsWith('/') ? filename : `/${filename}`

            // Try to switch to the tab using the TabManager
            if (window.TabManager && typeof window.TabManager.selectTab === 'function') {
                // Persist current editor content to FileManager before switching
                // so that any unsaved user edits are not lost when replay switches tabs.
                try {
                    const FileManager = (window && window.FileManager) || (window && window.getFileManager && window.getFileManager && window.getFileManager()) || null
                    // Prefer the public API if available
                    const cm = window.cm
                    const textarea = document.getElementById && document.getElementById('code')
                    const activePath = (window.TabManager && typeof window.TabManager.getActive === 'function') ? window.TabManager.getActive() : null
                    if (FileManager && activePath) {
                        try {
                            const cur = (cm ? cm.getValue() : (textarea ? textarea.value : null))
                            if (typeof FileManager.write === 'function' && cur !== null) {
                                // Use system write mode wherever callers expect it to bypass read-only checks
                                try { if (typeof window.setSystemWriteMode === 'function') window.setSystemWriteMode(true) } catch (_e) { }
                                try { FileManager.write(activePath, cur) } catch (_e) { }
                                try { if (typeof window.setSystemWriteMode === 'function') window.setSystemWriteMode(false) } catch (_e) { }
                            }
                        } catch (_e) { /* swallow persistence errors */ }
                    }
                } catch (_e) { }

                appendTerminalDebug(`Switching to file: ${normalizedFilename}`)
                window.TabManager.selectTab(normalizedFilename)
                this.currentFilename = normalizedFilename
            } else {
                appendTerminalDebug('TabManager not available for file switching')
            }
        } catch (error) {
            appendTerminalDebug('Failed to switch to file: ' + error)
        }
    }

    /**
     * Show replay UI controls
     */
    showReplayUI() {
        const replayControls = $('replay-controls')
        if (replayControls) {
            replayControls.style.display = 'flex'
        }

        // Add replay mode class to editor
        if (window.cm) {
            window.cm.getWrapperElement().classList.add('replay-mode')
        }

        // Hide the inline start button and show the rewind button inside controls
        try {
            const inlineStart = $('replay-start-inline')
            if (inlineStart) {
                inlineStart.style.display = 'none'
                inlineStart.classList.remove('needs-start')
            }

            const rewindBtn = $('replay-rewind')
            if (rewindBtn) {
                rewindBtn.style.display = 'inline-flex'
                rewindBtn.disabled = false
                rewindBtn.setAttribute('aria-label', 'Rewind replay')
            }
        } catch (e) { /* ignore */ }

        this.updateUI()
    }

    /**
     * Hide replay UI controls
     */
    hideReplayUI() {
        const replayControls = $('replay-controls')
        if (replayControls) {
            replayControls.style.display = 'none'
        }

        // Remove replay mode class from editor
        if (window.cm) {
            window.cm.getWrapperElement().classList.remove('replay-mode')
        }

        // Clean up any start/rewind button visual state: hide rewind, clear inline state
        try {
            const rewindBtn = $('replay-rewind')
            if (rewindBtn) {
                rewindBtn.style.display = 'none'
                rewindBtn.classList.remove('rewind')
            }

            const inlineStart = $('replay-start-inline')
            if (inlineStart) {
                inlineStart.classList.remove('rewind')
                inlineStart.classList.remove('needs-start')
            }
        } catch (e) { /* ignore */ }
    }

    /**
     * Update UI controls state
     */
    updateUI() {
        // If not replaying, we don't update the per-step UI here; callers
        // should use updateReplayControls(hasRecording) to set the initial
        // disabled state. When replaying, update the buttons and scrubber.
        if (!this.isReplaying || !this.executionTrace) {
            return
        }

        try {
            const stepBackBtn = $('replay-step-back')
            const stepForwardBtn = $('replay-step-forward')
            const scrubber = $('replay-scrubber')

            if (stepBackBtn) {
                stepBackBtn.disabled = this.currentStepIndex <= 0
            }

            if (stepForwardBtn) {
                stepForwardBtn.disabled = this.currentStepIndex >= this.executionTrace.getStepCount() - 1
            }

            if (scrubber) {
                const percentage = this.executionTrace.getStepCount() > 1
                    ? (this.currentStepIndex / (this.executionTrace.getStepCount() - 1)) * 100
                    : 0
                scrubber.value = percentage
                scrubber.disabled = false
            }
        } catch (error) {
            appendTerminalDebug('Failed to update UI: ' + error)
        }
    }
    /**
     * Get current replay status
     */
    getStatus() {
        return {
            isReplaying: this.isReplaying,
            currentStep: this.currentStepIndex,
            totalSteps: this.executionTrace ? this.executionTrace.getStepCount() : 0,
            hasTrace: this.executionTrace !== null
        }
    }
}

/**
 * Replay UI controller
 */
export class ReplayUI {
    constructor(replayEngine) {
        this.replayEngine = replayEngine
        this.setupEventListeners()
    }

    /**
     * Setup event listeners for replay controls
     */
    setupEventListeners() {
        // Inline start button (shown next to Run when a recording exists)
        const inlineStart = $('replay-start-inline')
        if (inlineStart) {
            inlineStart.addEventListener('click', () => {
                if (!window.ExecutionRecorder?.hasActiveRecording()) {
                    appendTerminalDebug('No execution recording available for replay')
                    return
                }

                const trace = window.ExecutionRecorder.getTrace()
                // Start the replay and show controls (showReplayUI handles hiding inline)
                this.replayEngine.startReplay(trace)
            })
        }

        // Rewind button inside controls (visible when replaying)
        const rewindBtn = $('replay-rewind')
        if (rewindBtn) {
            rewindBtn.addEventListener('click', () => {
                // Rewind to start step
                this.replayEngine.jumpToStep(0)
            })
        }

        // Step backward button
        const stepBackBtn = $('replay-step-back')
        if (stepBackBtn) {
            stepBackBtn.addEventListener('click', () => {
                this.replayEngine.stepBackward()
            })
        }

        // Step forward button
        const stepForwardBtn = $('replay-step-forward')
        if (stepForwardBtn) {
            stepForwardBtn.addEventListener('click', () => {
                this.replayEngine.stepForward()
            })
        }

        // Scrubber/slider
        const scrubber = $('replay-scrubber')
        if (scrubber) {
            scrubber.addEventListener('input', (e) => {
                const percentage = parseFloat(e.target.value)
                this.replayEngine.jumpToPercentage(percentage)
            })
        }

        // Exit replay button
        const exitBtn = $('replay-exit')
        if (exitBtn) {
            exitBtn.addEventListener('click', () => {
                this.replayEngine.stopReplay()
            })
        }

        // Keyboard shortcuts
        this.setupKeyboardShortcuts()
    }

    /**
     * Setup keyboard shortcuts for replay
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when replaying
            if (!this.replayEngine.isReplaying) {
                return
            }

            switch (e.key) {
                case 'ArrowLeft':
                case 'ArrowUp':
                    e.preventDefault()
                    this.replayEngine.stepBackward()
                    break
                case 'ArrowRight':
                case 'ArrowDown':
                    e.preventDefault()
                    this.replayEngine.stepForward()
                    break
                case 'Escape':
                    e.preventDefault()
                    this.replayEngine.stopReplay()
                    break
                case ' ': // Spacebar
                    e.preventDefault()
                    // Toggle between forward and backward (just step forward for now)
                    this.replayEngine.stepForward()
                    break
            }
        })
    }

    /**
     * Update replay controls visibility
     */
    updateReplayControls(hasRecording) {
        const replayControls = $('replay-controls')
        const inlineStart = $('replay-start-inline')
        const rewindBtn = $('replay-rewind')

        const stepBackBtn = $('replay-step-back')
        const stepForwardBtn = $('replay-step-forward')
        const scrubber = $('replay-scrubber')

        if (replayControls && inlineStart && rewindBtn) {
            if (hasRecording) {
                // Show the inline start button next to Run when not replaying
                if (!this.replayEngine.isReplaying) {
                    replayControls.style.display = 'none'
                    inlineStart.style.display = 'inline-flex'
                    inlineStart.classList.add('needs-start')
                    inlineStart.setAttribute('aria-label', 'Start replay')

                    if (stepBackBtn) stepBackBtn.disabled = true
                    if (stepForwardBtn) stepForwardBtn.disabled = true
                    if (scrubber) scrubber.disabled = true
                } else {
                    // When replaying, show controls (and the rewind button inside them)
                    replayControls.style.display = 'flex'
                    inlineStart.style.display = 'none'

                    if (stepBackBtn) stepBackBtn.disabled = this.replayEngine.currentStepIndex <= 0
                    if (stepForwardBtn) stepForwardBtn.disabled = this.replayEngine.currentStepIndex >= this.replayEngine.executionTrace.getStepCount() - 1
                    if (scrubber) scrubber.disabled = false

                    rewindBtn.style.display = 'inline-flex'
                    rewindBtn.setAttribute('aria-label', 'Rewind replay')
                }
            } else {
                // No recording: hide both inline and controls
                replayControls.style.display = 'none'
                inlineStart.style.display = 'none'
                rewindBtn.style.display = 'none'
            }
        }
    }
}

// Global instance
let globalReplayEngine = null
let globalReplayUI = null

/**
 * Get the global replay engine instance
 */
export function getReplayEngine() {
    if (!globalReplayEngine) {
        globalReplayEngine = new ReplayEngine()
    }
    return globalReplayEngine
}

/**
 * Get the global replay UI instance
 */
export function getReplayUI() {
    if (!globalReplayUI) {
        const engine = getReplayEngine()
        globalReplayUI = new ReplayUI(engine)
    }
    return globalReplayUI
}

/**
 * Initialize the replay system
 */
export function initializeReplaySystem() {
    const engine = getReplayEngine()
    const ui = getReplayUI()

    // Expose globally for integration
    window.ReplayEngine = engine
    window.ReplayUI = ui

    appendTerminalDebug('Replay system initialized')
    return { engine, ui }
}