import { $ } from './utils.js'

let _matches = []
let _config = { feedback: [] }
let _testResults = []
let _streamBuffers = {}

function renderList() {
    try {
        const host = $('feedback-list')
        if (!host) return
        // Clear host first, then add run-tests control at top
        host.innerHTML = ''
        const controlRow = document.createElement('div')
        controlRow.style.display = 'flex'
        controlRow.style.justifyContent = 'flex-end'
        controlRow.style.marginBottom = '6px'
        const runBtn = document.createElement('button')
        runBtn.className = 'btn'
        runBtn.id = 'run-tests-btn'
        runBtn.textContent = 'Run tests'
        // Determine whether there are author tests in the config; if not, disable the button
        const cfgTests = Array.isArray(_config && _config.tests ? _config.tests : null) ? _config.tests : []
        if (!Array.isArray(cfgTests) || cfgTests.length === 0) {
            runBtn.disabled = true
            runBtn.title = 'No tests defined'
            runBtn.setAttribute('aria-disabled', 'true')
        } else {
            runBtn.title = 'Run tests'
            runBtn.setAttribute('aria-disabled', 'false')
        }

        runBtn.addEventListener('click', () => {
            try {
                // Trace user interaction for debugging: ensure the custom event is dispatched
                try { console.debug && console.debug('[feedback-ui] run-tests button clicked') } catch (_e) { }
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
            p.textContent = '(no feedback)'
            host.appendChild(p)
            // continue rendering empty sections so run-tests control remains visible
        }

        // Create two sections: edit and run
        const editSection = document.createElement('div')
        editSection.className = 'feedback-section feedback-edit-section'
        const editHeader = document.createElement('h3')
        editHeader.textContent = 'Editor feedback'
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

        if (Array.isArray(_testResults) && _testResults.length) {
            // Author test metadata can be found in _config.tests (optional)
            const cfgTests = Array.isArray((_config && _config.tests) ? _config.tests : []) ? _config.tests : []
            for (const r of _testResults) {
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
                const displayTitle = (authorEntry && (authorEntry.description || authorEntry.title)) ? (authorEntry.description || authorEntry.title) : ((r.description) ? r.description : (r.id || ''))
                titleEl.textContent = displayTitle
                titleRow.appendChild(titleEl)
                tr.appendChild(titleRow)

                // Show actual vs expected for failing tests when the author-provided
                // expected_stdout exists and is a plain string (not regex). This helps 
                // authors quickly see mismatches. Passing tests remain compact.
                // We avoid showing actual/expected for regex tests as it's confusing.
                // IMPORTANT: Only show actual/expected if there's no stderr - if the program
                // crashed we should show the traceback instead of output comparison.
                // ALSO: Respect per-test hide_actual_expected setting to allow authors to disable this per test.
                const hasExpected = authorEntry && (authorEntry.expected_stdout != null)
                const isRegexExpected = hasExpected && (typeof authorEntry.expected_stdout === 'object' && authorEntry.expected_stdout.type === 'regex')
                const hasStderr = r.stderr && r.stderr.trim().length > 0
                const hideActualExpected = authorEntry && authorEntry.hide_actual_expected
                if (!r.passed && hasExpected && !isRegexExpected && !hasStderr && !hideActualExpected) {
                    const detailsWrap = document.createElement('div')
                    detailsWrap.className = 'test-compare'
                    detailsWrap.style.marginTop = '8px'
                    // Actual
                    const actualLabel = document.createElement('div')
                    actualLabel.textContent = 'Actual:'
                    actualLabel.style.fontSize = '0.9em'
                    actualLabel.style.marginBottom = '4px'
                    detailsWrap.appendChild(actualLabel)
                    const preA = document.createElement('pre')
                    preA.style.whiteSpace = 'pre-wrap'
                    preA.style.fontFamily = 'monospace'
                    const codeA = document.createElement('code')
                    // render as plain text (no syntax highlighting by default)
                    codeA.className = 'test-code'
                    codeA.setAttribute('data-nohighlight', 'true')
                    codeA.textContent = (r.stdout != null) ? String(r.stdout) : ''
                    preA.appendChild(codeA)
                    detailsWrap.appendChild(preA)

                    // Expected
                    const expectedLabel = document.createElement('div')
                    expectedLabel.textContent = 'Expected:'
                    expectedLabel.style.fontSize = '0.9em'
                    expectedLabel.style.margin = '8px 0 4px'
                    detailsWrap.appendChild(expectedLabel)
                    const preE = document.createElement('pre')
                    preE.style.whiteSpace = 'pre-wrap'
                    preE.style.fontFamily = 'monospace'
                    const codeE = document.createElement('code')
                    codeE.className = 'test-code'
                    codeE.setAttribute('data-nohighlight', 'true')
                    // If regex-shaped object, show as /expr/flags, otherwise string.
                    try {
                        const exp = authorEntry.expected_stdout
                        if (typeof exp === 'string') codeE.textContent = exp
                        else if (typeof exp === 'object' && exp.type === 'regex') codeE.textContent = `/${exp.expression}/${exp.flags || ''}`
                        else codeE.textContent = JSON.stringify(exp)
                    } catch (_e) { codeE.textContent = String(authorEntry.expected_stdout) }
                    preE.appendChild(codeE)
                    detailsWrap.appendChild(preE)

                    // Don't highlight actual/expected blocks - they should be plain text output
                    // not syntax-highlighted code. Remove hljs call entirely for test output.

                    tr.appendChild(detailsWrap)
                }

                // Show stderr/traceback for failing tests. Always show if there's stderr
                // (runtime errors should always be visible), or if author explicitly
                // requested it via show_stderr/show_traceback config.
                const shouldShowDetails = authorEntry ? !!(authorEntry.show_stderr || authorEntry.show_traceback) : false
                const hasStderrToShow = r.stderr && r.stderr.trim().length > 0

                if (!r.passed && (hasStderrToShow || (shouldShowDetails && (r.stderr || r.reason)))) {
                    const detailsWrap = document.createElement('div')
                    detailsWrap.className = 'feedback-msg'
                    // Reason (short label) if present
                    if (r.reason) {
                        const reasonEl = document.createElement('div')
                        reasonEl.className = 'feedback-reason'
                        reasonEl.textContent = '[' + r.reason + ']'
                        detailsWrap.appendChild(reasonEl)
                    }
                    // Render stderr in a monospace, pre-wrapped block so line breaks
                    // and indentation are preserved and readable on a light background.
                    if (r.stderr) {
                        const stderrEl = document.createElement('div')
                        stderrEl.className = 'test-stderr'
                        stderrEl.style.whiteSpace = 'pre-wrap'
                        stderrEl.style.fontFamily = 'monospace'
                        stderrEl.textContent = r.stderr
                        detailsWrap.appendChild(stderrEl)
                    }
                    tr.appendChild(detailsWrap)
                }

                tr.addEventListener('click', () => {
                    try { window.dispatchEvent(new CustomEvent('ssg:test-click', { detail: r })) } catch (_e) { }
                })

                testsSection.appendChild(tr)
            }
        } else {
            const p = document.createElement('div')
            p.className = 'feedback-msg feedback-msg-hidden'
            p.textContent = '(no test results)'
            testsSection.appendChild(p)
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

            // title row with icon
            const titleRow = document.createElement('div')
            titleRow.className = 'feedback-title-row'

            const icon = document.createElement('span')
            icon.className = 'feedback-icon'
            if (sev === 'hint') {
                icon.textContent = '💡'
            } else if (sev === 'warning') {
                icon.textContent = '⚠️'
            } else if (sev === 'info') {
                icon.textContent = 'ℹ️'
            } else if (sev === 'success') {
                icon.textContent = '😊'
            } else {
                icon.textContent = '•'
            }
            titleRow.appendChild(icon)

            const titleEl = document.createElement('div')
            titleEl.className = 'feedback-title'
            titleEl.textContent = title
            titleRow.appendChild(titleEl)

            wrapper.appendChild(titleRow)

            // If matched, show the message under the title
            if (matched && matched.message) {
                const msg = document.createElement('div')
                msg.className = 'feedback-msg feedback-msg-matched matched-' + sev
                msg.textContent = matched.message
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
            p.textContent = '(no editor feedback)'
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
    renderList()
}

export function setFeedbackMatches(matches) {
    _matches = matches || []
    renderList()
}

export function setTestResults(results) {
    _testResults = Array.isArray(results) ? results : []
    try {
        // Attach metadata from current config.tests to each result for easier rendering
        const cfgTests = Array.isArray((_config && _config.tests) ? _config.tests : []) ? _config.tests : []
        _testResults.forEach(r => {
            try {
                let meta = cfgTests.find(t => String(t.id) === String(r.id)) || null
                if (!meta && r.description) meta = cfgTests.find(t => t && t.description && String(t.description) === String(r.description)) || null
                r.meta = meta
            } catch (_e) { r.meta = null }
        })
        console.debug && console.debug('[feedback-ui] setTestResults', _testResults.length)
    } catch (e) { }
    renderList()
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

function showTestResultsModal(results) {
    if (!results || !Array.isArray(results)) return
    // Build modal
    const modal = createResultsModal()
    const content = modal.querySelector('.test-results-content')
    if (!content) return
    content.innerHTML = ''

    // attach accessibility handlers when showing
    try { if (modal._attachAccessibility) modal._attachAccessibility() } catch (e) { }

    // Map config tests for metadata lookup
    const cfgMap = new Map()
    try {
        if (_config && Array.isArray(_config.tests)) {
            for (const t of _config.tests) cfgMap.set(String(t.id), t)
        }
    } catch (e) { }

    for (const r of results) {
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
        title.textContent = meta.description || r.description || (r.id || '')
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
        // Prefer the explicit expected on the result (res.expected_stdout) then
        // fall back to metadata from the config (meta) or cfgMap.
        // Also respect hide_actual_expected setting per test.
        try {
            let expected = null
            if (typeof r.expected_stdout !== 'undefined' && r.expected_stdout !== null) expected = r.expected_stdout
            else if (meta && typeof meta.expected_stdout !== 'undefined' && meta.expected_stdout !== null) expected = meta.expected_stdout
            else {
                const cfgEntry = cfgMap.get(String(r.id)) || {}
                if (typeof cfgEntry.expected_stdout !== 'undefined' && cfgEntry.expected_stdout !== null) expected = cfgEntry.expected_stdout
            }

            const hideActualExpected = meta && meta.hide_actual_expected
            if (!r.passed && expected != null && !(typeof expected === 'object' && expected.type === 'regex') && !(r.stderr && r.stderr.trim().length > 0) && !hideActualExpected) {
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

                // Don't highlight actual/expected blocks - they should be plain text output

                fb.appendChild(compareWrap)
            }
        } catch (_e) { }

        if (r.passed && meta && meta.pass_feedback) {
            const pf = document.createElement('div')
            pf.className = 'test-pass-feedback'
            pf.textContent = String(meta.pass_feedback)
            pf.style.color = '#0a6'
            fb.appendChild(pf)
        } else if (!r.passed && meta && meta.fail_feedback) {
            const ff = document.createElement('div')
            ff.className = 'test-fail-feedback'
            ff.textContent = String(meta.fail_feedback)
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

            fb.appendChild(detWrap)
        }

        row.appendChild(fb)
        content.appendChild(row)
    }

    // Focus for a11y
    const box = modal.querySelector('.test-results-box')
    if (box) box.focus()
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
    content.innerHTML = ''
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
