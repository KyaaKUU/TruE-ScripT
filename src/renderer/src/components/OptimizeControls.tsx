import React, { useCallback, useEffect, useRef } from 'react'
import { useAppStore, SnapshotEntry, KNOWN_GAMES } from '../store/useAppStore'

const PROTECTED = new Set([
  'system','idle','smss','csrss','wininit','winlogon','lsass','lsaiso',
  'services','svchost','registry','msmpeng','audiodg','dwm','fontdrvhost',
  'ntoskrnl','spoolsv','searchindexer','trustedinstaller','wuauclt',
  'taskhost','taskhostw','sihost','ctfmon','runtimebroker',
  'securityhealthservice','securityhealthsystray','sgrmbroker',
  'wmiprvse','conhost','dllhost','consent','msiexec','usoclient','sdclt'
])
const isProtected = (name: string) => PROTECTED.has(name.toLowerCase().replace('.exe', ''))

export const OptimizeControls: React.FC = () => {
  const {
    processes, selectedGamePid, selectedGameName, preset,
    isOptimized, isOptimizing, isRestoring, snapshot,
    saveSnapshot, setIsOptimized, setIsOptimizing, setIsRestoring,
    clearSnapshot, addStatusEntry, clearStatusFeed
  } = useAppStore()

  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-restore watcher
  useEffect(() => {
    if (!isOptimized || selectedGamePid === null) {
      if (monitorRef.current) clearInterval(monitorRef.current)
      return
    }
    monitorRef.current = setInterval(async () => {
      const running = await window.api.getProcesses()
      if (!running.some(p => p.pid === selectedGamePid)) {
        addStatusEntry({ pid: 0, name: 'monitor', status: 'pending',
          message: `[WATCH] game process exited (pid=${selectedGamePid}) — triggering auto-restore` })
        await doRestore()
      }
    }, 5000)
    return () => { if (monitorRef.current) clearInterval(monitorRef.current) }
  }, [isOptimized, selectedGamePid])

  const handleOptimize = useCallback(async () => {
    if (!selectedGamePid || isOptimizing || isRestoring || isOptimized) return
    setIsOptimizing(true)
    clearStatusFeed()

    const snap: SnapshotEntry[] = processes
      .filter(p => !isProtected(p.name))
      .map(p => ({ pid: p.pid, name: p.name, priority: p.priority || 'Normal', ioNormal: true }))
    saveSnapshot(snap)

    const bgProcs = processes
      .filter(p => p.pid !== selectedGamePid && !isProtected(p.name))
      .map(p => ({ pid: p.pid, name: p.name }))

    const totalTargets = bgProcs.length + 1

    // Phase 1: Init
    addStatusEntry({ pid: 0, name: 'truescript', status: 'pending',
      message: `[INIT] preset=${preset.toUpperCase()} · targets=${totalTargets} processes · snapshot saved` })

    // Phase 2: Compose
    const presetMap = { minimum: 'GAME→HIGH  BG→NORMAL  IO→default', normal: 'GAME→HIGH  BG→BELOW_NORMAL  IO→LOW', maximum: 'GAME→HIGH  BG→IDLE  IO→LOW' }
    addStatusEntry({ pid: 0, name: 'scheduler', status: 'pending',
      message: `[PLAN] ${presetMap[preset]}` })

    const t0 = performance.now()

    try {
      // Phase 3: Dispatch
      addStatusEntry({ pid: 0, name: 'powershell', status: 'pending',
        message: `[EXEC] dispatching single-batch script → ${totalTargets} pid entries` })

      const results = await window.api.batchOptimize(selectedGamePid, selectedGameName || 'game', bgProcs, preset)

      const elapsed = Math.round(performance.now() - t0)

      // Phase 4: Per-process results
      for (const r of results) {
        const isGame = r.pid === selectedGamePid
        addStatusEntry({
          pid: r.pid, name: r.name,
          status: r.skipped ? 'skipped' : r.success ? 'success' : 'failed',
          message: r.skipped
            ? `[SKIP] ${r.reason || 'protected system process — untouched'}`
            : r.success
              ? isGame
                ? `[SET] priority=${preset === 'minimum' ? 'HIGH' : 'HIGH'} · game process boosted`
                : `[SET] priority=${preset === 'minimum' ? 'NORMAL' : preset === 'normal' ? 'BELOW_NORMAL' : 'IDLE'}${preset !== 'minimum' ? ' · io=LOW' : ''}`
              : `[FAIL] ${r.reason ?? 'unknown error'}`
        })
      }

      // Phase 5: Summary
      const ok      = results.filter(r => r.success).length
      const failed  = results.filter(r => !r.success && !r.skipped).length
      const skipped = results.filter(r => r.skipped).length
      addStatusEntry({ pid: 0, name: 'truescript', status: 'success',
        message: `[DONE] ${ok} set · ${failed} err · ${skipped} skip · elapsed=${elapsed}ms` })
      setIsOptimized(true)
    } catch (err) {
      const elapsed = Math.round(performance.now() - t0)
      addStatusEntry({ pid: 0, name: 'truescript', status: 'failed',
        message: `[FATAL] ${String(err)} (${elapsed}ms)` })
    } finally {
      setIsOptimizing(false)
    }
  }, [selectedGamePid, selectedGameName, processes, preset, isOptimizing, isRestoring, isOptimized,
      saveSnapshot, addStatusEntry, clearStatusFeed, setIsOptimizing, setIsOptimized])

  const doRestore = useCallback(async () => {
    if (snapshot.length === 0) return
    setIsRestoring(true)

    const t0 = performance.now()
    addStatusEntry({ pid: 0, name: 'truescript', status: 'pending',
      message: `[RESTORE] snapshot=${snapshot.length} entries · reverting all priority changes` })
    addStatusEntry({ pid: 0, name: 'powershell', status: 'pending',
      message: `[EXEC] dispatching restore batch script → ${snapshot.filter(e => !isProtected(e.name)).length} pid entries` })

    try {
      const results = await window.api.restoreSnapshot(snapshot)
      const elapsed = Math.round(performance.now() - t0)

      for (const r of results) {
        addStatusEntry({
          pid: r.pid, name: r.name,
          status: r.skipped ? 'skipped' : r.success ? 'success' : 'failed',
          message: r.skipped
            ? `[SKIP] ${r.reason || 'not found — may have exited'}`
            : r.success
              ? `[RST] priority restored to original`
              : `[FAIL] ${r.reason ?? 'unknown error'}`
        })
      }

      const ok      = results.filter(r => r.success).length
      const failed  = results.filter(r => !r.success && !r.skipped).length
      const skipped = results.filter(r => r.skipped).length
      addStatusEntry({ pid: 0, name: 'truescript', status: 'success',
        message: `[DONE] ${ok} restored · ${failed} err · ${skipped} skip · elapsed=${elapsed}ms` })
    } catch (err) {
      const elapsed = Math.round(performance.now() - t0)
      addStatusEntry({ pid: 0, name: 'truescript', status: 'failed',
        message: `[FATAL] ${String(err)} (${elapsed}ms)` })
    } finally {
      clearSnapshot()
      setIsOptimized(false)
      setIsRestoring(false)
      if (monitorRef.current) clearInterval(monitorRef.current)
    }
  }, [snapshot, addStatusEntry, clearSnapshot, setIsOptimized, setIsRestoring])

  const canOptimize = selectedGamePid !== null && !isOptimized && !isOptimizing && !isRestoring
  const canRestore  = isOptimized && snapshot.length > 0 && !isRestoring && !isOptimizing
  const displayName = selectedGameName
    ? (KNOWN_GAMES[selectedGameName.toLowerCase().replace('.exe', '')] || selectedGameName)
    : null

  return (
    <div className="card" style={{ padding: '14px', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div className="icon-box" style={{
          width: 28, height: 28,
          background: isOptimized ? 'var(--green-dim)' : 'var(--accent-subtle)',
          border: `1px solid ${isOptimized ? 'var(--green-border)' : 'var(--accent-border)'}`,
          transition: 'all 0.25s'
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
              stroke={isOptimized ? 'var(--green)' : 'var(--accent)'}
              strokeWidth="2" fill="none"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {isOptimized ? 'Optimized & Monitoring' : 'Optimization Engine'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
            {isOptimized
              ? `Watching ${selectedGameName || 'game'} for exit…`
              : selectedGamePid
              ? `Ready — ${displayName || selectedGameName}`
              : 'Select a game process to begin'}
          </div>
        </div>
      </div>

      {/* Target game display */}
      {selectedGamePid ? (
        <GameTargetCard
          displayName={displayName}
          processName={selectedGameName}
          pid={selectedGamePid}
          isOptimized={isOptimized}
        />
      ) : (
        <EmptyTarget />
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {/* Optimize */}
        <button
          onClick={handleOptimize}
          disabled={!canOptimize}
          className={`btn flex-1 ${isOptimized ? 'btn-ghost' : 'btn-accent'}`}
          style={{
            height: 42,
            fontSize: 13,
            boxShadow: canOptimize ? '0 4px 24px var(--accent-glow)' : 'none',
            transition: 'all 0.18s'
          }}
        >
          {isOptimizing ? (
            <>
              <Spinner color="rgba(255,255,255,0.7)" />
              Optimizing…
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" fill="currentColor"/>
              </svg>
              {isOptimized ? 'Optimized ✓' : 'Optimize'}
            </>
          )}
        </button>

        {/* Restore */}
        <button
          onClick={() => doRestore()}
          disabled={!canRestore}
          className="btn btn-danger"
          style={{ height: 42, fontSize: 13, minWidth: 100 }}
        >
          {isRestoring ? (
            <>
              <Spinner color="var(--red)" />
              Restoring…
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Restore
            </>
          )}
        </button>
      </div>

      {/* Auto-restore notice */}
      {isOptimized && (
        <div
          className="animate-fade-in-up"
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            marginTop: 10,
            padding: '7px 10px',
            borderRadius: 8,
            background: 'rgba(0,229,160,0.04)',
            border: '1px solid rgba(0,229,160,0.15)'
          }}
        >
          <div className="status-dot active" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>Auto-restore active — </span>
            priorities reset when game exits
          </span>
        </div>
      )}
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────────────────────── */
const GameTargetCard: React.FC<{
  displayName: string | null
  processName: string | null
  pid: number
  isOptimized: boolean
}> = ({ displayName, processName, pid, isOptimized }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    background: isOptimized ? 'rgba(0,229,160,0.05)' : 'var(--bg-surface)',
    border: `1px solid ${isOptimized ? 'var(--green-border)' : 'var(--border-bright)'}`,
    transition: 'all 0.3s'
  }}>
    {/* Icon */}
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      background: isOptimized ? 'var(--green-dim)' : 'var(--accent-subtle)',
      border: `1px solid ${isOptimized ? 'var(--green-border)' : 'var(--accent-border)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.3s'
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="7" width="20" height="10" rx="3" stroke={isOptimized ? 'var(--green)' : 'var(--accent)'} strokeWidth="2"/>
        <circle cx="8.5" cy="12" r="1.5" fill={isOptimized ? 'var(--green)' : 'var(--accent)'}/>
        <path d="M15 10v4M13 12h4" stroke={isOptimized ? 'var(--green)' : 'var(--accent)'} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    </div>

    {/* Text */}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 13, fontWeight: 700, color: isOptimized ? 'var(--green)' : 'var(--text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        transition: 'color 0.3s'
      }}>
        {displayName || processName}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
        {processName} · PID {pid}
      </div>
    </div>

    {/* Priority badge */}
    <div className="badge" style={{
      background: isOptimized ? 'var(--green-dim)' : 'var(--orange-dim)',
      color: isOptimized ? 'var(--green)' : 'var(--orange)',
      borderColor: isOptimized ? 'var(--green-border)' : 'rgba(255,140,66,0.35)',
      transition: 'all 0.3s'
    }}>
      {isOptimized ? 'HIGH' : 'NORM'}
    </div>
  </div>
)

const EmptyTarget: React.FC = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '12px',
    borderRadius: 10,
    background: 'var(--bg-surface)',
    border: '1.5px dashed var(--border-bright)',
    color: 'var(--text-muted)',
    fontSize: 11
  }}>
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
    Select a game from the process scanner
  </div>
)

const Spinner: React.FC<{ color: string }> = ({ color }) => (
  <div className="animate-spin" style={{
    width: 13, height: 13,
    border: `2px solid rgba(255,255,255,0.1)`,
    borderTopColor: color,
    borderRadius: '50%'
  }} />
)
