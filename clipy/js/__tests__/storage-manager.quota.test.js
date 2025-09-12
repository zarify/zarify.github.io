import { makeAlwaysQuotaStorage, makeMgr } from './test-utils/storage-fixtures.js'

test('safeSetItem handles quota exceeded and returns failure when user cancels', async () => {
    const storage = makeAlwaysQuotaStorage()
    // Provide a showConfirm implementation that returns false (cancel)
    const mgr = await makeMgr(storage, { showConfirmModal: async () => false })

    const res = await mgr.safeSetItem('k', 'v')
    // As showConfirm returns false, handleQuotaExceeded should return cancel result
    expect(res && (res.success === false || res.error)).toBeTruthy()
})
