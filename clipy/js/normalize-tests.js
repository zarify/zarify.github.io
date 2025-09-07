// Shared normalization utilities for test configurations.
// Ensures deterministic, canonical output for hashing and comparisons.
import { debug as logDebug } from './logger.js'

function cleanTestObject(t) {
    if (!t || typeof t !== 'object') return {}
    const clean = {}
    // Only include fields that affect verification hashing
    clean.id = t.id || ''
    clean.description = t.description || ''
    clean.stdin = t.stdin || ''
    clean.expected_stdout = (t.expected_stdout === undefined || t.expected_stdout === null) ? '' : t.expected_stdout
    clean.expected_stderr = (t.expected_stderr === undefined || t.expected_stderr === null) ? '' : t.expected_stderr
    clean.timeoutMs = t.timeoutMs || 5000
    clean.ast = t.ast || null
    return clean
}

function sortObjectKeys(obj) {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj
    const keys = Object.keys(obj).sort()
    const out = {}
    for (const k of keys) {
        out[k] = sortDeep(obj[k])
    }
    return out
}

function sortDeep(value) {
    if (Array.isArray(value)) {
        // For arrays of objects that have ids, sort by id for determinism
        if (value.length > 0 && value.every(v => v && typeof v === 'object' && 'id' in v)) {
            const copy = value.slice().map(v => sortDeep(v))
            copy.sort((a, b) => String(a.id).localeCompare(String(b.id)))
            return copy
        }
        return value.map(sortDeep)
    }
    if (value && typeof value === 'object') return sortObjectKeys(value)
    return value
}

/**
 * Normalize tests into a canonical shape suitable for hashing.
 * Accepts `testConfig` which may contain `tests` as an array or an object with `groups`.
 * Returns a canonical object (either an array or {groups, ungrouped}).
 */
export function normalizeTestsForHash(testConfig) {
    if (!testConfig || !testConfig.tests) return []

    try {
        let rawTests = testConfig.tests
        // If tests is a JSON string, try parse
        if (typeof rawTests === 'string' && rawTests.trim()) {
            try {
                rawTests = JSON.parse(rawTests)
            } catch (e) {
                logDebug('normalizeTestsForHash: failed to parse tests JSON', e)
                // leave rawTests as string -> return empty
                return []
            }
        }

        if (Array.isArray(rawTests)) {
            const cleaned = rawTests.map(cleanTestObject)
            // Sort tests by id for determinism
            cleaned.sort((a, b) => String(a.id).localeCompare(String(b.id)))
            return cleaned
        }

        // Grouped format
        if (rawTests && (rawTests.groups || rawTests.ungrouped)) {
            const groups = (rawTests.groups || []).map(g => ({
                id: g.id || '',
                name: g.name || '',
                tests: (g.tests || []).map(cleanTestObject)
            }))
            // Sort groups by id then name for determinism
            groups.sort((a, b) => (String(a.id) || a.name).localeCompare(String(b.id) || b.name))
            for (const g of groups) {
                g.tests.sort((a, b) => String(a.id).localeCompare(String(b.id)))
            }

            const ungrouped = (rawTests.ungrouped || []).map(cleanTestObject)
            ungrouped.sort((a, b) => String(a.id).localeCompare(String(b.id)))

            return { groups, ungrouped }
        }

    } catch (e) {
        logDebug('normalizeTestsForHash: normalization failed', e)
    }

    return []
}

/**
 * Produce a canonical JSON string for hashing by sorting object keys recursively.
 */
export function canonicalizeForHash(obj) {
    try {
        const sorted = sortDeep(obj)
        return JSON.stringify(sorted)
    } catch (e) {
        logDebug('canonicalizeForHash failed:', e)
        return JSON.stringify(obj)
    }
}
