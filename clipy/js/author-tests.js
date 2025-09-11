// Interactive helpers for authoring test entries
import { debug as logDebug, warn as logWarn, error as logError } from './logger.js'
// - Renders a small UI above the existing #tests-editor textarea
// - Allows add/edit/delete/reorder of tests
// - Keeps the textarea JSON in sync (so autosave in author-page.js continues to work)

import { openModal as openModalHelper, closeModal as closeModalHelper } from './modals.js'
import { buildASTTestForm, createDefaultASTTest } from './ast-test-builder.js'

function $(sel, root = document) { return root.querySelector(sel) }

function genId() { return 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7) }
function genGroupId() { return 'group-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7) }

// Group management utilities
function createGroup(name = 'New Group') {
    return {
        id: genGroupId(),
        name: name,
        collapsed: false,
        conditional: { runIf: 'previous_group_passed', alwaysRun: false },
        tests: []
    }
}

function getAllTests(testConfig) {
    const allTests = []
    if (testConfig.groups) {
        testConfig.groups.forEach(group => {
            group.tests.forEach(test => allTests.push(test))
        })
    }
    if (testConfig.ungrouped) {
        testConfig.ungrouped.forEach(test => allTests.push(test))
    }
    return allTests
}

function calculateTestNumbers(testConfig) {
    const numbers = new Map()
    let globalIndex = 1

    if (testConfig.groups) {
        testConfig.groups.forEach((group, groupIdx) => {
            const groupNum = groupIdx + 1
            group.tests.forEach((test, testIdx) => {
                numbers.set(test.id, `${groupNum}.${testIdx + 1}`)
            })
            globalIndex += group.tests.length
        })
    }

    if (testConfig.ungrouped) {
        testConfig.ungrouped.forEach((test, idx) => {
            numbers.set(test.id, `${globalIndex + idx}`)
        })
    }

    return numbers
}

function populateGroupSelector(groupSelect, testConfig, currentGroupId = null) {
    groupSelect.innerHTML = ''

    // Add "Ungrouped" option
    const ungroupedOption = document.createElement('option')
    ungroupedOption.value = '__ungrouped__'
    ungroupedOption.textContent = 'Ungrouped'
    groupSelect.appendChild(ungroupedOption)

    // Add existing groups
    if (testConfig.groups) {
        testConfig.groups.forEach((group, idx) => {
            const option = document.createElement('option')
            option.value = group.id
            option.textContent = `Group ${idx + 1}: ${group.name}`
            groupSelect.appendChild(option)
        })
    }

    // Set current selection
    if (currentGroupId) {
        groupSelect.value = currentGroupId
    } else {
        groupSelect.value = '__ungrouped__'
    }
}

function parseTestsFromTextarea(ta) {
    if (!ta) return { groups: [], ungrouped: [] }
    const raw = ta.value || ''
    if (!raw.trim()) return { groups: [], ungrouped: [] }
    try {
        const parsed = JSON.parse(raw)

        // Handle legacy format (flat array)
        if (Array.isArray(parsed)) {
            return migrateFromLegacyFormat(parsed)
        }

        // Handle legacy nested format with .tests property
        if (parsed && Array.isArray(parsed.tests)) {
            return migrateFromLegacyFormat(parsed.tests)
        }

        // Handle new grouped format
        if (parsed && (parsed.groups || parsed.ungrouped)) {
            return {
                groups: parsed.groups || [],
                ungrouped: parsed.ungrouped || [],
                showGroupsToUsers: parsed.showGroupsToUsers !== false // default true
            }
        }

        return { groups: [], ungrouped: [], showGroupsToUsers: true }
    } catch (e) {
        // invalid JSON - return empty and let UI show error
    }
    return { groups: [], ungrouped: [] }
}

function migrateFromLegacyFormat(testArray) {
    return {
        groups: [],
        ungrouped: testArray.map(test => ({
            ...test,
            conditional: { runIf: 'previous_passed', alwaysRun: false }
        })),
        showGroupsToUsers: true
    }
}

function writeTestsToTextarea(ta, testConfig) {
    if (!ta) return
    try {
        // If we received a legacy flat array, convert it
        if (Array.isArray(testConfig)) {
            testConfig = migrateFromLegacyFormat(testConfig)
        }

        ta.value = JSON.stringify(testConfig, null, 2)
        ta.dispatchEvent(new Event('input', { bubbles: true }))
    } catch (e) {
        logError('failed to write tests json', e)
    }
}

function createGroupHeader(group, groupIndex, onToggleCollapse, onEditGroup, onDeleteGroup, onMoveGroupUp, onMoveGroupDown, totalGroups) {
    const div = document.createElement('div')
    div.className = 'group-header'
    div.style.cssText = `
        display: flex;
        align-items: center;
        padding: 8px 12px;
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 4px;
        margin-bottom: 4px;
        font-weight: 600;
    `

    // Collapse/expand toggle
    const toggleBtn = document.createElement('button')
    toggleBtn.className = 'btn-icon'
    toggleBtn.style.cssText = 'margin-right: 8px; padding: 2px 6px; font-size: 12px;'
    toggleBtn.textContent = group.collapsed ? '▶' : '▼'
    toggleBtn.title = group.collapsed ? 'Expand group' : 'Collapse group'
    toggleBtn.addEventListener('click', () => onToggleCollapse(group.id))

    // Group number and name
    const nameSpan = document.createElement('span')
    nameSpan.textContent = `Group ${groupIndex + 1}: ${group.name}`
    nameSpan.style.flex = '1'

    // Test count indicator
    const countSpan = document.createElement('span')
    countSpan.textContent = `(${group.tests.length} test${group.tests.length !== 1 ? 's' : ''})`
    countSpan.style.cssText = 'color: #666; font-size: 0.9em; margin-left: 8px; margin-right: 12px;'

    // Move up button
    const moveUpBtn = document.createElement('button')
    moveUpBtn.className = 'btn btn-sm'
    moveUpBtn.textContent = '↑'
    moveUpBtn.title = 'Move group up'
    moveUpBtn.style.cssText = 'margin-right: 4px; font-size: 0.8em; padding: 2px 8px;'
    moveUpBtn.disabled = groupIndex === 0
    moveUpBtn.addEventListener('click', () => onMoveGroupUp(groupIndex))

    // Move down button
    const moveDownBtn = document.createElement('button')
    moveDownBtn.className = 'btn btn-sm'
    moveDownBtn.textContent = '↓'
    moveDownBtn.title = 'Move group down'
    moveDownBtn.style.cssText = 'margin-right: 8px; font-size: 0.8em; padding: 2px 8px;'
    moveDownBtn.disabled = groupIndex === totalGroups - 1
    moveDownBtn.addEventListener('click', () => onMoveGroupDown(groupIndex))

    // Edit button
    const editBtn = document.createElement('button')
    editBtn.className = 'btn btn-sm'
    editBtn.textContent = 'Edit'
    editBtn.style.cssText = 'margin-left: 8px; font-size: 0.8em; padding: 2px 8px;'
    editBtn.addEventListener('click', () => onEditGroup(group))

    // Delete button
    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'btn btn-sm btn-danger'
    deleteBtn.textContent = 'Delete'
    deleteBtn.style.cssText = 'margin-left: 4px; font-size: 0.8em; padding: 2px 8px;'
    deleteBtn.addEventListener('click', () => {
        if (group.tests.length > 0) {
            if (!confirm(`Delete group "${group.name}" and move its ${group.tests.length} test(s) to ungrouped tests?`)) return
        } else {
            if (!confirm(`Delete group "${group.name}"?`)) return
        }
        onDeleteGroup(group.id)
    })

    div.appendChild(toggleBtn)
    div.appendChild(nameSpan)
    div.appendChild(countSpan)
    div.appendChild(moveUpBtn)
    div.appendChild(moveDownBtn)
    div.appendChild(editBtn)
    div.appendChild(deleteBtn)

    return div
}

function createCard(item, idx, onEdit, onMoveUp, onMoveDown, onDelete, testNumber) {
    const div = document.createElement('div')
    div.className = 'feedback-entry' // reuse styling
    const titleRow = document.createElement('div')
    titleRow.className = 'feedback-title-row'

    // Test number indicator
    const numberSpan = document.createElement('span')
    numberSpan.textContent = testNumber || (idx + 1)
    numberSpan.style.cssText = `
        display: inline-block;
        width: 24px;
        text-align: center;
        background: #007acc;
        color: white;
        border-radius: 12px;
        font-size: 0.8em;
        font-weight: 600;
        margin-right: 8px;
        line-height: 20px;
    `

    const h = document.createElement('div')
    h.className = 'feedback-title'
    h.textContent = item.description || item.name || ('Test ' + (idx + 1))

    // Conditional execution indicator
    const conditionalSpan = document.createElement('span')
    if (item.conditional && item.conditional.runIf !== 'previous_passed') {
        let condText = ''
        if (item.conditional.runIf === 'always') condText = '!'
        else if (item.conditional.runIf === 'previous_group_passed') condText = '⚡⚡'

        conditionalSpan.textContent = condText
        conditionalSpan.title = `Conditional execution: ${item.conditional.runIf}`
        conditionalSpan.style.cssText = 'margin-left: 8px; color: #ff6b35; font-weight: bold;'
    }

    const meta = document.createElement('div')
    meta.style.marginLeft = 'auto'
    meta.style.fontSize = '0.85em'
    meta.style.color = '#666'
    meta.textContent = item.id || ''

    titleRow.appendChild(numberSpan)
    titleRow.appendChild(h)
    titleRow.appendChild(conditionalSpan)
    titleRow.appendChild(meta)

    const body = document.createElement('div')
    body.className = 'feedback-msg'

    // Check if this is an AST test
    if (item.type === 'ast' || item.astRule) {
        body.textContent = 'AST Test: ' + (item.astRule?.expression || 'No expression') +
            (item.expectedMessage ? '  •  ' + item.expectedMessage : '')
        if (item.hide_actual_expected) {
            body.textContent += '  •  [hide AST details]'
        }
    } else {
        // Regular test display (existing logic)
        // Render expected_stdout/stderr safely: if it's an object (regex/exact), show appropriate format
        function renderExpected(v) {
            if (v == null) return ''
            if (typeof v === 'string') return v
            try {
                if (typeof v === 'object' && v.type === 'regex') return `/${v.expression}/${v.flags || ''}`
                if (typeof v === 'object' && v.type === 'exact') return `[exact: ${v.expression}]`
            } catch (_e) { }
            try { return JSON.stringify(v) } catch (_e) { return String(v) }
        }
        body.textContent = 'stdin: ' + (item.stdin || '') + '  •  expected_stdout: ' + renderExpected(item.expected_stdout)
        if (item.hide_actual_expected) {
            body.textContent += '  •  [hide actual/expected]'
        }
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
    // Check if this is an AST test
    if (existing.type === 'ast' || existing.astRule) {
        return buildASTTestForm(existing)
    }

    // Regular test form (existing logic)
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

    // Expected stdout editor: allow String, Exact, or Regex modes
    const expectedOutMode = document.createElement('select')
    const optS = document.createElement('option'); optS.value = 'string'; optS.textContent = 'String (contains)'
    const optE = document.createElement('option'); optE.value = 'exact'; optE.textContent = 'Exact match'
    const optR = document.createElement('option'); optR.value = 'regex'; optR.textContent = 'Regex'
    expectedOutMode.appendChild(optS); expectedOutMode.appendChild(optE); expectedOutMode.appendChild(optR)

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

    // Expected stderr editor: allow String, Exact, or Regex modes
    const expectedErrMode = document.createElement('select')
    const eOptS = document.createElement('option'); eOptS.value = 'string'; eOptS.textContent = 'String (contains)'
    const eOptE = document.createElement('option'); eOptE.value = 'exact'; eOptE.textContent = 'Exact match'
    const eOptR = document.createElement('option'); eOptR.value = 'regex'; eOptR.textContent = 'Regex'
    expectedErrMode.appendChild(eOptS); expectedErrMode.appendChild(eOptE); expectedErrMode.appendChild(eOptR)

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

    // Files field - allows attaching files specific to this test
    const filesContainer = document.createElement('div')
    filesContainer.style.border = '1px solid #ddd'
    filesContainer.style.borderRadius = '4px'
    filesContainer.style.padding = '12px'
    filesContainer.style.backgroundColor = '#fafafa'

    // File upload area
    const uploadArea = document.createElement('div')
    uploadArea.style.cssText = `
        border: 2px dashed #ccc;
        border-radius: 4px;
        padding: 20px;
        text-align: center;
        margin-bottom: 12px;
        cursor: pointer;
        transition: border-color 0.3s;
    `
    uploadArea.innerHTML = `
        <div>📁 Drop files here or click to browse</div>
        <div style="font-size: 0.8em; color: #666; margin-top: 4px">Files will be available to the test at their specified paths</div>
    `

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.multiple = true
    fileInput.style.display = 'none'

    // File list display
    const fileList = document.createElement('div')
    fileList.style.marginBottom = '12px'

    // JSON textarea (hidden by default, shown when "Edit JSON" is clicked)
    const files = document.createElement('textarea')
    files.style.width = '100%'
    files.rows = 6
    files.value = existing.files ? JSON.stringify(existing.files, null, 2) : ''
    files.style.display = 'none'
    files.placeholder = '{\n  "/data.txt": "line1\\nline2\\nline3",\n  "/config.json": "{\\"key\\": \\"value\\"}"\n}'

    // Toggle button for JSON editing
    const toggleJsonBtn = document.createElement('button')
    toggleJsonBtn.type = 'button'
    toggleJsonBtn.className = 'btn btn-sm'
    toggleJsonBtn.textContent = 'Edit JSON'
    toggleJsonBtn.style.marginBottom = '8px'
    toggleJsonBtn.style.marginRight = '8px'

    // New file button
    const newFileBtn = document.createElement('button')
    newFileBtn.type = 'button'
    newFileBtn.className = 'btn btn-sm'
    newFileBtn.textContent = 'New File'
    newFileBtn.style.marginBottom = '8px'
    newFileBtn.title = 'Create a new empty file'

    const buttonContainer = document.createElement('div')
    buttonContainer.appendChild(toggleJsonBtn)
    buttonContainer.appendChild(newFileBtn)

    filesContainer.appendChild(uploadArea)
    filesContainer.appendChild(fileList)
    filesContainer.appendChild(buttonContainer)
    filesContainer.appendChild(files)

    // Track files in memory
    let filesData = existing.files || {}

    function renderFileList() {
        fileList.innerHTML = ''
        if (Object.keys(filesData).length === 0) {
            fileList.innerHTML = '<div style="color: #666; font-style: italic;">No files attached</div>'
            return
        }

        Object.entries(filesData).forEach(([path, content]) => {
            const fileItem = document.createElement('div')
            fileItem.style.cssText = `
                display: flex;
                align-items: center;
                padding: 8px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 4px;
                margin-bottom: 4px;
            `

            const pathInput = document.createElement('input')
            pathInput.type = 'text'
            pathInput.value = path
            pathInput.style.cssText = `
                font-family: monospace;
                padding: 4px 8px;
                border: 1px solid #ccc;
                border-radius: 2px;
                margin-right: 8px;
                width: 200px;
            `

            const sizeInfo = document.createElement('span')
            sizeInfo.textContent = `${content.length} chars`
            sizeInfo.style.cssText = `
                color: #666;
                font-size: 0.8em;
                margin-right: 8px;
                flex: 1;
            `

            const editBtn = document.createElement('button')
            editBtn.type = 'button'
            editBtn.className = 'btn btn-sm'
            editBtn.textContent = 'Edit'
            editBtn.style.marginRight = '4px'

            const deleteBtn = document.createElement('button')
            deleteBtn.type = 'button'
            deleteBtn.className = 'btn btn-sm btn-danger'
            deleteBtn.textContent = '×'

            // Update file path
            pathInput.addEventListener('change', () => {
                if (pathInput.value !== path && pathInput.value.trim()) {
                    delete filesData[path]
                    filesData[pathInput.value.trim()] = content
                    updateJsonTextarea()
                    renderFileList()
                }
            })

            // Edit file content
            editBtn.addEventListener('click', () => {
                createFileEditor(path, content,
                    (newContent) => {
                        filesData[path] = newContent
                        updateJsonTextarea()
                        renderFileList()
                    },
                    () => {
                        // Cancel - do nothing
                    }
                )
            })

            // Delete file
            deleteBtn.addEventListener('click', () => {
                delete filesData[path]
                updateJsonTextarea()
                renderFileList()
            })

            fileItem.appendChild(pathInput)
            fileItem.appendChild(sizeInfo)
            fileItem.appendChild(editBtn)
            fileItem.appendChild(deleteBtn)
            fileList.appendChild(fileItem)
        })
    }

    function updateJsonTextarea() {
        files.value = Object.keys(filesData).length > 0 ? JSON.stringify(filesData, null, 2) : ''
    }

    function addFile(filename, content, suggestedPath = null) {
        const path = suggestedPath || prompt(`Enter path for ${filename} (e.g., /data/${filename}):`, `/${filename}`)
        if (path && path.trim()) {
            filesData[path.trim()] = content
            updateJsonTextarea()
            renderFileList()
        }
    }

    function createFileEditor(filePath, content, onSave, onCancel) {
        const modal = document.createElement('div')
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `
        modal.tabIndex = -1 // Make modal focusable

        const dialog = document.createElement('div')
        dialog.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            width: 80%;
            height: 70%;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        `

        const header = document.createElement('div')
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            border-bottom: 1px solid #eee;
            padding-bottom: 12px;
        `

        const title = document.createElement('h3')
        title.textContent = `Edit: ${filePath}`
        title.style.margin = '0'
        title.style.fontFamily = 'monospace'

        const headerButtons = document.createElement('div')

        const saveBtn = document.createElement('button')
        saveBtn.type = 'button'
        saveBtn.className = 'btn btn-primary'
        saveBtn.textContent = 'Save'
        saveBtn.style.marginRight = '8px'

        const cancelBtn = document.createElement('button')
        cancelBtn.type = 'button'
        cancelBtn.className = 'btn'
        cancelBtn.textContent = 'Cancel'

        headerButtons.appendChild(saveBtn)
        headerButtons.appendChild(cancelBtn)
        header.appendChild(title)
        header.appendChild(headerButtons)

        const editorContainer = document.createElement('div')
        editorContainer.style.cssText = `
            flex: 1;
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
        `

        // Create a textarea fallback that looks like CodeMirror
        const textarea = document.createElement('textarea')
        textarea.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            outline: none;
            padding: 12px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 13px;
            line-height: 1.4;
            resize: none;
            background: #fafafa;
        `
        textarea.value = content

        editorContainer.appendChild(textarea)

        // Find and temporarily disable the parent modal's escape handler
        let parentModal = null
        let originalKeydownHandler = null

        // Look for a parent modal (test editor modal)
        const existingModals = document.querySelectorAll('[aria-modal="true"]')
        if (existingModals.length > 0) {
            parentModal = existingModals[existingModals.length - 1] // Get the topmost modal
            if (parentModal && parentModal.__keydownHandler) {
                originalKeydownHandler = parentModal.__keydownHandler
                document.removeEventListener('keydown', originalKeydownHandler, true)
            }
        }

        function closeModal() {
            document.body.removeChild(modal)

            // Re-enable the parent modal's escape handler
            if (parentModal && originalKeydownHandler) {
                document.addEventListener('keydown', originalKeydownHandler, true)
            }

            onCancel()
        }

        function saveAndClose(newContent) {
            document.body.removeChild(modal)

            // Re-enable the parent modal's escape handler
            if (parentModal && originalKeydownHandler) {
                document.addEventListener('keydown', originalKeydownHandler, true)
            }

            onSave(newContent)
        }

        // Try to use CodeMirror if available, otherwise fallback to textarea
        let editor = textarea
        if (typeof window.CodeMirror !== 'undefined') {
            try {
                editor = window.CodeMirror.fromTextArea(textarea, {
                    mode: 'text/plain',
                    lineNumbers: true,
                    gutters: ['CodeMirror-linenumbers'],
                    fixedGutter: true,
                    lineNumberFormatter: function (line) {
                        return String(line);
                    },
                    indentUnit: 4,
                    tabSize: 4,
                    matchBrackets: true,
                    autoCloseBrackets: true,
                    scrollbarStyle: 'native',
                    lineWrapping: true,
                    extraKeys: {
                        Tab: function (cm) {
                            if (cm.somethingSelected()) cm.indentSelection('add')
                            else cm.replaceSelection('    ', 'end')
                        }
                    }
                })
                editor.setSize('100%', '100%')

                // Force refresh after a brief delay to ensure proper gutter rendering
                setTimeout(() => {
                    if (editor && typeof editor.refresh === 'function') {
                        editor.refresh()
                    }
                }, 50)
            } catch (e) {
                console.warn('CodeMirror initialization failed, using textarea fallback', e)
                editor = textarea
            }
        }

        // Simple escape key handler for the file editor
        const fileEditorEscapeHandler = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation()
                e.preventDefault()
                closeModal()
            }
        }
        document.addEventListener('keydown', fileEditorEscapeHandler)

        // Update closeModal to clean up the escape handler
        const originalCloseModal = closeModal
        closeModal = function () {
            document.removeEventListener('keydown', fileEditorEscapeHandler)
            originalCloseModal()
        }

        // Update saveAndClose to clean up the escape handler
        const originalSaveAndClose = saveAndClose
        saveAndClose = function (newContent) {
            document.removeEventListener('keydown', fileEditorEscapeHandler)
            originalSaveAndClose(newContent)
        }

        function getValue() {
            if (editor && typeof editor.getValue === 'function') {
                return editor.getValue()
            }
            return textarea.value
        }

        saveBtn.addEventListener('click', () => {
            const newContent = getValue()
            saveAndClose(newContent)
        })

        cancelBtn.addEventListener('click', closeModal)

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal()
            }
        })

        dialog.appendChild(header)
        dialog.appendChild(editorContainer)
        modal.appendChild(dialog)
        document.body.appendChild(modal)

        // Focus the modal first so it can receive keyboard events
        modal.focus()

        // Focus the editor and ensure proper rendering
        setTimeout(() => {
            if (editor && typeof editor.focus === 'function') {
                editor.focus()
                // Additional refresh after modal is fully rendered
                if (typeof editor.refresh === 'function') {
                    editor.refresh()
                }
            } else {
                textarea.focus()
            }
        }, 100)
    }

    // File upload handling
    function handleFiles(files) {
        Array.from(files).forEach(file => {
            const reader = new FileReader()
            reader.onload = (e) => {
                addFile(file.name, e.target.result)
            }
            reader.readAsText(file)
        })
    }

    uploadArea.addEventListener('click', () => fileInput.click())
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault()
        uploadArea.style.borderColor = '#007acc'
    })
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault()
        uploadArea.style.borderColor = '#ccc'
    })
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault()
        uploadArea.style.borderColor = '#ccc'
        handleFiles(e.dataTransfer.files)
    })

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files)
    })

    // JSON toggle
    let jsonMode = false
    toggleJsonBtn.addEventListener('click', () => {
        jsonMode = !jsonMode
        if (jsonMode) {
            files.style.display = 'block'
            fileList.style.display = 'none'
            uploadArea.style.display = 'none'
            toggleJsonBtn.textContent = 'Visual Editor'
            updateJsonTextarea()
        } else {
            files.style.display = 'none'
            fileList.style.display = 'block'
            uploadArea.style.display = 'block'
            toggleJsonBtn.textContent = 'Edit JSON'
            // Parse JSON back to filesData
            try {
                filesData = files.value ? JSON.parse(files.value) : {}
            } catch (e) {
                alert('Invalid JSON in files field. Please fix or clear it.')
                return
            }
            renderFileList()
        }
    })

    // Sync JSON changes back to filesData when in JSON mode
    files.addEventListener('input', () => {
        try {
            const parsed = files.value ? JSON.parse(files.value) : {}
            filesData = parsed
        } catch (e) {
            // Invalid JSON, don't update filesData yet
        }
    })

    // New file functionality
    newFileBtn.addEventListener('click', () => {
        // Generate a unique filename
        let counter = 1
        let filename = 'newfile.txt'

        while (filesData[`/${filename}`]) {
            filename = `newfile${counter}.txt`
            counter++
        }

        const path = `/${filename}`

        // Create the file with empty content and open editor immediately
        createFileEditor(path, '',
            (content) => {
                filesData[path] = content
                updateJsonTextarea()
                renderFileList()
            },
            () => {
                // Cancel - don't create the file
            }
        )
    })

    // Initial render
    renderFileList()

    // Failure message (optional) - shown on failure beneath default messages
    const failureMessage = document.createElement('textarea')
    failureMessage.style.width = '100%'
    failureMessage.rows = 2
    failureMessage.placeholder = 'Optional short failure message to display when this test fails'
    failureMessage.value = existing.failureMessage || ''

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
        } else if (existing.expected_stdout && typeof existing.expected_stdout === 'object' && existing.expected_stdout.type === 'exact') {
            expectedOutMode.value = 'exact'
            expectedOutText.value = existing.expected_stdout.expression || ''
            expectedOutExpr.style.display = 'none'
            expectedOutFlags.style.display = 'none'
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
        } else if (existing.expected_stderr && typeof existing.expected_stderr === 'object' && existing.expected_stderr.type === 'exact') {
            expectedErrMode.value = 'exact'
            expectedErrText.value = existing.expected_stderr.expression || ''
            expectedErrExpr.style.display = 'none'
            expectedErrFlags.style.display = 'none'
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
    root.appendChild(labeled('Test Files [optional]', filesContainer))
    root.appendChild(labeled('Failure Message [optional]', failureMessage))
    root.appendChild(labeled('Display options', hideActualExpectedWrap))

    // Conditional execution controls
    const conditionalWrap = document.createElement('div')

    const runIfSelect = document.createElement('select')
    runIfSelect.className = 'form-input'
    runIfSelect.style.marginBottom = '8px'

    const runIfOptions = [
        { value: 'previous_passed', text: 'Only run if previous test passed (default)' },
        { value: 'always', text: 'Always run this test' }
    ]
    runIfOptions.forEach(opt => {
        const option = document.createElement('option')
        option.value = opt.value
        option.textContent = opt.text
        runIfSelect.appendChild(option)
    })

    conditionalWrap.appendChild(runIfSelect)

    // Set initial values for conditional execution (default to previous_passed)
    if (existing?.conditional) {
        runIfSelect.value = existing.conditional.runIf || 'previous_passed'
    } else {
        runIfSelect.value = 'previous_passed'
    }

    root.appendChild(labeled('Run Conditions', conditionalWrap))

    // Group assignment control
    const groupSelectWrap = document.createElement('div')

    const groupSelect = document.createElement('select')
    groupSelect.className = 'form-input'
    groupSelect.id = 'group-selector' // Add ID for easy identification

    // This will be populated dynamically when the modal opens
    // since we need access to the current testConfig

    groupSelectWrap.appendChild(groupSelect)
    root.appendChild(labeled('Assign to Group', groupSelectWrap))

    return {
        root,
        get() {
            let setupVal = null
            try { setupVal = setup.value ? JSON.parse(setup.value) : null } catch (_e) { setupVal = setup.value || null }

            // Parse files value (get from filesData in visual mode, or textarea in JSON mode)
            let filesVal = null
            try {
                if (jsonMode) {
                    filesVal = files.value ? JSON.parse(files.value) : null
                } else {
                    filesVal = Object.keys(filesData).length > 0 ? filesData : null
                }
            } catch (_e) {
                filesVal = files.value || null
            }

            // expected stdout: respect selected mode (string, exact, or regex)
            let expectedOutVal = undefined
            if (typeof expectedOutMode !== 'undefined' && expectedOutMode.value === 'regex') {
                const expr = (expectedOutExpr.value || '').trim()
                const flagsV = (expectedOutFlags.value || '').trim()
                if (expr !== '') expectedOutVal = { type: 'regex', expression: expr, flags: flagsV || '' }
            } else if (typeof expectedOutMode !== 'undefined' && expectedOutMode.value === 'exact') {
                const v = (expectedOutText.value || '').trim()
                expectedOutVal = v === '' ? undefined : { type: 'exact', expression: v }
            } else {
                const v = (expectedOutText.value || '').trim()
                expectedOutVal = v === '' ? undefined : v
            }

            // expected stderr: respect selected mode (string, exact, or regex)
            let expectedErrVal = undefined
            if (typeof expectedErrMode !== 'undefined' && expectedErrMode.value === 'regex') {
                const expr = (expectedErrExpr.value || '').trim()
                const flagsV = (expectedErrFlags.value || '').trim()
                if (expr !== '') expectedErrVal = { type: 'regex', expression: expr, flags: flagsV || '' }
            } else if (typeof expectedErrMode !== 'undefined' && expectedErrMode.value === 'exact') {
                const v = (expectedErrText.value || '').trim()
                expectedErrVal = v === '' ? undefined : { type: 'exact', expression: v }
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
            if (filesVal !== null && filesVal !== undefined && filesVal !== '') out.files = filesVal
            if (hideActualExpected.checked) out.hide_actual_expected = true

            // Optional author-provided failure message
            if (failureMessage.value && failureMessage.value.trim() !== '') out.failureMessage = failureMessage.value.trim()

            // Add conditional execution settings (simplified - no alwaysRun override)
            out.conditional = {
                runIf: runIfSelect.value,
                alwaysRun: false
            }

            // Add group assignment (will be handled by the calling modal function)
            out._selectedGroupId = groupSelect.value

            return out
        }
    }
}

function buildGroupEditorForm(existing) {
    const root = document.createElement('div')

    function labeled(labelText, element) {
        const label = document.createElement('label')
        label.textContent = labelText
        label.style.display = 'block'
        label.style.marginBottom = '4px'
        label.style.fontWeight = 'bold'
        const wrapper = document.createElement('div')
        wrapper.style.marginBottom = '12px'
        wrapper.appendChild(label)
        wrapper.appendChild(element)
        return wrapper
    }

    // Group name
    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.className = 'form-input'
    nameInput.value = existing?.name || ''
    nameInput.placeholder = 'Group name'

    // Conditional execution settings
    const conditionalWrap = document.createElement('div')

    const runIfSelect = document.createElement('select')
    runIfSelect.className = 'form-input'
    runIfSelect.style.marginBottom = '8px'

    const runIfOptions = [
        { value: 'previous_group_passed', text: 'Only run if previous group passed (default)' },
        { value: 'always', text: 'Always run this group' }
    ]
    runIfOptions.forEach(opt => {
        const option = document.createElement('option')
        option.value = opt.value
        option.textContent = opt.text
        runIfSelect.appendChild(option)
    })

    conditionalWrap.appendChild(runIfSelect)

    // Set initial values (default to previous_group_passed, but first group should be always)
    if (existing?.conditional) {
        runIfSelect.value = existing.conditional.runIf || 'previous_group_passed'
    } else {
        runIfSelect.value = 'previous_group_passed'
    }

    root.appendChild(labeled('Group Name', nameInput))
    root.appendChild(labeled('Run Conditions', conditionalWrap))

    return {
        root,
        get() {
            return {
                id: existing?.id || genGroupId(),
                name: nameInput.value || 'New Group',
                collapsed: existing?.collapsed || false,
                conditional: {
                    runIf: runIfSelect.value,
                    alwaysRun: false
                },
                tests: existing?.tests || []
            }
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
    addBtn.style.marginRight = '8px'

    const addASTBtn = document.createElement('button')
    addASTBtn.className = 'btn'
    addASTBtn.textContent = 'Add AST test'
    addASTBtn.style.marginBottom = '8px'
    addASTBtn.style.marginRight = '8px'
    addASTBtn.title = 'Add test that analyzes code structure using AST patterns'

    const addGroupBtn = document.createElement('button')
    addGroupBtn.className = 'btn'
    addGroupBtn.textContent = 'Create Group'
    addGroupBtn.style.marginBottom = '8px'
    addGroupBtn.style.marginRight = '8px'
    addGroupBtn.title = 'Create a new test group'

    // Add "Show Groups to Users" toggle
    const groupVisibilityWrap = document.createElement('div')
    groupVisibilityWrap.style.marginBottom = '8px'
    groupVisibilityWrap.style.display = 'flex'
    groupVisibilityWrap.style.alignItems = 'center'

    const groupVisibilityLabel = document.createElement('label')
    groupVisibilityLabel.style.display = 'flex'
    groupVisibilityLabel.style.alignItems = 'center'
    groupVisibilityLabel.style.cursor = 'pointer'
    groupVisibilityLabel.style.fontSize = '14px'
    groupVisibilityLabel.style.marginRight = '16px'

    const groupVisibilityCheck = document.createElement('input')
    groupVisibilityCheck.type = 'checkbox'
    groupVisibilityCheck.id = 'groups-visible-to-users'
    groupVisibilityCheck.style.marginRight = '6px'
    // Will be set after testConfig is parsed

    const groupVisibilityText = document.createElement('span')
    groupVisibilityText.textContent = 'Show Groups to Users'
    groupVisibilityText.title = 'When enabled, test groups will be visible to users in the test results'

    groupVisibilityLabel.appendChild(groupVisibilityCheck)
    groupVisibilityLabel.appendChild(groupVisibilityText)
    groupVisibilityWrap.appendChild(groupVisibilityLabel)

    const list = document.createElement('div')
    list.id = 'author-tests-list'
    list.style.display = 'flex'
    list.style.flexDirection = 'column'
    list.style.gap = '8px'

    container.appendChild(addBtn)
    container.appendChild(addASTBtn)
    container.appendChild(addGroupBtn)
    container.appendChild(groupVisibilityWrap)
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

    let testConfig = parseTestsFromTextarea(ta)

    // Set checkbox state after testConfig is available
    groupVisibilityCheck.checked = testConfig.showGroupsToUsers !== false

    // Initial sync with global config
    try {
        if (window.Config && window.Config.current) {
            window.Config.current.tests = testConfig
            logDebug('[author-tests] Initial sync with window.Config.current.tests', testConfig)
        }
    } catch (e) {
        logWarn('[author-tests] Failed initial global config sync:', e)
    }

    function render() {
        list.innerHTML = ''
        const testNumbers = calculateTestNumbers(testConfig)

        // Render groups
        if (testConfig.groups && testConfig.groups.length > 0) {
            testConfig.groups.forEach((group, groupIdx) => {
                const groupHeader = createGroupHeader(
                    group,
                    groupIdx,
                    (groupId) => toggleGroupCollapse(groupId),
                    (group) => openGroupEditModal(group),
                    (groupId) => deleteGroup(groupId),
                    (groupIdx) => moveGroupUp(groupIdx),
                    (groupIdx) => moveGroupDown(groupIdx),
                    testConfig.groups.length
                )
                list.appendChild(groupHeader)

                // Render tests in group (if not collapsed)
                if (!group.collapsed) {
                    const groupContainer = document.createElement('div')
                    groupContainer.style.marginLeft = '20px'
                    groupContainer.style.marginBottom = '8px'

                    group.tests.forEach((test, testIdx) => {
                        const testNumber = testNumbers.get(test.id)
                        const card = createCard(
                            test,
                            testIdx,
                            () => openTestEditModal(test, groupIdx, testIdx),
                            () => moveTestUp(groupIdx, testIdx),
                            () => moveTestDown(groupIdx, testIdx),
                            () => deleteTest(groupIdx, testIdx),
                            testNumber
                        )
                        groupContainer.appendChild(card)
                    })

                    list.appendChild(groupContainer)
                }
            })
        }

        // Render ungrouped tests
        if (testConfig.ungrouped && testConfig.ungrouped.length > 0) {
            if (testConfig.groups && testConfig.groups.length > 0) {
                const separator = document.createElement('div')
                separator.textContent = 'Ungrouped Tests'
                separator.style.cssText = `
                    margin: 16px 0 8px 0;
                    font-weight: bold;
                    color: #666;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 4px;
                `
                list.appendChild(separator)
            }

            testConfig.ungrouped.forEach((test, testIdx) => {
                const testNumber = testNumbers.get(test.id)
                const card = createCard(
                    test,
                    testIdx,
                    () => openTestEditModal(test, null, testIdx),
                    () => moveUngroupedTestUp(testIdx),
                    () => moveUngroupedTestDown(testIdx),
                    () => deleteUngroupedTest(testIdx),
                    testNumber
                )
                list.appendChild(card)
            })
        }
    }

    function persist() {
        writeTestsToTextarea(ta, testConfig)
        try { jsonView.textContent = JSON.stringify(testConfig, null, 2) } catch (_e) { jsonView.textContent = '' }
        render()

        // Update global config so feedback UI can see the new tests
        try {
            if (window.Config && window.Config.current) {
                // Update the global config with the new tests structure
                window.Config.current.tests = testConfig
                logDebug('[author-tests] Updated window.Config.current.tests', testConfig)
            }
        } catch (e) {
            logWarn('[author-tests] Failed to update global config:', e)
        }
    }

    // Group operations
    function toggleGroupCollapse(groupId) {
        const group = testConfig.groups.find(g => g.id === groupId)
        if (group) {
            group.collapsed = !group.collapsed
            persist()
        }
    }

    function deleteGroup(groupId) {
        const groupIdx = testConfig.groups.findIndex(g => g.id === groupId)
        if (groupIdx >= 0) {
            const group = testConfig.groups[groupIdx]
            // Move tests to ungrouped
            testConfig.ungrouped = testConfig.ungrouped || []
            testConfig.ungrouped.push(...group.tests)
            testConfig.groups.splice(groupIdx, 1)
            persist()
        }
    }

    // Group movement operations
    function moveGroupUp(groupIdx) {
        if (groupIdx <= 0) return
        const groups = testConfig.groups
            ;[groups[groupIdx - 1], groups[groupIdx]] = [groups[groupIdx], groups[groupIdx - 1]]
        persist()
    }

    function moveGroupDown(groupIdx) {
        if (groupIdx >= testConfig.groups.length - 1) return
        const groups = testConfig.groups
            ;[groups[groupIdx + 1], groups[groupIdx]] = [groups[groupIdx], groups[groupIdx + 1]]
        persist()
    }

    // Test movement operations
    function moveTestUp(groupIdx, testIdx) {
        if (testIdx <= 0) return
        const group = testConfig.groups[groupIdx]
        const tests = group.tests
            ;[tests[testIdx - 1], tests[testIdx]] = [tests[testIdx], tests[testIdx - 1]]
        persist()
        // Defensive sync: ensure textarea & global config reflect new order immediately
        try { writeTestsToTextarea(ta, testConfig); if (window.Config && window.Config.current) window.Config.current.tests = testConfig } catch (_e) { }
    }

    function moveTestDown(groupIdx, testIdx) {
        const group = testConfig.groups[groupIdx]
        if (testIdx >= group.tests.length - 1) return
        const tests = group.tests
            ;[tests[testIdx + 1], tests[testIdx]] = [tests[testIdx], tests[testIdx + 1]]
        persist()
        // Defensive sync: ensure textarea & global config reflect new order immediately
        try { writeTestsToTextarea(ta, testConfig); if (window.Config && window.Config.current) window.Config.current.tests = testConfig } catch (_e) { }
    }

    function moveUngroupedTestUp(testIdx) {
        if (testIdx <= 0) return
        const tests = testConfig.ungrouped
            ;[tests[testIdx - 1], tests[testIdx]] = [tests[testIdx], tests[testIdx - 1]]
        persist()
        // Defensive sync: ensure textarea & global config reflect new order immediately
        try { writeTestsToTextarea(ta, testConfig); if (window.Config && window.Config.current) window.Config.current.tests = testConfig } catch (_e) { }
    }

    function moveUngroupedTestDown(testIdx) {
        if (testIdx >= testConfig.ungrouped.length - 1) return
        const tests = testConfig.ungrouped
            ;[tests[testIdx + 1], tests[testIdx]] = [tests[testIdx], tests[testIdx + 1]]
        persist()
        // Defensive sync: ensure textarea & global config reflect new order immediately
        try { writeTestsToTextarea(ta, testConfig); if (window.Config && window.Config.current) window.Config.current.tests = testConfig } catch (_e) { }
    }

    // Test deletion operations
    function deleteTest(groupIdx, testIdx) {
        const group = testConfig.groups[groupIdx]
        const test = group.tests[testIdx]
        if (!confirm(`Delete test "${test.description || test.id}"?`)) return
        group.tests.splice(testIdx, 1)
        persist()
    }

    function deleteUngroupedTest(testIdx) {
        const test = testConfig.ungrouped[testIdx]
        if (!confirm(`Delete test "${test.description || test.id}"?`)) return
        testConfig.ungrouped.splice(testIdx, 1)
        persist()
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
        h3.textContent = 'Edit'
        const actionHolder = document.createElement('div')
        actionHolder.className = 'modal-header-actions'
        header.appendChild(h3)
        header.appendChild(actionHolder)
        content.appendChild(header)
        const body = document.createElement('div')
        body.id = 'author-tests-modal-body'
        body.className = 'modal-body'
        content.appendChild(body)
        modal.appendChild(content)
        document.body.appendChild(modal)
        return modal
    }

    function openTestEditModal(test, groupIdx, testIdx) {
        const existing = Object.assign({}, test)
        const editor = buildEditorForm(existing)

        // Find which group this test is currently in
        let currentGroupId = null
        if (groupIdx !== null && testConfig.groups && testConfig.groups[groupIdx]) {
            currentGroupId = testConfig.groups[groupIdx].id
        }

        // Populate the group selector
        const groupSelect = editor.root.querySelector('#group-selector')
        if (groupSelect) {
            populateGroupSelector(groupSelect, testConfig, currentGroupId)
        }

        const contentWrapper = document.createElement('div')
        contentWrapper.style.padding = '0 12px 12px 12px'
        contentWrapper.appendChild(editor.root)

        const m = ensureModal()
        // Use modal header actions so buttons are sticky and visible top-right
        const header = m.querySelector('.modal-header')
        const h3 = header ? header.querySelector('h3') : null
        if (h3) h3.textContent = 'Edit Test'

        // Header message area for validation/failure messages
        let headerMessage = header ? header.querySelector('.modal-header-message') : null
        if (!headerMessage && header) {
            headerMessage = document.createElement('div')
            headerMessage.className = 'modal-header-message'
            headerMessage.style.color = '#b00020'
            headerMessage.style.fontSize = '0.9em'
            headerMessage.style.marginLeft = '12px'
            headerMessage.style.flex = '1'
            headerMessage.style.alignSelf = 'center'
            // insert headerMessage between title and actions
            const actionHolder = header.querySelector('.modal-header-actions')
            header.insertBefore(headerMessage, actionHolder)
        }

        // Inject Save/Cancel into header action holder
        const actionHolder = header ? header.querySelector('.modal-header-actions') : null
        actionHolder && (actionHolder.innerHTML = '')
        const save = document.createElement('button')
        save.className = 'btn btn-primary'
        save.textContent = 'Save'
        const cancel = document.createElement('button')
        cancel.className = 'btn'
        cancel.textContent = 'Cancel'
        actionHolder && actionHolder.appendChild(save)
        actionHolder && actionHolder.appendChild(cancel)

        const body = m.querySelector('#author-tests-modal-body')
        body.innerHTML = ''
        body.appendChild(contentWrapper)

        try { openModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'false'); m.style.display = 'flex' }

        // Clear header message when any input in the editor changes (covers matcher edits)
        try {
            editor.root.addEventListener('input', () => { if (headerMessage) headerMessage.textContent = '' })
            editor.root.addEventListener('change', () => { if (headerMessage) headerMessage.textContent = '' })
        } catch (_e) { }

        function validateAndSave() {
            const val = editor.get()
            // If this is an AST test, ensure the AST tester did not produce
            // a non-boolean truthy matcher result. If it did, block saving.
            try {
                if ((val.type && val.type === 'ast') || val.astRule) {
                    const testResultEl = m && m.querySelector ? m.querySelector('.ast-rule-builder .test-result') : null
                    if (testResultEl && testResultEl.dataset && testResultEl.dataset.nonBoolean) {
                        if (headerMessage) headerMessage.textContent = 'Cannot save: AST matcher returned a non-boolean truthy value. Please make the matcher return true or false.'
                        return
                    }
                }
            } catch (_e) { /* ignore DOM-check failures */ }
            if (!val.id) val.id = genId()

            const selectedGroupId = val._selectedGroupId
            delete val._selectedGroupId // Remove the temporary field

            // Remember original location so we can re-insert at the same index
            const originalGroupId = (groupIdx !== null && testConfig.groups && testConfig.groups[groupIdx]) ? testConfig.groups[groupIdx].id : '__ungrouped__'
            const originalTestIdx = testIdx

            // Remove test from current location
            if (groupIdx !== null) {
                testConfig.groups[groupIdx].tests.splice(testIdx, 1)
            } else {
                testConfig.ungrouped.splice(testIdx, 1)
            }

            // Add test to new location. If saving back into the same group/ungrouped,
            // insert at the original index to preserve ordering; otherwise append.
            if (selectedGroupId === '__ungrouped__') {
                testConfig.ungrouped = testConfig.ungrouped || []
                if (originalGroupId === '__ungrouped__') {
                    const idx = Math.min(originalTestIdx, testConfig.ungrouped.length)
                    testConfig.ungrouped.splice(idx, 0, val)
                } else {
                    testConfig.ungrouped.push(val)
                }
            } else {
                const targetGroup = testConfig.groups.find(g => g.id === selectedGroupId)
                if (targetGroup) {
                    if (selectedGroupId === originalGroupId) {
                        const idx = Math.min(originalTestIdx, targetGroup.tests.length)
                        targetGroup.tests.splice(idx, 0, val)
                    } else {
                        targetGroup.tests.push(val)
                    }
                } else {
                    // Fallback to ungrouped if group not found
                    testConfig.ungrouped = testConfig.ungrouped || []
                    testConfig.ungrouped.push(val)
                }
            }

            persist()
            try { closeModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'true'); m.style.display = 'none' }
        }
        save.addEventListener('click', validateAndSave)
        cancel.addEventListener('click', () => { try { closeModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'true'); m.style.display = 'none' } })
    }

    function openGroupEditModal(group) {
        const editor = buildGroupEditorForm(group)

        const contentWrapper = document.createElement('div')
        contentWrapper.style.padding = '0 12px 12px 12px'
        contentWrapper.appendChild(editor.root)
        const err = document.createElement('div')
        err.style.color = '#b00020'
        err.style.marginTop = '6px'
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
        const h3 = m.querySelector('h3')
        h3.textContent = 'Edit Group'
        const body = m.querySelector('#author-tests-modal-body')
        body.innerHTML = ''
        body.appendChild(contentWrapper)

        try { openModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'false'); m.style.display = 'flex' }

        function validateAndSave() {
            const val = editor.get()
            const groupIdx = testConfig.groups.findIndex(g => g.id === group.id)
            if (groupIdx >= 0) {
                testConfig.groups[groupIdx] = { ...testConfig.groups[groupIdx], ...val }
                persist()
            }
            try { closeModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'true'); m.style.display = 'none' }
        }
        save.addEventListener('click', validateAndSave)
        cancel.addEventListener('click', () => { try { closeModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'true'); m.style.display = 'none' } })
    }

    function openNewTestModal(newItem) {
        const editor = buildEditorForm(newItem)

        // Populate the group selector
        const groupSelect = editor.root.querySelector('#group-selector')
        if (groupSelect) {
            populateGroupSelector(groupSelect, testConfig)
        }

        const contentWrapper = document.createElement('div')
        contentWrapper.style.padding = '0 12px 12px 12px'
        contentWrapper.appendChild(editor.root)

        const m = ensureModal()
        const header = m.querySelector('.modal-header')
        const h3 = header ? header.querySelector('h3') : null
        if (h3) h3.textContent = 'New Test'

        // Header message area for validation/failure messages
        let headerMessage = header ? header.querySelector('.modal-header-message') : null
        if (!headerMessage && header) {
            headerMessage = document.createElement('div')
            headerMessage.className = 'modal-header-message'
            headerMessage.style.color = '#b00020'
            headerMessage.style.fontSize = '0.9em'
            headerMessage.style.marginLeft = '12px'
            headerMessage.style.flex = '1'
            headerMessage.style.alignSelf = 'center'
            const actionHolder = header.querySelector('.modal-header-actions')
            header.insertBefore(headerMessage, actionHolder)
        }

        // Inject Save/Cancel into header action holder
        const actionHolder = header ? header.querySelector('.modal-header-actions') : null
        actionHolder && (actionHolder.innerHTML = '')
        const save = document.createElement('button')
        save.className = 'btn btn-primary'
        save.textContent = 'Save'
        const cancel = document.createElement('button')
        cancel.className = 'btn'
        cancel.textContent = 'Cancel'
        actionHolder && actionHolder.appendChild(save)
        actionHolder && actionHolder.appendChild(cancel)

        const body = m.querySelector('#author-tests-modal-body')
        body.innerHTML = ''
        body.appendChild(contentWrapper)

        try { openModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'false'); m.style.display = 'flex' }

        // Clear header message when any input in the editor changes (covers matcher edits)
        try {
            editor.root.addEventListener('input', () => { if (headerMessage) headerMessage.textContent = '' })
            editor.root.addEventListener('change', () => { if (headerMessage) headerMessage.textContent = '' })
        } catch (_e) { }

        function validateAndSave() {
            const val = editor.get()
            // Block save for AST tests whose matcher returned a non-boolean truthy value
            try {
                if ((val.type && val.type === 'ast') || val.astRule) {
                    const testResultEl = m && m.querySelector ? m.querySelector('.ast-rule-builder .test-result') : null
                    if (testResultEl && testResultEl.dataset && testResultEl.dataset.nonBoolean) {
                        if (headerMessage) headerMessage.textContent = 'Cannot save: AST matcher returned a non-boolean truthy value. Please make the matcher return true or false.'
                        return
                    }
                }
            } catch (_e) { /* ignore DOM-check failures */ }
            if (!val.id) val.id = genId()

            const selectedGroupId = val._selectedGroupId
            delete val._selectedGroupId // Remove the temporary field

            // Add to appropriate location
            if (selectedGroupId === '__ungrouped__') {
                testConfig.ungrouped = testConfig.ungrouped || []
                testConfig.ungrouped.push(val)
            } else {
                const targetGroup = testConfig.groups.find(g => g.id === selectedGroupId)
                if (targetGroup) {
                    targetGroup.tests.push(val)
                } else {
                    // Fallback to ungrouped if group not found
                    testConfig.ungrouped = testConfig.ungrouped || []
                    testConfig.ungrouped.push(val)
                }
            }

            persist()
            try { closeModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'true'); m.style.display = 'none' }
        }
        save.addEventListener('click', validateAndSave)
        cancel.addEventListener('click', () => { try { closeModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'true'); m.style.display = 'none' } })
    }

    function openNewGroupModal() {
        const newGroup = createGroup()

        // First group should always run by default
        if (!testConfig.groups || testConfig.groups.length === 0) {
            newGroup.conditional.runIf = 'always'
        }

        const editor = buildGroupEditorForm(newGroup)

        const contentWrapper = document.createElement('div')
        contentWrapper.style.padding = '0 12px 12px 12px'
        contentWrapper.appendChild(editor.root)

        const actions = document.createElement('div')
        actions.style.marginTop = '8px'
        const save = document.createElement('button')
        save.className = 'btn btn-primary'
        save.textContent = 'Create Group'
        const cancel = document.createElement('button')
        cancel.className = 'btn'
        cancel.textContent = 'Cancel'
        actions.appendChild(save)
        actions.appendChild(cancel)
        contentWrapper.appendChild(actions)

        const m = ensureModal()
        const h3 = m.querySelector('h3')
        h3.textContent = 'Create Group'
        const body = m.querySelector('#author-tests-modal-body')
        body.innerHTML = ''
        body.appendChild(contentWrapper)

        try { openModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'false'); m.style.display = 'flex' }

        function validateAndSave() {
            const val = editor.get()
            testConfig.groups = testConfig.groups || []
            testConfig.groups.push(val)
            persist()
            try { closeModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'true'); m.style.display = 'none' }
        }
        save.addEventListener('click', validateAndSave)
        cancel.addEventListener('click', () => { try { closeModalHelper(m) } catch (_e) { m.setAttribute('aria-hidden', 'true'); m.style.display = 'none' } })
    }

    // Button event listeners
    addBtn.addEventListener('click', () => {
        const newItem = {
            id: genId(),
            description: 'New test',
            stdin: '',
            expected_stdout: '',
            expected_stderr: '',
            timeoutMs: undefined,
            hide_actual_expected: false,
            conditional: { runIf: 'previous_passed', alwaysRun: false }
        }
        openNewTestModal(newItem)
    })

    addASTBtn.addEventListener('click', () => {
        const newItem = createDefaultASTTest()
        newItem.conditional = { runIf: 'previous_passed', alwaysRun: false }
        openNewTestModal(newItem)
    })

    addGroupBtn.addEventListener('click', () => {
        openNewGroupModal()
    })

    groupVisibilityCheck.addEventListener('change', () => {
        testConfig.showGroupsToUsers = groupVisibilityCheck.checked
        persist()
    })

    ta.addEventListener('input', () => {
        testConfig = parseTestsFromTextarea(ta)
        groupVisibilityCheck.checked = testConfig.showGroupsToUsers !== false
        try { jsonView.textContent = JSON.stringify(testConfig, null, 2) } catch (_e) { jsonView.textContent = '' }
        render()

        // Update global config when textarea is manually edited
        try {
            if (window.Config && window.Config.current) {
                window.Config.current.tests = testConfig
                logDebug('[author-tests] Updated window.Config.current.tests from textarea input', testConfig)
            }
        } catch (e) {
            logWarn('[author-tests] Failed to update global config from textarea:', e)
        }
    })

    try { jsonView.textContent = JSON.stringify(testConfig, null, 2) } catch (_e) { jsonView.textContent = '' }
    render()
}

export default { initAuthorTests }
