import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useAppStore, StatusFeedEntry } from '../store/useAppStore'

/* ── Types ────────────────────────────────────────────────────────────────── */
type FilterTab = 'all' | 'success' | 'failed' | 'skipped' | 'pending'

/* ── Terminal prefix per status ─────────────────────────────────────────── */
const TERM_PREFIX: Record<StatusFeedEntry['status'], { symbol: string; color: string; label: string }> = {
  success: { symbol: '✓', color: '#00e5a0', label: 'OK  ' },
  failed:  { symbol: '✗', color: '#ff4d6d', label: 'ERR ' },
  skipped: { symbol: '—', color: '#4a5568', label: 'SKIP' },
  pending: { symbol: '●', color: '#7c6aff', label: 'WAIT' },
}

/* ── Inline spinner for pending ─────────────────────────────────────────── */
const PendingDot: React.FC = () => {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8, height: 8,
        borderRadius: '50%',
        background: '#7c6aff',
        animation: 'termPulse 1s ease-in-out infinite',
        verticalAlign: 'middle',
        marginRight: 2
      }}
    />
  )
}

/* ── Single log line ─────────────────────────────────────────────────────── */
const LogLine: React.FC<{
  entry: StatusFeedEntry
  index: number
  totalLines: number
}> = React.memo(({ entry, index, totalLines }) => {
  const meta = TERM_PREFIX[entry.status]
  const lineNum = (totalLines - index).toString().padStart(4, ' ')
  const ts = new Date(entry.timestamp)
  const timeStr = `${ts.getHours().toString().padStart(2,'0')}:${ts.getMinutes().toString().padStart(2,'0')}:${ts.getSeconds().toString().padStart(2,'0')}.${ts.getMilliseconds().toString().padStart(3,'0')}`
  const isSystem = entry.pid === 0
  const isPending = entry.status === 'pending'

  return (
    <div
      className="log-line animate-log-in"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0,
        padding: '2px 0',
        borderBottom: '1px solid rgba(255,255,255,0.025)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        lineHeight: '18px',
        minHeight: 22,
        background: index === 0 ? 'rgba(255,255,255,0.022)' : 'transparent',
        borderRadius: index === 0 ? 4 : 0,
        transition: 'background 0.3s',
        animationDelay: `${Math.min(index * 0.008, 0.12)}s`,
      }}
    >
      {/* Line number */}
      <span style={{
        color: '#2d3748',
        userSelect: 'none',
        paddingRight: 10,
        paddingLeft: 8,
        minWidth: 38,
        flexShrink: 0,
        fontSize: 9.5,
        lineHeight: '18px',
        marginTop: 0
      }}>
        {lineNum}
      </span>

      {/* Timestamp */}
      <span style={{
        color: '#3d4f6b',
        paddingRight: 8,
        flexShrink: 0,
        fontSize: 10,
        lineHeight: '18px',
        letterSpacing: '-0.01em'
      }}>
        {timeStr}
      </span>

      {/* Status badge */}
      <span style={{
        color: meta.color,
        paddingRight: 8,
        flexShrink: 0,
        fontWeight: 700,
        fontSize: 9.5,
        lineHeight: '18px',
        letterSpacing: '0.08em',
        opacity: isPending ? 1 : 0.9
      }}>
        {isPending ? <><PendingDot />{meta.label}</> : `[${meta.label}]`}
      </span>

      {/* Process name */}
      <span style={{
        color: isSystem ? '#a0aec0' : meta.color,
        fontWeight: isSystem ? 500 : 600,
        paddingRight: 6,
        flexShrink: 0,
        maxWidth: 140,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: isSystem ? 10.5 : 11,
        lineHeight: '18px',
        fontStyle: isSystem ? 'italic' : 'normal',
      }}>
        {entry.name}
      </span>

      {/* PID badge */}
      {entry.pid !== 0 && (
        <span style={{
          color: '#2d3748',
          fontSize: 9.5,
          lineHeight: '18px',
          paddingRight: 8,
          flexShrink: 0
        }}>
          #{entry.pid}
        </span>
      )}

      {/* Separator */}
      <span style={{ color: '#2d3748', paddingRight: 8, flexShrink: 0, lineHeight: '18px' }}>
        │
      </span>

      {/* Message */}
      <span style={{
        color: index === 0
          ? (entry.status === 'success' ? '#c6f6d5' : entry.status === 'failed' ? '#fed7d7' : '#e2e8f0')
          : '#4a5568',
        flex: 1,
        lineHeight: '18px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: 11,
        transition: 'color 0.3s'
      }}>
        {entry.message}
      </span>
    </div>
  )
})

LogLine.displayName = 'LogLine'

/* ── Filter tab button ───────────────────────────────────────────────────── */
const FilterBtn: React.FC<{
  tab: FilterTab
  active: boolean
  count: number
  color: string
  onClick: () => void
}> = ({ tab, active, count, color, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '3px 9px',
      borderRadius: 5,
      border: `1px solid ${active ? color + '55' : 'transparent'}`,
      background: active ? color + '11' : 'transparent',
      color: active ? color : '#4a5568',
      fontSize: 10,
      fontFamily: 'var(--font-mono)',
      cursor: 'pointer',
      transition: 'all 0.15s',
      letterSpacing: '0.04em',
      fontWeight: active ? 700 : 400,
      outline: 'none',
    }}
  >
    {tab !== 'all' && (
      <span style={{
        width: 5, height: 5,
        borderRadius: '50%',
        background: active ? color : '#4a5568',
        flexShrink: 0,
        transition: 'background 0.15s'
      }} />
    )}
    {tab.toUpperCase()}
    {count > 0 && (
      <span style={{
        color: active ? color : '#2d3748',
        fontSize: 9,
        fontWeight: 700
      }}>
        {count}
      </span>
    )}
  </button>
)

/* ── Progress bar ────────────────────────────────────────────────────────── */
const ProgressBar: React.FC<{ success: number; failed: number; skipped: number; total: number }> = ({
  success, failed, skipped, total
}) => {
  if (total === 0) return null
  const pct = Math.round(((success + failed + skipped) / total) * 100)
  const bar = Math.round((pct / 100) * 32)
  const filled = '█'.repeat(bar)
  const empty = '░'.repeat(32 - bar)

  return (
    <div style={{
      padding: '5px 12px 5px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      flexShrink: 0,
      background: 'rgba(0,0,0,0.2)'
    }}>
      <span style={{ color: '#2d3748', fontSize: 9.5, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
        PROG
      </span>
      <span style={{ color: '#00e5a0', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em' }}>
        {filled}
      </span>
      <span style={{ color: '#1a202c', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em' }}>
        {empty}
      </span>
      <span style={{ color: '#4a5568', fontSize: 10, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
        {pct}%
      </span>
      <span style={{ color: '#2d3748', fontSize: 9.5, fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
        <span style={{ color: '#00e5a0' }}>{success}</span>
        {' ok · '}
        <span style={{ color: '#ff4d6d' }}>{failed}</span>
        {' err · '}
        <span style={{ color: '#4a5568' }}>{skipped}</span>
        {' skip'}
      </span>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────────────────── */
export const StatusFeed: React.FC = () => {
  const { statusFeed, clearStatusFeed, isOptimizing, isRestoring } = useAppStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const isRunning = isOptimizing || isRestoring

  // Auto scroll to bottom (newest entries at bottom in terminal style)
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [statusFeed.length, autoScroll])

  // Detect manual scroll (disable auto-scroll if user scrolled up)
  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    setAutoScroll(scrollTop + clientHeight >= scrollHeight - 20)
  }

  // Single O(n) pass to get all counts — replaces 4 separate .filter() calls
  const stats = useMemo(() => {
    let success = 0, failed = 0, skipped = 0, pending = 0
    for (const e of statusFeed) {
      if (e.status === 'success') success++
      else if (e.status === 'failed') failed++
      else if (e.status === 'skipped') skipped++
      else if (e.status === 'pending') pending++
    }
    return { success, failed, skipped, pending }
  }, [statusFeed])
  const { success: successCount, failed: failedCount, skipped: skippedCount, pending: pendingCount } = stats

  const filteredFeed = useMemo(() =>
    filter === 'all' ? statusFeed : statusFeed.filter(e => e.status === filter)
  , [statusFeed, filter])

  // Display newest at BOTTOM — reverse + cap at 50 entries for render perf
  const displayEntries = useMemo(() => {
    const src = filteredFeed.length > 50 ? filteredFeed.slice(0, 50) : filteredFeed
    return [...src].reverse()
  }, [filteredFeed])

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        padding: 0,
        background: 'rgba(2,4,10,0.95)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* ── Terminal header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.3)',
        flexShrink: 0
      }}>
        {/* Left: title + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Traffic light dots */}
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ff5f57', opacity: 0.7 }} />
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ffbd2e', opacity: 0.7 }} />
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#27c93f', opacity: 0.7 }} />
          </div>

          <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.08)' }} />

          {/* Terminal icon */}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.6 }}>
            <polyline points="4 17 10 11 4 5" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="19" x2="20" y2="19" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>

          <span style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: '#718096',
            letterSpacing: '0.04em',
            fontWeight: 500
          }}>
            truescript::log
          </span>

          {/* Live indicator */}
          {isRunning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 2 }}>
              <div style={{
                width: 6, height: 6,
                borderRadius: '50%',
                background: '#7c6aff',
                animation: 'termPulse 1s ease-in-out infinite'
              }} />
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#7c6aff', letterSpacing: '0.06em' }}>
                LIVE
              </span>
            </div>
          )}
        </div>

        {/* Right: filter tabs + clear */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <FilterBtn tab="all"     active={filter==='all'}     count={statusFeed.length} color="#718096"  onClick={() => setFilter('all')} />
          <FilterBtn tab="success" active={filter==='success'} count={successCount}      color="#00e5a0"  onClick={() => setFilter('success')} />
          <FilterBtn tab="failed"  active={filter==='failed'}  count={failedCount}       color="#ff4d6d"  onClick={() => setFilter('failed')} />
          <FilterBtn tab="skipped" active={filter==='skipped'} count={skippedCount}      color="#4a5568"  onClick={() => setFilter('skipped')} />
          {pendingCount > 0 && (
            <FilterBtn tab="pending" active={filter==='pending'} count={pendingCount}    color="#7c6aff"  onClick={() => setFilter('pending')} />
          )}

          {statusFeed.length > 0 && (
            <>
              <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.08)', margin: '0 4px' }} />
              <button
                onClick={clearStatusFeed}
                style={{
                  padding: '3px 8px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 5,
                  color: '#4a5568',
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                  transition: 'all 0.15s',
                  outline: 'none',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#e53e3e'
                  e.currentTarget.style.borderColor = 'rgba(229,62,62,0.3)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = '#4a5568'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                }}
              >
                CLR
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Column headers ── */}
      {statusFeed.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '3px 0',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(0,0,0,0.15)',
          flexShrink: 0
        }}>
          <span style={{ width: 38, paddingLeft: 8, fontSize: 9, fontFamily: 'var(--font-mono)', color: '#1e2a3a', letterSpacing: '0.04em' }}>LINE</span>
          <span style={{ width: 85, paddingRight: 8, fontSize: 9, fontFamily: 'var(--font-mono)', color: '#1e2a3a', letterSpacing: '0.04em' }}>TIMESTAMP</span>
          <span style={{ width: 54, paddingRight: 8, fontSize: 9, fontFamily: 'var(--font-mono)', color: '#1e2a3a', letterSpacing: '0.04em' }}>STATUS</span>
          <span style={{ width: 148, paddingRight: 6, fontSize: 9, fontFamily: 'var(--font-mono)', color: '#1e2a3a', letterSpacing: '0.04em' }}>PROCESS</span>
          <span style={{ flex: 1, fontSize: 9, fontFamily: 'var(--font-mono)', color: '#1e2a3a', letterSpacing: '0.04em' }}>MESSAGE</span>
        </div>
      )}

      {/* ── Progress bar (during operations) ── */}
      {isRunning && statusFeed.length > 0 && (
        <ProgressBar
          success={successCount}
          failed={failedCount}
          skipped={skippedCount}
          total={Math.max(statusFeed.length, 1)}
        />
      )}

      {/* ── Log lines ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 0',
          minHeight: 0,
          contain: 'strict',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.06) transparent'
        }}
      >
        {displayEntries.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 12,
            color: '#1e2a3a',
            padding: 20
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.15 }}>
              <polyline points="4 17 10 11 4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="19" x2="20" y2="19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
              <div style={{ fontSize: 11, color: '#2d3748', marginBottom: 4 }}>
                {filter !== 'all' ? `no ${filter} entries` : '_ awaiting input'}
              </div>
              <div style={{ fontSize: 10, color: '#1e2a3a' }}>
                {filter !== 'all' ? 'switch filter to see other entries' : 'run optimize to begin logging'}
              </div>
            </div>
          </div>
        ) : (
          displayEntries.map((entry, idx) => (
            <LogLine
              key={entry.id}
              entry={entry}
              index={idx}
              totalLines={displayEntries.length}
            />
          ))
        )}
      </div>

      {/* ── Footer: session summary + auto-scroll indicator ── */}
      {statusFeed.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 12px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(0,0,0,0.25)',
          flexShrink: 0
        }}>
          {/* Left: stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontFamily: 'var(--font-mono)', fontSize: 9.5 }}>
            <span style={{ color: '#2d3748' }}>session:</span>
            <span style={{ color: '#00e5a0', marginLeft: 6 }}>{successCount}</span>
            <span style={{ color: '#2d3748' }}> ok</span>
            <span style={{ color: '#ff4d6d', marginLeft: 6 }}>{failedCount}</span>
            <span style={{ color: '#2d3748' }}> err</span>
            <span style={{ color: '#4a5568', marginLeft: 6 }}>{skippedCount}</span>
            <span style={{ color: '#2d3748' }}> skip</span>
            <span style={{ color: '#2d3748', marginLeft: 8 }}>│</span>
            <span style={{ color: '#2d3748', marginLeft: 8 }}>{statusFeed.length}/50</span>
          </div>

          {/* Right: auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(v => {
              if (!v && scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight
              }
              return !v
            })}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              outline: 'none',
            }}
          >
            <div style={{
              width: 20, height: 10,
              borderRadius: 5,
              background: autoScroll ? 'rgba(0,229,160,0.2)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${autoScroll ? 'rgba(0,229,160,0.4)' : 'rgba(255,255,255,0.1)'}`,
              position: 'relative',
              transition: 'all 0.2s'
            }}>
              <div style={{
                position: 'absolute',
                top: 1,
                left: autoScroll ? 10 : 1,
                width: 7, height: 7,
                borderRadius: '50%',
                background: autoScroll ? '#00e5a0' : '#4a5568',
                transition: 'all 0.2s'
              }} />
            </div>
            <span style={{
              fontSize: 9,
              fontFamily: 'var(--font-mono)',
              color: autoScroll ? '#00e5a0' : '#4a5568',
              letterSpacing: '0.04em',
              transition: 'color 0.2s'
            }}>
              FOLLOW
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
