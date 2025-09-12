import { jest } from '@jest/globals'

describe('input-handling module', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
        // common DOM nodes
        const stdinBox = document.createElement('input')
        stdinBox.id = 'stdin-box'
        document.body.appendChild(stdinBox)

        const send = document.createElement('button')
        send.id = 'stdin-send'
        document.body.appendChild(send)

        const form = document.createElement('form')
        form.id = 'terminal-input-form'
        document.body.appendChild(form)

        const out = document.createElement('div')
        out.id = 'terminal-output'
        document.body.appendChild(out)

        // reset globals
        delete window.__ssg_pending_input
        delete window.__ssg_stdin_history
    })

    test('setupInputHandling handles form submit and resolves pending input', async () => {
        // mock terminal exports before importing input-handling
        await jest.unstable_mockModule('../terminal.js', () => ({
            appendTerminal: jest.fn(),
            setTerminalInputEnabled: jest.fn(),
            findOrCreatePromptLine: jest.fn(),
            appendTerminalDebug: jest.fn()
        }))

        const mod = await import('../input-handling.js')
        const terminal = await import('../terminal.js')
        const { setupInputHandling } = mod

        setupInputHandling()

        // Arrange pending input resolver
        const resolver = jest.fn()
        window.__ssg_pending_input = { resolve: resolver, _usingDirectHandler: false }

        const stdinBox = document.getElementById('stdin-box')
        stdinBox.value = '  hello world  '

        const form = document.getElementById('terminal-input-form')
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

        // resolver should be called with trimmed value
        expect(resolver).toHaveBeenCalledWith('hello world')
        // appendTerminal should have been called to echo stdin
        expect(terminal.appendTerminal).toHaveBeenCalled()
        // stdinBox should be cleared
        expect(stdinBox.value).toBe('')
    })

    test('createInputHandler displays prompt and resolves on Enter key', async () => {
        jest.useFakeTimers()

        const appendCalls = []
        await jest.unstable_mockModule('../terminal.js', () => ({
            appendTerminal: (t, k) => appendCalls.push([t, k]),
            setTerminalInputEnabled: jest.fn(),
            appendTerminalDebug: jest.fn(),
            findOrCreatePromptLine: jest.fn()
        }))
        const mod = await import('../input-handling.js')
        const terminal = await import('../terminal.js')
        const { createInputHandler } = mod

        const handler = createInputHandler()
        const p = handler('>>> ')

        // At this point, window.__ssg_pending_input should exist
        expect(window.__ssg_pending_input).toBeDefined()
        // prompt should have been appended (allow flexible whitespace)
        expect(appendCalls.some(c => String(c[0] || '').includes('>>>'))).toBe(true)

        const stdinBox = document.getElementById('stdin-box')
        stdinBox.value = '  answer  '

        // simulate Enter keydown
        const ev = new KeyboardEvent('keydown', { key: 'Enter' })
        stdinBox.dispatchEvent(ev)

        // Resolve microtask queue and timers
        await Promise.resolve()
        jest.advanceTimersByTime(20)

        const result = await p
        expect(result).toBe('answer')
        // pending input should be cleared
        expect(window.__ssg_pending_input).toBeUndefined()

        jest.useRealTimers()
    })

    test('createHostModule.get_input exposes pending resolver and resolves when invoked', async () => {
        await jest.unstable_mockModule('../terminal.js', () => ({
            setTerminalInputEnabled: jest.fn(),
            appendTerminal: jest.fn(),
            appendTerminalDebug: jest.fn(),
            findOrCreatePromptLine: jest.fn()
        }))

        const mod = await import('../input-handling.js')
        const terminal = await import('../terminal.js')
        const { createHostModule } = mod

        const host = createHostModule()
        const p = host.get_input('prompt')

        // A pending input resolver should be exposed on window
        expect(window.__ssg_pending_input).toBeDefined()

        // Manually resolve via the stored resolver
        window.__ssg_pending_input.resolve('xyz')
        const result = await p
        expect(result).toBe('xyz')
        // createHostModule leaves the pending resolver on window for UI; ensure it's present then clean up
        expect(window.__ssg_pending_input).toBeDefined()
        delete window.__ssg_pending_input
    })
})
