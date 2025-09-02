// Minimal Feedback subsystem (core infra)
// Exports: resetFeedback(config), evaluateFeedbackOnEdit(code, path), evaluateFeedbackOnRun(ioCapture), on/off for events

// Lightweight event emitter that works in browser and node
const _listeners = new Map()
function on(evt, cb) {
    if (!_listeners.has(evt)) _listeners.set(evt, new Set())
    _listeners.get(evt).add(cb)
}
function off(evt, cb) {
    if (!_listeners.has(evt)) return
    _listeners.get(evt).delete(cb)
}
function emit(evt, data) {
    const s = _listeners.get(evt)
    if (!s) return
    for (const cb of Array.from(s)) {
        try { cb(data) } catch (_e) { /* swallow */ }
    }
}

let _config = null
let _store = { matches: [], editMatches: [], runMatches: [] }

function validateConfig(cfg) {
    if (!cfg || typeof cfg !== 'object') throw new Error('config must be an object')
    if (!Array.isArray(cfg.feedback)) return // allow empty
    for (const entry of cfg.feedback) {
        if (!entry.id || typeof entry.id !== 'string') throw new Error('feedback.id required')
        if (!entry.title || typeof entry.title !== 'string') throw new Error('feedback.title required')
        if (!Array.isArray(entry.when) || entry.when.length === 0) throw new Error('feedback.when must be non-empty array')
        if (!entry.pattern || typeof entry.pattern !== 'object') throw new Error('feedback.pattern required')
        const p = entry.pattern
        if (!['regex', 'ast'].includes(p.type)) throw new Error('unsupported pattern.type')
        if (!['code', 'filename', 'stdout', 'stderr', 'stdin'].includes(p.target)) throw new Error('unsupported pattern.target')
        if (typeof p.expression !== 'string') throw new Error('pattern.expression must be a string')
    }
}

function resetFeedback(config) {
    // Accept either the new array-form or the legacy object-form
    let normalized = { feedback: [] }
    if (config && typeof config === 'object') {
        // If config.feedback is an array, assume new form
        if (Array.isArray(config.feedback)) {
            normalized.feedback = config.feedback
        } else if (config.feedback && typeof config.feedback === 'object') {
            // Legacy shape: { ast: [], regex: [] } -> convert regex entries into array entries
            const arr = []
            const r = Array.isArray(config.feedback.regex) ? config.feedback.regex : []
            for (let i = 0; i < r.length; i++) {
                const item = r[i]
                arr.push({
                    id: item.id || ('legacy-regex-' + i),
                    title: item.title || ('legacy ' + i),
                    when: item.when || ['edit'],
                    pattern: { type: 'regex', target: (item.target === 'output' ? 'stdout' : (item.target || 'code')), expression: item.pattern || item.expression || '' },
                    message: item.message || '',
                    severity: item.severity || 'info',
                    visibleByDefault: typeof item.visibleByDefault === 'boolean' ? item.visibleByDefault : true
                })
            }
            normalized.feedback = arr
        }
        try { validateConfig(normalized) } catch (_e) { /* allow lenient */ }
    }

    _config = normalized
    _store = { matches: [], editMatches: [], runMatches: [] }
    emit('reset', { config: _config })

    // Do not auto-emit matches here; the UI will initialize from the 'reset' event
}

function _applyRegex(expr, flags) {
    try { return new RegExp(expr, flags || '') } catch (e) { return null }
}

function _formatMessage(template, groups) {
    if (!template) return ''
    // replace $1..$9 simple placeholders
    return template.replace(/\$(\d+)/g, (_, n) => groups && groups[n] ? groups[n] : '')
}

function evaluateFeedbackOnEdit(code, path) {
    // Clear run-time matches when the user edits
    _store.runMatches = []

    const matches = []
    if (!_config || !_config.feedback) return matches
    for (const entry of _config.feedback) {
        if (!entry.when.includes('edit')) continue
        const p = entry.pattern
        if (p.type === 'regex') {
            if (p.target === 'code') {
                // Determine which file's content to check. If a fileTarget is
                // provided on the pattern use that, otherwise fall back to the
                // current path or the protected main file '/main.py'. Use the
                // global FileManager (if available) to read other files.
                const targetFile = (p.fileTarget && String(p.fileTarget).trim()) || (path || '/main.py')
                let contentToCheck = String(code || '')
                try {
                    // If the requested targetFile differs from the currently
                    // provided path, attempt to read it from FileManager/mem.
                    const normalizedTarget = targetFile.startsWith('/') ? targetFile : ('/' + targetFile)
                    const currentPathNorm = path && (path.startsWith('/') ? path : ('/' + path))
                    if (normalizedTarget !== currentPathNorm) {
                        if (typeof window !== 'undefined' && window.FileManager && typeof window.FileManager.read === 'function') {
                            const readVal = window.FileManager.read(normalizedTarget)
                            if (readVal != null) contentToCheck = String(readVal)
                        } else {
                            // No FileManager available; if mem is present try window.__ssg_mem
                            try { if (window.__ssg_mem && Object.prototype.hasOwnProperty.call(window.__ssg_mem, normalizedTarget)) contentToCheck = String(window.__ssg_mem[normalizedTarget]) } catch (_e) { }
                        }
                    }
                } catch (_e) { }

                const re = _applyRegex(p.expression, p.flags)
                if (!re) continue
                const lines = contentToCheck.split(/\r?\n/)
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i]
                    const m = line.match(re)
                    if (m) {
                        matches.push({ file: (targetFile.startsWith('/') ? targetFile : ('/' + targetFile)), line: i + 1, message: _formatMessage(entry.message, m), id: entry.id })
                    }
                }
            } else if (p.target === 'filename') {
                const re = _applyRegex(p.expression, p.flags)
                if (!re) continue
                if (path && String(path).match(re)) {
                    matches.push({ file: path, message: _formatMessage(entry.message, []), id: entry.id })
                }
            }
        }
        // AST matchers not implemented yet - skip
    }
    _store.editMatches = matches
    const combined = [].concat(_store.editMatches || [], _store.runMatches || [])
    _store.matches = combined
    emit('matches', combined)
    return matches
}

function evaluateFeedbackOnRun(ioCapture) {
    const matches = []
    if (!_config || !_config.feedback) return matches
    for (const entry of _config.feedback) {
        if (!entry.when.includes('run') && !entry.when.includes('test')) continue
        const p = entry.pattern
        if (p.type === 'regex') {
            const target = p.target
            const re = _applyRegex(p.expression, p.flags)
            if (!re) continue
            if (target === 'filename') {
                // Support filename being provided as an array or a string
                const val = (ioCapture && ioCapture.filename) || ''
                let found = null
                if (Array.isArray(val)) {
                    for (const fname of val) {
                        try {
                            if (String(fname || '').match(re)) { found = fname; break }
                        } catch (_e) { }
                    }
                } else {
                    // Accept newline-joined or single-string forms
                    const s = String(val || '')
                    const parts = s.split(/\r?\n/).map(x => x.trim()).filter(x => x)
                    for (const fname of parts) {
                        try { if (String(fname).match(re)) { found = fname; break } } catch (_e) { }
                    }
                }
                if (found !== null) {
                    matches.push({ message: _formatMessage(entry.message, []), id: entry.id, target, filename: found })
                }
            } else {
                const text = String((ioCapture && ioCapture[target]) || '')
                const m = text.match(re)
                if (m) {
                    matches.push({ message: _formatMessage(entry.message, m), id: entry.id, target })
                }
            }
        }
    }
    _store.runMatches = matches
    const combined = [].concat(_store.editMatches || [], _store.runMatches || [])
    _store.matches = combined
    emit('matches', combined)
    return matches
}

// Expose for other modules
const Feedback = { resetFeedback, evaluateFeedbackOnEdit, evaluateFeedbackOnRun, on, off }

if (typeof module !== 'undefined' && module.exports) module.exports = Feedback

export { resetFeedback, evaluateFeedbackOnEdit, evaluateFeedbackOnRun, on, off }
