import { setupTerminalDOM, setupCodeArea, clearLocalStorageMirror, setRuntimeAdapter, setFileManager, setMAIN_FILE, ensureAppendTerminalDebug } from './test-utils/test-setup.js'

test('executeWithTimeout resolves and times out appropriately', async () => {
    const mod = await import('../execution.js')
    const { executeWithTimeout } = mod

    // quick-resolving promise
    const p1 = Promise.resolve('ok')
    const r1 = await executeWithTimeout(p1, 1000, 500)
    expect(r1).toBe('ok')

    // hanging promise should timeout
    let hung = true
    const p2 = new Promise(() => { /* never resolves */ })
    await expect(executeWithTimeout(p2, 50, 20)).rejects.toThrow(/Execution timeout|Safety timeout|cancelled by user|Execution was cancelled/)
})

test('runPythonCode syncs MAIN_FILE into localStorage when no backend present', async () => {
    const { makeFakeRuntimeAdapter, makeExecutionState } = await import('./test-utils/execution-fixtures.js')
    clearLocalStorageMirror()
    setupCodeArea('print(42)')
    await setRuntimeAdapter(makeFakeRuntimeAdapter({ asyncify: true, runResolveValue: 'ok' }))

    const executionModule = await import('../execution.js')
    await executionModule.runPythonCode('print(1)', {})

    const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}')
    expect(map['/main.py']).toBeDefined()
})

test('safety timeout attempts VM interrupt and aborts if interrupt fails', async () => {
    const adapter = { run: async () => new Promise(() => { }), _module: {} }
    await setRuntimeAdapter(adapter)
    setupTerminalDOM()
    const ex = await import('../execution.js')
    await ex.runPythonCode('print(1)', { execution: { timeoutSeconds: 10, safetyTimeoutSeconds: 0.01 } })
    const out = document.getElementById('terminal-output')
    const text = out ? out.textContent || '' : ''
    expect(text).toMatch(/Safety timeout reached|attempting VM interrupt|forcing abort|VM interrupt failed/i)
})

test('safety timeout uses VM interrupt when available', async () => {
    const adapter = { run: async () => new Promise(() => { }), hasYieldingSupport: true, interruptExecution: () => true }
    await setRuntimeAdapter(adapter)
    setupTerminalDOM()
    const ex = await import('../execution.js')
    await ex.runPythonCode('print(1)', { execution: { timeoutSeconds: 10, safetyTimeoutSeconds: 0.01 } })
    const out = document.getElementById('terminal-output')
    const text = out ? out.textContent || '' : ''
    expect(text).toMatch(/attempting VM interrupt|KeyboardInterrupt|Safety timeout/i)
})

test('mapTracebackAndShow + replaceBufferedStderr produce mapped traceback output', async () => {
    setupTerminalDOM()
    setMAIN_FILE('/main.py')
    localStorage.setItem('ssg_files_v1', JSON.stringify({ '/main.py': 'print(1)' }))
    window.__ssg_stderr_buffering = true
    window.__ssg_stderr_buffer = [
        'Traceback (most recent call last):',
        '  File "<stdin>", line 3, in <module>',
        'NameError: name "x" is not defined'
    ]
    ensureAppendTerminalDebug()
    const { mapTracebackAndShow } = await import('../code-transform.js')
    const mapped = mapTracebackAndShow(window.__ssg_stderr_buffer.join('\n'), 2, window.MAIN_FILE)
    try { window.__ssg_last_mapped = mapped } catch (_e) { }
    const term = await import('../terminal.js')
    term.replaceBufferedStderr(mapped)
    const out = document.getElementById('terminal-output')
    const text = out ? out.textContent || '' : ''
    expect(text).toMatch(/File "\/main.py", line/) // mapped filename
    expect(typeof mapped === 'string' && mapped.length > 0).toBeTruthy()
})

test('asyncify recovery: successful recovery path clears state', async () => {
    setupTerminalDOM()
    const adapter = {
        runPythonAsync: async () => { throw new Error('async operation in flight') },
        clearInterrupt: () => { /* succeed */ },
        _module: {
            Asyncify: { currData: 1, state: 1 },
            ccall: (name) => { /* pretend to reinit */ }
        }
    }
    await setRuntimeAdapter(adapter)
    const ex = await import('../execution.js')
    await ex.runPythonCode('print(1)', { execution: { timeoutSeconds: 5, safetyTimeoutSeconds: 2 } })
    const out = document.getElementById('terminal-output')
    const text = out ? out.textContent || '' : ''
    expect(text).toMatch(/Runtime state cleared successfully|Runtime state cleared/i)
})

test('asyncify recovery: failure path logs automatic recovery failed', async () => {
    setupTerminalDOM()
    const adapter = { runPythonAsync: async () => { throw new Error('async operation in flight') }, _module: {} }
    await setRuntimeAdapter(adapter)
    const ex = await import('../execution.js')
    await ex.runPythonCode('print(1)', { execution: { timeoutSeconds: 5, safetyTimeoutSeconds: 2 } })
    const out = document.getElementById('terminal-output')
    const text = out ? out.textContent || '' : ''
    expect(text).toMatch(/Automatic recovery failed|Automatic recovery failed/i)
})

test('input probe fallback: runtime without async runner triggers friendly error', async () => {
    setupTerminalDOM()
    const adapter = { run: async (code) => { if (typeof code === 'string' && code.trim().startsWith('async def __ssg_probe')) { throw new Error('invalid syntax') } return '' } }
    await setRuntimeAdapter(adapter)
    const ex = await import('../execution.js')
    await ex.runPythonCode('x = input()\nprint(x)', { execution: { timeoutSeconds: 5, safetyTimeoutSeconds: 2 } })
    const out = document.getElementById('terminal-output')
    const text = out ? out.textContent || '' : ''
    expect(text).toMatch(/This runtime does not support async input handling|Consider using an asyncify-enabled MicroPython runtime/)
})

test('feedback evaluation is called with run captures', async () => {
    setupTerminalDOM('OUTPUT')
    const adapter = { run: async () => '' }
    await setRuntimeAdapter(adapter)
    setFileManager({ list: () => ['/main.py'] })
    window.Feedback = { evaluateFeedbackOnRun: (payload) => { window.__ssg_feedback_payload = payload } }
    const ex = await import('../execution.js')
    await ex.runPythonCode('print(1)', { execution: { timeoutSeconds: 5, safetyTimeoutSeconds: 2 } })
    expect(window.__ssg_feedback_payload).toBeDefined()
    expect(typeof window.__ssg_feedback_payload.stdout === 'string').toBeTruthy()
    expect(Array.isArray(window.__ssg_feedback_payload.filename)).toBeTruthy()
})
