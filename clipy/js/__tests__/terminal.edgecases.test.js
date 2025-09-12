test('terminal multi-line prompt matching and mapping retry', async () => {
    const mod = await import('../terminal.js')
    const { createTerminal } = mod

    // Prepare DOM with multiple lines that should match a multi-line prompt
    document.body.innerHTML = `
        <div id="terminal-output">
            <div class="terminal-line">Part one of prompt</div>
            <div class="terminal-line">and part two</div>
        </div>
    `

    const host = { document }
    const t = createTerminal(host)

    // Multi-line prompt should be found and converted
    const prompt = t.findOrCreatePromptLine('Part one of prompt\nand part two')
    expect(prompt).toBeTruthy()
    expect(prompt.className).toMatch(/term-prompt/)
    expect(prompt.querySelector('.prompt-input')).toBeTruthy()

    // Now test mapping retry: when mapping_in_progress is true but buffer empty,
    // replaceBufferedStderr should schedule a retry and not throw.
    host.__ssg_mapping_in_progress = true
    host.__ssg_stderr_buffer = []

    // Spy on setTimeout by replacing global temporarily to capture scheduling
    const originalSetTimeout = global.setTimeout
    let scheduled = false
    global.setTimeout = (fn, ms) => {
        scheduled = true
        // call immediately for test speed
        originalSetTimeout(fn, 0)
    }

    try {
        t.replaceBufferedStderr('mapped after retry')
        expect(scheduled).toBeTruthy()
    } finally {
        global.setTimeout = originalSetTimeout
        host.__ssg_mapping_in_progress = false
    }
})

test('terminal works with fake host (no DOM)', async () => {
    const mod = await import('../terminal.js')
    const { createTerminal } = mod

    // Fake host without a document
    const host = {}
    const t = createTerminal(host)

    // These should not throw even though there's no DOM
    expect(() => t.appendTerminal('ok')).not.toThrow()
    expect(() => t.enableStderrBuffering()).not.toThrow()
    expect(() => t.replaceBufferedStderr('x')).not.toThrow()
    expect(() => t.findOrCreatePromptLine('x')).not.toThrow()
})

test('fake-host stores stderr buffer and does not touch DOM', async () => {
    const mod = await import('../terminal.js')
    const { createTerminal } = mod

    const host = {}
    const t = createTerminal(host)

    // enable buffering should initialize host buffer
    t.enableStderrBuffering()
    expect(Array.isArray(host.__ssg_stderr_buffer)).toBeTruthy()

    // append stderr should populate host buffer
    t.appendTerminal('err1', 'stderr')
    expect(host.__ssg_stderr_buffer.length).toBeGreaterThanOrEqual(1)

    // replaceBufferedStderr should try to append mapped text but not throw
    expect(() => t.replaceBufferedStderr('mapped on host')).not.toThrow()
})
