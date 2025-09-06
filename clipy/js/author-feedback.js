// Interactive helpers for authoring feedback entries
// - Renders a small UI above the existing #feedback-editor textarea
// - Allows add/edit/delete/reorder of feedback items
// - Keeps the textarea JSON in sync (so autosave in author-page.js continues to work)

import { openModal as openModalHelper, closeModal as closeModalHelper } from './modals.js'
import { warn as logWarn, error as logError } from './logger.js'
import { createASTRuleBuilder, createDefaultASTFeedback } from './ast-rule-builder.js'

const VALID_PATTERN_TYPES = ['string', 'regex', 'ast']
const VALID_TARGETS = ['code', 'filename', 'stdout', 'stderr', 'stdin']
const VALID_WHEN = ['edit', 'run']
const VALID_SEVERITIES = ['success', 'info', 'warning', 'error']

// Target restrictions based on when the feedback runs
const EDIT_TARGETS = ['code', 'filename']
const RUN_TARGETS = ['stdin', 'stdout', 'stderr', 'filename']

function $(sel, root = document) { return root.querySelector(sel) }

function genId() {
    return 'fb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
}

function getValidTargetsForWhen(whenValues) {
    const hasEdit = whenValues.includes('edit')
    const hasRun = whenValues.includes('run')

    if (hasEdit) {
        return EDIT_TARGETS
    } else if (hasRun) {
        return RUN_TARGETS
    } else {
        // No when selected, default to run targets
        return RUN_TARGETS
    }
}

function updateTargetOptions(targetSel, whenRadios, currentValue) {
    const whenValues = Array.from(whenRadios)
        .filter(radio => radio.checked)
        .map(radio => radio.value)

    const validTargets = getValidTargetsForWhen(whenValues)

    // Clear existing options
    targetSel.innerHTML = ''

    // Add valid options
    validTargets.forEach(t => {
        const o = document.createElement('option')
        o.value = t
        o.textContent = t
        targetSel.appendChild(o)
    })

    // Set value if it's still valid, otherwise use first valid option
    if (validTargets.includes(currentValue)) {
        targetSel.value = currentValue
    } else if (validTargets.length > 0) {
        targetSel.value = validTargets[0]
    }
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
        logError('failed to write feedback json', e)
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
    const whenCheckboxes = []
    const radioGroupName = 'when-' + Date.now() // Unique name for this modal instance
    VALID_WHEN.forEach(w => {
        const cb = document.createElement('label')
        cb.style.marginRight = '8px'
        const inp = document.createElement('input')
        inp.type = 'radio'
        inp.name = radioGroupName
        inp.value = w
        // Check if this value should be selected (default to 'run' if none specified)
        const currentWhen = existing.when || ['run']
        // If existing config has both edit and run (from old checkbox system), prefer run
        if (currentWhen.includes('run')) {
            inp.checked = (w === 'run')
        } else if (currentWhen.includes('edit')) {
            inp.checked = (w === 'edit')
        } else {
            inp.checked = (w === 'run') // Default to run
        }
        whenCheckboxes.push(inp)
        cb.appendChild(inp)
        cb.appendChild(document.createTextNode(' ' + w))
        whenWrap.appendChild(cb)
    })

    const patternType = document.createElement('select')
    VALID_PATTERN_TYPES.forEach(t => {
        const o = document.createElement('option')
        o.value = t; o.textContent = t; patternType.appendChild(o)
    })
    patternType.value = (existing.pattern && existing.pattern.type) || 'string'

    const targetSel = document.createElement('select')
    const initialTarget = (existing.pattern && existing.pattern.target) || 'stdout' // Default to stdout for run-time feedback
    // Initialize with filtered options based on current when selection
    updateTargetOptions(targetSel, whenCheckboxes, initialTarget)

    // Add event listeners to update target options when "when" radio buttons change
    whenCheckboxes.forEach(radio => {
        radio.addEventListener('change', () => {
            updateTargetOptions(targetSel, whenCheckboxes, targetSel.value)
        })
    })

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

    // Create AST rule builder
    const astRuleBuilder = createASTRuleBuilder(existing.pattern || {}, 'feedback')
    const astBuilder = astRuleBuilder.root

    const exprRow = labeled('Expression', expr, 'Text to search for (string) or regex pattern to match (regex).')
    const flagsRow = labeled('Flags [optional]', flags, 'Optional regex flags (e.g. "i" for case-insensitive). Only used for regex patterns.')

    // Function to update field visibility and labels based on pattern type
    function updatePatternFields() {
        const isString = patternType.value === 'string'
        const isRegex = patternType.value === 'regex'
        const isAST = patternType.value === 'ast'

        if (isString) {
            // For string patterns, show simpler field labels and hide flags
            const exprLabel = exprRow.querySelector('div')
            if (exprLabel) {
                const labelSpan = exprLabel.querySelector('span')
                if (labelSpan) labelSpan.textContent = 'Text'
                const helpIcon = exprLabel.querySelector('.info-tooltip')
                if (helpIcon) helpIcon.textContent = 'Enter the exact text to search for (case-sensitive).'
            }
            flagsRow.style.display = 'none'
            astBuilder.style.display = 'none'
            exprRow.style.display = ''
        } else if (isRegex) {
            // For regex patterns, show full labels and flags field
            const exprLabel = exprRow.querySelector('div')
            if (exprLabel) {
                const labelSpan = exprLabel.querySelector('span')
                if (labelSpan) labelSpan.textContent = 'Expression'
                const helpIcon = exprLabel.querySelector('.info-tooltip')
                if (helpIcon) helpIcon.textContent = 'Enter a regular expression pattern to match against the text.'
            }
            flagsRow.style.display = ''
            astBuilder.style.display = 'none'
            exprRow.style.display = ''
        } else if (isAST) {
            // For AST patterns, show AST builder and hide string/regex fields
            astBuilder.style.display = ''
            exprRow.style.display = 'none'
            flagsRow.style.display = 'none'
            // Update AST expression when switching to AST mode
            astRuleBuilder.updateExpression()
        } else {
            // For other types, use generic labels
            const exprLabel = exprRow.querySelector('div')
            if (exprLabel) {
                const labelSpan = exprLabel.querySelector('span')
                if (labelSpan) labelSpan.textContent = 'Expression'
                const helpIcon = exprLabel.querySelector('.info-tooltip')
                if (helpIcon) helpIcon.textContent = 'Pattern expression for matching.'
            }
            flagsRow.style.display = 'none'
            astBuilder.style.display = 'none'
            exprRow.style.display = ''
        }
    }

    // Add event listener to pattern type dropdown
    patternType.addEventListener('change', updatePatternFields)

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
    root.appendChild(labeled('When', whenRow, 'Choose when this feedback applies: edit (while editing code) or run (when program executes).', true))
    root.appendChild(labeled('Pattern type', patternType, 'Type of pattern matcher. "string" for simple text matching (recommended), "regex" for pattern matching, "ast" for code structure (advanced).'))
    root.appendChild(labeled('Pattern target', targetSel, 'Which program area to match. Options shown depend on when the feedback runs: edit-time (code, filename) or run-time (stdin, stdout, stderr, filename).'))
    root.appendChild(labeled('File target', fileTargetIn, 'Which file to check (for code target). Usually "main.py".', true))
    root.appendChild(astBuilder)
    root.appendChild(exprRow)
    root.appendChild(flagsRow)
    root.appendChild(labeled('Message', message, 'Message shown to the author when the feedback triggers. Use plain text or simple markdown.'))
    root.appendChild(labeled('Style', severity, 'The visual style for the feedback: info, warning, or error.'))

    // Initialize field visibility based on current pattern type
    updatePatternFields()

    return {
        root,
        get() {
            const when = []
            Array.from(whenWrap.querySelectorAll('input[type=radio]')).forEach(radio => { if (radio.checked) when.push(radio.value) })

            let pattern
            if (patternType.value === 'ast') {
                // Use AST rule builder
                pattern = astRuleBuilder.get()
            } else {
                // Regular string/regex patterns
                pattern = {
                    type: patternType.value || 'string',
                    target: targetSel.value || 'stdout',
                    fileTarget: fileTargetIn.value || 'main.py',
                    expression: expr.value || '',
                    flags: flags.value || ''
                }
            }

            return {
                id: idIn.value || undefined,
                title: title.value || '',
                when: when.length ? when : ['run'], // Default to 'run' if none selected
                pattern: pattern,
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
    addBtn.style.marginRight = '8px'

    // const addASTBtn = document.createElement('button')
    // addASTBtn.className = 'btn btn-secondary'
    // addASTBtn.textContent = 'Add AST feedback'
    // addASTBtn.style.marginBottom = '8px'
    // addASTBtn.title = 'Add feedback that analyzes code structure using AST patterns'

    const list = document.createElement('div')
    list.id = 'author-feedback-list'
    list.style.display = 'flex'
    list.style.flexDirection = 'column'
    list.style.gap = '8px'

    container.appendChild(addBtn)
    // container.appendChild(addASTBtn)
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
        body.className = 'modal-body'
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

        // Create a wrapper with proper padding for the content
        const contentWrapper = document.createElement('div')
        contentWrapper.style.padding = '0 12px 12px 12px'
        contentWrapper.appendChild(editor.root)
        contentWrapper.appendChild(err)

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
        contentWrapper.appendChild(actions)

        const m = ensureModal()
        const body = m.querySelector('#author-feedback-modal-body')
        body.innerHTML = ''
        body.appendChild(contentWrapper)
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

        // Create a wrapper with proper padding for the content
        const contentWrapper = document.createElement('div')
        contentWrapper.style.padding = '0 12px 12px 12px'
        contentWrapper.appendChild(editor.root)
        contentWrapper.appendChild(err)

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
        contentWrapper.appendChild(actions)

        const m = ensureModal()
        const body = m.querySelector('#author-feedback-modal-body')
        body.innerHTML = ''
        body.appendChild(contentWrapper)
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
        const newItem = {
            id: genId(),
            title: 'New feedback',
            when: ['edit'],
            pattern: { type: 'string', target: 'code', expression: '' },
            message: '',
            severity: 'info',
            visibleByDefault: true
        }
        // open editor for the new item without adding it to the array yet
        openModalEditNew(newItem)
    })

    // addASTBtn.addEventListener('click', () => {
    //     const newItem = createDefaultASTFeedback()
    //     // open editor for the new item without adding it to the array yet
    //     openModalEditNew(newItem)
    // })    // keep in sync if textarea changes programmatically
    ta.addEventListener('input', () => { items = parseFeedbackFromTextarea(ta); try { jsonView.textContent = JSON.stringify(items, null, 2) } catch (_e) { jsonView.textContent = '' }; render() })
    // initial render and populate read-only view
    try { jsonView.textContent = JSON.stringify(items, null, 2) } catch (_e) { jsonView.textContent = '' }
    render()
}

export default { initAuthorFeedback }
