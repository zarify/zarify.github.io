import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { execFile } from 'child_process'
const execFileP = promisify(execFile)

test('integration: loadMicroPythonRuntime vendor load path in fresh process', async () => {
    // __dirname is not defined in ESM; compute repo root relative to this file's directory
    const fileDir = path.dirname(new URL(import.meta.url).pathname)
    const repoRoot = path.resolve(fileDir, '../../..')
    const vendorPath = path.join(repoRoot, 'src', 'vendor', 'micropython.mjs')
    const tmpDir = path.join(repoRoot, 'tmp')
    const runnerPath = path.join(tmpDir, 'test-load-mp.mjs')

    // Ensure tmp dir exists
    fs.mkdirSync(tmpDir, { recursive: true })

    // Backup original vendor file
    const orig = fs.readFileSync(vendorPath, 'utf8')

    // Stub module: expose globalThis.loadMicroPython returning a small mpInstance
    const stub = `globalThis.loadMicroPython = async (opts) => ({
  FS: {},
  runPythonAsync: async (code) => 'ok:' + code,
  runPython: (code) => 'ok-sync:' + code,
  interruptExecution: () => {},
  setYielding: () => {},
  clearInterrupt: () => {},
  registerJsModule: () => {}
});
export {}`

    // Runner script (ESM) that imports the module under test and calls the loader
    const runner = `import { loadMicroPythonRuntime, getRuntimeAdapter } from '../src/js/micropython.js';
;(async () => {
  try {
    await loadMicroPythonRuntime({ runtime: { wasm: './src/vendor/micropython.wasm' } })
    const ra = getRuntimeAdapter()
    if (!ra) { console.error('NO_ADAPTER'); process.exit(2) }
    console.log('LOADED_OK')
    process.exit(0)
  } catch (e) {
    console.error('ERROR', e && e.stack ? e.stack : e)
    process.exit(3)
  }
})();`

    try {
        // Write stub vendor file and runner
        fs.writeFileSync(vendorPath, stub, 'utf8')
        fs.writeFileSync(runnerPath, runner, 'utf8')

        // Execute fresh Node ESM process to run the runner
        const node = process.execPath
        const args = ['--experimental-vm-modules', runnerPath]
        const { stdout, stderr } = await execFileP(node, args, { cwd: repoRoot, maxBuffer: 10 * 1024 * 1024 })

        // Assert the runner printed success
        if (!stdout.includes('LOADED_OK')) {
            throw new Error('Child process did not report success. stdout: ' + stdout + '\nstderr: ' + stderr)
        }
    } finally {
        // Restore original vendor file and cleanup
        try { fs.writeFileSync(vendorPath, orig, 'utf8') } catch (e) { }
        try { fs.unlinkSync(runnerPath) } catch (e) { }
    }
})
