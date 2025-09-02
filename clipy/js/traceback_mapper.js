// Small utility to map traceback line numbers by subtracting headerLines
function mapTraceback(rawText, headerLines) {
    if (!rawText) return ''
    return rawText.replace(/File \"([^\"]+)\", line (\d+)(?:, column (\d+))?/g, (m, fname, ln, col) => {
        const mappedLn = Math.max(1, Number(ln) - headerLines)
        if (col) return `File "${fname}", line ${mappedLn}, column ${col}`
        return `File "${fname}", line ${mappedLn}`
    })
}

// CommonJS export for Node tests, and ES export for browser modules
if (typeof module !== 'undefined' && module.exports) module.exports = { mapTraceback }
export { mapTraceback }
