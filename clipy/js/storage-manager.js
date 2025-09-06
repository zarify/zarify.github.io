// Storage management and quota handling
import { getConfigKey, getConfigIdentity } from './config.js'
import { showConfirmModal } from './modals.js'
import { appendTerminal } from './terminal.js'

// Storage limits (conservative estimates)
const LOCALSTORAGE_LIMIT = 5 * 1024 * 1024 // 5MB
const WARNING_THRESHOLD = 0.8 // Warn at 80% capacity
const CRITICAL_THRESHOLD = 0.9 // Critical at 90% capacity

/**
 * Calculate current localStorage usage
 */
export function getStorageUsage() {
    let totalSize = 0
    const breakdown = {
        snapshots: 0,
        files: 0,
        autosave: 0,
        other: 0
    }

    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            const value = localStorage.getItem(key)
            const size = (key.length + (value ? value.length : 0)) * 2 // UTF-16 encoding
            totalSize += size

            // Categorize storage
            if (key.startsWith('snapshots_')) {
                breakdown.snapshots += size
            } else if (key === 'ssg_files_v1') {
                breakdown.files += size
            } else if (key === 'autosave') {
                breakdown.autosave += size
            } else {
                breakdown.other += size
            }
        }
    }

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
export function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value)
        return { success: true }
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
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

    appendTerminal(`⚠️ Storage quota exceeded (${usage.totalSizeMB}MB used)`, 'runtime')

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
        localStorage.setItem(key, value)
        return { success: true, recovered: true }
    } catch (error) {
        return { success: false, error: 'Storage quota still exceeded after cleanup' }
    }
}

/**
 * Show storage quota exceeded modal
 */
async function showStorageQuotaModal(usage) {
    return new Promise((resolve) => {
        // Create modal
        const modal = document.createElement('div')
        modal.className = 'modal'
        modal.setAttribute('aria-hidden', 'false')
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Storage Quota Exceeded</h3>
                </div>
                <div class="storage-info">
                    <p>Your browser storage is full (${usage.totalSizeMB}MB used).</p>
                    <p>Choose how to free up space:</p>
                    <div class="storage-breakdown">
                        ${Object.entries(usage.breakdown).map(([category, size]) =>
            `<div>${category}: ${(size / (1024 * 1024)).toFixed(2)}MB</div>`
        ).join('')}
                    </div>
                </div>
                <div class="modal-actions">
                    <button id="cleanup-old-snapshots" class="btn">Delete Old Snapshots</button>
                    <button id="cleanup-other-configs" class="btn">Delete Other Config Snapshots</button>
                    <button id="cleanup-all" class="btn btn-danger">Delete All Storage Data</button>
                    <button id="cancel-cleanup" class="btn">Cancel</button>
                </div>
            </div>
        `

        document.body.appendChild(modal)

        // Add event listeners
        modal.querySelector('#cleanup-old-snapshots').addEventListener('click', () => {
            document.body.removeChild(modal)
            resolve('cleanup-old-snapshots')
        })

        modal.querySelector('#cleanup-other-configs').addEventListener('click', () => {
            document.body.removeChild(modal)
            resolve('cleanup-other-configs')
        })

        modal.querySelector('#cleanup-all').addEventListener('click', () => {
            document.body.removeChild(modal)
            resolve('cleanup-all')
        })

        modal.querySelector('#cancel-cleanup').addEventListener('click', () => {
            document.body.removeChild(modal)
            resolve('cancel')
        })
    })
}

/**
 * Cleanup old snapshots for current config
 */
async function cleanupOldSnapshots() {
    const configKey = getConfigKey()
    const snapshots = JSON.parse(localStorage.getItem(configKey) || '[]')

    if (snapshots.length <= 1) {
        appendTerminalDebug('No old snapshots to clean up')
        return
    }

    // Keep only the 3 most recent snapshots
    const sorted = snapshots.sort((a, b) => (b.ts || 0) - (a.ts || 0))
    const keep = sorted.slice(0, 3)

    localStorage.setItem(configKey, JSON.stringify(keep))
    appendTerminalDebug(`Cleaned up ${snapshots.length - keep.length} old snapshots`)
}

/**
 * Cleanup snapshots from other configurations
 */
async function cleanupOtherConfigs() {
    const currentConfigKey = getConfigKey()
    const keysToRemove = []

    for (let key in localStorage) {
        if (key.startsWith('snapshots_') && key !== currentConfigKey) {
            keysToRemove.push(key)
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
    appendTerminalDebug(`Cleaned up snapshots from ${keysToRemove.length} other configurations`)
}

/**
 * Cleanup all storage data (emergency option)
 */
async function cleanupAllStorageData() {
    const confirmed = await showConfirmModal(
        'Delete All Data',
        'This will delete ALL snapshots and files. This cannot be undone. Are you sure?'
    )

    if (!confirmed) return

    // Clear all storage except config data
    const keysToRemove = []
    for (let key in localStorage) {
        if (key.startsWith('snapshots_') || key === 'ssg_files_v1' || key === 'autosave') {
            keysToRemove.push(key)
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
    appendTerminalDebug(`Emergency cleanup: removed ${keysToRemove.length} storage items`)
}

/**
 * Get all snapshot configurations
 */
export function getAllSnapshotConfigs() {
    const configs = []

    for (let key in localStorage) {
        if (key.startsWith('snapshots_')) {
            const configId = key.replace('snapshots_', '')
            const snapshots = JSON.parse(localStorage.getItem(key) || '[]')
            configs.push({
                configId,
                snapshotCount: snapshots.length,
                storageKey: key,
                size: (key.length + localStorage.getItem(key).length) * 2
            })
        }
    }

    return configs
}

/**
 * Show storage usage in terminal
 */
export function showStorageInfo() {
    const usage = getStorageUsage()
    const configs = getAllSnapshotConfigs()

    appendTerminal(`📊 Storage Usage: ${usage.totalSizeMB}MB / ${(LOCALSTORAGE_LIMIT / (1024 * 1024)).toFixed(0)}MB (${(usage.percentage * 100).toFixed(1)}%)`, 'runtime')

    if (usage.breakdown.snapshots) {
        appendTerminal(`📸 Snapshots: ${(usage.breakdown.snapshots / (1024 * 1024)).toFixed(2)}MB across ${configs.length} configurations`, 'runtime')
    }

    if (usage.breakdown.files) {
        appendTerminal(`📁 Files: ${(usage.breakdown.files / (1024 * 1024)).toFixed(2)}MB`, 'runtime')
    }

    if (usage.isWarning) {
        appendTerminal(`⚠️ Storage usage is ${usage.isCritical ? 'critical' : 'high'}. Consider cleaning up old snapshots.`, 'runtime')
    }

    return usage
}

/**
 * Check storage and warn user if needed
 */
export function checkStorageHealth() {
    const usage = getStorageUsage()

    if (usage.isCritical) {
        appendTerminal(`🚨 Critical: Storage ${(usage.percentage * 100).toFixed(1)}% full. Please clean up data soon.`, 'runtime')
    } else if (usage.isWarning) {
        appendTerminal(`⚠️ Warning: Storage ${(usage.percentage * 100).toFixed(1)}% full.`, 'runtime')
    }

    return usage
}
