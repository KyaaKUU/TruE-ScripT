import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore, KNOWN_GAMES, ProcessInfo } from '../store/useAppStore'

const priorityBadge = (p: string) => {
  switch (p) {
    case 'High':
      return { bg: 'rgba(255,140,66,0.12)', color: 'var(--orange)', border: 'rgba(255,140,66,0.3)' }
    case 'AboveNormal':
      return { bg: 'rgba(255,209,102,0.1)', color: 'var(--yellow)', border: 'rgba(255,209,102,0.3)' }
    case 'Normal':
      return { bg: 'rgba(148,163,184,0.07)', color: 'var(--text-secondary)', border: 'var(--border-bright)' }
    case 'BelowNormal':
      return { bg: 'rgba(107,114,128,0.08)', color: '#6b7280', border: 'rgba(107,114,128,0.25)' }
    case 'Idle':
      return { bg: 'rgba(55,65,81,0.12)', color: '#4b5563', border: 'rgba(55,65,81,0.25)' }
    default:
      return { bg: 'rgba(148,163,184,0.07)', color: 'var(--text-muted)', border: 'var(--border)' }
  }
}

const cpuColor = (cpu: number) => {
  if (cpu > 50) return 'var(--red)'
  if (cpu > 20) return 'var(--orange)'
  if (cpu > 5)  return 'var(--accent)'
  return 'var(--text-muted)'
}

export const ProcessScanner: React.FC = () => {
  const {
    processes, setProcesses, setIsScanning, setLastScanTime, setScanError,
    isScanning, lastScanTime, selectedGamePid, selectedGameName,
    setSelectedGame, searchQuery, setSearchQuery, isOptimized
  } = useAppStore()

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [autoMsg, setAutoMsg] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'cpu'>('cpu')

  const scan = useCallback(async () => {
    if (isScanning) return
    setIsScanning(true)
    try {
      const procs: ProcessInfo[] = await window.api.getProcesses()
      setProcesses(procs)
      setLastScanTime(Date.now())
      setScanError(null)
    } catch (err) {
      setScanError(String(err))
    } finally {
      setIsScanning(false)
    }
  }, [isScanning, setIsScanning, setProcesses, setLastScanTime, setScanError])

  useEffect(() => {
    scan()
    intervalRef.current = setInterval(scan, 4000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const handleAutoDetect = () => {
    const hit = processes.find(p => KNOWN_GAMES[p.name.toLowerCase().replace('.exe', '')])
    if (hit) {
      setSelectedGame(hit.pid, hit.name)
      setAutoMsg(`✓ Detected: ${KNOWN_GAMES[hit.name.toLowerCase().replace('.exe', '')]} (PID ${hit.pid})`)
    } else {
      setAutoMsg('No known games found — select manually')
    }
    setTimeout(() => setAutoMsg(null), 3500)
  }

  const filtered = processes.filter(p =>
    !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'cpu') return b.cpu - a.cpu
    return a.name.localeCompare(b.name)
  })

  const selectedProc = processes.find(p => p.pid === selectedGamePid)
  const gameCount = processes.filter(p => KNOWN_GAMES[p.name.toLowerCase().replace('.exe', '')]).length

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, padding: 0 }}>

      {/* ── Header ── */}
      <div style={{
        padding: '12px 14px 10px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="icon-box" style={{
              width: 28, height: 28,
              background: 'var(--accent-subtle)',
              border: '1px solid var(--accent-border)'
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="var(--accent)" strokeWidth="2"/>
                <path d="m21 21-4.35-4.35" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Process Scanner
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, fontFamily: 'var(--font-mono)' }}>
                {lastScanTime
                  ? `${processes.length} procs · ${gameCount} games · ${new Date(lastScanTime).toLocaleTimeString()}`
                  : 'Initializing…'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isScanning && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--accent)' }}>
                <div className="animate-spin" style={{
                  width: 11, height: 11,
                  border: '1.5px solid rgba(124,106,255,0.2)',
                  borderTopColor: 'var(--accent)',
                  borderRadius: '50%'
                }} />
                Scanning
              </div>
            )}
          </div>
        </div>

        {/* Search + Auto-detect row */}
        <div style={{ display: 'flex', gap: 7, marginBottom: autoMsg ? 8 : 0 }}>
          {/* Search input */}
          <div style={{ flex: 1, position: 'relative' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              className="ts-input"
              placeholder="Filter processes…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: 28, paddingRight: 10, paddingTop: 7, paddingBottom: 7, fontSize: 12 }}
            />
          </div>

          {/* Sort toggle */}
          <button
            onClick={() => setSortBy(s => s === 'cpu' ? 'name' : 'cpu')}
            className="btn btn-ghost"
            style={{ padding: '7px 10px', fontSize: 11, gap: 4 }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M7 12h10M11 18h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {sortBy === 'cpu' ? 'CPU' : 'A-Z'}
          </button>

          {/* Auto-detect */}
          <button
            onClick={handleAutoDetect}
            className="btn btn-ghost"
            style={{ padding: '7px 12px', fontSize: 11 }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="12" r="3" fill="currentColor"/>
            </svg>
            Detect
          </button>
        </div>

        {/* Auto-detect result */}
        {autoMsg && (
          <div
            className="animate-fade-in-up"
            style={{
              fontSize: 11,
              padding: '5px 10px',
              borderRadius: 7,
              background: autoMsg.startsWith('✓') ? 'var(--green-dim)' : 'rgba(255,209,102,0.1)',
              color: autoMsg.startsWith('✓') ? 'var(--green)' : 'var(--yellow)',
              border: `1px solid ${autoMsg.startsWith('✓') ? 'var(--green-border)' : 'rgba(255,209,102,0.25)'}`,
              marginTop: 0
            }}
          >
            {autoMsg}
          </div>
        )}

        {/* Selected game bar */}
        {selectedGamePid && selectedProc && (
          <div
            className="animate-fade-in-up"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px',
              marginTop: 8,
              borderRadius: 8,
              background: 'rgba(124,106,255,0.08)',
              border: '1px solid rgba(124,106,255,0.25)'
            }}
          >
            <div className="status-dot active" />
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedProc.name}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
              PID {selectedProc.pid}
            </span>
            {!isOptimized && (
              <button
                onClick={() => setSelectedGame(null, null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, padding: '0 2px',
                  flexShrink: 0
                }}
                title="Clear selection"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Column headers ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '5px 14px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0
      }}>
        <span style={{ flex: 1, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Process</span>
        <span style={{ width: 52, textAlign: 'right', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>CPU</span>
        <span style={{ width: 80, textAlign: 'center', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', marginLeft: 8 }}>Priority</span>
      </div>

      {/* ── Process list ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', minHeight: 0 }}>
        {sorted.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, color: 'var(--text-muted)', fontSize: 12 }}>
            {isScanning ? 'Loading…' : 'No processes found'}
          </div>
        ) : (
          sorted.map(proc => {
            const isSelected  = proc.pid === selectedGamePid
            const isGame      = !!KNOWN_GAMES[proc.name.toLowerCase().replace('.exe', '')]
            const badge       = priorityBadge(proc.priority || 'Normal')
            const color       = cpuColor(proc.cpu)

            return (
              <div
                key={proc.pid}
                onClick={() => { setSelectedGame(proc.pid, proc.name) }}
                className={`proc-row ${isSelected ? 'selected' : isGame ? 'game-row' : ''}`}
              >
                {/* Name col */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isSelected && (
                      <div className="status-dot active" style={{ flexShrink: 0 }} />
                    )}
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: isSelected ? 600 : 400,
                        color: isSelected ? 'var(--accent)' : isGame ? 'var(--text-primary)' : 'var(--text-secondary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontFamily: 'var(--font-mono)',
                        maxWidth: 180
                      }}
                    >
                      {proc.name}
                    </span>
                    {isGame && !isSelected && (
                      <span style={{
                        fontSize: 8, fontWeight: 800, letterSpacing: '0.08em',
                        color: 'var(--accent)', background: 'var(--accent-subtle)',
                        border: '1px solid var(--accent-border)',
                        borderRadius: 4, padding: '1px 5px',
                        flexShrink: 0, fontFamily: 'var(--font-mono)'
                      }}>
                        GAME
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                    {proc.pid}
                  </div>
                </div>

                {/* CPU col */}
                <div style={{ width: 52, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                  <span style={{ fontSize: 10, color, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                    {proc.cpu.toFixed(1)}%
                  </span>
                  <div className="cpu-bar-track">
                    <div className="cpu-bar-fill" style={{
                      width: `${Math.min(proc.cpu, 100)}%`,
                      background: color
                    }} />
                  </div>
                </div>

                {/* Priority badge */}
                <div style={{ width: 80, marginLeft: 8, display: 'flex', justifyContent: 'center' }}>
                  <div className="badge" style={{
                    background: badge.bg,
                    color: badge.color,
                    borderColor: badge.border,
                    width: '100%',
                    justifyContent: 'center'
                  }}>
                    {proc.priority || 'Normal'}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── Footer stats ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 14px',
        borderTop: '1px solid var(--border)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <StatChip label="Total" value={processes.length} />
          <StatChip label="Shown" value={sorted.length} />
          <StatChip label="Games" value={gameCount} color="var(--accent)" />
        </div>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          auto-refresh 4s
        </span>
      </div>
    </div>
  )
}

const StatChip: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
    <span style={{ fontSize: 13, fontWeight: 700, color: color || 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
      {value}
    </span>
    <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {label}
    </span>
  </div>
)
