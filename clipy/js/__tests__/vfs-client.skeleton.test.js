test('initializeVFS provides FileManager and mem snapshot', async () => {
    const mod = await import('../vfs-client.js')
    const { initializeVFS, getFileManager, getMem, settleVfsReady } = mod

    // Provide a minimal config
    const cfg = { starter: '# hello' }

    // Call initializeVFS - it attempts to import vfs-backend.js; but in many test
    // environments that module may not exist. We assert that initializeVFS returns
    // an object with FileManager even when backend init fails (fallback path).
    const res = await initializeVFS(cfg)
    expect(res).toHaveProperty('FileManager')

    const fm = getFileManager()
    expect(typeof fm.list === 'function').toBe(true)
    expect(typeof fm.read === 'function').toBe(true)

    // mem may be an object
    const mem = getMem()
    expect(typeof mem === 'object').toBe(true)

    // settleVfsReady should be a function we can call safely
    expect(typeof settleVfsReady === 'function').toBe(true)
})
