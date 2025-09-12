export function makeFakeStorage(initial = {}) {
    const storage = Object.assign({}, initial)
    Object.defineProperty(storage, 'getItem', { value: (k) => (storage[k] === undefined ? null : storage[k]), enumerable: false, configurable: true })
    Object.defineProperty(storage, 'setItem', { value: (k, v) => { storage[k] = v }, enumerable: false, configurable: true })
    Object.defineProperty(storage, 'removeItem', { value: (k) => { delete storage[k] }, enumerable: false, configurable: true })
    return storage
}

export function makeAlwaysQuotaStorage() {
    const storage = makeFakeStorage()
    Object.defineProperty(storage, 'setItem', { value: (k, v) => { const err = new Error('quota'); err.name = 'QuotaExceededError'; throw err }, enumerable: false })
    return storage
}

export function makeFlakyQuotaStorage() {
    const storage = makeFakeStorage()
    let first = true
    Object.defineProperty(storage, 'setItem', { value: (k, v) => { if (first && k === 'k') { first = false; const err = new Error('quota'); err.name = 'QuotaExceededError'; throw err } storage[k] = v }, enumerable: false })
    return storage
}

export async function makeMgr(storage, opts = {}) {
    const mod = await import('../../storage-manager.js')
    const createStorageManager = mod.createStorageManager
    return createStorageManager(Object.assign({ storage, appendTerminal: () => { }, appendTerminalDebug: () => { } }, opts))
}
