import { jest } from '@jest/globals'

describe('input-handling', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = `
            <form id="terminal-input-form"><input id="stdin-box" /></form>
            <div id="terminal-output"></div>
            <button id="stdin-send"></button>
        `
        // Note: we'll mock './terminal.js' per-test before importing the module
    })

    test('createInputHandler resolves and echoes input into terminal', async () => {
        // mock terminal helpers used by input-handling module
        const fakeTerminal = {
            appendTerminal: jest.fn(),
            appendTerminalDebug: jest.fn(),
            setTerminalInputEnabled: jest.fn(),
            findOrCreatePromptLine: jest.fn()
        }
        jest.unstable_mockModule('../terminal.js', () => fakeTerminal)

        const mod = await import('../input-handling.js')
        const { createInputHandler } = mod
        const handler = createInputHandler()

        // simulate user typing into stdin-box and pressing Enter via resolving the pending promise
        const prom = handler('> ')
        // find the pending input resolver on window
        expect(window.__ssg_pending_input).toBeTruthy()
        // resolve it as if user typed 'abc'
        window.__ssg_pending_input.resolve('abc')
        const got = await prom
        expect(got).toBe('abc')
        // appendTerminal should have been called for prompt and/or echo
        const term = await import('../terminal.js')
        expect(term.appendTerminal).toHaveBeenCalled()
    })

    test('setupInputHandling prevents rapid submit and no pending input', async () => {
        const fakeTerminal = {
            appendTerminal: jest.fn(),
            appendTerminalDebug: jest.fn(),
            setTerminalInputEnabled: jest.fn(),
            findOrCreatePromptLine: jest.fn()
        }
        jest.unstable_mockModule('../terminal.js', () => fakeTerminal)
        const mod = await import('../input-handling.js')
        const { setupInputHandling } = mod
        setupInputHandling()

        const form = document.getElementById('terminal-input-form')
        // dispatch submit without pending input; nothing should happen
        const ev = new Event('submit')
        form.dispatchEvent(ev)
        const term = await import('../terminal.js')
        expect(term.appendTerminal).not.toHaveBeenCalled()
    })
})
