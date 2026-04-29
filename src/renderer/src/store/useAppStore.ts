import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ProcessInfo {
  pid: number
  name: string
  priority: string
  cpu: number
  ram: number
  category?: 'game' | 'background' | 'system'
}

export interface SnapshotEntry {
  pid: number
  name: string
  priority: string
}

export interface StatusFeedEntry {
  id: string
  pid: number
  name: string
  status: 'success' | 'failed' | 'skipped' | 'pending'
  message: string
  timestamp: number
}

export type OptimizePreset = 'minimum' | 'normal' | 'maximum'

export interface AppState {
  // ── Process data ──────────────────────────────────────────────────────────
  processes: ProcessInfo[]
  isScanning: boolean
  lastScanTime: number | null
  scanError: string | null

  // ── Game selection ────────────────────────────────────────────────────────
  selectedGamePid: number | null
  selectedGameName: string | null
  searchQuery: string

  // ── Optimization state ────────────────────────────────────────────────────
  preset: OptimizePreset
  isOptimized: boolean
  isOptimizing: boolean
  isRestoring: boolean
  snapshot: SnapshotEntry[]

  // ── Background watcher (driven by backend IPC events) ─────────────────────
  watcherActive: boolean
  autoRestoreCount: number
  isShuttingDown: boolean

  // ── Status feed ───────────────────────────────────────────────────────────
  statusFeed: StatusFeedEntry[]

  // ── UI state ──────────────────────────────────────────────────────────────
  isDocOpen: boolean

  // ── Actions ───────────────────────────────────────────────────────────────
  setProcesses: (processes: ProcessInfo[]) => void
  setIsScanning: (v: boolean) => void
  setLastScanTime: (t: number) => void
  setScanError: (e: string | null) => void

  setSelectedGame: (pid: number | null, name: string | null) => void
  setSearchQuery: (q: string) => void

  setPreset: (preset: OptimizePreset) => void
  setIsOptimized: (v: boolean) => void
  setIsOptimizing: (v: boolean) => void
  setIsRestoring: (v: boolean) => void
  saveSnapshot: (snapshot: SnapshotEntry[]) => void
  clearSnapshot: () => void

  // ── Watcher actions ───────────────────────────────────────────────────────
  setWatcherActive: (v: boolean) => void
  incrementAutoRestoreCount: () => void
  setIsShuttingDown: (v: boolean) => void

  addStatusEntry: (entry: Omit<StatusFeedEntry, 'id' | 'timestamp'>) => void
  clearStatusFeed: () => void

  setIsDocOpen: (v: boolean) => void
}

// ─── Known game executables (auto-detect list) ────────────────────────────────
export const KNOWN_GAMES: Record<string, string> = {
  'valorant': 'VALORANT',
  'valorant-win64-shipping': 'VALORANT',
  'cs2': 'Counter-Strike 2',
  'csgo': 'CS:GO',
  'r5apex': 'Apex Legends',
  'r5apex_dx12': 'Apex Legends (DX12)',
  'fortnite': 'Fortnite',
  'fortniteclient-win64-shipping': 'Fortnite',
  'overwatch': 'Overwatch 2',
  'overwatch_shipping': 'Overwatch 2',
  'destiny2': 'Destiny 2',
  'lotusclient-win64-shipping': 'Warframe',
  'paladins': 'Paladins',
  'rocketleague': 'Rocket League',
  'dota2': 'Dota 2',
  'gta5': 'GTA V',
  'elden ring': 'Elden Ring',
  'eldenring': 'Elden Ring',
  'sekiro': 'Sekiro',
  'minecraft': 'Minecraft',
  'javaw': 'Minecraft (Java)',
  'cod': 'Call of Duty',
  'blackops6': 'Black Ops 6',
  'modernwarfare': 'Modern Warfare',
  'warzone': 'Warzone',
  'pubg': 'PUBG',
  'tslgame': 'PUBG',
  'rainbow6': 'Rainbow Six Siege',
  'r6': 'Rainbow Six Siege',
  'acvalhallarelauncher': "Assassin's Creed Valhalla",
  'rdr2': 'Red Dead Redemption 2',
  'cyberpunk2077': 'Cyberpunk 2077',
  'witcher3': 'The Witcher 3',
  'splitgate': 'Splitgate',
  'battlebit': 'BattleBit Remastered',
  'the finals': 'THE FINALS',
  'discovery': 'THE FINALS',
  'smite2': 'SMITE 2',
  'deadlock': 'Deadlock',
  'marvel rivals': 'Marvel Rivals',
  'marvelrivals-win64-shipping': 'Marvel Rivals',
  'league of legends': 'League of Legends',
  'leagueoflegends': 'League of Legends',
  'worldofwarcraft': 'World of Warcraft',
  'wow': 'World of Warcraft',
  'hearthstone': 'Hearthstone',
  'diablo iv': 'Diablo IV',
  'diablo4': 'Diablo IV',
  'd4': 'Diablo IV',
  'starrail': 'Honkai: Star Rail',
  'genshinimpact': 'Genshin Impact',
  'yuanshen': 'Genshin Impact',
  'zenlesszonezero': 'Zenless Zone Zero',
  'zzz': 'Zenless Zone Zero',
  'honkaiimpact3': 'Honkai Impact 3rd',
  'houkai3rd': 'Honkai Impact 3rd',
  'bh3': 'Honkai Impact 3rd',
  'hoyoplay': 'HoyoPlay',
}

// ─── Zustand Store ────────────────────────────────────────────────────────────
let feedIdCounter = 0

export const useAppStore = create<AppState>((set) => ({
  // defaults
  processes: [],
  isScanning: false,
  lastScanTime: null,
  scanError: null,

  selectedGamePid: null,
  selectedGameName: null,
  searchQuery: '',

  preset: 'normal',
  isOptimized: false,
  isOptimizing: false,
  isRestoring: false,
  snapshot: [],

  // watcher state — driven purely by backend IPC events
  watcherActive: false,
  autoRestoreCount: 0,
  isShuttingDown: false,

  statusFeed: [],
  isDocOpen: false,

  // actions
  setProcesses: (processes) => set({ processes }),
  setIsScanning: (v) => set({ isScanning: v }),
  setLastScanTime: (t) => set({ lastScanTime: t }),
  setScanError: (e) => set({ scanError: e }),

  setSelectedGame: (pid, name) => set({ selectedGamePid: pid, selectedGameName: name }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  setPreset: (preset) => set({ preset }),
  setIsOptimized: (v) => set({ isOptimized: v }),
  setIsOptimizing: (v) => set({ isOptimizing: v }),
  setIsRestoring: (v) => set({ isRestoring: v }),
  saveSnapshot: (snapshot) => set({ snapshot }),
  clearSnapshot: () => set({ snapshot: [] }),

  setWatcherActive: (v) => set({ watcherActive: v }),
  incrementAutoRestoreCount: () => set((s) => ({ autoRestoreCount: s.autoRestoreCount + 1 })),
  setIsShuttingDown: (v) => set({ isShuttingDown: v }),

  addStatusEntry: (entry) =>
    set((state) => ({
      statusFeed: [
        {
          ...entry,
          id: `feed-${++feedIdCounter}`,
          timestamp: Date.now()
        },
        ...state.statusFeed.slice(0, 49) // keep last 50
      ]
    })),

  clearStatusFeed: () => set({ statusFeed: [] }),
  setIsDocOpen: (v) => set({ isDocOpen: v })
}))
