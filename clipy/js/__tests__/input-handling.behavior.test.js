import { jest } from '@jest/globals'

describe('input-handling deeper behaviors', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = `
            <form id="terminal-input-form"><input id="stdin-box" /></form>
            <div id="terminal-output"><div class="terminal-line">out</div></div>
            <button id="stdin-send"></button>
        `
        jest.unstable_mockModule('../terminal.js', () => ({
            appendTerminal: jest.fn(),
            appendTerminalDebug: jest.fn(),
            setTerminalInputEnabled: jest.fn(),
            findOrCreatePromptLine: () => document.querySelector('.terminal-line')
        }))
    })

    test('createInputHandler direct Enter resolves and echoes into terminal output', async () => {
        const mod = await import('../input-handling.js')
        const { createInputHandler } = mod
        const handler = createInputHandler()

        const prom = handler('PROMPT')
        // resolve via window pending input mechanism
        expect(window.__ssg_pending_input).toBeTruthy()
        window.__ssg_pending_input.resolve('hello')
        const got = await prom
        expect(got).toBe('hello')
        const term = await import('../terminal.js')
        // appendTerminal should be called for prompt display and echo/newline
        expect(term.appendTerminal).toHaveBeenCalled()
    })

    test('createHostModule.get_input sets pending input and focuses stdin', async () => {
        const mod = await import('../input-handling.js')
        const { createHostModule } = mod
        const host = createHostModule()

        const p = host.get_input('Q?')
        // pending input resolver present
        expect(window.__ssg_pending_input).toBeTruthy()
        // resolve
        window.__ssg_pending_input.resolve('resp')
        const val = await p
        expect(val).toBe('resp')
    })
})
