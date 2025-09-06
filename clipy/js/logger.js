// Centralized logger with a single runtime switch.
// Use `window.__SSG_DEBUG = true` to enable debug/info logging.
// Warnings and errors are always emitted.
export function debug(...args) {
    try {
        if (typeof window !== 'undefined' && window.__SSG_DEBUG) {
            if (console && typeof console.debug === 'function') return console.debug(...args)
            if (console && typeof console.log === 'function') return console.log(...args)
        }
    } catch (_e) { }
}

export function info(...args) {
    try {
        if (typeof window !== 'undefined' && window.__SSG_DEBUG) {
            if (console && typeof console.info === 'function') return console.info(...args)
            if (console && typeof console.log === 'function') return console.log(...args)
        }
    } catch (_e) { }
}

export function warn(...args) {
    try {
        if (console && typeof console.warn === 'function') return console.warn(...args)
    } catch (_e) { }
}

export function error(...args) {
    try {
        if (console && typeof console.error === 'function') return console.error(...args)
    } catch (_e) { }
}

export function setDebug(v) {
    try { if (typeof window !== 'undefined') window.__SSG_DEBUG = !!v } catch (_e) { }
}

export default { debug, info, warn, error, setDebug }
