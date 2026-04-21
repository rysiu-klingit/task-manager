import { useState, useEffect, useCallback, useRef } from 'react'
import { loadState, saveState, mergeTasks, toggleTask, archiveTask, unarchiveTask, updateTask } from './storage'

const CAT_CONFIG = {
  fire:     { label: '🔴 On fire',  color: '#E24B4A' },
  email:    { label: '📧 Email',    color: '#EF9F27' },
  client:   { label: '🤝 Client',   color: '#378ADD' },
  clickup:  { label: '✅ ClickUp',  color: '#7B68EE' },
  internal: { label: '⚙ Internal', color: '#1D9E75' },
}

const SRC_CONFIG = {
  slack:   { label: 'Slack',   bg: '#4A154B15', color: '#7c3aed' },
  gmail:   { label: 'Gmail',   bg: '#EA433515', color: '#c5221f' },
  clickup: { label: 'ClickUp', bg: '#7B68EE15', color: '#4f46e5' },
}

const URGENCY_COLOR = { high: '#E24B4A', medium: '#EF9F27', low: '#9CA3AF' }

const DEVELOPERS = ['Dmytro', 'Hans', 'Elias', 'Huy', 'Rysiu']
const CLIENTS = ['Geomatikk', 'Nabo', 'LanoPro', 'Ekovilla', 'Verisec', 'Optifit', 'Xensam', 'Odevo', '1825', 'Schibsted', 'Arvid Nordquist', 'Pinerock', 'Gladsheim', 'Ozzlights', 'Migränhjälpen', 'Other']

function SourceBadge({ source }) {
  const cfg = SRC_CONFIG[source] || { label: source, bg: '#eee', color: '#333' }
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: cfg.bg, color: cfg.color, marginRight: 6 }}>{cfg.label}</span>
}

function EditPanel({ task, onSave, onClose }) {
  const [title, setTitle] = useState(task.customTitle || task.title)
  const [assignee, setAssignee] = useState(task.assignee || '')
  const [client, setClient] = useState(task.client || '')

  return (
    <div style={{ marginTop: 10, padding: 12, background: '#F9FAFB', borderRadius: 8, border: '1px solid #E5E7EB' }}>
      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Task description</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{ width: '100%', fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff' }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Assign developer</label>
          <select
            value={assignee}
            onChange={e => setAssignee(e.target.value)}
            style={{ width: '100%', fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff' }}
          >
            <option value="">— none —</option>
            {DEVELOPERS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Client</label>
          <select
            value={client}
            onChange={e => setClient(e.target.value)}
            style={{ width: '100%', fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff' }}
          >
            <option value="">— none —</option>
            {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onSave({ customTitle: title, assignee, client })} style={{ fontSize: 12, fontWeight: 600, padding: '5px 14px', borderRadius: 6, border: 'none', background: '#111827', color: '#fff', cursor: 'pointer' }}>Save</button>
        <button onClick={onClose} style={{ fontSize: 12, padding: '5px 14px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', color: '#6B7280' }}>Cancel</button>
      </div>
    </div>
  )
}

function TaskRow({ task, onToggle, onArchive, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const displayTitle = task.customTitle || task.title

  return (
    <div style={{
      padding: '10px 12px',
      background: task.checked ? 'transparent' : '#fff',
      border: `1px solid ${task.isNew && !task.checked ? '#1D9E75' : '#E5E7EB'}`,
      borderLeft: `3px solid ${task.checked ? '#D1D5DB' : URGENCY_COLOR[task.urgency] || '#D1D5DB'}`,
      borderRadius: 8, marginBottom: 5,
      opacity: task.checked ? 0.35 : 1,
      transition: 'opacity .15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Checkbox */}
        <div
          onClick={() => onToggle(task.id)}
          style={{
            width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${task.checked ? '#1D9E75' : '#D1D5DB'}`,
            background: task.checked ? '#1D9E75' : '#fff', flexShrink: 0, marginTop: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .15s',
          }}
        >
          {task.checked && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, color: task.checked ? '#9CA3AF' : '#111827', lineHeight: 1.4, textDecoration: task.checked ? 'line-through' : 'none' }}>
            <SourceBadge source={task.source} />
            {displayTitle}
            {task.isNew && !task.checked && (
              <span style={{ fontSize: 9, fontWeight: 700, background: '#1D9E75', color: '#fff', padding: '1px 5px', borderRadius: 3, marginLeft: 6, verticalAlign: 'middle' }}>NEW</span>
            )}
            {task.link && <a href={task.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: '#378ADD', marginLeft: 6 }}>↗</a>}
          </div>

          {/* Meta row */}
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {task.who && <span><strong>{task.who}</strong></span>}
            {task.detail && <span>{task.detail}</span>}
            {task.when && <span style={{ color: '#9CA3AF' }}>· {task.when}</span>}
            {task.assignee && (
              <span style={{ background: '#EEF2FF', color: '#4F46E5', fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20 }}>
                👤 {task.assignee}
              </span>
            )}
            {task.client && (
              <span style={{ background: '#F0FDF4', color: '#15803D', fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20 }}>
                🏢 {task.client}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={() => setEditing(e => !e)}
            title="Edit task"
            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid #E5E7EB', background: editing ? '#F3F4F6' : '#fff', cursor: 'pointer', color: '#6B7280' }}
          >✏️</button>
          <button
            onClick={() => onArchive(task.id)}
            title="Archive task"
            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', color: '#6B7280' }}
          >📦</button>
        </div>
      </div>

      {editing && (
        <EditPanel
          task={task}
          onSave={(changes) => { onUpdate(task.id, changes); setEditing(false) }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}

function Section({ category, tasks, onToggle, onArchive, onUpdate }) {
  const cfg = CAT_CONFIG[category]
  const visible = tasks.filter(t => t.category === category && !t.archived)
  if (!visible.length) return null
  const done = visible.filter(t => t.checked).length
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: cfg.color, margin: '18px 0 6px', paddingBottom: 4, borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between' }}>
        <span>{cfg.label}</span>
        <span style={{ color: '#9CA3AF', fontWeight: 400 }}>{done}/{visible.length}</span>
      </div>
      {visible.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} onArchive={onArchive} onUpdate={onUpdate} />)}
    </div>
  )
}

const CATEGORIES = ['fire', 'email', 'client', 'clickup', 'internal']

export default function App() {
  const [tasks, setTasks] = useState([])
  const [crawledAt, setCrawledAt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [devFilter, setDevFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [showArchive, setShowArchive] = useState(false)

  useEffect(() => {
    const state = loadState()
    if (state.tasks.length) { setTasks(state.tasks); setCrawledAt(state.crawledAt) }
  }, [])

  const crawl = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/crawl', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || 'Server error')
      const merged = mergeTasks(tasks, data.tasks)
      setTasks(merged); setCrawledAt(data.crawledAt)
      saveState(merged, data.crawledAt)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [tasks])

  const handleToggle = useCallback((id) => {
    setTasks(prev => { const next = toggleTask(prev, id); saveState(next, crawledAt); return next })
  }, [crawledAt])

  const handleArchive = useCallback((id) => {
    setTasks(prev => { const next = archiveTask(prev, id); saveState(next, crawledAt); return next })
  }, [crawledAt])

  const handleUnarchive = useCallback((id) => {
    setTasks(prev => { const next = unarchiveTask(prev, id); saveState(next, crawledAt); return next })
  }, [crawledAt])

  const handleUpdate = useCallback((id, changes) => {
    setTasks(prev => { const next = updateTask(prev, id, changes); saveState(next, crawledAt); return next })
  }, [crawledAt])

  const clearDone = () => {
    setTasks(prev => { const next = prev.filter(t => !t.checked); saveState(next, crawledAt); return next })
  }

  // Apply filters
  const applyFilters = (list) => list.filter(t => {
    if (t.archived) return false
    if (filter !== 'all' && t.category !== filter) return false
    if (devFilter && t.assignee !== devFilter) return false
    if (clientFilter && t.client !== clientFilter) return false
    return true
  })

  const filtered = applyFilters(tasks)
  const archived = tasks.filter(t => t.archived)
  const total = filtered.length
  const done = filtered.filter(t => t.checked).length
  const pct = total ? Math.round((done / total) * 100) : 0

  const fmtDate = (iso) => {
    if (!iso) return null
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  const hasActiveFilters = devFilter || clientFilter || filter !== 'all'

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`* { box-sizing: border-box; } select, input, button { font-family: inherit; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 28, height: 28, background: '#111827', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="7" height="1.5" rx=".75" fill="#fff"/><rect x="2" y="7" width="10" height="1.5" rx=".75" fill="#fff"/><rect x="2" y="11" width="5" height="1.5" rx=".75" fill="#fff"/><circle cx="13" cy="11.5" r="2" fill="#1D9E75"/></svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>taskmaster</span>
          {crawledAt && <span style={{ fontSize: 11, color: '#9CA3AF' }}>crawled {fmtDate(crawledAt)}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {done > 0 && <button onClick={clearDone} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280', cursor: 'pointer' }}>Clear {done} done</button>}
          <button onClick={() => setShowArchive(s => !s)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid #E5E7EB', background: showArchive ? '#F3F4F6' : '#fff', color: '#6B7280', cursor: 'pointer' }}>
            📦 Archive {archived.length > 0 && `(${archived.length})`}
          </button>
          <button onClick={crawl} disabled={loading} style={{ fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 6, border: 'none', background: loading ? '#D1D5DB' : '#111827', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {loading ? <><svg width="12" height="12" viewBox="0 0 12 12" style={{ animation: 'spin 1s linear infinite' }}><circle cx="6" cy="6" r="4.5" stroke="white" strokeWidth="1.5" strokeDasharray="14 6" fill="none"/></svg>Crawling…</> : <><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="1.5"><path d="M11 6A5 5 0 1 1 6 1"/><polyline points="11,1 11,6 6,6"/></svg>Crawl now</>}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '20px 24px' }}>

        {/* Progress */}
        {total > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#6B7280' }}>{done} of {total} done {hasActiveFilters && '(filtered)'}</span>
              <span style={{ fontSize: 13, color: '#6B7280' }}>{pct}%</span>
            </div>
            <div style={{ height: 4, background: '#E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#1D9E75', borderRadius: 2, transition: 'width .4s ease' }}/>
            </div>
          </div>
        )}

        {/* Stats */}
        {tasks.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
            {CATEGORIES.map(cat => {
              const cfg = CAT_CONFIG[cat]
              const count = tasks.filter(t => t.category === cat && !t.archived && !t.checked).length
              return (
                <div key={cat} onClick={() => setFilter(filter === cat ? 'all' : cat)} style={{ background: '#fff', border: `1px solid ${filter === cat ? cfg.color : '#E5E7EB'}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer' }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color: cfg.color }}>{count}</div>
                  <div style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{cat}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Filters row */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Category pills */}
          {[{ id: 'all', label: 'All' }, ...CATEGORIES.map(c => ({ id: c, label: CAT_CONFIG[c].label }))].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{ fontSize: 12, fontWeight: filter === f.id ? 600 : 400, padding: '4px 12px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${filter === f.id ? '#111827' : '#E5E7EB'}`, background: filter === f.id ? '#111827' : '#fff', color: filter === f.id ? '#fff' : '#6B7280' }}>{f.label}</button>
          ))}

          {/* Separator */}
          <div style={{ width: 1, height: 20, background: '#E5E7EB', margin: '0 4px' }}/>

          {/* Developer filter */}
          <select value={devFilter} onChange={e => setDevFilter(e.target.value)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: `1px solid ${devFilter ? '#4F46E5' : '#E5E7EB'}`, background: devFilter ? '#EEF2FF' : '#fff', color: devFilter ? '#4F46E5' : '#6B7280', cursor: 'pointer' }}>
            <option value="">👤 Developer</option>
            {DEVELOPERS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          {/* Client filter */}
          <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, border: `1px solid ${clientFilter ? '#15803D' : '#E5E7EB'}`, background: clientFilter ? '#F0FDF4' : '#fff', color: clientFilter ? '#15803D' : '#6B7280', cursor: 'pointer' }}>
            <option value="">🏢 Client</option>
            {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button onClick={() => { setFilter('all'); setDevFilter(''); setClientFilter('') }} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer' }}>✕ Clear filters</button>
          )}
        </div>

        {/* Error */}
        {error && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#991B1B' }}>Crawl failed: {error}</div>}

        {/* Empty state */}
        {!loading && tasks.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#6B7280', marginBottom: 6 }}>No tasks yet</div>
            <div style={{ fontSize: 13 }}>Hit "Crawl now" to pull from Slack, Gmail & ClickUp</div>
          </div>
        )}

        {/* Loading */}
        {loading && tasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
            <div style={{ fontSize: 13 }}>Crawling Slack, Gmail & ClickUp… this takes ~30–60s</div>
          </div>
        )}

        {/* Archive view */}
        {showArchive && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6B7280', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #E5E7EB' }}>📦 Archived ({archived.length})</div>
            {archived.length === 0 && <div style={{ fontSize: 13, color: '#9CA3AF', padding: '12px 0' }}>Nothing archived yet</div>}
            {archived.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, marginBottom: 4, opacity: 0.6 }}>
                <div style={{ flex: 1, fontSize: 13, color: '#6B7280', textDecoration: 'line-through' }}><SourceBadge source={t.source} />{t.customTitle || t.title}</div>
                <button onClick={() => handleUnarchive(t.id)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', color: '#6B7280' }}>Restore</button>
              </div>
            ))}
          </div>
        )}

        {/* Task sections */}
        {CATEGORIES.map(cat => (
          <Section
            key={cat}
            category={cat}
            tasks={filtered}
            onToggle={handleToggle}
            onArchive={handleArchive}
            onUpdate={handleUpdate}
          />
        ))}

      </div>
    </div>
  )
}
