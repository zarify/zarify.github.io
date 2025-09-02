// Tab management integrating files with CodeMirror
import { $ } from './utils.js'
import { getFileManager, MAIN_FILE } from './vfs-client.js'
import { clearAllErrorHighlights, clearAllFeedbackHighlights } from './code-transform.js'
import { showInputModal, showConfirmModal } from './modals.js'
import { appendTerminalDebug } from './terminal.js'

let openTabs = [] // array of paths
let active = null
let cm = null
let textarea = null

function _normalizePath(p) {
    if (!p) return p
    return p.startsWith('/') ? p : ('/' + p)
}

function render() {
    const tabsHost = $('tabs-left')
    if (!tabsHost) return

    tabsHost.innerHTML = ''
    openTabs.forEach(p => {
        const tab = document.createElement('div')
        tab.className = 'tab' + (p === active ? ' active' : '')
        tab.setAttribute('role', 'tab')
        const label = p.startsWith('/') ? p.slice(1) : p
        tab.innerHTML = `<span class="tab-label">${label}</span>`

        const close = document.createElement('button')
        close.className = 'close'
        close.title = 'Close'

        // hide close for protected main file
        if (p === MAIN_FILE) {
            close.style.display = 'none'
        } else {
            close.innerHTML = '×'
            close.addEventListener('click', (ev) => {
                ev.stopPropagation()
                closeTab(p)
            })
        }

        tab.appendChild(close)
        tab.addEventListener('click', () => selectTab(p))
        tabsHost.appendChild(tab)
    })

    // Debug: surface current openTabs and DOM labels into the terminal
    try {
        const labels = Array.from(tabsHost.querySelectorAll('.tab-label')).map(e => e.textContent)
        appendTerminalDebug('TabManager.render -> openTabs: ' + openTabs.join(',') + ' | DOM labels: ' + labels.join(','))
    } catch (_e) { }
}

export async function openTab(path) {
    const n = _normalizePath(path)
    appendTerminalDebug('TabManager.openTab called -> ' + n)

    if (!openTabs.includes(n)) {
        openTabs.push(n)
    }
    selectTab(n)
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

    // delete from storage without confirmation
    try { FileManager.delete(n) } catch (_e) { }

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

    // delete from storage and close tab — use accessible confirm modal
    try {
        const ok = await showConfirmModal('Close and delete', 'Close and delete file "' + n + '"? This will remove it from storage.')
        if (!ok) return
    } catch (_e) {
        return
    }

    FileManager.delete(n)
    openTabs = openTabs.filter(x => x !== n)

    if (active === n) {
        active = openTabs.length ? openTabs[openTabs.length - 1] : null
    }

    if (active) {
        selectTab(active)
    } else {
        // clear editor
        if (cm) cm.setValue('')
        else if (textarea) textarea.value = ''
    }

    render()
}

// Close a tab from the UI without deleting the underlying storage entry.
// Useful when an external operation (like a workspace reset) has already
// removed files from storage and we only want to update the open-tabs state.
export function closeTabSilent(path) {
    const n = _normalizePath(path)
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

    // Ensure MAIN_FILE is always present in the tabs
    try {
        if (!openTabs.includes(MAIN_FILE)) openTab(MAIN_FILE)
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

    // Re-open files present in the FileManager but not currently open
    try {
        for (const p of files) {
            try {
                if (!openTabs.includes(p)) openTab(p)
            } catch (_e) { }
        }
    } catch (_e) { }

    // Process any remaining pending tabs after cleanup
    try {
        flushPendingTabs()
    } catch (_e) { }

    // Ensure the active tab's editor content is refreshed
    try {
        if (active) selectTab(active)
        else if (MAIN_FILE) selectTab(MAIN_FILE)
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

    const newBtn = $('tab-new')
    if (newBtn) newBtn.addEventListener('click', createNew)

    // autosave current active tab on editor changes (debounced)
    let tabSaveTimer = null
    function scheduleTabSave() {
        if (!active) return
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
                    if (p && p !== MAIN_FILE) openTab(p)
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
                    // Only open pending tabs that actually exist
                    if (p === MAIN_FILE || availableFiles.includes(p)) {
                        openTab(p)
                    }
                } catch (_e) { }
            }
            try {
                window.__ssg_pending_tabs = []
            } catch (_e) { }
        }
    } catch (_e) { }

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
        flushPendingTabs: () => {
            try {
                const pending = (window.__ssg_pending_tabs || [])
                if (pending && pending.length) {
                    const FileManager = getFileManager()
                    const availableFiles = (FileManager && typeof FileManager.list === 'function') ? (FileManager.list() || []) : []
                    for (const p of pending) {
                        try {
                            // Only open pending tabs that actually exist
                            if (p === MAIN_FILE || availableFiles.includes(p)) {
                                openTab(p)
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