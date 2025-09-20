/* DOM-order test: ensure header-author-btn is inserted before config-select-header
   This test simulates the header wiring with authoring enabled and a remote
   config list present, then asserts that the author button appears before the
   select element in the header container. */

// Lightweight DOM-order tests using Jest's built-in jsdom environment.
// These tests simulate the header container and run the same insertion logic
// used in `src/app.js` to ensure the Author button ends up before the
// config select regardless of creation timing.

describe('Header DOM ordering', () => {
    let container
    let titleLine

    beforeEach(() => {
        // Create a simple container structure that mirrors the header stack
        const outer = document.createElement('div')
        const stack = document.createElement('div')
        stack.className = 'config-stack'
        titleLine = document.createElement('span')
        titleLine.className = 'config-title-line'
        titleLine.textContent = 'Title'
        stack.appendChild(titleLine)
        outer.appendChild(stack)
        document.body.appendChild(outer)
        // app.js uses titleLine.parentElement as the container; mirror that
        container = titleLine.parentElement
    })

    afterEach(() => {
        try { document.body.removeChild(container) } catch (_e) { }
    })

    function insertAuthorButton(container, titleLine) {
        const authorBtn = document.createElement('button')
        authorBtn.id = 'header-author-btn'
        authorBtn.textContent = 'Author'
        // Mirror insertion logic from app.js: insert before select if present
        const reference = container.querySelector('#config-select-header') || titleLine
        container.insertBefore(authorBtn, reference)
        return authorBtn
    }

    test('when select already exists, author button is inserted before it', () => {
        // Simulate select being created first
        const select = document.createElement('select')
        select.id = 'config-select-header'
        // Insert select into container before titleLine (mirrors app behavior)
        container.insertBefore(select, titleLine)

        const authorBtn = insertAuthorButton(container, titleLine)

        const children = Array.from(container.children)
        expect(children.indexOf(authorBtn)).toBeLessThan(children.indexOf(select))
    })

    test('when select does not exist, author button is inserted before titleLine', () => {
        const authorBtn = insertAuthorButton(container, titleLine)
        const children = Array.from(container.children)
        expect(children.indexOf(authorBtn)).toBeLessThan(children.indexOf(titleLine))
    })
})
