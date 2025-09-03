import { validateAndNormalizeConfig } from './config.js'
import { saveAuthorConfigToLocalStorage, getAuthorConfigFromLocalStorage, clearAuthorConfigInLocalStorage, saveDraft, listDrafts, loadDraft } from './author-storage.js'
import { initAuthorFeedback } from './author-feedback.js'
import { initAuthorTests } from './author-tests.js'
import { showConfirmModal, openModal, closeModal } from './modals.js'
import { renderMarkdown } from './utils.js'

function $(id) { return document.getElementById(id) }

let editor = null
let files = {} // map path -> content or { content, binary, mime }
let currentFile = '/main.py'
let suppressOpenFileFocus = false
let autosaveTimer = null
const AUTOSAVE_DELAY = 500
const BINARY_LIMIT = 204800 // 200KB

function debounceSave() {
    if (autosaveTimer) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => saveToLocalStorage(), AUTOSAVE_DELAY)
}

function loadEditor() {
    const ta = $('file-editor')
    try {
        editor = CodeMirror.fromTextArea(ta, { lineNumbers: true, mode: 'python' })
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
        console.warn('CodeMirror not available, falling back to textarea')
        ta.addEventListener('input', () => {
            files[currentFile] = ta.value
            debounceSave()
        })
    }
}

function renderFileList() {
    // Render as tabs
    const tabs = $('file-tabs')
    tabs.innerHTML = ''
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
        tab.appendChild(label)

        // Add close button (except for /main.py)
        if (p !== '/main.py') {
            const close = document.createElement('button')
            close.className = 'close'
            close.innerHTML = '×'
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

    // Re-render the file list and save
    renderFileList()
    debounceSave()
}

function saveToLocalStorage() {
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
            // Likewise, parse tests if the textarea contains a JSON array so
            // the saved author_config carries the tests as a structured array
            // (the main app expects cfg.tests to be an array when running
            // author-defined tests).
            if (typeof cfg.tests === 'string' && cfg.tests.trim()) {
                const parsedTests = JSON.parse(cfg.tests)
                if (Array.isArray(parsedTests)) cfg.tests = parsedTests
            }
        } catch (_e) { /* keep raw string if invalid JSON */ }
        // try to validate/normalize but don't block autosave on failure
        try {
            const norm = validateAndNormalizeConfig(cfg)
            saveAuthorConfigToLocalStorage(norm)
            $('validation').textContent = ''
        } catch (e) {
            // keep raw config but show validation message
            try { localStorage.setItem('author_config', JSON.stringify(cfg)) } catch (_e) { }
            $('validation').textContent = 'Validation: ' + (e && e.message ? e.message : e)
        }
    } catch (e) { console.error('autosave failed', e) }
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
    const cfg = { id, title, version, description, instructions, feedback: feedbackRaw, tests: testsRaw, starter, files }
    return cfg
}

function restoreFromLocalStorage() {
    const raw = getAuthorConfigFromLocalStorage()
    if (!raw) {
        // initialize defaults
        files = { '/main.py': '# starter code\n' }
        renderFileList()
        openFile('/main.py')
        return
    }
    try {
        // raw may be normalized or raw shape
        files = raw.files || { '/main.py': raw.starter || '# starter code\n' }
        $('meta-title').value = raw.title || ''
        $('meta-id').value = raw.id || ''
        $('meta-version').value = raw.version || ''
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
    } catch (e) { files = { '/main.py': '# starter code\n' } }
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
        preview.innerHTML = html
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
            console.warn('Failed to read as text file, treating as binary:', e)
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
    }

    // Metadata & editors
    $('meta-title').addEventListener('input', debounceSave)
    $('meta-id').addEventListener('input', debounceSave)
    $('meta-version').addEventListener('input', debounceSave)
    if ($('meta-description')) $('meta-description').addEventListener('input', debounceSave)
    if ($('instructions-editor')) {
        $('instructions-editor').addEventListener('input', () => { debounceSave(); try { updateInstructionsPreview() } catch (_e) { } })
    }
    if ($('feedback-editor')) $('feedback-editor').addEventListener('input', debounceSave)
    if ($('tests-editor')) $('tests-editor').addEventListener('input', debounceSave)
    $('add-file').addEventListener('click', () => {
        const name = prompt('File path (e.g. /lib/util.py)')
        if (!name) return
        files[name] = ''
        renderFileList()
        openFile(name)
        debounceSave()
    })
    $('file-upload').addEventListener('change', handleUpload)

    // Back to app navigation with session flag
    $('back-to-app').addEventListener('click', () => {
        try {
            // Set flag for return detection
            sessionStorage.setItem('returningFromAuthor', 'true')
            // Navigate back to main app
            window.location.href = '../index.html'
        } catch (e) {
            console.error('Failed to navigate back to app:', e)
            // Fallback navigation
            window.location.href = '../index.html'
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
        // clear localStorage
        try { clearAuthorConfigInLocalStorage() } catch (_e) { }
        // reset fields
        files = { '/main.py': '# starter code\n' }
        renderFileList()
        openFile('/main.py')
        $('meta-title').value = ''
        $('meta-id').value = ''
        $('meta-version').value = ''
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
                    if (Array.isArray(parsed)) cfg.tests = parsed
                }
            } catch (_e) { }
            const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            // include id and version in filename: "config_id@version.json"
            const idPart = String(cfg.id || 'config').replace(/[\/\\@\s]+/g, '_')
            const verPart = String(cfg.version || 'v0').replace(/[\/\\@\s]+/g, '_')
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
                ok = await showConfirmModal('Import configuration', 'This will overwrite the current author configuration in this page and in localStorage. Continue?')
            } catch (e) {
                try { ok = window.confirm('This will overwrite the current author configuration in this page and in localStorage. Continue?') } catch (_e) { ok = false }
            }
            if (!ok) return
            // apply the parsed config
            try { console.debug && console.debug('[author] applying imported config', parsed); applyImportedConfig(parsed) } catch (e) { alert('Failed to apply config: ' + (e && e.message ? e.message : e)); return }
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
                body.textContent = 'Configuration loaded into the author page and saved to localStorage.'
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

    // Draft buttons are stubs for now; explicit IndexedDB draft functionality will be added later
    $('save-draft').addEventListener('click', () => {
        alert('Save Draft not implemented yet — drafts will be added later.')
    })
    $('load-draft').addEventListener('click', () => {
        alert('Load Drafts not implemented yet — drafts will be added later.')
    })

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
}

// Changelog modal functions
async function openChangelogModal() {
    const modal = $('changelog-modal')
    const contentEl = $('changelog-content')

    if (!modal || !contentEl) return

    try {
        // Load and render changelog content
        contentEl.innerHTML = '<p style="text-align:center;color:#666;font-style:italic;">Loading changelog...</p>'

        try {
            // Use relative path that works from author/ directory
            const response = await fetch('./changelog.md')

            if (response.ok) {
                const markdownContent = await response.text()
                if (markdownContent.trim()) {
                    // Render markdown to HTML
                    const htmlContent = renderMarkdown(markdownContent)
                    contentEl.innerHTML = htmlContent
                } else {
                    // Empty file
                    contentEl.innerHTML = `
                        <div style="text-align:center;padding:40px;">
                            <h3 style="color:#666;margin-bottom:12px;">📋 No Changelog Available</h3>
                            <p style="color:#888;margin-bottom:16px;">The changelog file is empty.</p>
                            <p style="color:#999;font-size:0.9em;">Edit <code>author/changelog.md</code> to add changelog content.</p>
                        </div>
                    `
                }
            } else {
                // File not found or error
                contentEl.innerHTML = `
                    <div style="text-align:center;padding:40px;">
                        <h3 style="color:#666;margin-bottom:12px;">📋 Changelog Not Found</h3>
                        <p style="color:#888;margin-bottom:16px;">No changelog file was found.</p>
                        <p style="color:#999;font-size:0.9em;">Create <code>author/changelog.md</code> to add changelog content.</p>
                    </div>
                `
            }
        } catch (error) {
            console.error('Failed to load changelog:', error)
            contentEl.innerHTML = `
                <div style="text-align:center;padding:40px;">
                    <h3 style="color:#d32f2f;margin-bottom:12px;">⚠️ Error Loading Changelog</h3>
                    <p style="color:#888;margin-bottom:16px;">Failed to load the changelog file.</p>
                    <p style="color:#999;font-size:0.9em;">Check the console for details.</p>
                </div>
            `
        }

        // Use shared modal function for accessibility (ESC key, focus management, etc.)
        openModal(modal)
    } catch (e) {
        console.error('Failed to open changelog modal:', e)
    }
}

function closeChangelogModal() {
    const modal = $('changelog-modal')
    if (modal) {
        // Use shared modal function for proper cleanup
        closeModal(modal)
    }
}// Close changelog modal when clicking outside content
document.addEventListener('click', (e) => {
    const modal = $('changelog-modal')
    if (modal && e.target === modal) {
        closeChangelogModal()
    }
})

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    loadEditor()
    restoreFromLocalStorage()
    setupHandlers()
    try { initAuthorFeedback() } catch (_e) { }
    try { initAuthorTests() } catch (_e) { }
    // Show metadata tab by default so inputs are visible for tests
    try { document.querySelector('.tab-btn[data-tab="metadata"]').click() } catch (_e) { }
})

// Apply an imported config object to the author UI and persist to localStorage
function applyImportedConfig(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('Invalid config object')
    // Normalize incoming shape: prefer files, fallback to starter
    try {
        files = obj.files || (obj.starter ? { '/main.py': obj.starter } : { '/main.py': '# starter code\n' })
    } catch (_e) { files = { '/main.py': '# starter code\n' } }
    // Metadata
    $('meta-title').value = obj.title || obj.name || ''
    $('meta-id').value = obj.id || ''
    $('meta-version').value = obj.version || ''
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
        saveAuthorConfigToLocalStorage(norm)
    } catch (e) {
        // fallback: save raw
        saveAuthorConfigToLocalStorage(cfg)
    }
}
