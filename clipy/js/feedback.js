// Minimal Feedback subsystem (core infra)
// Exports: resetFeedback(config), evaluateFeedbackOnEdit(code, path), evaluateFeedbackOnRun(ioCapture), on/off for events

// Import AST analyzer for AST pattern support
import { analyzeCode, getASTAnalyzer } from './ast-analyzer.js';
import { debug as logDebug, info as logInfo, warn as logWarn, error as logError } from './logger.js'
import { normalizeFilename } from './utils.js'

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
        if (!['string', 'regex', 'ast'].includes(p.type)) throw new Error('unsupported pattern.type')
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

// When the application applies a new feedback config, allow the host to notify
// the Feedback subsystem so it can re-evaluate workspace files and emit
// matches immediately. This avoids duplicating file traversal logic in the
// app layer and centralizes evaluation here.
try {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('ssg:feedback-config-changed', async (ev) => {
            try {
                // Optionally update internal config if provided
                const payload = ev && ev.detail ? ev.detail : null
                if (payload && payload.config) {
                    try { resetFeedback(payload.config) } catch (_e) { }
                }

                // Best-effort: enumerate workspace files and run file-event and
                // edit evaluations so filename and code/AST patterns are
                // evaluated immediately. Use FileManager.list/read when
                // available; otherwise fallback to no-op.
                try {
                    const vfs = await import('./vfs-client.js')
                    const getFileManager = vfs.getFileManager
                    const FileManager = (typeof getFileManager === 'function') ? getFileManager() : null

                    const files = (FileManager && typeof FileManager.list === 'function') ? (await FileManager.list()) : []
                    for (const f of files) {
                        try {
                            // Trigger filename-target logic
                            try { await evaluateFeedbackOnFileEvent({ type: 'create', filename: f }) } catch (_e) { }

                            // Trigger code/AST/regex evaluations for the file
                            try {
                                let contentForFile = ''
                                try {
                                    if (FileManager && typeof FileManager.read === 'function') {
                                        const v = await FileManager.read(f)
                                        if (v != null) contentForFile = String(v)
                                    }
                                } catch (_e) { }
                                try { await evaluateFeedbackOnEdit(contentForFile, f, { clearRunMatches: false }) } catch (_e) { }
                            } catch (_e) { }
                        } catch (_e) { }
                    }
                } catch (_e) { }
            } catch (_e) { }
        })
    }
} catch (_e) { }

function _applyRegex(expr, flags) {
    try { return new RegExp(expr, flags || '') } catch (e) { return null }
}

async function _applyPattern(pattern, text) {
    if (pattern.type === 'string') {
        // Simple string matching - check if text contains the expression
        const searchText = String(pattern.expression || '')
        const content = String(text || '')
        const index = content.indexOf(searchText)
        if (index >= 0) {
            // Return match-like result for compatibility
            return [searchText]
        }
        return null
    } else if (pattern.type === 'regex') {
        const re = _applyRegex(pattern.expression, pattern.flags)
        if (!re) return null
        return text.match(re)
    } else if (pattern.type === 'ast') {
        // AST pattern matching for Python code
        if (!text || typeof text !== 'string') return null
        try {
            const result = await analyzeCode(text, pattern.expression)
            if (result) {
                // If a matcher is provided, evaluate it
                if (pattern.matcher && pattern.matcher.trim()) {
                    try {
                        // Create a safe evaluation function for the matcher
                        const evaluateMatch = new Function('result', `
                            try {
                                return ${pattern.matcher.trim()};
                            } catch (e) {
                                console.warn('AST matcher evaluation error:', e.message);
                                return false;
                            }
                        `);
                        const matchResult = evaluateMatch(result);

                        // Only accept strict boolean true from matcher. If matcher
                        // returns a non-boolean truthy value, warn and treat as no-match.
                        if (typeof matchResult === 'boolean') {
                            if (matchResult) return _convertASTToMatch(result, pattern.expression)
                            return null
                        } else {
                            logWarn('AST matcher returned non-boolean value; matcher must return true or false')
                            return null
                        }
                    } catch (error) {
                        logWarn('AST matcher function creation failed:', error)
                        return null
                    }
                } else {
                    // No matcher provided, use result as-is
                    return _convertASTToMatch(result, pattern.expression)
                }
            }
        } catch (error) {
            logWarn('AST pattern matching failed:', error)
        }
        return null
    }
    // Other types not implemented
    return null
}

/**
 * Convert AST analysis result to match-like format for compatibility
 */
function _convertASTToMatch(result, expression) {
    if (!result) return null

    // Create a match array with the result summary as first element
    const match = [JSON.stringify(result)]

    // Add specific details based on analysis type
    if (result.name) match.push(result.name)
    if (result.count !== undefined) match.push(result.count.toString())
    if (result.functions && Array.isArray(result.functions)) {
        match.push(result.functions.map(f => f.name).join(', '))
    }
    if (result.details && Array.isArray(result.details)) {
        match.push(result.details.length.toString())
    }

    return match
}

function _formatMessage(template, groups) {
    if (!template) return ''
    // replace $1..$9 simple placeholders
    return template.replace(/\$(\d+)/g, (_, n) => groups && groups[n] ? groups[n] : '')
}



/**
 * Evaluate filename-target feedback rules when a file create/delete event occurs.
 * event: { type: 'create'|'delete', filename: '/path/to/file' }
 * This updates _store.editMatches (filename-related matches) and emits combined matches.
 */
async function evaluateFeedbackOnFileEvent(event) {
    if (!event || !event.filename) return []
    const evType = String(event.type || '').toLowerCase()
    const fname = String(event.filename || '')
    const normFname = normalizeFilename(fname)

    if (!_config || !_config.feedback) return []

    // We'll update _store.editMatches incrementally: add matches on create,
    // remove on delete for filename-target rules. Only consider entries that
    // are intended for edit-like behavior (when includes 'edit' or 'file').
    const keepWhen = entry => Array.isArray(entry.when) && (entry.when.includes('edit') || entry.when.includes('file'))

    // Remove any existing filename matches for this filename first (for delete or create to avoid dupes)
    _store.editMatches = (_store.editMatches || []).filter(m => {
        if (!m || !m.file) return true
        const existing = normalizeFilename(m.file)
        return existing !== normFname
    })

    if (evType === 'create') {
        for (const entry of _config.feedback) {
            if (!keepWhen(entry)) continue
            const p = entry.pattern
            if (!p || p.target !== 'filename') continue

            const desired = (p.fileTarget && String(p.fileTarget).trim()) || (p.expression && String(p.expression).trim()) || ''
            if (!desired) continue
            const normDesired = normalizeFilename(desired)

            // If the created filename matches the desired filename, add match
            if (normFname === normDesired || String(fname) === desired || String(fname) === desired.replace(/^\//, '')) {
                // Store the match file using the pattern's desired value so
                // subsequent edit-based evaluations produce consistent file
                // strings (avoid leading-slash differences).
                _store.editMatches.push({ file: desired, message: _formatMessage(entry.message, []), id: entry.id })
            }
        }
    } else if (evType === 'delete') {
        // deletion already removed existing matches above.
    }

    const combined = [].concat(_store.editMatches || [], _store.runMatches || [])
    _store.matches = combined
    emit('matches', combined)
    return _store.editMatches
}

async function evaluateFeedbackOnEdit(code, path, opts = {}) {
    // By default, clear run-time matches when the user edits. Callers can
    // pass opts.clearRunMatches = false to preserve runMatches (useful when
    // reacting to external file events where we don't want to remove run
    // feedback immediately).
    if (opts.clearRunMatches === undefined || opts.clearRunMatches === true) {
        _store.runMatches = []
    }

    const matches = []
    if (!_config || !_config.feedback) return matches

    for (const entry of _config.feedback) {
        if (!entry.when.includes('edit')) continue
        const p = entry.pattern

        if (p.type === 'regex' || p.type === 'string' || p.type === 'ast') {
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
                            const readVal = await window.FileManager.read(normalizedTarget)
                            if (readVal != null) contentToCheck = String(readVal)
                        }
                    }
                } catch (_e) { }

                if (p.type === 'string') {
                    // For string matching, check the entire content
                    const m = await _applyPattern(p, contentToCheck)
                    if (m) {
                        matches.push({ file: (targetFile.startsWith('/') ? targetFile : ('/' + targetFile)), message: _formatMessage(entry.message, m), id: entry.id })
                    }
                } else if (p.type === 'ast') {
                    // For AST matching, analyze the entire content
                    const m = await _applyPattern(p, contentToCheck)
                    if (m) {
                        matches.push({ file: (targetFile.startsWith('/') ? targetFile : ('/' + targetFile)), message: _formatMessage(entry.message, m), id: entry.id })
                    }
                } else {
                    // For regex, continue line-by-line matching for better location reporting
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
                }
            } else if (p.target === 'filename') {
                // For filename-target rules on edit, treat this as an
                // existence check for the filename specified by the
                // pattern (fileTarget preferred, otherwise expression).
                const desired = (p.fileTarget && String(p.fileTarget).trim()) || (p.expression && String(p.expression).trim()) || ''
                if (!desired) continue
                const normDesired = normalizeFilename(desired)

                // Check current edited path first
                const currentPathNorm = path ? normalizeFilename(path) : ''
                let found = false
                if (currentPathNorm && (currentPathNorm === normDesired || currentPathNorm === desired || String(path) === desired)) {
                    found = true
                }

                // Try browser FileManager.read
                if (!found && typeof window !== 'undefined') {
                    try {
                        if (window.FileManager && typeof window.FileManager.read === 'function') {
                            const readVal = await window.FileManager.read(normDesired)
                            if (readVal != null) found = true
                        }
                    } catch (_e) { }

                    // No legacy in-memory fallback: rely on FileManager or Node fs.
                }

                // Try Node fs for server-side
                if (!found) {
                    try {
                        if (typeof require === 'function') {
                            const fs = require('fs')
                            const pathModule = require('path')
                            const p1 = normDesired
                            const p2 = normDesired.replace(/^\//, '')
                            if (fs.existsSync(p1) || fs.existsSync(p2) || fs.existsSync(pathModule.join(process.cwd(), p2))) {
                                found = true
                            }
                        }
                    } catch (_e) { }
                }

                if (found) {
                    matches.push({ file: desired, message: _formatMessage(entry.message, []), id: entry.id })
                }
            }
        }
    }

    // Preserve any filename matches that were added by file-event handlers
    try {
        const prev = _store.editMatches || []
        const prevFileMatches = prev.filter(m => m && m.file && typeof m.file === 'string')
        // Avoid duplicating entries: keep newly computed matches first, then append any prev file matches not present
        const merged = [].concat(matches)
        for (const fm of prevFileMatches) {
            const dup = merged.find(mm => mm && mm.id === fm.id && mm.file === fm.file)
            if (!dup) merged.push(fm)
        }
        _store.editMatches = merged
    } catch (_e) {
        _store.editMatches = matches
    }

    // Emit combined matches (edit + run) so listeners receive updates
    const combined = [].concat(_store.editMatches || [], _store.runMatches || [])
    _store.matches = combined
    try { emit('matches', combined) } catch (_e) { /* swallow listener errors */ }

    // Return the effective edit matches (merged with file-event matches)
    return _store.editMatches
}

async function evaluateFeedbackOnRun(ioCapture) {
    const matches = []
    if (!_config || !_config.feedback) return matches

    for (const entry of _config.feedback) {
        if (!entry.when.includes('run') && !entry.when.includes('test')) continue
        const p = entry.pattern

        if (p.type === 'regex' || p.type === 'string' || p.type === 'ast') {
            const target = p.target
            if (target === 'filename') {
                // Intended behavior: check whether a filename exists in the
                // workspace. The rule is true if the filename (from the
                // pattern) exists among the runner-provided filenames or in
                // the workspace storage. Determine the filename to look for
                // from pattern.fileTarget or pattern.expression.
                const desired = (p.fileTarget && String(p.fileTarget).trim()) || (p.expression && String(p.expression).trim()) || ''
                if (!desired) continue

                // Normalize candidate filenames from ioCapture (array or newline-joined string)
                const filenamesVal = (ioCapture && ioCapture.filename) || ''
                let candidates = []
                if (Array.isArray(filenamesVal)) {
                    candidates = filenamesVal.map(f => String(f || '').trim()).filter(Boolean)
                } else if (typeof filenamesVal === 'string') {
                    candidates = String(filenamesVal || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean)
                }

                // Normalize desired for comparison: allow leading slash variations
                const normDesired = desired.startsWith('/') ? desired : ('/' + desired.replace(/^\/+/, ''))

                // First, check if the runner reported the filename
                let found = candidates.find(fn => {
                    if (!fn) return false
                    const norm = String(fn).startsWith('/') ? String(fn) : ('/' + String(fn).replace(/^\/+/, ''))
                    return norm === normDesired || norm === desired || String(fn) === desired
                }) || null

                // If not reported, check workspace/storage for existence of the file
                if (!found) {
                    // Try Node.js fs (for server-side environment)
                    try {
                        if (typeof require === 'function') {
                            const fs = require('fs')
                            const pathModule = require('path')
                            // Check both with and without leading slash
                            const p1 = normDesired
                            const p2 = normDesired.replace(/^\//, '')
                            if (fs.existsSync(p1) || fs.existsSync(p2) || fs.existsSync(pathModule.join(process.cwd(), p2))) {
                                found = normDesired
                            }
                        }
                    } catch (_e) { /* ignore */ }

                    // Try browser FileManager.read
                    if (!found && typeof window !== 'undefined') {
                        try {
                            const normalizedTarget = normDesired
                            if (window.FileManager && typeof window.FileManager.read === 'function') {
                                const readVal = await window.FileManager.read(normalizedTarget)
                                if (readVal != null) found = normalizedTarget
                            }
                        } catch (_e) { }

                        // Rely on FileManager for existence checks in browser.
                        try {
                            const normalizedTarget = normDesired
                            if (window.FileManager && typeof window.FileManager.read === 'function') {
                                const readVal = await window.FileManager.read(normalizedTarget)
                                if (readVal != null) found = normalizedTarget
                            }
                        } catch (_e) { }
                    }
                }

                if (found) {
                    matches.push({ message: _formatMessage(entry.message, []), id: entry.id, target, filename: found })
                }
            } else {
                // If the pattern is scoped to a specific file (fileTarget),
                // ensure that the run produced/covered that filename before
                // attempting to match stdout/stderr content. `ioCapture.filename`
                // may be an array (multiple files) or a newline-joined string.
                if (p.fileTarget && p.fileTarget.trim()) {
                    const wanted = String(p.fileTarget || '').replace(/^\/*/, '/')
                    let filenamesVal = (ioCapture && ioCapture.filename) || ''
                    // If the runner did not provide any filename information
                    // (empty string or empty array), treat this as unknown and
                    // allow matching to proceed. This handles runners that do
                    // not report covered filenames but still emit stderr/stdout.
                    const filenamesProvided = (Array.isArray(filenamesVal) && filenamesVal.length > 0) || (typeof filenamesVal === 'string' && String(filenamesVal).trim().length > 0)
                    let found = false
                    try {
                        if (!filenamesProvided) {
                            // No filenames reported -> allow match attempt
                            found = true
                        } else if (Array.isArray(filenamesVal)) {
                            for (const fn of filenamesVal) {
                                if (!fn) continue
                                const norm = String(fn).startsWith('/') ? String(fn) : ('/' + String(fn).replace(/^\/+/, ''))
                                if (norm === wanted || norm === String(p.fileTarget)) { found = true; break }
                            }
                        } else {
                            const parts = String(filenamesVal || '').split(/\r?\n/).map(x => x.trim()).filter(x => x)
                            for (const fn of parts) {
                                const norm = String(fn).startsWith('/') ? String(fn) : ('/' + String(fn).replace(/^\/+/, ''))
                                if (norm === wanted || norm === String(p.fileTarget)) { found = true; break }
                            }
                        }
                    } catch (_e) { found = false }
                    if (!found) {
                        try {
                            const dbgEnabled = (typeof window !== 'undefined' && window.__ssg_feedback_debug)
                            if (dbgEnabled) {
                                const info = { id: entry.id, reason: 'skipped_fileTarget_mismatch', wanted: p.fileTarget, filenames: ioCapture && ioCapture.filename }
                                try { emit('debug', info) } catch (_e) { }
                                try { console.debug && console.debug('[Feedback debug] skipped fileTarget mismatch:', info) } catch (_e) { }
                            }
                        } catch (_e) { }
                        continue
                    }
                }

                const text = String((ioCapture && ioCapture[target]) || '')
                const m = await _applyPattern(p, text)
                // Optional debug emission: help troubleshoot why a rule didn't match
                try {
                    const dbgEnabled = (typeof window !== 'undefined' && window.__ssg_feedback_debug)
                    if (!m && dbgEnabled) {
                        emit('debug', { id: entry.id, reason: 'pattern_no_match', target, textSample: (text || '').slice(0, 200), fileTarget: p.fileTarget || null, filenames: ioCapture && ioCapture.filename })
                    }
                } catch (_e) { }
                if (m) {
                    matches.push({ message: _formatMessage(entry.message, m), id: entry.id, target })
                    try { if (typeof window !== 'undefined' && window.__ssg_feedback_debug) emit('debug', { id: entry.id, reason: 'matched', target, groups: m }) } catch (_e) { }
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
const Feedback = { resetFeedback, evaluateFeedbackOnEdit, evaluateFeedbackOnRun, evaluateFeedbackOnFileEvent, on, off, validateConfig }

if (typeof module !== 'undefined' && module.exports) module.exports = Feedback

export { resetFeedback, evaluateFeedbackOnEdit, evaluateFeedbackOnRun, evaluateFeedbackOnFileEvent, on, off, validateConfig }
