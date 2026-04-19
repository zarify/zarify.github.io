// Core utilities and DOM helpers
export function $(id) {
    return document.getElementById(id)
}

/**
 * Normalize a filename for internal use (AST lookups, trace recording, etc.)
 * 
 * Rules:
 * 1. <stdin> → /main.py (MicroPython's interactive mode maps to main.py)
 * 2. Add leading / if missing (all internal paths use /filename format)
 * 3. Handle null/undefined safely
 * 
 * @param {string|null|undefined} filename - Raw filename from trace/event
 * @returns {string|null} Normalized filename or null if input was null/undefined
 */
export function normalizeFilename(filename) {
    if (!filename) {
        return filename  // null or undefined → pass through
    }

    // Special case: MicroPython's <stdin> maps to /main.py
    if (filename === '<stdin>') {
        return '/main.py'
    }

    // Ensure leading slash
    if (!filename.startsWith('/')) {
        return `/${filename}`
    }

    return filename
}

/**
 * Create a line key for AST/trace lookups
 * 
 * @param {string|null} filename - Filename (will be normalized)
 * @param {number} lineNumber - Line number (1-indexed)
 * @returns {string} Line key in format "/filename:lineNumber" or "lineNumber"
 */
export function makeLineKey(filename, lineNumber) {
    const normalized = normalizeFilename(filename)
    return normalized ? `${normalized}:${lineNumber}` : String(lineNumber)
}

export class DebounceTimer {
    constructor(delay = 300) {
        this.delay = delay
        this.timer = null
    }

    schedule(callback) {
        if (this.timer) clearTimeout(this.timer)
        this.timer = setTimeout(callback, this.delay)
    }

    cancel() {
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = null
        }
    }
}

export function normalizeIndentation(code) {
    // Convert tabs to 4 spaces and normalize leading whitespace
    return code.split('\n').map(line => {
        const match = line.match(/^([ \t]*)([\s\S]*)$/)
        const leading = (match && match[1]) || ''
        const rest = (match && match[2]) || ''

        // Convert leading tabs/spaces to spaces-only (tab = 4 spaces)
        let spaceCount = 0
        for (let i = 0; i < leading.length; i++) {
            spaceCount += (leading[i] === '\t') ? 4 : 1
        }
        return ' '.repeat(spaceCount) + rest
    }).join('\n')
}

export function transformWalrusPatterns(code) {
    // Support-lift simple walrus patterns where input() is used inside an
    // assignment expression in an `if` or `while` header.
    try {
        // Pattern with quoted prompt: if var := input("prompt"):
        code = code.replace(/^([ \t]*)(if|while)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*input\s*\(\s*(['\"])(.*?)\4\s*\)\s*:/gm,
            (m, indent, kw, vname, q, prompt) => {
                return `${indent}${vname} = input(${q}${prompt}${q})\n${indent}${kw} ${vname}:`
            })

        // Pattern without prompt string: if var := input():
        code = code.replace(/^([ \t]*)(if|while)\s+([A-Za-z_][A-Za-z0-9_]*)\s*:=\s*input\s*\(\s*\)\s*:/gm,
            (m, indent, kw, vname) => {
                return `${indent}${vname} = input()\n${indent}${kw} ${vname}:`
            })
    } catch (_e) { }

    return code
}

// Minimal, safe markdown renderer supporting code fences, inline code, bold, italic, links,
// and paragraph/line breaks. This intentionally keeps features small to reduce XSS surface.
export function renderMarkdown(md) {
    if (md == null) return ''
    // Prefer marked + DOMPurify when available on window (loaded via CDN in index.html).
    try {
        if (typeof window !== 'undefined' && window.marked && window.DOMPurify) {
            // If a vendored admonition extension is present, register it with marked.
            try {
                if (window.markedAdmonitionExtension && typeof window.marked.use === 'function') {
                    try {
                        // Avoid registering the extension multiple times (some pages
                        // auto-register on script load; we register here as a fallback).
                        if (!window.__marked_admonition_registered) {
                            const _ext = window.markedAdmonitionExtension()
                            if (_ext && Array.isArray(_ext.extensions)) {
                                // register the individual extension entries
                                window.marked.use(..._ext.extensions)
                            } else {
                                window.marked.use(_ext)
                            }
                            window.__marked_admonition_registered = true
                        }
                    } catch (_e) {
                        // ignore registration errors
                    }
                }
            } catch (_e) { /* ignore */ }

            // If highlight.js is present, configure marked to use it for code blocks.
            try {
                if (window.hljs && window.marked && typeof window.marked.setOptions === 'function') {
                    window.marked.setOptions({
                        highlight: function (code, lang) {
                            try {
                                if (lang && window.hljs.getLanguage(lang)) {
                                    return window.hljs.highlight(code, { language: lang }).value
                                }
                                return window.hljs.highlightAuto(code).value
                            } catch (_e) {
                                return code
                            }
                        }
                    })
                }
            } catch (_e) { /* ignore highlight configuration errors */ }

            // Use marked to compile markdown -> HTML, then sanitize via DOMPurify.
            const raw = String(md)
            const html = window.marked.parse(raw)
            return window.DOMPurify.sanitize(html)
        }
    } catch (_e) {
        // Fall back to internal renderer below
    }

    // --- Fallback minimal renderer (keeps previous behavior) ---
    let s = String(md)

    // Escape HTML first
    const escapeHtml = (str) => String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

    // Extract fenced code blocks and replace them with placeholders
    const codeBlocks = []
    s = s.replace(/```(?:([a-zA-Z0-9_-]+)\n)?([\s\S]*?)```/g, (m, lang, code) => {
        const idx = codeBlocks.length
        codeBlocks.push({ lang: lang || '', code })
        return `\u0000CODE_BLOCK_${idx}\u0000`
    })

    // Escape remaining content
    s = escapeHtml(s)

    // Links: [text](url)
    s = s.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, (m, text, url) => {
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${text}</a>`
    })

    // Bold **text**
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

    // Italic *text*
    s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')

    // Inline code `code`
    s = s.replace(/`([^`]+?)`/g, (m, code) => `<code>${escapeHtml(code)}</code>`)

    // Convert paragraphs: two or more newlines -> paragraph break
    const paras = s.split(/\n{2,}/g).map(p => p.replace(/\n/g, '<br>'))
    s = paras.map(p => `<p>${p}</p>`).join('\n')

    // Re-insert code blocks (they were not escaped earlier; escape now and preserve formatting)
    s = s.replace(/\u0000CODE_BLOCK_(\d+)\u0000/g, (m, idx) => {
        const cb = codeBlocks[Number(idx)]
        if (!cb) return ''
        const escaped = escapeHtml(cb.code)
        const langClass = cb.lang ? ` class="language-${escapeHtml(cb.lang)}"` : ''
        return `<pre><code${langClass}>${escaped}</code></pre>`
    })

    return s
}

/**
 * Sanitize an HTML fragment using DOMPurify when available, or fall
 * back to escaping angle brackets. This helper centralises sanitization
 * so other modules can call it when they need to insert HTML into the DOM.
 */
export function sanitizeHtml(html) {
    try {
        const raw = html == null ? '' : String(html)
        if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
            return window.DOMPurify.sanitize(raw)
        }
        // Fallback: escape angle brackets to avoid active HTML
        return String(raw).replace(/</g, '&lt;').replace(/>/g, '&gt;')
    } catch (_e) {
        try { return String(html == null ? '' : html).replace(/</g, '&lt;').replace(/>/g, '&gt;') } catch (_ee) { return '' }
    }
}

/**
 * Safely set an element's innerHTML using the central sanitizer. Falls back
 * to setting textContent if assignment fails.
 * @param {Element|null|undefined} el - DOM element to update
 * @param {string|null|undefined} html - Raw HTML fragment (will be sanitized)
 */
export function setInnerHTML(el, html) {
    if (!el) return
    try {
        // Use the shared sanitizer to keep behavior consistent across the app.
        // If DOMPurify is available, insert sanitized HTML. If not, fall back
        // to setting textContent so potentially dangerous HTML is not
        // interpreted by the DOM (tests expect this behavior when DOMPurify
        // isn't present in the test environment).
        if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
            el.innerHTML = sanitizeHtml(html)
        } else {
            // No DOMPurify available: attempt a DOM-based sanitization pass.
            // This parses the fragment, removes script elements and any
            // attributes starting with "on" (event handlers), and strips
            // javascript: URLs. If DOMParser is not available or parsing
            // fails, fall back to textContent to avoid injecting HTML.
            try {
                if (typeof DOMParser !== 'undefined') {
                    const dp = new DOMParser()
                    const doc = dp.parseFromString(String(html == null ? '' : html), 'text/html')
                    if (doc && doc.body) {
                        // Remove script elements
                        const scripts = Array.from(doc.body.querySelectorAll('script'))
                        for (const s of scripts) try { s.remove() } catch (_e) { }

                        // Remove event handler attributes and javascript: href/src
                        const elems = Array.from(doc.body.querySelectorAll('*'))
                        for (const elNode of elems) {
                            try {
                                const attrs = Array.from(elNode.attributes || [])
                                for (const a of attrs) {
                                    const name = String(a.name || '')
                                    const val = String(a.value || '')
                                    if (/^on/i.test(name)) {
                                        elNode.removeAttribute(name)
                                        continue
                                    }
                                    if (/^href$|^src$/i.test(name) && /javascript:/i.test(val)) {
                                        elNode.removeAttribute(name)
                                        continue
                                    }
                                }
                            } catch (_e) { }
                        }

                        // Insert sanitized HTML
                        el.innerHTML = doc.body.innerHTML
                        return
                    }
                }
            } catch (_e) { /* fall through to textContent fallback */ }

            // Fallback to textContent if parsing/sanitization failed
            el.textContent = String(html == null ? '' : html)
        }
    } catch (_e) {
        try { el.textContent = String(html == null ? '' : html) } catch (_ee) { }
    }
}
