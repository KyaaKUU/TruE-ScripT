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
  'explorer', 'taskmgr', 'electron', 'true script', 'truescript', 'true-script',
  'nvdisplay.container', 'rtss', 'searchhost', 'startmenuexperiencehost', 'shellexperiencehost',
  'searchprotocolhost', 'searchfilterhost', 'memory compression', 'secure system',
  'vmmem', 'vmmemwsl', 'apphost', 'backgroundtaskhost', 'compattelrunner',
  'smartscreen', 'sppsvc', 'wsappx', 'clipsvc', 'licensemanager', 'textinputhost',
  'applicationframehost', 'universal search', 'systemsettings',
  'windowsinternal.composableshell.experiences.textinput.inputapp'
])
const PROTECTED_PT_STRING = Array.from(PROTECTED_PROCESSES).map(p => `'${p}'`).join(',')

export function isProtected(processName: string, pid?: number): boolean {
  if (pid !== undefined && pid < 1000) return true
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
$pt = @{}; @(${PROTECTED_PT_STRING}) | ForEach-Object { $pt[$_] = $true }

$nc = [Environment]::ProcessorCount; if ($nc -lt 1) { $nc = 1 }
$now = [DateTime]::UtcNow
if (-not $global:lastSnap) { $global:lastSnap = @{} }
if (-not $global:lastTime) { $global:lastTime = $now.AddMilliseconds(-4000) }

$elapsedMs = ($now - $global:lastTime).TotalMilliseconds
if ($elapsedMs -le 0) { $elapsedMs = 1 }
$global:lastTime = $now

$currentSnap = @{}
Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne 0 -and -not $pt[$_.ProcessName.ToLower()] } | ForEach-Object {
  try {
    $pid2 = $_.Id
    $name = $_.ProcessName
    
    $cpuTime = $_.TotalProcessorTime.TotalMilliseconds
    $currentSnap[$pid2] = $cpuTime
    
    $cpu = 0
    if ($global:lastSnap.ContainsKey($pid2)) {
      $d = $cpuTime - $global:lastSnap[$pid2]
      $cpu = [math]::Round(($d / $elapsedMs) * 100 / $nc, 1)
      if ($cpu -lt 0) { $cpu = 0 } elseif ($cpu -gt 100) { $cpu = 100 }
    }
    
    $pri = 'Normal'
    try { 
      $rawPri = $_.PriorityClass.ToString() 
      if ($rawPri -eq 'Idle' -or $rawPri -eq 'BelowNormal') { $pri = 'Low' }
      elseif ($rawPri -eq 'RealTime') { $pri = 'VeryHigh' }
      else { $pri = $rawPri }
    } catch {}
    
    $ram = [math]::Round($_.WorkingSet64 / 1MB, 1)
    [PSCustomObject]@{ pid = $pid2; name = $name; priority = $pri; cpu = $cpu; ram = $ram }
  } catch {}
} | Where-Object { $_ } | ConvertTo-Json -Compress -Depth 1

$global:lastSnap = $currentSnap
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
      minimum: {
        gamePriority: 'AboveNormal', bgPriority: 'Normal',
        timerRes: true, sysProfile: false, sysResp: 20
      },
      normal: {
        gamePriority: 'High', bgPriority: 'Normal',
        timerRes: true, sysProfile: true, sysResp: 20
      },
      maximum: {
        gamePriority: 'High', bgPriority: 'BelowNormal',
        timerRes: true, sysProfile: true, sysResp: 10
      }
    }
    const cfg = config[preset]
    const sysResp = cfg.sysResp

    const safeBackgrounds = backgroundPids.filter(p => !isProtected(p.name, p.pid))
    const skippedProtected = backgroundPids.filter(p => isProtected(p.name, p.pid))

    type PidEntry = { pid: number; priority: string }
    const mapPri = (p: string) => p === 'Low' ? 'BelowNormal' : p === 'VeryHigh' ? 'High' : p
    const pidList: PidEntry[] = [
      { pid: gamePid, priority: mapPri(cfg.gamePriority) },
      ...safeBackgrounds.map(p => ({ pid: p.pid, priority: mapPri(cfg.bgPriority) }))
    ]

    const psJsonArray = JSON.stringify(pidList).replace(/'/g, "''")

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
    if ($pid2 -lt 1000) {
      $status = "SKIPPED:SYSTEM"
    } else {
      $proc = Get-Process -Id $pid2 -ErrorAction SilentlyContinue
      if ($null -eq $proc) {
        $status = "NOT_FOUND"
      } else {
        $proc.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::$pri
        $status = "SUCCESS"
      }
    }
  } catch {
    if ($_.Exception.Message -like "*Access is denied*") {
      $status = "ACCESS_DENIED"
    } else {
      $status = "ERROR:$($_.Exception.Message)"
    }
  }
  $results += [PSCustomObject]@{ pid = $pid2; status = $status }
}

# ════════════════════════════════════════════════════════════════════
# PHASE 2 — Windows Timer Resolution  [FPS STABILITY - CRITICAL]
# NtSetTimerResolution(5000) changes the OS scheduler tick to 0.5ms
# This is THE single biggest fix for frame time jitter / FPS variance
# ════════════════════════════════════════════════════════════════════
${cfg.timerRes ? `
if (-not ('TimerRes' -as [type])) {
  try { Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class TimerRes {
  [DllImport("ntdll.dll")] public static extern int NtSetTimerResolution(uint DesiredResolution, bool SetResolution, out uint CurrentResolution);
}
"@ } catch {}
}
try {
  $currentRes = 0
  [TimerRes]::NtSetTimerResolution(5000, $true, [ref]$currentRes) | Out-Null
} catch {}` : ''}

# ════════════════════════════════════════════════════════════════════
# PHASE 3 — System Profile (Multimedia/Games MMCSS profile)
# SystemResponsiveness: controls % CPU given to background tasks
# ════════════════════════════════════════════════════════════════════
${cfg.sysProfile ? `
try {
  $regPath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile'
  Set-ItemProperty -Path $regPath -Name 'SystemResponsiveness' -Value ${sysResp} -Type DWord -ErrorAction SilentlyContinue
  $taskPath = "$regPath\\Tasks\\Games"
  if (Test-Path $taskPath) {
    Set-ItemProperty -Path $taskPath -Name 'SystemResponsiveness' -Value ${sysResp} -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $taskPath -Name 'Priority'             -Value 6        -Type DWord -ErrorAction SilentlyContinue
    Set-ItemProperty -Path $taskPath -Name 'Scheduling Category'  -Value 'High'   -Type String -ErrorAction SilentlyContinue
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
    snapshot: Array<{ pid: number; name: string; priority: string }>
  ) => {
    return executeRestoreSnapshot(snapshot)
  })

  // ── Save session report to file ───────────────────────────────────────────
  ipcMain.handle('ps:saveReport', async (_event, content: string) => {
    try {
      const fileName = `Session-Report-${new Date().getTime()}.md`
      const filePath = join(process.cwd(), fileName)
      writeFileSync(filePath, content, 'utf8')
      return { success: true, path: filePath }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}

// ─── Exported restore function (used by both IPC handler + background watcher) ─
export async function executeRestoreSnapshot(
  snapshot: Array<{ pid: number; name: string; priority: string }>
): Promise<Array<{ pid: number; name: string; success: boolean; skipped: boolean; reason?: string }>> {
  interface RestoreResult { pid: number; name: string; success: boolean; skipped: boolean; reason?: string }

  const safe = snapshot.filter(e => !isProtected(e.name, e.pid))
  const skipped = snapshot.filter(e => isProtected(e.name, e.pid))

  if (safe.length === 0) {
    return [
      ...skipped.map(e => ({ pid: e.pid, name: e.name, success: false, skipped: true, reason: 'Protected' }) as RestoreResult)
    ]
  }

  const mapPri = (p: string) => p === 'Low' ? 'BelowNormal' : p === 'VeryHigh' ? 'High' : (p || 'Normal')
  const normalized = safe.map(e => ({
    pid: e.pid,
    priority: mapPri(e.priority)
  }))

  const psJsonArray = JSON.stringify(normalized).replace(/'/g, "''")

  const script = `
$entries = '${psJsonArray}' | ConvertFrom-Json
$results = @()

foreach ($entry in $entries) {
  $pid2   = $entry.pid
  $pri    = $entry.priority
  $status = "PENDING"
  try {
    if ($pid2 -lt 1000) {
      $status = "SKIPPED:SYSTEM"
    } else {
      $proc = Get-Process -Id $pid2 -ErrorAction SilentlyContinue
      if ($null -eq $proc) {
        $status = "NOT_FOUND"
      } else {
        $proc.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::$pri
        $status = "SUCCESS"
      }
    }
  } catch {
    if ($_.Exception.Message -like "*Access is denied*") {
      $status = "ACCESS_DENIED"
    } else {
      $status = "ERROR:$($_.Exception.Message)"
    }
  }
  $results += [PSCustomObject]@{ pid = $pid2; status = $status }
}

# ── Restore system settings to Windows defaults ───────────────────────────────
if (-not ('TimerResR' -as [type])) {
  try { Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class TimerResR { [DllImport("ntdll.dll")] public static extern int NtSetTimerResolution(uint DesiredResolution, bool SetResolution, out uint CurrentResolution); }
"@ } catch {}
}
try {
  # Restore timer resolution: allow OS to revert to its default (~15.6ms)
  $currentRes = 0
  [TimerResR]::NtSetTimerResolution(5000, $false, [ref]$currentRes) | Out-Null
} catch {}
try {
  # Restore SystemResponsiveness to Windows default (20)
  $regPath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile'
  Set-ItemProperty -Path $regPath -Name 'SystemResponsiveness' -Value 20 -Type DWord -ErrorAction SilentlyContinue
  # Restore NetworkThrottlingIndex to default (10)
  Set-ItemProperty -Path $regPath -Name 'NetworkThrottlingIndex' -Value 10 -Type DWord -ErrorAction SilentlyContinue
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
