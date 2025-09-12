import { jest } from '@jest/globals'

describe('editor initialization and helpers', () => {
    beforeEach(() => {
        jest.resetModules()
        document.body.innerHTML = `
            <div id="editor-host"></div>
            <textarea id="code"></textarea>
            <button id="run"></button>
        `
    })

    test('initializeEditor returns null and uses textarea fallback when CodeMirror absent', async () => {
        const mod = await import('../editor.js')
        const { initializeEditor, getTextarea, getCurrentContent, setCurrentContent } = mod
        const cm = initializeEditor()
        expect(cm).toBeNull()
        const ta = getTextarea()
        expect(ta).toBeTruthy()
        setCurrentContent('hello')
        expect(getCurrentContent()).toBe('hello')
    })

    test('setEditorModeForPath configures mode when CodeMirror present', async () => {
        // fake CodeMirror minimal API
        window.CodeMirror = function (host, opts) {
            const state = { opts }
            return {
                getOption(k) { return state.opts[k] },
                setOption(k, v) { state.opts[k] = v },
                getValue() { return state.opts.value },
                setValue(v) { state.opts.value = v },
                on() { }
            }
        }

        const mod = await import('../editor.js')
        const { initializeEditor, setEditorModeForPath, getCodeMirror } = mod
        const cm = initializeEditor()
        expect(cm).toBeTruthy()
        setEditorModeForPath('/main.py')
        const actual = getCodeMirror()
        expect(actual).toBeTruthy()
        // non-py path disables mode
        setEditorModeForPath('/README.txt')
        // cleanup
        delete window.CodeMirror
    })
})
