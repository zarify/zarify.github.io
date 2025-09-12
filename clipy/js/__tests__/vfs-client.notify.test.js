test('markExpectedWrite and notify consume expected write and update pending tabs', async () => {
    const mod = await import('../vfs-client.js')
    const { markExpectedWrite, MAIN_FILE } = mod

    // ensure clean state
    window.__ssg_expected_writes = new Map()
    window.__ssg_pending_tabs = []
    window.__ssg_suppress_notifier = false
    const debugCalls = []
    window.appendTerminalDebug = (m) => debugCalls.push(m)

    // initialize VFS to ensure notifier is set up
    await mod.initializeVFS({ starter: '#x' })

    // Mark an expected write for 'other.py'
    markExpectedWrite('other.py', 'content-1')
    expect(window.__ssg_expected_writes.size).toBe(1)

    // Simulate a runtime notification that matches expected write
    window.__ssg_notify_file_written('other.py', 'content-1')

    // expected write consumed
    expect(window.__ssg_expected_writes.size).toBe(0)

    // Because the notification matched an expected write it is intentionally ignored
    // and should NOT add a pending tab
    expect(window.__ssg_pending_tabs).not.toEqual(expect.arrayContaining(['/other.py']))
})


test('notify debounces rapid duplicate notifications', async () => {
    const mod = await import('../vfs-client.js')
    const { markExpectedWrite } = mod

    window.__ssg_expected_writes = new Map()
    window.__ssg_pending_tabs = []
    window.__ssg_suppress_notifier = false
    window.appendTerminalDebug = () => { }

    await mod.initializeVFS({ starter: '#y' })

    // Call notify twice in quick succession (do NOT mark an expected write so notify is processed)
    window.__ssg_notify_file_written('dup.py', 'c')
    window.__ssg_notify_file_written('dup.py', 'c')

    // Pending tabs should contain single entry for /dup.py (debounced)
    const entries = window.__ssg_pending_tabs.filter(x => x === '/dup.py')
    expect(entries.length).toBe(1)
})


test('notify respects global suppression', async () => {
    const mod = await import('../vfs-client.js')
    const { markExpectedWrite } = mod

    window.__ssg_expected_writes = new Map()
    window.__ssg_pending_tabs = []
    window.__ssg_suppress_notifier = true
    const debugCalls = []
    window.appendTerminalDebug = (m) => debugCalls.push(m)

    await mod.initializeVFS({ starter: '#z' })

    // Do not mark an expected write; suppression should prevent pending tab addition
    window.__ssg_notify_file_written('suppress.py', 'x')
    expect(window.__ssg_pending_tabs).not.toEqual(expect.arrayContaining(['/suppress.py']))
})


test('notify does not add MAIN_FILE to pending tabs', async () => {
    const mod = await import('../vfs-client.js')
    const { MAIN_FILE } = mod

    window.__ssg_expected_writes = new Map()
    window.__ssg_pending_tabs = []
    window.__ssg_suppress_notifier = false
    window.appendTerminalDebug = () => { }

    await mod.initializeVFS({ starter: '#main' })

    // Notify MAIN_FILE
    window.__ssg_notify_file_written(MAIN_FILE, 'anything')

    // Should not add MAIN_FILE to pending tabs
    expect(window.__ssg_pending_tabs).not.toEqual(expect.arrayContaining([MAIN_FILE]))
})
