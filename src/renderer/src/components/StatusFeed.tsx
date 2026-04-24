import React, { useEffect, useRef } from 'react'
import { useAppStore, StatusFeedEntry } from '../store/useAppStore'

/* ── Status helpers ──────────────────────────────────────────────────────── */
const STATUS_META: Record<StatusFeedEntry['status'], { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    color: 'var(--green)',
    bg:    'rgba(0,229,160,0.08)',
    border:'rgba(0,229,160,0.18)',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
        <path d="M20 6 9 17l-5-5" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    )
  },
  failed: {
    color: 'var(--red)',
    bg:    'rgba(255,77,109,0.08)',
    border:'rgba(255,77,109,0.18)',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
        <path d="M18 6 6 18M6 6l12 12" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    )
  },
  skipped: {
    color: 'var(--text-muted)',
    bg:    'transparent',
    border:'transparent',
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
        <path d="M5 12h14" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    )
  },
  pending: {
    color: 'var(--accent)',
    bg:    'rgba(124,106,255,0.06)',
    border:'rgba(124,106,255,0.18)',
    icon: (
      <div
        style={{
          width: 11, height: 11,
          border: '1.5px solid rgba(124,106,255,0.25)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
          flexShrink: 0
        }}
      />
    )
  }
}

/* ── Summary pill ────────────────────────────────────────────────────────── */
const SummaryPill: React.FC<{ label: string; count: number; color: string }> = ({ label, count, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
    <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
      <span style={{ color, fontWeight: 700 }}>{count}</span>{' '}{label}
    </span>
  </div>
)

/* ── Main component ──────────────────────────────────────────────────────── */
export const StatusFeed: React.FC = () => {
  const { statusFeed, clearStatusFeed } = useAppStore()
  const topRef = useRef<HTMLDivElement>(null)

  // Scroll to top on new entry (newest at top)
  useEffect(() => {
    topRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [statusFeed.length])

  const successCount = statusFeed.filter(e => e.status === 'success').length
  const failedCount  = statusFeed.filter(e => e.status === 'failed').length
  const skippedCount = statusFeed.filter(e => e.status === 'skipped').length

  return (
    <div
      className="card"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, padding: 0 }}
    >
      {/* ── Header ── */}
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="icon-box" style={{
            width: 28, height: 28,
            background: 'var(--accent-subtle)',
            border: '1px solid var(--accent-border)'
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke="var(--accent)" strokeWidth="2" fill="none"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              Status Feed
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, fontFamily: 'var(--font-mono)' }}>
              {statusFeed.length > 0 ? `${statusFeed.length} entries · real-time` : 'Waiting for operations…'}
            </div>
          </div>
        </div>

        {statusFeed.length > 0 && (
          <button
            onClick={clearStatusFeed}
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: '4px 10px', height: 26 }}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Feed entries ── */}
      <div
        ref={topRef}
        style={{ flex: 1, overflowY: 'auto', padding: '8px', minHeight: 0 }}
      >
        {statusFeed.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 10,
            color: 'var(--text-muted)'
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.6 }}>
              No operations yet<br/>
              <span style={{ fontSize: 10, opacity: 0.6 }}>Press Optimize to begin</span>
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {statusFeed.map((entry, idx) => {
              const meta = STATUS_META[entry.status]
              const isLatest = idx === 0
              const isSystemEntry = entry.pid === 0

              return (
                <div
                  key={entry.id}
                  className="feed-entry animate-slide-in"
                  style={isLatest ? {
                    background: meta.bg,
                    borderColor: meta.border,
                    animationDelay: `${Math.min(idx * 0.015, 0.2)}s`
                  } : {
                    animationDelay: `${Math.min(idx * 0.015, 0.2)}s`
                  }}
                >
                  {/* Status icon */}
                  <div style={{ marginTop: 2, flexShrink: 0 }}>
                    {meta.icon}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 1 }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: isSystemEntry ? 700 : 600,
                        color: meta.color,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontFamily: isSystemEntry ? 'var(--font)' : 'var(--font-mono)'
                      }}>
                        {entry.name}
                      </span>
                      {entry.pid !== 0 && (
                        <span style={{
                          fontSize: 9,
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                          flexShrink: 0
                        }}>
                          {entry.pid}
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: isLatest ? 'var(--text-secondary)' : 'var(--text-muted)',
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {entry.message}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <span style={{
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    flexShrink: 0,
                    marginTop: 2
                  }}>
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Footer summary ── */}
      {statusFeed.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '7px 14px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <SummaryPill label="ok"   count={successCount} color="var(--green)" />
            <SummaryPill label="err"  count={failedCount}  color="var(--red)" />
            <SummaryPill label="skip" count={skippedCount} color="var(--text-muted)" />
          </div>
          <span style={{
            fontSize: 9,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.06em'
          }}>
            {statusFeed.length} / 100 max
          </span>
        </div>
      )}
    </div>
  )
}
