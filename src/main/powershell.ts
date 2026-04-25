import { IpcMain } from 'electron'
import { spawn, execFile } from 'child_process'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// ─── Protected system processes that MUST NEVER be touched ───────────────────
const PROTECTED_PROCESSES = new Set([
  'system', 'idle', 'smss', 'csrss', 'wininit', 'winlogon', 'lsass', 'lsaiso',
  'services', 'svchost', 'registry', 'msmpeng', 'audiodg', 'dwm', 'fontdrvhost',
  'ntoskrnl', 'spoolsv', 'searchindexer', 'trustedinstaller', 'wuauclt',
  'taskhost', 'taskhostw', 'sihost', 'ctfmon', 'runtimebroker',
  'securityhealthservice', 'securityhealthsystray', 'sgrmbroker',
  'wmiprvse', 'conhost', 'dllhost', 'consent', 'msiexec', 'usoclient', 'sdclt',
  'explorer', 'taskmgr', 'electron', 'true script', 'truescript'
])

export function isProtected(processName: string): boolean {
  const name = processName.toLowerCase().replace('.exe', '')
  return PROTECTED_PROCESSES.has(name)
}

// ─── Persistent PowerShell runner ────────────────────────────────────────────
// Uses a long-lived powershell.exe process that reads script files via -File so
// we avoid spawning a fresh process per call (no native node-gyp modules needed).

interface PendingJob {
  resolve: (value: string) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

let psProcess: ReturnType<typeof spawn> | null = null
let stdoutBuffer = ''
const pendingJobs: PendingJob[] = []
const JOB_SENTINEL = '__TRUESCRIPT_DONE__'

function ensurePsProcess(): void {
  if (psProcess && !psProcess.killed) return

  psProcess = spawn('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-NoExit',
    '-Command', '-'          // read commands from stdin
  ], { stdio: ['pipe', 'pipe', 'pipe'] })

  stdoutBuffer = ''

  psProcess.stdout?.setEncoding('utf8')
  psProcess.stdout?.on('data', (chunk: string) => {
    stdoutBuffer += chunk
    // A job is done when we see the sentinel on its own line
    const sentinelIdx = stdoutBuffer.indexOf(JOB_SENTINEL)
    if (sentinelIdx !== -1) {
      const output = stdoutBuffer.slice(0, sentinelIdx).trimEnd()
      stdoutBuffer = stdoutBuffer.slice(sentinelIdx + JOB_SENTINEL.length)
      // Trim leading newline that follows sentinel
      if (stdoutBuffer.startsWith('\r\n')) stdoutBuffer = stdoutBuffer.slice(2)
      else if (stdoutBuffer.startsWith('\n')) stdoutBuffer = stdoutBuffer.slice(1)

      const job = pendingJobs.shift()
      if (job) {
        clearTimeout(job.timer)
        job.resolve(output.trim())
      }
    }
  })

  psProcess.stderr?.setEncoding('utf8')
  psProcess.stderr?.on('data', () => { /* suppress */ })

  psProcess.on('exit', () => {
    psProcess = null
    // Drain any waiting jobs with an error
    for (const job of pendingJobs) {
      clearTimeout(job.timer)
      job.reject(new Error('PowerShell process exited unexpectedly'))
    }
    pendingJobs.length = 0
  })
}

/** Run a PS script string via the persistent process. Falls back to execFile on error. */
export async function runPowerShell(script: string, timeoutMs = 20000): Promise<string> {
  try {
    ensurePsProcess()
    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = pendingJobs.findIndex(j => j.resolve === resolve)
        if (idx !== -1) pendingJobs.splice(idx, 1)
        reject(new Error(`PowerShell script timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      pendingJobs.push({ resolve, reject, timer })

      // Write the script wrapped with the sentinel
      const wrapped = `
$ErrorActionPreference = 'SilentlyContinue'
try {
${script}
} catch {}
Write-Output '${JOB_SENTINEL}'
`
      psProcess!.stdin!.write(wrapped + '\n')
    })
  } catch {
    // Persistent PS failed → fallback to isolated execFile (no sentinel needed)
    return runPowerShellIsolated(script, timeoutMs)
  }
}

/** Fallback: isolated one-shot powershell.exe via a temp .ps1 file */
async function runPowerShellIsolated(script: string, timeoutMs = 20000): Promise<string> {
  const tmpFile = join(tmpdir(), `truescript_${Date.now()}_${Math.random().toString(36).slice(2)}.ps1`)
  try {
    writeFileSync(tmpFile, script, 'utf8')
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-File', tmpFile
    ], { timeout: timeoutMs })
    return stdout.trim()
  } finally {
    if (existsSync(tmpFile)) {
      try { unlinkSync(tmpFile) } catch { /* ignore */ }
    }
  }
}

/** Terminate the persistent PS session (call on app quit) */
export function destroyPsProcess(): void {
  if (psProcess && !psProcess.killed) {
    try { psProcess.stdin?.end() } catch { /* ignore */ }
    try { psProcess.kill() } catch { /* ignore */ }
  }
  psProcess = null
}

// ─── IPC Handler Registration ─────────────────────────────────────────────────
export function registerPowerShellHandlers(ipcMain: IpcMain): void {

  // ── Get all running processes (filtered) ──────────────────────────────────
  ipcMain.handle('ps:getProcesses', async () => {
    const script = `
$pt = @{}; @('system','idle','smss','csrss','wininit','winlogon','lsass','lsaiso','services','svchost','registry','msmpeng','audiodg','dwm','fontdrvhost','ntoskrnl','spoolsv','searchindexer','trustedinstaller','wuauclt','taskhost','taskhostw','sihost','ctfmon','runtimebroker','securityhealthservice','securityhealthsystray','sgrmbroker','wmiprvse','conhost','dllhost','consent','msiexec','usoclient','sdclt') | ForEach-Object { $pt[$_] = $true }

$nc = [Environment]::ProcessorCount; if ($nc -lt 1) { $nc = 1 }
$snap = @{}
Get-Process -ErrorAction SilentlyContinue | ForEach-Object {
  try { $snap[$_.Id] = $_.TotalProcessorTime.TotalMilliseconds } catch {}
}

Start-Sleep -Milliseconds 300

Get-Process -ErrorAction SilentlyContinue | Where-Object {
  $_.Id -ne 0 -and -not $pt[$_.ProcessName.ToLower()]
} | ForEach-Object {
  try {
    $pid2 = $_.Id; $pri = 'Normal'
    try { 
      $rawPri = $_.PriorityClass.ToString() 
      if ($rawPri -eq 'Idle' -or $rawPri -eq 'BelowNormal') { $pri = 'Low' }
      elseif ($rawPri -eq 'AboveNormal') { $pri = 'High' }
      elseif ($rawPri -eq 'RealTime') { $pri = 'VeryHigh' }
      else { $pri = $rawPri }
    } catch {}
    $cpu = 0
    $ram = [math]::Round($_.WorkingSet64 / 1MB, 1)
    if ($snap.ContainsKey($pid2)) {
      $d = $_.TotalProcessorTime.TotalMilliseconds - $snap[$pid2]
      $cpu = [math]::Round($d / 0.3 / $nc, 1)
      if ($cpu -lt 0) { $cpu = 0 } elseif ($cpu -gt 100) { $cpu = 100 }
    }
    [PSCustomObject]@{ pid = $pid2; name = $_.ProcessName; priority = $pri; cpu = $cpu; ram = $ram }
  } catch {}
} | Where-Object { $_ } | ConvertTo-Json -Compress -Depth 1
`
    try {
      const output = await runPowerShell(script, 12000)
      if (!output || output === 'null') return []
      const parsed = JSON.parse(output)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      return []
    }
  })


  // ── Set priority for a single process ─────────────────────────────────────
  ipcMain.handle('ps:setPriority', async (_event, pid: number, priority: string, processName: string) => {
    if (isProtected(processName)) {
      return { success: false, skipped: true, reason: 'Protected system process' }
    }

    let safePriority = priority
    if (priority === 'Low') safePriority = 'Idle'
    if (priority === 'VeryHigh') safePriority = 'High' // Capped at High for system stability

    const script = `
try {
  $proc = Get-Process -Id ${pid} -ErrorAction SilentlyContinue
  if ($null -eq $proc) { Write-Output "NOT_FOUND"; exit }
  $proc.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::${safePriority}
  Write-Output "SUCCESS"
} catch { Write-Output "ERROR:$($_.Exception.Message)" }
`
    try {
      const result = await runPowerShell(script)
      if (result.startsWith('SUCCESS')) {
        return { success: true, skipped: false }
      } else if (result === 'NOT_FOUND') {
        return { success: false, skipped: true, reason: 'Process not found' }
      } else {
        return { success: false, skipped: false, reason: result }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, skipped: false, reason: msg }
    }
  })

  // ── Set I/O priority for a process ────────────────────────────────────────
  ipcMain.handle('ps:setIoPriority', async (_event, pid: number, ioLevel: 'Normal' | 'Low') => {
    const ioValue = ioLevel === 'Low' ? 1 : 2

    const script = `
try { Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class IoHelper {
  [DllImport("ntdll.dll")]
  public static extern int NtSetInformationProcess(IntPtr hProcess, int processInfoClass, ref int processInformation, int processInformationLength);
}
"@ } catch {}
try {
  $proc = Get-Process -Id ${pid} -ErrorAction SilentlyContinue
  if ($null -eq $proc) { Write-Output "NOT_FOUND"; exit }
  $val = ${ioValue}
  $result = [IoHelper]::NtSetInformationProcess($proc.Handle, 33, [ref]$val, 4)
  if ($result -eq 0) { Write-Output "SUCCESS" } else { Write-Output "NTFAIL:$result" }
} catch { Write-Output "ERROR:$($_.Exception.Message)" }
`
    try {
      const result = await runPowerShell(script)
      return { success: result.startsWith('SUCCESS'), reason: result }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, reason: msg }
    }
  })

  // ── Batch optimize: single PowerShell call for ALL processes ───────────────
  ipcMain.handle('ps:batchOptimize', async (
    _event,
    gamePid: number,
    gameProcessName: string,
    backgroundPids: Array<{ pid: number; name: string }>,
    preset: 'minimum' | 'normal' | 'maximum'
  ) => {
    interface OptResult { pid: number; name: string; success: boolean; skipped: boolean; reason?: string }

    const config = {
      // ── Minimum: safest changes only, low side-effects
      minimum: {
        gamePriority: 'High', bgPriority: 'Normal', bgIo: false,
        mmcss: false, powerPlan: false, trimWs: false,
        timerRes: true,   // winmm timeBeginPeriod(1) — universal fix, safe
        sysProfile: true, // HKLM Games task → SystemResponsiveness=20 (mild)
        netThrottle: false, cpuUnpark: false, gameBar: false, threadBoost: true
      },
      // ── Normal: balanced, includes network + core parking fixes
      normal: {
        gamePriority: 'High', bgPriority: 'Low', bgIo: true,
        mmcss: false, powerPlan: false, trimWs: false,
        timerRes: true, sysProfile: true,
        netThrottle: true,  // disable network coalescing interrupt
        cpuUnpark: true,    // unpark all CPU cores
        gameBar: true,      // suppress GameDVR background capture
        threadBoost: true
      },
      // ── Maximum: all fixes, aggressive
      maximum: {
        gamePriority: 'VeryHigh', bgPriority: 'Low', bgIo: true,
        mmcss: true, powerPlan: true, trimWs: true,
        timerRes: true, sysProfile: true,
        netThrottle: true, cpuUnpark: true, gameBar: true, threadBoost: true
      }
    }
    const cfg = config[preset]
    // sysResponsiveness: 0 = all CPU to game (max/normal), 20 = mild (minimum)
    const sysResp = preset === 'minimum' ? 20 : 0

    const safeBackgrounds = backgroundPids.filter(p => !isProtected(p.name))
    const skippedProtected = backgroundPids.filter(p => isProtected(p.name))

    type PidEntry = { pid: number; priority: string }
    const mapPri = (p: string) => p === 'Low' ? 'Idle' : p === 'VeryHigh' ? 'High' : p // RealTime blocked for safety
    const pidList: PidEntry[] = [
      { pid: gamePid, priority: mapPri(cfg.gamePriority) },
      ...safeBackgrounds.map(p => ({ pid: p.pid, priority: mapPri(cfg.bgPriority) }))
    ]

    const psJsonArray = JSON.stringify(pidList)
    const ioPids = cfg.bgIo ? safeBackgrounds.map(p => p.pid) : []
    const psIoPids = ioPids.length > 0 ? ioPids.join(',') : ''

    const script = `
$pidList = '${psJsonArray}' | ConvertFrom-Json
$results = @()

# ════════════════════════════════════════════════════════════════════
# PHASE 1 — Process priority (CPU scheduling)
# ════════════════════════════════════════════════════════════════════
foreach ($entry in $pidList) {
  $pid2   = $entry.pid
  $pri    = $entry.priority
  $status = "PENDING"
  try {
    $proc = Get-Process -Id $pid2 -ErrorAction SilentlyContinue
    if ($null -eq $proc) {
      $status = "NOT_FOUND"
    } else {
      $proc.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::$pri
      $status = "SUCCESS"
    }
  } catch {
    $status = "ERROR:$($_.Exception.Message)"
  }
  $results += [PSCustomObject]@{ pid = $pid2; status = $status }
}

# ════════════════════════════════════════════════════════════════════
# PHASE 2 — I/O priority + working-set trim
# ════════════════════════════════════════════════════════════════════
${cfg.bgIo && psIoPids ? `
try { Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinOpt {
  [DllImport("ntdll.dll")]  public static extern int  NtSetInformationProcess(IntPtr h, int c, ref int i, int l);
  [DllImport("kernel32.dll")] public static extern bool SetProcessWorkingSetSize(IntPtr h, IntPtr min, IntPtr max);
}
"@ } catch {}
try {
  $ioPids = @(${psIoPids})
  foreach ($ip in $ioPids) {
    try {
      $proc = Get-Process -Id $ip -ErrorAction SilentlyContinue
      if ($null -ne $proc) {
        $v = 1; [WinOpt]::NtSetInformationProcess($proc.Handle, 33, [ref]$v, 4) | Out-Null
        ${cfg.trimWs ? `[WinOpt]::SetProcessWorkingSetSize($proc.Handle, [IntPtr](-1), [IntPtr](-1)) | Out-Null` : ''}
      }
    } catch {}
  }
} catch {}` : ''}

# ════════════════════════════════════════════════════════════════════
# PHASE 3 — Windows Timer Resolution  [FPS STABILITY - CRITICAL]
# timeBeginPeriod(1) changes the OS scheduler tick from 15.6ms → 1ms
# This is THE single biggest fix for frame time jitter / FPS variance
# ════════════════════════════════════════════════════════════════════
${cfg.timerRes ? `
try { Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class TimerRes {
  [DllImport("winmm.dll")] public static extern uint timeBeginPeriod(uint uPeriod);
}
"@ } catch {}
try {
  [TimerRes]::timeBeginPeriod(1) | Out-Null
} catch {}` : ''}

# ════════════════════════════════════════════════════════════════════
# PHASE 4 — System Profile (Multimedia/Games registry)
# SystemResponsiveness: controls % CPU given to background tasks
# NetworkThrottlingIndex FFFFFFFF = disable interrupt coalescing
# ════════════════════════════════════════════════════════════════════
${cfg.sysProfile ? `
try {
  $regPath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile'
  Set-ItemProperty -Path $regPath -Name 'SystemResponsiveness' -Value ${sysResp} -Type DWord -ErrorAction SilentlyContinue
  ${cfg.netThrottle ? `Set-ItemProperty -Path $regPath -Name 'NetworkThrottlingIndex' -Value 0xFFFFFFFF -Type DWord -ErrorAction SilentlyContinue` : ''}
  $taskPath = "$regPath\\Tasks\\Games"
  if (Test-Path $taskPath) {
    Set-ItemProperty -Path $taskPath -Name 'SystemResponsiveness' -Value ${sysResp} -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $taskPath -Name 'Priority'             -Value 6        -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $taskPath -Name 'Scheduling Category'  -Value 'High'   -Type String -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $taskPath -Name 'SFIO Priority'        -Value 'High'   -Type String -ErrorAction SilentlyContinue
  }
} catch {}` : ''}

# ════════════════════════════════════════════════════════════════════
# PHASE 5 — CPU Core Unparking
# Parked cores take 1-5ms to wake up. This forces all cores online
# preventing latency spikes at frame boundaries
# ════════════════════════════════════════════════════════════════════
${cfg.cpuUnpark ? `
try {
  $parkKey = 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Power\\PowerSettings\\54533251-82be-4824-96c1-47b60b740d00\\0cc5b647-c1df-4637-891a-dec35c318583'
  if (Test-Path $parkKey) {
    Set-ItemProperty -Path $parkKey -Name 'ValueMax' -Value 0 -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $parkKey -Name 'ValueMin' -Value 0 -Type DWord -ErrorAction SilentlyContinue
  }
} catch {}` : ''}

# ════════════════════════════════════════════════════════════════════
# PHASE 6 — Thread Priority Boost + GameDVR/GameBar suppression
# Priority boost: allows game threads to temporarily spike above
# their base priority class for responsiveness
# GameDVR: background capture causes GPU frame queue hitches
# ════════════════════════════════════════════════════════════════════
${cfg.threadBoost ? `
try { Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class ThreadBoost {
  [DllImport("kernel32.dll")] public static extern bool SetProcessPriorityBoost(System.IntPtr h, bool disable);
}
"@ } catch {}
try {
  $gProc = Get-Process -Id ${gamePid} -ErrorAction SilentlyContinue
  if ($null -ne $gProc) {
    [ThreadBoost]::SetProcessPriorityBoost($gProc.Handle, $false) | Out-Null
  }
} catch {}` : ''}
${cfg.gameBar ? `
try {
  # Suppress Game DVR background recording (causes GPU frame queue interruptions)
  $gDvrKey = 'HKLM:\\SOFTWARE\\Microsoft\\PolicyManager\\default\\ApplicationManagement\\AllowGameDVR'
  if (Test-Path $gDvrKey) {
    Set-ItemProperty -Path $gDvrKey -Name 'value' -Value 0 -Type DWord -ErrorAction SilentlyContinue
  }
  $gameBarKey = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\GameDVR'
  if (Test-Path $gameBarKey) {
    Set-ItemProperty -Path $gameBarKey -Name 'AppCaptureEnabled' -Value 0 -Type DWord -ErrorAction SilentlyContinue
  }
} catch {}` : ''}

# ════════════════════════════════════════════════════════════════════
# PHASE 7 — MMCSS game thread registration (maximum only)
# ════════════════════════════════════════════════════════════════════
${cfg.mmcss ? `
try { Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class MmcssHelper {
  [DllImport("avrt.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern IntPtr AvSetMmThreadCharacteristics(string TaskName, out uint TaskIndex);
  [DllImport("avrt.dll", SetLastError=true)]
  public static extern bool AvSetMmThreadPriority(IntPtr handle, int priority);
}
"@ } catch {}
try {
  $idx = [uint32]0
  $handle = [MmcssHelper]::AvSetMmThreadCharacteristics("Games", [ref]$idx)
  if ($handle -ne [IntPtr]::Zero) {
    [MmcssHelper]::AvSetMmThreadPriority($handle, 1) | Out-Null
  }
} catch {}` : ''}

# ════════════════════════════════════════════════════════════════════
# PHASE 8 — Power plan (maximum only)
# ════════════════════════════════════════════════════════════════════
${cfg.powerPlan ? `
try {
  $ulti = powercfg -list 2>$null | Select-String 'e9a42b02-d5df-448d-aa00-03f14749eb61'
  if ($ulti) {
    powercfg -setactive e9a42b02-d5df-448d-aa00-03f14749eb61 2>$null
  } else {
    powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null
  }
} catch {}` : ''}

$results | ConvertTo-Json -Compress -Depth 2
`


    try {
      const output = await runPowerShell(script, 30000)
      const psResults: Array<{ pid: number; status: string }> = !output || output === 'null'
        ? []
        : Array.isArray(JSON.parse(output)) ? JSON.parse(output) : [JSON.parse(output)]

      const statusMap = new Map(psResults.map(r => [r.pid, r.status]))

      const results: OptResult[] = []

      const gameStatus = statusMap.get(gamePid) ?? 'NOT_FOUND'
      results.push({
        pid: gamePid,
        name: gameProcessName,
        success: gameStatus === 'SUCCESS',
        skipped: gameStatus === 'NOT_FOUND',
        reason: gameStatus === 'SUCCESS' ? undefined : gameStatus
      })

      for (const bg of safeBackgrounds) {
        const s = statusMap.get(bg.pid) ?? 'NOT_FOUND'
        results.push({
          pid: bg.pid,
          name: bg.name,
          success: s === 'SUCCESS',
          skipped: s === 'NOT_FOUND',
          reason: s === 'SUCCESS' ? undefined : s
        })
      }

      for (const p of skippedProtected) {
        results.push({ pid: p.pid, name: p.name, success: false, skipped: true, reason: 'Protected' })
      }

      return results
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return [
        { pid: gamePid, name: gameProcessName, success: false, skipped: false, reason: msg },
        ...backgroundPids.map(p => ({ pid: p.pid, name: p.name, success: false, skipped: false, reason: 'Batch failed' }))
      ]
    }
  })

  // ── Restore snapshot: single PowerShell call for ALL processes ─────────────
  ipcMain.handle('ps:restoreSnapshot', async (
    _event,
    snapshot: Array<{ pid: number; name: string; priority: string; ioNormal: boolean }>
  ) => {
    return executeRestoreSnapshot(snapshot)
  })
}

// ─── Exported restore function (used by both IPC handler + background watcher) ─
export async function executeRestoreSnapshot(
  snapshot: Array<{ pid: number; name: string; priority: string; ioNormal: boolean }>
): Promise<Array<{ pid: number; name: string; success: boolean; skipped: boolean; reason?: string }>> {
  interface RestoreResult { pid: number; name: string; success: boolean; skipped: boolean; reason?: string }

  const safe = snapshot.filter(e => !isProtected(e.name))
  const skipped = snapshot.filter(e => isProtected(e.name))

  if (safe.length === 0) {
    return [
      ...skipped.map(e => ({ pid: e.pid, name: e.name, success: false, skipped: true, reason: 'Protected' }) as RestoreResult)
    ]
  }

  const mapPri = (p: string) => p === 'Low' ? 'Idle' : p === 'VeryHigh' ? 'High' : (p || 'Normal')
  const normalized = safe.map(e => ({
    pid: e.pid,
    priority: mapPri(e.priority),
    ioNormal: e.ioNormal
  }))

  const psJsonArray = JSON.stringify(normalized)
  const ioNormalPids = normalized.filter(e => e.ioNormal).map(e => e.pid)
  const psIoPids = ioNormalPids.length > 0 ? ioNormalPids.join(',') : ''

  const script = `
$entries = '${psJsonArray}' | ConvertFrom-Json
$results = @()

foreach ($entry in $entries) {
  $pid2   = $entry.pid
  $pri    = $entry.priority
  $status = "PENDING"
  try {
    $proc = Get-Process -Id $pid2 -ErrorAction SilentlyContinue
    if ($null -eq $proc) {
      $status = "NOT_FOUND"
    } else {
      $proc.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::$pri
      $status = "SUCCESS"
    }
  } catch {
    $status = "ERROR:$($_.Exception.Message)"
  }
  $results += [PSCustomObject]@{ pid = $pid2; status = $status }
}

${psIoPids ? `
# Restore IO to Normal in one compile
try { Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public class IoR { [DllImport("ntdll.dll")] public static extern int NtSetInformationProcess(IntPtr h, int c, ref int i, int l); }
"@ } catch {}
try {
  $ioPids = @(${psIoPids})
  foreach ($ip in $ioPids) {
    try {
      $p = Get-Process -Id $ip -ErrorAction SilentlyContinue
      if ($null -ne $p) { $v = 2; [IoR]::NtSetInformationProcess($p.Handle, 33, [ref]$v, 4) | Out-Null }
    } catch {}
  }
} catch {}` : ''}

# ── Restore system settings to Windows defaults ───────────────────────────────
try { Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class TimerResR { [DllImport("winmm.dll")] public static extern uint timeEndPeriod(uint uPeriod); }
"@ } catch {}
try {
  # Restore timer resolution: allow OS to revert to its default (~15.6ms)
  [TimerResR]::timeEndPeriod(1) | Out-Null
} catch {}
try {
  # Restore SystemResponsiveness to Windows default (20)
  $regPath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile'
  Set-ItemProperty -Path $regPath -Name 'SystemResponsiveness' -Value 20 -Type DWord -ErrorAction SilentlyContinue
  # Restore NetworkThrottlingIndex to default (10)
  Set-ItemProperty -Path $regPath -Name 'NetworkThrottlingIndex' -Value 10 -Type DWord -ErrorAction SilentlyContinue
} catch {}
try {
  # Restore power plan to Balanced: 381b4222-f694-41f0-9685-ff5bb260df2e
  powercfg -setactive 381b4222-f694-41f0-9685-ff5bb260df2e 2>$null
} catch {}

$results | ConvertTo-Json -Compress -Depth 2
`

  try {
    const output = await runPowerShell(script, 30000)
    const psResults: Array<{ pid: number; status: string }> = !output || output === 'null'
      ? []
      : Array.isArray(JSON.parse(output)) ? JSON.parse(output) : [JSON.parse(output)]

    const statusMap = new Map(psResults.map(r => [r.pid, r.status]))
    const nameMap = new Map(snapshot.map(e => [e.pid, e.name]))

    const results: RestoreResult[] = []

    for (const e of safe) {
      const s = statusMap.get(e.pid) ?? 'NOT_FOUND'
      results.push({
        pid: e.pid,
        name: nameMap.get(e.pid) ?? e.name,
        success: s === 'SUCCESS',
        skipped: s === 'NOT_FOUND',
        reason: s === 'SUCCESS' ? undefined : s
      })
    }

    for (const e of skipped) {
      results.push({ pid: e.pid, name: e.name, success: false, skipped: true, reason: 'Protected' })
    }

    return results
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return snapshot.map(entry => ({
      pid: entry.pid, name: entry.name, success: false, skipped: false, reason: msg
    }) as RestoreResult)
  }
}
