// Configuration loading and management
import { $, renderMarkdown } from './utils.js'
import { debug as logDebug, info as logInfo, warn as logWarn, error as logError } from './logger.js'

// Use relative path so the app works from any directory
export const configUrl = './config/sample.json'

let config = null

// Optional discovery list (a JSON file listing available config filenames)
export const configIndexUrl = './config/index.json'

// Fetch list of available config files from server (index.json expected)
export async function fetchAvailableServerConfigs() {
    try {
        const res = await fetch(configIndexUrl)
        if (!res.ok) throw new Error('Not found')
        const list = await res.json()
        if (!Array.isArray(list)) return []
        return list
    } catch (e) {
        // Fallback: attempt to read a hard-coded sample.json only
        try {
            const res = await fetch('./config/sample.json')
            if (!res.ok) throw e
            return ['sample.json']
        } catch (_e) { return [] }
    }
}

// Load a config by a user-supplied URL or filename. If `input` looks like a full URL,
// fetch it directly; otherwise treat it as a filename under /config/.
export async function loadConfigFromStringOrUrl(input) {
    if (!input) throw new Error('No input')
    const trimmed = String(input).trim()
    let urlToLoad = trimmed
    try {
        // If it appears to be a plain filename without protocol, load from ./config/
        if (!/^https?:\/\//i.test(trimmed)) {
            urlToLoad = './config/' + encodeURIComponent(trimmed)
        }
        const res = await fetch(urlToLoad)
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
        return normalized
    } catch (e) {
        // Enhance common cross-origin/fetch errors with a hint
        if (e instanceof TypeError && /failed to fetch/i.test(String(e.message))) {
            throw new Error('Network error when fetching ' + urlToLoad + '. This may be a CORS or network issue. Original: ' + e.message)
        }
        throw e
    }
}

// Load a config from a File object (FileList[0] from an <input type=file>)
export async function loadConfigFromFile(file) {
    if (!file) throw new Error('No file')
    const text = await file.text()
    const raw = JSON.parse(text)
    const normalized = validateAndNormalizeConfigInternal(raw)
    config = normalized
    try { if (typeof window !== 'undefined') window.Config = window.Config || {}; window.Config.current = config } catch (_e) { }
    return normalized
}

export async function loadConfig() {
    if (config) {
        logDebug('loadConfig: returning cached config:', config.id, config.version)
        return config
    }

    try {
        logDebug('loadConfig: fetching from', configUrl)
        const res = await fetch(configUrl)
        logDebug('loadConfig: fetch response status:', res.status)
        const rawConfig = await res.json()
        logDebug('loadConfig: loaded raw config:', rawConfig.id, rawConfig.version)

        // Validate and normalize configuration
        config = validateAndNormalizeConfigInternal(rawConfig)
        logInfo('loadConfig: validated config:', config.id, config.version)

        return config
    } catch (e) {
        logError('Failed to load configuration from', configUrl, ':', e)
        config = getDefaultConfig()
        logWarn('loadConfig: using fallback config:', config.id, config.version)
        return config
    }
}

// Reload the configuration from the remote `configUrl` and reinitialize UI.
export async function resetToLoadedConfig() {
    // Force a reload by clearing cached config and invoking loadConfig
    config = null
    const cfg = await loadConfig()
    try {
        // Reinitialize instructions/UI display
        initializeInstructions(cfg)
    } catch (_e) { }
    try { if (typeof window !== 'undefined') window.Config = window.Config || {}; window.Config.current = cfg } catch (_e) { }
    return cfg
}

export function getConfig() {
    return config || getDefaultConfig()
}

export function getConfigIdentity() {
    const cfg = getConfig()
    return `${cfg.id || 'unknown'}@${cfg.version || '1.0'}`
}

export function getConfigKey() {
    const identity = getConfigIdentity()
    return `snapshots_${identity}`
}

// Allow other modules to explicitly set the current in-memory config so
// module-scoped helpers (getConfigIdentity / getConfigKey) reflect the
// active configuration. This is used when the app applies a config that
// wasn't loaded via the normal loadConfig* helpers (for example when an
// authoring config is pushed into localStorage and applied at runtime).
export function setCurrentConfig(newCfg) {
    config = newCfg
    try { if (typeof window !== 'undefined') window.Config = window.Config || {}; window.Config.current = config } catch (_e) { }
}

export function validateAndNormalizeConfig(rawConfig) {
    return validateAndNormalizeConfigInternal(rawConfig)
}

function validateAndNormalizeConfigInternal(rawConfig) {
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
            // Prefer the module loader (.mjs) as the canonical runtime URL for imports.
            // The module will locate and load the .wasm binary itself.
            url: rawConfig.runtime?.url || './vendor/micropython.mjs'
        },
        execution: {
            timeoutSeconds: Math.max(5, Math.min(300, rawConfig.execution?.timeoutSeconds || 30)),
            maxOutputLines: Math.max(100, Math.min(10000, rawConfig.execution?.maxOutputLines || 1000))
        },
        // Support two feedback shapes:
        // - legacy: { ast: [], regex: [] }
        // - new: feedback: [ { id, title, when, pattern: { type, target, expression }, ... } ]
        feedback: Array.isArray(rawConfig.feedback)
            ? rawConfig.feedback
            : {
                ast: Array.isArray(rawConfig.feedback?.ast) ? rawConfig.feedback.ast : [],
                regex: Array.isArray(rawConfig.feedback?.regex) ? rawConfig.feedback.regex : []
            }
        ,
        // Include author-provided tests (support both legacy array and new grouped format)
        tests: Array.isArray(rawConfig.tests)
            ? rawConfig.tests  // Legacy format: array of tests
            : (rawConfig.tests && (rawConfig.tests.groups || rawConfig.tests.ungrouped))
                ? rawConfig.tests  // New grouped format: {groups: [...], ungrouped: [...]}
                : []  // Default: empty array
        ,
        // Preserve any files object provided by the authoring config so callers
        // (like applyConfigToWorkspace) can write them into the FileManager.
        files: (rawConfig && typeof rawConfig.files === 'object') ? rawConfig.files : undefined
    }

    // Validate runtime URL is not empty
    if (!normalized.runtime.url || typeof normalized.runtime.url !== 'string') {
        throw new Error('Configuration must specify a valid runtime URL')
    }

    // Validate ID format (alphanumeric, hyphens, underscores only)
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
                        script.src = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.8.0/build/highlight.min.js'
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

    // Set the main display line for tests
    if (configTitleLine) {
        const identity = getConfigIdentity()
        const title = cfg?.title || 'Python Playground'
        configTitleLine.textContent = `${title} (${identity})`
        // Make the header config display discoverable and interactive
        try {
            configTitleLine.setAttribute('role', 'button')
            configTitleLine.setAttribute('tabindex', '0')
            configTitleLine.setAttribute('title', 'Click to open configuration')
        } catch (_e) { }
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
        if (cfg?.title) {
            document.title = cfg.title
        }
    } catch (_e) { }
}

// Current config persistence functions
const CURRENT_CONFIG_KEY = 'current_config'

export function saveCurrentConfig(cfg) {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(CURRENT_CONFIG_KEY, JSON.stringify(cfg))
        }
    } catch (e) {
        logWarn('Failed to save current config to localStorage:', e)
    }
}

export function loadCurrentConfig() {
    try {
        if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem(CURRENT_CONFIG_KEY)
            logDebug('Raw stored config:', stored ? 'exists' : 'null')
            if (stored) {
                let parsed
                try {
                    parsed = JSON.parse(stored)
                    logDebug('Parsed current config:', parsed.id || 'unknown', parsed.version || 'unknown')
                } catch (parseError) {
                    logError('JSON parse error for stored config:', parseError)
                    return null
                }

                try {
                    const validated = validateAndNormalizeConfigInternal(parsed)
                    logDebug('Validated current config:', validated.id, validated.version)
                    return validated
                } catch (validationError) {
                    logError('Validation error for stored config:', validationError)
                    return null
                }
            }
        }
    } catch (e) {
        logWarn('Failed to load current config from localStorage:', e)
    }
    return null
}

export function clearCurrentConfig() {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(CURRENT_CONFIG_KEY)
        }
    } catch (e) {
        logWarn('Failed to clear current config from localStorage:', e)
    }
}

// Debug function to inspect current config state
export function debugCurrentConfig() {
    logDebug('=== Current Config Debug ===')
    try {
        if (typeof localStorage !== 'undefined') {
            const stored = localStorage.getItem(CURRENT_CONFIG_KEY)
            logDebug('Stored config exists:', !!stored)
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

export default { loadConfig, getConfig, getConfigIdentity, resetToLoadedConfig, validateAndNormalizeConfig, saveCurrentConfig, loadCurrentConfig, clearCurrentConfig, isConfigCompatibleWithSnapshot, debugCurrentConfig }
