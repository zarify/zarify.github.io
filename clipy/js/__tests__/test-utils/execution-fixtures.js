// Small helpers to create fake runtime adapters and execution state for execution.test.js
export function makeFakeRuntimeAdapter({ asyncify = false, runResolveValue = '', runRejectError = null, hang = false } = {}) {
    const adapter = {}
    if (asyncify) {
        adapter.runPythonAsync = async (code) => {
            if (runRejectError) throw runRejectError
            if (hang) return new Promise(() => { })
            return runResolveValue
        }
    }
    adapter.run = async (code) => {
        if (runRejectError) throw runRejectError
        if (hang) return new Promise(() => { })
        return runResolveValue
    }
    adapter._module = { Asyncify: {} }
    adapter.clearInterrupt = () => { return true }
    return adapter
}

export function makeExecutionState() {
    return { isRunning: false, currentAbortController: null, timeoutId: null, safetyTimeoutId: null }
}
