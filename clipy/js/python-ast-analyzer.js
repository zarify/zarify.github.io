// JavaScript-based Python AST analysis for execution tracing using existing py-ast library
import { appendTerminalDebug } from './terminal.js'
import { ASTAnalyzer } from './ast-analyzer.js'

/**
 * Efficient Python AST analyzer using the existing JavaScript py-ast library
 */
export class PythonASTAnalyzer {
    constructor() {
        this.lineVariableMap = new Map() // line -> {defined: Set, used: Set}
        this.astAnalyzer = new ASTAnalyzer()
        this.sourceCode = ''
    }

    /**
     * Analyze source code using the existing JavaScript AST analyzer
     */
    async analyzeSource(sourceCode, runtimeAdapter) {
        try {
            appendTerminalDebug('Starting JavaScript AST analysis of Python source')

            this.lineVariableMap.clear()
            this.sourceCode = sourceCode

            if (!sourceCode.trim()) {
                appendTerminalDebug('Empty source code')
                return false
            }

            // Initialize and parse with existing AST analyzer
            await this.astAnalyzer.initialize()
            const ast = await this.astAnalyzer.parse(sourceCode)

            if (!ast) {
                appendTerminalDebug('Failed to parse AST')
                return false
            }

            // Analyze all variables to get line-by-line information
            const allVariableAnalysis = this.astAnalyzer.analyzeVariables(ast, '*')

            if (!allVariableAnalysis || !Array.isArray(allVariableAnalysis)) {
                appendTerminalDebug('No variable analysis results')
                return false
            }

            // Build line-by-line mapping
            for (const varInfo of allVariableAnalysis) {
                if (!varInfo.name) continue

                // Process assignments (where variable is defined)
                if (varInfo.assignments && Array.isArray(varInfo.assignments)) {
                    for (const assignment of varInfo.assignments) {
                        if (assignment.lineno) {
                            this.ensureLineEntry(assignment.lineno)
                            this.lineVariableMap.get(assignment.lineno).defined.add(varInfo.name)
                        }
                    }
                }

                // Process usages (where variable is read)
                if (varInfo.usages && Array.isArray(varInfo.usages)) {
                    for (const usage of varInfo.usages) {
                        if (usage.lineno) {
                            this.ensureLineEntry(usage.lineno)
                            this.lineVariableMap.get(usage.lineno).used.add(varInfo.name)
                        }
                    }
                }
            }

            appendTerminalDebug(`JavaScript AST analysis completed for ${this.lineVariableMap.size} lines`)

            // Debug: show line mappings
            for (const [lineNum, info] of this.lineVariableMap) {
                const defined = Array.from(info.defined)
                const used = Array.from(info.used)
                if (defined.length > 0 || used.length > 0) {
                    appendTerminalDebug(`Line ${lineNum}: defined=[${defined.join(', ')}], used=[${used.join(', ')}]`)
                }
            }

            return true

        } catch (error) {
            appendTerminalDebug('Failed to analyze Python AST: ' + error)
            return false
        }
    }

    /**
     * Ensure a line entry exists in the map
     */
    ensureLineEntry(lineNumber) {
        if (!this.lineVariableMap.has(lineNumber)) {
            this.lineVariableMap.set(lineNumber, {
                defined: new Set(),
                used: new Set()
            })
        }
    }

    /**
     * Get relevant variables for a specific line (defined or used on that line)
     */
    getRelevantVariables(lineNumber, allVariables) {
        const relevantVars = new Map()
        const lineInfo = this.lineVariableMap.get(lineNumber)

        if (!lineInfo || !allVariables) {
            // Fallback: show all user variables if AST analysis not available
            const filtered = new Map()
            for (const [name, value] of allVariables) {
                // Filter out obvious system variables only
                if (!name.startsWith('_') &&
                    !['sys', 'gc', 'json', 'ast'].includes(name)) {
                    filtered.set(name, value)
                }
            }
            appendTerminalDebug(`Line ${lineNumber}: AST not available, showing ${filtered.size}/${allVariables.size} filtered variables`)
            return filtered
        }

        // Include variables that are defined or used on this line
        const relevantNames = new Set([...lineInfo.defined, ...lineInfo.used])

        for (const [name, value] of allVariables) {
            if (relevantNames.has(name)) {
                relevantVars.set(name, value)
            }
        }

        appendTerminalDebug(`Line ${lineNumber}: showing ${relevantVars.size}/${allVariables.size} relevant variables: ${Array.from(relevantNames).join(', ')}`)

        return relevantVars
    }

    /**
     * Get debug information about line analysis
     */
    getLineInfo(lineNumber) {
        return this.lineVariableMap.get(lineNumber) || { defined: new Set(), used: new Set() }
    }

    /**
     * Clear analysis cache
     */
    clear() {
        this.lineVariableMap.clear()
        this.sourceCode = ''
    }
}

// Global instance
let globalAnalyzer = null

/**
 * Get the global Python AST analyzer
 */
export function getPythonASTAnalyzer() {
    if (!globalAnalyzer) {
        globalAnalyzer = new PythonASTAnalyzer()
    }
    return globalAnalyzer
}