import { validateAndNormalizeConfig } from './config.js'
import { saveAuthorConfigToLocalStorage, getAuthorConfigFromLocalStorage, clearAuthorConfigInLocalStorage, saveDraft, listDrafts, loadDraft, deleteDraft, findDraftByConfigIdAndVersion } from './author-storage.js'
import { initAuthorFeedback } from './author-feedback.js'
import { initAuthorTests } from './author-tests.js'
import { showConfirmModal, openModal, closeModal, showInputModal } from './modals.js'
import { debug as logDebug, warn as logWarn, error as logError } from './logger.js'
import { renderMarkdown, sanitizeHtml, setInnerHTML } from './utils.js'
import { initVerificationTab, renderStudentsList } from './author-verification.js'
import { loadConfigFromFile, loadConfigFromStringOrUrl } from './config.js'
import { TabOverflowManager } from './tab-overflow-manager.js'

function $(id) { return document.getElementById(id) }

let editor = null
let files = {} // map path -> content or { content, binary, mime }
let fileReadOnlyStatus = {} // map path -> boolean (true if read-only)
let currentFile = '/main.py'
let suppressOpenFileFocus = false
let authorOverflowManager = null // TabOverflowManager instance for author page
let autosaveTimer = null
let suppressAutosave = false  // Flag to prevent autosave during restore/import operations
const AUTOSAVE_DELAY = 500
const BINARY_LIMIT = 204800 // 200KB

function debounceSave() {
    if (suppressAutosave) {
        return
    }
    if (autosaveTimer) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => saveToLocalStorage(), AUTOSAVE_DELAY)
}

// Semantic numeric version validation: accepts 1, 1.2, or 1.2.3 where each
// segment is a non-negative integer (no leading plus/minus). Returns boolean.
function isValidMetaVersion(v) {
    if (typeof v !== 'string') return false
    const s = v.trim()
    if (!s) return false
    // Accepts major, major.minor, major.minor.patch
    const re = /^\d+(?:\.\d+){0,2}$/
    return re.test(s)
}

function showMetaVersionError(show, message) {
    const el = $('meta-version-error')
    if (!el) return
    if (show) {
        el.style.display = 'block'
        el.textContent = message || 'Version must be numeric: major, major.minor, or major.minor.patch (e.g. 1, 1.0, 1.0.2)'
    } else {
        el.style.display = 'none'
    }
}

// ID validation: no whitespace allowed. Returns boolean.
function isValidMetaId(id) {
    if (typeof id !== 'string') return false
    const s = id.trim()
    if (!s) return false
    // Allow A-Z a-z 0-9 . - _ and restrict length to 1..64 characters
    // This avoids problematic filename characters like / \ @ spaces and more
    const re = /^[A-Za-z0-9._-]{1,64}$/
    return re.test(s)
}

function showMetaIdError(show, message) {
    const el = $('meta-id-error')
    if (!el) return
    if (show) {
        el.style.display = 'block'
        el.textContent = message || 'ID must be 1–64 characters using only letters, numbers, dot, hyphen or underscore (A-Z a-z 0-9 . - _). No spaces or special path characters.'
    } else {
        el.style.display = 'none'
    }
}

function loadEditor() {
    const ta = $('file-editor')
    try {
        editor = CodeMirror.fromTextArea(ta, {
            lineNumbers: true,
            mode: 'python',
            gutters: ['CodeMirror-linenumbers'],
            fixedGutter: true,
            lineNumberFormatter: function (line) {
                return String(line);
            },
            indentUnit: 4,
            smartIndent: true,
            scrollbarStyle: 'native',
            // Wrap long lines so the editor doesn't expand horizontally
            lineWrapping: true
        })
        // store CM instance for tests to access if needed
        try { window.__author_code_mirror = editor } catch (_e) { }
        editor.on('change', () => {
            const val = editor.getValue()
            files[currentFile] = String(val)
            debounceSave()
        })
        // ensure initial layout is correct
        try { if (editor && typeof editor.refresh === 'function') editor.refresh() } catch (_e) { }
    } catch (e) {
        logWarn('CodeMirror not available, falling back to textarea')
        ta.addEventListener('input', () => {
            files[currentFile] = ta.value
            debounceSave()
        })
    }
}

function renderFileList() {
    // If an author-specific overflow manager exists, delegate rendering to it
    try {
        if (authorOverflowManager && typeof authorOverflowManager.render === 'function') {
            // Ensure read-only checks are up-to-date
            try { authorOverflowManager.isFileReadOnly = (path) => !!fileReadOnlyStatus[path] } catch (_e) { }
            try { authorOverflowManager.render(Object.keys(files), currentFile); return } catch (_e) { /* fall back */ }
        }
    } catch (_e) { }

    // Fallback: Render as simple tabs (legacy author UI)
    const tabs = $('file-tabs')
    // clear children safely
    if (tabs) while (tabs.firstChild) tabs.removeChild(tabs.firstChild)
    for (const p of Object.keys(files)) {
        const tab = document.createElement('div')
        tab.className = 'tab' + (p === currentFile ? ' active' : '')
        tab.style.display = 'inline-flex'
        tab.style.alignItems = 'center'
        tab.style.gap = '4px'
        tab.style.padding = '6px 8px'
        tab.style.border = '1px solid #ddd'
        tab.style.borderRadius = '4px'
        tab.style.background = p === currentFile ? '#f0f8ff' : '#fff'
        tab.style.cursor = 'pointer'
        tab.style.marginRight = '4px'
        tab.style.marginBottom = '4px'

        const label = document.createElement('span')
        label.textContent = p
        label.style.fontSize = '0.9em'

        // Add read-only indicator
        if (fileReadOnlyStatus[p]) {
            label.style.fontStyle = 'italic'
            label.style.color = '#666'
        } else {
            label.style.fontStyle = 'normal'
            label.style.color = 'inherit'
        }

        tab.appendChild(label)

        // Add read-only icon if applicable
        if (fileReadOnlyStatus[p]) {
            const readOnlyIcon = document.createElement('span')
            readOnlyIcon.textContent = '🔒'
            readOnlyIcon.title = 'Read-only file'
            readOnlyIcon.style.fontSize = '0.8em'
            readOnlyIcon.style.opacity = '0.7'
            tab.appendChild(readOnlyIcon)
        }

        // Add close button (except for /main.py)
        if (p !== '/main.py') {
            const close = document.createElement('button')
            close.className = 'close'
            close.textContent = '×'
            close.title = 'Delete file'
            close.style.border = 'none'
            close.style.background = 'none'
            close.style.cursor = 'pointer'
            close.style.fontSize = '16px'
            close.style.lineHeight = '1'
            close.style.padding = '0 2px'
            close.style.marginLeft = '4px'
            close.style.color = '#666'
            close.addEventListener('click', (ev) => {
                ev.stopPropagation()
                deleteFile(p)
            })
            close.addEventListener('mouseenter', () => {
                close.style.color = '#d32f2f'
            })
            close.addEventListener('mouseleave', () => {
                close.style.color = '#666'
            })
            tab.appendChild(close)
        }

        tab.addEventListener('click', () => openFile(p))
        tabs.appendChild(tab)
    }
}

function openFile(path, force = false) {
    // When suppressed, ignore non-forced open requests so imports or file
    // creation flows don't steal focus; callers can pass force=true to
    // explicitly open.
    if (suppressOpenFileFocus && !force) return
    currentFile = path
    $('editor-current-file').textContent = path

    // Re-render the file list so any tab manager can mark the active tab.
    try { renderFileList() } catch (_e) { }

    // Update read-only toggle
    const readOnlyToggle = $('readonly-toggle')
    if (readOnlyToggle) {
        readOnlyToggle.checked = fileReadOnlyStatus[path] || false
    }

    const content = files[path]
    if (typeof content === 'string') {
        if (editor) editor.setValue(content)
        else $('file-editor').value = content
    } else if (content && content.binary) {
        // binary preview: show metadata and disable editing
        const text = `-- binary file (${content.mime || 'application/octet-stream'}), ${content.content ? Math.ceil((content.content.length * 3) / 4) : 0} bytes base64 --`
        if (editor) editor.setValue(text)
        else $('file-editor').value = text
    }
}

function deleteFile(path) {
    // Don't allow deleting main.py
    if (path === '/main.py') {
        alert('Cannot delete the main.py file')
        return
    }

    if (!confirm(`Delete file "${path}"?`)) {
        return
    }

    // Remove from files object
    delete files[path]

    // If the deleted file was currently open, switch to main.py or first available file
    if (currentFile === path) {
        if (files['/main.py']) {
            openFile('/main.py', true)
        } else {
            const firstFile = Object.keys(files)[0]
            if (firstFile) {
                openFile(firstFile, true)
            } else {
                // No files left, create a new main.py
                files['/main.py'] = '# starter code\n'
                openFile('/main.py', true)
            }
        }
    }

    // Re-render the file list and save immediately (not debounced)
    renderFileList()
    saveToLocalStorage()
}

async function renameAuthorFile(oldPath, newPath) {
    try {
        // Check if new path already exists
        if (files[newPath]) {
            throw new Error('File already exists: ' + newPath)
        }

        // Move content and read-only status
        files[newPath] = files[oldPath]
        fileReadOnlyStatus[newPath] = fileReadOnlyStatus[oldPath] || false

        // Remove old file
        delete files[oldPath]
        delete fileReadOnlyStatus[oldPath]

        // Update current file reference if needed
        if (currentFile === oldPath) {
            currentFile = newPath
            openFile(newPath)
        }

        renderFileList()
        saveToLocalStorage()
        return true
    } catch (e) {
        console.error('File rename failed:', e)
        alert('Rename failed: ' + e.message)
        return false
    }
}

async function saveToLocalStorage() {
    try {
        const cfg = buildCurrentConfig()
        // Ensure runtime entry exists and prefers the .mjs module loader
        try {
            if (!cfg.runtime) cfg.runtime = { type: 'micropython', url: './vendor/micropython.mjs' }
            if (cfg.runtime && cfg.runtime.url && typeof cfg.runtime.url === 'string') {
                if (cfg.runtime.url.trim().endsWith('.wasm')) {
                    cfg.runtime.url = cfg.runtime.url.trim().replace(/\.wasm$/i, '.mjs')
                }
            }
        } catch (_e) { }
        // If the feedback field is a JSON string representing an array,
        // prefer storing it as structured JSON so the app receives the
        // normalized shape. If parsing fails, keep the raw string.
        try {
            if (typeof cfg.feedback === 'string' && cfg.feedback.trim()) {
                const parsed = JSON.parse(cfg.feedback)
                if (Array.isArray(parsed)) cfg.feedback = parsed
            }
            // Likewise, parse tests if the textarea contains a JSON structure so
            // the saved author_config carries the tests as a structured object/array
            // (the main app expects cfg.tests to be structured when running tests).
            if (typeof cfg.tests === 'string' && cfg.tests.trim()) {
                const parsedTests = JSON.parse(cfg.tests)
                // Handle both legacy format (array) and new grouped format (object)
                if (Array.isArray(parsedTests) || (parsedTests && (parsedTests.groups || parsedTests.ungrouped))) {
                    cfg.tests = parsedTests
                }
            }
        } catch (_e) { /* keep raw string if invalid JSON */ }
        // try to validate/normalize but don't block autosave on failure
        try {
            // Do not add or modify runtime.url from the authoring UI.
            // Authors should not be able to change which runtime the app uses.
            // Ensure any runtime field is removed before validation so the
            // normalized config uses the app's vendored runtime by default.
            if (cfg && cfg.runtime) {
                try { delete cfg.runtime.url } catch (_e) { }
            }
            const norm = validateAndNormalizeConfig(cfg)
            // Await the async save when unified-storage is available so
            // writes complete before navigation away from the page.
            try { await saveAuthorConfigToLocalStorage(norm) } catch (_e) { /* best-effort */ }
            // Validation passed; nothing to show in UI (author view removed)
        } catch (e) {
            // keep raw config but persist; try adapter save (may fail in some environments)
            try { await saveAuthorConfigToLocalStorage(cfg) } catch (_e) { /* best-effort: do not write to localStorage in production */ }
            console.warn('Author config validation failed (autosave preserved raw config):', e && e.message ? e.message : e)
        }
    } catch (e) { logError('autosave failed', e) }
}

function buildCurrentConfig() {
    const title = $('meta-title').value || ''
    const id = $('meta-id').value || ''
    const version = $('meta-version').value || ''
    const description = $('meta-description') ? $('meta-description').value || '' : ''
    const instructions = $('instructions-editor') ? $('instructions-editor').value || '' : ''
    const feedbackRaw = $('feedback-editor') ? $('feedback-editor').value || '' : ''
    const testsRaw = $('tests-editor') ? $('tests-editor').value || '' : ''
    const starter = files['/main.py'] || ''
    const cfg = { id, title, version, description, instructions, feedback: feedbackRaw, tests: testsRaw, starter, files, fileReadOnlyStatus }
    return cfg
}

async function restoreFromLocalStorage() {
    suppressAutosave = true  // Prevent autosave during restore

    const raw = await getAuthorConfigFromLocalStorage()
    if (!raw) {
        // initialize defaults
        files = { '/main.py': '# starter code\n' }
        fileReadOnlyStatus = {}
        renderFileList()
        openFile('/main.py')
        suppressAutosave = false  // Re-enable autosave
        return
    }
    try {
        // raw may be normalized or raw shape
        files = raw.files || { '/main.py': raw.starter || '# starter code\n' }
        fileReadOnlyStatus = raw.fileReadOnlyStatus || {}
        $('meta-title').value = raw.title || ''
        $('meta-id').value = raw.id || ''
        $('meta-version').value = raw.version || ''
        // Validate version UI after restore
        try { const ok = isValidMetaVersion(String($('meta-version').value || '')); showMetaVersionError(!ok) } catch (_e) { }
        // Validate ID UI after restore
        try { const okId = isValidMetaId(String($('meta-id').value || '')); showMetaIdError(!okId) } catch (_e) { }
        if ($('meta-description')) $('meta-description').value = raw.description || ''
        if ($('instructions-editor')) $('instructions-editor').value = raw.instructions || ''
        if ($('feedback-editor')) {
            try {
                // If feedback was stored as an array/object, stringify it for the textarea
                if (raw.feedback && typeof raw.feedback !== 'string') {
                    $('feedback-editor').value = JSON.stringify(raw.feedback, null, 2)
                } else {
                    $('feedback-editor').value = raw.feedback || ''
                }
            } catch (_e) { $('feedback-editor').value = raw.feedback || '' }
        }
        if ($('tests-editor')) {
            try {
                if (raw.tests && typeof raw.tests !== 'string') {
                    $('tests-editor').value = JSON.stringify(raw.tests, null, 2)
                } else {
                    $('tests-editor').value = raw.tests || ''
                }
            } catch (_e) { $('tests-editor').value = raw.tests || '' }
        }
    } catch (e) { files = { '/main.py': '# starter code\n' }; fileReadOnlyStatus = {} }
    // Prevent any file-creation flows triggered during render from stealing focus
    suppressOpenFileFocus = true
    try {
        renderFileList()
        // After rendering, explicitly open /main.py if present, otherwise open first
        if (files['/main.py']) openFile('/main.py', true)
        else openFile(Object.keys(files)[0] || '/main.py', true)
    } finally {
        // Allow normal openFile behavior again
        suppressOpenFileFocus = false
        // Re-enable autosave after restore is complete
        suppressAutosave = false
    }
    // render preview
    try { updateInstructionsPreview() } catch (_e) { }
}

function updateInstructionsPreview() {
    const ta = $('instructions-editor')
    const preview = $('instructions-preview')
    if (!preview) return
    const md = ta ? ta.value || '' : ''
    try {
        // prefer local renderer from utils to keep consistent behavior
        const html = renderMarkdown(md)
        // Use centralized helper for DOM insertion so sanitization + fallback are consistent
        try { setInnerHTML(preview, html) } catch (_e) { preview.textContent = md }
        // highlight code blocks if highlight.js available
        try { if (window.hljs && typeof window.hljs.highlightAll === 'function') window.hljs.highlightAll() } catch (_e) { }
    } catch (e) {
        preview.textContent = md
    }
}

function isTextFile(file) {
    // Check MIME type first
    if (file.type.startsWith('text/')) return true
    if (file.type === 'application/json') return true
    if (file.type === 'application/javascript') return true
    if (file.type === 'application/xml') return true

    // Check file extension for common text files
    const name = file.name.toLowerCase()
    const textExtensions = [
        '.txt', '.py', '.js', '.json', '.xml', '.html', '.htm', '.css', '.scss', '.sass',
        '.md', '.markdown', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf',
        '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
        '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx',
        '.java', '.kt', '.go', '.rs', '.swift', '.php', '.rb', '.pl', '.lua',
        '.r', '.sql', '.csv', '.tsv', '.log', '.dockerfile', '.gitignore',
        '.env', '.example', '.sample', '.template'
    ]

    if (textExtensions.some(ext => name.endsWith(ext))) return true

    // If no extension and MIME type is empty (common for text files on some systems)
    if (file.type === '' && !name.includes('.')) return true

    return false
}

async function handleUpload(ev) {
    const f = ev.target.files && ev.target.files[0]
    if (!f) return
    if (f.size > BINARY_LIMIT) {
        alert('Binary too large (>200KB). Please host externally or reduce size.')
        return
    }

    if (isTextFile(f)) {
        try {
            const txt = await f.text()
            files['/' + f.name] = txt
            renderFileList()
            openFile('/' + f.name)
            debounceSave()
            return
        } catch (e) {
            logWarn('Failed to read as text file, treating as binary:', e)
            // Fall through to binary handling
        }
    }

    // binary
    const ab = await f.arrayBuffer()
    const b64 = arrayBufferToBase64(ab)
    files['/' + f.name] = { content: b64, binary: true, mime: f.type || 'application/octet-stream' }
    renderFileList()
    openFile('/' + f.name)
    debounceSave()
}

function arrayBufferToBase64(buffer) {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
}

function setupHandlers() {
    // Tab switching: delegate to showTab so code-tab refresh logic runs
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', (ev) => {
        const tab = b.dataset.tab
        try { showTab(tab) } catch (_e) { }
    }))

    function showTab(tab) {
        document.querySelectorAll('.author-tab').forEach(t => t.classList.remove('active'))
        const el = document.getElementById('tab-' + tab)
        if (el) el.classList.add('active')
        document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'))
        const btn = document.querySelector('.tab-btn[data-tab="' + tab + '"]')
        if (btn) btn.classList.add('active')
        // If switching to the code tab, refresh CodeMirror so it lays out gutters and content
        if (tab === 'code') {
            // refresh after a tiny delay so the editor can measure its container
            setTimeout(() => {
                try { if (editor && typeof editor.refresh === 'function') editor.refresh() } catch (_e) { }
                try { openFile(currentFile) } catch (_e) { }
            }, 40)
        }
        // If switching to verification tab, update codes with current config
        if (tab === 'verification') {
            setTimeout(updateVerificationCodes, 40)
        }
    }

    // Metadata & editors
    $('meta-title').addEventListener('input', () => { debounceSave(); updateVerificationCodesDebounced(); })
    $('meta-id').addEventListener('input', () => {
        const v = $('meta-id').value || ''
        const ok = isValidMetaId(v)
        if (!ok) showMetaIdError(true)
        else showMetaIdError(false)
        debounceSave(); updateVerificationCodesDebounced();
    })
    // Validate meta-version on the fly and show helpful UI
    $('meta-version').addEventListener('input', () => {
        const v = $('meta-version').value || ''
        const ok = isValidMetaVersion(v)
        if (!ok) showMetaVersionError(true)
        else showMetaVersionError(false)
        debounceSave(); updateVerificationCodesDebounced();
    })
    if ($('meta-description')) $('meta-description').addEventListener('input', debounceSave)
    if ($('instructions-editor')) {
        $('instructions-editor').addEventListener('input', () => { debounceSave(); try { updateInstructionsPreview() } catch (_e) { } })
    }
    if ($('feedback-editor')) $('feedback-editor').addEventListener('input', debounceSave)
    if ($('tests-editor')) $('tests-editor').addEventListener('input', () => {
        debounceSave();
        updateVerificationCodesDebounced();
    })
    $('add-file').addEventListener('click', async () => {
        try {
            const name = await showInputModal('New file', 'File path (e.g. /lib/util.py)', '')
            logDebug('[author-page] add-file clicked, modal ->', name)
            if (!name) return
            files[name] = ''
            logDebug('[author-page] files after add:', Object.keys(files))
            renderFileList()
            openFile(name)
            debounceSave()
        } catch (e) {
            logWarn('add-file modal failed', e)
        }
    })
    logDebug('[author-page] setupHandlers: add-file listener attached')

    // Initialize TabOverflowManager for author page using standard constructor
    // TabOverflowManager is initialized earlier during DOMContentLoaded so
    // we don't need to initialize it here. If it failed to initialize earlier,
    // renderFileList() will fall back to the legacy renderer.

    $('file-upload').addEventListener('change', handleUpload)

    // Read-only toggle handler
    $('readonly-toggle').addEventListener('change', (ev) => {
        if (currentFile) {
            fileReadOnlyStatus[currentFile] = ev.target.checked
            renderFileList()  // Re-render tabs to show/hide read-only indicator
            debounceSave()
        }
    })

    // Back to app navigation with session flag
    $('back-to-app').addEventListener('click', async () => {
        try {
            // Try to flush a final save to storage before navigating back so
            // the main page can observe the latest author_config.
            try {
                const cfg = buildCurrentConfig()
                await saveAuthorConfigToLocalStorage(cfg)
                // Intentionally do NOT save this authored config as the app's
                // current configuration here. Applying an authored config to
                // the running app should be an explicit user action via the
                // config modal ("Use in app"), otherwise navigating back
                // would unexpectedly overwrite the user's current workspace.
            } catch (_e) { /* best-effort - ignore save errors and continue navigation */ }

            // Set flag for return detection
            sessionStorage.setItem('returningFromAuthor', 'true')
            // Navigate back to main app
            window.location.href = '../index.html?author'
        } catch (e) {
            logError('Failed to navigate back to app:', e)
            // Fallback navigation
            window.location.href = '../index.html?author'
        }
    })

    // New: clear current authoring configuration and reset UI
    $('new-config').addEventListener('click', async () => {
        let ok = false
        try {
            ok = await showConfirmModal('New configuration', 'This will clear the current authoring configuration and start a new empty one. Continue?')
        } catch (e) {
            try { ok = window.confirm('This will clear the current authoring configuration and start a new empty one. Continue?') } catch (_e) { ok = false }
        }
        if (!ok) return
        // clear persisted configuration
        try { await clearAuthorConfigInLocalStorage() } catch (_e) { }
        // reset fields
        files = { '/main.py': '# starter code\n' }
        fileReadOnlyStatus = {}
        renderFileList()
        openFile('/main.py')
        $('meta-title').value = ''
        $('meta-id').value = ''
        $('meta-version').value = ''
        // Hide validation UI when resetting fields
        try { showMetaIdError(false); showMetaVersionError(false) } catch (_e) { }
        if ($('meta-description')) $('meta-description').value = ''
        if ($('instructions-editor')) $('instructions-editor').value = ''
        if ($('feedback-editor')) { $('feedback-editor').value = ''; $('feedback-editor').dispatchEvent(new Event('input', { bubbles: true })) }
        if ($('tests-editor')) { $('tests-editor').value = ''; $('tests-editor').dispatchEvent(new Event('input', { bubbles: true })) }
        debounceSave()
    })
    // Export: download current config as JSON
    $('export-btn').addEventListener('click', () => {
        try {
            const cfg = buildCurrentConfig()
            // Validate version before exporting
            if (!isValidMetaVersion(String(cfg.version || ''))) {
                alert('Cannot export: invalid version. Version must be numeric (e.g. 1, 1.0, 1.2.3).')
                return
            }
            // Validate ID before exporting
            if (!isValidMetaId(String(cfg.id || ''))) {
                alert('Cannot export: invalid ID. Use 1–64 characters: letters, numbers, dot, hyphen or underscore.')
                return
            }
            // ensure feedback/tests parsed into structured arrays when possible
            try {
                if (typeof cfg.feedback === 'string' && cfg.feedback.trim()) {
                    const parsed = JSON.parse(cfg.feedback)
                    if (Array.isArray(parsed)) cfg.feedback = parsed
                }
            } catch (_e) { }
            try {
                if (typeof cfg.tests === 'string' && cfg.tests.trim()) {
                    const parsed = JSON.parse(cfg.tests)
                    // Handle both legacy format (array) and new grouped format (object)
                    if (Array.isArray(parsed) || (parsed && (parsed.groups || parsed.ungrouped))) {
                        cfg.tests = parsed
                    }
                }
            } catch (_e) { }
            const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            // include id and version in filename: "config_id@version.json"
            // Create safe filename parts: replace any characters not in the
            // allowed set with underscores and trim to reasonable length.
            const safeId = String(cfg.id || 'config')
            const idPart = safeId.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 64)
            const safeVer = String(cfg.version || 'v0')
            const verPart = safeVer.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 64)
            a.download = `${idPart}@${verPart}.json`
            document.body.appendChild(a)
            a.click()
            setTimeout(() => { try { URL.revokeObjectURL(url); a.remove() } catch (_e) { } }, 500)
        } catch (e) { alert('Export failed: ' + (e && e.message ? e.message : e)) }
    })

    // Import flow: open file picker, parse JSON, confirm overwrite, then load and sync
    $('import-btn').addEventListener('click', () => {
        $('import-file').click()
    })
    $('import-file').addEventListener('change', async (ev) => {
        const f = ev.target.files && ev.target.files[0]
        // clear input so same file can be picked later
        ev.target.value = ''
        if (!f) return
        try {
            const txt = await f.text()
            let parsed = null
            try { parsed = JSON.parse(txt) } catch (e) { alert('Invalid JSON file: ' + (e && e.message ? e.message : e)); return }
            // confirm overwrite using styled modal (fallback to window.confirm)
            let ok = false
            try {
                ok = await showConfirmModal('Import configuration', 'This will overwrite the current author configuration in this page and in storage. Continue?')
            } catch (e) {
                try { ok = window.confirm('This will overwrite the current author configuration in this page and in storage. Continue?') } catch (_e) { ok = false }
            }
            if (!ok) return
            // apply the parsed config
            try { logDebug('[author] applying imported config', parsed); await applyImportedConfig(parsed) } catch (e) { alert('Failed to apply config: ' + (e && e.message ? e.message : e)); return }
            // After applying, show a simple modal indicating success and a close-only button.
            try {
                const modal = document.createElement('div')
                modal.className = 'modal'
                modal.setAttribute('aria-hidden', 'true')
                const content = document.createElement('div')
                content.className = 'modal-content'
                const header = document.createElement('div')
                header.className = 'modal-header'
                const h3 = document.createElement('h3')
                h3.textContent = 'Import complete'
                header.appendChild(h3)
                content.appendChild(header)
                const body = document.createElement('div')
                body.style.marginTop = '8px'
                body.textContent = 'Configuration loaded into the author page and saved.'
                content.appendChild(body)
                const actions = document.createElement('div')
                actions.className = 'modal-actions'
                const close = document.createElement('button')
                close.className = 'btn modal-close-btn'
                close.textContent = 'Close'
                actions.appendChild(close)
                content.appendChild(actions)
                modal.appendChild(content)
                document.body.appendChild(modal)
                try { openModal(modal) } catch (_e) { modal.setAttribute('aria-hidden', 'false'); modal.style.display = 'flex' }
                close.addEventListener('click', () => { try { closeModal(modal) } catch (_e) { modal.remove() } })
            } catch (_e) { /* ignore */ }
        } catch (e) { alert('Failed to read file: ' + (e && e.message ? e.message : e)) }
    })

    // Draft functionality using imported storage functions
    $('save-draft').addEventListener('click', async () => {
        try {
            // Validate version before saving a draft
            const cfg = buildCurrentConfig()
            if (!isValidMetaVersion(String(cfg.version || ''))) {
                alert('Cannot save draft: invalid version. Version must be numeric (e.g. 1, 1.0, 1.2.3).')
                return
            }
            // Validate ID before saving a draft
            if (!isValidMetaId(String(cfg.id || ''))) {
                alert('Cannot save draft: invalid ID. Use 1–64 characters: letters, numbers, dot, hyphen or underscore.')
                return
            }
            await saveCurrentDraft()
        } catch (e) {
            alert('Failed to save draft: ' + (e && e.message ? e.message : e))
        }
    })

    $('load-draft').addEventListener('click', async () => {
        try {
            await openLoadDraftsModal()
        } catch (e) {
            alert('Failed to open drafts: ' + (e && e.message ? e.message : e))
        }
    })    // Load drafts modal close button
    const loadDraftsClose = $('load-drafts-close')
    if (loadDraftsClose) {
        loadDraftsClose.addEventListener('click', () => {
            closeLoadDraftsModal()
        })
    }

    // Save draft success modal close button
    const saveDraftSuccessClose = $('save-draft-success-close')
    if (saveDraftSuccessClose) {
        saveDraftSuccessClose.addEventListener('click', () => {
            closeSaveDraftSuccessModal()
        })
    }

    // Changelog modal
    $('changelog-btn').addEventListener('click', async () => {
        await openChangelogModal()
    })

    const changelogClose = $('changelog-close')
    if (changelogClose) {
        changelogClose.addEventListener('click', () => {
            closeChangelogModal()
        })
    }

    // Verification Load button and modal handlers
    const verificationLoadBtn = $('verification-load-btn')
    const verificationModal = $('verification-load-modal')
    const verificationClose = $('verification-load-close')
    const verificationDropArea = $('verification-drop-area')
    const verificationFileInput = $('verification-file-input')
    const verificationUrlInput = $('verification-url-input')
    const verificationLoadUrlBtn = $('verification-load-url')
    const verificationSelect = $('verification-config-select')
    const verificationFeedback = $('verification-load-feedback')

    if (verificationLoadBtn && verificationModal) {
        verificationLoadBtn.addEventListener('click', () => {
            try { openModal(verificationModal) } catch (_e) { verificationModal.style.display = 'flex'; verificationModal.setAttribute('aria-hidden', 'false') }
        })
    }
    if (verificationClose && verificationModal) {
        verificationClose.addEventListener('click', () => {
            try { closeModal(verificationModal) } catch (_e) { verificationModal.style.display = 'none'; verificationModal.setAttribute('aria-hidden', 'true') }
        })
    }

    // Drop area click opens file picker
    if (verificationDropArea && verificationFileInput) {
        verificationDropArea.addEventListener('click', () => verificationFileInput.click())
        verificationDropArea.addEventListener('dragover', (e) => { e.preventDefault(); verificationDropArea.style.borderColor = '#999' })
        verificationDropArea.addEventListener('dragleave', (e) => { e.preventDefault(); verificationDropArea.style.borderColor = '#ddd' })
        verificationDropArea.addEventListener('drop', async (e) => {
            e.preventDefault()
            verificationDropArea.style.borderColor = '#ddd'
            const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
            if (f) await handleVerificationFile(f)
        })
        verificationFileInput.addEventListener('change', async (e) => {
            const f = e.target.files && e.target.files[0]
            e.target.value = ''
            if (f) await handleVerificationFile(f)
        })
    }

    if (verificationLoadUrlBtn && verificationUrlInput) {
        verificationLoadUrlBtn.addEventListener('click', async () => {
            const url = (verificationUrlInput.value || '').trim()
            if (!url) {
                if (verificationFeedback) verificationFeedback.textContent = 'Please enter a URL.'
                return
            }
            try {
                if (verificationFeedback) verificationFeedback.textContent = 'Loading from URL...'
                const loaded = await loadConfigFromStringOrUrl(url)
                // normalize into external configs container
                setExternalVerificationConfigsFromLoaded(loaded, url)
                if (verificationFeedback) verificationFeedback.textContent = 'Loaded successfully.'
                try { closeModal(verificationModal) } catch (_e) { verificationModal.style.display = 'none' }
            } catch (e) {
                logError('Failed to load verification config from URL:', e)
                if (verificationFeedback) verificationFeedback.textContent = 'Failed to load URL: ' + (e && e.message ? e.message : e)
            }
        })
    }

    if (verificationSelect) {
        verificationSelect.addEventListener('change', () => {
            const v = verificationSelect.value
            if (!v) return
            // store selection and update verification codes
            try {
                if (v === '_authored') {
                    window.__author_verification_selected_external = null
                } else if (v === '_single') {
                    window.__author_verification_selected_external = '_single'
                } else {
                    // index
                    const idx = Number(v)
                    if (!Number.isNaN(idx)) window.__author_verification_selected_external = idx
                    else window.__author_verification_selected_external = null
                }
            } catch (_e) { window.__author_verification_selected_external = null }
            updateVerificationCodesDebounced()
        })
    }
}

// Handle reading a local file dropped/selected for verification loading
async function handleVerificationFile(file) {
    const feedbackEl = document.getElementById('verification-load-feedback')
    try {
        if (!file) throw new Error('No file selected')
        // Prefer using config manager's loader so validation/normalization runs
        let loaded = null
        try {
            loaded = await loadConfigFromFile(file)
        } catch (e) {
            // If loadConfigFromFile failed, fallback to raw parse to support config lists
            try {
                const txt = await file.text()
                loaded = JSON.parse(txt)
            } catch (e2) {
                throw e
            }
        }

        setExternalVerificationConfigsFromLoaded(loaded, file.name)
        if (feedbackEl) feedbackEl.textContent = 'File loaded successfully.'
        // close modal
        const modal = document.getElementById('verification-load-modal')
        try { closeModal(modal) } catch (_e) { if (modal) modal.style.display = 'none' }
    } catch (e) {
        logError('Failed to load verification file:', e)
        if (feedbackEl) feedbackEl.textContent = 'Failed to load file: ' + (e && e.message ? e.message : e)
    }
}

function setExternalVerificationConfigsFromLoaded(parsed, sourceName) {
    // parsed can be an array (list of configs), or object with .files/listName, or single config object
    const container = { source: sourceName }

    // Helper to check if an item is a playground config
    const isPlayground = (item) => {
        if (!item) return false
        if (typeof item === 'string') {
            return item === 'playground@1.0.json' || item === './config/playground@1.0.json' || item.includes('playground@1.0')
        }
        if (typeof item === 'object') {
            return item.id === 'playground' || item.id === 'playground@1.0.json'
        }
        return false
    }

    if (Array.isArray(parsed)) {
        // Filter out playground configs from arrays
        container.items = parsed.filter(item => !isPlayground(item))
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.files)) {
        // New configList shape: { listName?, files: [...] }
        // Filter out playground configs from the files array
        container.items = parsed.files.filter(item => !isPlayground(item))
        if (parsed.listName) container.listName = parsed.listName
    } else if (parsed && typeof parsed === 'object') {
        // Check if the single config is playground - if so, reject it
        if (isPlayground(parsed)) {
            throw new Error('Playground configs cannot be used for verification (they have no tests)')
        }
        container._single = parsed
    } else {
        throw new Error('Unsupported config format')
    }

    // store globally for the author page to access
    window.__author_verification_external_configs = container
    // default selection: single -> _single, list -> index 0
    if (container._single) window.__author_verification_selected_external = '_single'
    else window.__author_verification_selected_external = 0

    // Update UI select/dropdown
    updateVerificationSelectUI()
    // Try to fetch metadata for external list items (will update labels asynchronously)
    try { fetchMetadataForExternalItems(container).catch(() => { }) } catch (_e) { }
    // Update codes
    updateVerificationCodesDebounced()
}

// Resolve a list item path relative to a list source (file name or URL)
function resolveListItemPathLocal(item, listSource) {
    try {
        if (!item) return item
        const s = String(item)
        if (/^(https?:)?\/\//i.test(s)) return s
        if (!listSource) return s
        const base = listSource.endsWith('/') ? listSource : listSource.replace(/[^/]*$/, '')
        const listIsRemote = /^(https?:)?\/\//i.test(listSource)
        if (s.startsWith('./') || s.startsWith('/')) {
            try { return new URL(s, base).href } catch (_e) { return s }
        }
        if (listIsRemote) {
            try { return new URL(s, base).href } catch (_e) { return s }
        }
        return s
    } catch (_e) {
        return item
    }
}

// Try to fetch metadata (title/version) for external items and update labels
async function fetchMetadataForExternalItems(container) {
    if (!container) return
    const indicator = document.getElementById('verification-fetching-indicator')
    try {
        if (indicator) indicator.style.display = 'inline-block'
    } catch (_e) { }
    const src = container.source || null
    if (!Array.isArray(container.items)) {
        try { if (indicator) indicator.style.display = 'none' } catch (_e) { }
        return
    }

    container._labels = container._labels || []

    for (let i = 0; i < container.items.length; i++) {
        const it = container.items[i]
        // If we already have a label from the object, skip fetching
        if (container._labels[i]) continue
        if (it && typeof it === 'object') {
            const label = it.title ? (it.title + (it.version ? (' (v' + it.version + ')') : '')) : (it.id ? (it.id + '@' + (it.version || '1.0')) : null)
            container._labels[i] = label || `Item ${i + 1}`
            updateVerificationSelectOptionLabel(i, container._labels[i])
            continue
        }
        // it is likely a string (filename or URL)
        let resolved = it
        try { resolved = resolveListItemPathLocal(it, src) } catch (_e) { resolved = it }
        try {
            // Use centralized loader to normalize if possible (it will fetch and parse)
            const parsed = await loadConfigFromStringOrUrl(resolved)
            const label = parsed && parsed.title ? (parsed.title + (parsed.version ? (' (v' + parsed.version + ')') : '')) : (parsed && parsed.id ? (parsed.id + '@' + (parsed.version || '1.0')) : String(it))
            container._labels[i] = label
            updateVerificationSelectOptionLabel(i, label)
        } catch (e) {
            // fallback: use the raw item string or 'Item N'
            container._labels[i] = String(it) || `Item ${i + 1}`
            updateVerificationSelectOptionLabel(i, container._labels[i])
        }
    }
    try { if (indicator) indicator.style.display = 'none' } catch (_e) { }
}

// Update the label text of an existing option in the verification select for index i
function updateVerificationSelectOptionLabel(index, label) {
    try {
        const select = document.getElementById('verification-config-select')
        if (!select) return
        // Option order: opt[0] = authored option, then items in sequence
        const optIndex = 1 + index
        if (select.options && select.options[optIndex]) {
            select.options[optIndex].textContent = `${index + 1}: ${label}`
        }
    } catch (_e) { }
}

function updateVerificationSelectUI() {
    const select = document.getElementById('verification-config-select')
    const idEl = document.getElementById('verification-config-id')
    if (!select) return
    const container = window.__author_verification_external_configs || null
    // If no external, hide select and show authored label
    if (!container) {
        select.style.display = 'none'
        if (idEl) idEl.style.display = 'block'
        return
    }

    // Build options: authored (default) + external entries
    // clear children safely
    if (select) while (select.firstChild) select.removeChild(select.firstChild)
    const optAuth = document.createElement('option')
    optAuth.value = '_authored'
    optAuth.textContent = 'Use authored config'
    select.appendChild(optAuth)

    if (container._single) {
        const opt = document.createElement('option')
        opt.value = '_single'
        const label = (container._single.id ? container._single.id + '@' + (container._single.version || '1.0') : (container._single.title || 'External config'))
        opt.textContent = `External: ${label}`
        select.appendChild(opt)
        select.value = window.__author_verification_selected_external || '_single'
        select.style.display = 'inline-block'
        if (idEl) idEl.style.display = 'none'
        return
    }

    if (Array.isArray(container.items)) {
        // Try to use any provided listName metadata for the select label
        const listName = container.listName || null
        container.items.forEach((cfg, idx) => {
            const opt = document.createElement('option')
            opt.value = String(idx)
            // Prefer title, then id@version, then fallback to Item N
            const label = cfg && cfg.title
                ? cfg.title
                : (cfg && cfg.id ? (cfg.id + '@' + (cfg.version || '1.0')) : `Item ${idx + 1}`)
            opt.textContent = listName ? `${idx + 1}: ${label}` : `${idx + 1}: ${label}`
            select.appendChild(opt)
        })
        select.style.display = 'inline-block'
        select.value = (window.__author_verification_selected_external === null || window.__author_verification_selected_external === undefined) ? '_authored' : String(window.__author_verification_selected_external)
        if (idEl) idEl.style.display = 'none'
        return
    }
}

/**
 * Resolve the selected external config into a normalized config object.
 * externalConfigs can be a container with ._single or .items[]. Items may be raw
 * config objects already; if items are strings (filenames) we attempt to load
 * them via `loadConfigFromStringOrUrl`.
 */
async function resolveSelectedExternalConfig(externalConfigs, selectedKey) {
    if (!externalConfigs) return null
    // Single config
    if (selectedKey === '_single' && externalConfigs._single) return externalConfigs._single

    // Index into items
    const items = Array.isArray(externalConfigs.items) ? externalConfigs.items : null
    if (!items) return null
    let idx = null
    if (typeof selectedKey === 'number') idx = selectedKey
    else if (typeof selectedKey === 'string' && selectedKey !== '_authored') {
        const parsed = Number(selectedKey)
        if (!Number.isNaN(parsed)) idx = parsed
    }
    if (idx === null) idx = 0
    const candidate = items[idx]
    if (!candidate) return null

    // If candidate is an object that looks like a config, use as-is.
    if (candidate && typeof candidate === 'object' && (candidate.id || candidate.tests || candidate.files || candidate.title)) {
        return candidate
    }

    // If candidate is a string (filename or URL), attempt to load via config loader.
    if (typeof candidate === 'string') {
        try {
            // Resolve candidate relative to the list source so relative paths
            // in a config list use the same domain/directory as the list file.
            const resolved = resolveListItemPathLocal(candidate, externalConfigs.source)
            // Prefer using loadConfigFromStringOrUrl which accepts filenames or URLs
            const loaded = await loadConfigFromStringOrUrl(resolved)
            return loaded
        } catch (e) {
            logDebug('Failed to fetch candidate by string:', candidate, e)
            return null
        }
    }

    return null
}

// Changelog modal functions
async function openChangelogModal() {
    const modal = $('changelog-modal')
    const contentEl = $('changelog-content')

    if (!modal || !contentEl) return

    try {
        // Load and render changelog content
        if (contentEl) {
            while (contentEl.firstChild) contentEl.removeChild(contentEl.firstChild)
            const loading = document.createElement('p')
            loading.style.textAlign = 'center'
            loading.style.color = '#666'
            loading.style.fontStyle = 'italic'
            loading.textContent = 'Loading changelog...'
            contentEl.appendChild(loading)
        }

        try {
            // Use relative path that works from author/ directory
            const response = await fetch('./changelog.md')

            if (response.ok) {
                const markdownContent = await response.text()
                if (markdownContent.trim()) {
                    // Render markdown to HTML
                    const htmlContent = renderMarkdown(markdownContent)
                    // Sanitize markdown-rendered HTML before inserting into the changelog modal
                    if (contentEl) {
                        while (contentEl.firstChild) contentEl.removeChild(contentEl.firstChild)
                        const wrapper = document.createElement('div')
                        try { setInnerHTML(wrapper, htmlContent) } catch (_e) { wrapper.textContent = htmlContent }
                        while (wrapper.firstChild) contentEl.appendChild(wrapper.firstChild)
                    }
                } else {
                    // Empty file - insert equivalent elements safely
                    if (contentEl) {
                        while (contentEl.firstChild) contentEl.removeChild(contentEl.firstChild)
                        const outer = document.createElement('div')
                        outer.style.textAlign = 'center'
                        outer.style.padding = '40px'
                        const h3 = document.createElement('h3')
                        h3.style.color = '#666'
                        h3.style.marginBottom = '12px'
                        h3.textContent = '📋 No Changelog Available'
                        const p1 = document.createElement('p')
                        p1.style.color = '#888'
                        p1.style.marginBottom = '16px'
                        p1.textContent = 'The changelog file is empty.'
                        const p2 = document.createElement('p')
                        p2.style.color = '#999'
                        p2.style.fontSize = '0.9em'
                        p2.textContent = 'Edit author/changelog.md to add changelog content.'
                        outer.appendChild(h3)
                        outer.appendChild(p1)
                        outer.appendChild(p2)
                        contentEl.appendChild(outer)
                    }
                }
            } else {
                // File not found or error - insert equivalent elements safely
                if (contentEl) {
                    while (contentEl.firstChild) contentEl.removeChild(contentEl.firstChild)
                    const outer = document.createElement('div')
                    outer.style.textAlign = 'center'
                    outer.style.padding = '40px'
                    const h3 = document.createElement('h3')
                    h3.style.color = '#666'
                    h3.style.marginBottom = '12px'
                    h3.textContent = '📋 Changelog Not Found'
                    const p1 = document.createElement('p')
                    p1.style.color = '#888'
                    p1.style.marginBottom = '16px'
                    p1.textContent = 'No changelog file was found.'
                    const p2 = document.createElement('p')
                    p2.style.color = '#999'
                    p2.style.fontSize = '0.9em'
                    p2.textContent = 'Create author/changelog.md to add changelog content.'
                    outer.appendChild(h3)
                    outer.appendChild(p1)
                    outer.appendChild(p2)
                    contentEl.appendChild(outer)
                }
            }
        } catch (error) {
            logError('Failed to load changelog:', error)
            if (contentEl) {
                while (contentEl.firstChild) contentEl.removeChild(contentEl.firstChild)
                const outer = document.createElement('div')
                outer.style.textAlign = 'center'
                outer.style.padding = '40px'
                const h3 = document.createElement('h3')
                h3.style.color = '#d32f2f'
                h3.style.marginBottom = '12px'
                h3.textContent = '⚠️ Error Loading Changelog'
                const p1 = document.createElement('p')
                p1.style.color = '#888'
                p1.style.marginBottom = '16px'
                p1.textContent = 'Failed to load the changelog file.'
                const p2 = document.createElement('p')
                p2.style.color = '#999'
                p2.style.fontSize = '0.9em'
                p2.textContent = 'Check the console for details.'
                outer.appendChild(h3)
                outer.appendChild(p1)
                outer.appendChild(p2)
                contentEl.appendChild(outer)
            }
        }

        // Use shared modal function for accessibility (ESC key, focus management, etc.)
        openModal(modal)
    } catch (e) {
        logError('Failed to open changelog modal:', e)
    }
}

function closeChangelogModal() {
    const modal = $('changelog-modal')
    if (modal) {
        // Use shared modal function for proper cleanup
        closeModal(modal)
    }
}

// Close modals when clicking outside content
document.addEventListener('click', (e) => {
    const modal = $('changelog-modal')
    if (modal && e.target === modal) {
        closeChangelogModal()
    }

    const loadDraftsModal = $('load-drafts-modal')
    if (loadDraftsModal && e.target === loadDraftsModal) {
        closeLoadDraftsModal()
    }

    const saveDraftSuccessModal = $('save-draft-success-modal')
    if (saveDraftSuccessModal && e.target === saveDraftSuccessModal) {
        closeSaveDraftSuccessModal()
    }

    const verificationModal = $('verification-load-modal')
    if (verificationModal && e.target === verificationModal) {
        try { closeModal(verificationModal) } catch (_e) { verificationModal.style.display = 'none' }
    }
})

// Verification code update helpers
let verificationUpdateTimer = null

async function updateVerificationCodes() {
    try {
        // If an external verification config is loaded and selected, prefer it
        // Use explicit null for authored; allow 0 as a valid index
        const selectedExternal = (typeof window.__author_verification_selected_external === 'undefined' || window.__author_verification_selected_external === null) ? null : window.__author_verification_selected_external
        const externalConfigs = window.__author_verification_external_configs || null
        let currentConfig = buildCurrentConfig()
        if (externalConfigs && selectedExternal !== null) {
            try {
                // Resolve the external config to an object (may involve fetching if string filenames are present)
                const resolved = await resolveSelectedExternalConfig(externalConfigs, selectedExternal)
                if (resolved) currentConfig = resolved
            } catch (_e) { /* ignore and fallback to authored config */ }
        }
        // Display config identity (id@version) in the verification panel
        try {
            const el = document.getElementById('verification-config-id')
            if (el) {
                const id = currentConfig.id || (currentConfig.title ? currentConfig.title.replace(/\s+/g, '-') : 'unknown')
                const version = currentConfig.version || '1.0'
                el.textContent = `${id}@${version}`
            }
        } catch (_e) { }

        // renderStudentsList may be async; await so errors can be caught
        try { await renderStudentsList(currentConfig) } catch (_e) { }
    } catch (e) {
        logDebug('Failed to update verification codes:', e)
    }
}

function updateVerificationCodesDebounced() {
    if (verificationUpdateTimer) clearTimeout(verificationUpdateTimer)
    verificationUpdateTimer = setTimeout(updateVerificationCodes, 500)
}

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    // Add debug helper to window for manual inspection
    // debugAuthorStorage removed in cleanup
    loadEditor()

    // Initialize TabOverflowManager for author page early so that any
    // render calls during restoreFromLocalStorage() delegate to the
    // overflow manager instead of falling back to the legacy renderer.
    try {
        authorOverflowManager = new TabOverflowManager('file-tabs', {
            onTabSelect: (path) => { try { openFile(path) } catch (_e) { } },
            onTabClose: (path) => { try { deleteFile(path) } catch (_e) { } },
            onTabRename: async (oldPath, newPath) => { return await renameAuthorFile(oldPath, newPath) },
            isFileReadOnly: (path) => !!fileReadOnlyStatus[path]
        })
        try { authorOverflowManager.init() } catch (_e) { }
    } catch (e) {
        console.warn('Failed to initialize TabOverflowManager for author page:', e)
    }

    // Restore state before attaching handlers to avoid races where UI events
    // fire while the initial files/config are still being populated.
    await restoreFromLocalStorage()
    try { setupHandlers() } catch (_e) { }
    try { initAuthorFeedback() } catch (_e) { }
    try { initAuthorTests() } catch (_e) { }
    try { initVerificationTab(updateVerificationCodes) } catch (_e) { }
    // Show metadata tab by default so inputs are visible for tests
    try { document.querySelector('.tab-btn[data-tab="metadata"]').click() } catch (_e) { }
})

// Apply an imported config object to the author UI and persist to storage
async function applyImportedConfig(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('Invalid config object')

    suppressAutosave = true  // Prevent autosave during import

    // Normalize incoming shape: prefer files, fallback to starter
    try {
        files = obj.files || (obj.starter ? { '/main.py': obj.starter } : { '/main.py': '# starter code\n' })
        fileReadOnlyStatus = obj.fileReadOnlyStatus || {}
    } catch (_e) { files = { '/main.py': '# starter code\n' }; fileReadOnlyStatus = {} }
    // Metadata
    $('meta-title').value = obj.title || obj.name || ''
    $('meta-id').value = obj.id || ''
    $('meta-version').value = obj.version || ''
    // Validate version UI after import
    try { const ok = isValidMetaVersion(String($('meta-version').value || '')); showMetaVersionError(!ok) } catch (_e) { }
    // Validate ID UI after import
    try { const okId = isValidMetaId(String($('meta-id').value || '')); showMetaIdError(!okId) } catch (_e) { }
    if ($('meta-description')) $('meta-description').value = obj.description || ''
    if ($('instructions-editor')) $('instructions-editor').value = obj.instructions || obj.description || ''

    // Feedback and tests: if structured, stringify for the hidden textarea; else keep raw string
    if ($('feedback-editor')) {
        try {
            if (obj.feedback && typeof obj.feedback !== 'string') $('feedback-editor').value = JSON.stringify(obj.feedback, null, 2)
            else $('feedback-editor').value = obj.feedback || ''
        } catch (_e) { $('feedback-editor').value = obj.feedback || '' }
        // fire input so author-feedback UI updates
        $('feedback-editor').dispatchEvent(new Event('input', { bubbles: true }))
    }
    if ($('tests-editor')) {
        try {
            if (obj.tests && typeof obj.tests !== 'string') $('tests-editor').value = JSON.stringify(obj.tests, null, 2)
            else $('tests-editor').value = obj.tests || ''
        } catch (_e) { $('tests-editor').value = obj.tests || '' }
        $('tests-editor').dispatchEvent(new Event('input', { bubbles: true }))
    }

    // Prevent any file-creation flows triggered during render from stealing focus
    suppressOpenFileFocus = true
    try {
        renderFileList()
        if (files['/main.py']) openFile('/main.py', true)
        else openFile(Object.keys(files)[0] || '/main.py', true)
    } finally {
        suppressOpenFileFocus = false
    }

    // Persist to localStorage: ensure feedback/tests are structured when possible
    const cfg = buildCurrentConfig()
    try {
        if (typeof cfg.feedback === 'string' && cfg.feedback.trim()) {
            const p = JSON.parse(cfg.feedback)
            if (Array.isArray(p)) cfg.feedback = p
        }
    } catch (_e) { }
    try {
        if (typeof cfg.tests === 'string' && cfg.tests.trim()) {
            const p = JSON.parse(cfg.tests)
            if (Array.isArray(p)) cfg.tests = p
        }
    } catch (_e) { }
    try {
        const norm = validateAndNormalizeConfig(cfg)
        // Ensure the imported configuration is persisted before returning
        await saveAuthorConfigToLocalStorage(norm)

        // Verification: read back via the storage adapter so this works with
        // unified IndexedDB-backed storage or the synchronous fallback used in tests.
        try {
            const saved = await getAuthorConfigFromLocalStorage()
            const savedPreview = JSON.stringify(saved || {}).slice(0, 2000)
            const origPreview = JSON.stringify(norm || {}).slice(0, 2000)
            logDebug('[author-page] verify saved author_config, match=', savedPreview === origPreview)
            if (savedPreview !== origPreview) logDebug('[author-page] savedPreview=', savedPreview)
        } catch (e) {
            logWarn('[author-page] verify read-back failed', e && e.message)
        }
    } catch (e) {
        // fallback: save raw
        await saveAuthorConfigToLocalStorage(cfg)
    }

    // Update verification codes after importing config
    updateVerificationCodesDebounced()

    // Re-enable autosave after import is complete
    suppressAutosave = false
}

// Draft Management Functions using imported storage functions
async function saveCurrentDraft() {
    const config = buildCurrentConfig()

    // Check if a draft with the same config ID and version already exists
    const existingDraft = await findDraftByConfigIdAndVersion(config.id, config.version)

    let draft
    let draftName
    const timestamp = new Date().toLocaleString()
    const configTitle = config.title || 'Untitled'

    if (existingDraft) {
        // Overwrite existing draft with same config ID and version
        draft = {
            ...existingDraft,  // Keep existing draft metadata (id, createdAt)
            name: existingDraft.name || `${configTitle} (${timestamp})`,
            config: config,
            updatedAt: Date.now()
        }
        draftName = existingDraft.name || `${configTitle} (updated)`
    } else {
        // Create new draft
        draftName = `${configTitle} (${timestamp})`
        draft = {
            name: draftName,
            config: config,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }
    }

    // Use imported saveDraft function
    const savedDraft = await saveDraft(draft)

    // Show success message in modal
    const action = existingDraft ? 'Updated' : 'Saved'
    showSaveDraftSuccessModal(`${action}: ${draftName}`)
}

async function openLoadDraftsModal() {
    const modal = $('load-drafts-modal')
    const contentEl = $('load-drafts-content')

    if (!modal || !contentEl) return

    try {
        // Use imported listDrafts function
        const draftEntries = await listDrafts()

        if (draftEntries.length === 0) {
            if (contentEl) {
                while (contentEl.firstChild) contentEl.removeChild(contentEl.firstChild)
                const outer = document.createElement('div')
                outer.style.textAlign = 'center'
                outer.style.padding = '40px'
                const h3 = document.createElement('h3')
                h3.style.color = '#666'
                h3.style.marginBottom = '12px'
                h3.textContent = '📄 No Drafts Found'
                const p1 = document.createElement('p')
                p1.style.color = '#888'
                p1.style.marginBottom = '16px'
                p1.textContent = "You haven't saved any draft configurations yet."
                const p2 = document.createElement('p')
                p2.style.color = '#999'
                p2.style.fontSize = '0.9em'
                p2.textContent = 'Use the "Save Draft" button to save your current configuration.'
                outer.appendChild(h3)
                outer.appendChild(p1)
                outer.appendChild(p2)
                contentEl.appendChild(outer)
            }
        } else {
            // Sort drafts by updatedAt (newest first)
            draftEntries.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))

            if (contentEl) {
                while (contentEl.firstChild) contentEl.removeChild(contentEl.firstChild)
                const listContainer = document.createElement('div')
                listContainer.style.display = 'flex'
                listContainer.style.flexDirection = 'column'
                listContainer.style.gap = '8px'

                for (const draft of draftEntries) {
                    const config = draft.config || {}
                    const title = config.title || 'Untitled'
                    const id = config.id || 'No ID'
                    const version = config.version || 'No version'
                    const timestamp = draft.updatedAt ? new Date(draft.updatedAt).toLocaleString() : 'Unknown'
                    const draftName = draft.name || `${title} (${timestamp})`

                    const card = document.createElement('div')
                    card.style.border = '1px solid #ddd'
                    card.style.borderRadius = '6px'
                    card.style.padding = '12px'
                    card.style.background = '#f8f9fa'

                    const row = document.createElement('div')
                    row.style.display = 'flex'
                    row.style.justifyContent = 'space-between'
                    row.style.alignItems = 'flex-start'
                    row.style.marginBottom = '8px'

                    const left = document.createElement('div')
                    const h4 = document.createElement('h4')
                    h4.style.margin = '0'
                    h4.style.color = '#333'
                    h4.textContent = draftName
                    const pMeta = document.createElement('p')
                    pMeta.style.margin = '4px 0 0 0'
                    pMeta.style.color = '#666'
                    pMeta.style.fontSize = '0.9em'
                    pMeta.textContent = `ID: ${id} | Version: ${version}`
                    const pSaved = document.createElement('p')
                    pSaved.style.margin = '4px 0 0 0'
                    pSaved.style.color = '#999'
                    pSaved.style.fontSize = '0.85em'
                    pSaved.textContent = `Saved: ${timestamp}`
                    left.appendChild(h4)
                    left.appendChild(pMeta)
                    left.appendChild(pSaved)

                    const right = document.createElement('div')
                    right.style.display = 'flex'
                    right.style.gap = '8px'

                    const loadBtn = document.createElement('button')
                    loadBtn.className = 'btn btn-small load-draft-btn'
                    loadBtn.setAttribute('data-draft-id', String(draft.id))
                    loadBtn.textContent = 'Load'
                    loadBtn.addEventListener('click', async () => { await loadDraftById(draft.id) })

                    const delBtn = document.createElement('button')
                    delBtn.className = 'btn btn-small btn-danger delete-draft-btn'
                    delBtn.setAttribute('data-draft-id', String(draft.id))
                    delBtn.textContent = 'Delete'
                    delBtn.addEventListener('click', async () => { await deleteDraftById(draft.id) })

                    right.appendChild(loadBtn)
                    right.appendChild(delBtn)

                    row.appendChild(left)
                    row.appendChild(right)
                    card.appendChild(row)
                    listContainer.appendChild(card)
                }

                contentEl.appendChild(listContainer)
            }
        }

        // Open the modal
        openModal(modal)
    } catch (e) {
        logError('Failed to open load drafts modal:', e)
        if (contentEl) {
            while (contentEl.firstChild) contentEl.removeChild(contentEl.firstChild)
            const outer = document.createElement('div')
            outer.style.textAlign = 'center'
            outer.style.padding = '40px'
            const h3 = document.createElement('h3')
            h3.style.color = '#d32f2f'
            h3.style.marginBottom = '12px'
            h3.textContent = '⚠️ Error Loading Drafts'
            const p1 = document.createElement('p')
            p1.style.color = '#888'
            p1.style.marginBottom = '16px'
            p1.textContent = 'Failed to load draft configurations.'
            const p2 = document.createElement('p')
            p2.style.color = '#999'
            p2.style.fontSize = '0.9em'
            p2.textContent = 'Check the console for details.'
            outer.appendChild(h3)
            outer.appendChild(p1)
            outer.appendChild(p2)
            contentEl.appendChild(outer)
        }
        openModal(modal)
    }
}

function closeLoadDraftsModal() {
    const modal = $('load-drafts-modal')
    if (modal) {
        closeModal(modal)
    }
}

async function loadDraftById(draftId) {
    try {
        // Use imported loadDraft function
        const draft = await loadDraft(draftId)

        if (!draft) {
            throw new Error('Draft not found')
        }

        // Close the drafts modal first to avoid modal stacking
        closeLoadDraftsModal()

        // Confirm overwrite using the existing modal system
        let ok = false
        try {
            ok = await showConfirmModal('Load Draft Configuration', 'This will overwrite the current author configuration in this page and in storage. Continue?')
        } catch (e) {
            ok = window.confirm('This will overwrite the current author configuration in this page and in storage. Continue?')
        }

        if (!ok) return

        // Apply the draft config and persist
        await applyImportedConfig(draft.config)

        // Show success message in the load drafts modal
        const draftName = draft.name || 'Draft'
        showLoadDraftSuccessInModal(draftName)

    } catch (e) {
        alert('Failed to load draft: ' + (e && e.message ? e.message : e))
    }
}

async function deleteDraftById(draftId) {
    try {
        // First get the draft to get its name for the confirmation
        const draft = await loadDraft(draftId)

        if (!draft) {
            throw new Error('Draft not found')
        }

        const draftName = draft.name || 'this draft'

        // Confirm deletion
        let ok = false
        try {
            ok = await showConfirmModal('Delete Draft', `Are you sure you want to delete "${draftName}"? This action cannot be undone.`)
        } catch (e) {
            ok = window.confirm(`Are you sure you want to delete "${draftName}"? This action cannot be undone.`)
        }

        if (!ok) return

        // Use imported deleteDraft function
        await deleteDraft(draftId)

        // Refresh the modal content by reopening the drafts modal
        await openLoadDraftsModal()

    } catch (e) {
        alert('Failed to delete draft: ' + (e && e.message ? e.message : e))
    }
}

// Modal helper functions
function showSaveDraftSuccessModal(draftName) {
    const modal = $('save-draft-success-modal')
    const contentEl = $('save-draft-success-content')

    if (modal && contentEl) {
        while (contentEl.firstChild) contentEl.removeChild(contentEl.firstChild)
        const p1 = document.createElement('p')
        p1.style.margin = '0'
        p1.style.color = '#333'
        p1.style.fontSize = '1rem'
        p1.style.marginBottom = '12px'
        const strong = document.createElement('strong')
        strong.textContent = 'Draft saved successfully!'
        p1.appendChild(strong)
        const p2 = document.createElement('p')
        p2.style.margin = '0'
        p2.style.color = '#666'
        p2.style.fontSize = '0.9em'
        p2.textContent = `Saved as: "${escapeHtml(draftName)}"`
        contentEl.appendChild(p1)
        contentEl.appendChild(p2)
        openModal(modal)
    }
}

function closeSaveDraftSuccessModal() {
    const modal = $('save-draft-success-modal')
    if (modal) {
        closeModal(modal)
    }
}

function showLoadDraftSuccessInModal(draftName) {
    // Re-use the load drafts modal to show success message
    const modal = $('load-drafts-modal')
    const contentEl = $('load-drafts-content')
    const titleEl = $('load-drafts-modal-title')

    if (modal && contentEl && titleEl) {
        // Change the title and content to show success
        titleEl.textContent = 'Draft Loaded Successfully'
        if (contentEl) {
            while (contentEl.firstChild) contentEl.removeChild(contentEl.firstChild)
            const outer = document.createElement('div')
            outer.style.textAlign = 'center'
            outer.style.padding = '40px'
            const check = document.createElement('div')
            check.style.color = '#4caf50'
            check.style.fontSize = '48px'
            check.style.marginBottom = '16px'
            check.textContent = '✓'
            const h3 = document.createElement('h3')
            h3.style.color = '#333'
            h3.style.marginBottom = '12px'
            h3.textContent = 'Configuration Loaded'
            const p1 = document.createElement('p')
            p1.style.color = '#666'
            p1.style.marginBottom = '16px'
            p1.textContent = `"${escapeHtml(draftName)}" has been loaded into the author page.`
            const p2 = document.createElement('p')
            p2.style.color = '#999'
            p2.style.fontSize = '0.9em'
            p2.textContent = 'The configuration has been applied and saved.'
            outer.appendChild(check)
            outer.appendChild(h3)
            outer.appendChild(p1)
            outer.appendChild(p2)
            contentEl.appendChild(outer)
        }
        openModal(modal)
    }
}

// Helper function for HTML escaping
function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

// Export helpers used by unit tests and other modules
export { updateInstructionsPreview, openChangelogModal, openLoadDraftsModal }
