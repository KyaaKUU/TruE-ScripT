import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { execFile } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerPowerShellHandlers, executeRestoreSnapshot, destroyPsProcess, runPowerShell } from './powershell'

// ─── Fix: Chromium cache "Access is denied" when running as Administrator ─────
// When requireAdministrator is set, Chromium tries to move its cache from
// AppData\Roaming. UAC elevation blocks cross-session roaming access → error 0x5.
// Fix 1: redirect userData to AppData\Local (elevation-safe, no UAC virtualization)
// Fix 2: disable GPU shader disk cache (not needed for a desktop scheduler app)
// IMPORTANT: setPath and commandLine switches MUST be called before app.whenReady()
const localAppData = process.env.LOCALAPPDATA || join(app.getPath('home'), 'AppData', 'Local')
app.setPath('userData', join(localAppData, 'TruE ScripT'))
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disk-cache-size', '0')

// ─── Types shared between watcher and IPC ────────────────────────────────────
interface SnapshotEntry {
  pid: number
  name: string
  priority: string
  ioNormal: boolean
}

// ─── Background watcher state ────────────────────────────────────────────────
let watcherInterval: ReturnType<typeof setInterval> | null = null
let watcherGamePid: number | null = null
let watcherSnapshot: SnapshotEntry[] = []
let isShuttingDown = false

// ─── App state ────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let refreshTrayMenu: (() => void) | null = null

// ─── Create Main Window ───────────────────────────────────────────────────────
function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#090e17',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  // ── Hide to tray on close (instead of quitting) ───────────────────────────
  mainWindow.on('close', (event) => {
    if (!isShuttingDown) {
      event.preventDefault()
      mainWindow!.hide()
      tray?.displayBalloon?.({
        iconType: 'info',
        title: 'TruE ScripT',
        content: 'Still running in the background. Right-click the tray icon to quit.'
      })
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// ─── System Tray ──────────────────────────────────────────────────────────────
function createTray(): void {
  // Use the app icon, falling back to an empty image if not found
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(join(__dirname, '../../resources/icon.png'))
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty()
    }
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('TruE ScripT — Gaming Priority Scheduler')

  const updateTrayMenu = () => {
    const watcherRunning = watcherInterval !== null
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'TruE ScripT',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Show Window',
        click: () => {
          mainWindow?.show()
          mainWindow?.focus()
        }
      },
      {
        label: watcherRunning
          ? `⚡ Watching PID ${watcherGamePid} (auto-restore active)`
          : '🔵 Idle — no session active',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Restore & Quit',
        click: () => {
          performShutdown()
        }
      },
      {
        label: 'Force Quit (no restore)',
        click: () => {
          isShuttingDown = true
          destroyPsProcess()
          app.quit()
        }
      }
    ])
    tray!.setContextMenu(contextMenu)
  }

  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  updateTrayMenu()
  // Store for internal refresh calls
  refreshTrayMenu = updateTrayMenu
}

// ─── Background Watcher ───────────────────────────────────────────────────────
function startWatcher(gamePid: number, snapshot: SnapshotEntry[]): void {
  stopWatcher()
  watcherGamePid = gamePid
  watcherSnapshot = snapshot

  watcherInterval = setInterval(async () => {
    if (isShuttingDown) return
    try {
      // Check if game PID is still alive.
      // NOTE: process.kill(pid,0) is POSIX-only — on Windows it always throws
      // EPERM for elevated/cross-session processes (e.g. games running as admin),
      // causing false auto-restores. tasklist /FI is the correct Windows approach.
      let gameRunning = false
      try {
        const checkScript = `if (Get-Process -Id ${watcherGamePid} -ErrorAction SilentlyContinue) { Write-Output "ALIVE" } else { Write-Output "DEAD" }`
        const isAlive = await runPowerShell(checkScript, 3000)
        gameRunning = isAlive.includes('ALIVE')
      } catch {
        // If PS check fails, assume running to avoid false restore
        gameRunning = true
      }

      if (!gameRunning) {
        stopWatcher()
        // Notify renderer that auto-restore is firing
        mainWindow?.webContents.send('watcher:autoRestoring', {
          pid: watcherGamePid,
          snapshotLength: watcherSnapshot.length
        })

        await executeRestoreSnapshot(watcherSnapshot)

        // Notify renderer that restore is complete
        mainWindow?.webContents.send('watcher:restored', {
          pid: watcherGamePid,
          snapshotLength: watcherSnapshot.length
        })
        watcherSnapshot = []
        watcherGamePid = null
        refreshTrayMenu?.()
      }
    } catch { /* swallow — watcher must never crash */ }
  }, 5000)

  // Notify renderer watcher is now active
  mainWindow?.webContents.send('watcher:started', { pid: gamePid })
  refreshTrayMenu?.()
}

function stopWatcher(): void {
  if (watcherInterval) {
    clearInterval(watcherInterval)
    watcherInterval = null
  }
}

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
async function performShutdown(): Promise<void> {
  if (isShuttingDown) return
  isShuttingDown = true

  stopWatcher()
  mainWindow?.webContents.send('app:shutdownStarted')

  if (watcherSnapshot.length > 0) {
    try {
      mainWindow?.webContents.send('app:restoringBeforeQuit')
      await executeRestoreSnapshot(watcherSnapshot)
      mainWindow?.webContents.send('app:restoreComplete')
    } catch { /* ignore restore errors on shutdown */ }
  }

  destroyPsProcess()

  // Brief delay to allow the renderer to paint the "Complete" state
  await new Promise(resolve => setTimeout(resolve, 300))

  mainWindow?.removeAllListeners('close')
  app.quit()
}

// ─── App Bootstrap ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.truescript.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerPowerShellHandlers(ipcMain)
  createWindow()
  createTray()

  // ── Window control handlers ──────────────────────────────────────────────
  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize()
  })
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.on('window:close', () => {
    // Hide to tray (same as native close button)
    mainWindow?.hide()
  })

  // ── Watcher control IPC ──────────────────────────────────────────────────
  ipcMain.on('watcher:start', (_event, gamePid: number, snapshot: SnapshotEntry[]) => {
    startWatcher(gamePid, snapshot)
  })

  ipcMain.on('watcher:stop', () => {
    stopWatcher()
    watcherSnapshot = []
    watcherGamePid = null
    refreshTrayMenu?.()
    mainWindow?.webContents.send('watcher:stopped')
  })

  // ── Manual restore IPC (called from UI Restore button) ──────────────────
  ipcMain.handle('watcher:manualRestore', async (_event, snapshot: SnapshotEntry[]) => {
    stopWatcher()
    const results = await executeRestoreSnapshot(snapshot)
    watcherSnapshot = []
    watcherGamePid = null
    refreshTrayMenu?.()
    mainWindow?.webContents.send('watcher:stopped')
    return results
  })

  // ── Shutdown IPC (called from UI Shutdown button) ────────────────────────
  ipcMain.on('app:shutdown', () => {
    performShutdown()
  })

  // ── Watcher status query ─────────────────────────────────────────────────
  ipcMain.handle('watcher:getStatus', () => {
    return {
      active: watcherInterval !== null,
      gamePid: watcherGamePid,
      snapshotLength: watcherSnapshot.length
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// ─── Prevent default quit (tray app stays alive) ─────────────────────────────
app.on('window-all-closed', () => {
  // Do NOT quit — we hide to tray instead
  // Only quit when isShuttingDown is set
})

app.on('before-quit', () => {
  isShuttingDown = true
  stopWatcher()
  destroyPsProcess()
})
