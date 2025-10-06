import { $ as _$ } from './utils.js'
import { debug as logDebug } from './logger.js'
import { mapTracebackAndShow } from './code-transform.js'

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

            const raw = (text === null || text === undefined) ? '' : String(text)

            // Record key host buffering/mapping flags in the terminal event log
            try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'append_called', kind, buffering: Boolean(host.__ssg_stderr_buffering), mappingInProgress: Boolean(host.__ssg_mapping_in_progress), suppressUntil: host.__ssg_suppress_raw_stderr_until || null, outExists: !!out }) } catch (_e) { }



            // If a caller has marked this append as a mapped traceback append,
            // bypass suppression and buffering so the mapped text is shown
            // atomically. This is used by replaceBufferedStderr to ensure the
            // mapped traceback replaces earlier raw marker lines.
            const isMappedAppend = Boolean(host.__ssg_appending_mapped)
            if (isMappedAppend) {
                try {
                    if (!out) return
                    // First run canonical sanitizer
                    let sanitized = _sanitizeForTerminal(raw)

                    // Additional defensive filtering: remove any residual JS/vendor
                    // stack-frame lines that may have slipped through the sanitizer
                    // (e.g. URL fragments, @http annotations, .js:line:col patterns).
                    try {
                        // Respect debug flag: if the host explicitly requests vendor
                        // frames be shown, do not strip them here.
                        let showVendor = false
                        try { showVendor = Boolean(host && host.__ssg_debug_show_vendor_frames) } catch (_e) { showVendor = false }
                        if (!showVendor) {
                            const jsLineRE = /@http|https?:\/\/|\.mjs\b|\.js:\d+|\/js\/|micropython\.js|node_modules\//i
                            const parts = String(sanitized || '').split('\n').map(l => l || '')
                            const kept = parts.filter(l => !jsLineRE.test(l))
                            if (kept.length === 0) {
                                sanitized = '[runtime frames hidden]'
                            } else {
                                sanitized = kept.join('\n')
                            }
                        }
                    } catch (_e) { /* best-effort */ }

                    const div = (doc && doc.createElement) ? doc.createElement('div') : null
                    if (!div) return
                    const kindClass = 'term-' + (kind || 'stdout')
                    div.className = 'terminal-line ' + kindClass
                    div.textContent = sanitized
                    out.appendChild(div)
                    // Publish canonical final stderr slot when we append stderr
                    try {
                        if (kind === 'stderr') {
                            host.__ssg_final_stderr = String(sanitized || '')
                            // If a per-run promise resolver exists, resolve it with the final value
                            try {
                                if (host.__ssg_final_stderr_resolve && typeof host.__ssg_final_stderr_resolve === 'function') {
                                    try { host.__ssg_final_stderr_resolve(host.__ssg_final_stderr) } catch (_e) { }
                                    // Clear resolver so it's one-shot
                                    try { delete host.__ssg_final_stderr_resolve } catch (_e) { }
                                    try { delete host.__ssg_final_stderr_promise } catch (_e) { }
                                }
                            } catch (_e) { }
                        }
                    } catch (_e) { }
                    out.scrollTop = out.scrollHeight
                    try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'append_mapped_bypass', kind, text: raw.slice(0, 200) }) } catch (_e) { }
                } catch (_e) { }
                return
            }

            // Local sanitizer: remove vendor/runtime stack frames from any
            // appended text unless debug flag is set on the host. This runs
            // after buffering decisions so mapping logic still sees raw
            // traceback text when needed.
            function _sanitizeForTerminal(t) {
                try {
                    if (!t) return t
                    try {
                        if (host && host.__ssg_debug_show_vendor_frames) return t
                    } catch (_e) { }

                    const text = String(t)

                    // If this looks like a Python traceback, strip everything
                    // that is not a Python traceback line (so JS frames like
                    // "runPythonAsync@...micropython.js:..." are removed).
                    if (/Traceback \(most recent call last\):/.test(text)) {
                        const lines = text.split('\n')
                        const keep = []
                        for (const line of lines) {
                            // Keep the traceback header and Python File lines
                            if (/^Traceback \(most recent call last\):/.test(line) || /^\s*File\s+\"/.test(line)) {
                                keep.push(line)
                                continue
                            }

                            // Keep the final exception message line (e.g. "NameError: ...")
                            if (/^[A-Za-z0-9_].*?:/.test(line) || /\bError\b|\bException\b/.test(line)) {
                                // Accept reasonably short exception message lines
                                if (line.trim().length < 1000) keep.push(line)
                                continue
                            }

                            // Otherwise drop JS/vendor frames or long noise lines
                        }
                        if (keep.length === 0) return '[runtime stack frames hidden]'
                        return keep.join('\n')
                    }

                    // Non-traceback text: perform generic filtering
                    const lines = text.split('\n')
                    const out = []
                    // Heuristics for JS-like frames to drop
                    const jsFrameRE = /@http|https?:\/\/|^\s*at\s+|\/js\/|\.mjs\b|node_modules\//i
                    for (const line of lines) {
                        // Preserve Python traceback structural lines just in case
                        if (/^\s*File\s+\"/.test(line) || /^Traceback \(most recent call last\):/.test(line)) {
                            out.push(line)
                            continue
                        }

                        // Drop known vendor/runtime frames or obvious runtime annotations
                        if (/vendor\/micropython\.mjs/.test(line) || /\/vendor\//.test(line) || /PythonError@/.test(line) || /proxy_convert_mp_to_js_obj_jsside/.test(line)) {
                            continue
                        }

                        // Drop JS-like stack frames, URLs, or script paths
                        if (jsFrameRE.test(line)) continue

                        // Drop lines that are full URLs pointing into vendor
                        if (/https?:\/\/.+\/vendor\//.test(line)) continue

                        // Keep short informative lines
                        if (line && line.length < 400) out.push(line)
                    }
                    if (out.length === 0) return '[runtime stack frames hidden]'
                    return out.join('\n')
                } catch (_e) { return t }
            }

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
                            // While a traceback mapping is in progress, buffer any
                            // stderr (and suspicious stdout) lines so late-arriving
                            // vendor JS frames do not get appended to the DOM.
                            try {
                                const looksLikeStack = /Traceback|^\s*File\s+\"|PythonError|proxy_convert_mp_to_js_obj_jsside|@http|\/vendor\//i
                                if (kind === 'stderr' || (kind === 'stdout' && looksLikeStack.test(raw))) {
                                    host.__ssg_stderr_buffer = host.__ssg_stderr_buffer || []
                                    host.__ssg_stderr_buffer.push(raw)
                                    appendTerminalDebug('[suppressed-during-mapping-buffered]', raw)
                                    try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'suppressed_during_mapping_buffered', kind, text: raw.slice(0, 200) }) } catch (_e) { }
                                    return
                                }
                            } catch (_e) { }
                        }
                        const until = Number(host.__ssg_suppress_raw_stderr_until || 0)
                        if (until && Date.now() < until) {
                            try {
                                const looksLikeStack = /Traceback|^\s*File\s+\"|PythonError|proxy_convert_mp_to_js_obj_jsside|@http|\/vendor\//i
                                if (looksLikeStack.test(raw) || kind === 'stderr') {
                                    host.__ssg_stderr_buffer = host.__ssg_stderr_buffer || []
                                    host.__ssg_stderr_buffer.push(raw)
                                    appendTerminalDebug('[suppressed-late-buffered]', raw)
                                    try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'suppressed', kind, text: raw.slice(0, 200) }) } catch (_e) { }
                                    return
                                }
                            } catch (_e) { }
                        }
                    } catch (_e) { }
                }
            } catch (_e) { }

            // Detect tracebacks that were appended directly (no buffering).
            // When we see a likely traceback and buffering/mapping are not
            // already active, enable buffering, stash the raw text, and 
            // asynchronously map+replace it so users see the mapped traceback
            // instead of raw runtime frames. Do this BEFORE DOM operations
            // so it works even in test environments without DOM elements.
            try {
                const looksLikeStack = /Traceback|<stdin>|<string>|^\s*File\s+\"/i
                const notBuffering = !host.__ssg_stderr_buffering
                const notMapping = !host.__ssg_mapping_in_progress
                if ((kind === 'stderr' || kind === 'stdout') && notBuffering && notMapping && looksLikeStack.test(raw)) {
                    try {
                        // Enable buffering and capture this raw line
                        host.__ssg_stderr_buffering = true
                        host.__ssg_stderr_buffer = host.__ssg_stderr_buffer || []
                        host.__ssg_stderr_buffer.push(raw)
                        try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'direct_append_buffered', kind, text: raw.slice(0, 200) }) } catch (_e) { }

                        // Mark mapping in progress and schedule mapping pass
                        host.__ssg_mapping_in_progress = true
                        setTimeout(() => {
                            try {
                                const joined = (Array.isArray(host.__ssg_stderr_buffer) ? host.__ssg_stderr_buffer.join('\n') : String(raw || ''))

                                // Get headerLines from the last execution context if available.
                                // The execution module stores this in __ssg_last_mapped_event.
                                let headerLines = 0
                                try {
                                    if (host.__ssg_last_mapped_event && typeof host.__ssg_last_mapped_event.headerLines === 'number') {
                                        headerLines = host.__ssg_last_mapped_event.headerLines
                                    }
                                } catch (_e) { headerLines = 0 }

                                // Debug: Log what headerLines we're using
                                try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'terminal_about_to_map', headerLines, lastMappedEvent: host.__ssg_last_mapped_event, joined: joined.slice(0, 200) }) } catch (_e) { }

                                let mapped = null
                                try {
                                    // Prefer a host-provided mapping function (useful for tests)
                                    const mapper = (host && typeof host.mapTracebackAndShow === 'function') ? host.mapTracebackAndShow : mapTracebackAndShow
                                    mapped = mapper(joined, headerLines, (host && host.MAIN_FILE) ? host.MAIN_FILE : '/main.py')
                                    try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'terminal_direct_mapping', headerLines, joined: joined.slice(0, 200), mapped: (mapped || '').slice(0, 200) }) } catch (_e) { }
                                } catch (_e) { mapped = null }
                                try {
                                    // Allow a host override for replaceBufferedStderr (tests may mock)
                                    if (host && typeof host.replaceBufferedStderr === 'function') {
                                        host.replaceBufferedStderr(mapped)
                                    } else {
                                        replaceBufferedStderr(mapped)
                                    }
                                } catch (_e) { }
                            } catch (_e) { }
                            try { host.__ssg_mapping_in_progress = false } catch (_e) { }
                        }, 0)
                        // Do not continue with the normal DOM append flow since we've
                        // scheduled a mapped replacement that will handle DOM updates.
                        try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'direct_append_skipped_dom', kind, text: raw.slice(0, 200) }) } catch (_e) { }
                        return
                    } catch (_e) { /* best-effort only */ }
                }
            } catch (_e) { }

            // If there's no terminal DOM element, we've already handled buffering above
            // so just return early to avoid attempting DOM operations.
            if (!out) return

            // Sanitize the text to remove vendor/runtime frames by default
            const sanitized = _sanitizeForTerminal(raw)

            const div = (doc && doc.createElement) ? doc.createElement('div') : null
            if (!div) return
            const kindClass = 'term-' + (kind || 'stdout')
            div.className = 'terminal-line ' + kindClass
            // Temporary debug: log when appending stderr mapped text so tests
            // can show why the mapped traceback may not appear.
            try {
                if (kind === 'stderr') {
                    // eslint-disable-next-line no-console
                    console.log('[terminal.appendTerminal] appending stderr ->', sanitized && String(sanitized).slice(0, 200))
                }
            } catch (_e) { }
            div.textContent = sanitized
            out.appendChild(div)
            try { if (kind === 'stderr') host.__ssg_final_stderr = String(sanitized || '') } catch (_e) { }
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

            // Preserve a copy of the raw buffered stderr for callers that
            // want to inspect the original runtime output (used by
            // feedback evaluation). Store on host so tests/other modules
            // can access it even after the live buffer is cleared.
            try { host.__ssg_last_raw_stderr_buffer = Array.isArray(buf) ? buf.slice() : [] } catch (_e) { }
            host.__ssg_stderr_buffering = false
            host.__ssg_stderr_buffer = []
            try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'replaceBufferedStderr', buf_len: buf.length, sample: buf.slice(0, 4), mappedPreview: (typeof mappedText === 'string') ? mappedText.slice(0, 200) : null }) } catch (_e) { }

            if ((!mappedText || typeof mappedText !== 'string')) {
                try {
                    // Try __ssg_last_mapped first
                    if (typeof host.__ssg_last_mapped === 'string' && host.__ssg_last_mapped) {
                        try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'replaceBufferedStderr_fallback_to_last_mapped', lastMappedPreview: host.__ssg_last_mapped.slice(0, 200) }) } catch (_e) { }
                        mappedText = host.__ssg_last_mapped
                    }
                    // Also try __ssg_last_mapped_event as fallback
                    else if (!mappedText && host.__ssg_last_mapped_event && typeof host.__ssg_last_mapped_event.mapped === 'string' && host.__ssg_last_mapped_event.mapped) {
                        try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'replaceBufferedStderr_fallback_to_last_mapped_event', lastMappedEventPreview: host.__ssg_last_mapped_event.mapped.slice(0, 200) }) } catch (_e) { }
                        mappedText = host.__ssg_last_mapped_event.mapped
                    }
                } catch (_e) { }
            }

            if ((!mappedText || typeof mappedText !== 'string') && Array.isArray(buf) && buf.length) {
                try {
                    const joined = buf.join('\n')
                    const guessed = joined.replace(/File\s+["'](?:<stdin>|<string>)["']\s*,\s*line\s+(\d+)/g, 'File "\/main.py", line $1')
                    mappedText = guessed
                    try { host.__ssg_final_stderr = String(guessed || '') } catch (_e) { }
                    try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'replaceBufferedStderr_fallback_guessed', sample: joined.slice(0, 200), guessedPreview: mappedText.slice(0, 200) }) } catch (_e) { }
                } catch (_e) { }
            }

            // CRITICAL FIX: If we still don't have any mapped text but we have buffered stderr,
            // append the raw buffer directly so the traceback is visible to the user.
            // It's better to show an unmapped traceback than no traceback at all.
            if ((!mappedText || typeof mappedText !== 'string' || mappedText.trim() === '') && Array.isArray(buf) && buf.length) {
                try {
                    console.log('[KAN-8-FIX] Traceback fallback: No mapped text, showing raw stderr')
                    console.log('[KAN-8-FIX] Buffered stderr lines:', buf.length)
                    appendTerminalDebug('[traceback-fix] No valid mapped text, appending raw buffered stderr')
                    appendTerminal('[DEBUG] TRACEBACK FALLBACK: Showing unmapped error (mapping failed)', 'stdout')
                    const joined = buf.join('\n')
                    appendTerminal(joined, 'stderr')
                    appendTerminal('[DEBUG] (end of unmapped traceback)', 'stdout')
                    try { host.__ssg_final_stderr = joined } catch (_e) { }
                    try { host.__ssg_terminal_event_log = host.__ssg_terminal_event_log || []; host.__ssg_terminal_event_log.push({ when: Date.now(), action: 'replaceBufferedStderr_raw_append', sample: joined.slice(0, 200) }) } catch (_e) { }
                    return
                } catch (_e) {
                    console.error('[KAN-8-FIX] Failed to append raw stderr:', _e)
                    appendTerminalDebug('[traceback-fix] Failed to append raw stderr: ' + _e)
                }
            }

            if (mappedText && typeof mappedText === 'string') {
                try {
                    // Publish the mapped result to host-level slots so callers
                    // (like runPythonCode -> Feedback) can read the final mapped
                    // traceback that was appended into the terminal. This keeps
                    // the source of truth that feedback rules inspect in sync
                    // with what the user actually sees in the terminal.
                    try {
                        host.__ssg_last_mapped = String(mappedText || '')
                        host.__ssg_last_mapped_event = host.__ssg_last_mapped_event || { when: Date.now(), headerLines: 0, sourcePath: (host && host.MAIN_FILE) ? host.MAIN_FILE : '/main.py', mapped: String(mappedText || '') }
                        try { host.__ssg_last_mapped_event.when = Date.now() } catch (_e) { }
                        try { host.__ssg_last_mapped_event.mapped = String(mappedText || '') } catch (_e) { }
                    } catch (_e) { }
                    const out = $('terminal-output')
                    if (out && out.children && out.children.length) {
                        const nodes = Array.from(out.children)
                        for (const n of nodes) {
                            try {
                                const txt = (n.textContent || '')
                                // KAN-8 FIX: Only remove unmapped references (<stdin>, <string>)
                                // Do NOT remove /main.py lines - those are the correctly mapped traceback!
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
                    try { host.__ssg_appending_mapped = true } catch (_e) { }
                    try {
                        // Set canonical final stderr before appending so readers
                        // sampling the slot see the authoritative value.
                        try {
                            host.__ssg_final_stderr = String(mappedText || '')
                        } catch (_e) { }
                        // If a per-run promise resolver exists, resolve it with the final value
                        try {
                            if (host.__ssg_final_stderr_resolve && typeof host.__ssg_final_stderr_resolve === 'function') {
                                try { host.__ssg_final_stderr_resolve(host.__ssg_final_stderr) } catch (_e) { }
                                try { delete host.__ssg_final_stderr_resolve } catch (_e) { }
                                try { delete host.__ssg_final_stderr_promise } catch (_e) { }
                            }
                        } catch (_e) { }
                        appendTerminal(mappedText, 'stderr')
                    } catch (_e) { }
                    try { host.__ssg_appending_mapped = false } catch (_e) { }
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
// Helpers to get/set the terminal innerHTML for callers that need snapshot/restore
export const getTerminalInnerHTML = () => {
    try {
        const out = document && document.getElementById ? document.getElementById('terminal-output') : null
        return out ? out.innerHTML : null
    } catch (_e) { return null }
}

export const setTerminalInnerHTML = (html) => {
    try {
        const out = document && document.getElementById ? document.getElementById('terminal-output') : null
        if (out) out.innerHTML = html == null ? '' : String(html)
    } catch (_e) { }
}
