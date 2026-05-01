# LAPORAN TEKNIS SKRIPSI: TruE ScripT
### Gaming Priority Scheduler — Dokumentasi Lengkap

---

## 1. Deskripsi Umum Sistem
**TruE ScripT** adalah solusi perangkat lunak berbasis *Desktop-System Integration* yang dirancang untuk meminimalkan latensi sistem dan memaksimalkan *throughput* CPU untuk aplikasi *real-time* (Gaming). Sistem menggunakan arsitektur hybrid 4-layer yang menggabungkan kecepatan eksekusi **PowerShell** dengan fleksibilitas antarmuka **Electron/React**.

Tiga pilar optimasi utama:
1. **Process Priority Class** — Re-alokasi penjadwalan CPU
2. **High-Resolution Timer** — `NtSetTimerResolution` 0.5ms via P/Invoke
3. **MMCSS Tuning** — Modifikasi profil `SystemResponsiveness` di registri

---

## 2. Arsitektur Sistem

### 2.1 Persistent PowerShell Runner
- **Cara Kerja:** Menjalankan satu instansi `powershell.exe` di latar belakang
- **Komunikasi:** Transmisi via *stdin/stdout* dengan *Sentinel Token* (`__TRUESCRIPT_DONE__`)
- **Efisiensi:** Menghilangkan *overhead* pembuatan proses baru, penggunaan resource minimal
- **Flag:** `-NoProfile -NonInteractive -ExecutionPolicy Bypass`

### 2.2 Algoritma Monitoring Proses
- **CPU Usage:** Kalkulasi berbasis *Time Delta* pada `TotalProcessorTime`
- **RAM Usage:** Pemantauan `WorkingSet64` secara real-time
- **Mapping:** Penyederhanaan 6 level prioritas Windows → 4 kategori (Low, Normal, High, VeryHigh)

### 2.3 Layer Arsitektur

| Layer | Teknologi | Fungsi |
| :--- | :--- | :--- |
| Renderer | React 19 + Zustand 5 | Antarmuka pengguna, state management |
| Preload | Electron contextBridge | Jembatan IPC aman (context isolation) |
| Main | Node.js + Electron | Logika bisnis, watcher, tray, shutdown |
| System | PowerShell + C# P/Invoke | Manipulasi OS (prioritas, timer, registri) |

---

## 3. Logika Optimasi & Manipulasi Sistem

### 3.1 Penjadwalan CPU (CPU Scheduling)
Re-alokasi prioritas secara instan berdasarkan target:
- **Game:** Ditetapkan ke `High` agar mendapatkan kuota CPU utama
- **Background:** Proses non-vital diturunkan ke `BelowNormal` untuk mengurangi interupsi

### 3.2 High Precision System Timer (NtSetTimerResolution)
Memanggil API kernel via `ntdll.dll` untuk mengubah resolusi jam sistem dari **~15.6ms** ke **0.5ms** (peningkatan presisi 31×). Krusial untuk sinkronisasi input dan stabilitas *frame time*.

**Detail teknis:**
- Entry point: `NtSetTimerResolution(5000, $true, [ref]$actual)` via C# P/Invoke inline
- Cek guard: `if (-not ('TimerRes' -as [type]))` mencegah kompilasi ulang
- Tidak memerlukan UAC — fungsi user-mode di ntdll.dll
- Tidak menyebabkan flicker layar

### 3.3 Multimedia Class Scheduler Service (MMCSS)
Modifikasi registri pada `SystemProfile` untuk memberikan prioritas penuh pada task 'Games':
- **Path:** `HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile`
- **Normal preset:** `SystemResponsiveness = 20` (20% CPU untuk background)
- **Maximum preset:** `SystemResponsiveness = 10` (10% CPU untuk background, 90% untuk game)

---

## 4. Keamanan & Manajemen Risiko

### 4.1 Mekanisme Filter & Proteksi (Protected 65)
Keamanan dijamin melalui **tiga lapis filter**:

**Layer 1 — Frontend (OptimizeControls.tsx):**
Fungsi `isProtected(name, pid)` memfilter proses sebelum masuk snapshot.

**Layer 2 — Backend (powershell.ts):**
Fungsi identik di Node.js memastikan proses kritis tidak dikirim ke PowerShell.

**Layer 3 — PowerShell Guard:**
Cek final `if ($pid2 -lt 1000)` di dalam skrip. PID rendah tetap dilindungi.

#### Daftar 65 Proses Terproteksi:

| Kategori | Proses |
| :--- | :--- |
| Kernel & Boot | system, idle, smss, csrss, wininit, ntoskrnl, registry |
| Authentication | winlogon, lsass, lsaiso, consent |
| Services | services, svchost, spoolsv, trustedinstaller, wuauclt |
| Security | msmpeng, securityhealthservice, sgrmbroker, smartscreen |
| Desktop Shell | explorer, dwm, fontdrvhost, sihost, ctfmon, taskmgr |
| Runtime | runtimebroker, taskhost, taskhostw, wmiprvse, conhost, dllhost |
| GPU & Media | audiodg, nvdisplay.container, rtss |
| Self-Protection | electron, truescript, true script, true-script |

### 4.2 Prasyarat Hak Akses (Administrative Rights)
Program harus dijalankan dengan hak akses **Administrator** karena:
- Manipulasi `PriorityClass` pada proses lain memerlukan izin sistem
- Akses ke `ntdll.dll` untuk mengubah resolusi timer
- Modifikasi registri `HKEY_LOCAL_MACHINE` (HKLM)
- Build manifest: `requestedExecutionLevel: requireAdministrator`

### 4.3 Keamanan IPC
- **contextIsolation:** `true` — renderer tidak bisa mengakses Node.js langsung
- **nodeIntegration:** `false` — tidak ada akses langsung ke modul Node
- **sandbox:** `false` (diperlukan untuk preload script)
- Tidak menggunakan `RealTime` priority class (mencegah hang/BSOD)

---

## 5. Auto-Restore Engine (Background Watcher)

### 5.1 Mekanisme Polling
- **Interval:** 5 detik (`setTimeout`)
- **Metode deteksi:** `Get-Process -Id {pid}` → "ALIVE" / "DEAD"
- **Guard flag:** `isRestoringFromWatcher` mencegah double-restore

### 5.2 Alur Restore Otomatis
1. Game exit terdeteksi → `watcher:autoRestoring` event
2. Eksekusi restore script:
   - Kembalikan prioritas semua proses ke Normal
   - `NtSetTimerResolution(5000, $false)` → timer kembali ke ~15.6ms
   - `SystemResponsiveness = 20` → MMCSS kembali ke default
3. Kirim `watcher:restored` event → UI reset

### 5.3 Graceful Shutdown
1. Set `isShuttingDown = true`
2. Stop watcher
3. Restore snapshot (jika ada)
4. Tutup PowerShell process
5. Delay 300ms (UI paint)
6. `app.quit()`

---

## 6. Rincian Preset Optimasi

| Aspek | Minimum (SAFE) | Normal (RECOMMENDED) | Maximum (MAX FPS) |
| :--- | :--- | :--- | :--- |
| Game Priority | AboveNormal | High | High |
| Background Priority | Normal | Normal | BelowNormal |
| Timer Resolution | ✅ 0.5ms | ✅ 0.5ms | ✅ 0.5ms |
| MMCSS Games Profile | ❌ Disabled | ✅ Enabled (20% BG) | ✅ Enabled (10% BG) |
| SystemResponsiveness | Default (20) | 20 | 10 |
| Tingkat Risiko | Sangat rendah | Rendah | Sedang |
| Target Pengguna | PC lama/kantoran | Gaming umum | Esports/kompetitif |

---

## 7. IPC API Reference

### 7.1 Invoke Methods (12 total)
| Method | Parameter | Return | Fungsi |
| :--- | :--- | :--- | :--- |
| ps:getProcesses | — | ProcessInfo[] | Scan semua proses |
| ps:batchOptimize | gamePid, name, bgPids, preset | OptResult[] | Optimasi batch |
| ps:restoreSnapshot | snapshot[] | OptResult[] | Restore prioritas |
| ps:saveReport | content: string | {success, path} | Simpan laporan |
| watcher:manualRestore | snapshot[] | OptResult[] | Stop + restore |
| watcher:getStatus | — | {active, pid, length} | Status watcher |

### 7.2 Event Listeners (7 total)
| Event | Data | Trigger |
| :--- | :--- | :--- |
| watcher:started | {pid} | Watcher mulai |
| watcher:stopped | — | Watcher stop |
| watcher:autoRestoring | {pid, snapshotLength} | Game exit |
| watcher:restored | {pid, snapshotLength} | Restore selesai |
| app:shutdownStarted | — | Shutdown dimulai |
| app:restoringBeforeQuit | — | Restore sebelum quit |
| app:restoreComplete | — | Restore done |

---

## 8. Technology Stack

| Komponen | Teknologi | Versi | Fungsi |
| :--- | :--- | :--- | :--- |
| Runtime | Electron | 41.x | Desktop app framework |
| UI | React | 19.x | Komponen antarmuka |
| State | Zustand | 5.x | Global state store |
| Diagram | Mermaid | 11.x | Visualisasi |
| Build | electron-vite | 3.x | Bundling + HMR |
| Language | TypeScript | 5.7 | Type safety |
| Styling | Vanilla CSS | — | Design system kustom |
| System | PowerShell + C# P/Invoke | 5.1+ | Windows API |
| Installer | electron-builder (NSIS) | 26.x | .exe installer |

---

## 9. Struktur File Proyek

```
TruE ScripT/
├── src/
│   ├── main/
│   │   ├── index.ts          # Bootstrap, watcher, tray, IPC
│   │   └── powershell.ts     # PS runner, protected list, handlers
│   ├── preload/
│   │   ├── index.ts           # API bridge (12 methods + 7 events)
│   │   └── index.d.ts         # TypeScript declarations
│   └── renderer/src/
│       ├── main.tsx            # React entry
│       ├── App.tsx             # Root layout + StatusBar
│       ├── store/useAppStore.ts # Zustand (state + actions + KNOWN_GAMES)
│       ├── assets/main.css     # Design system (tokens, components)
│       └── components/
│           ├── TitleBar.tsx     # Window chrome + status pill
│           ├── ProcessScanner.tsx # Process list + adaptive polling
│           ├── PresetSelector.tsx # 3-preset card selector
│           ├── OptimizeControls.tsx # Optimize/Restore/Shutdown
│           ├── StatusFeed.tsx    # Terminal-style operation log
│           └── Documentation.tsx # In-app docs (Mermaid)
├── electron.vite.config.ts
├── package.json
├── LOGO.png
└── Start-TruEScripT.bat
```

---

## 10. Kesimpulan Teknis
TruE ScripT mengintegrasikan otomasi sistem tingkat rendah dengan antarmuka modern untuk memberikan solusi optimasi yang aman, efisien, dan transparan bagi pengguna Windows. Dengan tiga lapis keamanan, auto-restore otomatis, dan tiga pilar optimasi (Priority, Timer, MMCSS), aplikasi ini menjamin peningkatan performa game tanpa risiko kerusakan sistem.
