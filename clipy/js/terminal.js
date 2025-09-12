import { $ as _$ } from './utils.js'
import { debug as logDebug } from './logger.js'

// Create a test-friendly terminal module scoped to a host object
export function createTerminal(host = (typeof window !== 'undefined' ? window : globalThis)) {
    const doc = host.document || (typeof document !== 'undefined' ? document : null)
    const $ = (id) => {
        try {
            if (host && typeof host.$ === 'function') return host.$(id)
        } catch (_e) { }
        try { return (doc && doc.getElementById) ? doc.getElementById(id) : null } catch (_e) { return null }
    }

    // Track current prompt element for get_input handling
    let __ssg_current_prompt = null

    function clearTerminal() {
        try {
            const out = $('terminal-output')
            if (out) out.innerHTML = ''
        } catch (_e) { }
    }

    function setupClearTerminalButton() {
        try {
            const btn = $('clear-terminal')
            if (btn && typeof btn.addEventListener === 'function') {
                btn.addEventListener('click', clearTerminal)
            }
        } catch (_e) { }
    }

    // Append a line to the terminal output.
    function appendTerminal(text, kind = 'stdout') {
        try {
            const out = $('terminal-output')
            if (!out) return

            const raw = (text === null || text === undefined) ? '' : String(text)

            try {
                const buffering = Boolean(host.__ssg_stderr_buffering)
                if (kind === 'stderr' && buffering) {
                    host.__ssg_stderr_buffer = host.__ssg_stderr_buffer || []
                    host.__ssg_stderr_buffer.push(raw)
                    try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'buffered', kind, text: raw.slice(0, 200) }) } catch (_e) { }
                    return
                }

                if (kind === 'stdout' && buffering) {
                    if (/Traceback|File \"<stdin>\"|File \"<string>\"/i.test(raw)) {
                        host.__ssg_stderr_buffer = host.__ssg_stderr_buffer || []
                        host.__ssg_stderr_buffer.push(raw)
                        return
                    }
                }

                if (kind === 'stderr' || kind === 'stdout') {
                    try {
                        if (host.__ssg_mapping_in_progress) {
                            if (raw.includes('<stdin>') || raw.includes('<string>')) {
                                host.__ssg_stderr_buffer = host.__ssg_stderr_buffer || []
                                host.__ssg_stderr_buffer.push(raw)
                                appendTerminalDebug('[suppressed-during-mapping-buffered]', raw)
                                try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'suppressed_during_mapping_buffered', kind, text: raw.slice(0, 200) }) } catch (_e) { }
                                return
                            }
                        }
                        const until = Number(host.__ssg_suppress_raw_stderr_until || 0)
                        if (until && Date.now() < until) {
                            if (raw.includes('<stdin>') || raw.includes('<string>')) {
                                host.__ssg_stderr_buffer = host.__ssg_stderr_buffer || []
                                host.__ssg_stderr_buffer.push(raw)
                                appendTerminalDebug('[suppressed-late-buffered]', raw)
                                try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'suppressed', kind, text: raw.slice(0, 200) }) } catch (_e) { }
                                return
                            }
                        }
                    } catch (_e) { }
                }
            } catch (_e) { }

            const div = (doc && doc.createElement) ? doc.createElement('div') : null
            if (!div) return
            const kindClass = 'term-' + (kind || 'stdout')
            div.className = 'terminal-line ' + kindClass
            div.textContent = raw
            out.appendChild(div)
            out.scrollTop = out.scrollHeight
            try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'append', kind, text: raw.slice(0, 200) }) } catch (_e) { }
        } catch (_e) { }
    }

    function appendTerminalDebug(...args) {
        try {
            if (!host.__ssg_debug_logs && !host.__SSG_DEBUG) return
            try { logDebug(...args) } catch (_e) { }
            const out = $('terminal-output')
            if (!out) return
            const div = (doc && doc.createElement) ? doc.createElement('div') : null
            if (!div) return
            div.className = 'terminal-line term-debug'
            const prefix = (typeof host !== 'undefined' && host.__SSG_DEBUG) ? '[debug] ' : ''
            div.textContent = prefix + args.map(a => {
                try { return typeof a === 'string' ? a : JSON.stringify(a) } catch (_e) { return String(a) }
            }).join(' ')
            out.appendChild(div)
            out.scrollTop = out.scrollHeight
        } catch (_e) { }
    }

    // Initialize debug flag default
    try { host.__ssg_debug_logs = host.__ssg_debug_logs || false } catch (_e) { }

    // Ensure suppression flag exists early
    try {
        if (typeof host !== 'undefined' && typeof host.__ssg_suppress_terminal_autoswitch === 'undefined') {
            host.__ssg_suppress_terminal_autoswitch = true
        }
    } catch (_e) { }

    // Prevent early focus while suppression is active
    try {
        if (doc && doc.addEventListener && host) {
            doc.addEventListener('focusin', (ev) => {
                try {
                    const suppressed = Boolean(host.__ssg_suppress_terminal_autoswitch)
                    if (!suppressed) return
                    const tgt = ev.target
                    if (!tgt || !tgt.id) return
                    if (tgt.id === 'terminal-output' || tgt.id === 'stdin-box') {
                        try { tgt.blur && tgt.blur() } catch (_e) { }
                        try { doc.body && doc.body.focus && doc.body.focus() } catch (_e) { }
                        ev.stopImmediatePropagation()
                        ev.preventDefault()
                    }
                } catch (_e) { }
            }, true)
        }
    } catch (_e) { }

    function enableStderrBuffering() {
        try {
            host.__ssg_stderr_buffering = true
            host.__ssg_stderr_buffer = []
            try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'enableStderrBuffering' }) } catch (_e) { }
        } catch (_e) { }
    }

    function replaceBufferedStderr(mappedText) {
        try {
            const buf = host.__ssg_stderr_buffer || []
            try {
                if ((!buf || buf.length === 0) && host.__ssg_mapping_in_progress) {
                    try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'replaceBufferedStderr_retry_scheduled', buf_len: buf.length }) } catch (_e) { }
                    setTimeout(() => { try { replaceBufferedStderr(mappedText) } catch (_e) { } }, 60)
                    return
                }
            } catch (_e) { }

            host.__ssg_stderr_buffering = false
            host.__ssg_stderr_buffer = []
            try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'replaceBufferedStderr', buf_len: buf.length, sample: buf.slice(0, 4), mappedPreview: (typeof mappedText === 'string') ? mappedText.slice(0, 200) : null }) } catch (_e) { }

            if ((!mappedText || typeof mappedText !== 'string')) {
                try {
                    if (typeof host.__ssg_last_mapped === 'string' && host.__ssg_last_mapped) {
                        try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'replaceBufferedStderr_fallback_to_last_mapped', lastMappedPreview: host.__ssg_last_mapped.slice(0, 200) }) } catch (_e) { }
                        mappedText = host.__ssg_last_mapped
                    }
                } catch (_e) { }
            }

            if ((!mappedText || typeof mappedText !== 'string') && Array.isArray(buf) && buf.length) {
                try {
                    const joined = buf.join('\n')
                    const guessed = joined.replace(/File\s+["'](?:<stdin>|<string>)["']\s*,\s*line\s+(\d+)/g, 'File "\/main.py", line $1')
                    mappedText = guessed
                    try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'replaceBufferedStderr_fallback_guessed', sample: joined.slice(0, 200), guessedPreview: mappedText.slice(0, 200) }) } catch (_e) { }
                } catch (_e) { }
            }

            if (mappedText && typeof mappedText === 'string') {
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

                try { host.__ssg_suppress_raw_stderr_until = Date.now() + 2000 } catch (_e) { }
                try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'suppress_set', until: host.__ssg_suppress_raw_stderr_until }) } catch (_e) { }
                try { host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'about_to_append_mapped', mappedPreview: (typeof mappedText === 'string') ? mappedText.slice(0, 200) : null }) } catch (_e) { }
                try {
                    const prevMapping = !!host.__ssg_mapping_in_progress
                    try { host.__ssg_mapping_in_progress = false } catch (_e) { }
                    appendTerminal(mappedText, 'stderr')
                    try { host.__ssg_mapping_in_progress = prevMapping } catch (_e) { }
                } catch (_e) { appendTerminal(mappedText, 'stderr') }
                appendTerminalDebug && appendTerminalDebug('[replaced buffered stderr with mapped traceback]')

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
                    setTimeout(cleanup, 0)
                    setTimeout(cleanup, 50)
                    setTimeout(cleanup, 150)
                    setTimeout(cleanup, 300)
                    setTimeout(cleanup, 600)
                } catch (_e) { }
                return
            }

            for (const block of buf) {
                try { appendTerminal(block, 'stderr') } catch (_e) { }
            }
        } catch (_e) { }
    }

    function flushStderrBufferRaw() { try { replaceBufferedStderr(null) } catch (_e) { } }

    function findPromptLine(promptText) {
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
                        try {
                            const nodesToRemove = children.slice(start, end + 1)
                            const div = (doc && doc.createElement) ? doc.createElement('div') : null
                            if (!div) return null
                            div.className = 'terminal-line term-prompt'
                            for (let k = 0; k < acc.length; k++) {
                                const pspan = doc.createElement('span')
                                pspan.className = 'prompt-text'
                                pspan.textContent = acc[k]
                                div.appendChild(pspan)
                                if (k < acc.length - 1) div.appendChild(doc.createElement('br'))
                            }
                            const inputSpan = doc.createElement('span')
                            inputSpan.className = 'prompt-input'
                            div.appendChild(inputSpan)
                            const firstNode = nodesToRemove[0]
                            out.insertBefore(div, firstNode)
                            for (const n of nodesToRemove) { try { out.removeChild(n) } catch (_e) { } }
                            out.scrollTop = out.scrollHeight
                            return div
                        } catch (_e) { return null }
                    }
                }
            }

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
                            const promptSpan = doc.createElement('span')
                            promptSpan.className = 'prompt-text'
                            promptSpan.textContent = existing
                            if (el.firstChild) el.insertBefore(promptSpan, el.firstChild)
                            else el.appendChild(promptSpan)
                        } catch (_e) { }
                    }
                    if (!el.querySelector('.prompt-input')) {
                        const span = doc.createElement('span')
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

    function findOrCreatePromptLine(promptText) {
        try {
            const out = $('terminal-output')
            if (!out) return null
            const children = Array.from(out.querySelectorAll('.terminal-line'))
            const wantedRaw = (promptText || '')
            const wanted = wantedRaw.trim()
            if (wanted) {
                const MAX_LOOKBACK = 12
                for (let end = children.length - 1; end >= 0; end--) {
                    let acc = []
                    for (let start = end; start >= Math.max(0, end - MAX_LOOKBACK); start--) {
                        acc.unshift((children[start].textContent || ''))
                        const joined = acc.join('\n').trim()
                        if (joined === wanted || joined.endsWith(wanted)) {
                            try {
                                const nodesToRemove = children.slice(start, end + 1)
                                const div = doc.createElement('div')
                                div.className = 'terminal-line term-prompt'
                                for (let k = 0; k < acc.length; k++) {
                                    const pspan = doc.createElement('span')
                                    pspan.className = 'prompt-text'
                                    pspan.textContent = acc[k]
                                    div.appendChild(pspan)
                                    if (k < acc.length - 1) div.appendChild(doc.createElement('br'))
                                }
                                const inputSpan = doc.createElement('span')
                                inputSpan.className = 'prompt-input'
                                div.appendChild(inputSpan)
                                const firstNode = nodesToRemove[0]
                                out.insertBefore(div, firstNode)
                                for (const n of nodesToRemove) { try { out.removeChild(n) } catch (_e) { } }
                                out.scrollTop = out.scrollHeight
                                return div
                            } catch (_e) { }
                        }
                    }
                }

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
                                const promptSpan = doc.createElement('span')
                                promptSpan.className = 'prompt-text'
                                promptSpan.textContent = existing
                                if (el.firstChild) el.insertBefore(promptSpan, el.firstChild)
                                else el.appendChild(promptSpan)
                            } catch (_e) { }
                        }
                        if (!el.querySelector('.prompt-input')) {
                            const span = doc.createElement('span')
                            span.className = 'prompt-input'
                            el.appendChild(span)
                        }
                        try { el.classList.add('term-prompt') } catch (_e) { }
                        return el
                    }
                }
            }

            const div = doc.createElement('div')
            div.className = 'terminal-line term-prompt'
            const promptSpan = doc.createElement('span')
            promptSpan.className = 'prompt-text'
            promptSpan.textContent = promptText || ''
            const inputSpan = doc.createElement('span')
            inputSpan.className = 'prompt-input'
            div.appendChild(promptSpan)
            div.appendChild(inputSpan)
            out.appendChild(div)
            out.scrollTop = out.scrollHeight
            return div
        } catch (e) { return null }
    }

    function setTerminalInputEnabled(enabled, promptText) {
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

    function initializeTerminal() {
        try {
            const p = $('stdin-box')
            if (p && !p.getAttribute('data-default-placeholder')) {
                p.setAttribute('data-default-placeholder', p.placeholder || '')
            }
        } catch (_e) { }
        try { setTerminalInputEnabled(false) } catch (_e) { }
    }

    function activateSideTab(name) {
        try {
            const instrBtn = $('tab-btn-instructions')
            const termBtn = $('tab-btn-terminal')
            const fbBtn = $('tab-btn-feedback')
            const instrPanel = $('instructions')
            const termPanel = $('terminal')
            const fbPanel = $('fdbk') || $('feedback')

            if (name === 'terminal') {
                try { instrBtn && instrBtn.setAttribute('aria-selected', 'false') } catch (_e) { }
                try { termBtn && termBtn.setAttribute('aria-selected', 'true') } catch (_e) { }
                try { instrPanel && (instrPanel.style.display = 'none') } catch (_e) { }
                try { termPanel && (termPanel.style.display = 'block') } catch (_e) { }
                try { fbBtn && fbBtn.setAttribute('aria-selected', 'false') } catch (_e) { }
                try { fbPanel && (fbPanel.style.display = 'none') } catch (_e) { }
                try {
                    if (!host.__ssg_suppress_terminal_autoswitch) {
                        termPanel.querySelector('#terminal-output')?.focus()
                    }
                } catch (_e) { }
            } else if (name === 'feedback' || name === 'fdbk') {
                try { instrBtn && instrBtn.setAttribute('aria-selected', 'false') } catch (_e) { }
                try { termBtn && termBtn.setAttribute('aria-selected', 'false') } catch (_e) { }
                try { fbBtn && fbBtn.setAttribute('aria-selected', 'true') } catch (_e) { }
                try { instrPanel && (instrPanel.style.display = 'none') } catch (_e) { }
                try { termPanel && (termPanel.style.display = 'none') } catch (_e) { }
                try { fbPanel && (fbPanel.style.display = 'block') } catch (_e) { }
                try { if (fbBtn && fbBtn.classList) fbBtn.classList.remove('has-new-feedback') } catch (_e) { }
            } else {
                try { instrBtn && instrBtn.setAttribute('aria-selected', 'true') } catch (_e) { }
                try { termBtn && termBtn.setAttribute('aria-selected', 'false') } catch (_e) { }
                try { fbBtn && fbBtn.setAttribute('aria-selected', 'false') } catch (_e) { }
                try { instrPanel && (instrPanel.style.display = 'block') } catch (_e) { }
                try { termPanel && (termPanel.style.display = 'none') } catch (_e) { }
                try { fbPanel && (fbPanel.style.display = 'none') } catch (_e) { }
            }
        } catch (_e) { }
    }

    function setupSideTabs() {
        try {
            const instrBtn = $('tab-btn-instructions')
            const termBtn = $('tab-btn-terminal')
            const fbBtn = $('tab-btn-feedback')
            if (instrBtn) {
                instrBtn.addEventListener('click', () => activateSideTab('instructions'))
                instrBtn.addEventListener('pointerdown', () => activateSideTab('instructions'), { passive: true })
            }
            if (termBtn) {
                termBtn.addEventListener('click', () => activateSideTab('terminal'))
                termBtn.addEventListener('pointerdown', () => activateSideTab('terminal'), { passive: true })
            }
            if (fbBtn) {
                fbBtn.addEventListener('click', () => activateSideTab('feedback'))
                fbBtn.addEventListener('pointerdown', () => activateSideTab('feedback'), { passive: true })
            }
            activateSideTab('instructions')
        } catch (_e) { }
    }

    return {
        clearTerminal,
        setupClearTerminalButton,
        appendTerminal,
        appendTerminalDebug,
        enableStderrBuffering,
        replaceBufferedStderr,
        flushStderrBufferRaw,
        findPromptLine,
        findOrCreatePromptLine,
        setTerminalInputEnabled,
        initializeTerminal,
        activateSideTab,
        setupSideTabs
    }
}

// Backwards-compatible default instance bound to the global window
const _defaultTerminal = createTerminal(typeof window !== 'undefined' ? window : globalThis)

export const clearTerminal = (...args) => _defaultTerminal.clearTerminal(...args)
export const setupClearTerminalButton = (...args) => _defaultTerminal.setupClearTerminalButton(...args)
export const appendTerminal = (...args) => _defaultTerminal.appendTerminal(...args)
export const appendTerminalDebug = (...args) => _defaultTerminal.appendTerminalDebug(...args)
export const enableStderrBuffering = (...args) => _defaultTerminal.enableStderrBuffering(...args)
export const replaceBufferedStderr = (...args) => _defaultTerminal.replaceBufferedStderr(...args)
export const flushStderrBufferRaw = (...args) => _defaultTerminal.flushStderrBufferRaw(...args)
export const findPromptLine = (...args) => _defaultTerminal.findPromptLine(...args)
export const findOrCreatePromptLine = (...args) => _defaultTerminal.findOrCreatePromptLine(...args)
export const setTerminalInputEnabled = (...args) => _defaultTerminal.setTerminalInputEnabled(...args)
export const initializeTerminal = (...args) => _defaultTerminal.initializeTerminal(...args)
export const activateSideTab = (...args) => _defaultTerminal.activateSideTab(...args)
export const setupSideTabs = (...args) => _defaultTerminal.setupSideTabs(...args)
