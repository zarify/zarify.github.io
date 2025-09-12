// Shared test setup helpers for execution tests
export function ensureWindow() {
    global.window = global.window || {}
}

export function setupTerminalDOM(content = '') {
    ensureWindow()
    document.body.innerHTML = `<div id="terminal-output">${content}</div>`
    return document.getElementById('terminal-output')
}

export function setupCodeArea(code = '') {
    ensureWindow()
    document.body.innerHTML = `<textarea id="code">${code}</textarea><div id="terminal-output"></div>`
    return { codeEl: document.getElementById('code'), out: document.getElementById('terminal-output') }
}

export function clearLocalStorageMirror() {
    try { localStorage.removeItem('ssg_files_v1') } catch (_e) { }
}

export async function setRuntimeAdapter(adapter) {
    const mp = await import('../../micropython.js')
    if (typeof mp.setRuntimeAdapter === 'function') mp.setRuntimeAdapter(adapter)
    try { const gs = mp.getExecutionState(); Object.assign(gs, {}) } catch (_e) { }
}

export function setFileManager(fm) {
    ensureWindow()
    window.FileManager = fm
}

export function setMAIN_FILE(path) {
    ensureWindow()
    window.MAIN_FILE = path
}

export function ensureAppendTerminalDebug() {
    // noop: appendTerminal is provided by jest.setup.js
}
