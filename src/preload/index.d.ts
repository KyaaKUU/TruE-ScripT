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

interface AppAPI {
  getProcesses: () => Promise<ProcessInfo[]>
  setPriority: (pid: number, priority: string, processName: string) => Promise<{ success: boolean; skipped: boolean; reason?: string }>
  setIoPriority: (pid: number, ioLevel: 'Normal' | 'Low') => Promise<{ success: boolean; reason?: string }>
  batchOptimize: (
    gamePid: number,
    gameProcessName: string,
    backgroundPids: Array<{ pid: number; name: string }>,
    preset: 'minimum' | 'normal' | 'maximum'
  ) => Promise<OptimizeResult[]>
  restoreSnapshot: (snapshot: SnapshotEntry[]) => Promise<OptimizeResult[]>
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
