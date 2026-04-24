import React from 'react'

interface TitleBarProps {
  isOptimized: boolean
  isScanning: boolean
}

export const TitleBar: React.FC<TitleBarProps> = React.memo(({ isOptimized, isScanning }) => {
  const minimize = () => window.api.minimizeWindow()
  const maximize = () => window.api.maximizeWindow()
  const close    = () => window.api.closeWindow()

  return (
    <div
      className="titlebar-drag"
      style={{
        height: 46,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px 0 14px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(4, 6, 13, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        flexShrink: 0,
        position: 'relative'
      }}
    >
      {/* Accent line top */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent 0%, var(--accent) 30%, var(--accent-2) 60%, transparent 100%)',
        opacity: 0.5
      }} />

      {/* Left: Logo + name */}
      <div className="titlebar-no-drag" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Logo mark */}
        <div style={{
          width: 30, height: 30,
          borderRadius: 9,
          background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
          boxShadow: '0 0 16px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white"/>
          </svg>
        </div>

        {/* App name */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{
            fontSize: 14,
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1
          }}>
            TruE <span className="gradient-text">ScripT</span>
          </span>
          <span style={{
            fontSize: 9,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.08em',
            fontWeight: 500,
            marginBottom: 1
          }}>
            v1.0
          </span>
        </div>

        {/* Status pill */}
        <StatusPill isOptimized={isOptimized} isScanning={isScanning} />
      </div>

      {/* Center: subtitle */}
      <div style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 10,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.1em',
        pointerEvents: 'none'
      }}>
        GAMING PRIORITY SCHEDULER
      </div>

      {/* Right: Window controls */}
      <div className="titlebar-no-drag" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button onClick={minimize} className="win-btn" title="Minimize">
          <svg width="11" height="11" viewBox="0 0 12 12">
            <rect x="1" y="5.5" width="10" height="1" rx="0.5" fill="currentColor"/>
          </svg>
        </button>
        <button onClick={maximize} className="win-btn" title="Maximize">
          <svg width="11" height="11" viewBox="0 0 12 12">
            <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
          </svg>
        </button>
        <button onClick={close} className="win-btn close" title="Close">
          <svg width="11" height="11" viewBox="0 0 12 12">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
})
TitleBar.displayName = 'TitleBar'

/* ── Status pill ─────────────────────────────────────────────────────────── */
const StatusPill: React.FC<{ isOptimized: boolean; isScanning: boolean }> = ({ isOptimized, isScanning }) => {
  const text  = isOptimized ? 'Optimized' : isScanning ? 'Scanning' : 'Idle'
  const color = isOptimized ? 'var(--green)' : isScanning ? 'var(--accent)' : 'var(--text-muted)'
  const bg    = isOptimized ? 'var(--green-dim)' : isScanning ? 'var(--accent-subtle)' : 'rgba(255,255,255,0.04)'
  const bc    = isOptimized ? 'var(--green-border)' : isScanning ? 'var(--accent-border)' : 'var(--border-bright)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '3px 10px',
      borderRadius: 99,
      background: bg,
      border: `1px solid ${bc}`,
      fontSize: 10,
      color,
      fontWeight: 600,
      letterSpacing: '0.05em',
      transition: 'all 0.25s ease'
    }}>
      <div className={`status-dot ${isOptimized ? 'active' : isScanning ? 'warn' : 'idle'}`} />
      {text}
    </div>
  )
}
