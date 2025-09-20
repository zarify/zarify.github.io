// Simple analyzer registry to avoid relying on ad-hoc globals.
let registeredAnalyzer = null;

export function registerAnalyzer(fn) {
    try {
        registeredAnalyzer = fn;
        if (typeof window !== 'undefined') {
            // keep a small global pointer for legacy consumers
            window.__registeredAnalyzer = fn;
        }
    } catch (_e) { /* best-effort */ }
}

export function getRegisteredAnalyzer() {
    if (registeredAnalyzer) return registeredAnalyzer;
    try {
        if (typeof window !== 'undefined' && typeof window.__registeredAnalyzer === 'function') return window.__registeredAnalyzer;
    } catch (_e) { }
    return null;
}

// Expose registration helpers on window as well for maximum compatibility
try {
    if (typeof window !== 'undefined') {
        window.registerAnalyzer = registerAnalyzer;
        window.getRegisteredAnalyzer = getRegisteredAnalyzer;
    }
} catch (_e) { /* ignore */ }

export default { registerAnalyzer, getRegisteredAnalyzer }
