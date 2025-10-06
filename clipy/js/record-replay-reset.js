// Utilities to reset record/replay state when switching configs/problems
import { getReplayEngine, getReplayUI } from './replay-ui.js'
import { getExecutionRecorder } from './execution-recorder.js'
import { appendTerminalDebug } from './terminal.js'

export function resetRecordReplayState() {
    try {
        const engine = (typeof getReplayEngine === 'function') ? getReplayEngine() : null
        const ui = (typeof getReplayUI === 'function') ? getReplayUI() : null
        const recorder = (typeof getExecutionRecorder === 'function') ? getExecutionRecorder() : null

        appendTerminalDebug('🔄 resetRecordReplayState() called')

        // Stop any active replay and clear engine traces/caches
        try {
            if (engine && engine.isReplaying && typeof engine.stopReplay === 'function') {
                engine.stopReplay()
            }
        } catch (e) { appendTerminalDebug('Failed to stop replay: ' + e) }

        try {
            if (engine) {
                // Preserve any existing originalTrace/executionTrace so that a
                // recently-completed recording remains available for replay UI.
                // Clearing those here was too aggressive and caused the inline
                // replay controls to lose their data mid-flow.
                //
                // Instead, clear only the cached AST/maps so they will be
                // rebuilt lazily when needed (e.g. from originalTrace.metadata).
                engine.lineReferenceMap = null
                engine.functionLocalMaps = null
                engine.lineFunctionMap = null

                // Clear and scrub any existing decorator caches so a subsequent
                // buildLineReferenceMap call will be allowed to seed from the
                // originalTrace.metadata.sourceCode. This prevents a stale
                // `_attemptedSeedFromTrace` flag from blocking rebuilds after
                // a config switch.
                if (engine.lineDecorator) {
                    try {
                        if (typeof engine.lineDecorator.clearAllDecorations === 'function') engine.lineDecorator.clearAllDecorations()
                    } catch (e) { appendTerminalDebug('Failed to clear line decorations: ' + e) }
                    try { engine.lineDecorator.lineReferenceMap = null } catch (e) { }
                    try { engine.lineDecorator.functionLocalMaps = null } catch (e) { }
                    try { engine.lineDecorator.lineFunctionMap = null } catch (e) { }
                    try { engine.lineDecorator._attemptedSeedFromTrace = false } catch (e) { }
                }
            }
        } catch (e) { appendTerminalDebug('Failed to clear engine state: ' + e) }

        // Update UI controls to reflect no recording available
        try {
            if (ui && typeof ui.updateReplayControls === 'function') ui.updateReplayControls(false)
        } catch (e) { appendTerminalDebug('Failed to update replay UI controls: ' + e) }

        // Clear any active recording and native trace callback
        try {
            if (recorder) {
                try {
                    // Always cleanup the native trace callback to avoid stray
                    // callbacks after a config switch. However, DO NOT clear the
                    // recorded trace (currentTrace) here - that trace may be
                    // actively shown by the replay UI and clearing it causes the
                    // UI to lose its recording unexpectedly. Tests and UX expect
                    // recorded traces to persist until explicitly cleared.
                    if (typeof recorder.cleanupNativeTraceCallback === 'function') recorder.cleanupNativeTraceCallback()
                } catch (e) { appendTerminalDebug('Failed to cleanup native trace callback: ' + e) }

                // Do not call recorder.clearRecording() here. The UI and replay
                // engine should decide when to clear recordings (e.g., on code
                // edits or explicit user action). Removing the recording on
                // config changes led to the observed missing-variable issues.
            }
        } catch (e) { appendTerminalDebug('Failed to clear recorder state: ' + e) }

        // Keep global singletons (window.ReplayEngine / window.ReplayUI) intact.
        // We clear their internal state above. Deleting the global instances
        // causes other startup code to miss the UI (the inline "Replay" button
        // won't be updated when a recording finishes). This method should only
        // reset internal caches/state rather than removing the exposed objects.

        appendTerminalDebug('✅ Record/replay state reset')
    } catch (err) {
        try { appendTerminalDebug('❌ resetRecordReplayState failed: ' + err) } catch (_) { }
    }
}

export default { resetRecordReplayState }
