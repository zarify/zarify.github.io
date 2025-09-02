// Interactive helpers for authoring feedback entries
// - Renders a small UI above the existing #feedback-editor textarea
// - Allows add/edit/delete/reorder of feedback items
// - Keeps the textarea JSON in sync (so autosave in author-page.js continues to work)

import { openModal as openModalHelper, closeModal as closeModalHelper } from './modals.js'

const VALID_PATTERN_TYPES = ['regex', 'ast']
const VALID_TARGETS = ['code', 'filename', 'stdout', 'stderr', 'stdin']
const VALID_WHEN = ['edit', 'run']
const VALID_SEVERITIES = ['success', 'info', 'warning', 'error']

function $(sel, root = document) { return root.querySelector(sel) }

function genId() {
    return 'fb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
}

function parseFeedbackFromTextarea(ta) {
    if (!ta) return []
    const raw = ta.value || ''
    if (!raw.trim()) return []
    try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed
        // allow old object shape { feedback: [...] }
        if (parsed && Array.isArray(parsed.feedback)) return parsed.feedback
    } catch (e) {
        // invalid JSON - return empty and let UI show error
    }
    return []
}

function writeFeedbackToTextarea(ta, arr) {
    if (!ta) return
    try {
        ta.value = JSON.stringify(arr, null, 2)
        // fire input so author-page autosave picks it up
        ta.dispatchEvent(new Event('input', { bubbles: true }))
    } catch (e) {
        console.error('failed to write feedback json', e)
    }
}

function createCard(item, idx, onEdit, onMoveUp, onMoveDown, onDelete) {
    const div = document.createElement('div')
    div.className = 'feedback-entry'
    const title = document.createElement('div')
    title.className = 'feedback-title-row'
    const h = document.createElement('div')
    h.className = 'feedback-title'
    h.textContent = item.title || ('(untitled)')
    const meta = document.createElement('div')
    meta.style.marginLeft = 'auto'
    meta.style.fontSize = '0.85em'
    meta.style.color = '#666'
    meta.textContent = (item.when || []).join(', ') + ' • ' + (item.pattern ? (item.pattern.type + ':' + (item.pattern.target || '')) : '')
    title.appendChild(h)
    title.appendChild(meta)

    const msg = document.createElement('div')
    msg.className = 'feedback-msg'
    msg.textContent = item.message || ''

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

    div.appendChild(title)
    div.appendChild(msg)
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

    // helper: create a labeled row. Optional helpText will render a small
    // info icon with a hover tooltip next to the label to avoid taking extra
    // screen space.
    // helper: create a labeled row. Optional helpText will render a small
    // info icon with a hover tooltip next to the label to avoid taking extra
    // screen space. Pass inline=true to lay the input element on the same
    // horizontal line as the label (useful for compact checkboxes).
    function labeled(labelText, el, helpText, inline = false) {
        const wr = document.createElement('div')
        wr.style.marginBottom = '8px'
        if (inline) {
            wr.style.display = 'flex'
            wr.style.alignItems = 'center'
            wr.style.gap = '12px'
        }
        const l = document.createElement('div')
        l.style.fontSize = '0.9em'
        l.style.marginBottom = inline ? '0' : '4px'
        l.style.display = 'flex'
        l.style.alignItems = 'center'
        l.style.gap = '8px'
        const txt = document.createElement('span')
        txt.textContent = labelText
        l.appendChild(txt)
        if (helpText) {
            const info = document.createElement('span')
            info.className = 'info-icon'
            info.setAttribute('tabindex', '0')
            info.setAttribute('role', 'img')
            info.setAttribute('aria-label', labelText + ' help')
            info.innerHTML = '<span class="info-symbol">ℹ</span>'
            const tip = document.createElement('span')
            tip.className = 'info-tooltip'
            tip.textContent = helpText
            info.appendChild(tip)
            l.appendChild(info)
        }
        wr.appendChild(l)
        wr.appendChild(el)
        return wr
    }

    const title = document.createElement('input')
    title.style.width = '100%'
    title.value = existing.title || ''

    const idIn = document.createElement('input')
    idIn.style.width = '100%'
    idIn.value = existing.id || ''

    const whenWrap = document.createElement('div')
    VALID_WHEN.forEach(w => {
        const cb = document.createElement('label')
        cb.style.marginRight = '8px'
        const inp = document.createElement('input')
        inp.type = 'checkbox'
        inp.value = w
        inp.checked = (existing.when || []).includes(w)
        cb.appendChild(inp)
        cb.appendChild(document.createTextNode(' ' + w))
        whenWrap.appendChild(cb)
    })

    const patternType = document.createElement('select')
    VALID_PATTERN_TYPES.forEach(t => {
        const o = document.createElement('option')
        o.value = t; o.textContent = t; patternType.appendChild(o)
    })
    patternType.value = (existing.pattern && existing.pattern.type) || 'regex'

    const targetSel = document.createElement('select')
    VALID_TARGETS.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; targetSel.appendChild(o) })
    targetSel.value = (existing.pattern && existing.pattern.target) || 'code'

    const fileTargetIn = document.createElement('input')
    fileTargetIn.type = 'text'
    fileTargetIn.style.width = '180px'
    // keep legacy values without leading slash but UI shows simple filename
    fileTargetIn.value = (existing.pattern && existing.pattern.fileTarget) || 'main.py'

    const expr = document.createElement('input')
    expr.type = 'text'
    expr.style.width = '100%'
    expr.value = (existing.pattern && existing.pattern.expression) || ''

    const flags = document.createElement('input')
    flags.type = 'text'
    flags.style.width = '100%'
    flags.placeholder = 'e.g. i'
    flags.value = (existing.pattern && existing.pattern.flags) || ''

    const message = document.createElement('textarea')
    message.style.width = '100%'
    message.rows = 3
    message.value = existing.message || ''

    const severity = document.createElement('select')
    VALID_SEVERITIES.forEach(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; severity.appendChild(o) })
    severity.value = existing.severity || 'info'

    const visible = document.createElement('input')
    visible.type = 'checkbox'
    visible.checked = typeof existing.visibleByDefault === 'boolean' ? existing.visibleByDefault : true

    root.appendChild(labeled('Title', title, 'Short title shown in the feedback list.'))
    root.appendChild(labeled('ID [optional]', idIn, 'Optional stable id. Generated automatically if left empty.'))
    // place the 'When' checkboxes and the visible toggle inline on one row
    const whenRow = document.createElement('div')
    whenRow.style.display = 'inline-flex'
    whenRow.style.alignItems = 'center'
    whenRow.style.gap = '12px'
    whenRow.appendChild(whenWrap)
    // create an inline label for the visible checkbox so it sits next to When
    const visibleLabel = document.createElement('label')
    visibleLabel.style.display = 'inline-flex'
    visibleLabel.style.alignItems = 'center'
    visibleLabel.style.gap = '6px'
    visibleLabel.style.fontSize = '0.95em'
    visibleLabel.appendChild(visible)
    visibleLabel.appendChild(document.createTextNode('Visible by default'))
    whenRow.appendChild(visibleLabel)
    root.appendChild(labeled('When', whenRow, 'Choose when this feedback applies: edit (while editing) or run (at runtime).', true))
    root.appendChild(labeled('Pattern type', patternType, 'Type of pattern matcher. "regex" matches text; "ast" uses the parsed code structure (advanced).'))
    root.appendChild(labeled('Pattern target', targetSel, 'Which program area to match: source code, filename, stdout/stderr, or stdin.'))
    root.appendChild(labeled('File target', fileTargetIn, 'Filename to apply code/AST checks against (e.g. main.py). Defaults to main.py.'))
    root.appendChild(labeled('Expression', expr, 'The match expression. For regex, enter the pattern without delimiters.'))
    root.appendChild(labeled('Flags [optional]', flags, 'Optional regex flags (e.g. "i" for case-insensitive).'))
    root.appendChild(labeled('Message', message, 'Message shown to the author when the feedback triggers. Use plain text or simple markdown.'))
    root.appendChild(labeled('Style', severity, 'The visual style for the feedback: info, warning, or error.'))

    return {
        root,
        get() {
            const when = []
            Array.from(whenWrap.querySelectorAll('input[type=checkbox]')).forEach(cb => { if (cb.checked) when.push(cb.value) })
            return {
                id: idIn.value || undefined,
                title: title.value || '',
                when: when.length ? when : ['edit'],
                pattern: { type: patternType.value || 'regex', target: targetSel.value || 'code', fileTarget: fileTargetIn.value || 'main.py', expression: expr.value || '', flags: flags.value || '' },
                message: message.value || '',
                severity: severity.value || 'success',
                visibleByDefault: !!visible.checked
            }
        }
    }
}

export function initAuthorFeedback() {
    const ta = document.getElementById('feedback-editor')
    if (!ta) return

    // container: insert UI above the textarea
    const container = document.createElement('div')
    container.id = 'author-feedback-ui'
    container.style.marginBottom = '8px'

    const addBtn = document.createElement('button')
    addBtn.className = 'btn'
    addBtn.textContent = 'Add feedback'
    addBtn.style.marginBottom = '8px'

    const list = document.createElement('div')
    list.id = 'author-feedback-list'
    list.style.display = 'flex'
    list.style.flexDirection = 'column'
    list.style.gap = '8px'

    container.appendChild(addBtn)
    container.appendChild(list)

    // Insert UI and replace visible textarea with a read-only JSON view.
    ta.parentNode.insertBefore(container, ta)
    // hide the textarea (keep it in DOM so author-page buildCurrentConfig still reads its value)
    ta.style.display = 'none'
    ta.readOnly = true

    const jsonView = document.createElement('pre')
    jsonView.id = 'feedback-json-view'
    jsonView.style.background = '#fff'
    jsonView.style.border = '1px solid #eee'
    jsonView.style.padding = '8px'
    jsonView.style.borderRadius = '6px'
    jsonView.style.maxHeight = '260px'
    jsonView.style.overflow = 'auto'
    jsonView.style.whiteSpace = 'pre-wrap'
    container.appendChild(jsonView)

    let items = parseFeedbackFromTextarea(ta)

    function render() {
        list.innerHTML = ''
        items.forEach((it, idx) => {
            const card = createCard(it, idx, (i) => openModalEdit(i), (i) => moveUp(i), (i) => moveDown(i), (i) => deleteItem(i))
            // make draggable
            card.draggable = true
            card.dataset.index = String(idx)
            card.addEventListener('dragstart', (ev) => {
                ev.dataTransfer.setData('text/plain', String(idx))
                try { ev.dataTransfer.effectAllowed = 'move' } catch (_e) { }
                card.classList.add('dragging')
            })
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
                // move item from -> to (insert before 'to')
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
        writeFeedbackToTextarea(ta, items)
        // update read-only view and re-render list
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
        // header (title). Save/Cancel will be injected into header per-edit
        const header = document.createElement('div')
        header.className = 'modal-header'
        const h3 = document.createElement('h3')
        h3.textContent = 'Edit feedback'
        // placeholder for actions
        const actionHolder = document.createElement('div')
        actionHolder.className = 'modal-header-actions'
        header.appendChild(h3)
        header.appendChild(actionHolder)
        content.appendChild(header)
        const body = document.createElement('div')
        body.id = 'author-feedback-modal-body'
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
        const body = m.querySelector('#author-feedback-modal-body')
        body.innerHTML = ''
        body.appendChild(editor.root)
        // inject Save/Cancel into modal header actions so they're always visible
        const actionHolder = m.querySelector('.modal-header-actions')
        actionHolder.innerHTML = ''
        actionHolder.appendChild(save)
        actionHolder.appendChild(cancel)

        // show modal (use shared helper so Escape closes it and focus is trapped)
        try { openModalHelper(m) } catch (_e) {
            m.setAttribute('aria-hidden', 'false')
            m.style.display = 'flex'
        }

        function validateAndSave() {
            const val = editor.get()
            if (val.pattern && val.pattern.type === 'regex') {
                try {
                    new RegExp(val.pattern.expression || '', val.pattern.flags || '')
                    err.textContent = ''
                } catch (e) {
                    err.textContent = 'Invalid regular expression: ' + (e && e.message ? e.message : e)
                    return
                }
            }
            if (!val.id) val.id = genId()
            items[idx] = val
            persist()
            try { closeModalHelper(m) } catch (_e) { closeModal() }
        }
        save.addEventListener('click', validateAndSave)
        cancel.addEventListener('click', () => { try { closeModalHelper(m) } catch (_e) { closeModal() } })
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
        const body = m.querySelector('#author-feedback-modal-body')
        body.innerHTML = ''
        body.appendChild(editor.root)
        // inject Save/Cancel into modal header actions so they're always visible
        const actionHolder = m.querySelector('.modal-header-actions')
        actionHolder.innerHTML = ''
        actionHolder.appendChild(save)
        actionHolder.appendChild(cancel)

        // show modal (use shared helper so Escape closes it and focus is trapped)
        try { openModalHelper(m) } catch (_e) {
            m.setAttribute('aria-hidden', 'false')
            m.style.display = 'flex'
        }

        function validateAndSave() {
            const val = editor.get()
            if (val.pattern && val.pattern.type === 'regex') {
                try {
                    new RegExp(val.pattern.expression || '', val.pattern.flags || '')
                    err.textContent = ''
                } catch (e) {
                    err.textContent = 'Invalid regular expression: ' + (e && e.message ? e.message : e)
                    return
                }
            }
            if (!val.id) val.id = genId()
            // Only add to items array when save is clicked
            items.push(val)
            persist()
            try { closeModalHelper(m) } catch (_e) { closeModal() }
        }
        save.addEventListener('click', validateAndSave)
        // Cancel just closes modal without adding item
        cancel.addEventListener('click', () => { try { closeModalHelper(m) } catch (_e) { closeModal() } })
    }

    function closeModal() {
        if (!modal) return
        try { closeModalHelper(modal) } catch (_e) {
            modal.setAttribute('aria-hidden', 'true')
            modal.style.display = 'none'
        }
    }

    function moveUp(idx) {
        if (idx <= 0) return
        const a = items.slice();[a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; items = a; persist()
    }
    function moveDown(idx) {
        if (idx >= items.length - 1) return
        const a = items.slice();[a[idx + 1], a[idx]] = [a[idx], a[idx + 1]]; items = a; persist()
    }
    function deleteItem(idx) {
        if (!confirm('Delete feedback item "' + (items[idx] && items[idx].title) + '"?')) return
        items.splice(idx, 1); persist()
    }

    addBtn.addEventListener('click', () => {
        const newItem = { id: genId(), title: 'New feedback', when: ['edit'], pattern: { type: 'regex', target: 'code', expression: '' }, message: '', severity: 'info', visibleByDefault: true }
        // open editor for the new item without adding it to the array yet
        openModalEditNew(newItem)
    })

    // keep in sync if textarea changes programmatically
    ta.addEventListener('input', () => { items = parseFeedbackFromTextarea(ta); try { jsonView.textContent = JSON.stringify(items, null, 2) } catch (_e) { jsonView.textContent = '' }; render() })
    // initial render and populate read-only view
    try { jsonView.textContent = JSON.stringify(items, null, 2) } catch (_e) { jsonView.textContent = '' }
    render()
}

export default { initAuthorFeedback }
