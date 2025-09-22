// Configuration loading and management
import { $, renderMarkdown } from './utils.js'
import { clearTerminal } from './terminal.js'
import { debug as logDebug, info as logInfo, warn as logWarn, error as logError } from './logger.js'
import { isTestEnvironment } from './unified-storage.js'

// Use relative path so the app works from any directory
export const configUrl = './config/sample.json'

let __module_config = null

// Optional discovery list (a JSON file listing available config filenames)
export const configIndexUrl = './config/index.json'

export function createConfigManager(opts = {}) {
    const fetchFn = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined)
    const documentRef = opts.document || (typeof document !== 'undefined' ? document : undefined)
    const storage = opts.storage || (typeof localStorage !== 'undefined' ? localStorage : undefined)
    const appendTerminal = opts.appendTerminal || ((msg) => { try { if (typeof console !== 'undefined') console.log(msg) } catch (_) { } })

    let config = null

    async function fetchAvailableServerConfigs() {
        try {
            const res = await fetchFn(configIndexUrl)
            if (!res.ok) throw new Error('Not found')
            const body = await res.json()
            // New format: expect an object { listName?: string, files: [...] }
            if (body && typeof body === 'object' && Array.isArray(body.files)) {
                try { if (typeof window !== 'undefined') window.__ssg_remote_config_list = window.__ssg_remote_config_list || { url: configIndexUrl, items: body.files, listName: body.listName || null } } catch (_e) { }
                return body.files
            }
            return []
        } catch (e) {
            try {
                const res = await fetchFn('./config/sample.json')
                if (!res.ok) throw e
                return ['sample.json']
            } catch (_e) { return [] }
        }
    }

    async function loadConfigFromStringOrUrl(input) {
        if (!input) throw new Error('No input')
        const trimmed = String(input).trim()
        let urlToLoad = trimmed
        try {
            // If the input looks like an absolute or network URL, use it as-is.
            if (!/^https?:\/\//i.test(trimmed)) {
                // For non-URL inputs, only accept plain filenames (no path
                // separators or directory traversal). This prevents unintended
                // access outside the `config/` directory and makes the
                // parameter user-friendly (e.g. `?config=printing-press.json`).
                if (/[\\/]/.test(trimmed) || trimmed.includes('..') || trimmed.startsWith('.')) {
                    throw new Error('Invalid config name; provide a filename (no path) or a full URL')
                }
                urlToLoad = './config/' + encodeURIComponent(trimmed)
            }
            const res = await fetchFn(urlToLoad)
            if (!res.ok) throw new Error('Failed to fetch: ' + res.status + ' ' + res.statusText)
            let raw
            try {
                raw = await res.json()
            } catch (e) {
                throw new Error('Failed to parse JSON from ' + urlToLoad + ': ' + e.message)
            }
            const normalized = validateAndNormalizeConfigInternal(raw)
            config = normalized
            try { if (typeof window !== 'undefined') window.Config = window.Config || {}; window.Config.current = config } catch (_e) { }
            try { await saveCurrentConfig(config) } catch (_e) { }
            try { if (typeof clearTerminal === 'function') clearTerminal() } catch (_e) { }
            return normalized
        } catch (e) {
            if (e instanceof TypeError && /failed to fetch/i.test(String(e.message))) {
                throw new Error('Network error when fetching ' + urlToLoad + '. This may be a CORS or network issue. Original: ' + e.message)
            }
            throw e
        }
    }

    async function loadConfigFromFile(file) {
        if (!file) throw new Error('No file')
        const text = await file.text()
        const raw = JSON.parse(text)
        const normalized = validateAndNormalizeConfigInternal(raw)
        config = normalized
        try { if (typeof window !== 'undefined') window.Config = window.Config || {}; window.Config.current = config } catch (_e) { }
        try { await saveCurrentConfig(config) } catch (_e) { }
        try { if (typeof clearTerminal === 'function') clearTerminal() } catch (_e) { }
        return normalized
    }

    async function loadConfig() {
        if (config) {
            logDebug('loadConfig: returning cached config:', config.id, config.version)
            return config
        }

        try {
            logDebug('loadConfig: fetching from', configUrl)
            const res = await fetchFn(configUrl)
            logDebug('loadConfig: fetch response status:', res.status)
            const rawConfig = await res.json()
            logDebug('loadConfig: loaded raw config:', rawConfig.id, rawConfig.version)

            config = validateAndNormalizeConfigInternal(rawConfig)
            logInfo('loadConfig: validated config:', config.id, config.version)
            try { await saveCurrentConfig(config) } catch (_e) { }
            try { if (typeof clearTerminal === 'function') clearTerminal() } catch (_e) { }
            return config
        } catch (e) {
            logError('Failed to load configuration from', configUrl, ':', e)
            config = getDefaultConfig()
            logWarn('loadConfig: using fallback config:', config.id, config.version)
            return config
        }
    }

    async function resetToLoadedConfig() {
        config = null
        // Prefer the saved "current_config" from unified storage so Reset
        // returns to whatever config the user most recently loaded. Fall back
        // to fetching the app default via loadConfig() if none exists.
        let cfg = null
        try {
            cfg = await loadCurrentConfig()
        } catch (_e) { cfg = null }
        if (!cfg) {
            cfg = await loadConfig()
        }
        try {
            initializeInstructions(cfg)
        } catch (_e) { }
        try { if (typeof window !== 'undefined') window.Config = window.Config || {}; window.Config.current = cfg } catch (_e) { }
        try { await saveCurrentConfig(cfg) } catch (_e) { }
        try { if (typeof clearTerminal === 'function') clearTerminal() } catch (_e) { }
        return cfg
    }

    function getConfig() {
        return config || getDefaultConfig()
    }

    function getConfigIdentity() {
        const cfg = getConfig()
        return `${cfg.id || 'unknown'}@${cfg.version || '1.0'}`
    }

    function getConfigKey() {
        const identity = getConfigIdentity()
        return `snapshots_${identity}`
    }

    function setCurrentConfig(newCfg) {
        config = newCfg
        try { if (typeof window !== 'undefined') window.Config = window.Config || {}; window.Config.current = config } catch (_e) { }

        // Notify tab system of config change for read-only indicators
        try {
            if (typeof window !== 'undefined' && window.TabManager && typeof window.TabManager.updateConfig === 'function') {
                window.TabManager.updateConfig(config)
            }
        } catch (_e) { }
    }

    function validateAndNormalizeConfig(rawConfig) {
        return validateAndNormalizeConfigInternal(rawConfig)
    }

    return {
        fetchAvailableServerConfigs,
        loadConfigFromStringOrUrl,
        loadConfigFromFile,
        loadConfig,
        resetToLoadedConfig,
        getConfig,
        getConfigIdentity,
        getConfigKey,
        setCurrentConfig,
        validateAndNormalizeConfig
    }
}

// Helper to convert legacy feedback object format to modern array format
function convertLegacyFeedbackToArray(legacyFeedback) {
    const arr = []

    // Convert regex entries
    const regex = Array.isArray(legacyFeedback.regex) ? legacyFeedback.regex : []
    for (let i = 0; i < regex.length; i++) {
        const item = regex[i]
        arr.push({
            id: item.id || ('legacy-regex-' + i),
            title: item.title || ('legacy ' + i),
            when: item.when || ['edit'],
            pattern: {
                type: 'regex',
                target: (item.target === 'output' ? 'stdout' : (item.target || 'code')),
                expression: item.pattern || item.expression || ''
            },
            message: item.message || '',
            severity: item.severity || 'info',
            visibleByDefault: typeof item.visibleByDefault === 'boolean' ? item.visibleByDefault : true
        })
    }

    // Convert AST entries
    const ast = Array.isArray(legacyFeedback.ast) ? legacyFeedback.ast : []
    for (let i = 0; i < ast.length; i++) {
        const item = ast[i]
        arr.push({
            id: item.id || ('legacy-ast-' + i),
            title: item.title || ('legacy-ast ' + i),
            when: item.when || ['edit'],
            pattern: {
                type: 'ast',
                target: (item.target || 'code'),
                expression: item.rule || item.expression || item.pattern || '',
                matcher: item.matcher || ''
            },
            message: item.message || '',
            severity: item.severity || 'info',
            visibleByDefault: typeof item.visibleByDefault === 'boolean' ? item.visibleByDefault : true
        })
    }

    return arr
}

// Shared validation helper used by both the factory and legacy top-level API
function validateAndNormalizeConfigInternal(rawConfig) {
    // Parse feedback and tests if they are JSON strings (from author storage)
    let parsedFeedback = rawConfig.feedback
    let parsedTests = rawConfig.tests

    try {
        if (typeof rawConfig.feedback === 'string' && rawConfig.feedback.trim()) {
            parsedFeedback = JSON.parse(rawConfig.feedback)
        }
    } catch (e) {
        console.warn('Failed to parse feedback JSON string, using as-is:', e)
        parsedFeedback = rawConfig.feedback
    }

    try {
        if (typeof rawConfig.tests === 'string' && rawConfig.tests.trim()) {
            parsedTests = JSON.parse(rawConfig.tests)
        }
    } catch (e) {
        console.warn('Failed to parse tests JSON string, using as-is:', e)
        parsedTests = rawConfig.tests
    }

    // Ensure required fields exist
    const normalized = {
        id: rawConfig.id || 'default',
        version: rawConfig.version || '1.0',
        title: rawConfig.title || 'Python Playground',
        description: rawConfig.description || 'A Python programming environment',
        starter: rawConfig.starter || '# Write your Python code here\nprint("Hello, World!")',
        instructions: rawConfig.instructions || 'Write Python code and click Run to execute it.',
        links: Array.isArray(rawConfig.links) ? rawConfig.links : [],
        runtime: {
            type: rawConfig.runtime?.type || 'micropython',
            url: rawConfig.runtime?.url || './vendor/micropython.mjs'
        },
        execution: {
            timeoutSeconds: Math.max(5, Math.min(300, rawConfig.execution?.timeoutSeconds || 30)),
            maxOutputLines: Math.max(100, Math.min(10000, rawConfig.execution?.maxOutputLines || 1000))
        },
        feedback: Array.isArray(parsedFeedback)
            ? parsedFeedback
            : (parsedFeedback && typeof parsedFeedback === 'object' && (parsedFeedback.ast || parsedFeedback.regex))
                ? convertLegacyFeedbackToArray(parsedFeedback)
                : [],
        tests: Array.isArray(parsedTests)
            ? parsedTests
            : (parsedTests && (parsedTests.groups || parsedTests.ungrouped))
                ? parsedTests
                : [],
        files: (rawConfig && typeof rawConfig.files === 'object') ? rawConfig.files : undefined,
        fileReadOnlyStatus: (rawConfig && typeof rawConfig.fileReadOnlyStatus === 'object') ? rawConfig.fileReadOnlyStatus : {}
    }

    if (!normalized.runtime.url || typeof normalized.runtime.url !== 'string') {
        throw new Error('Configuration must specify a valid runtime URL')
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(normalized.id)) {
        throw new Error('Configuration ID must contain only alphanumeric characters, hyphens, and underscores')
    }

    return normalized
}

function getDefaultConfig() {
    return {
        id: 'fallback',
        version: '1.0',
        title: 'Fallback Configuration',
        description: 'Default configuration used when primary config fails to load',
        starter: '# Write your Python code here\nprint("Hello, World!")',
        instructions: 'Configuration failed to load. Using fallback settings.',
        links: [],
        runtime: {
            type: 'micropython',
            url: './vendor/micropython.wasm'
        },
        execution: {
            timeoutSeconds: 30,
            maxOutputLines: 1000
        },
        feedback: {
            ast: [],
            regex: []
        }
    }
}

export function initializeInstructions(cfg) {
    const instructionsContent = $('instructions-content')
    if (instructionsContent) {
        const raw = cfg?.instructions || 'No instructions provided.'
        try {
            instructionsContent.innerHTML = renderMarkdown(raw)
            // If highlight.js is available, highlight all code blocks inside the instructions.
            try {
                if (typeof window !== 'undefined' && window.hljs && typeof window.hljs.highlightElement === 'function') {
                    const nodes = instructionsContent.querySelectorAll('pre code')
                    nodes.forEach(n => {
                        try { window.hljs.highlightElement(n) } catch (_e) { }
                    })
                }
                else if (typeof window !== 'undefined' && !window.hljs) {
                    // Try to dynamically load highlight.js if it's not already present.
                    try {
                        const script = document.createElement('script')
                        script.src = './vendor/highlight.min.js'
                        script.async = true
                        script.onload = () => {
                            try {
                                const nodes = instructionsContent.querySelectorAll('pre code')
                                nodes.forEach(n => {
                                    try { window.hljs.highlightElement(n) } catch (_e) { }
                                })
                            } catch (_e) { }
                        }
                        script.onerror = () => { /* ignore load errors */ }
                        document.head.appendChild(script)
                    } catch (_e) { }
                }
            } catch (_e) { }
        } catch (_e) {
            // Fallback to plain text if rendering fails for any reason
            instructionsContent.textContent = raw
        }
    }

    // Update configuration display in header
    const configInfo = document.querySelector('.config-info')
    const configTitleLine = document.querySelector('.config-title-line')
    const configTitle = $('#config-title')
    const configVersion = $('#config-version')
    const appTitle = document.getElementById('app-title')

    // Set the main display line for tests
    if (configTitleLine) {
        const identity = getConfigIdentity()
        const title = cfg?.title || 'Python Playground'
        // If a remote config list was loaded, prefer showing its listName
        const listName = (typeof window !== 'undefined' && window.__ssg_remote_config_list && window.__ssg_remote_config_list.listName) ? window.__ssg_remote_config_list.listName : null
        const mainTitle = listName || title
        configTitleLine.textContent = `${mainTitle} (${identity})`
        // Note: header interactivity (dropdown/author button) is handled by app.js
    }

    // Also set individual components for backwards compatibility
    if (configTitle) {
        configTitle.textContent = cfg?.title || 'Python Playground'
    }

    if (configVersion) {
        configVersion.textContent = cfg?.description ? `v${cfg.version} - ${cfg.description}` : `v${cfg.version}`
    }

    // Also update the page title if available
    try {
        // Default behavior: set document.title to the config's title when present
        if (cfg?.title) {
            document.title = cfg.title
        }

        // If we have a remote config list with a listName provided, show the
        // list name AND the individual config title so users can see both
        // the collection and the problem they're working on. For example:
        // "Authoring Demos — printing-press". If either side is missing,
        // fall back to whichever is available.
        try {
            if (typeof window !== 'undefined' && window.__ssg_remote_config_list && window.__ssg_remote_config_list.listName) {
                const ln = String(window.__ssg_remote_config_list.listName || '')
                const cfgTitle = String(cfg?.title || '')
                const combined = ln && cfgTitle ? (ln + ' — ' + cfgTitle) : (ln || cfgTitle || document.title || 'Client-side Python Playground')
                try { if (appTitle) appTitle.textContent = combined } catch (_e) { }
                try { document.title = combined } catch (_e) { }
            } else {
                try { if (appTitle) appTitle.textContent = cfg?.title || document.title || 'Client-side Python Playground' } catch (_e) { }
            }
        } catch (_e) { }
    } catch (_e) { }
}

// Current config persistence functions using unified storage
export async function saveCurrentConfig(cfg) {
    try {
        const { saveConfig } = await import('./unified-storage.js')
        await saveConfig(cfg)
        logDebug('Config saved via unified storage:', cfg.id, cfg.version)
    } catch (e) {
        logWarn('Failed to save current config to unified storage:', e)
        // In production we do not write to localStorage. Tests may enable a
        // synchronous localStorage shim by setting window.__SSG_ALLOW_LOCALSTORAGE
        try {
            if (isTestEnvironment() && typeof localStorage !== 'undefined') {
                localStorage.setItem('current_config', JSON.stringify(cfg))
                logDebug('Config saved to localStorage (test env)')
            }
        } catch (_e) { }
    }
}

export async function loadCurrentConfig() {
    try {
        const { loadConfig } = await import('./unified-storage.js')
        const config = await loadConfig()
        if (config) {
            logDebug('Config loaded from unified storage:', config.id, config.version)
            try {
                const validated = validateAndNormalizeConfigInternal(config)
                logDebug('Validated current config:', validated.id, validated.version)
                return validated
            } catch (validationError) {
                logError('Validation error for stored config:', validationError)
                return null
            }
        }
    } catch (e) {
        logWarn('Failed to load current config from unified storage:', e)
        // In production we do not consult localStorage. Allow reading in tests only.
        try {
            if (isTestEnvironment() && typeof localStorage !== 'undefined') {
                const stored = localStorage.getItem('current_config')
                if (stored) {
                    const parsed = JSON.parse(stored)
                    const validated = validateAndNormalizeConfigInternal(parsed)
                    logDebug('Config loaded from localStorage (test env):', validated.id, validated.version)
                    return validated
                }
            }
        } catch (_e) { }
    }
    return null
}

export async function clearCurrentConfig() {
    try {
        const { clearConfig } = await import('./unified-storage.js')
        await clearConfig()
        logDebug('Config cleared from unified storage')
    } catch (e) {
        logWarn('Failed to clear current config from unified storage:', e)
        // Allow clearing localStorage in test environment only
        try {
            if (isTestEnvironment() && typeof localStorage !== 'undefined') {
                localStorage.removeItem('current_config')
                logDebug('Config cleared from localStorage (test env)')
            }
        } catch (_e) { }
    }
}

// Debug function to inspect current config state
export function debugCurrentConfig() {
    logDebug('=== Current Config Debug ===')
    try {
        // Only inspect localStorage in test environments
        try {
            if (isTestEnvironment() && typeof localStorage !== 'undefined') {
                const stored = localStorage.getItem('current_config')
                logDebug('Stored config exists (test env):', !!stored)
                if (stored) {
                    logDebug('Stored config length:', stored.length)
                    logDebug('Stored config preview:', stored.substring(0, 200) + '...')
                    try {
                        const parsed = JSON.parse(stored)
                        logDebug('Parsed config keys:', Object.keys(parsed))
                        logDebug('Config ID:', parsed.id)
                        logDebug('Config version:', parsed.version)
                    } catch (e) {
                        logError('Parse error:', e)
                    }
                }
            }
        } catch (_e) { }
        logDebug('In-memory config:', getConfig()?.id, getConfig()?.version)
    } catch (e) {
        logError('Debug error:', e)
    }
    logDebug('=== End Debug ===')
}

// Version compatibility check for snapshot restoration
export function isConfigCompatibleWithSnapshot(configVersion, snapshotConfigVersion) {
    try {
        const configMajor = parseInt(configVersion?.split('.')[0] || '1')
        const snapshotMajor = parseInt(snapshotConfigVersion?.split('.')[0] || '1')
        return configMajor === snapshotMajor
    } catch (e) {
        return false
    }
}

// Default manager bound to real globals for backwards compatibility
const _defaultConfigManager = createConfigManager({ fetch: (typeof fetch !== 'undefined') ? fetch.bind(globalThis) : undefined, document: (typeof document !== 'undefined') ? document : undefined, storage: (typeof localStorage !== 'undefined') ? localStorage : undefined })

export const fetchAvailableServerConfigs = (...args) => _defaultConfigManager.fetchAvailableServerConfigs(...args)
export const loadConfigFromStringOrUrl = (...args) => _defaultConfigManager.loadConfigFromStringOrUrl(...args)
export const loadConfigFromFile = (...args) => _defaultConfigManager.loadConfigFromFile(...args)
export const loadConfig = (...args) => _defaultConfigManager.loadConfig(...args)
export const resetToLoadedConfig = (...args) => _defaultConfigManager.resetToLoadedConfig(...args)
export const getConfig = (...args) => _defaultConfigManager.getConfig(...args)
export const getConfigIdentity = (...args) => _defaultConfigManager.getConfigIdentity(...args)
export const getConfigKey = (...args) => _defaultConfigManager.getConfigKey(...args)
export const setCurrentConfig = (...args) => _defaultConfigManager.setCurrentConfig(...args)
export const validateAndNormalizeConfig = (...args) => _defaultConfigManager.validateAndNormalizeConfig(...args)

export default { loadConfig, getConfig, getConfigIdentity, resetToLoadedConfig, validateAndNormalizeConfig, saveCurrentConfig, loadCurrentConfig, clearCurrentConfig, isConfigCompatibleWithSnapshot, debugCurrentConfig }
