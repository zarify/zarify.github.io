/**
 * AST Rule Builder Module
 * 
 * Provides reusable AST rule building functionality for both feedback and tests.
 * This module creates standardized AST rule configurations that can be used
 * in both feedback (edit-time) and testing (run-time) contexts.
 */

/**
 * Create AST rule builder UI
 * @param {Object} existing - Existing rule configuration
 * @param {string} ruleType - Either 'feedback' or 'test'
 * @returns {Object} Builder object with root element and get() function
 */
export function createASTRuleBuilder(existing = {}, ruleType = 'feedback') {
    const root = document.createElement('div')
    root.className = 'ast-rule-builder'
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
            info.innerHTML = '<span class="info-symbol">ℹ</span>'
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

    // Matcher examples
    const matcherExamples = document.createElement('div')
    matcherExamples.className = 'matcher-examples'
    matcherExamples.style.marginTop = '6px'
    matcherExamples.style.marginBottom = '12px'
    matcherExamples.style.fontSize = '0.8em'
    matcherExamples.style.color = '#666'
    matcherExamples.style.padding = '8px'
    matcherExamples.style.background = '#fff'
    matcherExamples.style.border = '1px solid #e0e0e0'
    matcherExamples.style.borderRadius = '3px'
    matcherExamples.innerHTML = `
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
        • <code>result && result.annotation === 'int'</code> (variable_usage: annotated variable)
        • <code>result && result.annotations && result.annotations.some(a => a.name === 'x' && a.annotation === 'float')</code> (variable_usage: annotations list)
        • <code>result && result.comprehensions && result.comprehensions.some(c => c.type === 'ListComp' && c.generators === 1)</code> (comprehensions)
    `

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
        astPreview.innerHTML = `<strong>Expression:</strong> ${astExpression.value}<br><strong>Description:</strong> ${help}`
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
        const code = testCode.value.trim()
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
            // Import the analyzeCode function dynamically
            const { analyzeCode } = await import('./ast-analyzer.js')
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

                if (matcherError) {
                    showTestResult(testResult, 'warning', `
                        ⚠️ <strong>Matcher Error:</strong><br>
                        ${matcherError}<br><br>
                        <strong>AST Result:</strong><br>
                        <pre>${JSON.stringify(result, null, 2)}</pre>
                    `)
                } else if (matcherCode) {
                    const matchIcon = matcherResult ? '✅' : '❌'
                    const resultType = matcherResult ? 'success' : 'error'
                    showTestResult(testResult, resultType, `
                        ${matchIcon} <strong>Rule Result: ${matcherResult}</strong><br>
                        <em>${matcherResult ? 'Rule matches - action will be triggered' : 'Rule does NOT match - no action will be triggered'}</em><br><br>
                        <strong>AST Result:</strong><br>
                        <pre>${JSON.stringify(result, null, 2)}</pre>
                    `)
                } else {
                    showTestResult(testResult, 'success', `
                        ✅ <strong>Pattern matched!</strong><br>
                        <em>Add a Result Matcher to control when the rule is triggered</em><br><br>
                        <strong>AST Result:</strong><br>
                        <pre>${JSON.stringify(result, null, 2)}</pre>
                    `)
                }
            } else {
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
    resultElement.innerHTML = content
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
