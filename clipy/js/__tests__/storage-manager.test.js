test('getStorageUsage empty and populated breakdown', async () => {
    const { makeFakeStorage, makeMgr } = await import('./test-utils/storage-fixtures.js')
    const storage = makeFakeStorage()
    const mgr = await makeMgr(storage)

    const emptyUsage = mgr.getStorageUsage()
    expect(emptyUsage.totalSize).toBeDefined()
    expect(Number(emptyUsage.totalSize)).toBeGreaterThanOrEqual(0)
    expect(emptyUsage.percentage).toBe(0)
    expect(emptyUsage.isWarning).toBeFalsy()

    // Populate storage with different keys
    storage['snapshots_cfg'] = JSON.stringify([1, 2, 3])
    storage['ssg_files_v1'] = "filecontents"
    storage['autosave'] = "autos"
    storage['other_key'] = "x"

    const usage = mgr.getStorageUsage()
    expect(usage.totalSize).toBeGreaterThan(0)
    expect(usage.breakdown.snapshots).toBeGreaterThan(0)
    expect(usage.breakdown.files).toBeGreaterThan(0)
    expect(usage.breakdown.autosave).toBeGreaterThan(0)
    expect(usage.breakdown.other).toBeGreaterThan(0)
})

test('getAllSnapshotConfigs returns snapshot entries', async () => {
    const { makeFakeStorage, makeMgr } = await import('./test-utils/storage-fixtures.js')
    const storage = makeFakeStorage({ 'snapshots_alpha': JSON.stringify([{ "ts": 1 }, { "ts": 2 }]), 'snapshots_beta': JSON.stringify([{ "ts": 3 }]) })
    const mgr = await makeMgr(storage)
    const configs = mgr.getAllSnapshotConfigs()
    const ids = configs.map(c => c.configId).sort()
    expect(ids).toEqual(['alpha', 'beta'])
    const alpha = configs.find(c => c.configId === 'alpha')
    expect(alpha.snapshotCount).toBe(2)
})

test('cleanupOldSnapshots truncates to 3 most recent', async () => {
    const { makeFakeStorage, makeMgr } = await import('./test-utils/storage-fixtures.js')
    const key = 'snapshots_current'
    const snaps = [{ ts: 1 }, { ts: 2 }, { ts: 3 }, { ts: 4 }, { ts: 5 }]
    const storage = makeFakeStorage({ [key]: JSON.stringify(snaps) })
    const mgr = await makeMgr(storage, { getConfigKey: () => key })
    await mgr._internal.cleanupOldSnapshots()
    const after = JSON.parse(storage.getItem(key) || '[]')
    expect(Array.isArray(after)).toBeTruthy()
    expect(after.length).toBeLessThanOrEqual(3)
    // should keep the highest ts entries (5,4,3)
    expect(after.map(s => s.ts)).toEqual([5, 4, 3])
})

test('cleanupOtherConfigs removes non-current snapshots', async () => {
    const { makeFakeStorage, makeMgr } = await import('./test-utils/storage-fixtures.js')
    const storage = makeFakeStorage({ 'snapshots_current': JSON.stringify([]), 'snapshots_other': JSON.stringify([1]), 'snapshots_another': JSON.stringify([1, 2]) })
    const mgr = await makeMgr(storage, { getConfigKey: () => 'snapshots_current' })
    await mgr._internal.cleanupOtherConfigs()
    expect(storage.getItem('snapshots_other')).toBeNull()
    expect(storage.getItem('snapshots_another')).toBeNull()
    expect(storage.getItem('snapshots_current')).not.toBeNull()
})

test('safeSetItem handles QuotaExceededError and cancel path', async () => {
    const { makeAlwaysQuotaStorage, makeMgr } = await import('./test-utils/storage-fixtures.js')
    const storage = makeAlwaysQuotaStorage()
    // showConfirmModal that returns cancel
    const showConfirm = async (title, msg) => 'cancel'
    const mgr = await makeMgr(storage, { showConfirmModal: showConfirm })

    const res = await mgr.safeSetItem('k', 'v')
    expect(res.success).toBeFalsy()
})

test('safeSetItem recovers after cleanup when user chooses cleanup-old-snapshots', async () => {
    const { makeFlakyQuotaStorage, makeMgr } = await import('./test-utils/storage-fixtures.js')
    const storage = makeFlakyQuotaStorage()
    // showConfirmModal that returns boolean true so storage-manager maps it to cleanup-old-snapshots
    const showConfirm = async (title, msg) => true
    // Create a manager wired to a config key so cleanupOldSnapshots can run
    const key = 'snapshots_cfg'
    storage[key] = JSON.stringify([{ ts: 1 }, { ts: 2 }, { ts: 3 }, { ts: 4 }])
    const mgr = await makeMgr(storage, { showConfirmModal: showConfirm, getConfigKey: () => key })

    const res = await mgr.safeSetItem('k', 'v')
    expect(res.success).toBeTruthy()
    expect(res.recovered).toBeTruthy()
    expect(storage['k']).toBe('v')
})

test('safeSetItem rethrows non-quota error', async () => {
    const { makeFakeStorage, makeMgr } = await import('./test-utils/storage-fixtures.js')
    const storage = makeFakeStorage()
    Object.defineProperty(storage, 'setItem', { value: (k, v) => { throw new Error('boom') }, enumerable: false })
    const mgr = await makeMgr(storage, { showConfirmModal: async () => 'cancel' })
    expect(() => mgr.safeSetItem('k', 'v')).toThrow(/boom/)
})

// Edge cases
import { setupTerminalDOM } from './test-utils/test-setup.js'

test('showStorageQuotaModal DOM fallback resolves on button click', async () => {
    const { makeFakeStorage, makeMgr } = await import('./test-utils/storage-fixtures.js')
    const storage = makeFakeStorage()
    const { createStorageManager } = await import('../storage-manager.js')
    // create a jsdom document
    // jsdom may require TextEncoder global in some Node environments
    if (typeof global.TextEncoder === 'undefined') {
        const { TextEncoder, TextDecoder } = await import('util')
        global.TextEncoder = TextEncoder
        global.TextDecoder = TextDecoder
    }
    const { JSDOM } = await import('jsdom')
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`)
    const mgr = createStorageManager({ storage, document: dom.window.document, appendTerminal: () => { }, appendTerminalDebug: () => { }, showConfirmModal: {} })
    const usage = mgr.getStorageUsage()
    // call modal and simulate clicking the cleanup-old-snapshots button
    const p = mgr._internal.showStorageQuotaModal(usage)
    // wait a tick then find button and click
    await new Promise(r => setTimeout(r, 0))
    const btn = dom.window.document.querySelector('#cleanup-old-snapshots')
    expect(btn).not.toBeNull()
    btn.click()
    const res = await p
    expect(res).toBe('cleanup-old-snapshots')
})

test('cleanupAllStorageData respects showConfirm false', async () => {
    const { makeFakeStorage, makeMgr } = await import('./test-utils/storage-fixtures.js')
    const storage = makeFakeStorage({ 'snapshots_cfg': '[]', 'ssg_files_v1': 'x', 'autosave': 'a' })
    const mgr = await makeMgr(storage, { showConfirmModal: async () => false })
    await mgr._internal.cleanupAllStorageData()
    // nothing should be removed
    expect(storage['ssg_files_v1']).toBe('x')
})

test('cleanupAllStorageData deletes when confirmed', async () => {
    const { makeFakeStorage, makeMgr } = await import('./test-utils/storage-fixtures.js')
    const storage = makeFakeStorage({ 'snapshots_cfg': '[]', 'ssg_files_v1': 'x', 'autosave': 'a' })
    const mgr = await makeMgr(storage, { showConfirmModal: async () => true })
    await mgr._internal.cleanupAllStorageData()
    expect(storage['ssg_files_v1']).toBeUndefined()
    expect(storage['autosave']).toBeUndefined()
})

test('getAllSnapshotConfigs handles malformed JSON gracefully', async () => {
    const { makeFakeStorage, makeMgr } = await import('./test-utils/storage-fixtures.js')
    const storage = makeFakeStorage({ 'snapshots_bad': 'not-json' })
    const mgr = await makeMgr(storage)
    const configs = mgr.getAllSnapshotConfigs()
    expect(configs.length).toBe(1)
    expect(configs[0].snapshotCount).toBe(0)
})

test('showStorageInfo writes expected summary lines', async () => {
    const { makeFakeStorage, makeMgr } = await import('./test-utils/storage-fixtures.js')
    // create storage with snapshot and file entries so snapshot/files lines are printed
    const storage = makeFakeStorage({ 'snapshots_cfg': JSON.stringify([1, 2]), 'ssg_files_v1': 'filecontent' })
    const messages = []
    const mgr = await makeMgr(storage, { appendTerminal: (msg, tag) => messages.push({ msg, tag }) })

    const usage = mgr.showStorageInfo()
    expect(usage.totalSizeMB).toBeDefined()
    // ensure appendTerminal was called with summary lines
    const joined = messages.map(m => m.msg).join('\n')
    expect(joined).toMatch(/Storage Usage:/)
    expect(joined).toMatch(/Snapshots:/)
    expect(joined).toMatch(/Files:/)
})

test('checkStorageHealth outputs warning and critical messages', async () => {
    const { makeFakeStorage, makeMgr } = await import('./test-utils/storage-fixtures.js')
    // Create a very large value to push usage over the warning/critical threshold
    const huge = 'x'.repeat(3000000) // ~6MB when counted as UTF-16 bytes
    const storage = makeFakeStorage({ 'snapshots_big': huge })
    const messages = []
    const mgr = await makeMgr(storage, { appendTerminal: (msg, tag) => messages.push(msg) })

    messages.length = 0
    mgr.checkStorageHealth()
    // should emit either a Warning or Critical message
    expect(messages.some(m => /Warning|⚠️|Critical|🚨/.test(m))).toBeTruthy()
})
