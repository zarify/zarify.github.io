// Storage management and quota handling
import { getConfigKey, getConfigIdentity } from './config.js'
import { showConfirmModal } from './modals.js'
import { appendTerminal as _appendTerminal, appendTerminalDebug as _appendTerminalDebug } from './terminal.js'

// Storage limits (conservative estimates)
const LOCALSTORAGE_LIMIT = 5 * 1024 * 1024 // 5MB
const WARNING_THRESHOLD = 0.8 // Warn at 80% capacity
const CRITICAL_THRESHOLD = 0.9 // Critical at 90% capacity

export function createStorageManager(opts = {}) {
    const storage = opts.storage || (typeof localStorage !== 'undefined' ? localStorage : undefined)
    const doc = opts.document || (typeof document !== 'undefined' ? document : undefined)
    const appendTerminal = opts.appendTerminal || _appendTerminal
    const appendTerminalDebug = opts.appendTerminalDebug || _appendTerminalDebug || (() => { })
    const showConfirm = opts.showConfirmModal || showConfirmModal
    const getKey = opts.getConfigKey || getConfigKey
    const getIdentity = opts.getConfigIdentity || getConfigIdentity

    function getStorageUsage() {
        let totalSize = 0
        const breakdown = {
            snapshots: 0,
            files: 0,
            autosave: 0,
            other: 0
        }

        try {
            for (let key in storage) {
                if (Object.prototype.hasOwnProperty.call(storage, key)) {
                    const value = storage.getItem(key)
                    const size = (key.length + (value ? value.length : 0)) * 2 // UTF-16 encoding
                    totalSize += size

                    // Categorize storage
                    if (key.startsWith('snapshots_')) {
                        breakdown.snapshots += size
                    } else if (key === 'ssg_files_v1') {
                        // Legacy key may exist in some test harnesses; account under files
                        breakdown.files += size
                    } else if (key === 'autosave') {
                        breakdown.autosave += size
                    } else {
                        breakdown.other += size
                    }
                }
            }
        } catch (_e) { }

        return {
            totalSize,
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            percentage: (totalSize / LOCALSTORAGE_LIMIT),
            breakdown,
            isWarning: (totalSize / LOCALSTORAGE_LIMIT) > WARNING_THRESHOLD,
            isCritical: (totalSize / LOCALSTORAGE_LIMIT) > CRITICAL_THRESHOLD
        }
    }

    /**
     * Safe localStorage setItem with quota handling
     */
    function safeSetItem(key, value) {
        try {
            storage.setItem(key, value)
            return { success: true }
        } catch (error) {
            if (error && error.name === 'QuotaExceededError') {
                return handleQuotaExceeded(key, value)
            }
            throw error
        }
    }

    /**
     * Handle quota exceeded error
     */
    async function handleQuotaExceeded(key, value) {
        const usage = getStorageUsage()

        try { appendTerminal && appendTerminal(`⚠️ Storage quota exceeded (${usage.totalSizeMB}MB used)`, 'runtime') } catch (_e) { }

        // Show user options
        const action = await showStorageQuotaModal(usage)

        switch (action) {
            case 'cleanup-old-snapshots':
                await cleanupOldSnapshots()
                break
            case 'cleanup-other-configs':
                await cleanupOtherConfigs()
                break
            case 'cleanup-all':
                await cleanupAllStorageData()
                break
            case 'cancel':
                return { success: false, error: 'Storage quota exceeded, operation cancelled' }
        }

        // Retry the operation
        try {
            storage.setItem(key, value)
            return { success: true, recovered: true }
        } catch (error) {
            return { success: false, error: 'Storage quota still exceeded after cleanup' }
        }
    }

    /**
     * Show storage quota exceeded modal
     */
    async function showStorageQuotaModal(usage) {
        // If a custom showConfirm is available, use it to offer choices.
        // Fall back to a simple confirm cascade when not available.
        if (typeof showConfirm === 'function') {
            try {
                const choice = await showConfirm('Storage quota exceeded', `Storage is ${usage.totalSizeMB}MB used. Choose an action to free up space.`)
                // showConfirm may return boolean; normalize
                if (choice === true) return 'cleanup-old-snapshots'
                return 'cancel'
            } catch (_e) { return 'cancel' }
        }

        // Minimal DOM modal fallback if document is present
        if (!doc) return 'cancel'

        return new Promise((resolve) => {
            try {
                const modal = doc.createElement('div')
                modal.className = 'modal'
                modal.setAttribute('aria-hidden', 'false')

                // Build modal content using safe DOM APIs instead of innerHTML
                const content = doc.createElement('div')
                content.className = 'modal-content'

                const header = doc.createElement('div')
                header.className = 'modal-header'
                const h3 = doc.createElement('h3')
                h3.textContent = 'Storage Quota Exceeded'
                header.appendChild(h3)

                const info = doc.createElement('div')
                info.className = 'storage-info'
                const p1 = doc.createElement('p')
                p1.textContent = `Your browser storage is full (${usage.totalSizeMB}MB used).`
                const p2 = doc.createElement('p')
                p2.textContent = 'Choose how to free up space:'

                const breakdownDiv = doc.createElement('div')
                breakdownDiv.className = 'storage-breakdown'
                try {
                    Object.entries(usage.breakdown || {}).forEach(([category, size]) => {
                        const entry = doc.createElement('div')
                        entry.textContent = `${category}: ${(size / (1024 * 1024)).toFixed(2)}MB`
                        breakdownDiv.appendChild(entry)
                    })
                } catch (_e) { }

                info.appendChild(p1)
                info.appendChild(p2)
                info.appendChild(breakdownDiv)

                const actions = doc.createElement('div')
                actions.className = 'modal-actions'

                const btnOld = doc.createElement('button')
                btnOld.id = 'cleanup-old-snapshots'
                btnOld.className = 'btn'
                btnOld.textContent = 'Delete Old Snapshots'

                const btnOther = doc.createElement('button')
                btnOther.id = 'cleanup-other-configs'
                btnOther.className = 'btn'
                btnOther.textContent = 'Delete Other Config Snapshots'

                const btnAll = doc.createElement('button')
                btnAll.id = 'cleanup-all'
                btnAll.className = 'btn btn-danger'
                btnAll.textContent = 'Delete All Storage Data'

                const btnCancel = doc.createElement('button')
                btnCancel.id = 'cancel-cleanup'
                btnCancel.className = 'btn'
                btnCancel.textContent = 'Cancel'

                actions.appendChild(btnOld)
                actions.appendChild(btnOther)
                actions.appendChild(btnAll)
                actions.appendChild(btnCancel)

                content.appendChild(header)
                content.appendChild(info)
                content.appendChild(actions)
                modal.appendChild(content)

                doc.body.appendChild(modal)

                btnOld.addEventListener('click', () => { try { doc.body.removeChild(modal) } catch (_e) { }; resolve('cleanup-old-snapshots') })
                btnOther.addEventListener('click', () => { try { doc.body.removeChild(modal) } catch (_e) { }; resolve('cleanup-other-configs') })
                btnAll.addEventListener('click', () => { try { doc.body.removeChild(modal) } catch (_e) { }; resolve('cleanup-all') })
                btnCancel.addEventListener('click', () => { try { doc.body.removeChild(modal) } catch (_e) { }; resolve('cancel') })
            } catch (_e) { resolve('cancel') }
        })
    }

    /**
     * Cleanup old snapshots for current config
     */
    async function cleanupOldSnapshots() {
        const configKey = getKey()
        const snapshots = JSON.parse((storage.getItem(configKey) || '[]'))

        if (!Array.isArray(snapshots) || snapshots.length <= 1) {
            try { appendTerminalDebug('No old snapshots to clean up') } catch (_e) { }
            return
        }

        // Keep only the 3 most recent snapshots
        const sorted = snapshots.sort((a, b) => (b.ts || 0) - (a.ts || 0))
        const keep = sorted.slice(0, 3)

        storage.setItem(configKey, JSON.stringify(keep))
        try { appendTerminalDebug(`Cleaned up ${snapshots.length - keep.length} old snapshots`) } catch (_e) { }
    }

    /**
     * Cleanup snapshots from other configurations
     */
    async function cleanupOtherConfigs() {
        const currentConfigKey = getKey()
        const keysToRemove = []

        try {
            for (let key in storage) {
                if (Object.prototype.hasOwnProperty.call(storage, key)) {
                    if (key.startsWith('snapshots_') && key !== currentConfigKey) keysToRemove.push(key)
                }
            }
        } catch (_e) { }

        keysToRemove.forEach(key => storage.removeItem(key))
        try { appendTerminalDebug(`Cleaned up snapshots from ${keysToRemove.length} other configurations`) } catch (_e) { }
    }

    /**
     * Cleanup all storage data (emergency option)
     */
    async function cleanupAllStorageData() {
        const confirmed = await showConfirm(
            'Delete All Data',
            'This will delete ALL snapshots and files. This cannot be undone. Are you sure?'
        )

        if (!confirmed) return

        // Clear all storage except config data
        const keysToRemove = []
        try {
            for (let key in storage) {
                if (Object.prototype.hasOwnProperty.call(storage, key)) {
                    // Remove snapshots, autosave and known legacy file mirror keys
                    if (key.startsWith('snapshots_') || key === 'autosave' || key === 'ssg_files_v1' || key === 'legacy_files') keysToRemove.push(key)
                }
            }
        } catch (_e) { }

        keysToRemove.forEach(key => storage.removeItem(key))
        try { appendTerminalDebug(`Emergency cleanup: removed ${keysToRemove.length} storage items`) } catch (_e) { }
    }

    /**
     * Get all snapshot configurations
     */
    function getAllSnapshotConfigs() {
        const configs = []

        try {
            for (let key in storage) {
                if (Object.prototype.hasOwnProperty.call(storage, key)) {
                    if (key.startsWith('snapshots_')) {
                        const configId = key.replace('snapshots_', '')
                        const raw = storage.getItem(key) || '[]'
                        let snapshots = []
                        try {
                            snapshots = JSON.parse(raw)
                        } catch (_e) {
                            // malformed snapshot JSON, treat as empty
                            snapshots = []
                        }
                        configs.push({
                            configId,
                            snapshotCount: Array.isArray(snapshots) ? snapshots.length : 0,
                            storageKey: key,
                            size: (key.length + (raw ? raw.length : 0)) * 2
                        })
                    }
                }
            }
        } catch (_e) { }

        return configs
    }

    /**
     * Show storage usage in terminal
     */
    function showStorageInfo() {
        const usage = getStorageUsage()
        const configs = getAllSnapshotConfigs()

        try { appendTerminal(`📊 Storage Usage: ${usage.totalSizeMB}MB / ${(LOCALSTORAGE_LIMIT / (1024 * 1024)).toFixed(0)}MB (${(usage.percentage * 100).toFixed(1)}%)`, 'runtime') } catch (_e) { }

        if (usage.breakdown && usage.breakdown.snapshots) {
            try { appendTerminal(`📸 Snapshots: ${(usage.breakdown.snapshots / (1024 * 1024)).toFixed(2)}MB across ${configs.length} configurations`, 'runtime') } catch (_e) { }
        }

        if (usage.breakdown && usage.breakdown.files) {
            try { appendTerminal(`📁 Files: ${(usage.breakdown.files / (1024 * 1024)).toFixed(2)}MB`, 'runtime') } catch (_e) { }
        }

        if (usage.isWarning) {
            try { appendTerminal(`⚠️ Storage usage is ${usage.isCritical ? 'critical' : 'high'}. Consider cleaning up old snapshots.`, 'runtime') } catch (_e) { }
        }

        return usage
    }

    /**
     * Check storage and warn user if needed
     */
    function checkStorageHealth() {
        const usage = getStorageUsage()

        try {
            if (usage.isCritical) {
                appendTerminal(`🚨 Critical: Storage ${(usage.percentage * 100).toFixed(1)}% full. Please clean up data soon.`, 'runtime')
            } else if (usage.isWarning) {
                appendTerminal(`⚠️ Warning: Storage ${(usage.percentage * 100).toFixed(1)}% full.`, 'runtime')
            }
        } catch (_e) { }

        return usage
    }

    // Return public API
    return {
        getStorageUsage,
        safeSetItem,
        getAllSnapshotConfigs,
        showStorageInfo,
        checkStorageHealth,
        // expose cleanup helpers for testing
        _internal: {
            cleanupOldSnapshots,
            cleanupOtherConfigs,
            cleanupAllStorageData,
            showStorageQuotaModal
        }
    }
}

// Default manager bound to real globals for backwards compatibility
const _defaultStorageManager = createStorageManager()

export const getStorageUsage = (...args) => _defaultStorageManager.getStorageUsage(...args)
export const safeSetItem = (...args) => _defaultStorageManager.safeSetItem(...args)
export const getAllSnapshotConfigs = (...args) => _defaultStorageManager.getAllSnapshotConfigs(...args)
export const showStorageInfo = (...args) => _defaultStorageManager.showStorageInfo(...args)
export const checkStorageHealth = (...args) => _defaultStorageManager.checkStorageHealth(...args)
