test('normalizeIndentation converts tabs and preserves text', async () => {
    const mod = await import('../utils.js')
    const { normalizeIndentation } = mod
    const input = '\tdef f():\n\t\treturn 1'
    const out = normalizeIndentation(input)
    expect(out.split('\n')[0].startsWith('    ')).toBe(true)
})

test('transformWalrusPatterns handles input() walrus', async () => {
    const mod = await import('../utils.js')
    const { transformWalrusPatterns } = mod
    const code = 'if x := input("p"):\n    pass'
    const out = transformWalrusPatterns(code)
    expect(out.includes('x = input("p")')).toBe(true)
    expect(out.includes('if x:')).toBe(true)
})

test('renderMarkdown basic', async () => {
    const mod = await import('../utils.js')
    const { renderMarkdown } = mod
    const md = '**bold** and `code`'
    const html = renderMarkdown(md)
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<code>code</code>')
})
