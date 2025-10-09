// Tab management integrating files with CodeMirror
import { $ } from './utils.js'
import { getFileManager, MAIN_FILE } from './vfs-client.js'
import { clearAllErrorHighlights, clearAllFeedbackHighlights } from './code-transform.js'
import { showInputModal, showConfirmModal } from './modals.js'
import { appendTerminalDebug } from './terminal.js'
import { TabOverflowManager } from './tab-overflow-manager.js'

let openTabs = [] // array of paths
let active = null
let cm = null
let textarea = null
let currentConfig = null // current loaded config for read-only status
let overflowManager = null // TabOverflowManager instance

function _normalizePath(p) {
    return String(p).startsWith('/') ? p : `/${p}`
}

function _isSystemPath(p) {
    try {
        if (!p) return false
        return /^\/dev\//i.test(p) || /^\/proc\//i.test(p) || /^\/tmp\//i.test(p) || /^\/temp\//i.test(p)
    } catch (_e) { return false }
}

function isFileReadOnly(path) {
    try {
        if (!currentConfig || !currentConfig.fileReadOnlyStatus) return false
        const normalizedPath = _normalizePath(path)
        // Support config keys that may be stored with or without a leading '/'
        const bare = normalizedPath.replace(/^\/+/, '')
        return (currentConfig.fileReadOnlyStatus[normalizedPath] || currentConfig.fileReadOnlyStatus[bare]) || false
    } catch (_e) {
        return false
    }
}

// Update current config (called from main app when config changes)
export function updateConfig(config) {
    currentConfig = config
    // Re-render tabs to update read-only indicators
    render()
}

function render() {
    const tabsHost = $('tabs-left')
    if (!tabsHost) return

    // If an overflow manager exists, delegate rendering to it (it will
    // render the always-visible tabs and an overflow dropdown). Otherwise
    // fall back to the simple rendering implementation.
    if (overflowManager && typeof overflowManager.render === 'function') {
        try {
            // Ensure the overflow manager knows about read-only checks
            overflowManager.isFileReadOnly = isFileReadOnly
            overflowManager.render(openTabs, active)
            return
        } catch (_e) { /* fall back to default rendering on error */ }
    }

    // clear children safely
    if (tabsHost) while (tabsHost.firstChild) tabsHost.removeChild(tabsHost.firstChild)
    openTabs.forEach(p => {
        const tab = document.createElement('div')
        // Check if file is marked as read-only
        const isReadOnly = isFileReadOnly(p)
        tab.className = 'tab' + (p === active ? ' active' : '') + (isReadOnly ? ' readonly' : '')
        // render tab
        tab.setAttribute('role', 'tab')
        const label = p.startsWith('/') ? p.slice(1) : p

        const labelSpan = document.createElement('span')
        labelSpan.className = 'tab-label'
        labelSpan.textContent = label
        tab.appendChild(labelSpan)

        const close = document.createElement('button')
        close.className = 'close'
        close.title = 'Close'

        // hide close for protected main file
        if (p === MAIN_FILE || isReadOnly) {
            // hide close for protected main file and read-only files
            close.style.display = 'none'
        } else {
            close.textContent = '×'
            close.addEventListener('click', (ev) => {
                ev.stopPropagation()
                closeTab(p)
            })
        }

        tab.appendChild(close)
        tab.addEventListener('click', () => selectTab(p))
        tabsHost.appendChild(tab)
    })
}

export async function openTab(path, opts = { select: true }) {
    const n = _normalizePath(path)
    // openTab called

    // Diagnostic instrumentation: record every openTab call so we can
    // later inspect which callers attempted to open pseudo-files like
    // '<stdin>' during traceback mapping flows. This is intentionally
    // lightweight and will be removed once root cause is identified.
    try {
        if (typeof window !== 'undefined') {
            try { window.__ssg_tab_open_calls = window.__ssg_tab_open_calls || [] } catch (_e) { }
            try { window.__ssg_tab_open_calls.push({ when: Date.now(), path: n, stack: (new Error()).stack || null }) } catch (_e) { }
        }
    } catch (_e) { }

    if (!openTabs.includes(n)) {
        openTabs.push(n)
    }
    if (!opts || opts.select === undefined || opts.select) selectTab(n)
    render()

    // Signal an opened tab for external observers/tests
    try {
        window.__ssg_last_tab_opened = { path: n, ts: Date.now() }
    } catch (_e) { }

    try {
        window.dispatchEvent(new CustomEvent('ssg:tab-opened', { detail: { path: n } }))
    } catch (_e) { }
}

export async function forceClose(path) {
    const n = _normalizePath(path)
    const FileManager = getFileManager()

    // prevent force-closing (deleting) a read-only file from the app UI
    try {
        if (isFileReadOnly(n)) return
    } catch (_e) { }

    // delete from storage without confirmation
    try { await FileManager.delete(n) } catch (_e) { }

    openTabs = openTabs.filter(x => x !== n)
    if (active === n) {
        active = openTabs.length ? openTabs[openTabs.length - 1] : null
    }

    if (active) {
        selectTab(active)
    } else {
        if (cm) cm.setValue('')
        else if (textarea) textarea.value = ''
    }

    render()
}

export async function closeTab(path) {
    const n = _normalizePath(path)
    const FileManager = getFileManager()

    // closeTab called

    // Prevent deleting read-only files from the app UI
    try {
        if (isFileReadOnly(n)) return
    } catch (_e) { }

    // delete from storage and close tab — use accessible confirm modal
    try {
        const ok = await showConfirmModal('Close and delete', 'Close and delete file "' + n + '"? This will remove it from storage.')
        // confirmation result
        if (!ok) return
    } catch (_e) { return }

    try { await FileManager.delete(n) } catch (_e) { }

    // Also attempt to remove any copy that may exist in the runtime FS (interpreter).
    // Some runtime FS implementations are available at window.__ssg_runtime_fs (Emscripten/MicroPython).
    try {
        const fs = typeof window !== 'undefined' ? window.__ssg_runtime_fs : null
        if (fs) {
            try {
                if (typeof fs.unlink === 'function') fs.unlink(n)
                else if (typeof fs.unlinkSync === 'function') fs.unlinkSync(n)
            } catch (_e) { }
        }
    } catch (_e) { }

    appendTerminalDebug('TabManager.closeTab before openTabs filter -> ' + openTabs.join(','))
    openTabs = openTabs.filter(x => x !== n)
    appendTerminalDebug('TabManager.closeTab after openTabs filter -> ' + openTabs.join(','))

    if (active === n) {
        active = openTabs.length ? openTabs[openTabs.length - 1] : null
        appendTerminalDebug('TabManager.closeTab new active tab -> ' + active)
    }

    if (active) {
        selectTab(active)
    } else {
        // clear editor
        if (cm) cm.setValue('')
        else if (textarea) textarea.value = ''
    }

    appendTerminalDebug('TabManager.closeTab calling render')
    render()
    appendTerminalDebug('TabManager.closeTab completed -> ' + n)
}

// Close a tab from the UI without deleting the underlying storage entry.
// Useful when an external operation (like a workspace reset) has already
// removed files from storage and we only want to update the open-tabs state.
export function closeTabSilent(path) {
    const n = _normalizePath(path)
    openTabs = openTabs.filter(x => x !== n)

    if (active === n) {
        // If we're in the middle of a rename operation, don't auto-select another tab.
        // The rename logic will handle selecting the new path.
        if (window.__ssg_renaming_file && window.__ssg_renaming_file.oldPath === n) {
            active = null; // Will be set by rename logic
        } else {
            active = openTabs.length ? openTabs[openTabs.length - 1] : null;
        }
    }

    if (active && (!window.__ssg_renaming_file || window.__ssg_renaming_file.oldPath !== n)) {
        selectTab(active)
    } else {
        if (cm) cm.setValue('')
        else if (textarea) textarea.value = ''
    }

    render()
}

// Synchronize the open tabs with the current FileManager listing.
// - Remove tabs that no longer exist in the FileManager (without deleting storage)
// - Open tabs for files that exist but aren't currently open (mirrors startup behavior)
export async function syncWithFileManager() {
    const FileManager = getFileManager()
    if (!FileManager) return

    const files = (typeof FileManager.list === 'function') ? FileManager.list() : []

    // Clean up pending tabs queue - remove any files that don't exist
    if (typeof window !== 'undefined' && window.__ssg_pending_tabs) {
        try {
            window.__ssg_pending_tabs = window.__ssg_pending_tabs.filter(path => {
                return files.includes(path) || path === MAIN_FILE
            })
        } catch (_e) { }
    }

    // Ensure MAIN_FILE is always present in the tabs (do not select here)
    try {
        if (!openTabs.includes(MAIN_FILE)) openTab(MAIN_FILE, { select: false })
    } catch (_e) { }

    // Remove any open tabs for files that no longer exist
    try {
        const currentOpen = Array.from(openTabs)
        for (const p of currentOpen) {
            try {
                if (p === MAIN_FILE) continue
                if (!files.includes(p)) {
                    closeTabSilent(p)
                }
            } catch (_e) { }
        }
    } catch (_e) { }

    // Re-open files present in the FileManager but not currently open (don't auto-select)
    try {
        for (const p of files) {
            try {
                // Do not auto-open runtime/system paths (e.g. /dev/null)
                if (_isSystemPath(p)) continue
                if (!openTabs.includes(p)) openTab(p, { select: false })
            } catch (_e) { }
        }
    } catch (_e) { }

    // Process any remaining pending tabs after cleanup
    try {
        flushPendingTabs()
    } catch (_e) { }

    // Ensure the active tab's editor content is refreshed.
    // Note: when syncing with FileManager we may open multiple files which
    // cause `openTab()` to select the last opened file. For workspace reload
    // semantics we want `/main.py` to be the focused tab by default, so
    // explicitly select MAIN_FILE here after sync completes.
    try {
        if (MAIN_FILE) selectTab(MAIN_FILE)
    } catch (_e) { }
}

export function selectTab(path) {
    const n = _normalizePath(path)
    const FileManager = getFileManager()

    active = n
    const content = FileManager.read(n) || ''

    if (cm) {
        // When switching tabs programmatically we call cm.setValue(), which
        // fires CodeMirror 'change' events. Those change handlers clear
        // error highlights (to remove stale highlights on edits). That has
        // the unfortunate side-effect of erasing stored highlights during
        // a tab switch. To preserve highlights across tab switches we
        // temporarily suppress the change-handler's clearAllErrorHighlights
        // behaviour while performing the programmatic setValue().
        try { window.__ssg_suppress_clear_highlights = true } catch (_e) { }
        cm.setValue(content)
        try { setTimeout(() => { window.__ssg_suppress_clear_highlights = false }, 0) } catch (_e) { }
    }
    else if (textarea) textarea.value = content

    // Configure editor mode based on file extension (python for .py, plain for others)
    try {
        if (window.setEditorModeForPath && typeof window.setEditorModeForPath === 'function') {
            try { window.setEditorModeForPath(n) } catch (_e) { }
        }
    } catch (_e) { }

    // Set read-only mode based on file status
    try {
        const isReadOnly = isFileReadOnly(n)
        if (window.setEditorReadOnlyMode && typeof window.setEditorReadOnlyMode === 'function') {
            try { if (typeof window !== 'undefined' && window.__SSG_DEBUG) console.info('[debug-tabs] selectTab -> setting editor readOnly for', n, isReadOnly) } catch (_e) { }
            try { window.setEditorReadOnlyMode(isReadOnly) } catch (_e) { }
        }
    } catch (_e) { }

    // Re-apply any stored error highlights for this file. Using the per-file
    // highlights map ensures highlights for other files are preserved and can
    // be re-applied when their tabs are selected.
    try {
        if (cm && window.__ssg_error_highlights_map && typeof window.__ssg_error_highlights_map === 'object') {
            // ensure we lookup using the same normalization rules as highlight code
            const key = n.startsWith('/') ? n : ('/' + String(n).replace(/^\/+/, ''))
            const altKey = key.startsWith('/') ? key.replace(/^\/+/, '') : ('/' + key)
            // Look up both normalized and alt key forms so older stored entries
            // without a leading slash are still applied.
            const lines = window.__ssg_error_highlights_map[key] || window.__ssg_error_highlights_map[altKey] || []
            // Apply highlights after the next paint to ensure CodeMirror has
            // updated its internal line handles following setValue(). This
            // avoids a class being lost when setValue triggers a re-render.
            try {
                requestAnimationFrame(() => {
                    for (const ln of lines) {
                        try { cm.addLineClass(ln, 'background', 'cm-error-line') } catch (_e) { }
                    }
                    // Also reapply feedback highlights for this file if present
                    try {
                        if (window.__ssg_feedback_highlights_map && typeof window.__ssg_feedback_highlights_map === 'object') {
                            const flines = window.__ssg_feedback_highlights_map[key] || window.__ssg_feedback_highlights_map[altKey] || []
                            for (const fln of flines) {
                                try { cm.addLineClass(fln, 'background', 'cm-feedback-line') } catch (_e) { }
                            }
                        }
                    } catch (_e) { }
                    try { if (typeof cm.refresh === 'function') cm.refresh() } catch (_e) { }
                })
            } catch (_e) {
                for (const ln of lines) {
                    try { cm.addLineClass(ln, 'background', 'cm-error-line') } catch (_e) { }
                }
                try {
                    if (window.__ssg_feedback_highlights_map && typeof window.__ssg_feedback_highlights_map === 'object') {
                        const flines = window.__ssg_feedback_highlights_map[key] || window.__ssg_feedback_highlights_map[altKey] || []
                        for (const fln of flines) {
                            try { cm.addLineClass(fln, 'background', 'cm-feedback-line') } catch (_e) { }
                        }
                    }
                } catch (_e) { }
                try { if (typeof cm.refresh === 'function') cm.refresh() } catch (_e) { }
            }
        }
    } catch (_e) { }

    render()
}

export async function createNew() {
    const name = await showInputModal('New file', 'New file path (e.g. main.py):', '')
    if (!name) return

    const n = _normalizePath(name)
    const FileManager = getFileManager()

    FileManager.write(n, '')
    openTab(n)
}

export function list() {
    try {
        appendTerminalDebug('TabManager.list -> ' + openTabs.join(','))
    } catch (_e) { }
    return openTabs
}

export function getActive() {
    return active
}

export function refresh() {
    try {
        render()
    } catch (_e) { }
}

// Force-refresh visible editor content for the active tab. This is useful
// after programmatic writes/deletes to ensure the editor displays the
// latest FileManager contents without requiring the user to switch tabs.
export function refreshOpenTabContents() {
    try {
        const FileManager = getFileManager()
        if (!FileManager) return
        if (!active) return

        const content = FileManager.read(active) || ''
        if (cm) {
            try { window.__ssg_suppress_clear_highlights = true } catch (_e) { }
            cm.setValue(content)
            try { setTimeout(() => { window.__ssg_suppress_clear_highlights = false }, 0) } catch (_e) { }
            try { if (typeof cm.refresh === 'function') cm.refresh() } catch (_e) { }
        } else if (textarea) {
            textarea.value = content
        }
    } catch (_e) { }
}

// Initialize tab manager
export function initializeTabManager(codeMirror, textareaElement) {
    cm = codeMirror
    textarea = textareaElement

    // Initialize TabOverflowManager with proper container and callbacks
    try {
        overflowManager = new TabOverflowManager('tabs-left', {
            onTabSelect: (p) => { try { selectTab(p) } catch (_e) { } },
            onTabClose: (p) => { try { closeTab(p) } catch (_e) { } },
            onTabRename: renameFile,
            isFileReadOnly: isFileReadOnly
        })
        // Prepare any modal handlers or DOM wiring
        try { overflowManager.init() } catch (_e) { }
    } catch (_e) { }

    const newBtn = $('tab-new')
    if (newBtn) newBtn.addEventListener('click', createNew)

    // autosave current active tab on editor changes (debounced)
    let tabSaveTimer = null
    function scheduleTabSave() {
        if (!active) return
        try {
            // If autosave suppression is enabled (for programmatic workspace
            // operations like reset/apply-config) skip scheduling a save.
            if (typeof window !== 'undefined' && window.__ssg_suppress_autosave) return
        } catch (_e) { }
        if (tabSaveTimer) clearTimeout(tabSaveTimer)
        tabSaveTimer = setTimeout(() => {
            const content = cm ? cm.getValue() : (textarea ? textarea.value : '')
            const FileManager = getFileManager()

            try {
                const stored = FileManager.read(active)
                if (stored === content) {
                    const ind = $('autosave-indicator')
                    if (ind) ind.textContent = 'Saved (' + active + ')'
                    return
                }
            } catch (_e) { }

            FileManager.write(active, content)
            const ind = $('autosave-indicator')
            if (ind) ind.textContent = 'Saved (' + active + ')'
        }, 300)
    }

    if (cm) {
        cm.on('change', () => {
            try {
                // Respect suppression flag set during programmatic setValue()
                if (!window.__ssg_suppress_clear_highlights) {
                    if (typeof clearAllErrorHighlights === 'function') clearAllErrorHighlights()
                    if (typeof clearAllFeedbackHighlights === 'function') clearAllFeedbackHighlights()
                }
            } catch (_e) { }
            scheduleTabSave()
        })
    } else if (textarea) {
        textarea.addEventListener('input', () => {
            try {
                if (typeof clearAllErrorHighlights === 'function') clearAllErrorHighlights()
                if (typeof clearAllFeedbackHighlights === 'function') clearAllFeedbackHighlights()
            } catch (_e) { }
            scheduleTabSave()
        })
    }

    // Ensure main file is open in initial tab and selected
    openTab(MAIN_FILE)

    // Close any stale tabs for files that no longer exist in the FileManager
    // This handles cases where snapshots or previous sessions left tabs open
    // for files that were removed by config changes or resets.
    try {
        const FileManager = getFileManager()
        if (FileManager && typeof FileManager.list === 'function') {
            const availableFiles = FileManager.list() || []
            // Create a copy of openTabs to avoid modification during iteration
            const currentTabs = [...openTabs]
            for (const p of currentTabs) {
                try {
                    // Don't close MAIN_FILE tab, but close tabs for missing files
                    if (p !== MAIN_FILE && !availableFiles.includes(p)) {
                        closeTabSilent(p)
                    }
                } catch (_e) { }
            }
        }
    } catch (_e) { }

    // Re-open any existing files from the FileManager so tabs persist across
    // page reloads and snapshot restores. Exclude the protected MAIN_FILE
    // because it's already opened above.
    try {
        const FileManager = getFileManager()
        if (FileManager && typeof FileManager.list === 'function') {
            const files = FileManager.list() || []
            for (const p of files) {
                try {
                    if (p && p !== MAIN_FILE) openTab(p, { select: false })
                } catch (_e) { }
            }
        }
    } catch (_e) { }

    // If any tabs were queued while TabManager wasn't available, open them now
    // but only if they actually exist in the FileManager
    try {
        const pending = (window.__ssg_pending_tabs || [])
        if (pending && pending.length) {
            const FileManager = getFileManager()
            const availableFiles = (FileManager && typeof FileManager.list === 'function') ? (FileManager.list() || []) : []
            for (const p of pending) {
                try {
                    // Only open pending tabs that actually exist and are not system paths
                    if (_isSystemPath(p)) continue
                    if (p === MAIN_FILE || availableFiles.includes(p)) {
                        openTab(p, { select: false })
                    }
                } catch (_e) { }
            }
            try {
                window.__ssg_pending_tabs = []
            } catch (_e) { }
        }
    } catch (_e) { }

    // File rename functionality (top-level inside module)
    async function renameFile(oldPath, newPath) {
        try {
            const FileManager = getFileManager()
            if (!FileManager) return false

            // Read content from old file
            const content = await FileManager.read(oldPath)
            if (content === null) return false

            // Set the rename flag BEFORE any FileManager operations to prevent
            // the notification system from interfering with tab selection
            window.__ssg_renaming_file = { oldPath, newPath, timestamp: Date.now() }

            // Write to new path (this triggers notification system)
            await FileManager.write(newPath, content)

            // Delete old file
            await FileManager.delete(oldPath)

            // Update tabs
            const tabIndex = openTabs.indexOf(oldPath)
            if (tabIndex !== -1) {
                openTabs[tabIndex] = newPath
            }

            // Update active tab reference
            // During rename, closeTabSilent may have set active to null, so check both conditions
            if (active === oldPath || (window.__ssg_renaming_file && window.__ssg_renaming_file.oldPath === oldPath)) {
                active = newPath

                // Update TabOverflowManager's lastEditedFile synchronously
                if (overflowManager && overflowManager.lastEditedFile === oldPath) {
                    overflowManager.lastEditedFile = newPath
                }

                selectTab(newPath)
            }

            render()

            // Clear the rename flag after render is complete
            setTimeout(() => {
                if (window.__ssg_renaming_file &&
                    window.__ssg_renaming_file.oldPath === oldPath &&
                    window.__ssg_renaming_file.newPath === newPath) {
                    delete window.__ssg_renaming_file
                }
            }, 150)

            return true
        } catch (e) {
            console.error('File rename failed:', e)
            return false
        }
    }

    return {
        openTab,
        closeTab,
        selectTab,
        list,
        getActive,
        forceClose,
        refresh,
        closeTabSilent,
        syncWithFileManager,
        updateConfig,
        renameFile,
        flushPendingTabs: () => {
            try {
                const pending = (window.__ssg_pending_tabs || [])
                if (pending && pending.length) {
                    const FileManager = getFileManager()
                    const availableFiles = (FileManager && typeof FileManager.list === 'function') ? (FileManager.list() || []) : []
                    for (const p of pending) {
                        try {
                            // Only open pending tabs that actually exist and are not system paths
                            if (_isSystemPath(p)) continue
                            if (p === MAIN_FILE || availableFiles.includes(p)) {
                                openTab(p, { select: false })
                            }
                        } catch (_e) { }
                    }
                    try {
                        window.__ssg_pending_tabs = []
                    } catch (_e) { }
                }
            } catch (_e) { }
        }
    }
}