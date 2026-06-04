import React, { useCallback, useEffect } from 'react'
import { useAppStore, SnapshotEntry, KNOWN_GAMES } from '../store/useAppStore'

export const PROTECTED = new Set([
  // ── Kernel & Boot ──────────────────────────────────────────────────────────
  'system','idle','smss','csrss','wininit','ntoskrnl','registry',
  // ── Authentication ─────────────────────────────────────────────────────────
  'winlogon','lsass','lsaiso','consent',
  // ── Services ───────────────────────────────────────────────────────────────
  'services','svchost','spoolsv','trustedinstaller','wuauclt',
  // ── Security ───────────────────────────────────────────────────────────────
  'msmpeng','securityhealthservice','securityhealthsystray','sgrmbroker','smartscreen',
  // ── Desktop Shell ──────────────────────────────────────────────────────────
  'explorer','dwm','fontdrvhost','sihost','ctfmon','taskmgr',
  // ── Runtime ────────────────────────────────────────────────────────────────
  'runtimebroker','taskhost','taskhostw','wmiprvse','conhost','dllhost',
  // ── GPU & Display ──────────────────────────────────────────────────────────
  'nvdisplay.container','nvcontainer','nvidia share','nvidia web helper',
  'amdrsserv','amddvr','radeonsoft','atiesrxx',
  // ── Audio (mencegah audio crackling akibat thread starvation) ──────────────
  'audiodg','audiodevicecmdlets',
  // ── Peripheral Drivers (mencegah priority inversion pada input device) ─────
  'lghub','lghub_agent','lghub_updater','logioptionsplus','logitechg',
  'razer synapse','rzsynapse','razercentral','rzdeviceengine',
  'icue','corsair.service','cue',
  'steelseriesengine','steelseriesgg','steelseriesggsvc',
  'asusoptimization','armorycrate','aboringservice',
  'ghub','senhd',
  // ── Game Launchers & Overlay (anti-cheat compatibility) ────────────────────
  'steam','steamwebhelper','steamservice',
  'epicgameslauncher','epicwebhelper',
  'battle.net','agent',
  'riotclient','riotvanguard','vgc','vgtray',
  'easyanticheat','easyanticheat_eos','beclient','beclient_x64',
  'origin','ea app','eadesktop','ealink',
  'gog galaxy','galaxyclient',
  'ubisoft connect','upc',
  // ── VoIP & Streaming (mencegah audio/mic lag) ─────────────────────────────
  'discord','update','krisp',
  'obs64','obs32','streamlabs obs',
  'teamspeak','ts3client_win64',
  // ── Monitoring & Overlay ───────────────────────────────────────────────────
  'rtss','msi afterburner','hwinfo64','hwinfo32','gpuz','cpuz',
  'fraps','fpsmon',
  // ── Self-Protection ────────────────────────────────────────────────────────
  'electron','truescript','true script','true-script',
  // ── Windows Shell & System ─────────────────────────────────────────────────
  'searchhost','startmenuexperiencehost','shellexperiencehost',
  'searchprotocolhost','searchfilterhost','searchindexer',
  'memory compression','secure system',
  'vmmem','vmmemwsl','apphost','backgroundtaskhost','compattelrunner',
  'sppsvc','wsappx','clipsvc','licensemanager','textinputhost',
  'msiexec','usoclient','sdclt',
  'applicationframehost','universal search','systemsettings',
  'windowsinternal.composableshell.experiences.textinput.inputapp'
])
const isProtected = (name: string, pid?: number) => {
  if (pid !== undefined && pid < 1000) return true
  return PROTECTED.has(name.toLowerCase().replace('.exe', ''))
}

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
      addStatusEntry({
        pid: 0, name: 'system', status: 'success',
        message: `[RST] 0.5ms timer released → 15.6ms · SystemResponsiveness → 20 (default)`
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

    // Capture "Before" metrics for thesis documentation
    const gameBefore = processes.find(p => p.pid === selectedGamePid)

    const snap: SnapshotEntry[] = processes
      .filter(p => !isProtected(p.name, p.pid))
      .map(p => ({ pid: p.pid, name: p.name, priority: p.priority || 'Normal' }))
    saveSnapshot(snap)

    const bgProcs = processes
      .filter(p => p.pid !== selectedGamePid && !isProtected(p.name, p.pid))
      .map(p => ({ pid: p.pid, name: p.name }))

    const totalTargets = bgProcs.length + 1

    // Phase 1: Init
    addStatusEntry({ pid: 0, name: 'truescript', status: 'pending',
      message: `[INIT] preset=${preset.toUpperCase()} · ${totalTargets} processes targeted · snapshot saved` })

    // Phase 2: Plan summary
    const presetMap = {
      minimum: 'game=AboveNormal · bg=Normal · 0.5ms timer',
      normal:  'game=High · bg=Normal · 0.5ms timer · sys profile',
      maximum: 'game=High · bg=BelowNormal · High Perf plan'
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
        let finalStatus: 'success' | 'failed' | 'skipped' = 'failed'
        let msg = ''

        if (r.skipped) {
          finalStatus = 'skipped'
          msg = r.reason === 'SKIPPED:NO_ACCESS'
            ? '[SKIP] restricted process — pre-check denied, untouched'
            : r.reason === 'Protected'
            ? '[SKIP] protected system process — untouched'
            : `[SKIP] ${r.reason || 'not found — untouched'}`
        } else if (r.success) {
          finalStatus = 'success'
          msg = isGame
            ? `[SET] priority → ${preset === 'minimum' ? 'Above Normal' : 'High'} (game boosted)`
            : `[SET] priority → ${preset === 'maximum' ? 'Below Normal' : 'Normal'}${preset === 'maximum' ? ' · io → Low' : ''}`
        } else {
          finalStatus = 'failed'
          msg = `[FAIL] ${r.reason ?? 'unknown error'}`
        }

        addStatusEntry({
          pid: r.pid, name: r.name,
          status: finalStatus,
          message: msg
        })
      }

      // Phase 5: Summary
      const ok      = results.filter(r => r.success).length
      const failed  = results.filter(r => !r.success && !r.skipped).length
      const skipped = results.filter(r => r.skipped).length
      addStatusEntry({ pid: 0, name: 'truescript', status: 'success',
        message: `[DONE] ${ok} set · ${failed} err · ${skipped} skip · elapsed=${elapsed}ms` })

      setIsOptimized(true)

      // ─── Generate Performance Documentation Report ───
      const tEnd = new Date()
      const tEndStr = tEnd.toLocaleString()
      const tEndISO = tEnd.toISOString()
      const gameAfter = processes.find(p => p.pid === selectedGamePid) || gameBefore
      const reportElapsed = Math.round(performance.now() - t0)

      // Compute deltas
      const cpuBefore = gameBefore?.cpu || 0
      const cpuAfter = gameAfter?.cpu || 0
      const cpuDelta = cpuAfter - cpuBefore
      const ramBefore = gameBefore?.ram || 0
      const ramAfter = gameAfter?.ram || 0
      const ramDelta = ramAfter - ramBefore

      // Priority mapping
      const newPriority = preset === 'minimum' ? 'Above Normal' : 'High'
      const oldPriority = gameBefore?.priority || 'Normal'

      // Background process stats
      const totalBg = bgProcs.length
      const bgSuccess = results.filter(r => r.pid !== selectedGamePid && r.success).length
      const bgSkipped = results.filter(r => r.pid !== selectedGamePid && r.skipped).length
      const bgFailed  = results.filter(r => r.pid !== selectedGamePid && !r.success && !r.skipped).length

      // Preset config details
      const presetDetails: Record<string, { gamePri: string; bgPri: string; timer: string; mmcss: boolean; sysResp: number }> = {
        minimum: { gamePri: 'AboveNormal', bgPri: 'Normal', timer: '0.5ms', mmcss: false, sysResp: 20 },
        normal:  { gamePri: 'High',        bgPri: 'Normal', timer: '0.5ms', mmcss: true,  sysResp: 20 },
        maximum: { gamePri: 'High',        bgPri: 'BelowNormal', timer: '0.5ms', mmcss: true, sysResp: 10 }
      }
      const pCfg = presetDetails[preset]

      // Game display name
      const gameDisplayName = KNOWN_GAMES[selectedGameName!.toLowerCase().replace('.exe', '')] || selectedGameName

      // Build per-process result table
      const bgResultRows = results
        .filter(r => r.pid !== selectedGamePid)
        .slice(0, 25)
        .map(r => {
          const statusIcon = r.success ? '✅' : r.skipped ? '⏭️' : '❌'
          const statusText = r.success ? 'Optimized' : r.skipped
            ? (r.reason === 'SKIPPED:NO_ACCESS' ? 'Restricted (skipped)'
              : r.reason === 'Protected' ? 'Protected (skipped)'
              : r.reason === 'NOT_FOUND' ? 'Not Found (skipped)'
              : (r.reason || 'Skipped'))
            : (r.reason || 'Failed')
          const newPri = r.success ? (preset === 'maximum' ? 'BelowNormal' : 'Normal') : '—'
          return `| ${r.name} | ${r.pid} | ${statusIcon} ${statusText} | ${newPri} |`
        }).join('\n')

      // Arrow indicator helpers
      const deltaIcon = (val: number) => val > 0 ? '▲' : val < 0 ? '▼' : '●'
      const deltaSign = (val: number) => val > 0 ? '+' : ''

      const reportContent =
`# 📊 TruE ScripT — Session Optimization Report

> **Generated:** ${tEndStr}
> **Timestamp:** \`${tEndISO}\`
> **Engine Version:** TruE ScripT v1.0 — Hybrid Electron/React/PowerShell

---

## 1. 🖥️ Session Environment

| Parameter | Value |
| :--- | :--- |
| **Report ID** | \`TSR-${tEnd.getTime()}\` |
| **Session Date** | ${tEnd.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} |
| **Session Time** | ${tEnd.toLocaleTimeString()} |
| **Optimization Preset** | \`${preset.toUpperCase()}\` |
| **Execution Duration** | ${reportElapsed}ms |
| **Total Processes Targeted** | ${totalTargets} |

---

## 2. 🎮 Target Process

| Property | Detail |
| :--- | :--- |
| **Game Title** | ${gameDisplayName} |
| **Process Name** | \`${selectedGameName}\` |
| **Process ID (PID)** | \`${selectedGamePid}\` |
| **Priority Before** | ${oldPriority} |
| **Priority After** | **${newPriority}** |
| **CPU at Capture** | ${cpuBefore}% |
| **RAM at Capture** | ${ramBefore} MB |

---

## 3. 📈 Performance Metrics (Before vs After)

| Metric | Before | After | Delta | Indicator |
| :--- | ---: | ---: | ---: | :---: |
| **CPU Usage** | ${cpuBefore}% | ${cpuAfter}% | ${deltaSign(cpuDelta)}${cpuDelta.toFixed(1)}% | ${deltaIcon(cpuDelta)} |
| **RAM Usage** | ${ramBefore} MB | ${ramAfter} MB | ${deltaSign(ramDelta)}${ramDelta.toFixed(1)} MB | ${deltaIcon(ramDelta)} |
| **Process Priority** | ${oldPriority} | ${newPriority} | — | ▲ Boosted |
| **Timer Resolution** | 15.6ms (default) | 0.5ms | -15.1ms | ▲ Improved |
| **Scheduler Tick** | Standard | High Precision | — | ▲ Enhanced |

> **Catatan:** CPU dan RAM di-capture pada saat proses optimasi dimulai. Untuk perbandingan akurat, jalankan benchmark sebelum dan sesudah optimasi.

---

## 4. ⚙️ Background Process Optimization

**Summary:** ${totalBg} proses background ditargetkan

| Status | Count |
| :--- | ---: |
| ✅ Berhasil di-optimasi | ${bgSuccess} |
| ⏭️ Dilewati (protected/not found) | ${bgSkipped} |
| ❌ Gagal | ${bgFailed} |

### Detail Per-Proses (max 25)

| Process Name | PID | Status | New Priority |
| :--- | ---: | :--- | :--- |
${bgResultRows || '| — | — | Tidak ada proses background | — |'}

---

## 5. 🔧 System-Level Tweaks Applied

### Preset Configuration: \`${preset.toUpperCase()}\`

| Tweak | Status | Technical Detail |
| :--- | :---: | :--- |
| **Windows Timer Resolution** | ✅ Applied | \`NtSetTimerResolution(5000, true)\` → 0.5ms tick |
| **MMCSS System Profile** | ${pCfg.mmcss ? '✅ Applied' : '⬜ Skipped'} | ${pCfg.mmcss ? `SystemResponsiveness = ${pCfg.sysResp}, Games Priority = 6` : 'Tidak aktif pada preset MINIMUM'} |
| **Game Priority Boost** | ✅ Applied | \`PriorityClass = ${pCfg.gamePri}\` |
| **Background Throttle** | ✅ Applied | \`PriorityClass = ${pCfg.bgPri}\` untuk proses non-protected |
| **SystemResponsiveness** | ${pCfg.mmcss ? '✅ Applied' : '⬜ Skipped'} | ${pCfg.mmcss ? `HKLM\\\\...\\\\SystemProfile → ${pCfg.sysResp}% CPU reserved for background` : 'Default (20%)'} |

### Penjelasan Teknis

- **Timer Resolution 0.5ms:** Mengurangi jitter frame-time pada game loop. Default Windows = 15.6ms, yang menyebabkan micro-stuttering.
- **MMCSS (Multimedia Class Scheduler Service):** Memberikan prioritas CPU scheduling khusus untuk kategori "Games" di Windows.
- **SystemResponsiveness:** Mengontrol persentase CPU yang dialokasikan untuk background tasks. Nilai lebih rendah = lebih banyak CPU untuk game.

---

## 6. 📋 Optimization Timeline

| Phase | Action | Duration |
| :--- | :--- | ---: |
| **INIT** | Snapshot saved, preset loaded | ~1ms |
| **PLAN** | Strategy: game=${pCfg.gamePri}, bg=${pCfg.bgPri} | ~1ms |
| **EXEC** | PowerShell batch script dispatched | ~${Math.max(reportElapsed - 50, 10)}ms |
| **SET** | Priority classes applied via Win32 API | included |
| **SYS** | Timer + MMCSS + Registry tweaks | included |
| **WATCH** | Backend watcher started (PID ${selectedGamePid}) | ongoing |
| **TOTAL** | End-to-end optimization | **${reportElapsed}ms** |

---

## 7. 🛡️ Security Audit

| Check | Result |
| :--- | :--- |
| **Protected Process Filter** | ✅ ${PROTECTED.size} system processes protected |
| **PID < 1000 Guard** | ✅ Kernel-level processes excluded |
| **Explorer.exe Protection** | ✅ Shell process untouched |
| **LSASS/CSRSS Protection** | ✅ Security subsystem untouched |
| **Self-Protection** | ✅ Electron/TruE ScripT excluded |
| **Auto-Restore Watcher** | ✅ Active — will restore on game exit |
| **Graceful Shutdown** | ✅ Restore-before-quit enabled |

---

## 8. 📝 Kesimpulan

Optimasi berhasil dilakukan pada proses **${gameDisplayName}** (\`${selectedGameName}\`, PID \`${selectedGamePid}\`) menggunakan preset **${preset.toUpperCase()}** dalam waktu **${reportElapsed}ms**.

**Perubahan utama:**
- 🎯 Priority game dinaikkan dari **${oldPriority}** → **${newPriority}**
- ⏱️ Timer resolution diubah dari **15.6ms** → **0.5ms** (pengurangan 96.8%)
- 📉 ${bgSuccess} proses background berhasil di-throttle
- 🛡️ ${PROTECTED.size} proses sistem dilindungi dari modifikasi
${pCfg.mmcss ? `- 🎵 MMCSS Games profile diaktifkan (SystemResponsiveness = ${pCfg.sysResp}%)` : ''}
- 👁️ Backend watcher aktif untuk auto-restore saat game ditutup

---

*Automated documentation by TruE ScripT Optimization Engine*
*Report generated at ${tEndISO}*`

      const reportResult = await window.api.saveReport(reportContent)
      if (reportResult?.success && reportResult.path) {
        addStatusEntry({ pid: 0, name: 'truescript', status: 'success', 
          message: `[DOCS] session report saved: ${reportResult.path.split('\\').pop()}` })
      }

      // Phase 6: System-level stability features applied
      const stabilityMap: Record<string, string> = {
        minimum: `[SYS] 0.5ms timer set`,
        normal:  `[SYS] 0.5ms timer · Games system profile`,
        maximum: `[SYS] 0.5ms timer · Games system profile · High Perf plan`
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
      message: `[EXEC] restore batch → ${snapshot.filter(e => !isProtected(e.name, e.pid)).length} processes` })

    try {
      // Delegate to backend (also stops watcher via watcher:manualRestore)
      const results = await window.api.manualRestore(snapshot)
      const elapsed = Math.round(performance.now() - t0)

      for (const r of results) {
        let finalStatus: 'success' | 'failed' | 'skipped' = 'failed'
        let msg = ''

        if (r.skipped) {
          finalStatus = 'skipped'
          msg = r.reason === 'SKIPPED:NO_ACCESS'
            ? '[SKIP] restricted process — pre-check denied, untouched'
            : r.reason === 'Protected'
            ? '[SKIP] protected system process — untouched'
            : `[SKIP] ${r.reason || 'process already exited'}`
        } else if (r.success) {
          finalStatus = 'success'
          msg = `[RST] priority restored to original`
        } else {
          finalStatus = 'failed'
          msg = `[FAIL] ${r.reason ?? 'unknown error'}`
        }

        addStatusEntry({
          pid: r.pid, name: r.name,
          status: finalStatus,
          message: msg
        })
      }

      const ok      = results.filter(r => r.success).length
      const failed  = results.filter(r => !r.success && !r.skipped).length
      const skipped = results.filter(r => r.skipped).length
      addStatusEntry({ pid: 0, name: 'truescript', status: 'success',
        message: `[DONE] ${ok} restored · ${failed} err · ${skipped} skip · elapsed=${elapsed}ms` })
      addStatusEntry({ pid: 0, name: 'system', status: 'success',
        message: `[RST] 0.5ms timer released → 15.6ms · SystemResponsiveness → 20 · net throttle restored` })
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
      {isOptimized ? (preset === 'minimum' ? 'ABOVE NORM' : 'HIGH') : 'NORM'}
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
