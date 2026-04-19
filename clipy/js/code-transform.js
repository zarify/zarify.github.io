/**
 * Highlight a line in the CodeMirror editor for a given file and line number.
 * @param {string} filePath - The file path (e.g. '/main.py')
 * @param {number} lineNumber - 1-based line number to highlight
 */
// Ensure global error-tracking slots exist. Guarded so this file can be
// required in non-browser (node) environments during tests.
try {
    if (typeof window !== 'undefined') {
        if (!Array.isArray(window.__ssg_error_highlights)) window.__ssg_error_highlights = []
        if (typeof window.__ssg_error_highlights_map !== 'object' || window.__ssg_error_highlights_map === null) window.__ssg_error_highlights_map = {}
        if (typeof window.__ssg_error_highlighted !== 'boolean') window.__ssg_error_highlighted = false
        if (typeof window.__ssg_error_line_number === 'undefined') window.__ssg_error_line_number = null
        // feedback-specific highlights (click-to-highlight) stored separately
        if (!Array.isArray(window.__ssg_feedback_highlights)) window.__ssg_feedback_highlights = []
        if (typeof window.__ssg_feedback_highlights_map !== 'object' || window.__ssg_feedback_highlights_map === null) window.__ssg_feedback_highlights_map = {}
    }
} catch (e) { }

export function highlightMappedTracebackInEditor(filePath, lineNumber) {
    // Normalize the incoming file path so our internal maps always use a
    // leading-slash form (e.g. '/other.py'). This prevents mismatches where
    // highlights are stored under "other.py" but tabs/select logic looks up
    // "/other.py".
    const normPath = (typeof filePath === 'string' && filePath.startsWith('/')) ? filePath : ('/' + String(filePath || '').replace(/^\/+/, ''))

    // CRITICAL FIX (KAN-8): Only call selectTab if the error is in a DIFFERENT file
    // than the currently active tab. This allows switching to show errors in other
    // files, but prevents reloading the current file content which would overwrite
    // the user's edits with stale FileManager data.

    // Open the file tab if it's not already open
    if (window.TabManager && typeof window.TabManager.openTab === 'function') {
        try { window.TabManager.openTab(normPath, { select: false }) } catch (_e) { }
    }

    // Only select/reload the tab if it's NOT the currently active one
    if (window.TabManager && typeof window.TabManager.selectTab === 'function') {
        try {
            const currentlyActive = window.TabManager.getActive ? window.TabManager.getActive() : null
            if (currentlyActive !== normPath) {
                // Error is in a different file - switch to it
                window.TabManager.selectTab(normPath)
            }
            // If currentlyActive === normPath, we're already on the right tab
            // Don't call selectTab because it would reload and overwrite editor content
        } catch (_e) { }
    }

    // Highlight the line in CodeMirror when available, but always record
    // the highlight in our maps so it can be re-applied later if the editor
    // isn't initialized yet (tests and some flows call this early).
    const cm = window.cm
    if (typeof lineNumber !== 'number') return
    const zeroIndexLine = Math.max(0, lineNumber - 1)
    // Remove any previous highlights for this same file to avoid stacking.
    // Accept both normalized ('/x.py') and non-normalized ('x.py') keys because
    // some callers historically passed paths without a leading slash. This
    // ensures the initial highlight doesn't miss the stored entry.
    try {
        window.__ssg_error_highlights_map = window.__ssg_error_highlights_map || {}
        const altPath = String(filePath || '').startsWith('/') ? String(filePath || '').replace(/^\/+/, '') : ('/' + String(filePath || '').replace(/^\/+/, ''))
        const prevLines = window.__ssg_error_highlights_map[normPath] || []
        const prevLinesAlt = window.__ssg_error_highlights_map[altPath] || []
        for (const ln of prevLines.concat(prevLinesAlt)) {
            try { if (cm) cm.removeLineClass(ln, 'background', 'cm-error-line') } catch (_e) { }
        }
        // update array: remove entries for this file (either key form)
        if (Array.isArray(window.__ssg_error_highlights)) {
            window.__ssg_error_highlights = window.__ssg_error_highlights.filter(h => !(h && (h.filePath === normPath || h.filePath === altPath)))
        }
        // reset map entries for both forms
        window.__ssg_error_highlights_map[normPath] = []
        try { delete window.__ssg_error_highlights_map[altPath] } catch (_e) { }
    } catch (e) { }
    // Record highlight in our maps and emit an event; apply to CodeMirror
    // only if the editor instance is present.
    try {
        window.__ssg_error_highlights = window.__ssg_error_highlights || []
        window.__ssg_error_highlights_map = window.__ssg_error_highlights_map || {}
        window.__ssg_error_highlights.push({ filePath: normPath, line: zeroIndexLine })
        window.__ssg_error_highlights_map[normPath] = [zeroIndexLine]
        window.__ssg_error_highlighted = true;
        try {
            window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []
            const ev = { when: Date.now(), action: 'highlight_applied', filePath: normPath, line: zeroIndexLine }
            window.__ssg_terminal_event_log.push(ev)
            window.__ssg_last_highlight_applied = ev
        } catch (_e) { }

        if (cm) {
            // Apply immediately so the highlight is visible as soon as the
            // tab is opened. Also schedule a second apply on the next paint to
            // survive any subsequent CodeMirror render caused by setValue()
            // in TabManager.selectTab.
            try { cm.addLineClass(zeroIndexLine, 'background', 'cm-error-line') } catch (_e) { }
            try {
                requestAnimationFrame(() => {
                    try { cm.addLineClass(zeroIndexLine, 'background', 'cm-error-line') } catch (_e) { }
                    try { if (typeof cm.refresh === 'function') cm.refresh() } catch (_e) { }
                })
            } catch (_e) { }
        }
    } catch (e) { }
}

/**
 * Highlight a line as a 'feedback' highlight (distinct from error highlight).
 * This uses a separate map and CSS class so styles do not clash.
 */
export function highlightFeedbackLine(filePath, lineNumber) {
    const normPath = (typeof filePath === 'string' && filePath.startsWith('/')) ? filePath : ('/' + String(filePath || '').replace(/^\/+/, ''))
    const cm = window.cm
    if (typeof lineNumber !== 'number') return
    const zeroIndexLine = Math.max(0, lineNumber - 1)

    // remove previous feedback highlights for this file
    try {
        window.__ssg_feedback_highlights_map = window.__ssg_feedback_highlights_map || {}
        const altPath = String(filePath || '').startsWith('/') ? String(filePath || '').replace(/^\/+/, '') : ('/' + String(filePath || '').replace(/^\/+/, ''))
        const prev = window.__ssg_feedback_highlights_map[normPath] || []
        const prevAlt = window.__ssg_feedback_highlights_map[altPath] || []
        for (const ln of prev.concat(prevAlt)) {
            try { if (cm) cm.removeLineClass(ln, 'background', 'cm-feedback-line') } catch (_e) { }
        }
        window.__ssg_feedback_highlights = window.__ssg_feedback_highlights || []
        window.__ssg_feedback_highlights = window.__ssg_feedback_highlights.filter(h => !(h && (h.filePath === normPath || h.filePath === altPath)))
        window.__ssg_feedback_highlights_map[normPath] = []
        try { delete window.__ssg_feedback_highlights_map[altPath] } catch (_e) { }
    } catch (_e) { }

    // record and apply
    try {
        window.__ssg_feedback_highlights = window.__ssg_feedback_highlights || []
        window.__ssg_feedback_highlights_map = window.__ssg_feedback_highlights_map || {}
        window.__ssg_feedback_highlights.push({ filePath: normPath, line: zeroIndexLine })
        window.__ssg_feedback_highlights_map[normPath] = [zeroIndexLine]
        try {
            if (cm) {
                try { cm.addLineClass(zeroIndexLine, 'background', 'cm-feedback-line') } catch (_e) { }
                try { requestAnimationFrame(() => { try { cm.addLineClass(zeroIndexLine, 'background', 'cm-feedback-line') } catch (_e) { } }) } catch (_e) { }
                try { if (typeof cm.refresh === 'function') cm.refresh() } catch (_e) { }
            }
        } catch (_e) { }
    } catch (_e) { }
}

export function clearAllFeedbackHighlights() {
    const cm = window.cm
    if (!cm) return
    try {
        window.__ssg_feedback_highlights_map = window.__ssg_feedback_highlights_map || {}
        for (const fp of Object.keys(window.__ssg_feedback_highlights_map)) {
            const lines = window.__ssg_feedback_highlights_map[fp] || []
            for (const ln of lines) {
                try { cm.removeLineClass(ln, 'background', 'cm-feedback-line') } catch (_e) { }
            }
        }
    } catch (_e) { }
    try {
        if (Array.isArray(window.__ssg_feedback_highlights)) {
            for (const { line } of window.__ssg_feedback_highlights) {
                try { cm.removeLineClass(line, 'background', 'cm-feedback-line') } catch (_e) { }
            }
        }
    } catch (_e) { }
    window.__ssg_feedback_highlights = []
    window.__ssg_feedback_highlights_map = {}

    // After removing feedback highlights, re-apply any stored error highlights
    // so error annotations remain authoritative and visible to the user.
    try {
        window.__ssg_error_highlights_map = window.__ssg_error_highlights_map || {}
        for (const fp of Object.keys(window.__ssg_error_highlights_map)) {
            const lines = window.__ssg_error_highlights_map[fp] || []
            for (const ln of lines) {
                try { cm.addLineClass(ln, 'background', 'cm-error-line') } catch (_e) { }
            }
        }
        try { if (typeof cm.refresh === 'function') cm.refresh() } catch (_e) { }
    } catch (_e) { }
}

/**
 * Clear all error highlights from all tracked lines in all files.
 * Call this before running or on any edit.
 */
export function clearAllErrorHighlights() {
    const cm = window.cm;
    if (!cm) return;
    try {
        window.__ssg_error_highlights_map = window.__ssg_error_highlights_map || {}
        for (const fp of Object.keys(window.__ssg_error_highlights_map)) {
            const lines = window.__ssg_error_highlights_map[fp] || []
            for (const ln of lines) {
                try { cm.removeLineClass(ln, 'background', 'cm-error-line') } catch (_e) { }
            }
        }
    } catch (_e) { }
    // Fallback: also clear any array-tracked entries
    try {
        if (Array.isArray(window.__ssg_error_highlights)) {
            for (const { line } of window.__ssg_error_highlights) {
                try { cm.removeLineClass(line, 'background', 'cm-error-line') } catch (_e) { }
            }
        }
    } catch (_e) { }
    window.__ssg_error_highlights = [];
    window.__ssg_error_highlights_map = {}
    window.__ssg_error_highlighted = false;
    window.__ssg_error_line_number = null;
    try {
        window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []
        const ev = { when: Date.now(), action: 'highlights_cleared' }
        window.__ssg_terminal_event_log.push(ev)
        window.__ssg_last_highlights_cleared = ev
    } catch (_e) { }
}

// Code transformation and wrapping utilities
import { transformWalrusPatterns, normalizeIndentation } from './utils.js'

// Helper function to safely replace input() calls with await host.get_input() calls
// Uses tokenizer-aware replacement to skip strings and comments
function safeReplaceInput(src) {
    let out = ''
    const N = src.length
    let i = 0
    let state = 'normal' // normal | single | double | tri-single | tri-double | comment

    while (i < N) {
        // detect triple-quoted strings first
        if (state === 'normal') {
            // line comment
            if (src[i] === '#') {
                // copy until newline or end
                const j = src.indexOf('\n', i)
                if (j === -1) {
                    out += src.slice(i)
                    break
                }
                out += src.slice(i, j + 1)
                i = j + 1
                continue
            }

            // triple single
            if (src.startsWith("'''", i)) {
                state = 'tri-single'
                out += "'''"
                i += 3
                continue
            }

            // triple double
            if (src.startsWith('"""', i)) {
                state = 'tri-double'
                out += '"""'
                i += 3
                continue
            }

            // single-quote
            if (src[i] === "'") {
                state = 'single'
                out += src[i++]
                continue
            }

            // double-quote
            if (src[i] === '"') {
                state = 'double'
                out += src[i++]
                continue
            }

            // detect identifier 'input' with word boundary and a following '('
            if (src.startsWith('input', i) && (i === 0 || !(/[A-Za-z0-9_]/.test(src[i - 1])))) {
                // lookahead for optional whitespace then '('
                let j = i + 5
                while (j < N && /\s/.test(src[j])) j++
                if (j < N && src[j] === '(') {
                    out += 'await host.get_input'
                    i += 5
                    continue
                }
            }

            // default: copy char
            out += src[i++]
        } else if (state === 'single') {
            // inside single-quoted string
            if (src[i] === '\\') {
                out += src.substr(i, 2)
                i += 2
                continue
            }
            if (src[i] === "'") {
                state = 'normal'
                out += src[i++]
                continue
            }
            out += src[i++]
        } else if (state === 'double') {
            if (src[i] === '\\') {
                out += src.substr(i, 2)
                i += 2
                continue
            }
            if (src[i] === '"') {
                state = 'normal'
                out += src[i++]
                continue
            }
            out += src[i++]
        } else if (state === 'tri-single') {
            if (src.startsWith("'''", i)) {
                state = 'normal'
                out += "'''"
                i += 3
                continue
            }
            out += src[i++]
        } else if (state === 'tri-double') {
            if (src.startsWith('"""', i)) {
                state = 'normal'
                out += '"""'
                i += 3
                continue
            }
            out += src[i++]
        } else {
            // unknown state fallback
            out += src[i++]
        }
    }
    return out
}

// Helper: transform user source by replacing input(...) with await host.get_input(...)
// and wrap in an async runner. Returns {code: wrappedCode, headerLines}
export function transformAndWrap(userCode) {
    // First handle walrus patterns
    const processedCode = transformWalrusPatterns(userCode)

    // Then replace input() calls
    const replaced = safeReplaceInput(processedCode)

    const headerLinesArr = [
        'import host',
        '# Asyncio compatibility wrapper: prefer asyncio.run or uasyncio.run, fallback to get_event_loop().run_until_complete',
        'try:',
        "    import asyncio as _asyncio",
        "    _run = getattr(_asyncio, 'run', None)",
        "except Exception:",
        "    _asyncio = None\n    _run = None",
        "# prefer uasyncio.run if available (MicroPython often exposes this)",
        "try:",
        "    import uasyncio as _ua",
        "    if _run is None:",
        "        _run = getattr(_ua, 'run', None)",
        "except Exception:",
        "    _ua = None",
        "# fallback: use asyncio.get_event_loop().run_until_complete if present",
        "if _run is None and _asyncio is not None:",
        "    try:",
        "        _loop = _asyncio.get_event_loop()",
        "        if hasattr(_loop, 'run_until_complete'):",
        "            def _run(coro): _loop.run_until_complete(coro)",
        "    except Exception:",
        "        _run = None",
        "",
        "async def __ssg_main():"
    ]

    const indent = (line) => '    ' + line

    // Normalize and indent the user code
    const body = normalizeIndentation(replaced).split('\n').map(indent).join('\n')

    const footer = `if _run is None:\n    raise ImportError('no async runner available')\n_run(__ssg_main())`
    const full = headerLinesArr.join('\n') + '\n' + body + '\n' + footer

    // Compute the actual number of header LINES. Some entries in
    // `headerLinesArr` contain embedded newlines, so using the array
    // length undercounts the real number of prepended lines. Join the
    // array and count newline-separated lines to get an accurate value
    // which is required for correct traceback mapping.
    const headerLinesCount = headerLinesArr.join('\n').split('\n').length
    return { code: full, headerLines: headerLinesCount }
}

// Map and display tracebacks that originate in transformed code back to user source
export function mapTracebackAndShow(rawText, headerLines, userCode, appendTerminal) {
    // Debug: Log function call parameters
    try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'mapTracebackAndShow_called', headerLines: headerLines, headerLinesType: typeof headerLines, userCode: (typeof userCode === 'string' ? userCode.slice(0, 50) : userCode), rawTextPreview: (rawText || '').slice(0, 200) }) } catch (_e) { }

    // Safe debug helper: appendTerminalDebug may not be available in some
    // test or mapping-only environments (avoids ReferenceError). Use the
    // global if present, otherwise no-op.
    const _safeAppendTerminalDebug = (...args) => {
        try {
            if (typeof window !== 'undefined' && window.appendTerminalDebug && typeof window.appendTerminalDebug === 'function') {
                try { window.appendTerminalDebug(...args) } catch (_e) { }
            }
        } catch (_e) { }
    }

    if (!rawText) return

    // Native trace mode: headerLines === 0 means line numbers are already correct
    // No mapping needed - just display the error as-is (but replace <stdin> with /main.py)
    if (headerLines === 0) {
        _safeAppendTerminalDebug('Native trace mode - no line number mapping needed')

        // KAN-8 FIX: Replace <stdin> and <string> with /main.py in the display text
        // so the terminal shows the correct filename instead of runtime pseudo-names
        let displayText = rawText
        try {
            displayText = rawText.replace(/File\s+["']<stdin>["']/g, 'File "/main.py"')
            displayText = displayText.replace(/File\s+["']<string>["']/g, 'File "/main.py"')
        } catch (_e) { displayText = rawText }

        // Attempt to parse a File "<fname>", line N frame from the raw traceback
        // and call highlightMappedTracebackInEditor with a proper file path and
        // line number. This prevents passing the entire traceback string as a
        // filename which previously caused the TabManager to create an empty
        // file/tab named with the traceback text.
        try {
            const m = /File\s+["']([^"']+)["']\s*,\s*line\s+(\d+)/.exec(rawText)
            if (m) {
                let rawF = m[1]
                const ln = Number(m[2]) || 1
                // If the runtime reports pseudo-filenames like <stdin> or <string>,
                // prefer the caller-provided userCode when it looks like a path.
                // Otherwise fall back to the conventional '/main.py'. This ensures
                // we never call the editor highlight with a pseudo-name which
                // previously caused a tab to be created named '<stdin>'.
                try {
                    if (rawF === '<stdin>' || rawF === '<string>') {
                        if (typeof userCode === 'string' && userCode.indexOf('\n') === -1 && (userCode.startsWith('/') || userCode.indexOf('.') !== -1)) {
                            rawF = userCode
                        } else {
                            rawF = '/main.py'
                        }
                    }
                } catch (_e) { /* ignore and use rawF as-is */ }

                const norm = (rawF && rawF.startsWith('/')) ? rawF : ('/' + String(rawF || '').replace(/^\/+/, ''))
                try { highlightMappedTracebackInEditor(norm, ln) } catch (_e) { }
            } else {
                // No parsable frame found: avoid calling highlight with rawText
                // to prevent creating tabs named with the traceback. Just log.
                _safeAppendTerminalDebug('No file/line frame found in native traceback; skipping highlight')
            }
        } catch (_e) { }

        // Append to terminal if available (use displayText with replaced filenames)
        if (typeof window !== 'undefined' && window.appendTerminal && typeof window.appendTerminal === 'function') {
            try {
                window.appendTerminal(displayText, 'stderr')
                return displayText
            } catch (_e) { }
        }

        return displayText
    }

    // Normalize headerLines to a number and attempt a best-effort
    // fallback when callers did not supply a headerLines value. Some
    // call sites historically passed 0; in those cases we can try to
    // compute the transform header from the user's source so mapping
    // still produces the expected user line numbers.
    let effectiveHeader = Number(headerLines) || 0
    try {
        if (!effectiveHeader && typeof userCode === 'string') {
            // If userCode looks like a path (no newline), try localStorage
            // mirror first; otherwise treat it as raw source.
            let src = null
            if (userCode.indexOf('\n') === -1) {
                // Prefer FileManager/unified in-memory shim for synchronous source lookup.
                try {
                    const norm = (userCode && userCode.startsWith('/')) ? userCode : ('/' + String(userCode || '').replace(/^\/+/, ''))
                    if (typeof window !== 'undefined' && window.FileManager && typeof window.FileManager.read === 'function') {
                        try {
                            const maybe = window.FileManager.read(norm)
                            // If FileManager.read returns a Promise, we can't await here; treat as unavailable
                            if (maybe != null && typeof maybe.then !== 'function') src = maybe
                        } catch (_e) { /* ignore sync failures */ }
                    }
                    // Also consider in-memory unified shim used by tests
                    try {
                        if (!src && typeof window !== 'undefined' && window.__ssg_unified_inmemory) {
                            const map = window.__ssg_unified_inmemory['ssg_files_v1'] || {}
                            src = map[norm] || map[String(userCode)] || null
                        }
                    } catch (_e) { }
                } catch (_e) { src = null }
            } else {
                src = userCode
            }

            if (src && typeof transformAndWrap === 'function') {
                try {
                    const t = transformAndWrap(src)
                    effectiveHeader = Number(t.headerLines) || 0
                } catch (_e) { /* best-effort only */ }
            }
        }
    } catch (_e) { /* ignore fallback failures */ }

    // Replace occurrences like: File "<stdin>", line N[, column C]
    // Match patterns like: File "<stdin>", line 1, in <module>
    // Accept single or double quotes, optional extra ", in <module>" suffix,
    // Preserve whitespace structure from original traceback
    const mapped = rawText.replace(/(\s*)File\s+["']([^"']+)["']\s*,\s*line\s+(\d+)/g, (m, whitespace, fname, ln) => {
        // If the runtime reports <stdin> or <string> as the filename, replace
        // it with the user's main file path when the caller provided one.
        // The third argument to this function is sometimes a path (e.g. MAIN_FILE)
        // or the user source. Heuristically prefer a path-like value.
        let outFname = fname
        try {
            if (fname === '<stdin>' || fname === '<string>') {
                if (typeof userCode === 'string' && userCode.indexOf('\n') === -1 && (userCode.startsWith('/') || userCode.indexOf('.') !== -1)) {
                    outFname = userCode
                } else {
                    outFname = '/main.py'
                }
            }
        } catch (_e) { outFname = fname }

        // IMPROVED: Better line mapping for instrumented code
        let mappedLn = Number(ln)

        // For instrumented code with tracing, the structure is:
        // - Lines 1-21: Header/setup code  
        // - Line 22: User line 1
        // - Lines 23-26: Tracing code (4 lines)
        // - Line 27: User line 2  ← Error occurs here (should map to line 2)
        // - Lines 28-31: Tracing code (4 lines)

        if (mappedLn > headerLines) {
            // Prefer explicit mapping if available from the instrumentor
            try {
                const globalMap = (typeof window !== 'undefined') ? window.__ssg_instrumented_line_map : null
                if (globalMap && typeof globalMap === 'object') {
                    // instrumented line numbers are 1-based keys
                    const mappedKey = String(mappedLn)
                    if (Object.prototype.hasOwnProperty.call(globalMap, mappedKey)) {
                        mappedLn = Number(globalMap[mappedKey])
                    } else {
                        // If exact mapping isn't present, try subtracting headerLines
                        mappedLn = Math.max(1, mappedLn - headerLines)
                    }
                } else if (headerLines > 0) {
                    const lineAfterHeaders = mappedLn - headerLines
                    // Heuristic fallback for older instrumentor behavior: assume tracer
                    // inserted ~4 extra lines per user line in-between (so groups of 5)
                    mappedLn = Math.ceil(lineAfterHeaders / 5)
                } else {
                    mappedLn = Math.max(1, mappedLn - headerLines)
                }
            } catch (_e) {
                mappedLn = Math.max(1, mappedLn - headerLines)
            }
        } else {
            // Simple case: subtract header offset
            mappedLn = Math.max(1, mappedLn - headerLines)
        }

        mappedLn = Math.max(1, mappedLn)
        highlightMappedTracebackInEditor(outFname, mappedLn);
        return `${whitespace}File "${outFname}", line ${mappedLn}`
    })

    // Do not append the mapped traceback directly here. The execution path
    // enables stderr buffering and expects the caller to call
    // replaceBufferedStderr(mapped) so that the buffered raw stderr can be
    // replaced atomically with the mapped version. Return the mapped string
    // so callers can perform that replacement.
    // Debug output is recorded in the event log; avoid noisy console.debug here.
    try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'mapped_debug', mappedPreview: (mapped == null) ? null : String(mapped).slice(0, 200), inputHeaderLines: headerLines, inputUserCode: (typeof userCode === 'string' ? userCode.slice(0, 50) : userCode), inputRawText: (rawText || '').slice(0, 100) }) } catch (_e) { }
    try { window.__ssg_last_mapped_event = { when: Date.now(), mapped: String(mapped || '') } } catch (_e) { }

    // CRITICAL FIX: Ensure the traceback actually reaches the terminal
    // The complex replacement mechanism often fails, so append directly if mapping produced a result
    if (mapped && typeof mapped === 'string' && mapped !== rawText) {
        try {
            // Import appendTerminal function 
            if (typeof window !== 'undefined' && window.appendTerminal && typeof window.appendTerminal === 'function') {
                // Directly append the mapped traceback to ensure it's visible
                window.appendTerminal(mapped, 'stderr')
                try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'direct_append_mapped_traceback', mappedPreview: mapped.slice(0, 200) }) } catch (_e) { }
                return mapped
            }
        } catch (_e) {
            try { window.__ssg_terminal_event_log = window.__ssg_terminal_event_log || []; window.__ssg_terminal_event_log.push({ when: Date.now(), action: 'direct_append_failed', error: String(_e) }) } catch (_e2) { }
        }
    }


    // Optionally show small source context for first mapped line
    const m = mapped.match(/line (\d+)/)
    if (m) {
        const errLine = Math.max(1, Number(m[1]))
        const userLines = (typeof userCode === 'string') ? userCode.split('\n') : []
        const contextStart = Math.max(0, errLine - 3)
        _safeAppendTerminalDebug('--- source context (student code) ---')
        for (let i = contextStart; i < Math.min(userLines.length, errLine + 2); i++) {
            const prefix = (i + 1 === errLine) ? '-> ' : '   '
            _safeAppendTerminalDebug(prefix + String(i + 1).padStart(3, ' ') + ': ' + userLines[i])
        }
    }

    // Highlight any mapped frames that refer to files present in the
    // workspace. This avoids trying to highlight files (or pseudo-files)
    // that are not part of the UI's FileManager.
    try {
        const reFileLine = /File\s+["']([^"']+)["']\s*,\s*line\s+(\d+)/g
        let mm
        const seen = new Set()
        while ((mm = reFileLine.exec(mapped)) !== null) {
            try {
                const rawF = mm[1]
                const ln = Number(mm[2]) || 1
                const norm = (rawF && rawF.startsWith('/')) ? rawF : ('/' + String(rawF || '').replace(/^\/+/, ''))
                if (seen.has(norm + ':' + ln)) continue
                seen.add(norm + ':' + ln)

                // Check localStorage mirror first
                let exists = false
                try {
                    // Prefer synchronous unified in-memory shim or FileManager checks
                    try {
                        if (typeof window !== 'undefined' && window.__ssg_unified_inmemory) {
                            const map = window.__ssg_unified_inmemory['ssg_files_v1'] || {}
                            if (map && Object.prototype.hasOwnProperty.call(map, norm)) exists = true
                        }
                    } catch (_e) { }
                } catch (_e) { }

                // Consider MAIN_FILE present
                try { if (!exists && typeof window !== 'undefined' && typeof window.MAIN_FILE === 'string' && window.MAIN_FILE === norm) exists = true } catch (_e) { }

                // Ask TabManager if available
                try {
                    if (!exists && window.TabManager && typeof window.TabManager.hasTab === 'function') {
                        try { if (window.TabManager.hasTab(norm)) exists = true } catch (_e) { }
                    }
                } catch (_e) { }

                if (exists) {
                    try { highlightMappedTracebackInEditor(norm, ln) } catch (_e) { }
                }
            } catch (_e) { }
        }
    } catch (_e) { }

    return mapped
}
