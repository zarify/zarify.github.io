import { jest } from '@jest/globals'

describe('storage.js adapter behavior', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = ''
    })

    test('InMemoryStorage basic get/set/remove', async () => {
        const mod = await import('../storage.js')
        const { InMemoryStorage } = mod
        const s = new InMemoryStorage()
        expect(s.getItem('x')).toBeNull()
        s.setItem('x', '1')
        expect(s.getItem('x')).toBe('1')
        s.removeItem('x')
        expect(s.getItem('x')).toBeNull()
    })

    test('StorageAdapter uses provided storage and save/get autosave', async () => {
        const mod = await import('../storage.js')
        const { StorageAdapter } = mod
        const fake = {
            data: {},
            setItem: jest.fn(function (k, v) { this.data[k] = v }),
            getItem: jest.fn(function (k) { return this.data[k] === undefined ? null : this.data[k] }),
            removeItem: jest.fn(function (k) { delete this.data[k] })
        }
        const a = new StorageAdapter(fake)
        a.saveAutosave('the-code')
        expect(fake.setItem).toHaveBeenCalledWith('autosave', expect.any(String))
        const parsed = JSON.parse(fake.setItem.mock.calls[0][1])
        expect(parsed.code).toBe('the-code')

        const loaded = a.getAutosave()
        expect(loaded).not.toBeNull()
        expect(loaded.code).toBe('the-code')
    })

    test('snapshots: save, list, delete by index and handle invalid indices', async () => {
        const mod = await import('../storage.js')
        const { StorageAdapter } = mod
        const adapter = new StorageAdapter() // will use InMemoryStorage by default in test env

        adapter.saveSnapshot('a')
        adapter.saveSnapshot('b')
        adapter.saveSnapshot('c')

        let snaps = adapter.listSnapshots()
        expect(Array.isArray(snaps)).toBe(true)
        expect(snaps.length).toBe(3)
        expect(snaps.map(s => s.code)).toEqual(['a', 'b', 'c'])

        // delete middle index
        adapter.deleteSnapshots([1])
        snaps = adapter.listSnapshots()
        expect(snaps.map(s => s.code)).toEqual(['a', 'c'])

        // invalid indices should be ignored and not throw
        expect(() => adapter.deleteSnapshots([-1, 100])).not.toThrow()
        snaps = adapter.listSnapshots()
        expect(snaps.map(s => s.code)).toEqual(['a', 'c'])

        // delete multiple indices; ensure descending sort prevents index shift errors
        adapter.saveSnapshot('d') // snaps now a,c,d
        snaps = adapter.listSnapshots()
        expect(snaps.map(s => s.code)).toEqual(['a', 'c', 'd'])
        adapter.deleteSnapshots([0, 2])
        snaps = adapter.listSnapshots()
        expect(snaps.map(s => s.code)).toEqual(['c'])
    })
})
