import { jest } from '@jest/globals'

describe('input-handling concurrency and direct Enter behavior', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = `
            <form id="terminal-input-form"><input id="stdin-box" /></form>
            <div id="terminal-output"></div>
            <button id="stdin-send"></button>
        `
    })

    test('second createInputHandler call overwrites first pending input (no implicit queueing)', async () => {
        // mock terminal helpers
        const fakeTerminal = {
            appendTerminal: jest.fn(),
            appendTerminalDebug: jest.fn(),
            setTerminalInputEnabled: jest.fn(),
            findOrCreatePromptLine: jest.fn()
        }
        jest.unstable_mockModule('../terminal.js', () => fakeTerminal)

        const mod = await import('../input-handling.js')
        const { createInputHandler } = mod

        const handler1 = createInputHandler()
        const p1 = handler1('first')

        // ensure pending input is for first
        expect(window.__ssg_pending_input).toBeTruthy()
        expect(window.__ssg_pending_input.promptText).toBe('first')

        // call second handler before resolving first
        const handler2 = createInputHandler()
        const p2 = handler2('second')

        // pending input should now be the second one
        expect(window.__ssg_pending_input.promptText).toBe('second')

        // resolve the current (second) pending input
        window.__ssg_pending_input.resolve('resp2')
        const got2 = await p2
        expect(got2).toBe('resp2')

        // p1 should remain unresolved; use a short timeout race to confirm
        const raced = await Promise.race([
            p1.then(() => 'resolved'),
            new Promise((res) => setTimeout(() => res('timedout'), 50))
        ])
        expect(raced).toBe('timedout')
    })

    test('direct Enter handler resolves and cleans up listeners', async () => {
        const fakeTerminal = {
            appendTerminal: jest.fn(),
            appendTerminalDebug: jest.fn(),
            setTerminalInputEnabled: jest.fn(),
            findOrCreatePromptLine: () => document.querySelector('.terminal-line')
        }
        jest.unstable_mockModule('../terminal.js', () => fakeTerminal)

        const mod = await import('../input-handling.js')
        const { createInputHandler } = mod

        const handler = createInputHandler()
        const p = handler('>')

        // simulate typing in the input box and pressing Enter
        const stdin = document.getElementById('stdin-box')
        stdin.value = 'hello-enter'
        const ev = new KeyboardEvent('keydown', { key: 'Enter' })
        stdin.dispatchEvent(ev)

        const got = await p
        expect(got).toBe('hello-enter')
        // after resolving, __ssg_pending_input should be removed
        expect(window.__ssg_pending_input).toBeUndefined()
    })
})
