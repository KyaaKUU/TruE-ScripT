import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // ── Process scanning ────────────────────────────────────────────────────────
  getProcesses: () => ipcRenderer.invoke('ps:getProcesses'),

  // ── Single process priority ─────────────────────────────────────────────────




  // ── Batch optimize (preset) ─────────────────────────────────────────────────
  batchOptimize: (
    gamePid: number,
    gameProcessName: string,
    backgroundPids: Array<{ pid: number; name: string }>,
    preset: 'minimum' | 'normal' | 'maximum'
  ) => ipcRenderer.invoke('ps:batchOptimize', gamePid, gameProcessName, backgroundPids, preset),

  // ── Restore from snapshot (UI-triggered via IPC handler) ───────────────────
  restoreSnapshot: (
    snapshot: Array<{ pid: number; name: string; priority: string }>
  ) => ipcRenderer.invoke('ps:restoreSnapshot', snapshot),

  // ── Background watcher control ──────────────────────────────────────────────
  startWatcher: (gamePid: number, snapshot: Array<{ pid: number; name: string; priority: string }>) =>
    ipcRenderer.send('watcher:start', gamePid, snapshot),

  stopWatcher: () => ipcRenderer.send('watcher:stop'),

  manualRestore: (snapshot: Array<{ pid: number; name: string; priority: string }>) =>
    ipcRenderer.invoke('watcher:manualRestore', snapshot),

  getWatcherStatus: () => ipcRenderer.invoke('watcher:getStatus'),

  // ── Shutdown ────────────────────────────────────────────────────────────────
  shutdownApp: () => ipcRenderer.send('app:shutdown'),

  // ── IPC event subscriptions (renderer listens to main-process events) ───────
  onWatcherStarted: (cb: (data: { pid: number }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { pid: number }) => cb(data)
    ipcRenderer.on('watcher:started', handler)
    return () => ipcRenderer.removeListener('watcher:started', handler)
  },

  onWatcherStopped: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('watcher:stopped', handler)
    return () => ipcRenderer.removeListener('watcher:stopped', handler)
  },

  onWatcherAutoRestoring: (cb: (data: { pid: number; snapshotLength: number }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { pid: number; snapshotLength: number }) => cb(data)
    ipcRenderer.on('watcher:autoRestoring', handler)
    return () => ipcRenderer.removeListener('watcher:autoRestoring', handler)
  },

  onWatcherRestored: (cb: (data: { pid: number; snapshotLength: number }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { pid: number; snapshotLength: number }) => cb(data)
    ipcRenderer.on('watcher:restored', handler)
    return () => ipcRenderer.removeListener('watcher:restored', handler)
  },

  onShutdownStarted: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('app:shutdownStarted', handler)
    return () => ipcRenderer.removeListener('app:shutdownStarted', handler)
  },

  onRestoringBeforeQuit: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('app:restoringBeforeQuit', handler)
    return () => ipcRenderer.removeListener('app:restoringBeforeQuit', handler)
  },

  onRestoreComplete: (cb: () => void) => {
    const handler = () => cb()
    ipcRenderer.on('app:restoreComplete', handler)
    return () => ipcRenderer.removeListener('app:restoreComplete', handler)
  },

  // ── Window controls ─────────────────────────────────────────────────────────
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close')
}

// Use `contextBridge` APIs to expose Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
