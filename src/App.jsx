import { useState, useEffect, useCallback } from 'react'
import { loadState, saveState, mergeTasks, toggleTask } from './storage'

const CAT_CONFIG = {
  fire:     { label: '🔴 On fire',      color: '#E24B4A', light: '#FEF2F2' },
  email:    { label: '📧 Email',        color: '#EF9F27', light: '#FFFBEB' },
  client:   { label: '🤝 Client',       color: '#378ADD', light: '#EFF6FF' },
  clickup:  { label: '✅ ClickUp',      color: '#7B68EE', light: '#F5F3FF' },
  internal: { label: '⚙ Internal',     color: '#1D9E75', light: '#F0FDF9' },
}

const SRC_CONFIG = {
  slack:   { label: 'Slack',   bg: '#4A154B18', color: '#7c3aed' },
  gmail:   { label: 'Gmail',   bg: '#EA433518', color: '#c5221f' },
  clickup: { label: 'ClickUp', bg: '#7B68EE18', color: '#4f46e5' },
}

const URGENCY_DOT = { high: '#E24B4A', medium: '#EF9F27', low: '#9CA3AF' }

function SourceBadge({ source }) {
  const cfg = SRC_CONFIG[source] || { label: source, bg: '#eee', color: '#333' }
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
      background: cfg.bg, color: cfg.color, marginRight: 6, letterSpacing: '.02em',
    }}>{cfg.label}</span>
  )
}

function TaskRow({ task, onToggle }) {
  return (
    <div
      onClick={() => onToggle(task.id)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
        background: task.checked ? 'transparent' : '#fff',
        border: task.isNew && !task.checked ? '1px solid #1D9E75' : '1px solid #E5E7EB',
        borderLeft: `3px solid ${task.checked ? '#D1D5DB' : URGENCY_DOT[task.urgency] || '#D1D5DB'}`,
        borderRadius: 8, marginBottom: 5, cursor: 'pointer',
        opacity: task.checked ? 0.38 : 1,
        transition: 'opacity .15s, background .15s',
      }}
    >
      <div style={{
        width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${task.checked ? '#1D9E75' : '#D1D5DB'}`,
        background: task.checked ? '#1D9E75' : '#fff', flexShrink: 0, marginTop: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
      }}>
        {task.checked && (
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: task.checked ? '#9CA3AF' : '#111827', lineHeight: 1.4, textDecoration: task.checked ? 'line-through' : 'none' }}>
          <SourceBadge source={task.source} />
          {task.title}
          {task.isNew && !task.checked && (
            <span style={{ fontSize: 9, fontWeight: 700, background: '#1D9E75', color: '#fff', padding: '1px 5px', borderRadius: 3, marginLeft: 6, verticalAlign: 'middle' }}>NEW</span>
          )}
          {task.link && (
            <a href={task.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
              style={{ fontSize: 10, color: '#378ADD', marginLeft: 6, textDecoration: 'none' }}>↗</a>
          )}
        </div>
        {task.detail && (
          <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>
            {task.who && <span style={{ fontWeight: 500 }}>{task.who} · </span>}
            {task.detail}
            {task.when && <span style={{ marginLeft: 5, color: '#9CA3AF' }}>· {task.when}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ category, tasks, onToggle }) {
  const cfg = CAT_CONFIG[category]
  const visible = tasks.filter(t => t.category === category)
  if (!visible.length) return null
  const done = visible.filter(t => t.checked).length

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
        color: '#6B7280', margin: '18px 0 6px', paddingBottom: 4,
        borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between',
      }}>
        <span style={{ color: cfg.color }}>{cfg.label}</span>
        <span style={{ color: '#9CA3AF', fontWeight: 400 }}>{done}/{visible.length}</span>
      </div>
      {visible.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} />)}
    </div>
  )
}

const CATEGORIES = ['fire', 'email', 'client', 'clickup', 'internal']
const FILTERS = [{ id: 'all', label: 'All' }, ...CATEGORIES.map(c => ({ id: c, label: CAT_CONFIG[c].label }))]

export default function App() {
  const [tasks, setTasks] = useState([])
  const [crawledAt, setCrawledAt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const state = loadState()
    if (state.tasks.length) {
      setTasks(state.tasks)
      setCrawledAt(state.crawledAt)
    }
  }, [])

  const crawl = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/crawl', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Server error')
      }
      const data = await res.json()
      const merged = mergeTasks(tasks, data.tasks)
      setTasks(merged)
      setCrawledAt(data.crawledAt)
      saveState(merged, data.crawledAt)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [tasks])

  const handleToggle = useCallback((id) => {
    setTasks(prev => {
      const next = toggleTask(prev, id)
      saveState(next, crawledAt)
      return next
    })
  }, [crawledAt])

  const clearDone = () => {
    setTasks(prev => {
      const next = prev.filter(t => !t.checked)
      saveState(next, crawledAt)
      return next
    })
  }

  const visible = filter === 'all' ? tasks : tasks.filter(t => t.category === filter)
  const total = visible.length
  const done = visible.filter(t => t.checked).length
  const pct = total ? Math.round((done / total) * 100) : 0

  const fmtDate = (iso) => {
    if (!iso) return null
    const d = new Date(iso)
    return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, background: '#111827', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="7" height="1.5" rx=".75" fill="#fff"/>
              <rect x="2" y="7" width="10" height="1.5" rx=".75" fill="#fff"/>
              <rect x="2" y="11" width="5" height="1.5" rx=".75" fill="#fff"/>
              <circle cx="13" cy="11.5" r="2" fill="#1D9E75"/>
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#111827', letterSpacing: '-.02em' }}>taskmaster</span>
          {crawledAt && (
            <span style={{ fontSize: 11, color: '#9CA3AF', fontFamily: "'DM Mono', monospace" }}>
              crawled {fmtDate(crawledAt)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {done > 0 && (
            <button onClick={clearDone} style={{
              fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid #E5E7EB',
              background: 'transparent', color: '#6B7280', cursor: 'pointer',
            }}>
              Clear {done} done
            </button>
          )}
          <button onClick={crawl} disabled={loading} style={{
            fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 6,
            border: 'none', background: loading ? '#D1D5DB' : '#111827', color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            transition: 'background .15s',
          }}>
            {loading ? (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="6" cy="6" r="4.5" stroke="white" strokeWidth="1.5" strokeDasharray="14 6" fill="none"/>
                </svg>
                Crawling…
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="1.5">
                  <path d="M11 6A5 5 0 1 1 6 1"/><polyline points="11,1 11,6 6,6"/>
                </svg>
                Crawl now
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '20px 24px' }}>

        {/* Progress */}
        {total > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#6B7280' }}>{done} of {total} done</span>
              <span style={{ fontSize: 13, color: '#6B7280', fontFamily: "'DM Mono', monospace" }}>{pct}%</span>
            </div>
            <div style={{ height: 4, background: '#E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#1D9E75', borderRadius: 2, transition: 'width .4s ease' }}/>
            </div>
          </div>
        )}

        {/* Stats row */}
        {tasks.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
            {CATEGORIES.map(cat => {
              const cfg = CAT_CONFIG[cat]
              const count = tasks.filter(t => t.category === cat && !t.checked).length
              return (
                <div key={cat} onClick={() => setFilter(filter === cat ? 'all' : cat)} style={{
                  background: '#fff', border: `1px solid ${filter === cat ? cfg.color : '#E5E7EB'}`,
                  borderRadius: 8, padding: '10px 12px', cursor: 'pointer', transition: 'border-color .15s',
                }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color: cfg.color, fontFamily: "'DM Mono', monospace" }}>{count}</div>
                  <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cat}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              fontSize: 12, fontWeight: filter === f.id ? 600 : 400,
              padding: '4px 12px', borderRadius: 20, cursor: 'pointer', transition: 'all .15s',
              border: `1px solid ${filter === f.id ? '#111827' : '#E5E7EB'}`,
              background: filter === f.id ? '#111827' : '#fff',
              color: filter === f.id ? '#fff' : '#6B7280',
            }}>{f.label}</button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#991B1B' }}>
            Crawl failed: {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && tasks.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#6B7280', marginBottom: 6 }}>No tasks yet</div>
            <div style={{ fontSize: 13 }}>Hit "Crawl now" to pull everything from Slack, Gmail & ClickUp</div>
          </div>
        )}

        {/* Loading state */}
        {loading && tasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
            <div style={{ fontSize: 13 }}>Crawling Slack, Gmail & ClickUp… this takes ~30–60s</div>
            <div style={{ marginTop: 16, height: 3, background: '#E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#1D9E75', borderRadius: 2, animation: 'progress 2s ease-in-out infinite alternate', width: '60%' }}/>
            </div>
          </div>
        )}

        {/* Task sections */}
        {filter === 'all'
          ? CATEGORIES.map(cat => (
              <Section key={cat} category={cat} tasks={tasks} onToggle={handleToggle} />
            ))
          : visible.map(t => <TaskRow key={t.id} task={t} onToggle={handleToggle} />)
        }

      </div>
    </div>
  )
}
