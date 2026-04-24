import React from 'react'
import { useAppStore, OptimizePreset } from '../store/useAppStore'

const PRESETS: Array<{
  id: OptimizePreset
  label: string
  desc: string
  tag: string
  gameP: string
  bgP: string
  io: string
  accentColor: string
  accentDim: string
  accentBorder: string
  accentGlow: string
  barGradient: string
}> = [
  {
    id: 'minimum',
    label: 'Minimum',
    desc: 'Safe CPU boost, no side effects',
    tag: 'SAFE',
    gameP: 'High',
    bgP: 'Normal',
    io: 'Normal',
    accentColor: 'var(--green)',
    accentDim: 'var(--green-dim)',
    accentBorder: 'var(--green-border)',
    accentGlow: 'var(--green-glow)',
    barGradient: 'linear-gradient(90deg, var(--green), #38bdf8)'
  },
  {
    id: 'normal',
    label: 'Normal',
    desc: 'Balanced FPS gain & stability',
    tag: 'RECOMMENDED',
    gameP: 'High',
    bgP: 'BelowNormal',
    io: 'Low',
    accentColor: 'var(--accent)',
    accentDim: 'var(--accent-subtle)',
    accentBorder: 'var(--accent-border)',
    accentGlow: 'var(--accent-glow)',
    barGradient: 'linear-gradient(90deg, var(--accent), var(--accent-2))'
  },
  {
    id: 'maximum',
    label: 'Maximum',
    desc: 'Max FPS — aggressive background throttle',
    tag: 'MAX FPS',
    gameP: 'High',
    bgP: 'Idle',
    io: 'Low',
    accentColor: 'var(--orange)',
    accentDim: 'var(--orange-dim)',
    accentBorder: 'rgba(255,140,66,0.35)',
    accentGlow: 'var(--orange-glow)',
    barGradient: 'linear-gradient(90deg, var(--orange), var(--red))'
  }
]

export const PresetSelector: React.FC = () => {
  const { preset, setPreset, isOptimized } = useAppStore()

  return (
    <div className="card" style={{ padding: '14px 14px 12px', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div className="icon-box" style={{
          width: 28, height: 28,
          background: 'var(--accent-subtle)',
          border: '1px solid var(--accent-border)'
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
              stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            Performance Preset
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
            Choose optimization aggressiveness
          </div>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', gap: 8 }}>
        {PRESETS.map((p) => {
          const isActive = preset === p.id
          return (
            <button
              key={p.id}
              onClick={() => !isOptimized && setPreset(p.id)}
              disabled={isOptimized}
              className="preset-card"
              style={{
                background: isActive ? p.accentDim : 'var(--bg-surface)',
                borderColor: isActive ? p.accentColor : 'var(--border-bright)',
                boxShadow: isActive ? `0 0 20px ${p.accentGlow}, inset 0 1px 0 rgba(255,255,255,0.04)` : 'none',
                opacity: isOptimized && !isActive ? 0.4 : 1,
                cursor: isOptimized ? 'not-allowed' : 'pointer'
              }}
            >
              {/* Bottom bar when active */}
              <div style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0,
                height: 2,
                background: isActive ? p.barGradient : 'transparent',
                borderRadius: '0 0 14px 14px',
                transition: 'all 0.2s'
              }} />

              {/* Tag */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.1em',
                color: p.accentColor,
                background: p.accentDim,
                border: `1px solid ${p.accentBorder}`,
                borderRadius: 5,
                padding: '2px 6px',
                marginBottom: 8,
                fontFamily: 'var(--font-mono)'
              }}>
                {p.tag}
              </div>

              {/* Label */}
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: isActive ? p.accentColor : 'var(--text-primary)',
                marginBottom: 4,
                transition: 'color 0.15s'
              }}>
                {p.label}
              </div>

              {/* Description */}
              <div style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                lineHeight: 1.4,
                marginBottom: 10
              }}>
                {p.desc}
              </div>

              {/* Spec rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <SpecRow label="Game" value={p.gameP} highlight={isActive} highlightColor={p.accentColor} />
                <SpecRow label="BG" value={p.bgP} />
                <SpecRow label="I/O" value={p.io} />
              </div>
            </button>
          )
        })}
      </div>

      {/* Safety notice */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        marginTop: 10,
        padding: '7px 10px',
        borderRadius: 8,
        background: 'rgba(0,229,160,0.04)',
        border: '1px solid rgba(0,229,160,0.12)'
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--green)', flexShrink: 0 }}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2"/>
          <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>
          <span style={{ color: 'var(--green)', fontWeight: 600 }}>Safety locked — </span>
          Realtime priority blocked · System processes protected
        </span>
      </div>
    </div>
  )
}

const SpecRow: React.FC<{ label: string; value: string; highlight?: boolean; highlightColor?: string }> = ({
  label, value, highlight, highlightColor = 'var(--orange)'
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{label}</span>
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      fontFamily: 'var(--font-mono)',
      color: highlight
        ? highlightColor
        : value === 'BelowNormal' ? '#6b7280'
        : value === 'Idle' ? '#4b5563'
        : value === 'Low'  ? '#6b7280'
        : 'var(--text-secondary)'
    }}>
      {value}
    </span>
  </div>
)
