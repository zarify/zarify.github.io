/**
 * AST Test Builder Module
 * 
 * Specialized builder for AST-based tests that analyze code structure
 * rather than input/output behavior.
 */

import { createASTRuleBuilder } from './ast-rule-builder.js'

/**
 * Create AST test form builder
 * @param {Object} existing - Existing test configuration
 * @returns {Object} Form builder with root element and get() function
 */
export function buildASTTestForm(existing = {}) {
    const root = document.createElement('div')
    root.style.border = '1px solid #e0e0e0'
    root.style.padding = '8px'
    root.style.borderRadius = '6px'
    root.style.background = '#f0f8ff'  // Light blue background to distinguish from regular tests

    // Helper function for labeled form elements
    function labeled(labelText, el, helpText) {
        const wr = document.createElement('div')
        wr.style.marginBottom = '8px'
        const l = document.createElement('div')
        l.style.fontSize = '0.9em'
        l.style.marginBottom = '4px'
        l.style.display = 'flex'
        l.style.alignItems = 'center'
        l.style.gap = '8px'
        const txt = document.createElement('span')
        txt.textContent = labelText
        l.appendChild(txt)
        if (helpText) {
            const info = document.createElement('span')
            info.className = 'info-icon'
            info.setAttribute('tabindex', '0')
            info.setAttribute('role', 'img')
            info.setAttribute('aria-label', labelText + ' help')
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

    // Test ID
    const idIn = document.createElement('input')
    idIn.style.width = '100%'
    idIn.value = existing.id || ''

    // Test description
    const desc = document.createElement('input')
    desc.style.width = '100%'
    desc.value = existing.description || existing.name || ''
    desc.placeholder = 'What is being tested, descriptive language'

    // AST rule builder
    const astRuleBuilder = createASTRuleBuilder(existing.astRule || {}, 'test')

    // Failure message (what should be shown when test fails)
    const failureMessage = document.createElement('textarea')
    failureMessage.style.width = '100%'
    failureMessage.rows = 2
    failureMessage.value = existing.failureMessage || ''
    failureMessage.placeholder = 'Message shown when test fails (optional)'

    // Timeout (optional)
    const timeout = document.createElement('input')
    timeout.type = 'number'
    timeout.style.width = '120px'
    timeout.value = typeof existing.timeoutMs === 'number' ? String(existing.timeoutMs) : ''
    timeout.placeholder = '5000'


    // Add a header to distinguish this as an AST test
    const header = document.createElement('div')
    header.style.background = '#e6f3ff'
    header.style.padding = '8px'
    header.style.borderRadius = '4px'
    header.style.marginBottom = '12px'
    header.style.border = '1px solid #b3d9ff'
    // Build header content safely using DOM APIs
    const headerStrong = document.createElement('strong')
    headerStrong.textContent = '🔍 AST Code Analysis Test'
    const headerBr = document.createElement('br')
    const headerSpan = document.createElement('span')
    headerSpan.style.fontSize = '0.9em'
    headerSpan.style.color = '#666'
    headerSpan.textContent = 'This test analyzes code structure instead of input/output behavior.'
    header.appendChild(headerStrong)
    header.appendChild(headerBr)
    header.appendChild(headerSpan)

    // Build the form
    root.appendChild(header)
    root.appendChild(labeled('ID [optional]', idIn, 'Optional stable identifier for this test'))
    root.appendChild(labeled('Description', desc, 'Short description of what this test checks'))

    // Add AST rule builder with a section header
    const astSection = document.createElement('div')
    astSection.style.marginTop = '12px'
    astSection.style.marginBottom = '12px'
    const astHeader = document.createElement('h4')
    astHeader.textContent = 'AST Analysis Rule'
    astHeader.style.margin = '0 0 8px 0'
    astHeader.style.fontSize = '1em'
    astHeader.style.color = '#333'
    astSection.appendChild(astHeader)
    astSection.appendChild(astRuleBuilder.root)
    root.appendChild(astSection)

    root.appendChild(labeled('Failure Message [optional]', failureMessage, 'Message displayed when the AST rule does not match (test fails)'))
    root.appendChild(labeled('Timeout (ms) [optional]', timeout, 'Maximum time for AST analysis (default: 5000ms)'))
    // Note: AST builder intentionally does not provide a success message or
    // a "hide AST details" option because AST analysis results are handled
    // differently by the runtime/UI and those controls are not applicable.

    // Conditional execution controls (same semantics as regular tests)
    const conditionalWrap = document.createElement('div')

    const runIfSelect = document.createElement('select')
    runIfSelect.className = 'form-input'
    runIfSelect.style.marginBottom = '8px'

    const runIfOptions = [
        { value: 'previous_passed', text: 'Only run if previous test passed (default)' },
        { value: 'always', text: 'Always run this test' }
    ]
    runIfOptions.forEach(opt => {
        const option = document.createElement('option')
        option.value = opt.value
        option.textContent = opt.text
        runIfSelect.appendChild(option)
    })

    conditionalWrap.appendChild(runIfSelect)

    // Set initial conditional value
    if (existing?.conditional) {
        runIfSelect.value = existing.conditional.runIf || 'previous_passed'
    } else {
        runIfSelect.value = 'previous_passed'
    }

    root.appendChild(labeled('Run Conditions', conditionalWrap, 'Control when this test is executed'))

    // Group assignment control (populated by caller modal using #group-selector)
    const groupSelectWrap = document.createElement('div')
    const groupSelect = document.createElement('select')
    groupSelect.className = 'form-input'
    groupSelect.id = 'group-selector'
    groupSelectWrap.appendChild(groupSelect)
    root.appendChild(labeled('Assign to Group', groupSelectWrap, 'Assign this test to a test group or leave ungrouped'))

    return {
        root,
        get() {
            const astRule = astRuleBuilder.get()

            const test = {
                type: 'ast',  // Mark this as an AST test
                astRule: astRule
            }

            // Add optional fields only if they have values
            if (idIn.value.trim()) test.id = idIn.value.trim()
            test.description = desc.value.trim() || 'AST Analysis Test'
            if (failureMessage.value.trim()) test.failureMessage = failureMessage.value.trim()
            if (timeout.value) test.timeoutMs = Number(timeout.value)
            // hide_actual_expected intentionally not set by AST builder
            // Conditional execution settings
            test.conditional = {
                runIf: runIfSelect.value,
                alwaysRun: false
            }

            // Group selector value will be consumed by the authoring UI
            test._selectedGroupId = groupSelect.value

            return test
        }
    }
}

/**
 * Create default AST test configuration
 */
export function createDefaultASTTest() {
    return {
        type: 'ast',
        id: genId(),
        description: '',
        astRule: {
            type: 'ast',
            target: 'code',
            expression: '',
            matcher: ''
        },
        failureMessage: ''
    }
}

/**
 * Generate a unique ID for AST tests
 */
function genId() {
    return 'ast-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
}

export default {
    buildASTTestForm,
    createDefaultASTTest
}
