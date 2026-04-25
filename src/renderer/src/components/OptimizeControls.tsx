import React, { useCallback, useEffect } from 'react'
import { useAppStore, SnapshotEntry, KNOWN_GAMES } from '../store/useAppStore'

const PROTECTED = new Set([
  'system','idle','smss','csrss','wininit','winlogon','lsass','lsaiso',
  'services','svchost','registry','msmpeng','audiodg','dwm','fontdrvhost',
  'ntoskrnl','spoolsv','searchindexer','trustedinstaller','wuauclt',
  'taskhost','taskhostw','sihost','ctfmon','runtimebroker',
  'securityhealthservice','securityhealthsystray','sgrmbroker',
  'wmiprvse','conhost','dllhost','consent','msiexec','usoclient','sdclt',
  'explorer','taskmgr','electron','true script','truescript',
  'nvdisplay.container','rtss','hoyoplay','starrail','easyanticheat'
])
const isProtected = (name: string) => PROTECTED.has(name.toLowerCase().replace('.exe', ''))

export const OptimizeControls: React.FC = () => {
  const {
    processes, selectedGamePid, selectedGameName, preset,
    isOptimized, isOptimizing, isRestoring, snapshot,
    watcherActive, autoRestoreCount, isShuttingDown,
    saveSnapshot, setIsOptimized, setIsOptimizing, setIsRestoring,
    clearSnapshot, addStatusEntry, clearStatusFeed,
    setWatcherActive, incrementAutoRestoreCount, setIsShuttingDown
  } = useAppStore()

  // ── Subscribe to backend watcher events ─────────────────────────────────────
  useEffect(() => {
    // Watcher confirmed active by backend
    const unsubStarted = window.api.onWatcherStarted(() => {
      setWatcherActive(true)
    })

    // Watcher stopped (manual or post-restore)
    const unsubStopped = window.api.onWatcherStopped(() => {
      setWatcherActive(false)
    })

    // Backend detected game exit → auto-restore firing
    const unsubAutoRestoring = window.api.onWatcherAutoRestoring((data) => {
      setIsRestoring(true)
      setWatcherActive(false)
      addStatusEntry({
        pid: 0, name: 'monitor', status: 'pending',
        message: `[WATCH] game process exited (pid=${data.pid}) — triggering auto-restore`
      })
    })

    // Backend finished the auto-restore
    const unsubRestored = window.api.onWatcherRestored((data) => {
      incrementAutoRestoreCount()
      addStatusEntry({
        pid: 0, name: 'monitor', status: 'success',
        message: `[WATCH] auto-restore complete — ${data.snapshotLength} entries restored`
      })
      clearSnapshot()
      setIsOptimized(false)
      setIsRestoring(false)
    })

    // Shutdown sequence events
    const unsubShutdown = window.api.onShutdownStarted(() => {
      setIsShuttingDown(true)
      addStatusEntry({
        pid: 0, name: 'truescript', status: 'pending',
        message: '[SHUTDOWN] initiating graceful shutdown…'
      })
    })

    const unsubRestoring = window.api.onRestoringBeforeQuit(() => {
      setIsRestoring(true)
      addStatusEntry({
        pid: 0, name: 'truescript', status: 'pending',
        message: '[SHUTDOWN] restoring all priorities before quit…'
      })
    })

    const unsubRestoreComplete = window.api.onRestoreComplete(() => {
      setIsRestoring(false)
      addStatusEntry({
        pid: 0, name: 'truescript', status: 'success',
        message: '[SHUTDOWN] restore complete — quitting'
      })
    })

    return () => {
      unsubStarted()
      unsubStopped()
      unsubAutoRestoring()
      unsubRestored()
      unsubShutdown()
      unsubRestoring()
      unsubRestoreComplete()
    }
  }, [])

  // ── Optimize ─────────────────────────────────────────────────────────────────
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
      message: `[INIT] preset=${preset.toUpperCase()} · ${totalTargets} processes targeted · snapshot saved` })

    // Phase 2: Plan summary
    const presetMap = {
      minimum: 'game=High · bg=Normal · io=unchanged · 1ms timer · sys profile',
      normal:  'game=High · bg=Low · io=unchanged · 1ms timer · core unpark · net throttle off',
      maximum: 'game=Very High · bg=Low · io=Low+Trim · MMCSS · High Perf plan · all fixes'
    }
    addStatusEntry({ pid: 0, name: 'scheduler', status: 'pending',
      message: `[PLAN] ${presetMap[preset]}` })

    const t0 = performance.now()

    try {
      // Phase 3: Dispatch
      addStatusEntry({ pid: 0, name: 'powershell', status: 'pending',
        message: `[EXEC] dispatching single-batch script → ${totalTargets} pid entries` })

      const results = await window.api.batchOptimize(selectedGamePid!, selectedGameName!, bgProcs, preset)

      const elapsed = Math.round(performance.now() - t0)

      // Phase 4: Per-process results
      for (const r of results) {
        const isGame = r.pid === selectedGamePid
        addStatusEntry({
          pid: r.pid, name: r.name,
          status: r.skipped ? 'skipped' : r.success ? 'success' : 'failed',
          message: r.skipped
            ? `[SKIP] ${r.reason || 'protected — untouched'}`
            : r.success
              ? isGame
                ? `[SET] priority → ${preset === 'maximum' ? 'Very High' : 'High'} (game boosted)`
                : `[SET] priority → ${preset === 'minimum' ? 'Normal' : 'Low'}${preset === 'maximum' ? ' · io → Low · RAM trimmed' : ''}`
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

      // Phase 6: System-level stability features applied
      const stabilityMap: Record<string, string> = {
        minimum: `[SYS] 1ms timer · CPU boost enabled · Games system profile`,
        normal:  `[SYS] 1ms timer · CPU boost · all cores unparked · net throttle off · GameDVR suppressed`,
        maximum: `[SYS] 1ms timer · CPU boost · all cores unparked · net off · MMCSS registered · High Perf power plan`
      }
      addStatusEntry({ pid: 0, name: 'system', status: 'success',
        message: stabilityMap[preset] })

      // ── Hand off monitoring to the backend watcher ──────────────────────────
      addStatusEntry({ pid: 0, name: 'monitor', status: 'pending',
        message: `[WATCH] backend watcher started — polling PID ${selectedGamePid} every 5s` })
      window.api.startWatcher(selectedGamePid, snap)

    } catch (err) {
      const elapsed = Math.round(performance.now() - t0)
      addStatusEntry({ pid: 0, name: 'truescript', status: 'failed',
        message: `[FATAL] ${String(err)} (${elapsed}ms)` })
    } finally {
      setIsOptimizing(false)
    }
  }, [selectedGamePid, selectedGameName, processes, preset, isOptimizing, isRestoring, isOptimized,
      saveSnapshot, addStatusEntry, clearStatusFeed, setIsOptimizing, setIsOptimized])

  // ── Manual Restore (UI button) ────────────────────────────────────────────────
  const handleRestore = useCallback(async () => {
    if (snapshot.length === 0 || isRestoring || isOptimizing) return
    setIsRestoring(true)

    const t0 = performance.now()
    addStatusEntry({ pid: 0, name: 'truescript', status: 'pending',
      message: `[RESTORE] reverting ${snapshot.length} processes to original state` })
    addStatusEntry({ pid: 0, name: 'powershell', status: 'pending',
      message: `[EXEC] restore batch → ${snapshot.filter(e => !isProtected(e.name)).length} processes` })

    try {
      // Delegate to backend (also stops watcher via watcher:manualRestore)
      const results = await window.api.manualRestore(snapshot)
      const elapsed = Math.round(performance.now() - t0)

      for (const r of results) {
        addStatusEntry({
          pid: r.pid, name: r.name,
          status: r.skipped ? 'skipped' : r.success ? 'success' : 'failed',
          message: r.skipped
            ? `[SKIP] ${r.reason || 'process already exited'}`
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
      addStatusEntry({ pid: 0, name: 'system', status: 'success',
        message: `[RST] 1ms timer released · system profile reset · net throttle restored · power plan → Balanced` })
    } catch (err) {
      const elapsed = Math.round(performance.now() - t0)
      addStatusEntry({ pid: 0, name: 'truescript', status: 'failed',
        message: `[FATAL] ${String(err)} (${elapsed}ms)` })
    } finally {
      clearSnapshot()
      setIsOptimized(false)
      setIsRestoring(false)
    }
  }, [snapshot, addStatusEntry, clearSnapshot, setIsOptimized, setIsRestoring, isRestoring, isOptimizing])

  // ── Shutdown ──────────────────────────────────────────────────────────────────
  const handleShutdown = useCallback(() => {
    if (isShuttingDown) return
    window.api.shutdownApp()
  }, [isShuttingDown])

  // ── Derived state ─────────────────────────────────────────────────────────────
  const canOptimize = selectedGamePid !== null && selectedGameName !== null && !isOptimized && !isOptimizing && !isRestoring && !isShuttingDown
  const canRestore  = isOptimized && snapshot.length > 0 && !isRestoring && !isOptimizing && !isShuttingDown
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
            {isShuttingDown ? 'Shutting Down…' : isOptimized ? 'Optimized & Monitoring' : 'Optimization Engine'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
            {isShuttingDown
              ? 'Restoring priorities before exit…'
              : isOptimized
              ? `Backend watcher active — watching PID ${selectedGamePid}`
              : selectedGamePid
              ? `Ready — ${displayName || selectedGameName}`
              : 'Select a game process to begin'}
          </div>
        </div>

        {/* Auto-restore counter badge */}
        {autoRestoreCount > 0 && (
          <div style={{
            marginLeft: 'auto',
            fontSize: 9,
            color: 'var(--green)',
            background: 'var(--green-dim)',
            border: '1px solid var(--green-border)',
            borderRadius: 6,
            padding: '2px 8px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700
          }}>
            {autoRestoreCount}× restored
          </div>
        )}
      </div>

      {/* Target game display */}
      {selectedGamePid ? (
        <GameTargetCard
          displayName={displayName}
          processName={selectedGameName}
          pid={selectedGamePid}
          isOptimized={isOptimized}
          preset={preset}
        />
      ) : (
        <EmptyTarget />
      )}

      {/* ── Primary action buttons (Optimize + Restore) ── */}
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
          onClick={handleRestore}
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

      {/* ── Shutdown button ── */}
      <button
        onClick={handleShutdown}
        disabled={isShuttingDown}
        className="btn btn-ghost"
        style={{
          width: '100%',
          height: 34,
          marginTop: 7,
          fontSize: 11,
          color: isShuttingDown ? 'var(--text-muted)' : 'var(--red)',
          borderColor: isShuttingDown ? 'var(--border)' : 'rgba(255,77,109,0.3)',
          gap: 6
        }}
      >
        {isShuttingDown ? (
          <>
            <Spinner color="var(--red)" />
            Shutting down…
          </>
        ) : (
          <>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="12" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Restore & Shutdown App
          </>
        )}
      </button>

      {/* Auto-restore notice */}
      {isOptimized && watcherActive && (
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
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>Backend watcher active — </span>
            priorities reset when game exits · runs in background
          </span>
        </div>
      )}

      {/* Shutdown-in-progress notice */}
      {isShuttingDown && (
        <div
          className="animate-fade-in-up"
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            marginTop: 10,
            padding: '7px 10px',
            borderRadius: 8,
            background: 'rgba(255,77,109,0.04)',
            border: '1px solid rgba(255,77,109,0.2)'
          }}
        >
          <Spinner color="var(--red)" />
          <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>
            <span style={{ color: 'var(--red)', fontWeight: 600 }}>Restoring priorities — </span>
            app will close automatically
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
  preset: string
}> = ({ displayName, processName, pid, isOptimized, preset }) => (
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
      {isOptimized ? (preset === 'maximum' ? 'VERY HIGH' : 'HIGH') : 'NORM'}
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
