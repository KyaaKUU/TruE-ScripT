import React, { useEffect, useRef } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({ startOnLoad: false, theme: 'dark', fontFamily: 'var(--font-mono)' })

const Mmd: React.FC<{ chart: string }> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) {
      mermaid.render(`m-${Math.random().toString(36).slice(2)}`, chart)
        .then(v => { if (ref.current) ref.current.innerHTML = v.svg })
        .catch(() => {})
    }
  }, [chart])
  return <div ref={ref} style={{ display: 'flex', justifyContent: 'center' }} />
}

const Box: React.FC<{ children: React.ReactNode; chart?: string }> = ({ children, chart }) => (
  <div style={{ background: 'var(--bg-surface)', padding: 20, borderRadius: 10, border: '1px solid var(--border)', marginBottom: chart ? 0 : 10 }}>
    {chart ? <Mmd chart={chart} /> : children}
  </div>
)

const H2: React.FC<{ n: number; children: React.ReactNode }> = ({ n, children }) => (
  <h2 style={{ fontSize: 18, borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
    {n}. {children}
  </h2>
)

const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 15, textAlign: 'justify', lineHeight: 1.7 }}>{children}</p>
)

const Pill: React.FC<{ color: string; title: string; children: React.ReactNode }> = ({ color, title, children }) => (
  <div style={{ background: `${color}08`, border: `1px solid ${color}33`, padding: 15, borderRadius: 8 }}>
    <h3 style={{ color, fontSize: 14, marginBottom: 5 }}>{title}</h3>
    <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: 0, lineHeight: 1.6 }}>{children}</p>
  </div>
)

/* ─────────────────────── DIAGRAMS ─────────────────────── */

const ARCH = `graph TB
    subgraph Renderer["Renderer (React 19 + Zustand 5)"]
        UI["UI Components"]
        Store["Zustand Store"]
    end
    subgraph Preload["Preload Bridge"]
        API["window.api"]
    end
    subgraph Main["Main Process (Node.js)"]
        IPC["IPC Handlers"]
        Watch["Background Watcher"]
        Tray["System Tray"]
    end
    subgraph System["System Level"]
        PS["PowerShell Runner"]
        Win["Windows API"]
    end
    UI --> API --> IPC --> PS --> Win
    Watch -->|"poll 5s"| PS
    Watch -->|"events"| UI`

const USECASE = `flowchart LR
    Actor(["User / Gamer"])
    subgraph TruE ScripT
        UC1["Scan Proses"]
        UC2["Filter & Cari"]
        UC3["Pilih Game"]
        UC4["Auto-Detect"]
        UC5["Pilih Preset"]
        UC6["Optimasi"]
        UC7["Restore"]
        UC8["Shutdown"]
    end
    subgraph System
        Watcher(["Background Watcher"])
        PSE(["PowerShell Engine"])
    end
    Actor --> UC1 & UC2 & UC3 & UC4 & UC5 & UC6 & UC7 & UC8
    UC6 -->|"include"| PSE
    UC6 -->|"triggers"| Watcher
    UC7 -->|"include"| PSE
    Watcher -->|"auto"| UC7`

const FLOW_OPT = `flowchart TD
    S(["User klik Optimize"]) --> V1{"Game selected?"}
    V1 -- No --> Err["Tombol disabled"]
    V1 -- Yes --> V2{"Sudah optimized?"}
    V2 -- Yes --> Err
    V2 -- No --> Snap["Simpan Snapshot prioritas"]
    Snap --> Split["Identifikasi proses:\n1 Game + N Background"]
    Split --> Filter["Filter Protected 65\n+ PID < 1000"]
    Filter --> PS["Kirim ke PowerShell"]
    subgraph PowerShell
        P1["Set PriorityClass"]
        P2["NtSetTimerResolution 0.5ms"]
        P3["MMCSS SystemProfile"]
    end
    PS --> P1 --> P2 --> P3
    P3 --> Log["Tulis hasil ke StatusFeed"]
    Log --> Report["Simpan Session Report"]
    Report --> Watch["Aktifkan Watcher 5s"]
    Watch --> Done(["Optimasi Selesai"])`

const FLOW_RESTORE = `flowchart TD
    WS(["Watcher aktif"]) --> Sleep["Tunggu 5 detik"]
    Sleep --> CK1{"Shutting down?"}
    CK1 -- Yes --> Stop(["Berhenti"])
    CK1 -- No --> CK2{"Guard aktif?"}
    CK2 -- Yes --> Sleep
    CK2 -- No --> Check["PS: Get-Process GamePID"]
    Check --> Alive{"Game hidup?"}
    Alive -- Yes --> Sleep
    Alive -- Error --> Sleep
    Alive -- "No (DEAD)" --> Guard["Set guard = true"]
    Guard --> Notify1["Event: autoRestoring"]
    Notify1 --> Exec["executeRestoreSnapshot"]
    subgraph Restore
        R1["Reset prioritas"]
        R2["Timer -> 15.6ms"]
        R3["MMCSS -> default"]
    end
    Exec --> R1 --> R2 --> R3
    R3 --> Notify2["Event: restored"]
    Notify2 --> Clear["Clear snapshot & state"]
    Clear --> Stop`

const FLOW_SHUTDOWN = `flowchart TD
    T(["Shutdown triggered"]) --> Already{"Already shutting?"}
    Already -- Yes --> Ignore(["Skip"])
    Already -- No --> Flag["isShuttingDown = true"]
    Flag --> StopW["Stop Watcher"]
    StopW --> Evt1["Event: shutdownStarted"]
    Evt1 --> HasSnap{"Snapshot ada?"}
    HasSnap -- No --> Skip["Skip restore"]
    HasSnap -- Yes --> Evt2["Event: restoringBeforeQuit"]
    Evt2 --> Rest["executeRestoreSnapshot()"]
    Rest --> Evt3["Event: restoreComplete"]
    Evt3 --> Kill["Tutup PowerShell"]
    Skip --> Kill
    Kill --> Delay["300ms delay"]
    Delay --> Quit(["app.quit()"])`

const SEQ = `sequenceDiagram
    participant U as User
    participant R as React
    participant M as Main Process
    participant PS as PowerShell
    participant W as Windows API
    U->>R: Klik Optimize
    R->>R: Simpan snapshot
    R->>M: batchOptimize()
    M->>M: Filter Protected 65
    M->>PS: Script via stdin
    PS->>W: Set PriorityClass
    PS->>W: NtSetTimerResolution(0.5ms)
    PS->>W: Set SystemResponsiveness
    W-->>PS: OK
    PS-->>M: JSON results
    M-->>R: OptResult[]
    R->>M: startWatcher(pid)
    Note over M,PS: Polling setiap 5 detik
    loop Game Running
        M->>PS: Get-Process PID
        PS-->>M: ALIVE
    end
    PS-->>M: DEAD
    M-->>R: autoRestoring
    M->>PS: Restore script
    PS->>W: Reset semua
    M-->>R: restored
    R->>R: Clear state`

const SECURITY = `flowchart LR
    Input["Proses baru"] --> L1["Layer 1: Frontend\nisProtected(name, pid)"]
    L1 -->|Blocked| X1["Tidak masuk snapshot"]
    L1 -->|Pass| L2["Layer 2: Backend\nisProtected(name, pid)"]
    L2 -->|Blocked| X2["Tidak dikirim ke PS"]
    L2 -->|Pass| L3["Layer 3: PowerShell\nif pid < 1000"]
    L3 -->|Blocked| X3["SKIPPED:SYSTEM"]
    L3 -->|Pass| OK["Aman dimodifikasi"]`

const COMPONENT = `graph TD
    App["App.tsx"]
    App --> TB["TitleBar"]
    App --> SB["StatusBar"]
    App -->|"isDocOpen?"| Doc["Documentation"]
    App --> Layout["Main Grid"]
    Layout --> PS2["ProcessScanner"]
    Layout --> Right["Right Column"]
    Right --> Preset["PresetSelector"]
    Right --> OC["OptimizeControls"]
    Right --> SF["StatusFeed"]
    Store[("Zustand Store")] -.-> PS2 & Preset & OC & SF & TB & SB`

/* ─────────────────────── TABLES ─────────────────────── */

const TRow: React.FC<{ cells: string[]; header?: boolean }> = ({ cells, header }) => (
  <tr>{cells.map((c, i) => header
    ? <th key={i} style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--accent)', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }}>{c}</th>
    : <td key={i} style={{ padding: '5px 10px', fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{c}</td>
  )}</tr>
)

const Table: React.FC<{ headers: string[]; rows: string[][] }> = ({ headers, rows }) => (
  <div style={{ overflowX: 'auto', marginBottom: 15 }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)' }}>
      <thead><TRow cells={headers} header /></thead>
      <tbody>{rows.map((r, i) => <TRow key={i} cells={r} />)}</tbody>
    </table>
  </div>
)

/* ─────────────────────── MAIN ─────────────────────── */

export const Documentation: React.FC = () => (
  <div style={{ padding: '30px 40px', color: 'var(--text-primary)', maxWidth: 900, margin: '0 auto', lineHeight: 1.7 }}>
    <h1 style={{ color: 'var(--accent)', fontSize: 26, marginBottom: 6, fontWeight: 800 }}>TruE ScripT — Dokumentasi Teknis</h1>
    <p style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)', marginBottom: 30 }}>Gaming Priority Scheduler · v1.0 · Dokumentasi Lengkap</p>

    {/* ── 1. PENGENALAN ── */}
    <section style={{ marginBottom: 40 }}>
      <H2 n={1}>Pengenalan Aplikasi</H2>
      <P>
        <strong>TruE ScripT</strong> adalah aplikasi <em>Desktop Priority Scheduler</em> yang dirancang untuk memaksimalkan performa dan stabilitas <em>frame-rate</em> game di Windows.
        Sistem bekerja di tiga level: (1) <strong>Process Priority</strong> — menaikkan prioritas CPU game dan menekan background apps,
        (2) <strong>Timer Resolution</strong> — mengunci interval pewaktuan OS dari ~15.6ms ke 0.5ms via <code>NtSetTimerResolution</code>,
        (3) <strong>MMCSS Tuning</strong> — memodifikasi profil registri Multimedia Class Scheduler Service.
        Semua perubahan bersifat <strong>100% reversibel</strong> — sistem otomatis mengembalikan ke kondisi default saat game ditutup.
      </P>
      <div style={{ display: 'flex', gap: 10 }}>
        {[
          { l: 'Arsitektur', v: 'Electron + React + PowerShell' },
          { l: 'Proteksi', v: '65 proses sistem + PID < 1000' },
          { l: 'Timer', v: '0.5ms (31× lebih presisi)' },
          { l: 'Restore', v: 'Otomatis saat game exit' },
        ].map(s => (
          <div key={s.l} style={{ flex: 1, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>{s.l}</div>
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{s.v}</div>
          </div>
        ))}
      </div>
    </section>

    {/* ── 2. ARSITEKTUR ── */}
    <section style={{ marginBottom: 40 }}>
      <H2 n={2}>Arsitektur Sistem</H2>
      <P>Aplikasi menggunakan arsitektur hybrid 4-layer: Renderer (React), Preload Bridge, Main Process (Node.js), dan System Level (PowerShell). Komunikasi menggunakan IPC (Inter-Process Communication) Electron.</P>
      <Box chart={ARCH} />
      <div style={{ height: 15 }} />
      <Table headers={['Layer', 'Teknologi', 'Fungsi']} rows={[
        ['Renderer', 'React 19 + Zustand 5', 'Antarmuka pengguna, state management'],
        ['Preload', 'Electron contextBridge', 'Jembatan IPC aman (context isolation)'],
        ['Main', 'Node.js + Electron', 'Logika bisnis, watcher, tray, shutdown'],
        ['System', 'PowerShell + C# P/Invoke', 'Manipulasi OS (prioritas, timer, registri)'],
      ]} />
    </section>

    {/* ── 3. USE CASE ── */}
    <section style={{ marginBottom: 40 }}>
      <H2 n={3}>Use Case Diagram</H2>
      <P>Diagram berikut menunjukkan 8 use case utama dan hubungan antara aktor User, Background Watcher, dan PowerShell Engine.</P>
      <Box chart={USECASE} />
      <div style={{ height: 15 }} />
      <Table headers={['ID', 'Use Case', 'Aktor', 'Pre-condition', 'Post-condition']} rows={[
        ['UC-1', 'Scan Proses', 'User', 'App berjalan', 'Daftar proses tampil'],
        ['UC-2', 'Filter & Cari', 'User', 'Proses terscan', 'List terfilter'],
        ['UC-3', 'Pilih Game', 'User', 'Proses terscan', 'Game terseleksi'],
        ['UC-4', 'Auto-Detect', 'User', 'Proses terscan', 'Game auto-detect'],
        ['UC-5', 'Pilih Preset', 'User', 'Game terseleksi', 'Preset terpilih'],
        ['UC-6', 'Optimasi', 'User + PS', 'Game + preset siap', 'Watcher aktif'],
        ['UC-7', 'Restore', 'User / Watcher', 'Teroptimasi', 'Kembali normal'],
        ['UC-8', 'Shutdown', 'User', 'App berjalan', 'Restore lalu exit'],
      ]} />
    </section>

    {/* ── 4. FLOWCHART OPTIMASI ── */}
    <section style={{ marginBottom: 40 }}>
      <H2 n={4}>Flowchart Proses Optimasi</H2>
      <P>Alur eksekusi saat user menekan tombol Optimize — mulai dari validasi, snapshot, PowerShell batch, hingga aktivasi watcher.</P>
      <Box chart={FLOW_OPT} />
    </section>

    {/* ── 5. FLOWCHART AUTO-RESTORE ── */}
    <section style={{ marginBottom: 40 }}>
      <H2 n={5}>Flowchart Auto-Restore (Background Watcher)</H2>
      <P>Backend Watcher melakukan polling setiap 5 detik untuk mengecek apakah game masih berjalan. Saat game ditutup, sistem otomatis mengembalikan prioritas, timer resolution (15.6ms), dan SystemResponsiveness ke default Windows.</P>
      <Box chart={FLOW_RESTORE} />
    </section>

    {/* ── 6. SEQUENCE DIAGRAM ── */}
    <section style={{ marginBottom: 40 }}>
      <H2 n={6}>Sequence Diagram — Alur IPC Lengkap</H2>
      <P>Diagram sekuensial menunjukkan alur komunikasi antar-komponen dari klik user hingga auto-restore saat game exit.</P>
      <Box chart={SEQ} />
    </section>

    {/* ── 7. FLOWCHART SHUTDOWN ── */}
    <section style={{ marginBottom: 40 }}>
      <H2 n={7}>Flowchart Graceful Shutdown</H2>
      <P>Saat user menutup aplikasi, sistem menjalankan sequence: stop watcher → restore prioritas → tutup PowerShell → quit. Delay 300ms disisipkan agar UI sempat menampilkan status akhir.</P>
      <Box chart={FLOW_SHUTDOWN} />
    </section>

    {/* ── 8. KEAMANAN ── */}
    <section style={{ marginBottom: 40 }}>
      <H2 n={8}>Model Keamanan — Protected 65</H2>
      <P>Keamanan dijamin melalui tiga lapis filter. Setiap proses harus melewati validasi di Frontend, Backend, dan PowerShell sebelum bisa dimodifikasi.</P>
      <Box chart={SECURITY} />
      <div style={{ height: 15 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Pill color="var(--green)" title="Layer 1 — Frontend Filter (OptimizeControls.tsx)">
          Fungsi <code>isProtected(name, pid)</code> memfilter proses sebelum masuk ke snapshot. Proses dengan nama terdaftar atau PID {'<'} 1000 langsung diblokir.
        </Pill>
        <Pill color="var(--accent)" title="Layer 2 — Backend Filter (powershell.ts)">
          Fungsi identik di backend memastikan bahwa meskipun frontend dibypass, proses kritis tidak pernah dikirim ke PowerShell.
        </Pill>
        <Pill color="var(--orange)" title="Layer 3 — PowerShell Guard">
          Cek final <code>if ($pid2 -lt 1000)</code> di dalam skrip PowerShell. Bahkan jika kedua layer sebelumnya gagal, PID rendah tetap dilindungi.
        </Pill>
      </div>
      <div style={{ height: 15 }} />
      <Table headers={['Kategori', 'Proses yang Dilindungi']} rows={[
        ['Kernel & Boot', 'system, idle, smss, csrss, wininit, ntoskrnl, registry'],
        ['Authentication', 'winlogon, lsass, lsaiso, consent'],
        ['Services', 'services, svchost, spoolsv, trustedinstaller, wuauclt'],
        ['Security', 'msmpeng, securityhealthservice, sgrmbroker, smartscreen'],
        ['Desktop Shell', 'explorer, dwm, fontdrvhost, sihost, ctfmon, taskmgr'],
        ['Runtime', 'runtimebroker, taskhost, taskhostw, wmiprvse, conhost, dllhost'],
        ['GPU & Media', 'audiodg, nvdisplay.container, rtss'],
        ['Self-Protection', 'electron, truescript, true script, true-script'],
      ]} />
    </section>

    {/* ── 9. KOMPONEN ── */}
    <section style={{ marginBottom: 40 }}>
      <H2 n={9}>Arsitektur Komponen React</H2>
      <P>Hierarki komponen React dan hubungannya dengan Zustand store. Semua komponen menggunakan granular selector untuk mencegah re-render yang tidak perlu.</P>
      <Box chart={COMPONENT} />
    </section>

    {/* ── 10. PILAR OPTIMASI ── */}
    <section style={{ marginBottom: 40 }}>
      <H2 n={10}>Tiga Pilar Optimasi</H2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Pill color="var(--green)" title="Pilar 1 — Process Priority Class">
          Mengubah tingkat penjadwalan CPU melalui Windows API <code>PriorityClass</code>. Game dinaikkan ke <strong>High</strong>, background apps ditekan ke <strong>BelowNormal</strong>. Ini memastikan thread scheduler Windows mengalokasikan lebih banyak quantum time ke game.
        </Pill>
        <Pill color="var(--accent)" title="Pilar 2 — Multimedia Class Scheduler Service (MMCSS)">
          Memodifikasi <code>SystemResponsiveness</code> di registri <code>HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile</code>. Default Windows mengalokasikan 20% CPU untuk background — TruE ScripT menekan menjadi 10% pada preset Maximum, mendedikasikan 90% CPU untuk game.
        </Pill>
        <Pill color="var(--orange)" title="Pilar 3 — High-Resolution Timer (NtSetTimerResolution)">
          Memanggil API kernel <code>ntdll.dll → NtSetTimerResolution(5000, true)</code> via C# P/Invoke inline di PowerShell. Memangkas resolusi timer OS dari ~15.6ms ke 0.5ms — peningkatan presisi 31×. Ini mengurangi <em>frame-time jitter</em> dan latensi input secara signifikan. Tidak memerlukan UAC karena merupakan panggilan user-mode.
        </Pill>
      </div>
    </section>

    {/* ── 11. PRESET ── */}
    <section style={{ marginBottom: 40 }}>
      <H2 n={11}>Perbandingan Preset Optimasi</H2>
      <Table headers={['Aspek', 'Minimum (SAFE)', 'Normal (RECOMMENDED)', 'Maximum (MAX FPS)']} rows={[
        ['Game Priority', 'AboveNormal', 'High', 'High'],
        ['Background Priority', 'Normal', 'Normal', 'BelowNormal'],
        ['Timer Resolution', '✅ 0.5ms', '✅ 0.5ms', '✅ 0.5ms'],
        ['MMCSS Profile', '❌ Disabled', '✅ 20% BG CPU', '✅ 10% BG CPU'],
        ['SystemResponsiveness', 'Default (20)', '20', '10'],
        ['Tingkat Risiko', 'Sangat rendah', 'Rendah', 'Sedang'],
        ['Target Pengguna', 'PC lama / kantoran', 'Gaming umum', 'Esports / kompetitif'],
      ]} />
    </section>

    {/* ── 12. IPC API ── */}
    <section style={{ marginBottom: 40 }}>
      <H2 n={12}>Referensi IPC API</H2>
      <h3 style={{ fontSize: 14, color: 'var(--green)', marginBottom: 8 }}>Invoke Methods (Request → Response)</h3>
      <Table headers={['Method', 'Parameter', 'Return', 'Fungsi']} rows={[
        ['ps:getProcesses', '—', 'ProcessInfo[]', 'Scan semua proses'],
        ['ps:batchOptimize', 'gamePid, name, bgPids, preset', 'OptResult[]', 'Optimasi batch'],
        ['ps:restoreSnapshot', 'snapshot[]', 'OptResult[]', 'Restore prioritas'],
        ['ps:saveReport', 'content: string', '{success, path}', 'Simpan laporan .md'],
        ['watcher:manualRestore', 'snapshot[]', 'OptResult[]', 'Stop watcher + restore'],
        ['watcher:getStatus', '—', '{active, pid, length}', 'Cek status watcher'],
      ]} />
      <h3 style={{ fontSize: 14, color: 'var(--accent)', marginBottom: 8, marginTop: 15 }}>Send Methods (Fire-and-Forget)</h3>
      <Table headers={['Method', 'Parameter', 'Fungsi']} rows={[
        ['watcher:start', 'gamePid, snapshot[]', 'Mulai monitoring'],
        ['watcher:stop', '—', 'Stop monitoring'],
        ['app:shutdown', '—', 'Graceful shutdown'],
        ['window:minimize/maximize/close', '—', 'Kontrol jendela'],
      ]} />
      <h3 style={{ fontSize: 14, color: 'var(--orange)', marginBottom: 8, marginTop: 15 }}>Event Listeners (Backend → Frontend)</h3>
      <Table headers={['Event', 'Data', 'Trigger']} rows={[
        ['watcher:started', '{pid}', 'Watcher mulai polling'],
        ['watcher:stopped', '—', 'Watcher dihentikan'],
        ['watcher:autoRestoring', '{pid, snapshotLength}', 'Game exit terdeteksi'],
        ['watcher:restored', '{pid, snapshotLength}', 'Auto-restore selesai'],
        ['app:shutdownStarted', '—', 'Shutdown dimulai'],
        ['app:restoringBeforeQuit', '—', 'Restore sebelum quit'],
        ['app:restoreComplete', '—', 'Restore done, quit'],
      ]} />
    </section>

    {/* ── 13. TECH STACK ── */}
    <section style={{ marginBottom: 40 }}>
      <H2 n={13}>Technology Stack</H2>
      <Table headers={['Komponen', 'Teknologi', 'Versi', 'Fungsi']} rows={[
        ['Runtime', 'Electron', '41.x', 'Desktop app framework'],
        ['UI Framework', 'React', '19.x', 'Komponen antarmuka'],
        ['State', 'Zustand', '5.x', 'Global state store'],
        ['Diagram', 'Mermaid', '11.x', 'Visualisasi flowchart'],
        ['Build', 'Vite (electron-vite)', '6.x', 'Bundling + HMR'],
        ['Language', 'TypeScript', '5.7', 'Type safety'],
        ['Styling', 'Vanilla CSS', '—', 'Design system kustom'],
        ['System', 'PowerShell + C# P/Invoke', '5.1+', 'Windows API calls'],
        ['Installer', 'electron-builder (NSIS)', '26.x', 'Windows .exe installer'],
      ]} />
    </section>

    {/* ── FOOTER ── */}
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 15, marginTop: 30, textAlign: 'center' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
        TruE ScripT Documentation Engine · v1.0 · 13 Sections · 8 Diagrams
      </p>
    </div>
  </div>
)
