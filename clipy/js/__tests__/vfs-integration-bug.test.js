// Integration test for the full flow: config → VFS → runtime FS
import { initializeVFS, setSystemWriteMode } from '../vfs-client.js';

describe('VFS Config Loading Integration Bug', () => {
    beforeEach(() => {
        // Clean up global state
        delete window.currentConfig;
        delete window.FileManager;
        delete window.__ssg_vfs_backend;
        delete window.__ssg_mem;
        delete window.mem;
        setSystemWriteMode(false);
    });

    test('should make config files visible to runtime FS after full sync process', async () => {
        // Set up the exact config from the user's issue
        const cfg = {
            "id": "test-read-write",
            "title": "Read-only testing",
            "version": "1.0",
            "description": "A demo script for authoring.",
            "starter": "\"Hello!\"\n",
            "files": {
                "/main.py": "\"Hello!\"\n",
                "read-only.txt": "This is a read-only file.",
                "read-write.txt": "we can nuke this"
            },
            "fileReadOnlyStatus": {
                "read-only.txt": true
            }
        };

        // Make config available globally (needed for read-only checks)
        window.currentConfig = cfg;

        // Step 1: Initialize VFS like the main app does
        console.log('=== STEP 1: Initialize VFS ===');
        const { FileManager, backend } = await initializeVFS(cfg);

        console.log('After initializeVFS:');
        console.log('  - FileManager files:', FileManager.list());
        console.log('  - Backend files:', await backend.list());

        // Step 2: Populate files from config (mimicking what app.js does)
        console.log('=== STEP 2: Populate files from config ===');
        setSystemWriteMode(true);

        try {
            for (const [p, content] of Object.entries(cfg.files)) {
                console.log('Writing file:', p);
                await FileManager.write(p, String(content || ''));
            }
        } finally {
            setSystemWriteMode(false);
        }

        console.log('After populating from config:');
        console.log('  - FileManager files:', FileManager.list());
        console.log('  - Backend files:', await backend.list());

        // Step 3: Simulate syncVFSBeforeRun() - sync FileManager → backend
        console.log('=== STEP 3: Sync FileManager → backend ===');
        setSystemWriteMode(true);
        try {
            const files = FileManager.list();
            for (const p of files) {
                const content = FileManager.read(p);
                console.log('Syncing to backend:', p, 'content length:', (content || '').length);
                await backend.write(p, content == null ? '' : content);
            }
        } finally {
            setSystemWriteMode(false);
        }

        console.log('After sync to backend:');
        console.log('  - Backend files:', await backend.list());

        // Step 4: Simulate mounting to runtime FS (with read-only protection)
        console.log('=== STEP 4: Mount backend → runtime FS ===');

        // Create a mock runtime FS with read-only guards (simulating the real MicroPython FS)
        const mockFS = {
            files: {},
            mkdir(path) {
                console.log('FS.mkdir:', path);
            },
            writeFile(path, content) {
                // Simulate the read-only guard from micropython.js
                const isReadOnly = (() => {
                    try {
                        // System writes may temporarily enable system mode
                        if (typeof window !== 'undefined' && window.__ssg_system_write_mode) return false;
                        const cfg = window.currentConfig;
                        if (!cfg || !cfg.fileReadOnlyStatus) return false;
                        const n = String(path).startsWith('/') ? path : ('/' + String(path).replace(/^\/+/, ''));
                        const bare = n.replace(/^\/+/, '');
                        return !!(cfg.fileReadOnlyStatus[n] || cfg.fileReadOnlyStatus[bare]);
                    } catch (_e) { return false; }
                })();

                if (isReadOnly) {
                    console.log('FS.writeFile BLOCKED (read-only):', path);
                    throw new Error('Permission denied: read-only file ' + path);
                } else {
                    console.log('FS.writeFile:', path, 'content length:', (content || '').length);
                    this.files[path] = content;
                }
            },
            readdir(path) {
                const files = Object.keys(this.files);
                if (path === '/') {
                    return files.map(f => f.replace(/^\//, ''));
                }
                return [];
            },
            readFile(path, opts) {
                return this.files[path] || null;
            }
        };

        // Mount backend to mock FS WITHOUT system write mode (this should fail for read-only files)
        console.log('--- Mounting WITHOUT system write mode (should fail for read-only files) ---');
        try {
            await backend.mountToEmscripten(mockFS);
        } catch (e) {
            console.log('Mount failed as expected:', e.message);
        }

        console.log('Files after first mount attempt:', Object.keys(mockFS.files));

        // Now mount WITH system write mode (this should succeed)
        console.log('--- Mounting WITH system write mode (should succeed) ---');
        setSystemWriteMode(true);
        try {
            await backend.mountToEmscripten(mockFS);
        } finally {
            setSystemWriteMode(false);
        }

        console.log('After mounting to runtime FS:');
        console.log('  - Runtime FS files:', Object.keys(mockFS.files));

        // Verify all files made it through the entire pipeline
        expect(Object.keys(mockFS.files)).toContain('/main.py');
        expect(Object.keys(mockFS.files)).toContain('/read-only.txt');
        expect(Object.keys(mockFS.files)).toContain('/read-write.txt');

        // Verify contents
        expect(mockFS.files['/main.py']).toBe('"Hello!"\n');
        expect(mockFS.files['/read-only.txt']).toBe('This is a read-only file.');
        expect(mockFS.files['/read-write.txt']).toBe('we can nuke this');
    });
});
