// Interactive helpers for authoring test entries
// - Renders a small UI above the existing #tests-editor textarea
// - Allows add/edit/delete/reorder of tests
// - Keeps the textarea JSON in sync (so autosave in author-page.js continues to work)

import { openModal as openModalHelper, closeModal as closeModalHelper } from './modals.js'

function $(sel, root = document) { return root.querySelector(sel) }

function genId() { return 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7) }

function parseTestsFromTextarea(ta) {
    if (!ta) return []
    const raw = ta.value || ''
    if (!raw.trim()) return []
    try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed
        if (parsed && Array.isArray(parsed.tests)) return parsed.tests
    } catch (e) {
        // invalid JSON - return empty and let UI show error
    }
    return []
}

function writeTestsToTextarea(ta, arr) {
    if (!ta) return
    try {
        ta.value = JSON.stringify(arr, null, 2)
        ta.dispatchEvent(new Event('input', { bubbles: true }))
    } catch (e) {
        console.error('failed to write tests json', e)
    }
}

function createCard(item, idx, onEdit, onMoveUp, onMoveDown, onDelete) {
    const div = document.createElement('div')
    div.className = 'feedback-entry' // reuse styling
    const titleRow = document.createElement('div')
    titleRow.className = 'feedback-title-row'
    const h = document.createElement('div')
    h.className = 'feedback-title'
    h.textContent = item.description || item.name || ('Test ' + (idx + 1))
    const meta = document.createElement('div')
    meta.style.marginLeft = 'auto'
    meta.style.fontSize = '0.85em'
    meta.style.color = '#666'
    meta.textContent = item.id || ''
    titleRow.appendChild(h)
    titleRow.appendChild(meta)

    const body = document.createElement('div')
    body.className = 'feedback-msg'
    // Render expected_stdout/stderr safely: if it's an object (regex), show /expr/flags
    function renderExpected(v) {
        if (v == null) return ''
        if (typeof v === 'string') return v
        try {
            if (typeof v === 'object' && v.type === 'regex') return `/${v.expression}/${v.flags || ''}`
        } catch (_e) { }
        try { return JSON.stringify(v) } catch (_e) { return String(v) }
    }
    body.textContent = 'stdin: ' + (item.stdin || '') + '  •  expected_stdout: ' + renderExpected(item.expected_stdout)
    if (item.hide_actual_expected) {
        body.textContent += '  •  [hide actual/expected]'
    }

    const actions = document.createElement('div')
    actions.style.display = 'flex'
    actions.style.gap = '8px'
    const editBtn = document.createElement('button')
    editBtn.className = 'btn'
    editBtn.textContent = 'Edit'
    editBtn.addEventListener('click', () => onEdit(idx))
    const upBtn = document.createElement('button')
    upBtn.className = 'btn'
    upBtn.textContent = '↑'
    upBtn.title = 'Move up'
    upBtn.addEventListener('click', () => onMoveUp(idx))
    const downBtn = document.createElement('button')
    downBtn.className = 'btn'
    downBtn.textContent = '↓'
    downBtn.title = 'Move down'
    downBtn.addEventListener('click', () => onMoveDown(idx))
    const delBtn = document.createElement('button')
    delBtn.className = 'btn btn-danger'
    delBtn.textContent = 'Delete'
    delBtn.addEventListener('click', () => onDelete(idx))
    actions.appendChild(editBtn)
    actions.appendChild(upBtn)
    actions.appendChild(downBtn)
    actions.appendChild(delBtn)

    div.appendChild(titleRow)
    div.appendChild(body)
    const footer = document.createElement('div')
    footer.style.marginTop = '8px'
    footer.appendChild(actions)
    div.appendChild(footer)
    return div
}

function buildEditorForm(existing) {
    const root = document.createElement('div')
    root.style.border = '1px solid #eee'
    root.style.padding = '8px'
    root.style.borderRadius = '6px'
    root.style.background = '#fbfdff'

    function labeled(labelText, el) {
        const wr = document.createElement('div')
        wr.style.marginBottom = '8px'
        const l = document.createElement('div')
        l.style.fontSize = '0.9em'
        l.style.marginBottom = '4px'
        l.textContent = labelText
        wr.appendChild(l)
        wr.appendChild(el)
        return wr
    }

    const idIn = document.createElement('input')
    idIn.style.width = '100%'
    idIn.value = existing.id || ''

    const desc = document.createElement('input')
    desc.style.width = '100%'
    desc.value = existing.description || existing.name || ''

    const stdin = document.createElement('textarea')
    stdin.style.width = '100%'
    stdin.rows = 3
    stdin.value = existing.stdin || ''

    // Expected stdout editor: allow String or Regex modes
    const expectedOutMode = document.createElement('select')
    const optS = document.createElement('option'); optS.value = 'string'; optS.textContent = 'String'
    const optR = document.createElement('option'); optR.value = 'regex'; optR.textContent = 'Regex'
    expectedOutMode.appendChild(optS); expectedOutMode.appendChild(optR)

    const expectedOutText = document.createElement('textarea')
    expectedOutText.style.width = '100%'
    expectedOutText.rows = 3

    const expectedOutExpr = document.createElement('input')
    expectedOutExpr.type = 'text'
    expectedOutExpr.style.width = '100%'
    expectedOutExpr.placeholder = 'regex expression (no slashes)'

    const expectedOutFlags = document.createElement('input')
    expectedOutFlags.type = 'text'
    expectedOutFlags.style.width = '100%'
    expectedOutFlags.placeholder = 'flags (e.g. i)'

    // Expected stderr editor
    const expectedErrMode = document.createElement('select')
    const eOptS = document.createElement('option'); eOptS.value = 'string'; eOptS.textContent = 'String'
    const eOptR = document.createElement('option'); eOptR.value = 'regex'; eOptR.textContent = 'Regex'
    expectedErrMode.appendChild(eOptS); expectedErrMode.appendChild(eOptR)

    const expectedErrText = document.createElement('textarea')
    expectedErrText.style.width = '100%'
    expectedErrText.rows = 3

    const expectedErrExpr = document.createElement('input')
    expectedErrExpr.type = 'text'
    expectedErrExpr.style.width = '100%'
    expectedErrExpr.placeholder = 'regex expression (no slashes)'

    const expectedErrFlags = document.createElement('input')
    expectedErrFlags.type = 'text'
    expectedErrFlags.style.width = '100%'
    expectedErrFlags.placeholder = 'flags (e.g. i)'
    // timeout input
    const timeout = document.createElement('input')
    timeout.type = 'number'
    timeout.style.width = '120px'
    timeout.value = typeof existing.timeoutMs === 'number' ? String(existing.timeoutMs) : ''

    const setup = document.createElement('textarea')
    setup.style.width = '100%'
    setup.rows = 3
    setup.value = existing.setup ? JSON.stringify(existing.setup, null, 2) : ''

    // Hide actual/expected checkbox
    const hideActualExpected = document.createElement('input')
    hideActualExpected.type = 'checkbox'
    hideActualExpected.checked = !!existing.hide_actual_expected
    const hideActualExpectedWrap = document.createElement('div')
    hideActualExpectedWrap.style.display = 'flex'
    hideActualExpectedWrap.style.alignItems = 'center'
    hideActualExpectedWrap.style.gap = '8px'
    hideActualExpectedWrap.appendChild(hideActualExpected)
    const hideActualExpectedLabel = document.createElement('span')
    hideActualExpectedLabel.textContent = 'Hide actual vs expected output (show only pass/fail status)'
    hideActualExpectedWrap.appendChild(hideActualExpectedLabel)

    root.appendChild(labeled('ID [optional]', idIn))
    root.appendChild(labeled('Description', desc))
    root.appendChild(labeled('Stdin', stdin))
    // Expected stdout inputs
    const outWrap = document.createElement('div')
    outWrap.appendChild(expectedOutMode)
    outWrap.appendChild(expectedOutText)
    outWrap.appendChild(expectedOutExpr)
    outWrap.appendChild(expectedOutFlags)
    root.appendChild(labeled('Expected stdout', outWrap))
    // Expected stderr inputs
    const errWrap = document.createElement('div')
    errWrap.appendChild(expectedErrMode)
    errWrap.appendChild(expectedErrText)
    errWrap.appendChild(expectedErrExpr)
    errWrap.appendChild(expectedErrFlags)
    root.appendChild(labeled('Expected stderr', errWrap))
    // initialize modes/values based on existing data shape
    try {
        if (existing.expected_stdout && typeof existing.expected_stdout === 'object' && existing.expected_stdout.type === 'regex') {
            expectedOutMode.value = 'regex'
            expectedOutExpr.value = existing.expected_stdout.expression || ''
            expectedOutFlags.value = existing.expected_stdout.flags || ''
            expectedOutText.style.display = 'none'
        } else {
            expectedOutMode.value = 'string'
            expectedOutText.value = existing.expected_stdout || ''
            expectedOutExpr.style.display = 'none'
            expectedOutFlags.style.display = 'none'
        }
    } catch (_e) {
        expectedOutMode.value = 'string'
        expectedOutText.value = existing.expected_stdout || ''
        expectedOutExpr.style.display = 'none'
        expectedOutFlags.style.display = 'none'
    }

    try {
        if (existing.expected_stderr && typeof existing.expected_stderr === 'object' && existing.expected_stderr.type === 'regex') {
            expectedErrMode.value = 'regex'
            expectedErrExpr.value = existing.expected_stderr.expression || ''
            expectedErrFlags.value = existing.expected_stderr.flags || ''
            expectedErrText.style.display = 'none'
        } else {
            expectedErrMode.value = 'string'
            expectedErrText.value = existing.expected_stderr || ''
            expectedErrExpr.style.display = 'none'
            expectedErrFlags.style.display = 'none'
        }
    } catch (_e) {
        expectedErrMode.value = 'string'
        expectedErrText.value = existing.expected_stderr || ''
        expectedErrExpr.style.display = 'none'
        expectedErrFlags.style.display = 'none'
    }

    // Toggle visibility when mode changes
    expectedOutMode.addEventListener('change', () => {
        if (expectedOutMode.value === 'regex') {
            expectedOutText.style.display = 'none'
            expectedOutExpr.style.display = ''
            expectedOutFlags.style.display = ''
        } else {
            expectedOutText.style.display = ''
            expectedOutExpr.style.display = 'none'
            expectedOutFlags.style.display = 'none'
        }
    })
    expectedErrMode.addEventListener('change', () => {
        if (expectedErrMode.value === 'regex') {
            expectedErrText.style.display = 'none'
            expectedErrExpr.style.display = ''
            expectedErrFlags.style.display = ''
        } else {
            expectedErrText.style.display = ''
            expectedErrExpr.style.display = 'none'
            expectedErrFlags.style.display = 'none'
        }
    })

    root.appendChild(labeled('Timeout (ms) [optional]', timeout))
    root.appendChild(labeled('Setup (JSON) [optional]', setup))
    root.appendChild(labeled('Display options', hideActualExpectedWrap))

    return {
        root,
        get() {
            let setupVal = null
            try { setupVal = setup.value ? JSON.parse(setup.value) : null } catch (_e) { setupVal = setup.value || null }
            // expected stdout: respect selected mode (string or regex)
            let expectedOutVal = undefined
            if (typeof expectedOutMode !== 'undefined' && expectedOutMode.value === 'regex') {
                const expr = (expectedOutExpr.value || '').trim()
                const flagsV = (expectedOutFlags.value || '').trim()
                if (expr !== '') expectedOutVal = { type: 'regex', expression: expr, flags: flagsV || '' }
            } else {
                const v = (expectedOutText.value || '').trim()
                expectedOutVal = v === '' ? undefined : v
            }

            // expected stderr: respect selected mode
            let expectedErrVal = undefined
            if (typeof expectedErrMode !== 'undefined' && expectedErrMode.value === 'regex') {
                const expr = (expectedErrExpr.value || '').trim()
                const flagsV = (expectedErrFlags.value || '').trim()
                if (expr !== '') expectedErrVal = { type: 'regex', expression: expr, flags: flagsV || '' }
            } else {
                const v = (expectedErrText.value || '').trim()
                expectedErrVal = v === '' ? undefined : v
            }

            const out = {
                // only include fields that have meaningful values so the saved
                // test objects match the canonical sample config shape
            }
            if (idIn.value) out.id = idIn.value
            out.description = desc.value || ''
            if (stdin.value && stdin.value.trim() !== '') out.stdin = stdin.value
            if (expectedOutVal !== undefined) out.expected_stdout = expectedOutVal
            if (expectedErrVal !== undefined) out.expected_stderr = expectedErrVal
            if (timeout.value) out.timeoutMs = Number(timeout.value)
            if (setupVal !== null && setupVal !== undefined && setupVal !== '') out.setup = setupVal
            if (hideActualExpected.checked) out.hide_actual_expected = true
            return out
        }
    }
}

export function initAuthorTests() {
    const ta = document.getElementById('tests-editor')
    if (!ta) return

    const container = document.createElement('div')
    container.id = 'author-tests-ui'
    container.style.marginBottom = '8px'

    const addBtn = document.createElement('button')
    addBtn.className = 'btn'
    addBtn.textContent = 'Add test'
    addBtn.style.marginBottom = '8px'

    const list = document.createElement('div')
    list.id = 'author-tests-list'
    list.style.display = 'flex'
    list.style.flexDirection = 'column'
    list.style.gap = '8px'

    container.appendChild(addBtn)
    container.appendChild(list)

    ta.parentNode.insertBefore(container, ta)
    ta.style.display = 'none'
    ta.readOnly = true

    const jsonView = document.createElement('pre')
    jsonView.id = 'tests-json-view'
    jsonView.style.background = '#fff'
    jsonView.style.border = '1px solid #eee'
    jsonView.style.padding = '8px'
    jsonView.style.borderRadius = '6px'
    jsonView.style.maxHeight = '260px'
    jsonView.style.overflow = 'auto'
    jsonView.style.whiteSpace = 'pre-wrap'
    container.appendChild(jsonView)

    let items = parseTestsFromTextarea(ta)

    function render() {
        list.innerHTML = ''
        items.forEach((it, idx) => {
            const card = createCard(it, idx, (i) => openModalEdit(i), (i) => moveUp(i), (i) => moveDown(i), (i) => deleteItem(i))
            card.draggable = true
            card.dataset.index = String(idx)
            card.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/plain', String(idx)); try { ev.dataTransfer.effectAllowed = 'move' } catch (_e) { }; card.classList.add('dragging') })
            card.addEventListener('dragend', () => { card.classList.remove('dragging') })
            card.addEventListener('dragover', (ev) => { ev.preventDefault(); card.classList.add('drag-over') })
            card.addEventListener('dragleave', () => { card.classList.remove('drag-over') })
            card.addEventListener('drop', (ev) => {
                ev.preventDefault()
                card.classList.remove('drag-over')
                const from = Number(ev.dataTransfer.getData('text/plain'))
                const to = Number(card.dataset.index)
                if (!Number.isFinite(from) || !Number.isFinite(to)) return
                if (from === to) return
                const a = items.slice()
                const [m] = a.splice(from, 1)
                a.splice(to, 0, m)
                items = a
                persist()
            })
            list.appendChild(card)
        })
    }

    function persist() {
        writeTestsToTextarea(ta, items)
        try { jsonView.textContent = JSON.stringify(items, null, 2) } catch (_e) { jsonView.textContent = '' }
        render()
    }

    // Modal editor
    let modal = null
    function ensureModal() {
        if (modal) return modal
        modal = document.createElement('div')
        modal.className = 'modal'
        modal.setAttribute('aria-hidden', 'true')
        const content = document.createElement('div')
        content.className = 'modal-content'
        const header = document.createElement('div')
        header.className = 'modal-header'
        const h3 = document.createElement('h3')
        h3.textContent = 'Edit test'
        const actionHolder = document.createElement('div')
        actionHolder.className = 'modal-header-actions'
        header.appendChild(h3)
        header.appendChild(actionHolder)
        content.appendChild(header)
        const body = document.createElement('div')
        body.id = 'author-tests-modal-body'
        content.appendChild(body)
        modal.appendChild(content)
        document.body.appendChild(modal)
        return modal
    }

    function openModalEdit(idx) {
        const existing = Object.assign({}, items[idx])
        const editor = buildEditorForm(existing)
        const err = document.createElement('div')
        err.style.color = '#b00020'
        err.style.marginTop = '6px'
        editor.root.appendChild(err)
        const actions = document.createElement('div')
        actions.style.marginTop = '8px'
        const save = document.createElement('button')
        save.className = 'btn btn-primary'
        save.textContent = 'Save'
        const cancel = document.createElement('button')
        cancel.className = 'btn'
        cancel.textContent = 'Cancel'
        actions.appendChild(save)
        actions.appendChild(cancel)
        editor.root.appendChild(actions)

        const m = ensureModal()
        const body = m.querySelector('#author-tests-modal-body')
        body.innerHTML = ''
        body.appendChild(editor.root)
        const actionHolder = m.querySelector('.modal-header-actions')
        actionHolder.innerHTML = ''
        actionHolder.appendChild(save)
        actionHolder.appendChild(cancel)
        try { openModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'false'); m.style.display = 'flex' }

        function validateAndSave() {
            const val = editor.get()
            if (!val.id) val.id = genId()
            items[idx] = val
            persist()
            try { closeModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'true'); m.style.display = 'none' }
        }
        save.addEventListener('click', validateAndSave)
        cancel.addEventListener('click', () => { try { closeModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'true'); m.style.display = 'none' } })
    }

    function openModalEditNew(newItem) {
        const editor = buildEditorForm(newItem)
        const err = document.createElement('div')
        err.style.color = '#b00020'
        err.style.marginTop = '6px'
        editor.root.appendChild(err)
        const actions = document.createElement('div')
        actions.style.marginTop = '8px'
        const save = document.createElement('button')
        save.className = 'btn btn-primary'
        save.textContent = 'Save'
        const cancel = document.createElement('button')
        cancel.className = 'btn'
        cancel.textContent = 'Cancel'
        actions.appendChild(save)
        actions.appendChild(cancel)
        editor.root.appendChild(actions)

        const m = ensureModal()
        const body = m.querySelector('#author-tests-modal-body')
        body.innerHTML = ''
        body.appendChild(editor.root)
        const actionHolder = m.querySelector('.modal-header-actions')
        actionHolder.innerHTML = ''
        actionHolder.appendChild(save)
        actionHolder.appendChild(cancel)
        try { openModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'false'); m.style.display = 'flex' }

        function validateAndSave() {
            const val = editor.get()
            if (!val.id) val.id = genId()
            // Only add to items array when save is clicked
            items.push(val)
            persist()
            try { closeModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'true'); m.style.display = 'none' }
        }
        save.addEventListener('click', validateAndSave)
        // Cancel just closes modal without adding item
        cancel.addEventListener('click', () => { try { closeModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'true'); m.style.display = 'none' } })
    }

    function closeModal() { if (!modal) return; try { closeModalHelper(modal) } catch (_e) { modal.setAttribute('aria-hidden', 'true'); modal.style.display = 'none' } }

    function moveUp(idx) { if (idx <= 0) return; const a = items.slice();[a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; items = a; persist() }
    function moveDown(idx) { if (idx >= items.length - 1) return; const a = items.slice();[a[idx + 1], a[idx]] = [a[idx], a[idx + 1]]; items = a; persist() }
    function deleteItem(idx) { if (!confirm('Delete test "' + (items[idx] && (items[idx].description || items[idx].id)) + '"?')) return; items.splice(idx, 1); persist() }

    addBtn.addEventListener('click', () => {
        const newItem = { id: genId(), description: 'New test', stdin: '', expected_stdout: '', expected_stderr: '', timeoutMs: undefined, hide_actual_expected: false }
        // open editor for the new item without adding it to the array yet
        openModalEditNew(newItem)
    })

    ta.addEventListener('input', () => { items = parseTestsFromTextarea(ta); try { jsonView.textContent = JSON.stringify(items, null, 2) } catch (_e) { jsonView.textContent = '' }; render() })
    try { jsonView.textContent = JSON.stringify(items, null, 2) } catch (_e) { jsonView.textContent = '' }
    render()
}

export default { initAuthorTests }
