// Autosave functionality
import { $ } from './utils.js'
import { getCodeMirror, getTextarea } from './editor.js'
import { getFileManager } from './vfs-client.js'
import { getConfigIdentity } from './config.js'
import { getSnapshotsForCurrentConfig, saveSnapshotsForCurrentConfig } from './snapshots.js'

let autosaveTimer = null
const CURRENT_SNAPSHOT_ID = '__current__'

export function initializeAutosave() {
    const cm = getCodeMirror()
    const textarea = getTextarea()

    // Hook editor change events
    if (cm) {
        cm.on('change', scheduleAutosave)
    } else if (textarea) {
        textarea.addEventListener('input', scheduleAutosave)
    }
}

async function scheduleAutosave() {
    const autosaveIndicator = $('autosave-indicator')

    try {
        if (autosaveIndicator) autosaveIndicator.textContent = 'Saving...'
    } catch (_e) { }

    if (autosaveTimer) clearTimeout(autosaveTimer)

    autosaveTimer = setTimeout(async () => {
        const cm = getCodeMirror()
        const textarea = getTextarea()
        const content = (cm ? cm.getValue() : (textarea ? textarea.value : ''))
        const FileManager = getFileManager()
        const configIdentity = getConfigIdentity()
        let files = {}
        if (FileManager && typeof FileManager.list === 'function') {
            const names = FileManager.list()
            for (const n of names) {
                try {
                    const v = await Promise.resolve(FileManager.read(n))
                    if (v != null) files[n] = v
                } catch (_e) { }
            }
        }
        // Mark this snapshot as the current one
        const snaps = getSnapshotsForCurrentConfig()
        // Remove any previous current snapshot
        const filtered = snaps.filter(s => s.id !== CURRENT_SNAPSHOT_ID)
        filtered.push({
            id: CURRENT_SNAPSHOT_ID,
            ts: Date.now(),
            config: configIdentity,
            files
        })
        saveSnapshotsForCurrentConfig(filtered)

        try {
            const activePath = (window.TabManager && typeof window.TabManager.getActive === 'function')
                ? window.TabManager.getActive()
                : null
            if (autosaveIndicator) {
                autosaveIndicator.textContent = activePath
                    ? ('Saved (' + activePath + ')')
                    : 'Saved'
            }
        } catch (_e) {
            try {
                if (autosaveIndicator) autosaveIndicator.textContent = 'Saved'
            } catch (__e) { }
        }
    }, 300)
}
