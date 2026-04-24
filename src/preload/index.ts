import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Process scanning
  getProcesses: () => ipcRenderer.invoke('ps:getProcesses'),

  // Single process priority
  setPriority: (pid: number, priority: string, processName: string) =>
    ipcRenderer.invoke('ps:setPriority', pid, priority, processName),

  // I/O priority
  setIoPriority: (pid: number, ioLevel: 'Normal' | 'Low') =>
    ipcRenderer.invoke('ps:setIoPriority', pid, ioLevel),

  // Batch optimize (preset)
  batchOptimize: (
    gamePid: number,
    gameProcessName: string,
    backgroundPids: Array<{ pid: number; name: string }>,
    preset: 'minimum' | 'normal' | 'maximum'
  ) => ipcRenderer.invoke('ps:batchOptimize', gamePid, gameProcessName, backgroundPids, preset),

  // Restore from snapshot
  restoreSnapshot: (
    snapshot: Array<{ pid: number; name: string; priority: string; ioNormal: boolean }>
  ) => ipcRenderer.invoke('ps:restoreSnapshot', snapshot),

  // Window controls
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
