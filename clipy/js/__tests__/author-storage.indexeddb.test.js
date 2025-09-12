import { jest } from '@jest/globals'

// Minimal in-memory fake IndexedDB for testing the author-storage module
function createFakeIndexedDB() {
    const stores = {}
    const db = {
        objectStoreNames: { contains: (n) => !!stores[n] },
        createObjectStore(name, opts) { stores[name] = { keyPath: opts && opts.keyPath, data: new Map() } },
        transaction(name, mode) {
            if (!stores[name]) throw new Error('no store')
            const store = stores[name]
            return {
                objectStore() {
                    return {
                        put(obj) {
                            const req = {}
                            setTimeout(() => { store.data.set(obj.id, obj); req.result = obj; if (typeof req.onsuccess === 'function') req.onsuccess({ target: req }) }, 0)
                            return req
                        },
                        getAll() {
                            const req = {}
                            setTimeout(() => { req.result = Array.from(store.data.values()); if (typeof req.onsuccess === 'function') req.onsuccess({ target: req }) }, 0)
                            return req
                        },
                        get(id) {
                            const req = {}
                            setTimeout(() => { req.result = store.data.get(id) || null; if (typeof req.onsuccess === 'function') req.onsuccess({ target: req }) }, 0)
                            return req
                        },
                        delete(id) {
                            const req = {}
                            setTimeout(() => { store.data.delete(id); if (typeof req.onsuccess === 'function') req.onsuccess({ target: req }) }, 0)
                            return req
                        }
                    }
                }
            }
        }
    }

    return {
        open(name, version) {
            const req = {}
            setTimeout(() => {
                if (typeof req.onupgradeneeded === 'function') req.onupgradeneeded({ target: { result: db } })
                req.result = db
                if (typeof req.onsuccess === 'function') req.onsuccess({ target: req })
            }, 0)
            return req
        }
    }
}

describe('author-storage with IndexedDB available', () => {
    beforeEach(() => {
        jest.resetModules()
        if (typeof localStorage !== 'undefined') localStorage.clear()
        // install fake indexedDB
        window.indexedDB = createFakeIndexedDB()
    })

    test('saveDraft/listDrafts/loadDraft/deleteDraft operate via IndexedDB', async () => {
        const mod = await import('../author-storage.js')
        const { saveDraft, listDrafts, loadDraft, deleteDraft } = mod

        const a = { id: 'i1', config: { id: 'c1', version: 'v1' }, data: 'A' }
        const b = { id: 'i2', config: { id: 'c2', version: 'v2' }, data: 'B' }

        const savedA = await saveDraft(a)
        expect(savedA).toMatchObject({ id: 'i1' })

        const savedB = await saveDraft(b)
        expect(savedB).toMatchObject({ id: 'i2' })

        const all = await listDrafts()
        expect(Array.isArray(all)).toBe(true)
        expect(all.find(x => x.id === 'i1')).toBeTruthy()
        expect(all.find(x => x.id === 'i2')).toBeTruthy()

        const loaded = await loadDraft('i1')
        expect(loaded).toMatchObject({ id: 'i1', data: 'A' })

        const del = await deleteDraft('i1')
        expect(del).toBe(true)

        const after = await listDrafts()
        expect(after.find(x => x.id === 'i1')).toBeFalsy()
    })

    test('findDraftByConfigIdAndVersion finds matching draft in IndexedDB', async () => {
        const mod = await import('../author-storage.js')
        const { saveDraft, findDraftByConfigIdAndVersion } = mod

        const rec = { id: 'z1', config: { id: 'cfgX', version: '9' }, data: 'Z' }
        await saveDraft(rec)

        const found = await findDraftByConfigIdAndVersion('cfgX', '9')
        expect(found).toBeTruthy()
        expect(found.id).toBe('z1')
    })
})
