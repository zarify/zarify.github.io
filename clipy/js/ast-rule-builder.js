/**
 * AST Rule Builder Module
 *
 * Provides reusable AST rule building functionality for both feedback and tests.
 * This module creates standardized AST rule configurations that can be used
 * in both feedback (edit-time) and testing (run-time) contexts.
 */
import { sanitizeHtml, setInnerHTML } from './utils.js'

/**
 * Create AST rule builder UI
 * @param {Object} existing - Existing rule configuration
 * @param {string} ruleType - Either 'feedback' o            try {
                // Force a refresh after a short delay to ensure gutters render properly
                setTimeout(() => {
                    if (codeMirrorEditor && typeof codeMirrorEditor.refresh === 'function') {
                        console.log('AST rule builder: Refreshing CodeMirror editor')
                        console.log('Gutters:', codeMirrorEditor.getOption('gutters'))
                        console.log('Fixed gutter:', codeMirrorEditor.getOption('fixedGutter'))
                        console.log('Line numbers:', codeMirrorEditor.getOption('lineNumbers'))
                        codeMirrorEditor.refresh()
                        
                        // Double-check gutter elements exist
                        const gutterEl = codeMirrorEditor.getGutterElement()
                        console.log('Gutter element:', gutterEl)
                        if (gutterEl) {
                            console.log('Gutter width:', gutterEl.offsetWidth)
                            console.log('Gutter visible:', gutterEl.offsetParent !== null)
                        }
                    }
                }, 50)
            } catch (_e) { 
                console.error('Error during AST rule builder refresh:', _e)
            }t'
 * @returns {Object} Builder object with root element and get() function
 */
export function createASTRuleBuilder(existing = {}, ruleType = 'feedback') {
    const root = document.createElement('div')
    root.className = 'ast-rule-builder'
    // ...existing code... (do not add 'author-tab' here to avoid hiding the builder)
    root.style.border = '1px solid #e0e0e0'
    root.style.borderRadius = '4px'
    root.style.padding = '16px'
    root.style.background = '#f8f9fa'
    root.style.boxSizing = 'border-box'

    // Helper function for labeled form elements with optional help text
    function labeled(labelText, el, helpText, inline = false) {
        const wr = document.createElement('div')
        wr.style.marginBottom = '12px'
        wr.style.boxSizing = 'border-box'
        if (inline) {
            wr.style.display = 'flex'
            wr.style.alignItems = 'center'
            wr.style.gap = '12px'
        }
        const l = document.createElement('div')
        l.style.fontSize = '0.9em'
        l.style.marginBottom = inline ? '0' : '6px'
        l.style.display = 'flex'
        l.style.alignItems = 'center'
        l.style.gap = '8px'
        l.style.fontWeight = '500'
        const txt = document.createElement('span')
        txt.textContent = labelText
        l.appendChild(txt)
        if (helpText) {
            const info = document.createElement('span')
            info.className = 'info-icon'
            info.setAttribute('tabindex', '0')
            info.setAttribute('role', 'img')
            info.setAttribute('aria-label', labelText + ' help')
            // Build info symbol using safe DOM APIs (avoid innerHTML)
            const infoSymbol = document.createElement('span')
            infoSymbol.className = 'info-symbol'
            infoSymbol.textContent = 'ℹ'
            info.appendChild(infoSymbol)
            const tip = document.createElement('span')
            tip.className = 'info-tooltip'
            tip.textContent = helpText
            info.appendChild(tip)
            l.appendChild(info)
        }
        wr.appendChild(l)
        wr.appendChild(el)
        return wr
    }

    // AST analysis type selection
    const astTypeSelect = document.createElement('select')
    const astTypes = [
        { value: 'function_calls', label: 'Function calls', help: 'Analyze function call sites and counts (includes builtins like print)' },
        { value: 'function_exists', label: 'Function exists', help: 'Check if a specific function is defined' },
        { value: 'function_count', label: 'Function count', help: 'Count total number of functions' },
        { value: 'variable_usage', label: 'Variable usage', help: 'Check if a variable is used or assigned. Also captures type annotations when present.' },
        { value: 'control_flow', label: 'Control flow', help: 'Check for loops, if statements, etc.' },
        { value: 'has_docstring', label: 'Has docstrings', help: 'Check if functions have docstrings' },
        { value: 'code_quality', label: 'Code quality', help: 'Advanced code quality checks' },
        { value: 'class_analysis', label: 'Class analysis', help: 'Analyze classes, methods, and inheritance' },
        { value: 'import_statements', label: 'Import statements', help: 'Check for specific imports or import patterns' },
        { value: 'magic_numbers', label: 'Magic numbers', help: 'Detect hardcoded numbers that should be constants' },
        { value: 'exception_handling', label: 'Exception handling', help: 'Analyze try/except blocks and error handling' },
        { value: 'comprehensions', label: 'Comprehensions', help: 'Inspect list/dict/set/generator comprehensions and their targets/ifs' }
    ]

    astTypes.forEach(type => {
        const option = document.createElement('option')
        option.value = type.value
        option.textContent = type.label
        option.setAttribute('data-help', type.help)
        astTypeSelect.appendChild(option)
    })
    astTypeSelect.style.width = '100%'
    astTypeSelect.style.maxWidth = '300px'

    // Target input (optional)
    const astTarget = document.createElement('input')
    astTarget.type = 'text'
    astTarget.style.width = '100%'
    astTarget.style.maxWidth = '300px'
    astTarget.style.boxSizing = 'border-box'
    astTarget.placeholder = 'function or variable name, feature, etc'

    // AST expression (generated automatically)
    const astExpression = document.createElement('input')
    astExpression.type = 'text'
    astExpression.style.width = '100%'
    astExpression.style.boxSizing = 'border-box'
    astExpression.readOnly = true
    astExpression.style.background = '#f5f5f5'
    astExpression.style.color = '#666'

    // Result matcher - JavaScript expression to evaluate AST result
    const astMatcher = document.createElement('textarea')
    astMatcher.rows = 3
    astMatcher.style.width = '100%'
    astMatcher.style.boxSizing = 'border-box'
    astMatcher.style.fontFamily = 'monospace'
    astMatcher.style.fontSize = '13px'
    astMatcher.style.resize = 'vertical'
    astMatcher.placeholder = 'JavaScript expression that evaluates to true/false'
    astMatcher.value = (existing.matcher) || ''

    // Matcher examples using semantic <details> for compactness and accessibility
    const matcherExamples = document.createElement('details')
    matcherExamples.className = 'matcher-examples'
    matcherExamples.style.marginTop = '6px'
    matcherExamples.style.marginBottom = '12px'
    matcherExamples.style.fontSize = '0.8em'

    const examplesSummary = document.createElement('summary')
    examplesSummary.textContent = 'Matcher examples'
    examplesSummary.style.cursor = 'pointer'
    examplesSummary.style.fontSize = '0.95em'
    examplesSummary.style.fontWeight = '600'
    examplesSummary.style.marginBottom = '6px'

    const examplesContent = document.createElement('div')
    examplesContent.style.marginTop = '8px'
    examplesContent.style.color = '#666'
    examplesContent.style.padding = '8px'
    examplesContent.style.background = '#fff'
    examplesContent.style.border = '1px solid #e0e0e0'
    examplesContent.style.borderRadius = '3px'
    // Use centralized helper for this static examples block to avoid direct innerHTML insertion
    try {
        setInnerHTML(examplesContent, `
        <strong>Examples:</strong><br>
        • <code>result && result.name === 'calculate_average'</code> (function_exists)<br>
        • <code>result && result.parameters >= 1</code> (function_exists)<br>
        • <code>result && result.count >= 2</code> (function_count)<br>
        • <code>result && result.details.some(d => d.type === 'for')</code> (control_flow)<br>
        • <code>result && result.name === 'Calculator'</code> (class_analysis with target)<br>
        • <code>result && result.classes.some(c => c.name === 'Calculator')</code> (class_analysis no target)<br>
        • <code>result && result.imports.some(i => i.module === 'numpy')</code> (import_statements)<br>
        • <code>result && result.magicNumbers.length > 0</code> (magic_numbers)<br>
        • <code>result && result.tryCount > 0</code> (exception_handling)<br>
        • <code>result && result.tryBlocks && result.tryBlocks.some(tb => tb.calls && tb.calls.some(c => c.name === 'do_work'))</code> (exception_handling: check calls in try)<br>
        • <code>result && result.annotation === 'int'</code> (variable_usage: annotated variable)<br>
        • <code>result && result.annotations && result.annotations.some(a => a.name === 'x' && a.annotation === 'int')</code> (variable_usage: annotations list)<br>
        • <code>result && result.comprehensions && result.comprehensions.some(c => c.type === 'ListComp' && c.generators === 1)</code> (comprehensions)
        <br>• <code>result && result.functions && result.functions.some(f => f.name === 'print' && f.count &gt; 0)</code> (function_calls: all functions)
        <br>• <code>result && result.name === 'calculate' && result.count &gt;= 1</code> (function_calls: target-specific)
    `)
    } catch (_e) {
        examplesContent.textContent = 'Examples: (unable to render examples)'
    }

    matcherExamples.appendChild(examplesSummary)
    matcherExamples.appendChild(examplesContent)

    // Preview area
    const astPreview = document.createElement('div')
    astPreview.className = 'ast-preview'
    astPreview.style.marginBottom = '12px'
    astPreview.style.padding = '10px'
    astPreview.style.background = '#fff'
    astPreview.style.border = '1px solid #e0e0e0'
    astPreview.style.borderRadius = '3px'
    astPreview.style.fontSize = '0.9em'
    astPreview.style.color = '#666'

    // Test area
    const testArea = createTestArea(astExpression, astMatcher)

    // Automatic dry-run evaluation: run the matcher against a few
    // safe sample AST results when the matcher is edited so authors get
    // immediate feedback without manually running the Test button.
    // We debounce input to avoid excessive evaluations.
    try {
        let autoEvalTimer = null

        function generateSampleResults() {
            const expression = (astExpression && astExpression.value) ? astExpression.value : ''
            const parts = expression.split(':')
            const type = parts[0] || ''
            const target = parts.slice(1).join(':') || astTarget.value || ''

            switch (type) {
                case 'function_exists':
                    return [{ name: target || 'do_work', parameters: 2 }, { name: 'other', parameters: 0 }]
                case 'function_count':
                    return [{ count: 0 }, { count: 3 }]
                case 'variable_usage':
                    return [{ name: target || 'x', used: true, annotation: 'int', annotations: [{ name: target || 'x', annotation: 'int' }] }, { name: 'y', used: false }]
                case 'control_flow':
                    return [{ details: [{ type: 'for' }] }, { details: [{ type: 'if' }] }]
                case 'has_docstring':
                    return [{ hasDoc: true }, { hasDoc: false }]
                case 'class_analysis':
                    return [{ name: target || 'Calculator', methods: [] }, { name: 'Other' }]
                case 'import_statements':
                    return [{ imports: [{ module: target || 'numpy' }] }, { imports: [] }]
                case 'magic_numbers':
                    return [{ magicNumbers: [42] }, { magicNumbers: [] }]
                case 'exception_handling':
                    return [{ tryCount: 1, tryBlocks: [{ calls: [{ name: 'do_work' }] }] }, { tryCount: 0 }]
                case 'comprehensions':
                    return [{ comprehensions: [{ type: 'ListComp', generators: 1 }] }, { comprehensions: [] }]
                default:
                    // Generic samples
                    return [{}, {}]
            }
        }

        function autoEvaluateMatcher(matcherCode) {
            const testResultEl = root.querySelector('.test-result')
            if (!testResultEl) return
            if (!matcherCode || !matcherCode.trim()) {
                try { delete testResultEl.dataset.nonBoolean } catch (_e) { }
                testResultEl.style.display = 'none'
                return
            }

            const samples = generateSampleResults()
            for (const sample of samples) {
                try {
                    const evaluateMatch = new Function('result', `try { return ${matcherCode}; } catch (e) { throw new Error('Matcher evaluation error: ' + e.message); }`)
                    const r = evaluateMatch(sample)
                    const isBoolean = (typeof r === 'boolean')
                    const truthy = !!r
                    if (!isBoolean && truthy) {
                        try { testResultEl.dataset.nonBoolean = '1' } catch (_e) { }
                        showTestResult(testResultEl, 'warning', `⚠️ <strong>Auto-check:</strong> Matcher appears to return a non-boolean truthy value for sample AST results. Please ensure your matcher returns true/false.`)
                        return
                    }
                } catch (e) {
                    // Show matcher errors so authors can fix syntax/logic
                    try { delete testResultEl.dataset.nonBoolean } catch (_e) { }
                    showTestResult(testResultEl, 'warning', `⚠️ <strong>Matcher Error:</strong> ${e.message}`)
                    return
                }
            }

            // No problematic returns detected
            try { delete testResultEl.dataset.nonBoolean } catch (_e) { }
            testResultEl.style.display = 'none'
        }

        // Debounced listener on matcher edits
        astMatcher.addEventListener('input', () => {
            if (autoEvalTimer) clearTimeout(autoEvalTimer)
            autoEvalTimer = setTimeout(() => autoEvaluateMatcher(astMatcher.value), 350)
        })

        // Also auto-evaluate initially if matcher exists
        if (astMatcher && astMatcher.value && astMatcher.value.trim()) {
            setTimeout(() => autoEvaluateMatcher(astMatcher.value), 250)
        }
    } catch (_e) { /* best-effort: don't break builder if auto-eval fails */ }

    // Function to update AST expression based on UI selections
    function updateASTExpression() {
        const analysisType = astTypeSelect.value
        const target = astTarget.value.trim()

        if (target) {
            astExpression.value = `${analysisType}:${target}`
        } else {
            astExpression.value = analysisType
        }

        // Update preview
        const selectedOption = astTypeSelect.querySelector(`option[value="${analysisType}"]`)
        const help = selectedOption ? selectedOption.getAttribute('data-help') : ''
        try { setInnerHTML(astPreview, `<strong>Expression:</strong> ${astExpression.value}<br><strong>Description:</strong> ${help}`) } catch (_e) { astPreview.textContent = `${astExpression.value} — ${help}` }
    }

    // Event listeners
    astTypeSelect.addEventListener('change', updateASTExpression)
    astTarget.addEventListener('input', updateASTExpression)

    // Set initial values if editing existing rule
    if (existing.expression) {
        const parts = existing.expression.split(':')
        if (parts.length >= 1) {
            astTypeSelect.value = parts[0]
        }
        if (parts.length >= 2) {
            astTarget.value = parts.slice(1).join(':')
        }
    }

    // Build UI with consistent spacing
    root.appendChild(labeled('Analysis Type', astTypeSelect, 'Choose the type of code analysis to perform.'))
    root.appendChild(labeled('Target [optional]', astTarget, 'Specific target to look for (function name, variable name, etc.). Leave empty for general analysis.'))
    root.appendChild(labeled('Expression', astExpression, 'Generated AST analysis expression. This is automatically created based on your selections above.'))
    root.appendChild(astPreview)
    root.appendChild(labeled('Result Matcher', astMatcher, 'JavaScript expression that evaluates the AST analysis result. Must return true/false to determine if the rule matches. The variable "result" contains the AST analysis data.'))
    root.appendChild(matcherExamples)
    root.appendChild(testArea)

    // Move the test result element so it appears directly under the
    // Result matcher editor for better visibility. The .test-result
    // element is created inside the testArea; move it into the matcher
    // wrapper immediately after the matcher field.
    try {
        const internalResult = testArea.querySelector('.test-result')
        if (internalResult && astMatcher && astMatcher.parentNode) {
            // Insert after the matcher element inside its labeled wrapper
            astMatcher.parentNode.insertBefore(internalResult, astMatcher.nextSibling)
        }
    } catch (_e) { }

    // Initialize
    updateASTExpression()

    return {
        root,
        get() {
            const rule = {
                type: 'ast',
                target: 'code',  // AST always targets code
                expression: astExpression.value || '',
                matcher: astMatcher.value.trim() || undefined
            }

            // For tests, we might need additional properties
            if (ruleType === 'test') {
                rule.fileTarget = 'main.py'  // Default file target for tests
            }

            return rule
        },
        updateExpression: updateASTExpression
    }
}

/**
 * Create AST test area
 */
function createTestArea(expressionField, matcherField) {
    const testArea = document.createElement('div')
    testArea.className = 'ast-tester'
    testArea.style.marginTop = '12px'
    testArea.style.padding = '12px'
    testArea.style.background = '#fff'
    testArea.style.border = '1px solid #e0e0e0'
    testArea.style.borderRadius = '4px'
    testArea.style.boxSizing = 'border-box'

    const testHeader = document.createElement('div')
    testHeader.style.fontSize = '0.9em'
    testHeader.style.fontWeight = '500'
    testHeader.style.marginBottom = '8px'
    testHeader.style.color = '#333'
    testHeader.textContent = 'Test your AST rule:'

    const testCode = document.createElement('textarea')
    testCode.placeholder = 'Enter Python code to test your AST rule...'
    testCode.style.width = '100%'
    testCode.style.boxSizing = 'border-box'
    testCode.rows = 4
    testCode.style.fontSize = '13px'
    testCode.style.fontFamily = 'monospace'
    testCode.style.marginBottom = '8px'
    testCode.style.resize = 'vertical'
    testCode.placeholder = `# Python code to test your AST rule e.g.
import numpy as np
from math import sqrt

class Calculator:
    """A simple calculator class."""
    
    def __init__(self):
        self.history = []
    
    def calculate_average(self, numbers):
        """Calculate the average of a list of numbers."""
        try:
            if not numbers:
                return 0
            total = sum(numbers)
            count = len(numbers)
            result = total / count  # Magic number: could use a constant
            self.history.append(result)
            return result
        except ZeroDivisionError:
            return 0
        except Exception as e:
            print(f"Error: {e}")
            return None`

    const testButton = document.createElement('button')
    testButton.type = 'button'
    testButton.className = 'btn'
    testButton.textContent = 'Test Rule'
    testButton.style.marginBottom = '8px'

    const testResult = document.createElement('div')
    testResult.className = 'test-result'
    testResult.style.padding = '10px'
    testResult.style.border = '1px solid #ddd'
    testResult.style.borderRadius = '3px'
    testResult.style.fontSize = '0.9em'
    testResult.style.display = 'none'
    testResult.style.boxSizing = 'border-box'

    // Test button functionality
    testButton.addEventListener('click', async () => {
        const code = (codeMirrorEditor && typeof codeMirrorEditor.getValue === 'function') ? codeMirrorEditor.getValue().trim() : testCode.value.trim()
        const expression = expressionField.value.trim()

        if (!code) {
            showTestResult(testResult, 'warning', '⚠️ Please enter some Python code to test.')
            return
        }

        if (!expression) {
            showTestResult(testResult, 'warning', '⚠️ Please configure an AST expression to test.')
            return
        }

        testButton.textContent = 'Testing...'
        testButton.disabled = true

        try {
            // Import the analyzeCode function dynamically. Try multiple
            // paths so the builder works when the app is served from
            // different roots or when bundling changes relative paths.
            const debugErrors = []
            let analyzeCode = null
            try {
                const mod = await import('./ast-analyzer.js')
                if (mod && mod.analyzeCode) analyzeCode = mod.analyzeCode
            } catch (e) { debugErrors.push({ path: './ast-analyzer.js', error: String(e) }) }

            if (!analyzeCode) {
                try {
                    const mod2 = await import('/src/js/ast-analyzer.js')
                    if (mod2 && mod2.analyzeCode) analyzeCode = mod2.analyzeCode
                } catch (e) { debugErrors.push({ path: '/src/js/ast-analyzer.js', error: String(e) }) }
            }

            if (!analyzeCode) {
                try {
                    const mod3 = await import('../js/ast-analyzer.js')
                    if (mod3 && mod3.analyzeCode) analyzeCode = mod3.analyzeCode
                } catch (e) { debugErrors.push({ path: '../js/ast-analyzer.js', error: String(e) }) }
            }

            if (!analyzeCode) {
                try {
                    const { getRegisteredAnalyzer } = await import('./analyzer-registry.js')
                    const reg = getRegisteredAnalyzer && getRegisteredAnalyzer()
                    if (typeof reg === 'function') analyzeCode = reg
                } catch (_e) {
                    // ignore registry import failures and fallback to window
                }
            }

            if (!analyzeCode && typeof window !== 'undefined' && typeof window.analyzeCode === 'function') {
                analyzeCode = window.analyzeCode
            }

            if (!analyzeCode) {
                const errMsg = 'analyzeCode not available; tried: ' + debugErrors.map(d => d.path + ' -> ' + d.error).join(' ; ')
                throw new Error(errMsg)
            }

            const result = await analyzeCode(code, expression)

            if (result) {
                let matcherResult = null
                let matcherError = null

                // Test the matcher if provided
                const matcherCode = matcherField.value.trim()
                if (matcherCode) {
                    try {
                        const evaluateMatch = new Function('result', `
                            try {
                                return ${matcherCode};
                            } catch (e) {
                                throw new Error('Matcher evaluation error: ' + e.message);
                            }
                        `);
                        matcherResult = evaluateMatch(result);
                    } catch (e) {
                        matcherError = e.message;
                    }
                }

                // Clear any previous non-boolean flag
                try { delete testResult.dataset.nonBoolean } catch (_e) { }

                if (matcherError) {
                    showTestResult(testResult, 'warning', `
                        ⚠️ <strong>Matcher Error:</strong><br>
                        ${matcherError}<br><br>
                        <strong>AST Result:</strong><br>
                        <pre>${JSON.stringify(result, null, 2)}</pre>
                    `)
                } else if (matcherCode) {
                    // If matcher returns a non-boolean but truthy value, show a
                    // clear warning so authors know to return true/false.
                    const isBoolean = (typeof matcherResult === 'boolean')
                    const truthy = !!matcherResult
                    if (!isBoolean && truthy) {
                        // mark the result element so external code (save handlers)
                        // can detect that the last test produced a non-boolean
                        // truthy value without parsing innerHTML/text.
                        try { testResult.dataset.nonBoolean = '1' } catch (_e) { }
                        showTestResult(testResult, 'warning', `
                            ⚠️ <strong>Rule Result (non-boolean):</strong><br>
                            <em>Matcher returned a non-boolean truthy value; it's recommended to return a boolean (true/false).</em><br><br>
                            <strong>Matcher Output:</strong><br>
                            <pre>${JSON.stringify(matcherResult, null, 2)}</pre>
                            <strong>AST Result:</strong><br>
                            <pre>${JSON.stringify(result, null, 2)}</pre>
                        `)
                    } else {
                        try { delete testResult.dataset.nonBoolean } catch (_e) { }
                        const matchIcon = truthy ? '✅' : '❌'
                        const resultType = truthy ? 'success' : 'error'
                        showTestResult(testResult, resultType, `
                            ${matchIcon} <strong>Rule Result: ${matcherResult}</strong><br>
                            <em>${truthy ? 'Rule matches - action will be triggered' : 'Rule does NOT match - no action will be triggered'}</em><br><br>
                            <strong>AST Result:</strong><br>
                            <pre>${JSON.stringify(result, null, 2)}</pre>
                        `)
                    }
                } else {
                    try { delete testResult.dataset.nonBoolean } catch (_e) { }
                    showTestResult(testResult, 'success', `
                        ✅ <strong>Pattern matched!</strong><br>
                        <em>Add a Result Matcher to control when the rule is triggered</em><br><br>
                        <strong>AST Result:</strong><br>
                        <pre>${JSON.stringify(result, null, 2)}</pre>
                    `)
                }
            } else {
                try { delete testResult.dataset.nonBoolean } catch (_e) { }
                showTestResult(testResult, 'error', `❌ <strong>Pattern did not match.</strong><br>The AST analysis returned no results for this code.`)
            }
        } catch (error) {
            showTestResult(testResult, 'error', `❌ <strong>Error testing rule:</strong><br>${error.message}`)
        } finally {
            testButton.textContent = 'Test Rule'
            testButton.disabled = false
        }
    })

    testArea.appendChild(testHeader)
    testArea.appendChild(testCode)
    testArea.appendChild(testButton)
    testArea.appendChild(testResult)

    // Try to initialize CodeMirror (fromTextArea) for nicer editing if CodeMirror is available.
    // If not available, keep the plain textarea as a fallback.
    let codeMirrorEditor = null
    try {
        if (typeof window !== 'undefined' && window.CodeMirror && typeof window.CodeMirror.fromTextArea === 'function') {
            codeMirrorEditor = window.CodeMirror.fromTextArea(testCode, {
                mode: 'python',
                lineNumbers: true,
                gutters: ['CodeMirror-linenumbers'],
                fixedGutter: true,
                lineNumberFormatter: function (line) {
                    return String(line);
                },
                indentUnit: 4,
                tabSize: 4,
                matchBrackets: true,
                autoCloseBrackets: true,
                scrollbarStyle: 'native',
                // Wrap long lines to avoid expanding the editor horizontally
                lineWrapping: true,
                extraKeys: {
                    Tab: function (cm) {
                        if (cm.somethingSelected()) cm.indentSelection('add')
                        else cm.replaceSelection('    ', 'end')
                    }
                }
            })
            // Set sensible height and force a refresh to ensure gutter layout
            try {
                codeMirrorEditor.setSize('100%', 160)
                // Force refresh after a brief delay to ensure proper gutter rendering
                setTimeout(() => {
                    if (codeMirrorEditor && typeof codeMirrorEditor.refresh === 'function') {
                        codeMirrorEditor.refresh()
                    }
                }, 50)
            } catch (_e) { }

            // Add focus event listener to refresh when user clicks into editor
            try {
                codeMirrorEditor.on('focus', () => {
                    console.log('AST rule builder: Editor focused, refreshing...')
                    setTimeout(() => {
                        if (codeMirrorEditor && typeof codeMirrorEditor.refresh === 'function') {
                            codeMirrorEditor.refresh()
                        }
                    }, 10)
                })
            } catch (_e) { }
        }
    } catch (_e) {
        codeMirrorEditor = null
    }

    // If the editor is created inside a modal or hidden container, CodeMirror
    // may need a refresh once it becomes visible. More robust visibility detection.
    if (codeMirrorEditor) {
        const refreshWhenVisible = () => {
            try {
                // Check multiple conditions for visibility
                const isVisible = testArea.offsetParent !== null &&
                    testArea.offsetWidth > 0 &&
                    testArea.offsetHeight > 0

                if (isVisible) {
                    console.log('AST rule builder: Editor is now visible, refreshing...')
                    codeMirrorEditor.refresh()
                    return true
                }
                return false
            } catch (_e) { return true }
        }

        // Try immediate refresh
        if (!refreshWhenVisible()) {
            // If not visible now, set up periodic checks
            let attempts = 0
            const maxAttempts = 20 // Try for about 2 seconds

            const periodicRefresh = () => {
                if (attempts >= maxAttempts) {
                    console.log('AST rule builder: Giving up on visibility detection')
                    return
                }

                attempts++
                if (!refreshWhenVisible()) {
                    setTimeout(periodicRefresh, 100)
                }
            }

            setTimeout(periodicRefresh, 100)
        }

        // Also set up a mutation observer to catch dynamic visibility changes
        try {
            if (typeof MutationObserver !== 'undefined') {
                const observer = new MutationObserver(() => {
                    if (refreshWhenVisible()) {
                        observer.disconnect()
                    }
                })

                // Watch for style changes on the test area and its parents
                let element = testArea
                while (element && element !== document.body) {
                    observer.observe(element, {
                        attributes: true,
                        attributeFilter: ['style', 'class']
                    })
                    element = element.parentElement
                }
            }
        } catch (_e) { }
    }

    return testArea
}

/**
 * Show test result with appropriate styling
 */
function showTestResult(resultElement, type, content) {
    resultElement.style.display = 'block'

    const styles = {
        success: { background: '#d4edda', border: '#c3e6cb' },
        warning: { background: '#fff3cd', border: '#ffeaa7' },
        error: { background: '#f8d7da', border: '#f5c6cb' }
    }

    const style = styles[type] || styles.warning
    resultElement.style.background = style.background
    resultElement.style.borderColor = style.border
    // Sanitize content before inserting as HTML to avoid XSS from matcher outputs
    try {
        resultElement.innerHTML = sanitizeHtml(content)
    } catch (_e) {
        // Fallback: set as textContent if sanitization fails
        resultElement.textContent = String(content)
    }
}

/**
 * Create AST feedback entry with default configuration
 */
export function createDefaultASTFeedback() {
    return {
        id: genId(),
        title: 'Check class definition',
        when: ['edit'],  // AST feedback always happens at edit time
        pattern: {
            type: 'ast',
            target: 'code',
            expression: 'class_analysis:Calculator',
            matcher: 'result && result.name === "Calculator"'
        },
        message: 'Great! You defined the `Calculator` class.',
        severity: 'success',
        visibleByDefault: true
    }
}

/**
 * Create AST test entry with default configuration  
 */
export function createDefaultASTTest() {
    return {
        id: genId(),
        description: 'Import statement test',
        // AST tests don't need stdin/stdout - they analyze code structure
        astRule: {
            type: 'ast',
            target: 'code',
            expression: 'import_statements:numpy',
            matcher: 'result && result.imports.some(i => i.module && i.module.includes("numpy"))'
        },
        // Tests can have expected messages for when they pass/fail
        expectedMessage: 'NumPy is properly imported'
    }
}

/**
 * Generate a unique ID
 */
function genId() {
    return 'ast-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
}

export default {
    createASTRuleBuilder,
    createDefaultASTFeedback,
    createDefaultASTTest
}
