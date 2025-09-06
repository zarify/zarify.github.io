// Download workspace code functionality
// Allows users to download their workspace as individual files or zip archives

import { getFileManager } from './vfs-client.js'
import { getConfigIdentity } from './config.js'

function $(id) { return document.getElementById(id) }

// Create and trigger a download for a given blob and filename
function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

// Sanitize filename for download (remove invalid characters)
function sanitizeFilename(filename) {
    return filename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_')
}

// Get a safe config ID for use in filenames
function getSafeConfigId() {
    try {
        const configId = getConfigIdentity()
        if (configId && configId !== 'default') {
            return sanitizeFilename(configId)
        }
    } catch (e) {
        import('./logger.js').then(m => m.warn('Could not get config identity:', e)).catch(() => console.warn('Could not get config identity:', e))
    }
    return 'workspace'
}

// CRC-32 calculation for ZIP files
function calculateCRC32(data) {
    // CRC-32 lookup table
    const crcTable = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
        let c = i
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
        }
        crcTable[i] = c
    }

    let crc = 0xFFFFFFFF
    for (let i = 0; i < data.length; i++) {
        crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8)
    }
    return (crc ^ 0xFFFFFFFF) >>> 0 // Convert to unsigned 32-bit
}

// Better zip implementation using a simple zip format
async function createActualZipFile(files) {
    // We'll implement a basic zip file structure
    // For production use, consider using JSZip library instead

    const zipContent = []
    const centralDirectory = []
    let offset = 0

    for (const [filename, content] of files) {
        const data = new TextEncoder().encode(content)
        const filenameBytes = new TextEncoder().encode(filename)
        const crc32 = calculateCRC32(data)

        // Local file header
        const localHeader = new ArrayBuffer(30 + filenameBytes.length)
        const localView = new DataView(localHeader)

        localView.setUint32(0, 0x04034b50, true) // Local file header signature
        localView.setUint16(4, 20, true) // Version needed to extract
        localView.setUint16(6, 0, true) // General purpose bit flag
        localView.setUint16(8, 0, true) // Compression method (0 = no compression)
        localView.setUint16(10, 0, true) // Last mod file time
        localView.setUint16(12, 0, true) // Last mod file date
        localView.setUint32(14, crc32, true) // CRC-32
        localView.setUint32(18, data.length, true) // Compressed size
        localView.setUint32(22, data.length, true) // Uncompressed size
        localView.setUint16(26, filenameBytes.length, true) // File name length
        localView.setUint16(28, 0, true) // Extra field length

        // Copy filename
        new Uint8Array(localHeader, 30).set(filenameBytes)

        zipContent.push(localHeader)
        zipContent.push(data)

        // Central directory record
        const centralRecord = new ArrayBuffer(46 + filenameBytes.length)
        const centralView = new DataView(centralRecord)

        centralView.setUint32(0, 0x02014b50, true) // Central directory signature
        centralView.setUint16(4, 20, true) // Version made by
        centralView.setUint16(6, 20, true) // Version needed to extract
        centralView.setUint16(8, 0, true) // General purpose bit flag
        centralView.setUint16(10, 0, true) // Compression method
        centralView.setUint16(12, 0, true) // Last mod file time
        centralView.setUint16(14, 0, true) // Last mod file date
        centralView.setUint32(16, crc32, true) // CRC-32
        centralView.setUint32(20, data.length, true) // Compressed size
        centralView.setUint32(24, data.length, true) // Uncompressed size
        centralView.setUint16(28, filenameBytes.length, true) // File name length
        centralView.setUint16(30, 0, true) // Extra field length
        centralView.setUint16(32, 0, true) // File comment length
        centralView.setUint16(34, 0, true) // Disk number start
        centralView.setUint16(36, 0, true) // Internal file attributes
        centralView.setUint32(38, 0, true) // External file attributes
        centralView.setUint32(42, offset, true) // Relative offset of local header

        // Copy filename
        new Uint8Array(centralRecord, 46).set(filenameBytes)

        centralDirectory.push(centralRecord)
        offset += localHeader.byteLength + data.length
    }

    // Calculate central directory size
    let centralDirectorySize = 0
    for (const record of centralDirectory) {
        centralDirectorySize += record.byteLength
    }

    // End of central directory record
    const endRecord = new ArrayBuffer(22)
    const endView = new DataView(endRecord)

    endView.setUint32(0, 0x06054b50, true) // End of central directory signature
    endView.setUint16(4, 0, true) // Number of this disk
    endView.setUint16(6, 0, true) // Disk where central directory starts
    endView.setUint16(8, files.length, true) // Number of central directory records on this disk
    endView.setUint16(10, files.length, true) // Total number of central directory records
    endView.setUint32(12, centralDirectorySize, true) // Size of central directory
    endView.setUint32(16, offset, true) // Offset of start of central directory
    endView.setUint16(20, 0, true) // ZIP file comment length

    // Combine all parts
    const totalSize = offset + centralDirectorySize + endRecord.byteLength
    const zipData = new Uint8Array(totalSize)
    let pos = 0

    // Add local files
    for (let i = 0; i < zipContent.length; i += 2) {
        const header = new Uint8Array(zipContent[i])
        const data = new Uint8Array(zipContent[i + 1])
        zipData.set(header, pos)
        pos += header.length
        zipData.set(data, pos)
        pos += data.length
    }

    // Add central directory
    for (const record of centralDirectory) {
        const recordData = new Uint8Array(record)
        zipData.set(recordData, pos)
        pos += recordData.length
    }

    // Add end record
    zipData.set(new Uint8Array(endRecord), pos)

    return new Blob([zipData], { type: 'application/zip' })
}

// Main download function
async function downloadWorkspace() {
    try {
        const FileManager = getFileManager()
        if (!FileManager) {
            import('./logger.js').then(m => m.error('FileManager not available')).catch(() => console.error('FileManager not available'))
            return
        }

        const files = FileManager.list() || []
        const configId = getSafeConfigId()

        if (files.length === 0) {
            alert('No files to download')
            return
        }

        if (files.length === 1 && files[0] === '/main.py') {
            // Single main.py file - download as Python file
            const content = FileManager.read('/main.py') || ''
            const filename = `${configId}_main.py`
            const blob = new Blob([content], { type: 'text/x-python' })
            triggerDownload(blob, filename)
        } else {
            // Multiple files - create zip archive
            const fileEntries = []
            for (const filepath of files) {
                const content = FileManager.read(filepath) || ''
                // Remove leading slash for zip entry names
                const entryName = filepath.startsWith('/') ? filepath.slice(1) : filepath
                fileEntries.push([entryName, content])
            }

            const zipBlob = await createActualZipFile(fileEntries)
            const filename = `${configId}.zip`
            triggerDownload(zipBlob, filename)
        }
    } catch (error) {
        import('./logger.js').then(m => m.error('Download failed:', error)).catch(() => console.error('Download failed:', error))
        alert('Download failed: ' + error.message)
    }
}

// Setup download button handler
export function setupDownloadSystem() {
    const downloadBtn = $('download-code')

    if (downloadBtn) {
        downloadBtn.addEventListener('click', async (ev) => {
            try {
                if (downloadBtn.disabled) return
                downloadBtn.disabled = true
                await downloadWorkspace()
            } finally {
                // Re-enable after a short debounce window
                setTimeout(() => {
                    try {
                        downloadBtn.disabled = false
                    } catch (_) { }
                }, 600)
            }
        })
    }
}

export default { setupDownloadSystem }
