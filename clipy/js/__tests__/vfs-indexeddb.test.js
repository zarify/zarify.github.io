test('indexedDB backend basic CRUD and mount/sync via fake indexedDB', async () => {
    const originalIDB = window.indexedDB

    // Simple in-memory fake indexedDB implementation
    function makeFakeIDB() {
        const stores = new Map()

        const db = {
            objectStoreNames: {
                contains: (name) => stores.has(name)
            },
            createObjectStore: (name) => { stores.set(name, new Map()) },
            transaction: (storeName, mode) => ({
                objectStore: () => {
                    const store = stores.get(storeName) || new Map()
                    function makeReq(result) {
                        const req = {}
                        req.onsuccess = null
                        req.onerror = null
                        setTimeout(() => { req.result = result; if (typeof req.onsuccess === 'function') req.onsuccess() }, 0)
                        return req
                    }
                    return {
                        getAllKeys: () => makeReq(Array.from(store.keys())),
                        get: (key) => makeReq(store.has(key) ? { path: key, content: store.get(key) } : undefined),
                        put: (rec) => { store.set(rec.path, rec.content); return makeReq(undefined) },
                        delete: (key) => { store.delete(key); return makeReq(undefined) }
                    }
                }
            })
        }

        return {
            open: (name, version) => {
                const req = {}
                req.onupgradeneeded = null
                req.onsuccess = null
                req.onerror = null
                // expose result as db
                req.result = db
                // call event handlers on next tick so callers can set them
                setTimeout(() => {
                    if (typeof req.onupgradeneeded === 'function') req.onupgradeneeded()
                    if (typeof req.onsuccess === 'function') req.onsuccess()
                }, 0)
                return req
            }
        }
    }

    try {
        window.indexedDB = makeFakeIDB()

        const mod = await import('../vfs-backend.js')
        const { init } = mod

        const backend = await init()
        expect(typeof backend.list).toBe('function')

        // basic write/read
        await backend.write('/i1.txt', 'I1')
        expect(await backend.read('/i1.txt')).toBe('I1')

        // list
        const keys = await backend.list()
        expect(keys).toContain('/i1.txt')

        // delete
        await backend.delete('/i1.txt')
        expect(await backend.read('/i1.txt')).toBeNull()

        // mountToEmscripten
        await backend.write('/m/a.txt', 'MA')
        const writes = []
        const FS_mount = { writeFile: (p, c) => writes.push([p, c]), mkdir: (d) => { } }
        await backend.mountToEmscripten(FS_mount)
        expect(writes).toEqual(expect.arrayContaining([['/m/a.txt', 'MA']]))

        // syncFromEmscripten
        const FS_sync = { _listFiles: () => ['/s1.txt'], readFile: (p, opts) => (p === '/s1.txt' ? 'S1' : null) }
        await backend.syncFromEmscripten(FS_sync)
        expect(await backend.read('/s1.txt')).toBe('S1')

    } finally {
        window.indexedDB = originalIDB
    }
})
