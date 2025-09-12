import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { execFile } from 'child_process'
const execFileP = promisify(execFile)

test('integration: vendored runtime exposes interrupt/yielding and run APIs in fresh process', async () => {
    const fileDir = path.dirname(new URL(import.meta.url).pathname)
    const repoRoot = path.resolve(fileDir, '../../..')
    const vendorPath = path.join(repoRoot, 'src', 'vendor', 'micropython.mjs')
    const tmpDir = path.join(repoRoot, 'tmp')
    const runnerPath = path.join(tmpDir, 'test-load-mp-interrupt.mjs')

    fs.mkdirSync(tmpDir, { recursive: true })

    const orig = fs.readFileSync(vendorPath, 'utf8')

    // Stub: asyncify-like mpInstance with observable side-effects and FS
    const stub = `globalThis.loadMicroPython = async (opts) => ({
  FS: {
    _store: {},
    createDataFile(parent, name, data, canRead, canWrite) {
      const path = (parent === '/' ? '' : parent) + '/' + name
      this._store[path] = data
      return true
    }
  },
  runPythonAsync: async (code) => 'stub-async:' + code,
  runPython: (code) => 'stub-sync:' + code,
  interruptExecution: () => { console.log('INTERRUPT_CALLED') },
  setYielding: () => { console.log('YIELDING_SET') },
  clearInterrupt: () => { console.log('INTERRUPT_CLEARED') },
  // store registered modules so FS hooks can call back into them if needed
  __registered: {},
  registerJsModule(name, mod) { this.__registered[name] = mod },
  registerJsModule: function (name, mod) { this.__registered[name] = mod },
});
export {}
`

    // Runner: load runtime, inspect adapter, call APIs and print markers
    const runner = `// Provide minimal globals expected by micropython.js
globalThis.window = globalThis
globalThis.appendTerminal = (c,t) => { try { console.log('TERM:' + String(c).slice(0,200)) } catch (_) {} }
globalThis.appendTerminalDebug = () => {}
// Notification sink to be invoked by filesystem wrapper
globalThis.__ssg_notify_file_written = (p, c) => { try { console.log('NOTIFIED:' + p + ':' + String(c).slice(0,200)) } catch (_) {} }

import { loadMicroPythonRuntime, getRuntimeAdapter } from '../src/js/micropython.js';
;(async () => {
  try {
    await loadMicroPythonRuntime({ runtime: { wasm: './src/vendor/micropython.wasm' } })
    const ra = getRuntimeAdapter()
    if (!ra) { console.error('NO_ADAPTER'); process.exit(2) }

    // Check runPythonAsync
    if (typeof ra.runPythonAsync !== 'function') { console.error('NO_RUN_ASYNC'); process.exit(3) }
    const res = await ra.runPythonAsync('hello')
    console.log('RUN_ASYNC_RESULT:' + res)

    // Check run (sync)
    if (typeof ra.run !== 'function') { console.error('NO_RUN_SYNC'); process.exit(4) }
    const res2 = await ra.run('sync')
    console.log('RUN_SYNC_RESULT:' + res2)

  // Check interrupt/yielding functions
    if (ra.interruptExecution) {
      ra.interruptExecution()
      console.log('INTERRUPT_INVOKED')
    } else {
      console.log('NO_INTERRUPT_API')
    }

    if (ra.setYielding) {
      ra.setYielding(true)
      console.log('SET_YIELDING_INVOKED')
    }

    // Install host notifier to capture filesystem notifications
    window.__ssg_notify_file_written = (p, c) => {
      try { console.log('NOTIFIED:' + p + ':' + String(c).slice(0, 200)) } catch (_e) { }
    }

    // Trigger a filesystem write via createDataFile; the runtime's FS wrapper
    // should call the host notifier that micropython.js registers.
    try {
      if (ra._module && ra._module.FS && typeof ra._module.FS.createDataFile === 'function') {
        ra._module.FS.createDataFile('/', 'test-notify.txt', 'hello-notify', true, true)
        console.log('CREATE_DATAFILE_DONE')
      } else {
        console.log('NO_FS_CREATE')
      }
    } catch (e) {
      console.error('FS_WRITE_ERROR', e)
    }

    process.exit(0)
  } catch (e) {
    console.error('ERROR', e && e.stack ? e.stack : e)
    process.exit(5)
  }
})();`

    try {
        fs.writeFileSync(vendorPath, stub, 'utf8')
        fs.writeFileSync(runnerPath, runner, 'utf8')

        const node = process.execPath
        const args = ['--experimental-vm-modules', runnerPath]
        const { stdout, stderr } = await execFileP(node, args, { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 })

        if (!stdout.includes('RUN_ASYNC_RESULT:stub-async:hello')) {
            throw new Error('Child did not report expected async run. stdout: ' + stdout + '\nstderr: ' + stderr)
        }
        // The adapter.run implementation prefers runPythonAsync when available,
        // so accept either the async-prefixed or sync-prefixed result here.
        if (!(stdout.includes('RUN_SYNC_RESULT:stub-sync:sync') || stdout.includes('RUN_SYNC_RESULT:stub-async:sync'))) {
            throw new Error('Child did not report expected sync/async run result. stdout: ' + stdout + '\nstderr: ' + stderr)
        }
        if (!stdout.includes('INTERRUPT_CALLED') || !stdout.includes('INTERRUPT_INVOKED')) {
            throw new Error('Interrupt was not invoked/observed. stdout: ' + stdout + '\nstderr: ' + stderr)
        }
    } finally {
        try { fs.writeFileSync(vendorPath, orig, 'utf8') } catch (e) { }
        try { fs.unlinkSync(runnerPath) } catch (e) { }
    }
})
