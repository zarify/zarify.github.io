/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals'

describe('AST test builder', () => {
    beforeEach(() => {
        jest.resetModules()
        document.documentElement.innerHTML = ''
    })

    test('createDefaultASTTest returns a valid AST test object', async () => {
        const mod = await import('../ast-test-builder.js')
        const t = mod.createDefaultASTTest()
        expect(t).toBeDefined()
        expect(t.type).toBe('ast')
        expect(t.astRule).toBeDefined()
        expect(typeof t.id).toBe('string')
        expect(t.astRule.expression).toBeDefined()
    })

    test('buildASTTestForm produces a form whose get() returns configured astRule and fields', async () => {
        const mod = await import('../ast-test-builder.js')
        const { buildASTTestForm } = mod

        // Create form with empty existing object
        const form = buildASTTestForm({})
        document.body.appendChild(form.root)

        // set description
        const desc = form.root.querySelector('input[placeholder="What is being tested, descriptive language"]')
        expect(desc).toBeDefined()
        desc.value = 'My AST Test'

        // set timeout
        const timeout = form.root.querySelector('input[type="number"]')
        expect(timeout).toBeDefined()
        timeout.value = '1500'

        // set failure message (find the textarea by its placeholder)
        const failure = Array.from(form.root.querySelectorAll('textarea')).find(t => (t.placeholder || '').includes('Message shown when test fails'))
        expect(failure).toBeDefined()
        failure.value = 'failure-msg'

        // locate ast rule builder root and its controls
        const astRoot = form.root.querySelector('.ast-rule-builder')
        expect(astRoot).toBeDefined()
        const astTypeSelect = astRoot.querySelector('select')
        const astTarget = astRoot.querySelector('input[placeholder="function or variable name, feature, etc"]')
        const astExpression = astRoot.querySelector('input[readonly]')
        const astMatcher = astRoot.querySelector('textarea[placeholder^="JavaScript expression"]') || astRoot.querySelector('textarea')
        expect(astTypeSelect).toBeDefined()
        expect(astTarget).toBeDefined()
        expect(astExpression).toBeDefined()
        expect(astMatcher).toBeDefined()

        // choose function_exists and set target, trigger events to update expression
        astTypeSelect.value = 'function_exists'
        astTypeSelect.dispatchEvent(new Event('change', { bubbles: true }))
        astTarget.value = 'calculate'
        astTarget.dispatchEvent(new Event('input', { bubbles: true }))

        // set matcher code
        astMatcher.value = "result && result.name === 'calculate'"

        // call get()
        const result = form.get()
        expect(result).toBeDefined()
        expect(result.type).toBe('ast')
        expect(result.description).toBe('My AST Test')
        expect(result.timeoutMs).toBe(1500)
        expect(result.failureMessage).toBe('failure-msg')
        expect(result.astRule).toBeDefined()
        expect(result.astRule.expression).toBe('function_exists:calculate')
        expect(result.astRule.matcher).toBe("result && result.name === 'calculate'")
    })
})
