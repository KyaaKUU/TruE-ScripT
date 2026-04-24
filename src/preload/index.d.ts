import { ElectronAPI } from '@electron-toolkit/preload'

interface ProcessInfo {
  pid: number
  name: string
  priority: string
  cpu: number
}

interface OptimizeResult {
  pid: number
  name: string
  success: boolean
  skipped: boolean
  reason?: string
}

interface SnapshotEntry {
  pid: number
  name: string
  priority: string
  ioNormal: boolean
}

interface WatcherStatus {
  active: boolean
  gamePid: number | null
  snapshotLength: number
}

interface AppAPI {
  // ── Process scanning ────────────────────────────────────────────────────────
  getProcesses: () => Promise<ProcessInfo[]>

  // ── Priority control ────────────────────────────────────────────────────────
  setPriority: (pid: number, priority: string, processName: string) => Promise<{ success: boolean; skipped: boolean; reason?: string }>
  setIoPriority: (pid: number, ioLevel: 'Normal' | 'Low') => Promise<{ success: boolean; reason?: string }>

  // ── Batch operations ────────────────────────────────────────────────────────
  batchOptimize: (
    gamePid: number,
    gameProcessName: string,
    backgroundPids: Array<{ pid: number; name: string }>,
    preset: 'minimum' | 'normal' | 'maximum'
  ) => Promise<OptimizeResult[]>
  restoreSnapshot: (snapshot: SnapshotEntry[]) => Promise<OptimizeResult[]>

  // ── Background watcher ──────────────────────────────────────────────────────
  startWatcher: (gamePid: number, snapshot: SnapshotEntry[]) => void
  stopWatcher: () => void
  manualRestore: (snapshot: SnapshotEntry[]) => Promise<OptimizeResult[]>
  getWatcherStatus: () => Promise<WatcherStatus>

  // ── Shutdown ────────────────────────────────────────────────────────────────
  shutdownApp: () => void

  // ── Backend event subscriptions (return unsubscribe fn) ────────────────────
  onWatcherStarted: (cb: (data: { pid: number }) => void) => () => void
  onWatcherStopped: (cb: () => void) => () => void
  onWatcherAutoRestoring: (cb: (data: { pid: number; snapshotLength: number }) => void) => () => void
  onWatcherRestored: (cb: (data: { pid: number; snapshotLength: number }) => void) => () => void
  onShutdownStarted: (cb: () => void) => () => void
  onRestoringBeforeQuit: (cb: () => void) => () => void
  onRestoreComplete: (cb: () => void) => () => void

  // ── Window controls ─────────────────────────────────────────────────────────
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
