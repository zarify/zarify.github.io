/**
 * AST Analyzer Module for Clipy Educational Feedback
 * 
 * Provides Python AST analysis capabilities for educational feedback
 * and code quality assessment using py-ast library.
 */

// Import py-ast library from vendor directory
let pyAst = null;

// Initialize py-ast library (async loading)
async function initializePyAst() {
    if (!pyAst) {
        try {
            pyAst = await import('../vendor/py-ast/index.esm.js');
        } catch (error) {
            import('./logger.js').then(m => m.error('Failed to load py-ast library:', error)).catch(() => console.error('Failed to load py-ast library:', error))
            throw new Error('AST analysis unavailable: ' + error.message);
        }
    }
    return pyAst;
}

/**
 * Main AST Analyzer class
 * Provides caching, parsing, and educational analysis capabilities
 */
export class ASTAnalyzer {
    constructor() {
        this.cache = new Map(); // Cache for parsed AST results
        this.initialized = false;
    }

    /**
     * Initialize the analyzer (load py-ast library)
     */
    async initialize() {
        if (!this.initialized) {
            await initializePyAst();
            this.initialized = true;
        }
        return this;
    }

    /**
     * Generate a simple hash for caching
     */
    hashCode(str) {
        let hash = 0;
        if (str.length === 0) return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    /**
     * Parse Python code to AST with caching
     * @param {string} code - Python source code
     * @returns {Object|null} - Parsed AST or null if parsing failed
     */
    async parse(code) {
        if (!this.initialized) {
            await this.initialize();
        }

        const cacheKey = this.hashCode(code);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const ast = pyAst.parse(code);

            // Limit cache size to prevent memory issues
            if (this.cache.size > 100) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }

            this.cache.set(cacheKey, ast);
            return ast;
        } catch (error) {
            import('./logger.js').then(m => m.warn('AST parsing failed:', error.message)).catch(() => console.warn('AST parsing failed:', error.message))
            this.cache.set(cacheKey, null); // Cache failures too
            return null;
        }
    }

    /**
     * Analyze AST based on query expression
     * @param {Object} ast - Parsed AST
     * @param {string} expression - Analysis query expression
     * @returns {Object|null} - Analysis result or null
     */
    analyze(ast, expression) {
        if (!ast || !expression) return null;

        try {
            // Parse expression format: "analysisType:target" or just "analysisType"
            const [analysisType, target] = expression.split(':');

            switch (analysisType) {
                case 'function_exists':
                    return this.checkFunctionExists(ast, target);

                case 'variable_usage':
                    return this.analyzeVariables(ast, target);

                case 'control_flow':
                    return this.analyzeControlFlow(ast, target);

                case 'code_quality':
                    return this.analyzeCodeQuality(ast, target);

                case 'function_count':
                    return this.countFunctions(ast);

                case 'has_docstring':
                    return this.checkDocstrings(ast);

                case 'custom':
                    return this.customQuery(ast, target);

                default:
                    // Generic AST query
                    return this.genericQuery(ast, expression);
            }
        } catch (error) {
            import('./logger.js').then(m => m.warn('AST analysis error:', error)).catch(() => console.warn('AST analysis error:', error))
            return null;
        }
    }

    /**
     * Check if a specific function exists
     */
    checkFunctionExists(ast, functionName) {
        let found = false;
        let foundFunction = null;

        // Manual traversal through AST body
        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(node => {
                if (node.nodeType === 'FunctionDef') {
                    if (functionName === '*' || node.name === functionName) {
                        found = true;
                        foundFunction = {
                            name: node.name,
                            parameters: node.args.args.map(arg => arg.arg),
                            defaults: node.args.defaults.length,
                            lineno: node.lineno,
                            docstring: this.getDocstring(node)
                        };

                        // If looking for specific function, we can stop
                        if (functionName !== '*') {
                            return;
                        }
                    }
                }
            });
        }

        return found ? foundFunction : null;
    }

    /**
     * Analyze variable usage patterns
     */
    analyzeVariables(ast, variableName) {
        const analysis = {
            assigned: false,
            used: false,
            modified: false,
            assignments: [],
            usages: []
        };

        // Manual traversal
        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'Assign') {
                node.targets.forEach(target => {
                    if (target.nodeType === 'Name' &&
                        (variableName === '*' || target.id === variableName)) {
                        analysis.assigned = true;
                        analysis.assignments.push({
                            name: target.id,
                            lineno: node.lineno
                        });
                    }
                });
            }

            if (node.nodeType === 'Name') {
                if (node.ctx?.nodeType === 'Load' &&
                    (variableName === '*' || node.id === variableName)) {
                    analysis.used = true;
                    analysis.usages.push({
                        name: node.id,
                        lineno: node.lineno
                    });
                }
            }

            if (node.nodeType === 'Call') {
                // Check for method calls that modify variables (e.g., list.append)
                if (node.func?.nodeType === 'Attribute' &&
                    node.func.value?.nodeType === 'Name' &&
                    (variableName === '*' || node.func.value.id === variableName)) {
                    analysis.modified = true;
                }
            }

            // Recursively traverse child nodes
            if (node.body && Array.isArray(node.body)) {
                node.body.forEach(traverse);
            }
            if (node.orelse && Array.isArray(node.orelse)) {
                node.orelse.forEach(traverse);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        return (analysis.assigned || analysis.used) ? analysis : null;
    }

    /**
     * Analyze control flow structures
     */
    analyzeControlFlow(ast, flowType) {
        const flows = {
            if_statement: 0,
            for_loop: 0,
            while_loop: 0,
            try_except: 0,
            with_statement: 0
        };

        const details = [];

        // Manual traversal
        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'If') {
                flows.if_statement++;
                details.push({ type: 'if', lineno: node.lineno });
            }
            if (node.nodeType === 'For') {
                flows.for_loop++;
                details.push({ type: 'for', lineno: node.lineno });
            }
            if (node.nodeType === 'While') {
                flows.while_loop++;
                details.push({ type: 'while', lineno: node.lineno });
            }
            if (node.nodeType === 'Try') {
                flows.try_except++;
                details.push({ type: 'try', lineno: node.lineno });
            }
            if (node.nodeType === 'With') {
                flows.with_statement++;
                details.push({ type: 'with', lineno: node.lineno });
            }

            // Recursively traverse child nodes
            if (node.body && Array.isArray(node.body)) {
                node.body.forEach(traverse);
            }
            if (node.orelse && Array.isArray(node.orelse)) {
                node.orelse.forEach(traverse);
            }
            if (node.finalbody && Array.isArray(node.finalbody)) {
                node.finalbody.forEach(traverse);
            }
            if (node.handlers && Array.isArray(node.handlers)) {
                node.handlers.forEach(traverse);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        if (flowType && flowType !== '*') {
            return flows[flowType] > 0 ? {
                type: flowType,
                count: flows[flowType],
                details: details.filter(d => d.type === flowType.replace('_statement', '').replace('_loop', ''))
            } : null;
        }

        // Return all flow analysis
        return Object.values(flows).some(count => count > 0) ? { flows, details } : null;
    }

    /**
     * Count total functions in code
     */
    countFunctions(ast) {
        let count = 0;
        const functions = [];

        // Manual traversal
        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'FunctionDef') {
                count++;
                functions.push({
                    name: node.name,
                    lineno: node.lineno,
                    parameters: node.args.args.length
                });
            }

            // Recursively traverse child nodes
            if (node.body && Array.isArray(node.body)) {
                node.body.forEach(traverse);
            }
            if (node.orelse && Array.isArray(node.orelse)) {
                node.orelse.forEach(traverse);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        return count > 0 ? { count, functions } : null;
    }

    /**
     * Check for docstrings in functions and classes
     */
    checkDocstrings(ast) {
        const analysis = {
            functions: { total: 0, withDocstring: 0 },
            classes: { total: 0, withDocstring: 0 },
            details: []
        };

        // Manual traversal
        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'FunctionDef') {
                analysis.functions.total++;
                const docstring = this.getDocstring(node);
                if (docstring) {
                    analysis.functions.withDocstring++;
                }
                analysis.details.push({
                    type: 'function',
                    name: node.name,
                    lineno: node.lineno,
                    hasDocstring: !!docstring,
                    docstring: docstring
                });
            }

            if (node.nodeType === 'ClassDef') {
                analysis.classes.total++;
                const docstring = this.getDocstring(node);
                if (docstring) {
                    analysis.classes.withDocstring++;
                }
                analysis.details.push({
                    type: 'class',
                    name: node.name,
                    lineno: node.lineno,
                    hasDocstring: !!docstring,
                    docstring: docstring
                });
            }

            // Recursively traverse child nodes
            if (node.body && Array.isArray(node.body)) {
                node.body.forEach(traverse);
            }
            if (node.orelse && Array.isArray(node.orelse)) {
                node.orelse.forEach(traverse);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        const hasAnyDocstring = analysis.functions.withDocstring > 0 || analysis.classes.withDocstring > 0;
        return hasAnyDocstring ? analysis : null;
    }

    /**
     * Get docstring from a function or class node
     */
    getDocstring(node) {
        if (node.body && node.body.length > 0) {
            const firstStmt = node.body[0];
            if (firstStmt.nodeType === 'Expr' &&
                firstStmt.value &&
                firstStmt.value.nodeType === 'Constant' &&
                typeof firstStmt.value.value === 'string') {
                return firstStmt.value.value;
            }
        }
        return null;
    }

    /**
     * Analyze code quality aspects
     */
    analyzeCodeQuality(ast, qualityCheck) {
        switch (qualityCheck) {
            case 'has_docstring':
                return this.checkDocstrings(ast);
            case 'no_hardcoded_values':
                return this.checkHardcodedValues(ast);
            case 'proper_naming':
                return this.checkNamingConventions(ast);
            case 'complexity':
                return this.calculateComplexity(ast);
            default:
                return this.generalQualityCheck(ast);
        }
    }

    /**
     * Generic AST query for basic node type searches
     */
    genericQuery(ast, expression) {
        const results = [];
        const nodeType = expression;

        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === nodeType) {
                results.push({
                    type: nodeType,
                    lineno: node.lineno,
                    details: this.extractNodeDetails(node)
                });
            }

            // Recursively traverse child nodes
            if (node.body && Array.isArray(node.body)) {
                node.body.forEach(traverse);
            }
            if (node.orelse && Array.isArray(node.orelse)) {
                node.orelse.forEach(traverse);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        return results.length > 0 ? { type: nodeType, count: results.length, results } : null;
    }

    /**
     * Extract relevant details from an AST node
     */
    extractNodeDetails(node) {
        const details = { nodeType: node.nodeType };

        if (node.name) details.name = node.name;
        if (node.id) details.id = node.id;
        if (node.lineno) details.lineno = node.lineno;
        if (node.col_offset !== undefined) details.col_offset = node.col_offset;

        return details;
    }

    /**
     * Custom advanced query (placeholder for future expansion)
     */
    customQuery(ast, queryExpression) {
        import('./logger.js').then(m => m.warn('Custom queries not yet implemented:', queryExpression)).catch(() => console.warn('Custom queries not yet implemented:', queryExpression))
        return null;
    }

    /**
     * Check for hardcoded values (numbers, strings) that might be better as constants
     */
    checkHardcodedValues(ast) {
        const hardcodedValues = [];

        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'Constant') {
                const value = node.value;
                if (typeof value === 'number' && ![0, 1, -1, 2, 10, 100].includes(value)) {
                    hardcodedValues.push({
                        value: value,
                        type: 'number',
                        lineno: node.lineno
                    });
                } else if (typeof value === 'string' && value.length > 10) {
                    hardcodedValues.push({
                        value: value.substring(0, 50) + (value.length > 50 ? '...' : ''),
                        type: 'string',
                        lineno: node.lineno
                    });
                }
            }

            // Recursively traverse child nodes
            if (node.body && Array.isArray(node.body)) {
                node.body.forEach(traverse);
            }
            if (node.orelse && Array.isArray(node.orelse)) {
                node.orelse.forEach(traverse);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        return hardcodedValues.length > 0 ? { hardcodedValues } : null;
    }

    /**
     * Basic complexity calculation (simplified cyclomatic complexity)
     */
    calculateComplexity(ast) {
        let complexity = 1; // Base complexity

        const traverse = (node) => {
            if (!node) return;

            if (['If', 'For', 'While', 'Try'].includes(node.nodeType)) {
                complexity++;
            }
            if (node.nodeType === 'ExceptHandler') {
                complexity++;
            }

            // Recursively traverse child nodes
            if (node.body && Array.isArray(node.body)) {
                node.body.forEach(traverse);
            }
            if (node.orelse && Array.isArray(node.orelse)) {
                node.orelse.forEach(traverse);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        return { complexity };
    }

    /**
     * General code quality assessment
     */
    generalQualityCheck(ast) {
        return {
            functions: this.countFunctions(ast),
            docstrings: this.checkDocstrings(ast),
            complexity: this.calculateComplexity(ast),
            controlFlow: this.analyzeControlFlow(ast, '*')
        };
    }
}

/**
 * Global AST analyzer instance for shared use
 */
let globalAnalyzer = null;

/**
 * Get or create global AST analyzer instance
 */
export async function getASTAnalyzer() {
    if (!globalAnalyzer) {
        globalAnalyzer = new ASTAnalyzer();
        await globalAnalyzer.initialize();
    }
    return globalAnalyzer;
}

/**
 * Convenience function for quick AST analysis
 * @param {string} code - Python source code
 * @param {string} expression - Analysis query expression
 * @returns {Promise<Object|null>} - Analysis result
 */
export async function analyzeCode(code, expression) {
    try {
        const analyzer = await getASTAnalyzer();
        const ast = await analyzer.parse(code);
        if (!ast) return null;
        return analyzer.analyze(ast, expression);
    } catch (error) {
        import('./logger.js').then(m => m.error('AST analysis failed:', error)).catch(() => console.error('AST analysis failed:', error))
        return null;
    }
}

// Export for browser global access if needed
if (typeof window !== 'undefined') {
    window.ASTAnalyzer = ASTAnalyzer;
    window.analyzeCode = analyzeCode;
}
