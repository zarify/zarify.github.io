// Exported for use in autosave.js
export { getSnapshotsForCurrentConfig, saveSnapshotsForCurrentConfig, debugSnapshotStorage }

// Restore from the special 'current' snapshot if it exists
export async function restoreCurrentSnapshotIfExists() {
    let snaps = getSnapshotsForCurrentConfig()
    // Show most-recent snapshots first
    try {
        snaps = snaps.sort((a, b) => (b && b.ts || 0) - (a && a.ts || 0))
    } catch (_e) { }
    const idx = snaps.findIndex(s => s.id === '__current__')
    if (idx !== -1) {
        // When restoring the special '__current__' snapshot on startup,
        // suppress activating/focusing the terminal so page-load output
        // doesn't cause a distracting auto-switch.
        await restoreSnapshot(idx, snaps, true)
        return true
    }
    return false
}
// Snapshot management system
import { $ } from './utils.js'
import { getFileManager, MAIN_FILE, getBackendRef, getMem } from './vfs-client.js'
import { openModal, closeModal, showConfirmModal } from './modals.js'
import { appendTerminal, activateSideTab } from './terminal.js'
import { getConfigKey, getConfigIdentity, getConfig } from './config.js'
import { safeSetItem, checkStorageHealth, showStorageInfo } from './storage-manager.js'

export function setupSnapshotSystem() {
    const saveSnapshotBtn = $('save-snapshot')
    const historyBtn = $('history')
    // Note: Clear storage moved into the snapshot modal (button id snapshot-clear-storage)

    if (saveSnapshotBtn) {
        // Wrap the save handler so we disable the button briefly and
        // avoid concurrent or very-rapid saves which can cause modal
        // overlay/timing issues in some browsers.
        saveSnapshotBtn.addEventListener('click', async (ev) => {
            try {
                if (saveSnapshotBtn.disabled) return
                saveSnapshotBtn.disabled = true
                await saveSnapshot()
            } finally {
                // Re-enable after a short debounce window
                setTimeout(() => { try { saveSnapshotBtn.disabled = false } catch (_) { } }, 600)
            }
        })
    }

    if (historyBtn) {
        historyBtn.addEventListener('click', openSnapshotModal)
    }

    // Defer wiring modal clear button until modal is opened; openSnapshotModal will
    // attach behavior to the modal button. (Keep setupSnapshotSystem simple.)
    // Also attach a default handler for the global clear-storage button so tests and
    // users can click it without opening the snapshot modal first.
    try {
        const globalClear = $('clear-storage')
        if (globalClear) {
            // Remove any existing listeners to prevent duplicates
            const newHandler = async (ev) => {
                // Prevent multiple calls if button is clicked rapidly
                if (globalClear.disabled) return
                globalClear.disabled = true

                try {
                    // If snapshot modal is open, close it first
                    const modal = $('snapshot-modal')
                    if (modal && modal.getAttribute('aria-hidden') === 'false') {
                        closeModal(modal)
                    }
                    await clearStorage()
                } catch (e) {
                    console.error('Clear storage error:', e)
                } finally {
                    // Re-enable the button after a short delay
                    setTimeout(() => {
                        globalClear.disabled = false
                    }, 1000)
                }
            }

            // Store the handler reference so we can remove it properly
            globalClear._clearStorageHandler = newHandler
            globalClear.addEventListener('click', newHandler)
        }
    } catch (_e) { }

    // Check storage health on startup
    setTimeout(() => checkStorageHealth(), 1000)
}

function getSnapshotStorageKey() {
    const identity = getConfigIdentity()
    return `snapshots_${identity}`
}

function getSnapshotsForCurrentConfig() {
    const storageKey = getSnapshotStorageKey()
    const configIdentity = getConfigIdentity()

    try {
        const snaps = JSON.parse(localStorage.getItem(storageKey) || '[]')

        // Filter to only include snapshots that match current config identity
        return snaps.filter(snap => {
            if (!snap.config) return false // Skip legacy snapshots without config info
            if (typeof snap.config === 'string') {
                return snap.config === configIdentity
            }
            // For object-style config, convert to string for comparison
            if (snap.config.id && snap.config.version) {
                return `${snap.config.id}@${snap.config.version}` === configIdentity
            }
            return false
        })
    } catch (e) {
        console.error('Failed to load snapshots:', e)
        return []
    }
}

function saveSnapshotsForCurrentConfig(snapshots) {
    const storageKey = getSnapshotStorageKey()
    try {
        const result = safeSetItem(storageKey, JSON.stringify(snapshots))
        if (!result.success) {
            throw new Error(result.error || 'Failed to save snapshots')
        }
        if (result.recovered) {
            appendTerminal('Snapshots saved after storage cleanup')
        }
    } catch (e) {
        console.error('Failed to save snapshots:', e)
        throw e
    }
}

async function saveSnapshot() {
    try {
        const snaps = getSnapshotsForCurrentConfig()
        const configIdentity = getConfigIdentity()

        const snap = {
            ts: Date.now(),
            config: configIdentity,
            metadata: {
                configVersion: getConfig()?.version || '1.0'
            },
            files: {}
        }

        const FileManager = getFileManager()
        const mem = getMem()
        const backendRef = getBackendRef()

        // Use the global FileManager as the authoritative source for snapshot contents
        try {
            if (FileManager && typeof FileManager.list === 'function') {
                const names = FileManager.list()
                for (const n of names) {
                    try {
                        const v = await Promise.resolve(FileManager.read(n))
                        if (v != null) snap.files[n] = v
                    } catch (_e) { }
                }
            } else if (mem && Object.keys(mem).length) {
                for (const k of Object.keys(mem)) snap.files[k] = mem[k]
            } else if (backendRef && typeof backendRef.list === 'function') {
                const names = await backendRef.list()
                for (const n of names) {
                    try {
                        snap.files[n] = await backendRef.read(n)
                    } catch (_e) { }
                }
            } else {
                // fallback to localStorage mirror
                try {
                    const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}')
                    for (const k of Object.keys(map)) snap.files[k] = map[k]
                } catch (_e) { }
            }
        } catch (e) {
            try {
                const map = JSON.parse(localStorage.getItem('ssg_files_v1') || '{}')
                for (const k of Object.keys(map)) snap.files[k] = map[k]
            } catch (_e) { }
        }

        snaps.push(snap)
        saveSnapshotsForCurrentConfig(snaps)

        const identity = getConfigIdentity()
        appendTerminal(`Snapshot saved for ${identity} (${new Date(snap.ts).toLocaleString()})`, 'runtime')
        try { activateSideTab('terminal') } catch (_e) { }
        // Signal to tests and other code that a snapshot save has completed.
        // Only expose this signal in dev mode so production doesn't leak test hooks.
        try {
            // Signal to tests and other code that a snapshot save has completed.
            // Always set this flag when possible so test harnesses can observe completion.
            if (typeof window !== 'undefined') {
                window.__ssg_snapshot_saved = Date.now()
            }
        } catch (_e) { }
    } catch (e) {
        appendTerminal('Snapshot save failed: ' + e, 'runtime')
    }
}

function renderSnapshots() {
    const snapshotList = $('snapshot-list')
    if (!snapshotList) return

    const snaps = getSnapshotsForCurrentConfig()
    const configIdentity = getConfigIdentity()

    if (!snaps.length) {
        snapshotList.innerHTML = `<div class="no-snapshots">No snapshots for ${configIdentity}</div>`
        return
    }

    snapshotList.innerHTML = ''
    // Helper to compute approximate byte size of snapshot
    function computeSnapshotSize(snap) {
        try {
            let total = 0
            const files = snap.files || {}
            for (const k of Object.keys(files)) {
                const v = String(files[k] || '')
                total += new TextEncoder().encode(v).length
            }
            return total
        } catch (e) { return 0 }
    }

    let grandTotal = 0
    snaps.forEach((s, i) => {
        const div = document.createElement('div')
        div.className = 'snapshot-item'
        div.style.display = 'flex'
        div.style.alignItems = 'center'
        div.style.justifyContent = 'space-between'
        div.style.padding = '6px 4px'

        // Left: load icon (accessible button)
        const leftBtn = document.createElement('button')
        leftBtn.className = 'btn btn-ghost snapshot-load-btn'
        leftBtn.title = 'Load snapshot'
        leftBtn.setAttribute('aria-label', 'Load snapshot')
        leftBtn.innerHTML = '⤓' // load icon
        leftBtn.addEventListener('click', () => restoreSnapshot(i, snaps))

        // Middle: single-line info (timestamp + files + size)
        const fileCount = Object.keys(s.files || {}).length
        const sizeBytes = computeSnapshotSize(s)
        grandTotal += sizeBytes
        const sizeText = sizeBytes < 1024 ? `${sizeBytes}B` : (sizeBytes < 1024 * 1024 ? `${Math.round(sizeBytes / 1024)}KB` : `${(sizeBytes / (1024 * 1024)).toFixed(2)}MB`)
        const mid = document.createElement('div')
        mid.className = 'snapshot-mid'
        mid.style.flex = '1'
        mid.style.padding = '0 8px'
        mid.style.display = 'flex'
        mid.style.alignItems = 'center'
        mid.style.justifyContent = 'flex-start'
        mid.style.gap = '8px'
        mid.innerHTML = `<span class="snapshot-ts">${new Date(s.ts).toLocaleString()}</span> <small class="snapshot-meta" style="color:#666">(${fileCount} file${fileCount === 1 ? '' : 's'}, ${sizeText} used)</small>`

        // Right: delete (trash) icon as accessible button
        const delBtn = document.createElement('button')
        delBtn.className = 'btn btn-ghost snapshot-delete-btn'
        delBtn.title = 'Delete snapshot'
        delBtn.setAttribute('aria-label', 'Delete snapshot')
        delBtn.innerHTML = '🗑️'
        delBtn.addEventListener('click', async () => {
            const ok = await showConfirmModal('Delete snapshot', 'Delete this snapshot? This action cannot be undone.')
            if (!ok) return
            try {
                const arr = getSnapshotsForCurrentConfig()
                // Remove by matching timestamp (stable id may not exist)
                const idxToRemove = arr.findIndex(x => x.ts === s.ts)
                if (idxToRemove !== -1) {
                    arr.splice(idxToRemove, 1)
                    saveSnapshotsForCurrentConfig(arr)
                    renderSnapshots()
                    appendTerminal('Snapshot deleted', 'runtime')
                }
            } catch (e) {
                appendTerminal('Failed to delete snapshot: ' + e, 'runtime')
            }
        })

        div.appendChild(leftBtn)
        div.appendChild(mid)
        div.appendChild(delBtn)
        snapshotList.appendChild(div)
    })

    // Update footer summary with grand total and number of snapshots
    const footer = document.getElementById('snapshot-storage-summary')
    if (footer) {
        try {
            const totalFiles = snaps.reduce((acc, s) => acc + Object.keys(s.files || {}).length, 0)
            const totalText = grandTotal < 1024 ? `${grandTotal}B` : (grandTotal < 1024 * 1024 ? `${Math.round(grandTotal / 1024)}KB` : `${(grandTotal / (1024 * 1024)).toFixed(2)}MB`)
            footer.textContent = `${snaps.length} snapshot(s), ${totalFiles} file(s), ${totalText} total`
        } catch (e) {
            // Fallback for when calculations fail
            footer.textContent = `0 snapshot(s), 0 file(s), 0B total`
        }
    }

    // Also update header summary if present
    const hdr = document.getElementById('snapshot-storage-summary-header')
    if (hdr) {
        try {
            // Compute totals across all snapshot keys in localStorage
            let allGrand = 0
            let allSnapCount = 0
            let allFileCount = 0

            for (let i = 0; i < localStorage.length; i++) {
                try {
                    const key = localStorage.key(i)
                    if (!key || !key.startsWith('snapshots_')) continue
                    const arr = JSON.parse(localStorage.getItem(key) || '[]')
                    if (!Array.isArray(arr) || !arr.length) continue
                    allSnapCount += arr.length
                    for (const s of arr) {
                        try {
                            const files = s.files || {}
                            allFileCount += Object.keys(files).length
                            for (const k of Object.keys(files)) {
                                try { allGrand += new TextEncoder().encode(String(files[k] || '')).length } catch (_e) { }
                            }
                        } catch (_e) { }
                    }
                } catch (_e) { }
            }

            const totalText = allGrand < 1024 ? `${allGrand}B` : (allGrand < 1024 * 1024 ? `${Math.round(allGrand / 1024)}KB` : `${(allGrand / (1024 * 1024)).toFixed(2)}MB`)
            hdr.textContent = `${allSnapCount} snaps • ${allFileCount} files • ${totalText}`
        } catch (e) {
            // Fallback for when calculations fail
            hdr.textContent = `0 snaps • 0 files • 0B`
        }
    }
}

async function restoreSnapshot(index, snapshots, suppressSideTab = false) {
    try {
        const s = snapshots[index]
        if (!s) return
        // Before restoring a previous snapshot, copy any existing '__current__'
        // snapshot into history so the user's in-progress work is not lost.
        try {
            const CURRENT_ID = '__current__'
            // Work with the passed snapshots array (it's sourced from storage)
            const snaps = snapshots || getSnapshotsForCurrentConfig()
            const curIdx = snaps.findIndex(x => x && x.id === CURRENT_ID)
            // Only copy if there is a current snapshot and we're not restoring it
            if (curIdx !== -1 && curIdx !== index) {
                const currentSnap = snaps[curIdx]
                // Shallow-copy files (file contents are strings) to avoid shared refs
                const copyFiles = {}
                for (const k of Object.keys(currentSnap.files || {})) copyFiles[k] = currentSnap.files[k]
                const copySnap = {
                    ts: Date.now(),
                    config: currentSnap.config,
                    files: copyFiles
                }
                // Remove the special-current marker and append the copied snapshot into history
                snaps.splice(curIdx, 1)
                snaps.push(copySnap)
                try { saveSnapshotsForCurrentConfig(snaps) } catch (_e) { /* non-fatal */ }
            }
        } catch (e) {
            console.error('Failed to persist current-as-history copy before restore:', e)
        }

        const snap = s

        const backend = window.__ssg_vfs_backend
        const { mem } = await window.__ssg_vfs_ready.catch(() => ({ mem: window.__ssg_mem }))
        const FileManager = window.FileManager

        if (backend && typeof backend.write === 'function') {
            // Clear existing files from backend
            try {
                if (typeof backend.clear === 'function') {
                    await backend.clear()
                } else if (typeof backend.list === 'function' && typeof backend.delete === 'function') {
                    // If no clear method, delete files individually
                    const existingFiles = await backend.list()
                    for (const filePath of existingFiles) {
                        try {
                            await backend.delete(filePath)
                        } catch (e) {
                            console.error('Failed to delete existing file from backend:', filePath, e)
                        }
                    }
                }
            } catch (e) {
                console.error('Backend clear/delete failed:', e)
            }

            // Write snapshot files to backend
            for (const [path, content] of Object.entries(snap.files || {})) {
                try {
                    await backend.write(path, content)
                } catch (e) {
                    console.error('Failed to write to backend:', path, e)
                }
            }

            // Replace in-memory mirror with snapshot contents for synchronous reads
            try {
                if (mem) {
                    Object.keys(mem).forEach(k => delete mem[k])
                    for (const p of Object.keys(snap.files || {})) mem[p] = snap.files[p]
                }
            } catch (e) {
                console.error('Failed to update mem:', e)
            }
        } else if (mem) {
            // Replace mem entirely so files from other snapshots are removed
            try {
                Object.keys(mem).forEach(k => delete mem[k])
                for (const p of Object.keys(snap.files || {})) mem[p] = snap.files[p]
            } catch (e) {
                console.error('Failed to update mem directly:', e)
            }

            try {
                const newMap = Object.create(null)
                for (const k of Object.keys(mem)) newMap[k] = mem[k]
                localStorage.setItem('ssg_files_v1', JSON.stringify(newMap))
            } catch (e) {
                console.error('Failed to update localStorage:', e)
            }
        }

        // Reconcile via FileManager to ensure mem/localStorage/backend are consistent
        try {
            if (FileManager && typeof FileManager.list === 'function') {
                const existing = FileManager.list() || []
                for (const p of existing) {
                    try {
                        if (p === MAIN_FILE) continue
                        if (!Object.prototype.hasOwnProperty.call(snap.files || {}, p)) {
                            await Promise.resolve(FileManager.delete(p))
                        }
                    } catch (e) {
                        console.error('Failed to delete file:', p, e)
                    }
                }
                for (const p of Object.keys(snap.files || {})) {
                    try {
                        await Promise.resolve(FileManager.write(p, snap.files[p]))
                    } catch (e) {
                        console.error('Failed to write via FileManager:', p, e)
                    }
                }
            }
        } catch (e) {
            console.error('FileManager reconciliation failed:', e)
        }

        // Definitively replace in-memory map with snapshot contents to avoid any stale entries
        try {
            if (mem) {
                Object.keys(mem).forEach(k => delete mem[k])
                for (const p of Object.keys(snap.files || {})) mem[p] = snap.files[p]
                try {
                    localStorage.setItem('ssg_files_v1', JSON.stringify(mem))
                } catch (e) {
                    console.error('Final localStorage update failed:', e)
                }
            }
        } catch (e) {
            console.error('Final mem update failed:', e)
        }

        const modal = $('snapshot-modal')
        closeModal(modal)
        appendTerminal('Snapshot restored (' + new Date(s.ts).toLocaleString() + ')', 'runtime')

        try {
            // Allow a tiny delay to ensure backend writes are flushed before signalling restore completion.
            setTimeout(() => {
                try {
                    // Always signal restore completion when possible so tests can observe it.
                    if (typeof window !== 'undefined') {
                        window.__ssg_last_snapshot_restore = Date.now()
                    }
                } catch (e) { console.error('Failed to set restore flag (delayed):', e) }
            }, 100)
        } catch (e) {
            console.error('Failed to schedule restore flag:', e)
        }

        // If this restore was initiated by an interactive action, activate the terminal tab.
        try { if (!suppressSideTab) activateSideTab('terminal') } catch (_e) { }

        // Also queue restored files for tab opening so the UI re-opens them.
        try {
            const restoredFiles = Object.keys(snap.files || {}).filter(p => p && p !== MAIN_FILE)
            if (restoredFiles.length) {
                try {
                    // set pending tabs and attempt to flush immediately
                    window.__ssg_pending_tabs = Array.from(new Set((window.__ssg_pending_tabs || []).concat(restoredFiles)))
                } catch (_e) { window.__ssg_pending_tabs = restoredFiles }

                try {
                    if (window.TabManager && typeof window.TabManager.flushPendingTabs === 'function') {
                        try { window.TabManager.flushPendingTabs() } catch (_e) { }
                    } else if (window.TabManager && typeof window.TabManager.openTab === 'function') {
                        // Fallback: open each restored file explicitly
                        for (const p of restoredFiles) {
                            try { window.TabManager.openTab(p) } catch (_e) { }
                        }
                    }
                } catch (_e) { }
            }
        } catch (_e) { }

        // Open only MAIN_FILE as focused tab
        try {
            if (window.TabManager && typeof window.TabManager.openTab === 'function') {
                window.TabManager.openTab(MAIN_FILE)
            }
            if (window.TabManager && typeof window.TabManager.selectTab === 'function') {
                window.TabManager.selectTab(MAIN_FILE)
            }
        } catch (e) {
            console.error('Tab management failed:', e)
        }
        // Persist the restored snapshot as the special '__current__' snapshot so
        // subsequent autosave/restore semantics see this as the current working copy.
        try {
            const CURRENT_ID = '__current__'
            const snapsAll = getSnapshotsForCurrentConfig()
            // Remove any existing current slot
            const filtered = snapsAll.filter(s => s && s.id !== CURRENT_ID)
            filtered.push({ id: CURRENT_ID, ts: Date.now(), config: snap.config, files: snap.files })
            saveSnapshotsForCurrentConfig(filtered)
        } catch (e) {
            console.error('Failed to persist restored snapshot as __current__:', e)
        }
    } catch (e) {
        console.error('restoreSnapshot failed:', e)
        appendTerminal('Snapshot restore failed: ' + e, 'runtime')
    }
}

function openSnapshotModal() {
    const modal = $('snapshot-modal')
    if (!modal) return

    renderSnapshots()
    openModal(modal)

    // Setup modal controls
    const closeBtn = $('close-snapshots')
    if (closeBtn) {
        closeBtn.removeEventListener('click', closeSnapshotModal) // Remove any existing listeners
        closeBtn.addEventListener('click', closeSnapshotModal)
    }

    // Ensure focus lands on a sensible control (close button) so tooltip/info icon isn't focused by default
    try {
        if (closeBtn && typeof closeBtn.focus === 'function') {
            closeBtn.focus()
        }
    } catch (_e) { }

    // Wire the Clear storage button inside the modal
    try {
        // Attach click handler to the global #clear-storage button while modal is open.
        // We avoid moving the DOM node to prevent layout/visibility glitches.
        const clearBtn = $('clear-storage')
        if (clearBtn) {
            // Use the same handler that's already attached to prevent duplicates
            // The global handler already handles modal closing
        }
    } catch (_e) { }
}

function showStorageInfoInTerminal() {
    showStorageInfo()
    try { activateSideTab('terminal') } catch (_e) { }
}

// Debug function to inspect localStorage snapshot keys
function debugSnapshotStorage() {
    console.log('=== Snapshot Storage Debug ===')
    try {
        const allKeys = []
        const snapshotKeys = []
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key) {
                allKeys.push(key)
                if (key.startsWith('snapshots_')) {
                    snapshotKeys.push(key)
                    const value = localStorage.getItem(key)
                    console.log(`${key}: ${value ? JSON.parse(value).length : 0} snapshots`)
                }
            }
        }
        console.log('All localStorage keys:', allKeys)
        console.log('Snapshot keys:', snapshotKeys)
    } catch (e) {
        console.error('Debug error:', e)
    }
    console.log('=== End Debug ===')
}

function closeSnapshotModal() {
    const modal = $('snapshot-modal')
    closeModal(modal)
}

// Note: bulk-delete / checkbox UI removed in favor of per-item delete buttons.

async function clearStorage() {
    // Compute summary across all snapshot keys in localStorage to show the user
    // how many snapshots and how many distinct configurations will be affected.
    let totalSnapshots = 0
    const configs = new Set()
    const keysToDelete = []
    try {
        for (let i = 0; i < localStorage.length; i++) {
            try {
                const key = localStorage.key(i)
                if (!key || !key.startsWith('snapshots_')) continue
                keysToDelete.push(key)
                const arr = JSON.parse(localStorage.getItem(key) || '[]')
                if (Array.isArray(arr) && arr.length) {
                    totalSnapshots += arr.length
                    configs.add(key.replace(/^snapshots_/, ''))
                }
            } catch (_e) { }
        }
    } catch (_e) { }

    // Populate confirm modal meta area with a friendly summary
    try {
        const meta = document.getElementById('confirm-modal-meta')
        if (meta) {
            meta.textContent = `This will delete ${totalSnapshots} snapshot(s) across ${configs.size} configuration(s).`
        }
    } catch (_e) { }

    const ok = await showConfirmModal(
        'Clear all snapshots',
        `Clear all saved snapshots for all configurations? This cannot be undone.`
    )
    if (!ok) {
        appendTerminal('Clear snapshots cancelled', 'runtime')
        return
    }

    // Store counts before clearing for accurate reporting
    const clearedSnapshots = totalSnapshots
    const clearedConfigs = configs.size

    try {
        // Remove all snapshot keys from localStorage
        let actuallyDeleted = 0
        for (const key of keysToDelete) {
            try {
                if (localStorage.getItem(key)) {
                    localStorage.removeItem(key)
                    actuallyDeleted++
                }
            } catch (_e) { }
        }

        // Report what was actually cleared (only one message)
        if (actuallyDeleted > 0) {
            appendTerminal(`Cleared ${clearedSnapshots} snapshot(s) across ${clearedConfigs} configuration(s)`, 'runtime')
        } else {
            appendTerminal('No snapshots to clear', 'runtime')
        }

        try { activateSideTab('terminal') } catch (_e) { }

        // Update the modal if it's open - force a complete refresh
        try {
            renderSnapshots()
            // Force update of storage calculations by triggering a fresh calculation
            setTimeout(() => {
                try { renderSnapshots() } catch (_e) { }
            }, 100)
        } catch (_e) { }
    } catch (e) {
        appendTerminal('Clear snapshots failed: ' + e, 'runtime')
    }
}
