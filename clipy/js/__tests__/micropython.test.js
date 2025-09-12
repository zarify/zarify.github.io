import { ensureAppendTerminalDebug, ensureWindow } from './test-utils/test-setup.js'

beforeEach(() => {
    ensureWindow()
    ensureAppendTerminalDebug()
    // reset any globals
    delete window.runtimeAdapter
    delete window.__ssg_pending_input
    delete window.__ssg_yielding_enabled
})

test('set/get runtime adapter and interrupt behavior (asyncify)', async () => {
    const mod = await import('../micropython.js')
    const { setRuntimeAdapter, getRuntimeAdapter, interruptMicroPythonVM, setupMicroPythonAPI, getExecutionState } = mod

    // Create asyncify-like adapter
    const calls = []
    const adapter = {
        hasYieldingSupport: true,
        interruptExecution: () => { calls.push('interruptExecution') },
        setYielding: (v) => { calls.push('setYielding:' + v) },
        clearInterrupt: () => { calls.push('clearInterrupt') },
        _module: { ccall: () => { calls.push('ccall') } }
    }

    setRuntimeAdapter(adapter)
    expect(getRuntimeAdapter()).toBe(adapter)

    // Setup global API
    setupMicroPythonAPI()

    // interruptMicroPythonVM should use interruptExecution and return true
    const res = interruptMicroPythonVM()
    expect(res).toBe(true)
    expect(calls).toContain('interruptExecution')

    // setMicroPythonYielding should enable/disable via adapter.setYielding
    const ok1 = window.setMicroPythonYielding(true)
    expect(ok1).toBe(true)
    expect(calls).toContain('setYielding:true')

    const ok2 = window.setMicroPythonYielding(false)
    expect(ok2).toBe(true)
    expect(calls).toContain('setYielding:false')

    // clearMicroPythonInterrupt should call adapter.clearInterrupt and attempt Asyncify reset
    // Provide Asyncify and ccall entries on module to test paths
    adapter._module.Asyncify = { currData: 1, state: 2 }
    const cleared = window.clearMicroPythonInterrupt()
    expect(cleared).toBe(true)
    expect(calls).toContain('clearInterrupt')
})

test('interruptMicroPythonVM falls back to legacy ccall when asyncify not present', async () => {
    const mod = await import('../micropython.js')
    const { setRuntimeAdapter, interruptMicroPythonVM, setupMicroPythonAPI } = mod

    const calls = []
    const legacyAdapter = {
        hasYieldingSupport: false,
        _module: { ccall: () => { calls.push('ccall') } }
    }

    setRuntimeAdapter(legacyAdapter)
    setupMicroPythonAPI()

    const res = interruptMicroPythonVM()
    expect(res).toBe(true)
    expect(calls).toContain('ccall')
})

test('interruptMicroPythonVM returns false with no adapter', async () => {
    const mod = await import('../micropython.js')
    const { setRuntimeAdapter, interruptMicroPythonVM } = mod

    setRuntimeAdapter(null)
    const res = interruptMicroPythonVM()
    expect(res).toBe(false)
})

test('getMicroPythonInterruptStatus reports availability and methods', async () => {
    const mod = await import('../micropython.js')
    const { setRuntimeAdapter, setupMicroPythonAPI } = mod

    const adapter = { hasYieldingSupport: true, _module: { ccall: () => { } } }
    setRuntimeAdapter(adapter)
    setupMicroPythonAPI()

    const status = window.getMicroPythonInterruptStatus()
    expect(status.runtimeLoaded).toBe(true)
    expect(status.hasYieldingSupport).toBe(true)
    expect(status.hasLegacyInterrupt).toBe(true)
    expect(Array.isArray(status.availableMethods)).toBe(true)
})
