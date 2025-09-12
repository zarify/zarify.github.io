import { jest } from '@jest/globals'

describe('editor module (initializeEditor / setEditorModeForPath)', () => {
    beforeEach(() => {
        // Ensure a clean DOM for each test
        document.body.innerHTML = ''
        // Create required DOM elements
        const textarea = document.createElement('textarea')
        textarea.id = 'code'
        document.body.appendChild(textarea)

        const host = document.createElement('div')
        host.id = 'editor-host'
        document.body.appendChild(host)

        const runBtn = document.createElement('button')
        runBtn.id = 'run'
        document.body.appendChild(runBtn)

        // Clean any previous globals
        delete window.CodeMirror
        delete window.cm
        delete window.setEditorModeForPath
        delete window.Feedback
    })

    test('initializeEditor falls back to textarea when CodeMirror not present', async () => {
        const mod = await import('../editor.js')
        const { initializeEditor, getTextarea, getCurrentContent } = mod

        const cm = initializeEditor()
        expect(cm).toBeNull()

        const ta = getTextarea()
        expect(ta).not.toBeNull()
        const content = getCurrentContent()
        expect(typeof content).toBe('string')
        expect(content.length).toBeGreaterThan(0)
    })

    test('initializeEditor with fake CodeMirror returns cm and syncs content', async () => {
        // Prepare a minimal fake CodeMirror implementation
        const createFakeCM = (initialOpts = {}) => {
            const options = { ...initialOpts }
            let value = ''
            const handlers = {}
            return {
                getOption: (k) => options[k],
                setOption: (k, v) => { options[k] = v },
                getValue: () => value,
                setValue: (v) => { value = v },
                on: (evt, cb) => { handlers[evt] = cb },
                _triggerChange: () => { if (handlers.change) handlers.change() },
                __getOptions: () => ({ ...options }),
            }
        }

        // Wire fake constructor on window
        window.CodeMirror = (host, opts = {}) => {
            // copy initial options so getOption/setOption operate against the same object
            const cm = createFakeCM(opts)
            // apply initial value if supplied
            if (opts && typeof opts.value !== 'undefined') cm.setValue(opts.value)
            return cm
        }

        // Provide a Feedback evaluator so scheduleFeedbackEvaluation doesn't throw
        window.Feedback = { evaluateFeedbackOnEdit: jest.fn() }

        const mod = await import('../editor.js')
        const { initializeEditor, getCodeMirror, getTextarea, setCurrentContent, getCurrentContent, setEditorModeForPath } = mod

        const cm = initializeEditor()
        expect(cm).not.toBeNull()
        expect(getCodeMirror()).toBeDefined()

        // set content via API and assert cm got it
        setCurrentContent('print(123)')
        // when CodeMirror is present, the code writes to cm; verify via cm.getValue
        const liveCm = getCodeMirror()
        expect(liveCm.getValue()).toBe('print(123)')
        expect(getCurrentContent()).toBe('print(123)')

        // set editor mode for .py path
        setEditorModeForPath('/main.py')
        expect(liveCm.getOption('mode')).toBe('python')
        expect(liveCm.getOption('smartIndent')).toBe(true)

        // Simulate a change from CodeMirror and verify textarea receives updated value and input event
        const ta = getTextarea()
        let inputEventCount = 0
        ta.addEventListener('input', () => { inputEventCount++ })

        liveCm.setValue('from cm')
        // trigger the stored change handler
        if (typeof liveCm._triggerChange === 'function') liveCm._triggerChange()

        expect(ta.value).toBe('from cm')
        expect(inputEventCount).toBeGreaterThanOrEqual(1)
    })
})
