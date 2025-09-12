import { makeFakeStorage, makeMgr } from './test-utils/storage-fixtures.js'

test('safeSetItem saves to storage and getStorageUsage reflects size', async () => {
    const storage = makeFakeStorage()
    const mgr = await makeMgr(storage)

    const kv = { a: 'hello', b: 'world' }
    const key = 'ssg_files_v1'
    const value = JSON.stringify(kv)

    const res = mgr.safeSetItem(key, value)
    expect(res && res.success).toBe(true)

    const usage = mgr.getStorageUsage()
    expect(typeof usage.totalSize).toBe('number')
    expect(storage[key]).toBe(value)
})
