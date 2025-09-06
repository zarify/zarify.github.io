// Clear all terminal output
export function clearTerminal() {
    try {
        const out = $('terminal-output')
        if (out) {
            out.innerHTML = ''
        }
    } catch (_e) { }
}
// Setup clear terminal button event listener
export function setupClearTerminalButton() {
    try {
        const btn = $('clear-terminal')
        if (btn) {
            btn.addEventListener('click', clearTerminal)
        }
    } catch (_e) { }
}
// Terminal output and UI management
import { $ } from './utils.js'

// Append a line to the terminal output.
// - text: string to append
// - kind: one of 'stdout'|'stderr'|'runtime'|'stdin'|'debug' (affects CSS class)
export function appendTerminal(text, kind = 'stdout') {
    try {
        const out = $('terminal-output')
        if (!out) return

        const raw = (text === null || text === undefined) ? '' : String(text)

        // If stderr buffering is active, capture stderr (and stdout-looking tracebacks)
        try {
            if (kind === 'stderr' && window.__ssg_stderr_buffering) {
                window.__ssg_stderr_buffer = window.__ssg_stderr_buffer || []
                window.__ssg_stderr_buffer.push(raw)
                try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'buffered', kind: kind, text: raw.slice(0, 200) }) } catch (_e) { }
                return
            }

            // Some runtimes write tracebacks to stdout; while buffering treat those as stderr
            if (kind === 'stdout' && window.__ssg_stderr_buffering) {
                if (/Traceback|File \"<stdin>\"|File \"<string>\"/i.test(raw)) {
                    window.__ssg_stderr_buffer = window.__ssg_stderr_buffer || []
                    window.__ssg_stderr_buffer.push(raw)
                    return
                }
            }

            // Suppress late-arriving raw stderr/stdout lines that reference <stdin>/<string>
            if (kind === 'stderr' || kind === 'stdout') {
                try {
                    // If mapping is actively in progress, suppress any raw lines referencing <stdin>/<string>
                    if (window.__ssg_mapping_in_progress) {
                        if (raw.includes('<stdin>') || raw.includes('<string>')) {
                            // Buffer the raw traceback so the mapping/replace flow can
                            // access it later. Previously these lines were suppressed
                            // (dropped) which could lose the content if replacement
                            // happened concurrently.
                            try {
                                window.__ssg_stderr_buffer = window.__ssg_stderr_buffer || []
                                window.__ssg_stderr_buffer.push(raw)
                                appendTerminalDebug && appendTerminalDebug('[suppressed-during-mapping-buffered]', raw)
                                try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'suppressed_during_mapping_buffered', kind: kind, text: raw.slice(0, 200) }) } catch (_e) { }
                            } catch (_e) { }
                            return
                        }
                    }
                    const until = Number(window.__ssg_suppress_raw_stderr_until || 0)
                    if (until && Date.now() < until) {
                        if (raw.includes('<stdin>') || raw.includes('<string>')) {
                            try {
                                window.__ssg_stderr_buffer = window.__ssg_stderr_buffer || []
                                window.__ssg_stderr_buffer.push(raw)
                                appendTerminalDebug && appendTerminalDebug('[suppressed-late-buffered]', raw)
                                try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'suppressed', kind: kind, text: raw.slice(0, 200) }) } catch (_e) { }
                            } catch (_e) { }
                            return
                        }
                    }
                } catch (_e) { }
            }
        } catch (_e) { }

        const div = document.createElement('div')
        const kindClass = 'term-' + (kind || 'stdout')
        div.className = 'terminal-line ' + kindClass
        div.textContent = raw
        out.appendChild(div)
        out.scrollTop = out.scrollHeight
        try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'append', kind: kind, text: raw.slice(0, 200) }) } catch (_e) { }
    } catch (_e) { }
}

// Lightweight debug appender that only logs when debug flag is enabled.
import { debug as logDebug } from './logger.js'

export function appendTerminalDebug(...args) {
    try {
        if (!window.__ssg_debug_logs && !window.__SSG_DEBUG) return
        try { logDebug(...args) } catch (_e) { }
        const out = $('terminal-output')
        if (!out) return
        const div = document.createElement('div')
        div.className = 'terminal-line term-debug'
        div.textContent = '[debug] ' + args.map(a => {
            try { return typeof a === 'string' ? a : JSON.stringify(a) } catch (_e) { return String(a) }
        }).join(' ')
        out.appendChild(div)
        out.scrollTop = out.scrollHeight
    } catch (_e) { }
}

// Debug-only logger: controlled by `window.__ssg_debug_logs` (default: false)
try { window.__ssg_debug_logs = window.__ssg_debug_logs || false } catch (_e) { }

// Ensure the global suppression flag exists as early as possible so that any
// code which runs before app initialization cannot cause the terminal to
// auto-switch or focus. The main initializer will explicitly clear this flag
// when startup completes.
try {
    if (typeof window !== 'undefined' && typeof window.__ssg_suppress_terminal_autoswitch === 'undefined') {
        window.__ssg_suppress_terminal_autoswitch = true
    }
} catch (_e) { }

// Prevent early focus on terminal elements while startup suppression is active.
// This uses a capture-phase focusin listener so it can intercept programmatic
// focus() calls from other modules before they take effect.
try {
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
        document.addEventListener('focusin', (ev) => {
            try {
                const suppressed = Boolean(window.__ssg_suppress_terminal_autoswitch)
                if (!suppressed) return
                const tgt = ev.target
                if (!tgt || !tgt.id) return
                if (tgt.id === 'terminal-output' || tgt.id === 'stdin-box') {
                    try { tgt.blur && tgt.blur() } catch (_e) { }
                    // Move focus to a safe element (body) to avoid focus landing on terminal
                    try { document.body && document.body.focus && document.body.focus() } catch (_e) { }
                    ev.stopImmediatePropagation()
                    ev.preventDefault()
                }
            } catch (_e) { }
        }, true)
    }
} catch (_e) { }

// Stderr buffering control APIs
export function enableStderrBuffering() {
    try {
        window.__ssg_stderr_buffering = true
        window.__ssg_stderr_buffer = []
        try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'enableStderrBuffering' }) } catch (_e) { }
    } catch (_e) { }
}

// Replace buffered stderr with a mapped traceback (preferred) or flush raw if null
export function replaceBufferedStderr(mappedText) {
    try {
        const buf = window.__ssg_stderr_buffer || []
        // If we're called too early (no buffered stderr yet) but mapping is
        // still in progress, there's a race where the runtime hasn't written
        // its stderr into the buffer yet. Wait a short moment and retry once.
        try {
            if ((!buf || buf.length === 0) && window.__ssg_mapping_in_progress) {
                try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'replaceBufferedStderr_retry_scheduled', buf_len: buf.length }) } catch (_e) { }
                setTimeout(() => {
                    try { replaceBufferedStderr(mappedText) } catch (_e) { }
                }, 60)
                return
            }
        } catch (_e) { }
        // Clear buffer flag first to allow direct appends
        window.__ssg_stderr_buffering = false
        window.__ssg_stderr_buffer = []

        try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'replaceBufferedStderr', buf_len: buf.length, sample: buf.slice(0, 4), mappedPreview: (typeof mappedText === 'string') ? mappedText.slice(0, 200) : null }) } catch (_e) { }

        // If caller didn't provide mappedText, fall back to last known mapped traceback
        if ((!mappedText || typeof mappedText !== 'string')) {
            try {
                if (typeof window.__ssg_last_mapped === 'string' && window.__ssg_last_mapped) {
                    try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'replaceBufferedStderr_fallback_to_last_mapped', lastMappedPreview: window.__ssg_last_mapped.slice(0, 200) }) } catch (_e) { }
                    mappedText = window.__ssg_last_mapped
                }
            } catch (_e) { }
        }

        // If still no mappedText, try a best-effort mapping from the buffered raw stderr
        if ((!mappedText || typeof mappedText !== 'string') && Array.isArray(buf) && buf.length) {
            try {
                const joined = buf.join('\n')
                // Replace runtime markers like <stdin> or <string> with the user main file
                const guessed = joined.replace(/File\s+["'](?:<stdin>|<string>)["']\s*,\s*line\s+(\d+)/g, 'File "\/main.py", line $1')
                mappedText = guessed
                try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'replaceBufferedStderr_fallback_guessed', sample: joined.slice(0, 200), guessedPreview: mappedText.slice(0, 200) }) } catch (_e) { }
            } catch (_e) { }
        }

        if (mappedText && typeof mappedText === 'string') {
            // Remove any previously-printed raw traceback lines that reference <stdin> or <string>
            try {
                const out = $('terminal-output')
                if (out && out.children && out.children.length) {
                    const nodes = Array.from(out.children)
                    for (const n of nodes) {
                        try {
                            const txt = (n.textContent || '')
                            if (txt.includes('<stdin>') || txt.includes('<string>')) {
                                out.removeChild(n)
                            }
                        } catch (_e) { }
                    }
                }
            } catch (_e) { }

            // Temporarily suppress any late-arriving raw runtime stderr/stdout lines that reference <stdin>/<string]
            try { window.__ssg_suppress_raw_stderr_until = Date.now() + 2000 } catch (_e) { }
            try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'suppress_set', until: window.__ssg_suppress_raw_stderr_until }) } catch (_e) { }
            // Append the mapped traceback as stderr (single source of truth)
            try { window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'about_to_append_mapped', mappedPreview: (typeof mappedText === 'string') ? mappedText.slice(0, 200) : null }) } catch (_e) { }
            // Ensure the mapped traceback is appended even if mapping suppression
            // is active. Some suppression logic in appendTerminal checks
            // `window.__ssg_mapping_in_progress` and will suppress any lines
            // referencing <stdin> or <string>. Temporarily clear that flag so
            // the mapped traceback is appended, then restore the previous
            // value.
            try {
                const prevMapping = !!window.__ssg_mapping_in_progress
                try { window.__ssg_mapping_in_progress = false } catch (_e) { }
                appendTerminal(mappedText, 'stderr')
                try { window.__ssg_mapping_in_progress = prevMapping } catch (_e) { }
            } catch (_e) {
                // Best-effort append
                appendTerminal(mappedText, 'stderr')
            }
            appendTerminalDebug && appendTerminalDebug('[replaced buffered stderr with mapped traceback]')

            // Schedule cleanup passes to remove any late nodes that slipped through
            try {
                const cleanup = () => {
                    try {
                        const out = $('terminal-output')
                        if (!out) return
                        const nodes = Array.from(out.children)
                        for (const n of nodes) {
                            try {
                                const txt = (n.textContent || '')
                                if (txt.includes('<stdin>') || txt.includes('<string>')) {
                                    out.removeChild(n)
                                }
                            } catch (_e) { }
                        }
                    } catch (_e) { }
                }
                // Multiple cleanup passes to handle late arrivals
                setTimeout(cleanup, 0)
                setTimeout(cleanup, 50)
                setTimeout(cleanup, 150)
                setTimeout(cleanup, 300)
                setTimeout(cleanup, 600)
            } catch (_e) { }
            return
        }

        // No mapped text: flush raw buffered lines
        for (const block of buf) {
            try { appendTerminal(block, 'stderr') } catch (_e) { }
        }
    } catch (_e) { }
}

// Force flush raw buffered stderr without replacement
export function flushStderrBufferRaw() {
    try {
        replaceBufferedStderr(null)
    } catch (_e) { }
}

// Track an active prompt line element when host.get_input is awaiting input
let __ssg_current_prompt = null

// Find and convert an existing printed prompt (single- or multi-line) into a structured prompt element.
export function findPromptLine(promptText) {
    try {
        const out = $('terminal-output')
        if (!out) return null
        const children = Array.from(out.querySelectorAll('.terminal-line'))
        const wantedRaw = (promptText || '')
        const wanted = wantedRaw.trim()
        if (!wanted) return null
        const MAX_LOOKBACK = 12

        for (let end = children.length - 1; end >= 0; end--) {
            let acc = []
            for (let start = end; start >= Math.max(0, end - MAX_LOOKBACK); start--) {
                acc.unshift((children[start].textContent || ''))
                const joined = acc.join('\n').trim()
                if (joined === wanted || joined.endsWith(wanted)) {
                    // Convert the sequence children[start..end] into a single structured prompt element
                    try {
                        const nodesToRemove = children.slice(start, end + 1)
                        const div = document.createElement('div')
                        div.className = 'terminal-line term-prompt'
                        for (let k = 0; k < acc.length; k++) {
                            const pspan = document.createElement('span')
                            pspan.className = 'prompt-text'
                            pspan.textContent = acc[k]
                            div.appendChild(pspan)
                            if (k < acc.length - 1) div.appendChild(document.createElement('br'))
                        }
                        const inputSpan = document.createElement('span')
                        inputSpan.className = 'prompt-input'
                        div.appendChild(inputSpan)
                        const firstNode = nodesToRemove[0]
                        out.insertBefore(div, firstNode)
                        for (const n of nodesToRemove) {
                            try { out.removeChild(n) } catch (_e) { }
                        }
                        out.scrollTop = out.scrollHeight
                        return div
                    } catch (_e) { return null }
                }
            }
        }

        // Single-line fallback
        for (let i = children.length - 1; i >= 0; i--) {
            const el = children[i]
            const rawText = (el.textContent || '')
            const txt = rawText.trim()
            if (!txt) continue
            if (txt === wanted || txt.endsWith(wanted)) {
                if (!el.querySelector('.prompt-text')) {
                    try {
                        const textNodes = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE)
                        const existing = textNodes.map(n => n.textContent).join('').trim() || wanted
                        for (const n of textNodes) try { n.parentNode && n.parentNode.removeChild(n) } catch (_e) { }
                        const promptSpan = document.createElement('span')
                        promptSpan.className = 'prompt-text'
                        promptSpan.textContent = existing
                        if (el.firstChild) el.insertBefore(promptSpan, el.firstChild)
                        else el.appendChild(promptSpan)
                    } catch (_e) { }
                }
                if (!el.querySelector('.prompt-input')) {
                    const span = document.createElement('span')
                    span.className = 'prompt-input'
                    el.appendChild(span)
                }
                try { el.classList.add('term-prompt') } catch (_e) { }
                return el
            }
        }
        return null
    } catch (e) { return null }
}

export function findOrCreatePromptLine(promptText) {
    try {
        const out = $('terminal-output')
        if (!out) return null

        // Try to find a recent line or contiguous set of lines that matches the prompt text
        const children = Array.from(out.querySelectorAll('.terminal-line'))
        const wantedRaw = (promptText || '')
        const wanted = wantedRaw.trim()

        if (wanted) {
            // Try multi-line match: look for a contiguous block of recent lines whose joined text equals the prompt
            const MAX_LOOKBACK = 12
            for (let end = children.length - 1; end >= 0; end--) {
                let acc = []
                for (let start = end; start >= Math.max(0, end - MAX_LOOKBACK); start--) {
                    acc.unshift((children[start].textContent || ''))
                    const joined = acc.join('\n').trim()
                    if (joined === wanted || joined.endsWith(wanted)) {
                        // Replace the sequence children[start..end] with a single structured prompt line.
                        try {
                            const nodesToRemove = children.slice(start, end + 1)
                            const div = document.createElement('div')
                            div.className = 'terminal-line term-prompt'
                            // For each line in acc, append a prompt-text span and a <br> except last line
                            for (let k = 0; k < acc.length; k++) {
                                const pspan = document.createElement('span')
                                pspan.className = 'prompt-text'
                                pspan.textContent = acc[k]
                                div.appendChild(pspan)
                                if (k < acc.length - 1) div.appendChild(document.createElement('br'))
                            }
                            const inputSpan = document.createElement('span')
                            inputSpan.className = 'prompt-input'
                            div.appendChild(inputSpan)
                            // Insert before the first matched node then remove matched nodes
                            const firstNode = nodesToRemove[0]
                            out.insertBefore(div, firstNode)
                            for (const n of nodesToRemove) {
                                try { out.removeChild(n) } catch (_e) { }
                            }
                            out.scrollTop = out.scrollHeight
                            return div
                        } catch (_e) { /* fallback to other strategies */ }
                    }
                }
            }

            // Single-line fallback: find a single terminal-line that ends with the prompt
            for (let i = children.length - 1; i >= 0; i--) {
                const el = children[i]
                const rawText = (el.textContent || '')
                const txt = rawText.trim()
                if (!txt) continue
                if (txt === wanted || txt.endsWith(wanted)) {
                    // Ensure there is a .prompt-text span (convert plain text nodes into prompt-text)
                    if (!el.querySelector('.prompt-text')) {
                        try {
                            const textNodes = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE)
                            const existing = textNodes.map(n => n.textContent).join('').trim() || wanted
                            for (const n of textNodes) try { n.parentNode && n.parentNode.removeChild(n) } catch (_e) { }
                            const promptSpan = document.createElement('span')
                            promptSpan.className = 'prompt-text'
                            promptSpan.textContent = existing
                            if (el.firstChild) el.insertBefore(promptSpan, el.firstChild)
                            else el.appendChild(promptSpan)
                        } catch (_e) { }
                    }
                    if (!el.querySelector('.prompt-input')) {
                        const span = document.createElement('span')
                        span.className = 'prompt-input'
                        el.appendChild(span)
                    }
                    try { el.classList.add('term-prompt') } catch (_e) { }
                    return el
                }
            }
        }

        // Not found: create a new prompt line
        const div = document.createElement('div')
        div.className = 'terminal-line term-prompt'
        const promptSpan = document.createElement('span')
        promptSpan.className = 'prompt-text'
        promptSpan.textContent = promptText || ''
        const inputSpan = document.createElement('span')
        inputSpan.className = 'prompt-input'
        div.appendChild(promptSpan)
        div.appendChild(inputSpan)
        out.appendChild(div)
        out.scrollTop = out.scrollHeight
        return div
    } catch (e) { return null }
}

// Enable/disable the inline terminal input prompt.
export function setTerminalInputEnabled(enabled, promptText) {
    try {
        const inpt = $('stdin-box')
        const send = $('stdin-send')
        const form = $('terminal-input-form')

        if (inpt) {
            inpt.disabled = !enabled
            if (enabled) {
                inpt.setAttribute('aria-disabled', 'false')
                inpt.placeholder = inpt.getAttribute('data-default-placeholder') || ''
            } else {
                inpt.setAttribute('aria-disabled', 'true')
                inpt.placeholder = inpt.getAttribute('data-default-placeholder') || ''
                try { __ssg_current_prompt = null } catch (_e) { }
            }
        }
        if (send) {
            send.disabled = !enabled
            if (enabled) send.setAttribute('aria-disabled', 'false')
            else send.setAttribute('aria-disabled', 'true')
        }
        if (form) {
            if (enabled) form.classList.remove('disabled')
            else form.classList.add('disabled')
        }
    } catch (_e) { }
}

// Initialize default placeholder
export function initializeTerminal() {
    try {
        const p = $('stdin-box')
        if (p && !p.getAttribute('data-default-placeholder')) {
            p.setAttribute('data-default-placeholder', p.placeholder || '')
        }
    } catch (_e) { }

    // Start with terminal input disabled until a runtime requests it
    try { setTerminalInputEnabled(false) } catch (_e) { }
}

// Side tab helpers: toggle between instructions and terminal
export function activateSideTab(name) {
    try {
        const instrBtn = $('tab-btn-instructions')
        const termBtn = $('tab-btn-terminal')
        const fbBtn = $('tab-btn-feedback')
        const instrPanel = $('instructions')
        const termPanel = $('terminal')
        const fbPanel = $('feedback')

        if (!instrBtn || !termBtn || !instrPanel || !termPanel) return

        if (name === 'terminal') {
            instrBtn.setAttribute('aria-selected', 'false')
            termBtn.setAttribute('aria-selected', 'true')
            instrPanel.style.display = 'none'
            termPanel.style.display = 'block'
            if (fbBtn) fbBtn.setAttribute('aria-selected', 'false')
            if (fbPanel) fbPanel.style.display = 'none'
            // Respect global suppression used during app initialization to
            // avoid stealing focus while the app is still booting.
            try {
                if (!window.__ssg_suppress_terminal_autoswitch) {
                    termPanel.querySelector('#terminal-output')?.focus()
                }
            } catch (_e) { }
        } else if (name === 'feedback') {
            // feedback tab
            try { instrBtn.setAttribute('aria-selected', 'false') } catch (_e) { }
            try { termBtn.setAttribute('aria-selected', 'false') } catch (_e) { }
            try { fbBtn.setAttribute('aria-selected', 'true') } catch (_e) { }
            try { instrPanel.style.display = 'none' } catch (_e) { }
            try { termPanel.style.display = 'none' } catch (_e) { }
            try { if (fbPanel) fbPanel.style.display = 'block' } catch (_e) { }
        } else {
            instrBtn.setAttribute('aria-selected', 'true')
            termBtn.setAttribute('aria-selected', 'false')
            if (fbBtn) fbBtn.setAttribute('aria-selected', 'false')
            instrPanel.style.display = 'block'
            termPanel.style.display = 'none'
            if (fbPanel) fbPanel.style.display = 'none'
        }
    } catch (_e) { }
}

export function setupSideTabs() {
    try {
        const instrBtn = $('tab-btn-instructions')
        const termBtn = $('tab-btn-terminal')
        const fbBtn = $('tab-btn-feedback')
        if (instrBtn) instrBtn.addEventListener('click', () => activateSideTab('instructions'))
        if (termBtn) termBtn.addEventListener('click', () => activateSideTab('terminal'))
        if (fbBtn) fbBtn.addEventListener('click', () => activateSideTab('feedback'))

        // Default to instructions tab (original behavior)
        activateSideTab('instructions')
    } catch (_e) { }
}
