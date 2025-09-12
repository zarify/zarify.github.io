// Tests for loadMicroPythonRuntime using an ESM mock for the vendored runtime
import { ensureAppendTerminalDebug, ensureWindow } from './test-utils/test-setup.js'

// Use the Jest ESM mock API to stub the vendor module before importing the module under test
beforeEach(() => {
    ensureWindow()
    ensureAppendTerminalDebug()
    delete window.__ssg_terminal_event_log
})

test('loadMicroPythonRuntime initializes runtime adapter from vendored module', async () => {
    // Prepare a fake mpInstance that the vendor loader will return
    const mpInstance = {
        FS: { writeFile: () => { }, readFile: () => { } },
        runPythonAsync: async (code) => 'ok:' + code,
        runPython: (code) => 'ok-sync:' + code,
        interruptExecution: () => { /* noop */ },
        setYielding: (v) => { /* noop */ },
        clearInterrupt: () => { /* noop */ },
        registerJsModule: (name, mod) => { /* noop */ }
    }

    // Provide global loadMicroPython so the module's vendor import path picks it up
    globalThis.loadMicroPython = async (opts) => mpInstance

    // Temporarily replace the real vendor module with a tiny stub so dynamic import('../vendor/micropython.mjs') does not throw.
    // The stub will read the test-supplied mpInstance from globalThis.__TEST_MP.
    globalThis.__TEST_MP = mpInstance
    const p = new URL('../../vendor/micropython.mjs', import.meta.url).pathname
    const fsp = await import('fs/promises')
    const orig = await fsp.readFile(p, 'utf8')
    try {
        const stub = `// test stub module\nglobalThis.loadMicroPython = async (opts) => globalThis.__TEST_MP\nexport {}`
        await fsp.writeFile(p, stub, 'utf8')

        // Now import the module under test and call loadMicroPythonRuntime
        const mod = await import('../micropython.js')
        const { loadMicroPythonRuntime, getRuntimeAdapter } = mod

        const adapter = await loadMicroPythonRuntime({ runtime: { wasm: './vendor/micropython.wasm' } })

        // Expect an adapter object to be returned and registered
        const runtimeAdapter = getRuntimeAdapter()
        expect(runtimeAdapter).toBeTruthy()
        expect(runtimeAdapter._module).toBe(mpInstance)
        expect(typeof runtimeAdapter.runPythonAsync).toBe('function')
        expect(typeof runtimeAdapter.run).toBe('function')
        // hasYieldingSupport should be detected (we provided interrupt/setYielding/clearInterrupt)
        expect(runtimeAdapter.hasYieldingSupport).toBe(true)

        // Running code via adapter.runPythonAsync should call through to mpInstance
        const out = await runtimeAdapter.runPythonAsync('print(1)')
        expect(String(out)).toContain('ok')
    } finally {
        // restore original vendor module
        await fsp.writeFile(p, orig, 'utf8')
    }
})
