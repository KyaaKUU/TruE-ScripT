import React from 'react'
import { useAppStore, OptimizePreset } from '../store/useAppStore'

// ─── Preset definitions ────────────────────────────────────────────────────────
const PRESETS: Array<{
  id: OptimizePreset
  label: string
  tag: string
  tagColor: string
  subtitle: string            // one-liner shown under label
  detail: string              // expanded sentence shown in active banner
  game: string                // game priority label
  bg: string                  // background priority label
  io: string                  // I/O label
  features: string[]          // chips of what's active
  missing: string[]           // chips of what's NOT included (greyed)
  accentColor: string
  accentDim: string
  accentBorder: string
  accentGlow: string
  barGradient: string
}> = [
  {
    id: 'minimum',
    label: 'Minimum',
    tag: 'SAFE',
    tagColor: 'var(--green)',
    subtitle: 'Gentle boost, zero risk',
    detail: 'Raises game CPU priority to Above Normal and sets a 0.5 ms system timer for smoother frame pacing. Safest choice for any PC.',
    game: 'Above Normal',
    bg: 'Normal',
    io: 'Unchanged',
    features: ['0.5 ms Timer'],
    missing: ['Games Profile', 'Power Plan'],
    accentColor: 'var(--green)',
    accentDim: 'var(--green-dim)',
    accentBorder: 'var(--green-border)',
    accentGlow: 'var(--green-glow)',
    barGradient: 'linear-gradient(90deg, var(--green), #38bdf8)'
  },
  {
    id: 'normal',
    label: 'Normal',
    tag: 'RECOMMENDED',
    tagColor: 'var(--accent)',
    subtitle: 'Stable FPS, balanced system',
    detail: 'Raises game priority to High and applies Windows Games profile. Gives the game consistent CPU headroom without aggressive side-effects.',
    game: 'High',
    bg: 'Normal',
    io: 'Unchanged',
    features: ['0.5 ms Timer', 'Games Profile'],
    missing: ['Power Plan'],
    accentColor: 'var(--accent)',
    accentDim: 'var(--accent-subtle)',
    accentBorder: 'var(--accent-border)',
    accentGlow: 'var(--accent-glow)',
    barGradient: 'linear-gradient(90deg, var(--accent), var(--accent-2))'
  },
  {
    id: 'maximum',
    label: 'Maximum',
    tag: 'MAX FPS',
    tagColor: 'var(--orange)',
    subtitle: 'Full stack, lowest latency',
    detail: 'Everything in Normal plus High Performance power plan, and gently lowers background app priority to Below Normal. Best safe performance.',
    game: 'High',
    bg: 'Below Normal',
    io: 'Unchanged',
    features: ['0.5 ms Timer', 'Games Profile', 'Power Plan'],
    missing: [],
    accentColor: 'var(--orange)',
    accentDim: 'var(--orange-dim)',
    accentBorder: 'rgba(255,140,66,0.35)',
    accentGlow: 'var(--orange-glow)',
    barGradient: 'linear-gradient(90deg, var(--orange), var(--red))'
  }
]

// ─── Feature chip colours ──────────────────────────────────────────────────────
const CHIP_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  '0.5 ms Timer':  { bg: 'rgba(0,229,160,0.1)',    color: 'var(--green)',   border: 'rgba(0,229,160,0.25)' },
  'Games Profile': { bg: 'rgba(0,229,160,0.1)',    color: 'var(--green)',   border: 'rgba(0,229,160,0.25)' },
  'Power Plan':    { bg: 'rgba(255,140,66,0.12)',  color: 'var(--orange)',  border: 'rgba(255,140,66,0.3)' },
}

export const PresetSelector: React.FC = React.memo(() => {
  const preset    = useAppStore(s => s.preset)
  const setPreset = useAppStore(s => s.setPreset)
  const isOptimized = useAppStore(s => s.isOptimized)

  const active = PRESETS.find(p => p.id === preset)!

  return (
    <div className="card" style={{ padding: '14px 14px 12px', flexShrink: 0 }}>

      {/* ── Header ── */}
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
            Select before optimizing · locked while active
          </div>
        </div>
      </div>

      {/* ── Preset cards ── */}
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
              {/* Bottom accent bar */}
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
                display: 'inline-flex', alignItems: 'center',
                fontSize: 8, fontWeight: 800, letterSpacing: '0.12em',
                color: p.tagColor,
                background: p.accentDim,
                border: `1px solid ${p.accentBorder}`,
                borderRadius: 4, padding: '2px 6px',
                marginBottom: 7,
                fontFamily: 'var(--font-mono)'
              }}>
                {p.tag}
              </div>

              {/* Label */}
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: isActive ? p.accentColor : 'var(--text-primary)',
                marginBottom: 3,
                transition: 'color 0.15s'
              }}>
                {p.label}
              </div>

              {/* Subtitle */}
              <div style={{
                fontSize: 10, color: 'var(--text-muted)',
                lineHeight: 1.35, marginBottom: 10
              }}>
                {p.subtitle}
              </div>

              {/* Spec rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <SpecRow
                  label="Game priority"
                  value={p.game}
                  highlight={isActive}
                  highlightColor={p.accentColor}
                />
                <SpecRow label="BG priority" value={p.bg} />
                <SpecRow label="I/O & RAM" value={p.io} />
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Active preset detail banner ── */}
      <div style={{
        marginTop: 10,
        padding: '9px 11px',
        borderRadius: 9,
        background: active.accentDim,
        border: `1px solid ${active.accentBorder}`,
        transition: 'all 0.25s'
      }}>
        {/* Row 1: what it does */}
        <div style={{
          fontSize: 10.5, color: 'var(--text-secondary)',
          lineHeight: 1.5, marginBottom: 8
        }}>
          <span style={{ color: active.accentColor, fontWeight: 700 }}>{active.label}: </span>
          {active.detail}
        </div>

        {/* Row 2: feature chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {active.features.map(f => {
            const c = CHIP_COLORS[f] ?? { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: 'var(--border)' }
            return (
              <span key={f} style={{
                fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)',
                letterSpacing: '0.06em',
                padding: '2px 7px', borderRadius: 4,
                background: c.bg, color: c.color, border: `1px solid ${c.border}`
              }}>
                ✓ {f}
              </span>
            )
          })}
          {active.missing.map(f => (
            <span key={f} style={{
              fontSize: 9, fontWeight: 500, fontFamily: 'var(--font-mono)',
              letterSpacing: '0.06em',
              padding: '2px 7px', borderRadius: 4,
              background: 'rgba(255,255,255,0.03)',
              color: '#2d3748',
              border: '1px solid rgba(255,255,255,0.06)',
              textDecoration: 'line-through'
            }}>
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* ── Safety notice ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        marginTop: 8,
        padding: '6px 10px',
        borderRadius: 7,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border)'
      }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
          style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            stroke="currentColor" strokeWidth="2"/>
          <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: 9.5, color: 'var(--text-muted)', lineHeight: 1.3 }}>
          System processes never touched · All changes auto-restored on exit
        </span>
      </div>
    </div>
  )
})
PresetSelector.displayName = 'PresetSelector'

/* ── SpecRow sub-component ─────────────────────────────────────────────────── */
const SpecRow: React.FC<{
  label: string
  value: string
  highlight?: boolean
  highlightColor?: string
}> = ({ label, value, highlight, highlightColor = 'var(--orange)' }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontSize: 9, color: '#2d3748', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
      {label}
    </span>
    <span style={{
      fontSize: 10, fontWeight: 700,
      fontFamily: 'var(--font-mono)',
      color: highlight
        ? highlightColor
        : value === 'Below Normal' || value === 'Low + Trim' || value === 'Low'
          ? '#6b7280'
          : 'var(--text-secondary)'
    }}>
      {value}
    </span>
  </div>
)
