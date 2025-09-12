import { clearLocalStorageMirror } from './test-utils/test-setup.js'

test('createFileManager basic CRUD and protected MAIN_FILE', async () => {
    const { clearLocalStorageMirror } = await import('./test-utils/test-setup.js')
    // Use the global localStorage shim provided by jest.setup.js for consistency
    clearLocalStorageMirror()
    const mod = await import('../vfs-client.js')
    const { createFileManager, MAIN_FILE } = mod
    const host = window
    const fm = createFileManager(host)

    // initially empty
    expect(fm.list()).toEqual([])

    // write and read
    await fm.write('/a.txt', 'A')
    expect(await fm.read('/a.txt')).toBe('A')
    expect(fm.list()).toContain('/a.txt')

    // delete non-main
    await fm.delete('/a.txt')
    expect(await fm.read('/a.txt')).toBeNull()

    // protected main file should not be deleted
    await fm.write(MAIN_FILE, 'MAIN')
    expect(await fm.read(MAIN_FILE)).toBe('MAIN')
    await fm.delete(MAIN_FILE)
    expect(await fm.read(MAIN_FILE)).toBe('MAIN')

    // keep global localStorage shim as provided by jest.setup.js
})

test('notification system consumes expected write and dedupes/suppresses/ignores MAIN_FILE', async () => {
    const { makeFakeStorage } = await import('./test-utils/storage-fixtures.js')
    const storage = makeFakeStorage()
    const mod = await import('../vfs-client.js')
    const { createNotificationSystem, markExpectedWrite, MAIN_FILE } = mod

    // Host with its own localStorage and tracking maps
    const host = { localStorage: storage, __ssg_expected_writes: new Map(), __ssg_pending_tabs: [] }
    const notifier = createNotificationSystem(host)

    // Mark an expected write and then notify with matching content -> should be consumed
    markExpectedWrite('/x.py', 'C1', host)
    host.__ssg_notify_file_written('/x.py', 'C1')
    expect(host.__ssg_expected_writes.size).toBe(0)
    expect(host.__ssg_pending_tabs).not.toEqual(expect.arrayContaining(['/x.py']))

    // Rapid duplicate notifications should be deduped (only one pending entry)
    host.__ssg_pending_tabs = []
    host.__ssg_expected_writes = new Map()
    host.__ssg_notify_file_written('dup.py', 'd')
    host.__ssg_notify_file_written('dup.py', 'd')
    // Allow microtask scheduling to run dedupe (it's synchronous guarded by timestamp)
    expect(host.__ssg_pending_tabs.filter(x => x === '/dup.py').length).toBeLessThanOrEqual(1)

    // Global suppression prevents pending tab addition
    const host2 = { localStorage: makeFakeStorage(), __ssg_expected_writes: new Map(), __ssg_pending_tabs: [], __ssg_suppress_notifier: true }
    createNotificationSystem(host2)
    host2.__ssg_notify_file_written('suppress.py', 'x')
    expect(host2.__ssg_pending_tabs).toEqual([])

    // MAIN_FILE notifications should be ignored (not added to pending tabs)
    const host3 = { localStorage: makeFakeStorage(), __ssg_expected_writes: new Map(), __ssg_pending_tabs: [] }
    createNotificationSystem(host3)
    host3.__ssg_notify_file_written(MAIN_FILE, 'm')
    expect(host3.__ssg_pending_tabs).not.toEqual(expect.arrayContaining([MAIN_FILE]))
})

test('createVfsClient exposes expected helpers', async () => {
    const mod = await import('../vfs-client.js')
    const { createVfsClient } = mod
    const client = createVfsClient({})
    expect(typeof client.createFileManager).toBe('function')
    expect(typeof client.createNotificationSystem).toBe('function')
    expect(typeof client.markExpectedWrite).toBe('function')
})
