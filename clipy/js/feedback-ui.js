import { $, renderMarkdown, setInnerHTML } from './utils.js'
import { debug as logDebug } from './logger.js'
import { getStudentIdentifier, generateVerificationCode, shouldShowVerificationCode } from './zero-knowledge-verification.js'



let _matches = []
let _config = { feedback: [] }
let _testResults = []
let _streamBuffers = {}
// Track previously-seen matched feedback IDs so we can detect newly added matches
let _prevMatchedIds = new Set()

function renderList() {
    try {
        // Prefer new id to avoid content-blocker problems; fall back to legacy
        // id for older pages/tests.
        const host = $('fdbk-list') || $('feedback-list')
        if (!host) return
        // Clear host first, then add run-tests control at top (clear children safely)
        while (host.firstChild) host.removeChild(host.firstChild)
        const controlRow = document.createElement('div')
        controlRow.style.display = 'flex'
        controlRow.style.justifyContent = 'flex-end'
        controlRow.style.marginBottom = '6px'
        const runBtn = document.createElement('button')
        runBtn.className = 'btn'
        runBtn.id = 'run-tests-btn'
        runBtn.textContent = 'Run tests'
        // Determine whether there are author tests in the config; if not, disable the button
        let hasTests = false
        let testCount = 0

        if (_config && _config.tests) {
            if (Array.isArray(_config.tests)) {
                // Legacy format: direct array of tests
                hasTests = _config.tests.length > 0
                testCount = _config.tests.length
            } else if (_config.tests.groups || _config.tests.ungrouped) {
                // Grouped format: object with groups and ungrouped arrays
                const groupCount = (_config.tests.groups || []).reduce((sum, g) => sum + (g.tests || []).length, 0)
                const ungroupedCount = (_config.tests.ungrouped || []).length
                testCount = groupCount + ungroupedCount
                hasTests = testCount > 0
            }
        }

        if (!hasTests) {
            runBtn.disabled = true
            runBtn.title = 'No tests defined'
            runBtn.setAttribute('aria-disabled', 'true')
        } else {
            runBtn.title = `Run ${testCount} test${testCount === 1 ? '' : 's'}`
            runBtn.setAttribute('aria-disabled', 'false')
        }

        runBtn.addEventListener('click', () => {
            try {
                // Trace user interaction for debugging: ensure the custom event is dispatched
                try { logDebug('[feedback-ui] run-tests button clicked') } catch (_e) { }
                window.dispatchEvent(new CustomEvent('ssg:run-tests-click'))
            } catch (_e) { }
        })
        controlRow.appendChild(runBtn)
        host.appendChild(controlRow)

        // Build a map of matches by id for quick lookup
        const matchMap = new Map()
        for (const m of (_matches || [])) matchMap.set(m.id, m)

        // If no configured entries, show placeholder but keep run-tests control
        if (!Array.isArray(_config.feedback) || !_config.feedback.length) {
            const p = document.createElement('div')
            p.className = 'feedback-msg feedback-msg-hidden'
            host.appendChild(p)
            // continue rendering empty sections so run-tests control remains visible
        }

        // Create two sections: edit and run
        const editSection = document.createElement('div')
        editSection.className = 'feedback-section feedback-edit-section'
        const editHeader = document.createElement('h3')
        editHeader.textContent = 'Code feedback'
        editSection.appendChild(editHeader)

        const runSection = document.createElement('div')
        runSection.className = 'feedback-section feedback-run-section'
        const runHeader = document.createElement('h3')
        runHeader.textContent = 'Run-time feedback'
        runSection.appendChild(runHeader)

        // --- Test results section (if any) ---
        const testsSection = document.createElement('div')
        testsSection.className = 'feedback-section feedback-tests-section'
        const testsHeader = document.createElement('h3')
        testsHeader.textContent = 'Test results'
        testsSection.appendChild(testsHeader)

        // Filter out skipped tests: only show executed tests in the feedback UI.
        const visibleResults = Array.isArray(_testResults) ? _testResults.filter(r => !r.skipped) : []

        // Helper to find author metadata for a given test id in grouped or legacy config
        function findAuthorEntryById(id) {
            try {
                if (!_config || !_config.tests) return null
                // Legacy flat array
                if (Array.isArray(_config.tests)) {
                    return _config.tests.find(t => String(t.id) === String(id)) || null
                }
                // Grouped format
                if (_config.tests.groups && Array.isArray(_config.tests.groups)) {
                    for (const g of _config.tests.groups) {
                        if (!g.tests) continue
                        const m = g.tests.find(t => String(t.id) === String(id))
                        if (m) return m
                    }
                }
                // Ungrouped in grouped format
                if (_config.tests.ungrouped && Array.isArray(_config.tests.ungrouped)) {
                    const m = _config.tests.ungrouped.find(t => String(t.id) === String(id))
                    if (m) return m
                }
            } catch (_e) { }
            return null
        }

        // If grouped config is present, render groups and only include groups with visible results
        const isGroupedCfg = _config && _config.tests && !Array.isArray(_config.tests) && ((_config.tests.groups && _config.tests.groups.length) || (_config.tests.ungrouped && _config.tests.ungrouped.length))
        if (isGroupedCfg) {
            const groups = _config.tests.groups || []
            let anyRendered = false
            for (const g of groups) {
                // Collect visible results that belong to this group
                const groupTestIds = (Array.isArray(g.tests) ? g.tests.map(t => String(t.id)) : [])
                const visibleInGroup = visibleResults.filter(r => groupTestIds.includes(String(r.id)))
                if (!visibleInGroup.length) continue // skip group entirely

                anyRendered = true
                const grpHeader = document.createElement('div')
                grpHeader.className = 'feedback-group-header'
                const gh = document.createElement('h4')
                gh.textContent = `${g.name} (${visibleInGroup.length} test${visibleInGroup.length === 1 ? '' : 's'})`
                grpHeader.appendChild(gh)
                testsSection.appendChild(grpHeader)

                // Render tests in original group order for predictability
                for (const t of (g.tests || [])) {
                    const r = visibleInGroup.find(v => String(v.id) === String(t.id))
                    if (!r) continue

                    const tr = document.createElement('div')
                    tr.className = 'feedback-entry test-entry ' + (r.passed ? 'test-pass' : 'test-fail')
                    tr.setAttribute('data-test-id', String(r.id || ''))

                    const titleRow = document.createElement('div')
                    titleRow.className = 'feedback-title-row'
                    const icon = document.createElement('span')
                    icon.className = 'feedback-icon'
                    icon.textContent = r.passed ? '✅' : '❌'
                    titleRow.appendChild(icon)
                    const titleEl = document.createElement('div')
                    titleEl.className = 'feedback-title'
                    const authorEntry = findAuthorEntryById(r.id) || (r.meta || null)
                    const displayTitle = (authorEntry && (authorEntry.description || authorEntry.title)) ? (authorEntry.description || authorEntry.title) : ((r.description) ? r.description : (r.id || ''))
                    try {
                        setInnerHTML(titleEl, renderMarkdown(String(displayTitle || '')))
                    } catch (_e) {
                        titleEl.textContent = displayTitle
                    }
                    titleRow.appendChild(titleEl)
                    tr.appendChild(titleRow)

                    // Reuse existing detail rendering logic (actual/expected, stderr)
                    const hasExpected = authorEntry && (authorEntry.expected_stdout != null)
                    const isRegexExpected = hasExpected && (typeof authorEntry.expected_stdout === 'object' && authorEntry.expected_stdout.type === 'regex')
                    const isExactExpected = hasExpected && (typeof authorEntry.expected_stdout === 'object' && authorEntry.expected_stdout.type === 'exact')
                    const hasStderr = r.stderr && r.stderr.trim().length > 0
                    const hideActualExpected = authorEntry && authorEntry.hide_actual_expected
                    if (!r.passed && hasExpected && !isRegexExpected && !isExactExpected && !hasStderr && !hideActualExpected) {
                        const detailsWrap = document.createElement('div')
                        detailsWrap.className = 'test-compare'
                        detailsWrap.style.marginTop = '8px'
                        const actualLabel = document.createElement('div')
                        actualLabel.textContent = 'Actual:'
                        actualLabel.style.fontSize = '0.9em'
                        actualLabel.style.marginBottom = '4px'
                        detailsWrap.appendChild(actualLabel)
                        const preA = document.createElement('pre')
                        preA.style.whiteSpace = 'pre-wrap'
                        preA.style.fontFamily = 'monospace'
                        const codeA = document.createElement('code')
                        codeA.className = 'test-code'
                        codeA.setAttribute('data-nohighlight', 'true')
                        codeA.textContent = (r.stdout != null) ? String(r.stdout) : ''
                        preA.appendChild(codeA)
                        detailsWrap.appendChild(preA)
                        const expectedLabel = document.createElement('div')
                        // If the author provided a failureMessage for this test,
                        // show it beneath the compare block so authors can add
                        // a readable explanation for mismatches.
                        try {
                            if (authorEntry && authorEntry.failureMessage) {
                                const fm = document.createElement('div')
                                fm.className = 'test-failure-message'
                                fm.style.marginTop = '6px'
                                fm.style.color = '#d33'
                                try { setInnerHTML(fm, renderMarkdown(String(authorEntry.failureMessage || ''))) } catch (_e) { fm.textContent = String(authorEntry.failureMessage) }
                                detailsWrap.appendChild(fm)
                            }
                        } catch (_e) { }
                        tr.appendChild(detailsWrap)
                        expectedLabel.style.fontSize = '0.9em'
                        expectedLabel.style.margin = '8px 0 4px'
                        detailsWrap.appendChild(expectedLabel)
                        const preE = document.createElement('pre')
                        preE.style.whiteSpace = 'pre-wrap'
                        preE.style.fontFamily = 'monospace'
                        const codeE = document.createElement('code')
                        codeE.className = 'test-code'
                        codeE.setAttribute('data-nohighlight', 'true')
                        try {
                            const exp = authorEntry.expected_stdout
                            if (typeof exp === 'string') codeE.textContent = exp
                            else if (typeof exp === 'object' && exp.type === 'regex') codeE.textContent = `/${exp.expression}/${exp.flags || ''}`
                            else if (typeof exp === 'object' && exp.type === 'exact') codeE.textContent = `[exact: ${exp.expression}]`
                            else codeE.textContent = JSON.stringify(exp)
                        } catch (_e) { codeE.textContent = String(authorEntry.expected_stdout) }
                        preE.appendChild(codeE)
                        detailsWrap.appendChild(preE)
                        tr.appendChild(detailsWrap)
                    }

                    const shouldShowDetails = authorEntry ? !!(authorEntry.show_stderr || authorEntry.show_traceback) : false
                    const hasStderrToShow = r.stderr && r.stderr.trim().length > 0
                    if (!r.passed && (hasStderrToShow || (shouldShowDetails && (r.stderr || r.reason)))) {
                        const detailsWrap = document.createElement('div')
                        detailsWrap.className = 'feedback-msg'
                        if (r.reason) {
                            const reasonEl = document.createElement('div')
                            reasonEl.className = 'feedback-reason'
                            reasonEl.textContent = '[' + r.reason + ']'
                            detailsWrap.appendChild(reasonEl)
                        }
                        if (r.stderr) {
                            const stderrEl = document.createElement('div')
                            stderrEl.className = 'test-stderr'
                            stderrEl.style.whiteSpace = 'pre-wrap'
                            stderrEl.style.fontFamily = 'monospace'
                            stderrEl.textContent = r.stderr
                            detailsWrap.appendChild(stderrEl)
                        }
                        // Also include author-provided failure message where present
                        try {
                            if (authorEntry && authorEntry.failureMessage) {
                                const fm = document.createElement('div')
                                fm.className = 'test-failure-message'
                                fm.style.marginTop = '6px'
                                fm.style.color = '#d33'
                                try { setInnerHTML(fm, renderMarkdown(String(authorEntry.failureMessage || ''))) } catch (_e) { fm.textContent = String(authorEntry.failureMessage) }
                                detailsWrap.appendChild(fm)
                            }
                        } catch (_e) { }
                        tr.appendChild(detailsWrap)
                    }

                    // If this is an AST test failure and no detail blocks were
                    // rendered above, ensure the author-provided failureMessage
                    // is visible by creating a minimal test-io block.
                    try {
                        const hasDetail = tr.querySelector('.test-compare') || tr.querySelector('.feedback-msg') || tr.querySelector('.test-io')
                        if (!r.passed && authorEntry && (authorEntry.type === 'ast' || authorEntry.astRule) && authorEntry.failureMessage && !hasDetail) {
                            const astWrap = document.createElement('div')
                            astWrap.className = 'test-io'
                            astWrap.style.marginTop = '8px'
                            astWrap.style.background = '#f8f8f8'
                            astWrap.style.padding = '8px'
                            astWrap.style.borderRadius = '4px'
                            astWrap.style.fontFamily = 'monospace'

                            const fm = document.createElement('div')
                            fm.className = 'test-failure-message'
                            fm.style.marginTop = '6px'
                            fm.style.color = '#d33'
                            try { setInnerHTML(fm, renderMarkdown(String(authorEntry.failureMessage || ''))) } catch (_e) { fm.textContent = String(authorEntry.failureMessage) }
                            astWrap.appendChild(fm)
                            tr.appendChild(astWrap)
                        }
                    } catch (_e) { }

                    tr.addEventListener('click', () => {
                        try { window.dispatchEvent(new CustomEvent('ssg:test-click', { detail: r })) } catch (_e) { }
                    })

                    testsSection.appendChild(tr)
                }
            }

            // Render ungrouped visible results (if any)
            const ungroupedVisible = visibleResults.filter(r => {
                // not present in any group
                let inGroup = false
                for (const g of (groups || [])) {
                    if (g.tests && g.tests.find(t => String(t.id) === String(r.id))) { inGroup = true; break }
                }
                return !inGroup
            })
            if (ungroupedVisible.length) {
                const ugH = document.createElement('h4')
                ugH.textContent = `Ungrouped (${ungroupedVisible.length})`
                testsSection.appendChild(ugH)
                for (const r of ungroupedVisible) {
                    const tr = document.createElement('div')
                    tr.className = 'feedback-entry test-entry ' + (r.passed ? 'test-pass' : 'test-fail')
                    tr.setAttribute('data-test-id', String(r.id || ''))
                    const titleRow = document.createElement('div')
                    titleRow.className = 'feedback-title-row'
                    const icon = document.createElement('span')
                    icon.className = 'feedback-icon'
                    icon.textContent = r.passed ? '✅' : '❌'
                    titleRow.appendChild(icon)
                    const titleEl = document.createElement('div')
                    titleEl.className = 'feedback-title'
                    const authorEntry = findAuthorEntryById(r.id) || (r.meta || null)
                    const displayTitle = (authorEntry && (authorEntry.description || authorEntry.title)) ? (authorEntry.description || authorEntry.title) : ((r.description) ? r.description : (r.id || ''))
                    try {
                        setInnerHTML(titleEl, renderMarkdown(String(displayTitle || '')))
                    } catch (_e) {
                        titleEl.textContent = displayTitle
                    }
                    titleRow.appendChild(titleEl)
                    tr.appendChild(titleRow)
                    tr.addEventListener('click', () => { try { window.dispatchEvent(new CustomEvent('ssg:test-click', { detail: r })) } catch (_e) { } })
                    // If AST test failed and has a failureMessage, show it even
                    // when no stderr/compare block exists.
                    try {
                        if (!r.passed && authorEntry && (authorEntry.type === 'ast' || authorEntry.astRule) && authorEntry.failureMessage) {
                            const astWrap = document.createElement('div')
                            astWrap.className = 'test-io'
                            astWrap.style.marginTop = '8px'
                            astWrap.style.background = '#f8f8f8'
                            astWrap.style.padding = '8px'
                            astWrap.style.borderRadius = '4px'
                            astWrap.style.fontFamily = 'monospace'
                            const fm = document.createElement('div')
                            fm.className = 'test-failure-message'
                            fm.style.marginTop = '6px'
                            fm.style.color = '#d33'
                            try { setInnerHTML(fm, renderMarkdown(String(authorEntry.failureMessage || ''))) } catch (_e) { fm.textContent = String(authorEntry.failureMessage) }
                            astWrap.appendChild(fm)
                            tr.appendChild(astWrap)
                        }
                    } catch (_e) { }
                    testsSection.appendChild(tr)
                }
            }

            if (!anyRendered && !ungroupedVisible.length) {
                const p = document.createElement('div')
                p.className = 'feedback-msg feedback-msg-hidden'
                p.textContent = '(no test results)'
                testsSection.appendChild(p)
            }
        } else {
            // Legacy flat format - render visibleResults directly in order
            if (visibleResults.length) {
                // Author test metadata can be found in _config.tests (optional)
                const cfgTests = Array.isArray((_config && _config.tests) ? _config.tests : []) ? _config.tests : []
                for (const r of visibleResults) {
                    const tr = document.createElement('div')
                    tr.className = 'feedback-entry test-entry ' + (r.passed ? 'test-pass' : 'test-fail')
                    tr.setAttribute('data-test-id', String(r.id || ''))

                    const titleRow = document.createElement('div')
                    titleRow.className = 'feedback-title-row'
                    const icon = document.createElement('span')
                    icon.className = 'feedback-icon'
                    icon.textContent = r.passed ? '✅' : '❌'
                    titleRow.appendChild(icon)
                    const titleEl = document.createElement('div')
                    titleEl.className = 'feedback-title'

                    // Prefer author-provided description/title from config.tests when available
                    let authorEntry = null
                    try {
                        authorEntry = cfgTests.find(t => String(t.id) === String(r.id))
                        // fallback: match by description if id didn't match (some imports may lose ids)
                        if (!authorEntry && r.description) {
                            authorEntry = cfgTests.find(t => t && t.description && String(t.description) === String(r.description)) || null
                        }
                    } catch (e) { authorEntry = null }
                    // If we attached meta to the result earlier, use it as a fallback
                    if (!authorEntry && r && r.meta) authorEntry = r.meta
                    const displayTitle = (authorEntry && (authorEntry.description || authorEntry.title)) ? (authorEntry.description || authorEntry.title) : ((r.description) ? r.description : (r.id || ''))
                    try { setInnerHTML(titleEl, renderMarkdown(String(displayTitle || ''))) } catch (_e) { titleEl.textContent = displayTitle }
                    titleRow.appendChild(titleEl)
                    tr.appendChild(titleRow)

                    tr.addEventListener('click', () => {
                        try { window.dispatchEvent(new CustomEvent('ssg:test-click', { detail: r })) } catch (_e) { }
                    })

                    // For legacy flat format, show failureMessage for failing tests
                    // even though this branch historically didn't render details.
                    try {
                        if (!r.passed && authorEntry && authorEntry.failureMessage) {
                            const det = document.createElement('div')
                            det.className = 'test-io'
                            det.style.marginTop = '8px'
                            det.style.background = '#f8f8f8'
                            det.style.padding = '8px'
                            det.style.borderRadius = '4px'
                            det.style.fontFamily = 'monospace'
                            const fm = document.createElement('div')
                            fm.className = 'test-failure-message'
                            fm.style.marginTop = '6px'
                            fm.style.color = '#d33'
                            try { setInnerHTML(fm, renderMarkdown(String(authorEntry.failureMessage || ''))) } catch (_e) { fm.textContent = String(authorEntry.failureMessage) }
                            det.appendChild(fm)
                            tr.appendChild(det)
                        }
                    } catch (_e) { }

                    testsSection.appendChild(tr)
                }
            } else {
                const p = document.createElement('div')
                p.className = 'feedback-msg feedback-msg-hidden'
                try { setInnerHTML(p, renderMarkdown('(no test results)')) } catch (_e) { p.textContent = '(no test results)' }
                testsSection.appendChild(p)
            }
        }

        for (const entry of _config.feedback) {
            const id = entry.id || ''
            const title = entry.title || id
            const matched = matchMap.get(id)

            // Respect visibleByDefault: if the entry is not matched and the
            // author explicitly set visibleByDefault to false, do not render
            // the entry at all. If visibleByDefault is absent, treat it as
            // true for backward compatibility (legacy configs).
            const isVisibleByDefault = (typeof entry.visibleByDefault === 'boolean') ? entry.visibleByDefault : true
            if (!matched && !isVisibleByDefault) {
                continue
            }

            const wrapper = document.createElement('div')
            wrapper.className = 'feedback-entry'
            wrapper.setAttribute('data-id', id)

            // severity (success | hint | info | warning) - default to success
            const sev = (entry.severity || 'success').toLowerCase()
            wrapper.classList.add('severity-' + sev)
            // mark wrapper as matched when a match exists so CSS can apply accents
            if (matched) wrapper.classList.add('matched')

            // title row: title on the left, optional compact indicator on the right
            const titleRow = document.createElement('div')
            titleRow.className = 'feedback-title-row'

            const titleEl = document.createElement('div')
            titleEl.className = 'feedback-title'
            try { setInnerHTML(titleEl, renderMarkdown(String(title || ''))) } catch (_e) { titleEl.textContent = title }
            titleRow.appendChild(titleEl)

            // If matched, always show a compact right-aligned indicator in the title row
            let indicatorEl = null
            if (matched) {
                indicatorEl = document.createElement('div')
                indicatorEl.className = 'feedback-match-indicator matched-' + sev
                // Plain unicode glyphs (non-emoji) — use requested symbols
                if (sev === 'hint') indicatorEl.textContent = '\u270E' // pencil
                else if (sev === 'info') indicatorEl.textContent = 'i'
                else if (sev === 'warning') indicatorEl.textContent = '!'
                else if (sev === 'error') indicatorEl.textContent = '×'
                else /* success and fallback */ indicatorEl.textContent = '✓'
                // Accessibility: label and title describe the matched severity
                try { indicatorEl.setAttribute('role', 'img') } catch (_e) { }
                try { indicatorEl.setAttribute('title', 'Matched: ' + sev) } catch (_e) { }
                try { indicatorEl.setAttribute('aria-label', 'Matched: ' + sev) } catch (_e) { }
                // ensure it's positioned to the right within the title row
                titleRow.appendChild(indicatorEl)
            }

            wrapper.appendChild(titleRow)

            // If matched and a message exists, keep the existing behavior of showing the message under the title
            if (matched && matched.message) {
                // Show the matched message beneath the title but keep the indicator
                // in the title row (no inline icon). Make the message visually
                // a subtle child of the title rather than a boxed panel.
                const msg = document.createElement('div')
                msg.className = 'feedback-msg feedback-msg-matched matched-' + sev
                try { setInnerHTML(msg, renderMarkdown(String(matched.message || ''))) } catch (_e) { msg.textContent = matched.message }
                wrapper.appendChild(msg)
            } else if (entry.visibleByDefault) {
                // Show an empty placeholder or hint for visible-by-default entries
                const hint = document.createElement('div')
                hint.className = 'feedback-msg feedback-msg-hidden'
                hint.textContent = ''
                wrapper.appendChild(hint)
            }

            // Clicking a title should emit the feedback-click with the canonical entry + match
            const attachClick = (el) => {
                el.addEventListener('click', () => {
                    try {
                        const payload = Object.assign({}, entry, { match: matched || null })
                        window.dispatchEvent(new CustomEvent('ssg:feedback-click', { detail: payload }))
                    } catch (_e) { }
                })
            }

            attachClick(wrapper)

            // Place into appropriate section(s) based on `when` array
            const when = Array.isArray(entry.when) ? entry.when : ['edit']
            if (when.includes('edit')) editSection.appendChild(wrapper)
            if (when.includes('run')) {
                const clone = wrapper.cloneNode(true)
                attachClick(clone)
                runSection.appendChild(clone)
            }
        }

        // If a section is empty, show a placeholder
        if (!editSection.querySelector('.feedback-entry')) {
            const p = document.createElement('div')
            p.className = 'feedback-msg feedback-msg-hidden'
            p.textContent = '(no code feedback)'
            editSection.appendChild(p)
        }

        if (!runSection.querySelector('.feedback-entry')) {
            const p = document.createElement('div')
            p.className = 'feedback-msg feedback-msg-hidden'
            p.textContent = '(no run-time feedback)'
            runSection.appendChild(p)
        }

        host.appendChild(editSection)
        host.appendChild(runSection)
    } catch (_e) { }
}

export function setFeedbackConfig(cfg) {
    // Defensive normalization for tests: the authoring UI or saved
    // author_config may contain `tests` as a JSON string or include
    // explicit nulls for optional fields. Normalize here so the
    // feedback UI reliably detects configured tests.
    let normalizedCfg = cfg || { feedback: [] }
    try {
        if (normalizedCfg && typeof normalizedCfg.tests === 'string' && normalizedCfg.tests.trim()) {
            try {
                const parsed = JSON.parse(normalizedCfg.tests)
                if (Array.isArray(parsed)) normalizedCfg.tests = parsed
            } catch (_e) { /* leave as-is if parse fails */ }
        }
    } catch (_e) { }

    // Normalize legacy feedback shape: some saved configs use the legacy
    // object form { ast: [], regex: [] } rather than the newer array form.
    // Convert that legacy shape into the normalized array so the UI can
    // iterate entries safely.
    try {
        if (normalizedCfg && normalizedCfg.feedback && !Array.isArray(normalizedCfg.feedback) && typeof normalizedCfg.feedback === 'object') {
            const legacy = normalizedCfg.feedback || {}
            const arr = []
            const r = Array.isArray(legacy.regex) ? legacy.regex : []
            for (let i = 0; i < r.length; i++) {
                const item = r[i]
                arr.push({
                    id: item.id || ('legacy-regex-' + i),
                    title: item.title || ('legacy ' + i),
                    when: item.when || ['edit'],
                    pattern: { type: 'regex', target: (item.target === 'output' ? 'stdout' : (item.target || 'code')), expression: item.pattern || item.expression || '' },
                    message: item.message || '',
                    severity: item.severity || 'info',
                    visibleByDefault: typeof item.visibleByDefault === 'boolean' ? item.visibleByDefault : true
                })
            }
            const a = Array.isArray(legacy.ast) ? legacy.ast : []
            for (let i = 0; i < a.length; i++) {
                const item = a[i]
                arr.push({
                    id: item.id || ('legacy-ast-' + i),
                    title: item.title || ('legacy-ast ' + i),
                    when: item.when || ['edit'],
                    pattern: { type: 'ast', target: (item.target || 'code'), expression: item.rule || item.expression || item.pattern || '', matcher: item.matcher || '' },
                    message: item.message || '',
                    severity: item.severity || 'info',
                    visibleByDefault: typeof item.visibleByDefault === 'boolean' ? item.visibleByDefault : true
                })
            }
            normalizedCfg.feedback = arr
        }
    } catch (_e) { }

    try {
        if (normalizedCfg && Array.isArray(normalizedCfg.tests)) {
            normalizedCfg.tests = normalizedCfg.tests.map(t => {
                if (!t || typeof t !== 'object') return t
                const clean = Object.assign({}, t)
                if (clean.expected_stdout === null) delete clean.expected_stdout
                if (clean.expected_stderr === null) delete clean.expected_stderr
                if (clean.setup === null) delete clean.setup
                if (clean.stdin === null) delete clean.stdin
                if (!clean.id) clean.id = ('t-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7))
                return clean
            })
        }
    } catch (_e) { }

    _config = normalizedCfg
    // When the config changes, any previously-computed matches or
    // stream buffers from the prior config may be stale. Clear them so
    // the feedback rules will be re-evaluated and the UI won't show
    // matches that belonged to the previous config.
    try {
        _matches = []
        _prevMatchedIds = new Set()
        _streamBuffers = {}
    } catch (_e) { }

    renderList()
    // Mark feedback tab as having new feedback if there are visible entries
    try {
        const fbBtn = document.getElementById('tab-btn-feedback')
        const hasVisible = Array.isArray(_config.feedback) && _config.feedback.length > 0
        if (fbBtn) {
            if (hasVisible && fbBtn.getAttribute('aria-selected') !== 'true') fbBtn.classList.add('has-new-feedback')
            else fbBtn.classList.remove('has-new-feedback')
        }
    } catch (_e) { }
}

export function setFeedbackMatches(matches) {
    // Compute the set of match ids from the incoming matches
    const newMatches = matches || []
    const newIds = new Set()
    try {
        for (const m of newMatches) {
            try {
                if (m && (m.id !== undefined && m.id !== null)) newIds.add(String(m.id))
            } catch (_e) { }
        }
    } catch (_e) { }

    // Detect if any id is newly added compared to previous state
    let hasNewlyAdded = false
    try {
        for (const id of newIds) {
            if (!_prevMatchedIds.has(id)) { hasNewlyAdded = true; break }
        }
    } catch (_e) { }

    _matches = newMatches

    // Enforce dependencies: support both legacy string ids and the new
    // object shape { id, requiresMatched } where requiresMatched === false
    // indicates the dependency requires the other rule NOT to be matched.
    try {
        const presentIds = new Set()
        for (const m of _matches) {
            try { if (m && m.id != null) presentIds.add(String(m.id)) } catch (_e) { }
        }

        // Build a map of config entries by id for dependency lookup
        const cfgMap = new Map()
        try {
            if (_config && Array.isArray(_config.feedback)) {
                for (const e of _config.feedback) {
                    if (e && e.id != null) cfgMap.set(String(e.id), e)
                }
            }
        } catch (_e) { }

        // Filter matches to only those that satisfy dependency predicates
        const filtered = []
        for (const m of _matches) {
            if (!m || m.id == null) continue
            const id = String(m.id)
            const cfg = cfgMap.get(id)
            if (!cfg || !cfg.dependencies) {
                filtered.push(m)
                continue
            }

            const depsRaw = Array.isArray(cfg.dependencies) ? cfg.dependencies : []
            let ok = true
            for (const dep of depsRaw) {
                // Expect dependencies to be objects: { id, requiresMatched }
                if (!dep || typeof dep !== 'object') continue
                const depId = dep.id || null
                const requiresMatched = (dep.requiresMatched === undefined) ? true : !!dep.requiresMatched
                if (!depId) continue
                if (requiresMatched) {
                    if (!presentIds.has(String(depId))) { ok = false; break }
                } else {
                    if (presentIds.has(String(depId))) { ok = false; break }
                }
            }
            if (ok) filtered.push(m)
        }

        // replace _matches with filtered effective matches for UI rendering
        _matches = filtered
    } catch (_e) { }

    renderList()
    try {
        const fbBtn = document.getElementById('tab-btn-feedback')
        const hasMatch = newIds.size > 0
        if (fbBtn) {
            // Only mark as new if there are newly added matched rule ids and
            // the tab is not currently selected. Do not re-add the indicator
            // on re-runs that don't introduce new matches.
            if (hasNewlyAdded && fbBtn.getAttribute('aria-selected') !== 'true') {
                fbBtn.classList.add('has-new-feedback')
            } else if (!hasMatch) {
                // If there are no matches any more, clear the indicator
                fbBtn.classList.remove('has-new-feedback')
            }
        }
    } catch (_e) { }

    // Update previous ids snapshot for next comparison
    _prevMatchedIds = newIds
}

export function setTestResults(results) {
    _testResults = Array.isArray(results) ? results : []
    try {
        // Attach metadata from current config.tests to each result for easier rendering
        // Normalize _config.tests into a flat array (works for legacy and grouped formats)
        let cfgTests = []
        try {
            if (_config && _config.tests) {
                if (Array.isArray(_config.tests)) {
                    cfgTests = _config.tests.slice()
                } else {
                    // grouped format: collect from groups and ungrouped
                    if (Array.isArray(_config.tests.groups)) {
                        for (const g of _config.tests.groups) {
                            if (Array.isArray(g.tests)) cfgTests.push(...g.tests)
                        }
                    }
                    if (Array.isArray(_config.tests.ungrouped)) cfgTests.push(..._config.tests.ungrouped)
                }
            }
        } catch (_e) { cfgTests = [] }

        _testResults.forEach(r => {
            try {
                let meta = null
                try {
                    meta = cfgTests.find(t => String(t.id) === String(r.id)) || null
                } catch (_e) { meta = null }
                if (!meta && r.description) {
                    try { meta = cfgTests.find(t => t && t.description && String(t.description) === String(r.description)) || null } catch (_e) { meta = null }
                }
                r.meta = meta
            } catch (_e) { r.meta = null }
        })
        try {
            const visibleCount = Array.isArray(_testResults) ? _testResults.filter(r => !r.skipped).length : 0
            logDebug('[feedback-ui] setTestResults total=', _testResults.length, 'visible=', visibleCount)
        } catch (_e) { }
    } catch (e) { }
    renderList()
    try {
        const fbBtn = document.getElementById('tab-btn-feedback')
        const visibleCount = Array.isArray(_testResults) ? _testResults.filter(r => !r.skipped).length : 0
        if (fbBtn) {
            if (visibleCount > 0 && fbBtn.getAttribute('aria-selected') !== 'true') fbBtn.classList.add('has-new-feedback')
            else if (visibleCount === 0) fbBtn.classList.remove('has-new-feedback')
        }
    } catch (_e) { }
}

export function appendTestOutput({ id, type, text }) {
    try {
        if (!id) return
        _streamBuffers[id] = _streamBuffers[id] || { stdout: '', stderr: '' }
        // Preserve line breaks between streamed chunks. The runtime may emit
        // small chunks without newlines; if neither the existing buffer nor
        // the incoming chunk contain a newline, insert a single '\n'
        // between them to avoid glueing separate logical lines together.
        const appendChunk = (key, chunk) => {
            const cur = _streamBuffers[id][key] || ''
            if (!cur) {
                _streamBuffers[id][key] = chunk
                return
            }
            const hasNewlineCur = cur.indexOf('\n') !== -1
            const hasNewlineChunk = (typeof chunk === 'string') && chunk.indexOf('\n') !== -1
            _streamBuffers[id][key] = (hasNewlineCur || hasNewlineChunk) ? (cur + chunk) : (cur + '\n' + chunk)
        }
        if (type === 'stdout') appendChunk('stdout', text)
        else if (type === 'stderr') appendChunk('stderr', text)

        // If we already have a result entry for this id, update it
        const idx = _testResults.findIndex(r => String(r.id) === String(id))
        if (idx !== -1) {
            const existing = _testResults[idx]
            existing.stdout = _streamBuffers[id].stdout
            existing.stderr = _streamBuffers[id].stderr
            renderList()
        }
    } catch (_e) { }
}

// Modal helpers for showing test-run summaries
function createResultsModal() {
    let modal = document.getElementById('test-results-modal')
    if (modal) return modal
    modal = document.createElement('div')
    modal.id = 'test-results-modal'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-labelledby', 'test-results-title')
    modal.style.position = 'fixed'
    modal.style.left = '0'
    modal.style.top = '0'
    modal.style.right = '0'
    modal.style.bottom = '0'
    modal.style.display = 'flex'
    modal.style.alignItems = 'center'
    modal.style.justifyContent = 'center'
    modal.style.zIndex = '9999'

    const overlay = document.createElement('div')
    overlay.style.position = 'absolute'
    overlay.style.left = '0'
    overlay.style.top = '0'
    overlay.style.right = '0'
    overlay.style.bottom = '0'
    overlay.style.background = 'rgba(0,0,0,0.45)'
    // Do not intercept pointer events on the overlay so automated clicks
    // (e.g. Playwright) are not blocked while the modal is being created.
    overlay.style.pointerEvents = 'none'
    modal.appendChild(overlay)

    const box = document.createElement('div')
    box.className = 'test-results-box'
    box.style.position = 'relative'
    box.style.maxWidth = '720px'
    box.style.width = '90%'
    box.style.maxHeight = '80%'
    box.style.overflow = 'auto'
    box.style.background = '#fff'
    box.style.borderRadius = '8px'
    box.style.padding = '18px'
    box.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'
    // Ensure the modal content box receives pointer events
    box.style.pointerEvents = 'auto'
    modal.appendChild(box)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'btn modal-close-btn'
    closeBtn.textContent = 'Close'
    closeBtn.style.position = 'absolute'
    closeBtn.style.right = '12px'
    closeBtn.style.top = '12px'
    closeBtn.addEventListener('click', () => closeTestResultsModal())
    box.appendChild(closeBtn)

    const title = document.createElement('h2')
    title.id = 'test-results-title'
    title.textContent = 'Test results'
    title.style.marginTop = '6px'
    title.style.marginBottom = '12px'
    box.appendChild(title)

    // Verification code display area (initially hidden)
    const verificationDiv = document.createElement('div')
    verificationDiv.id = 'verification-code-display'
    verificationDiv.style.display = 'none'
    verificationDiv.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)'
    verificationDiv.style.color = 'white'
    verificationDiv.style.padding = '12px 16px'
    verificationDiv.style.borderRadius = '8px'
    verificationDiv.style.marginBottom = '16px'
    verificationDiv.style.textAlign = 'center'
    verificationDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'

    const verificationTitle = document.createElement('div')
    verificationTitle.style.fontSize = '0.9em'
    verificationTitle.style.marginBottom = '4px'
    verificationTitle.textContent = '🎉 All tests passed! Your verification code:'
    verificationDiv.appendChild(verificationTitle)

    const verificationCode = document.createElement('div')
    verificationCode.id = 'verification-code-text'
    verificationCode.style.fontSize = '1.3em'
    verificationCode.style.fontWeight = 'bold'
    verificationCode.style.fontFamily = 'monospace'
    verificationCode.style.letterSpacing = '2px'
    verificationDiv.appendChild(verificationCode)

    const verificationSubtext = document.createElement('div')
    verificationSubtext.style.fontSize = '0.8em'
    verificationSubtext.style.marginTop = '6px'
    verificationSubtext.style.opacity = '0.9'
    verificationSubtext.textContent = 'Share this code with your teacher as proof of completion'
    verificationDiv.appendChild(verificationSubtext)

    box.appendChild(verificationDiv)

    const content = document.createElement('div')
    content.className = 'test-results-content'
    box.appendChild(content)

    // Note: overlay is non-interactive to avoid blocking automated UI actions.
    // Closing the modal should be done via the Close button or ESC.

    // Accessibility: trap focus, handle ESC, and restore focus on close
    let previouslyFocused = null
    function keyHandler(e) {
        if (e.key === 'Escape') {
            e.stopPropagation()
            closeTestResultsModal()
            return
        }
        if (e.key === 'Tab') {
            // simple focus trap within box
            const focusable = box.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
            if (!focusable || focusable.length === 0) return
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault()
                    last.focus()
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault()
                    first.focus()
                }
            }
        }
    }

    modal._attachAccessibility = () => {
        previouslyFocused = document.activeElement
        document.addEventListener('keydown', keyHandler, true)
        // focus the close button by default
        try { closeBtn.focus() } catch (e) { }
    }

    modal._detachAccessibility = () => {
        document.removeEventListener('keydown', keyHandler, true)
        try { if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus() } catch (e) { }
    }

    document.body.appendChild(modal)
    return modal
}

function closeTestResultsModal() {
    const modal = document.getElementById('test-results-modal')
    if (!modal) return
    try {
        if (modal._detachAccessibility) modal._detachAccessibility()
        modal.remove()
    } catch (e) { modal.style.display = 'none' }
}

async function handleVerificationCodeDisplay(results, config) {
    const verificationDiv = document.getElementById('verification-code-display')
    const verificationCodeText = document.getElementById('verification-code-text')

    if (!verificationDiv || !verificationCodeText) return

    try {
        // Check if verification code should be shown
        const allTestsPassed = shouldShowVerificationCode(results)
        const studentId = getStudentIdentifier()

        if (allTestsPassed && studentId) {
            // Generate verification code
            const verificationCode = await generateVerificationCode(config, studentId, true)

            if (verificationCode) {
                verificationCodeText.textContent = verificationCode.toUpperCase()
                verificationDiv.style.display = 'block'
                logDebug('Displaying verification code:', verificationCode)
            }
        } else {
            verificationDiv.style.display = 'none'
        }
    } catch (e) {
        logDebug('Error handling verification code display:', e)
        verificationDiv.style.display = 'none'
    }
}

function showTestResultsModal(results) {
    if (!results || !Array.isArray(results)) return
    // Build modal
    const modal = createResultsModal()
    const content = modal.querySelector('.test-results-content')
    if (!content) return
    // Clear existing modal content safely without assigning HTML
    while (content.firstChild) content.removeChild(content.firstChild)

    // attach accessibility handlers when showing
    try { if (modal._attachAccessibility) modal._attachAccessibility() } catch (e) { }

    // Determine if this is a grouped configuration and build test metadata map
    let isGroupedConfig = false
    const cfgMap = new Map()
    const groupMap = new Map() // Maps test id to group info

    try {
        if (_config && _config.tests) {
            if (Array.isArray(_config.tests)) {
                // Legacy format: direct array of tests
                for (const t of _config.tests) cfgMap.set(String(t.id), t)
            } else if (_config.tests.groups || _config.tests.ungrouped) {
                // Grouped format: object with groups and ungrouped arrays
                isGroupedConfig = true

                // Process grouped tests
                if (_config.tests.groups) {
                    for (let groupIndex = 0; groupIndex < _config.tests.groups.length; groupIndex++) {
                        const group = _config.tests.groups[groupIndex]
                        const groupInfo = {
                            name: group.name || `Group ${groupIndex + 1}`,
                            index: groupIndex + 1
                        }

                        if (group.tests) {
                            for (let testIndex = 0; testIndex < group.tests.length; testIndex++) {
                                const test = group.tests[testIndex]
                                cfgMap.set(String(test.id), test)
                                groupMap.set(String(test.id), { ...groupInfo, testNumber: testIndex + 1 })
                            }
                        }
                    }
                }

                // Process ungrouped tests
                if (_config.tests.ungrouped) {
                    for (const test of _config.tests.ungrouped) {
                        cfgMap.set(String(test.id), test)
                        // ungrouped tests don't have group info
                    }
                }
            }
        }
    } catch (e) { }

    // Show groups toggle is now controlled by config only - no user toggle in main app
    const showGroups = isGroupedConfig && _config.tests.showGroupsToUsers !== false

    // Render results based on config setting
    if (isGroupedConfig) {
        renderTestResults(results, cfgMap, groupMap, showGroups)
    } else {
        // Legacy format - render normally
        renderTestResults(results, cfgMap, groupMap, false)
    }

    // Handle verification code display
    handleVerificationCodeDisplay(results, _config)

    // Focus for a11y
    const box = modal.querySelector('.test-results-box')
    if (box) box.focus()
}

function renderTestResults(results, cfgMap, groupMap, showGroups) {
    const modal = document.getElementById('test-results-modal')
    if (!modal) return

    const content = modal.querySelector('.test-results-content')
    if (!content) return

    // Clear content safely without assigning raw HTML
    while (content.firstChild) content.removeChild(content.firstChild)

    // Filter out skipped tests: modal should only show executed tests
    const visibleResults = Array.isArray(results) ? results.filter(r => !r.skipped) : []

    if (showGroups && groupMap.size > 0) {
        // Group visible results by group (skip any skipped tests)
        const groupedResults = new Map()
        const ungroupedResults = []

        for (const result of visibleResults) {
            const groupInfo = groupMap.get(String(result.id))
            if (groupInfo) {
                const groupKey = `${groupInfo.index}-${groupInfo.name}`
                if (!groupedResults.has(groupKey)) {
                    groupedResults.set(groupKey, {
                        info: groupInfo,
                        results: []
                    })
                }
                groupedResults.get(groupKey).results.push(result)
            } else {
                ungroupedResults.push(result)
            }
        }

        // Render groups (only groups that have visible results will appear)
        for (const [groupKey, groupData] of groupedResults) {
            const groupSection = document.createElement('div')
            groupSection.className = 'test-group-section'
            groupSection.style.marginBottom = '20px'

            const groupHeader = document.createElement('h3')
            try { setInnerHTML(groupHeader, renderMarkdown(String(groupData.info.name || ''))) } catch (_e) { groupHeader.textContent = groupData.info.name }
            groupHeader.style.margin = '16px 0 12px 0'
            groupHeader.style.padding = '4px 0 4px 5px'
            groupHeader.style.borderLeft = '4px solid #5c5'
            groupHeader.style.fontSize = '16px'
            groupHeader.style.fontWeight = '600'
            groupHeader.style.color = '#555'
            groupHeader.style.verticalAlign = 'middle'
            groupSection.appendChild(groupHeader)

            // Sort tests in group by their order in the config (use testNumber or fallback)
            groupData.results.sort((a, b) => {
                const aInfo = groupMap.get(String(a.id)) || {}
                const bInfo = groupMap.get(String(b.id)) || {}
                const aIdx = (typeof aInfo.testNumber === 'number') ? aInfo.testNumber : (typeof aInfo.testIndex === 'number' ? aInfo.testIndex : 0)
                const bIdx = (typeof bInfo.testNumber === 'number') ? bInfo.testNumber : (typeof bInfo.testIndex === 'number' ? bInfo.testIndex : 0)
                return aIdx - bIdx
            })

            // Render tests in group
            for (const result of groupData.results) {
                const row = createTestResultRow(result, cfgMap, groupMap, true)
                groupSection.appendChild(row)
            }

            content.appendChild(groupSection)
        }

        // Render ungrouped tests
        if (ungroupedResults.length > 0) {
            const ungroupedSection = document.createElement('div')
            ungroupedSection.className = 'test-ungrouped-section'
            ungroupedSection.style.marginBottom = '20px'

            const ungroupedHeader = document.createElement('h3')
            ungroupedHeader.textContent = 'Ungrouped Tests'
            ungroupedHeader.style.margin = '16px 0 12px 0'
            ungroupedHeader.style.padding = '8px 0'
            ungroupedHeader.style.borderBottom = '2px solid #ddd'
            ungroupedHeader.style.fontSize = '16px'
            ungroupedHeader.style.fontWeight = '600'
            ungroupedHeader.style.color = '#555'
            ungroupedSection.appendChild(ungroupedHeader)

            for (const result of ungroupedResults) {
                const row = createTestResultRow(result, cfgMap, groupMap, false)
                ungroupedSection.appendChild(row)
            }

            content.appendChild(ungroupedSection)
        }
    } else {
        // Flat display - only show visible results and sort by config order
        const sortedResults = [...visibleResults]
        sortedResults.sort((a, b) => {
            const aInfo = groupMap.get(String(a.id))
            const bInfo = groupMap.get(String(b.id))

            // If both have group info, sort by group index then test index
            if (aInfo && bInfo) {
                if (aInfo.groupIndex !== bInfo.groupIndex) {
                    return aInfo.groupIndex - bInfo.groupIndex
                }
                return aInfo.testIndex - bInfo.testIndex
            }

            // If only one has group info, prioritize grouped tests
            if (aInfo && !bInfo) return -1
            if (!aInfo && bInfo) return 1

            // If neither has group info, maintain original order
            return 0
        })

        for (const result of sortedResults) {
            const row = createTestResultRow(result, cfgMap, groupMap, false)
            content.appendChild(row)
        }
    }
}

function createTestResultRow(r, cfgMap, groupMap, isGrouped) {
    const row = document.createElement('div')
    row.className = 'test-result-row'
    row.style.borderTop = '1px solid #eee'
    row.style.padding = '10px 0'

    const header = document.createElement('div')
    header.style.display = 'flex'
    header.style.alignItems = 'center'
    header.style.justifyContent = 'space-between'

    const left = document.createElement('div')
    left.style.display = 'flex'
    left.style.alignItems = 'center'

    const emoji = document.createElement('div')
    emoji.style.fontSize = '20px'
    emoji.style.marginRight = '10px'
    emoji.textContent = r.passed ? '✅' : '❌'
    left.appendChild(emoji)

    const title = document.createElement('div')
    const meta = cfgMap.get(String(r.id)) || {}

    // Build title with test numbering if grouped
    let titleText = meta.description || r.description || (r.id || '')
    if (isGrouped) {
        const groupInfo = groupMap.get(String(r.id))
        if (groupInfo) {
            titleText = `${groupInfo.index}.${groupInfo.testNumber} ${titleText}`
        }
    }

    try { setInnerHTML(title, renderMarkdown(String(titleText || ''))) } catch (_e) { title.textContent = titleText }
    title.style.fontWeight = '600'
    left.appendChild(title)

    header.appendChild(left)

    const status = document.createElement('div')
    status.textContent = r.passed ? 'Passed' : 'Failed'
    status.style.fontWeight = '600'
    header.appendChild(status)

    row.appendChild(header)

    // Optional feedback blocks
    const fb = document.createElement('div')
    fb.style.marginTop = '8px'
    fb.style.whiteSpace = 'pre-wrap'

    // Show actual vs expected for failing tests when we have an expected_stdout
    try {
        let expected = null
        if (typeof r.expected_stdout !== 'undefined' && r.expected_stdout !== null) expected = r.expected_stdout
        else if (meta && typeof meta.expected_stdout !== 'undefined' && meta.expected_stdout !== null) expected = meta.expected_stdout
        else {
            const cfgEntry = cfgMap.get(String(r.id)) || {}
            if (typeof cfgEntry.expected_stdout !== 'undefined' && cfgEntry.expected_stdout !== null) expected = cfgEntry.expected_stdout
        }

        const hideActualExpected = meta && meta.hide_actual_expected
        if (!r.passed && expected != null && !(typeof expected === 'object' && (expected.type === 'regex' || expected.type === 'exact')) && !(r.stderr && r.stderr.trim().length > 0) && !hideActualExpected) {
            const compareWrap = document.createElement('div')
            compareWrap.className = 'test-compare'
            compareWrap.style.marginTop = '8px'

            const actualLabel = document.createElement('div')
            actualLabel.textContent = 'Actual:'
            actualLabel.style.fontSize = '0.9em'
            actualLabel.style.marginBottom = '4px'
            compareWrap.appendChild(actualLabel)

            const preA = document.createElement('pre')
            preA.style.whiteSpace = 'pre-wrap'
            preA.style.fontFamily = 'monospace'
            const codeA = document.createElement('code')
            codeA.className = 'test-code'
            codeA.setAttribute('data-nohighlight', 'true')
            codeA.textContent = (r.stdout != null) ? String(r.stdout) : ''
            preA.appendChild(codeA)
            compareWrap.appendChild(preA)

            const expectedLabel = document.createElement('div')
            expectedLabel.textContent = 'Expected:'
            expectedLabel.style.fontSize = '0.9em'
            expectedLabel.style.margin = '8px 0 4px'
            compareWrap.appendChild(expectedLabel)

            const preE = document.createElement('pre')
            preE.style.whiteSpace = 'pre-wrap'
            preE.style.fontFamily = 'monospace'
            const codeE = document.createElement('code')
            codeE.className = 'test-code'
            codeE.setAttribute('data-nohighlight', 'true')
            try {
                if (typeof expected === 'string') codeE.textContent = expected
                else if (typeof expected === 'object' && expected.type === 'regex') codeE.textContent = `/${expected.expression}/${expected.flags || ''}`
                else if (typeof expected === 'object' && expected.type === 'exact') codeE.textContent = `[exact: ${expected.expression}]`
                else codeE.textContent = JSON.stringify(expected)
            } catch (_e) { codeE.textContent = String(expected) }
            preE.appendChild(codeE)
            compareWrap.appendChild(preE)

            // If the runner provided match details (captured groups), show them
            try {
                if (r.details && r.details.stdout) {
                    const detailWrap = document.createElement('div')
                    detailWrap.style.marginTop = '6px'
                    const dg = r.details.stdout
                    // If details is an array (match groups), render them
                    if (Array.isArray(dg)) {
                        const caps = document.createElement('div')
                        caps.textContent = 'Captured groups: ' + JSON.stringify(dg.slice(1))
                        caps.style.fontFamily = 'monospace'
                        caps.style.marginTop = '6px'
                        detailWrap.appendChild(caps)
                    } else if (typeof dg === 'object') {
                        const caps = document.createElement('div')
                        caps.textContent = 'Match details: ' + JSON.stringify(dg)
                        caps.style.fontFamily = 'monospace'
                        caps.style.marginTop = '6px'
                        detailWrap.appendChild(caps)
                    }
                    compareWrap.appendChild(detailWrap)
                }
            } catch (_e) { }

            fb.appendChild(compareWrap)
        }
    } catch (_e) { }

    if (r.passed && meta && meta.pass_feedback) {
        const pf = document.createElement('div')
        pf.className = 'test-pass-feedback'
        try { setInnerHTML(pf, renderMarkdown(String(meta.pass_feedback || ''))) } catch (_e) { pf.textContent = String(meta.pass_feedback) }
        pf.style.color = '#0a6'
        fb.appendChild(pf)
    } else if (!r.passed && meta && meta.fail_feedback) {
        const ff = document.createElement('div')
        ff.className = 'test-fail-feedback'
        try { setInnerHTML(ff, renderMarkdown(String(meta.fail_feedback || ''))) } catch (_e) { ff.textContent = String(meta.fail_feedback) }
        ff.style.color = '#d33'
        fb.appendChild(ff)
    }

    // Show stderr/reason when there's a runtime error (always) or when author 
    // explicitly requests it. Always show stderr for runtime errors.
    const showDetails = meta && (meta.show_stderr || meta.show_traceback)
    const hasStderr = r.stderr && r.stderr.trim().length > 0
    if (r.reason || hasStderr || (showDetails && r.stderr)) {
        const detWrap = document.createElement('div')
        detWrap.className = 'test-io'
        detWrap.style.marginTop = '8px'
        detWrap.style.background = '#f8f8f8'
        detWrap.style.padding = '8px'
        detWrap.style.borderRadius = '4px'
        detWrap.style.fontFamily = 'monospace'

        if (r.reason) {
            const reasonEl = document.createElement('div')
            reasonEl.textContent = r.reason
            reasonEl.style.marginBottom = '6px'
            detWrap.appendChild(reasonEl)
        }

        if (hasStderr || (showDetails && r.stderr)) {
            const stderrEl = document.createElement('div')
            stderrEl.className = 'test-stderr'
            stderrEl.style.whiteSpace = 'pre-wrap'
            stderrEl.textContent = r.stderr
            detWrap.appendChild(stderrEl)
        }

        // Also include author-provided failure message in the test-io area
        try {
            if (meta && meta.failureMessage) {
                const fm = document.createElement('div')
                fm.className = 'test-failure-message'
                fm.style.marginTop = '6px'
                fm.style.color = '#d33'
                try { setInnerHTML(fm, renderMarkdown(String(meta.failureMessage || ''))) } catch (_e) { fm.textContent = String(meta.failureMessage) }
                detWrap.appendChild(fm)
            }
        } catch (_e) { }

        fb.appendChild(detWrap)
    }

    // AST test fallback for modal: if this is an AST test failure and no detail blocks
    // were rendered above, ensure the failureMessage is visible
    try {
        const hasDetailInModal = fb.querySelector('.test-compare') || fb.querySelector('.test-fail-feedback') || fb.querySelector('.test-io')
        if (!r.passed && meta && (meta.type === 'ast' || meta.astRule) && meta.failureMessage && !hasDetailInModal) {
            const astWrap = document.createElement('div')
            astWrap.className = 'test-io'
            astWrap.style.marginTop = '8px'
            astWrap.style.background = '#f8f8f8'
            astWrap.style.padding = '8px'
            astWrap.style.borderRadius = '4px'
            astWrap.style.fontFamily = 'monospace'

            const fm = document.createElement('div')
            fm.className = 'test-failure-message'
            fm.style.marginTop = '6px'
            fm.style.color = '#d33'
            try { setInnerHTML(fm, renderMarkdown(String(meta.failureMessage || ''))) } catch (_e) { fm.textContent = String(meta.failureMessage) }
            astWrap.appendChild(fm)
            fb.appendChild(astWrap)
        }
    } catch (_e) { }

    row.appendChild(fb)
    return row
}

// Public helper that will create or refresh the modal when explicitly requested.
function showOrUpdateTestResultsModal(results) {
    // If modal already exists, just refresh content; otherwise create and show it.
    try {
        // Always update internal results state so appendTestOutput/renderList reflect latest
        if (Array.isArray(results)) _testResults = results
        // If the modal doesn't exist yet, create it and show loading if results are empty
        const modalExists = !!document.getElementById('test-results-modal')
        if (!modalExists && (!results || !Array.isArray(results) || results.length === 0)) {
            showTestResultsLoading()
            return
        }
        // Otherwise show/refresh with current results
        showTestResultsModal(_testResults)
    } catch (e) { }
}

function showTestResultsLoading() {
    const modal = createResultsModal()
    const content = modal.querySelector('.test-results-content')
    if (!content) return
    // Clear content safely without assigning raw HTML
    while (content.firstChild) content.removeChild(content.firstChild)
    const loading = document.createElement('div')
    loading.className = 'test-results-loading'
    loading.textContent = 'Running tests...'
    loading.style.padding = '18px'
    content.appendChild(loading)
    try { if (modal._attachAccessibility) modal._attachAccessibility() } catch (e) { }
}

export function initializeFeedbackUI() {
    try {
        // Ensure no stale modal from previous runs remains
        try { closeTestResultsModal() } catch (e) { }
        // expose hooks for other modules to push matches or config
        window.__ssg_set_feedback_matches = setFeedbackMatches
        window.__ssg_set_feedback_config = setFeedbackConfig
        window.__ssg_set_test_results = setTestResults
        window.__ssg_append_test_output = appendTestOutput
        // Expose explicit modal controls so the app can open/refresh/close the modal
        window.__ssg_show_test_results = (results) => showOrUpdateTestResultsModal(results)
        window.__ssg_show_test_results_loading = showTestResultsLoading
        window.__ssg_close_test_results = closeTestResultsModal
    } catch (_e) { }
}

export default { setFeedbackConfig, setFeedbackMatches, initializeFeedbackUI }
