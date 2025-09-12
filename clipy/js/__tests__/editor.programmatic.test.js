import { jest } from '@jest/globals'

describe('editor programmatic API interactions', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = `
            <div id="editor-host"></div>
            <textarea id="code"></textarea>
            <button id="run"></button>
        `
        // minimal config mock
        const fakeConfig = { starter: '' }
        jest.unstable_mockModule('../config.js', () => ({ getConfig: () => fakeConfig }))
        jest.unstable_mockModule('../logger.js', () => ({ info: () => { }, warn: () => { }, error: () => { } }))
    })

    afterEach(() => {
        try { delete window.CodeMirror } catch (_) { }
    })

    test('setCurrentContent updates textarea when CodeMirror is absent', async () => {
        const mod = await import('../editor.js')
        const { initializeEditor, setCurrentContent, getCurrentContent, getTextarea } = mod

        const cm = initializeEditor()
        // when CodeMirror is absent initializeEditor returns null
        expect(cm).toBeNull()

        setCurrentContent('hello-world')
        expect(getCurrentContent()).toBe('hello-world')
        const ta = getTextarea()
        expect(ta.value).toBe('hello-world')
    })

    test('setEditorModeForPath sets python mode for .py and disables for others', async () => {
        // fake CodeMirror with option storage
        function FakeCM() {
            const opts = { value: '' }
            return {
                getOption(k) { return opts[k] },
                setOption(k, v) { opts[k] = v },
                getValue() { return opts.value },
                setValue(v) { opts.value = v },
                on() { }
            }
        }
        window.CodeMirror = (host, opts) => {
            // seed initial value
            const cm = FakeCM()
            if (opts && typeof opts.value !== 'undefined') cm.setValue(opts.value)
            return cm
        }

        const mod = await import('../editor.js')
        const { initializeEditor, setEditorModeForPath, getCodeMirror } = mod
        const cm = initializeEditor()
        expect(cm).toBeTruthy()

        setEditorModeForPath('/main.py')
        const live = getCodeMirror()
        expect(live.getOption('mode')).toBe('python')
        expect(live.getOption('smartIndent')).toBe(true)

        setEditorModeForPath('/notes.txt')
        expect(live.getOption('mode')).toBeNull()
        expect(live.getOption('smartIndent')).toBe(false)
    })

    test('programmatic textarea changes are detected and mirrored to CodeMirror', async () => {
        jest.useFakeTimers()

        // fake CodeMirror that records setValue calls
        function FakeCMRecorder() {
            const opts = { value: '' }
            const calls = []
            return {
                getOption() { return undefined },
                setOption() { },
                getValue() { return opts.value },
                setValue(v) { opts.value = v; calls.push(v) },
                on() { },
                __getCalls() { return calls }
            }
        }

        window.CodeMirror = (host, opts) => {
            const cm = FakeCMRecorder()
            if (opts && typeof opts.value !== 'undefined') cm.setValue(opts.value)
            return cm
        }

        const mod = await import('../editor.js')
        const { initializeEditor, getTextarea, getCodeMirror } = mod
        const cm = initializeEditor()
        const ta = getTextarea()
        const live = getCodeMirror()

        // programmatic change
        ta.value = 'programmatic-change'

        // advance timers to allow interval (50ms) to run
        jest.advanceTimersByTime(60)

        expect(live.__getCalls()).toContain('programmatic-change')

        jest.useRealTimers()
    })
})
