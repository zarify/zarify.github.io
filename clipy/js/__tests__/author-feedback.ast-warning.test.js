import { jest } from '@jest/globals'

describe('author-feedback AST matcher non-boolean warning UI', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
        try { delete window.__ssg_mem } catch (_) { }
    })

    test('modal AST tester shows warning when matcher returns non-boolean truthy', async () => {
        // mock analyzer and logger
        jest.unstable_mockModule('../ast-analyzer.js', () => ({ analyzeCode: async () => ({ name: 'ModuleX', count: 1 }), getASTAnalyzer: async () => ({ parse: async () => ({}), analyze: () => null }) }))
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))

        const mod = await import('../author-feedback.js')
        const { initAuthorFeedback } = mod

        const ta = document.createElement('textarea')
        ta.id = 'feedback-editor'
        ta.value = '[]'
        document.body.appendChild(ta)

        initAuthorFeedback()

        // open Add feedback modal
        const addBtn = document.querySelector('#author-feedback-ui .btn')
        expect(addBtn).toBeTruthy()
        addBtn.click()

        const modal = document.querySelector('.modal')
        expect(modal).toBeTruthy()

        // Switch pattern type to AST
        const selects = Array.from(modal.querySelectorAll('select'))
        const pType = selects.find(s => Array.from(s.options).some(o => o.value === 'ast'))
        expect(pType).toBeTruthy()
        pType.value = 'ast'
        pType.dispatchEvent(new Event('change', { bubbles: true }))

        // Find AST builder in the modal
        const builder = modal.querySelector('.ast-rule-builder')
        expect(builder).toBeTruthy()

        // Matcher textarea is the first textarea inside builder; test code textarea is inside .ast-tester
        const allTextareas = Array.from(builder.querySelectorAll('textarea'))
        expect(allTextareas.length).toBeGreaterThanOrEqual(2)
        const matcherTA = allTextareas[0]
        const codeTA = builder.querySelector('.ast-tester textarea')

        // Set matcher to return a non-boolean truthy value (object)
        matcherTA.value = '({ matched: true })'
        // Provide code to analyze
        codeTA.value = 'def f(): pass'

        // Click Test Rule
        const testBtn = builder.querySelector('.ast-tester button')
        expect(testBtn).toBeTruthy()
        testBtn.click()

        // Wait briefly for async test handler
        await new Promise(r => setTimeout(r, 20))

        const resultEl = builder.querySelector('.test-result')
        expect(resultEl).toBeTruthy()
        expect(resultEl.textContent).toMatch(/non-boolean/i)

        // Now assert that clicking Save is blocked and an error is shown
        const saveBtn = modal.querySelector('.modal-header-actions .btn.btn-primary')
        expect(saveBtn).toBeTruthy()
        saveBtn.click()

        // Save handler writes the error text into the small err div we created
        // inside the modal content wrapper. Select by color style to be robust.
        await new Promise(r => setTimeout(r, 10))
        const modalBody = modal.querySelector('#author-feedback-modal-body')
        expect(modalBody).toBeTruthy()
        // Find any descendant that contains the save-blocking error text.
        const errNode = Array.from(modalBody.querySelectorAll('*')).find(n => {
            try { return /Cannot save: AST matcher returned/i.test(String(n.textContent || '')) } catch (_) { return false }
        })
        expect(errNode).toBeTruthy()
        expect(String(errNode.textContent)).toMatch(/Cannot save: AST matcher returned a non-boolean/i)

    })

    test('modal Save succeeds when matcher returns strict boolean true', async () => {
        jest.resetModules()
        document.body.innerHTML = ''
        try { delete window.__ssg_mem } catch (_) { }
        jest.unstable_mockModule('../ast-analyzer.js', () => ({ analyzeCode: async () => ({ ok: true }), getASTAnalyzer: async () => ({}) }))
        jest.unstable_mockModule('../logger.js', () => ({ debug: () => { }, info: () => { }, warn: () => { }, error: () => { } }))

        const mod = await import('../author-feedback.js')
        const { initAuthorFeedback } = mod

        const ta = document.createElement('textarea')
        ta.id = 'feedback-editor'
        ta.value = '[]'
        document.body.appendChild(ta)
        initAuthorFeedback()

        const addBtn = document.querySelector('#author-feedback-ui .btn')
        addBtn.click()
        const modal = document.querySelector('.modal')

        // Switch to AST pattern
        const selects = Array.from(modal.querySelectorAll('select'))
        const pType = selects.find(s => Array.from(s.options).some(o => o.value === 'ast'))
        pType.value = 'ast'
        pType.dispatchEvent(new Event('change', { bubbles: true }))

        const builder = modal.querySelector('.ast-rule-builder')
        const allTextareas = Array.from(builder.querySelectorAll('textarea'))
        const matcherTA = allTextareas[0]
        const codeTA = builder.querySelector('.ast-tester textarea')

        matcherTA.value = 'true'
        codeTA.value = 'def f(): pass'

        const testBtn = builder.querySelector('.ast-tester button')
        testBtn.click()
        await new Promise(r => setTimeout(r, 20))

        const resultEl = builder.querySelector('.test-result')
        expect(resultEl).toBeTruthy()
        // Should indicate a match (success) and not the non-boolean warning
        expect(resultEl.textContent).not.toMatch(/non-boolean/i)

        // Click Save and expect modal to be closed (aria-hidden true or display none)
        const saveBtn = modal.querySelector('.modal-header-actions .btn.btn-primary')
        saveBtn.click()
        await new Promise(r => setTimeout(r, 10))
        expect(modal.getAttribute('aria-hidden') === 'true' || modal.style.display === 'none').toBeTruthy()
    })
})
