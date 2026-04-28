import React, { useEffect, useRef } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  fontFamily: 'var(--font-mono)'
})

const MermaidDiagram: React.FC<{ chart: string }> = ({ chart }) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      mermaid.render(`mermaid-${Math.random().toString(36).slice(2)}`, chart).then(v => {
        if (ref.current) ref.current.innerHTML = v.svg
      }).catch(err => {
        console.error('Mermaid render error:', err)
      })
    }
  }, [chart])

  return <div ref={ref} style={{ display: 'flex', justifyContent: 'center' }} />
}

export const Documentation: React.FC = () => {
  const useCaseDiagram = `
flowchart LR
    User([User / Gamer])
    
    subgraph TruE ScripT
        Scan[Scan Processes]
        Select[Select Game]
        Optimize[Run Optimization]
        Monitor[Background Watcher]
        Restore[Auto Restore]
    end
    
    User --> Scan
    User --> Select
    User --> Optimize
    Optimize --> Monitor
    Monitor --> Restore
  `

  const algoDiagram = `
flowchart TD
    Start[User Clicks Optimize] --> Check{Is Game Selected?}
    Check -- Yes --> GetBg[Identify Background Apps]
    GetBg --> Filter[Filter Protected System Processes]
    Filter --> Batch[Execute PowerShell Batch Script]
    
    subgraph PowerShell Batch
        SetGame[Elevate Game Priority]
        SetBg[Lower Background Priority]
        SetTimer[NtSetTimerResolution 0.5ms]
        SetMMCSS[Apply MMCSS Games Profile]
    end
    
    Batch --> SetGame
    SetGame --> SetBg
    SetBg --> SetTimer
    SetTimer --> SetMMCSS
    
    SetMMCSS --> Watcher[Start Background Watcher]
    Watcher --> Wait{Is Game Running?}
    Wait -- Yes --> Delay[Wait 5 Seconds]
    Delay --> Wait
    Wait -- No --> Restore[Execute Restore Script]
    Restore --> End[Priorities Normalized]
  `

  return (
    <div style={{ padding: '30px 40px', color: 'var(--text-primary)', maxWidth: 860, margin: '0 auto', lineHeight: 1.7 }}>
      <h1 style={{ color: 'var(--accent)', fontSize: 26, marginBottom: 24, fontWeight: 800 }}>TruE ScripT Documentation</h1>
      
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 15, fontWeight: 700, color: 'var(--text-primary)' }}>1. Pengenalan Aplikasi</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'justify' }}>
          <strong>TruE ScripT</strong> adalah aplikasi penjadwal prioritas (Priority Scheduler) kelas profesional yang dirancang khusus untuk memaksimalkan performa dan stabilitas <em>frame-rate</em> game di sistem operasi Windows. Aplikasi ini bekerja secara dinamis di tingkat OS dengan mengalokasikan siklus CPU secara absolut ke proses game utama, menekan aktivitas aplikasi latar belakang (background apps), dan memaksa Windows Scheduler untuk berjalan pada interval resolusi tinggi (0.5ms) guna meminimalisasi latensi <em>input</em> dan <em>jitter</em>.
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 15, fontWeight: 700, color: 'var(--text-primary)' }}>2. Use Case Diagram</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 15 }}>
          Diagram di bawah ini mengilustrasikan alur interaksi antara pengguna (Gamer) dengan fungsi-fungsi utama di dalam sistem TruE ScripT.
        </p>
        <div style={{ background: 'var(--bg-surface)', padding: 20, borderRadius: 10, border: '1px solid var(--border)' }}>
          <MermaidDiagram chart={useCaseDiagram} />
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 15, fontWeight: 700, color: 'var(--text-primary)' }}>3. Algoritma & Cara Kerja Sistem</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 15, textAlign: 'justify' }}>
          Sistem bekerja secara asinkron menggunakan jembatan <em>IPC (Inter-Process Communication)</em> antara frontend React dan backend Node.js yang memanggil API Windows murni via injeksi PowerShell. Daftar di bawah merepresentasikan alur kondisional dan langkah eksekusi otomatis program.
        </p>
        <div style={{ background: 'var(--bg-surface)', padding: 20, borderRadius: 10, border: '1px solid var(--border)' }}>
          <MermaidDiagram chart={algoDiagram} />
        </div>
      </section>
      
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 15, fontWeight: 700, color: 'var(--text-primary)' }}>4. Pilar Utama Optimasi</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div style={{ background: 'rgba(0,229,160,0.03)', border: '1px solid var(--green-border)', padding: 15, borderRadius: 8 }}>
            <h3 style={{ color: 'var(--green)', fontSize: 14, marginBottom: 5 }}>Process Priority Class</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Mengubah tingkat penjadwalan CPU pada proses spesifik. Game akan dinaikkan ke level High, sedangkan ratusan proses aplikasi sekunder akan dipaksa mengantre di level Below Normal.</p>
          </div>
          
          <div style={{ background: 'rgba(124,106,255,0.03)', border: '1px solid var(--accent-border)', padding: 15, borderRadius: 8 }}>
            <h3 style={{ color: 'var(--accent)', fontSize: 14, marginBottom: 5 }}>Multimedia Class Scheduler Service (MMCSS)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Memodifikasi <code>SystemResponsiveness</code> di profil registri "Games". TruE ScripT menekan hak akses sistem background dari 20% menjadi hanya 10% maksimum, mendedikasikan 90% waktu CPU murni untuk game.</p>
          </div>
          
          <div style={{ background: 'rgba(255,140,66,0.03)', border: '1px solid rgba(255,140,66,0.2)', padding: 15, borderRadius: 8 }}>
            <h3 style={{ color: 'var(--orange)', fontSize: 14, marginBottom: 5 }}>High-Resolution Timer API</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Menjalankan pemanggilan tingkat-rendah <code>NtSetTimerResolution</code> untuk mengunci interval pewaktuan OS pada 0.5ms secara absolut, memastikan perpindahan frame game merespons dua kali lipat lebih cepat dibanding standar OS 1.0ms.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
