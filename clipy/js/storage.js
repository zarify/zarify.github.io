// Small storage adapter for autosave and snapshots
class InMemoryStorage {
    constructor() { this._data = {} }
    getItem(k) { return this._data[k] === undefined ? null : this._data[k] }
    setItem(k, v) { this._data[k] = String(v) }
    removeItem(k) { delete this._data[k] }
}

class StorageAdapter {
    constructor(storage) {
        if (storage) this.storage = storage
        else if (typeof window !== 'undefined' && window.localStorage) this.storage = window.localStorage
        else this.storage = new InMemoryStorage()
    }

    saveAutosave(code) {
        this.storage.setItem('autosave', JSON.stringify({ ts: Date.now(), code }))
    }

    getAutosave() {
        const v = this.storage.getItem('autosave')
        return v ? JSON.parse(v) : null
    }

    saveSnapshot(code) {
        const v = this.storage.getItem('snapshots')
        const snaps = v ? JSON.parse(v) : []
        snaps.push({ ts: Date.now(), code })
        this.storage.setItem('snapshots', JSON.stringify(snaps))
    }

    listSnapshots() {
        const v = this.storage.getItem('snapshots')
        return v ? JSON.parse(v) : []
    }

    deleteSnapshots(idxs) {
        const v = this.storage.getItem('snapshots')
        const snaps = v ? JSON.parse(v) : []
        idxs.sort((a, b) => b - a).forEach(i => { if (i >= 0 && i < snaps.length) snaps.splice(i, 1) })
        this.storage.setItem('snapshots', JSON.stringify(snaps))
    }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { StorageAdapter, InMemoryStorage }

export { StorageAdapter, InMemoryStorage }
