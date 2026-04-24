import React from 'react'
import { TitleBar } from './components/TitleBar'
import { ProcessScanner } from './components/ProcessScanner'
import { PresetSelector } from './components/PresetSelector'
import { OptimizeControls } from './components/OptimizeControls'
import { StatusFeed } from './components/StatusFeed'
import { useAppStore } from './store/useAppStore'

// ─── Static decorative layer — rendered ONCE, never re-renders ───────────────
// Keeping these outside the App component means store changes don't re-create
// gradient + grid DOM elements on every tick.
const BgDecor: React.FC = React.memo(() => (
  <>
    {/* Ambient glow — top-left */}
    <div style={{
      position: 'fixed', top: -120, left: -120,
      width: 400, height: 400, borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(124,106,255,0.07) 0%, transparent 70%)',
      pointerEvents: 'none', zIndex: 0
    }} />
    {/* Ambient glow — bottom-right */}
    <div style={{
      position: 'fixed', bottom: -80, right: -80,
      width: 350, height: 350, borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(0,229,160,0.05) 0%, transparent 70%)',
      pointerEvents: 'none', zIndex: 0
    }} />
    {/* Subtle grid */}
    <div style={{
      position: 'fixed', inset: 0,
      backgroundImage: `
        linear-gradient(rgba(124,106,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(124,106,255,0.025) 1px, transparent 1px)
      `,
      backgroundSize: '48px 48px',
      pointerEvents: 'none', zIndex: 0
    }} />
  </>
))
BgDecor.displayName = 'BgDecor'

// ─── App root ─────────────────────────────────────────────────────────────────
function App(): React.JSX.Element {
  // Granular selectors — App only re-renders when isOptimized or isScanning changes
  const isOptimized = useAppStore(s => s.isOptimized)
  const isScanning  = useAppStore(s => s.isScanning)

  return (
    <div
      id="app-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
        position: 'relative'
      }}
    >
      <BgDecor />

      {/* Title bar */}
      <div style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
        <TitleBar isOptimized={isOptimized} isScanning={isScanning} />
      </div>

      {/* Main 2-column layout */}
      <div
        id="main-layout"
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 400px',
          gap: 10,
          padding: '10px 12px',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
          minHeight: 0
        }}
      >
        {/* LEFT — Process Scanner */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <ProcessScanner />
        </div>

        {/* RIGHT — Stacked controls */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          gap: 10, minHeight: 0, overflow: 'hidden'
        }}>
          <PresetSelector />
          <OptimizeControls />
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <StatusFeed />
          </div>
        </div>
      </div>

      {/* Bottom status bar — static, wrapped in memo */}
      <StatusBar />
    </div>
  )
}

/* ── Bottom status bar ───────────────────────────────────────────────────── */
const StatusBar: React.FC = React.memo(() => (
  <div style={{
    height: 26,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 14px',
    borderTop: '1px solid var(--border)',
    background: 'rgba(4,6,13,0.9)',
    backdropFilter: 'blur(12px)',
    flexShrink: 0, position: 'relative', zIndex: 10
  }}>
    <StatusChip color="var(--green)"  icon={<ShieldIcon />}   label="15 system processes protected" />
    <StatusChip color="var(--orange)" icon={<AlertIcon />}    label="Realtime priority blocked" />
    <StatusChip color="var(--accent)" icon={<TerminalIcon />} label="Running as Administrator" />
  </div>
))
StatusBar.displayName = 'StatusBar'

const StatusChip: React.FC<{ icon: React.ReactNode; label: string; color: string }> = ({ icon, label, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', fontSize: 10 }}>
    <span style={{ color, display: 'flex', alignItems: 'center' }}>{icon}</span>
    <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>{label}</span>
  </div>
)

const ShieldIcon   = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2"/><path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const AlertIcon    = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2"/><path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
const TerminalIcon = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><polyline points="4 17 10 11 4 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="19" x2="20" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>

export default App
