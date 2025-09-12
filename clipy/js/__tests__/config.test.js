test('validateAndNormalizeConfigInternal basic normalization', async () => {
    const mod = await import('../config.js')
    const { validateAndNormalizeConfig, setCurrentConfig, getConfigIdentity, getConfigKey } = mod

    const raw = {
        id: 'my-test',
        version: '2.3',
        runtime: { url: './vendor/foo.mjs' },
        execution: { timeoutSeconds: 1000 }
    }

    const norm = validateAndNormalizeConfig(raw)
    expect(norm.id).toBe('my-test')
    expect(norm.runtime.url).toBe('./vendor/foo.mjs')
    // timeoutSeconds should be capped to 300 per implementation
    expect(norm.execution.timeoutSeconds).toBeLessThanOrEqual(300)

    // set and inspect current config identity/key
    setCurrentConfig({ id: 'fallback', version: '1.0' })
    expect(getConfigIdentity()).toContain('fallback')
    expect(getConfigKey()).toContain('snapshots_')
})


test('isConfigCompatibleWithSnapshot edge cases', async () => {
    const mod = await import('../config.js')
    const { isConfigCompatibleWithSnapshot } = mod
    expect(isConfigCompatibleWithSnapshot('2.1', '2.9')).toBe(true)
    expect(isConfigCompatibleWithSnapshot('2.0', '3.0')).toBe(false)
    expect(isConfigCompatibleWithSnapshot(null, '1.0')).toBe(true)
    expect(isConfigCompatibleWithSnapshot('abc', '1.0')).toBe(false)
})
