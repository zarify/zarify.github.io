// Test for read-only file creation bug using the real VFS system
import { initializeVFS, setSystemWriteMode } from '../vfs-client.js';

describe('VFS Read-Only File Creation Bug', () => {
    beforeEach(() => {
        // Clean up global state
        delete window.currentConfig;
        delete window.FileManager;
        delete window.__ssg_vfs_backend;
        delete window.__ssg_mem;
        delete window.mem;
        setSystemWriteMode(false);
    });

    test('should create read-only files from config during VFS initialization', async () => {
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

        // Initialize VFS like the main app does
        const { FileManager, mem } = await initializeVFS(cfg);

        console.log('Initial VFS state - mem keys:', Object.keys(mem));
        console.log('Initial VFS state - FileManager files:', FileManager.list());

        // Now populate files from config (mimicking what app.js does)
        setSystemWriteMode(true);

        try {
            for (const [p, content] of Object.entries(cfg.files)) {
                console.log('Writing file:', p, 'content length:', String(content || '').length);
                await FileManager.write(p, String(content || ''));
            }
        } finally {
            setSystemWriteMode(false);
        }

        // Check final state
        console.log('Final mem keys:', Object.keys(mem));
        console.log('Final FileManager files:', FileManager.list());

        // Verify all files exist
        const files = FileManager.list();
        expect(files).toContain('/main.py');
        expect(files).toContain('/read-only.txt');
        expect(files).toContain('/read-write.txt');

        // Verify file contents
        expect(FileManager.read('/main.py')).toBe('"Hello!"\n');
        expect(FileManager.read('/read-only.txt')).toBe('This is a read-only file.');
        expect(FileManager.read('/read-write.txt')).toBe('we can nuke this');

        // Test read-only protection works after creation
        await FileManager.write('/read-only.txt', 'modified');
        // Should still have original content due to read-only protection
        expect(FileManager.read('/read-only.txt')).toBe('This is a read-only file.');

        // Test writable file can be modified  
        await FileManager.write('/read-write.txt', 'modified');
        expect(FileManager.read('/read-write.txt')).toBe('modified');
    });
});
