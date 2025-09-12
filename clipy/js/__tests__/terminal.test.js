import { setupTerminalDOM } from './test-utils/test-setup.js'

test('terminal append, prompt and stderr buffering', async () => {
    const mod = await import('../terminal.js')
    const { createTerminal } = mod

    // Prepare a clean DOM for the terminal
    setupTerminalDOM()

    const host = { document }
    const t = createTerminal(host)

    // Append stdout
    t.appendTerminal('hello world', 'stdout')
    const out = document.getElementById('terminal-output')
    expect(out).toBeTruthy()
    expect(out.lastChild).toBeTruthy()
    expect(out.lastChild.textContent).toBe('hello world')
    expect(out.lastChild.className).toMatch(/term-stdout/)

    // Stderr buffering: enable and append
    t.enableStderrBuffering()
    t.appendTerminal('runtime error line', 'stderr')
    expect(host.__ssg_stderr_buffer).toBeDefined()
    expect(host.__ssg_stderr_buffer.length).toBeGreaterThan(0)
    expect(host.__ssg_stderr_buffer[0]).toBe('runtime error line')

    // Replace buffered stderr with mapped traceback
    t.replaceBufferedStderr('mapped traceback example')
    // mapped text should be appended to terminal output (synchronously)
    expect(out.lastChild).toBeTruthy()
    expect(out.lastChild.textContent).toContain('mapped traceback example')
    expect(out.lastChild.className).toMatch(/term-stderr/)

    // Prompt finding/creation
    t.appendTerminal('>>> waiting for input')
    const prompt = t.findOrCreatePromptLine('>>> waiting for input')
    expect(prompt).toBeTruthy()
    expect(prompt.className).toMatch(/term-prompt/)
    // Ensure prompt contains an input span
    expect(prompt.querySelector('.prompt-input')).toBeTruthy()
})
