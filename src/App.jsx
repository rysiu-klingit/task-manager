import { useState, useEffect, useCallback } from 'react'
import { loadState, saveState, mergeTasks, toggleTask, archiveTask, unarchiveTask, updateTask } from './storage'

const BRAND = {
  black: '#0A0A0A',
  white: '#FFFFFF',
  gray50: '#F7F7F7',
  gray100: '#EFEFEF',
  gray200: '#DDDCDC',
  gray400: '#9B9A9A',
  gray600: '#5C5B5B',
}

const CAT_CONFIG = {
  fire:     { label: 'On fire',   color: '#C0392B', dot: '#E74C3C' },
  email:    { label: 'Email',     color: '#B7770D', dot: '#F39C12' },
  client:   { label: 'Client',    color: '#1A5C8A', dot: '#2980B9' },
  clickup:  { label: 'ClickUp',   color: '#4A3780', dot: '#6C5CE7' },
  internal: { label: 'Internal',  color: '#1A6B4A', dot: '#27AE60' },
}

const SRC_CONFIG = {
  slack:   { label: 'Slack',   color: '#4A154B' },
  gmail:   { label: 'Gmail',   color: '#C5221F' },
  clickup: { label: 'ClickUp', color: '#4A3780' },
}

const URGENCY_COLOR = { high: '#E74C3C', medium: '#F39C12', low: BRAND.gray200 }

const DEVELOPERS = ['Rysiu', 'Dmytro', 'Hans', 'Elias', 'Huy']
const CLIENTS = ['Geomatikk', 'Nabo', 'LanoPro', 'Ekovilla', 'Verisec', 'Optifit', 'Xensam', 'Odevo', '1825', 'Schibsted', 'Arvid Nordquist', 'Pinerock', 'Gladsheim', 'Ozzlights', 'Migränhjälpen', 'Other']
const SOURCES = ['all', 'slack', 'gmail', 'clickup']
const CATEGORIES = ['fire', 'email', 'client', 'clickup', 'internal']

function SourcePill({ source }) {
  const cfg = SRC_CONFIG[source] || { label: source, color: BRAND.gray600 }
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 3, marginRight: 7,
      border: `1px solid ${cfg.color}22`, color: cfg.color, background: `${cfg.color}10`,
    }}>{cfg.label}</span>
  )
}

function EditPanel({ task, onSave, onClose }) {
  const [title, setTitle] = useState(task.customTitle || task.title)
  const [assignee, setAssignee] = useState(task.assignee || '')
  const [client, setClient] = useState(task.client || '')

  const sel = (val, active) => ({
    fontSize: 12, padding: '5px 10px', borderRadius: 4, cursor: 'pointer', border: '1px solid',
    borderColor: active ? BRAND.black : BRAND.gray200,
    background: active ? BRAND.black : BRAND.white,
    color: active ? BRAND.white : BRAND.gray600,
    fontWeight: active ? 600 : 400,
    transition: 'all .1s',
  })

  return (
    <div style={{ marginTop: 10, padding: 14, background: BRAND.gray50, borderRadius: 6, border: `1px solid ${BRAND.gray200}` }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: BRAND.gray400, marginBottom: 4, letterSpacing: '.05em', textTransform: 'uppercase' }}>Update task</div>
        <input value={title} onChange={e => setTitle(e.target.value)}
          style={{ width: '100%', fontSize: 13, padding: '7px 10px', borderRadius: 5, border: `1px solid ${BRAND.gray200}`, background: BRAND.white, outline: 'none', color: BRAND.black }}
        />
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: BRAND.gray400, marginBottom: 6, letterSpacing: '.05em', textTransform: 'uppercase' }}>Assign developer</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <button onClick={() => setAssignee('')} style={sel('', !assignee)}>None</button>
          {DEVELOPERS.map(d => <button key={d} onClick={() => setAssignee(d)} style={sel(d, assignee === d)}>{d}</button>)}
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: BRAND.gray400, marginBottom: 6, letterSpacing: '.05em', textTransform: 'uppercase' }}>Client</div>
        <select value={client} onChange={e => setClient(e.target.value)}
          style={{ fontSize: 12, padding: '6px 10px', borderRadius: 5, border: `1px solid ${BRAND.gray200}`, background: BRAND.white, color: BRAND.black, width: '100%' }}>
          <option value="">— none —</option>
          {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onSave({ customTitle: title, assignee, client })}
          style={{ fontSize: 12, fontWeight: 600, padding: '6px 16px', borderRadius: 5, border: 'none', background: BRAND.black, color: BRAND.white, cursor: 'pointer' }}>Save</button>
        <button onClick={onClose}
          style={{ fontSize: 12, padding: '6px 14px', borderRadius: 5, border: `1px solid ${BRAND.gray200}`, background: BRAND.white, cursor: 'pointer', color: BRAND.gray600 }}>Cancel</button>
      </div>
    </div>
  )
}

function TaskRow({ task, onToggle, onArchive, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const displayTitle = task.customTitle || task.title

  return (
    <div style={{
      padding: '11px 14px',
      background: task.checked ? 'transparent' : BRAND.white,
      border: `1px solid ${task.isNew && !task.checked ? '#27AE60' : BRAND.gray100}`,
      borderLeft: `3px solid ${task.checked ? BRAND.gray200 : URGENCY_COLOR[task.urgency]}`,
      borderRadius: 6, marginBottom: 4,
      opacity: task.checked ? 0.32 : 1,
      transition: 'opacity .15s, background .15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Checkbox */}
        <div onClick={() => onToggle(task.id)} style={{
          width: 17, height: 17, borderRadius: 3,
          border: `1.5px solid ${task.checked ? BRAND.black : BRAND.gray200}`,
          background: task.checked ? BRAND.black : BRAND.white,
          flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all .15s',
        }}>
          {task.checked && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.45, color: task.checked ? BRAND.gray400 : BRAND.black, textDecoration: task.checked ? 'line-through' : 'none' }}>
            <SourcePill source={task.source} />
            {displayTitle}
            {task.isNew && !task.checked && (
              <span style={{ fontSize: 9, fontWeight: 700, background: '#27AE60', color: BRAND.white, padding: '1px 5px', borderRadius: 3, marginLeft: 7, verticalAlign: 'middle', letterSpacing: '.04em' }}>NEW</span>
            )}
            {task.link && <a href={task.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: '#2980B9', marginLeft: 6, textDecoration: 'none' }}>↗</a>}
          </div>
          <div style={{ fontSize: 11.5, color: BRAND.gray400, marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', lineHeight: 1.4 }}>
            {task.who && <span style={{ color: BRAND.gray600, fontWeight: 500 }}>{task.who}</span>}
            {task.detail && <span>{task.detail}</span>}
            {task.when && <span style={{ color: BRAND.gray400 }}>· {task.when}</span>}
            {task.assignee && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 20, background: '#EEF2FF', color: '#4A3780', border: '1px solid #D4CCFF' }}>
                {task.assignee}
              </span>
            )}
            {task.client && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 20, background: '#F0FAF4', color: '#1A6B4A', border: '1px solid #C3E6CF' }}>
                {task.client}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0, opacity: 0.5 }} className="task-actions">
          <button onClick={() => setEditing(e => !e)} title="Edit"
            style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, border: `1px solid ${BRAND.gray200}`, background: editing ? BRAND.gray100 : BRAND.white, cursor: 'pointer', color: BRAND.gray600 }}>✏</button>
          <button onClick={() => onArchive(task.id)} title="Archive"
            style={{ fontSize: 12, padding: '3px 8px', borderRadius: 4, border: `1px solid ${BRAND.gray200}`, background: BRAND.white, cursor: 'pointer', color: BRAND.gray600 }}>↓</button>
        </div>
      </div>

      {editing && (
        <EditPanel
          task={task}
          onSave={changes => { onUpdate(task.id, changes); setEditing(false) }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  )
}

function Section({ category, tasks, onToggle, onArchive, onUpdate }) {
  const cfg = CAT_CONFIG[category]
  const visible = tasks.filter(t => t.category === category)
  if (!visible.length) return null
  const done = visible.filter(t => t.checked).length
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0 7px', paddingBottom: 6, borderBottom: `1px solid ${BRAND.gray100}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: BRAND.gray600 }}>{cfg.label}</span>
        </div>
        <span style={{ fontSize: 11, color: BRAND.gray400 }}>{done}/{visible.length}</span>
      </div>
      {visible.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} onArchive={onArchive} onUpdate={onUpdate} />)}
    </div>
  )
}

export default function App() {
  const [tasks, setTasks] = useState([])
  const [crawledAt, setCrawledAt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [catFilter, setCatFilter] = useState('all')
  const [srcFilter, setSrcFilter] = useState('all')
  const [devFilter, setDevFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [showArchive, setShowArchive] = useState(false)

  useEffect(() => {
    const s = loadState()
    if (s.tasks.length) { setTasks(s.tasks); setCrawledAt(s.crawledAt) }
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

  const handle = (fn) => (id, ...args) => setTasks(prev => {
    const next = fn(prev, id, ...args); saveState(next, crawledAt); return next
  })

  const handleToggle = handle(toggleTask)
  const handleArchive = handle(archiveTask)
  const handleUnarchive = handle(unarchiveTask)
  const handleUpdate = useCallback((id, changes) => setTasks(prev => {
    const next = updateTask(prev, id, changes); saveState(next, crawledAt); return next
  }), [crawledAt])

  const clearDone = () => setTasks(prev => { const n = prev.filter(t => !t.checked); saveState(n, crawledAt); return n })

  const filtered = tasks.filter(t => {
    if (t.archived) return false
    if (catFilter !== 'all' && t.category !== catFilter) return false
    if (srcFilter !== 'all' && t.source !== srcFilter) return false
    if (devFilter && t.assignee !== devFilter) return false
    if (clientFilter && t.client !== clientFilter) return false
    return true
  })

  const archived = tasks.filter(t => t.archived)
  const total = filtered.length
  const done = filtered.filter(t => t.checked).length
  const pct = total ? Math.round((done / total) * 100) : 0
  const hasFilters = catFilter !== 'all' || srcFilter !== 'all' || devFilter || clientFilter

  const fmtDate = iso => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null

  const statBar = (label, count, color) => (
    <div style={{ background: BRAND.white, border: `1px solid ${BRAND.gray100}`, borderRadius: 6, padding: '10px 12px', cursor: 'pointer' }} onClick={() => setCatFilter(catFilter === label.toLowerCase() ? 'all' : label.toLowerCase())}>
      <div style={{ fontSize: 19, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{count}</div>
      <div style={{ fontSize: 10, color: BRAND.gray400, marginTop: 2, letterSpacing: '.03em' }}>{label}</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: BRAND.gray50, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", color: BRAND.black }}>
      <style>{`
        * { box-sizing: border-box; }
        input, select, button, textarea { font-family: inherit; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .task-actions { opacity: 0; transition: opacity .15s; }
        div:hover > div > .task-actions { opacity: 1 !important; }
        button:hover { opacity: .85; }
        a { text-decoration: none; }
        select { cursor: pointer; }
        ::-webkit-scrollbar { width: 4px; } 
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${BRAND.gray200}; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ background: BRAND.black, padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="/klingit-logo.png" alt="Klingit" style={{ height: 22, filter: 'invert(1)', display: 'block' }} />
          <div style={{ width: 1, height: 18, background: '#333' }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: '#888', letterSpacing: '.01em' }}>Task Manager</span>
          {crawledAt && <span style={{ fontSize: 10, color: '#555', marginLeft: 4 }}>· {fmtDate(crawledAt)}</span>}
        </div>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          {done > 0 && (
            <button onClick={clearDone} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 4, border: '1px solid #333', background: 'transparent', color: '#888', cursor: 'pointer' }}>
              Clear {done} done
            </button>
          )}
          <button onClick={() => setShowArchive(s => !s)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 4, border: `1px solid ${showArchive ? '#555' : '#333'}`, background: showArchive ? '#222' : 'transparent', color: showArchive ? BRAND.white : '#888', cursor: 'pointer' }}>
            Archive {archived.length > 0 && `(${archived.length})`}
          </button>
          <button onClick={crawl} disabled={loading} style={{
            fontSize: 12, fontWeight: 600, padding: '6px 16px', borderRadius: 4,
            border: 'none', background: loading ? '#333' : BRAND.white,
            color: loading ? '#666' : BRAND.black, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, letterSpacing: '.01em',
          }}>
            {loading
              ? <><svg width="11" height="11" viewBox="0 0 12 12" style={{ animation: 'spin 1s linear infinite' }}><circle cx="6" cy="6" r="4.5" stroke="#666" strokeWidth="1.5" strokeDasharray="14 6" fill="none"/></svg>Crawling…</>
              : <><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke={BRAND.black} strokeWidth="1.6"><path d="M11 6A5 5 0 1 1 6 1"/><polyline points="11,1 11,6 6,6"/></svg>Crawl now</>
            }
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 24px 40px' }}>

        {/* Progress bar */}
        {total > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: BRAND.gray400 }}>{done} of {total} done{hasFilters ? ' (filtered)' : ''}</span>
              <span style={{ fontSize: 12, color: BRAND.gray400, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
            </div>
            <div style={{ height: 3, background: BRAND.gray100, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: BRAND.black, borderRadius: 2, transition: 'width .4s ease' }} />
            </div>
          </div>
        )}

        {/* Stat cards */}
        {tasks.filter(t => !t.archived).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 20 }}>
            {CATEGORIES.map(cat => {
              const cfg = CAT_CONFIG[cat]
              const count = tasks.filter(t => t.category === cat && !t.archived && !t.checked).length
              return (
                <div key={cat} onClick={() => setCatFilter(catFilter === cat ? 'all' : cat)}
                  style={{ background: BRAND.white, border: `1px solid ${catFilter === cat ? BRAND.black : BRAND.gray100}`, borderRadius: 6, padding: '10px 12px', cursor: 'pointer', transition: 'border-color .15s' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: cfg.dot, fontVariantNumeric: 'tabular-nums' }}>{count}</div>
                  <div style={{ fontSize: 10, color: BRAND.gray400, marginTop: 2, letterSpacing: '.03em', textTransform: 'uppercase' }}>{cfg.label}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>

          {/* Source tabs */}
          <div style={{ display: 'flex', background: BRAND.white, border: `1px solid ${BRAND.gray100}`, borderRadius: 6, overflow: 'hidden', marginRight: 4 }}>
            {SOURCES.map(s => (
              <button key={s} onClick={() => setSrcFilter(s)} style={{
                fontSize: 11, fontWeight: srcFilter === s ? 700 : 400,
                padding: '5px 13px', border: 'none', borderRight: `1px solid ${BRAND.gray100}`,
                background: srcFilter === s ? BRAND.black : BRAND.white,
                color: srcFilter === s ? BRAND.white : BRAND.gray600,
                cursor: 'pointer', textTransform: 'capitalize', letterSpacing: '.02em',
                transition: 'all .1s',
              }}>{s === 'all' ? 'All sources' : s}</button>
            ))}
          </div>

          {/* Category pills */}
          {CATEGORIES.map(cat => {
            const cfg = CAT_CONFIG[cat]
            return (
              <button key={cat} onClick={() => setCatFilter(catFilter === cat ? 'all' : cat)} style={{
                fontSize: 11, fontWeight: catFilter === cat ? 700 : 400,
                padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                border: `1px solid ${catFilter === cat ? cfg.dot : BRAND.gray200}`,
                background: catFilter === cat ? cfg.dot : BRAND.white,
                color: catFilter === cat ? BRAND.white : BRAND.gray600,
                transition: 'all .1s',
              }}>{cfg.label}</button>
            )
          })}

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: BRAND.gray200, margin: '0 2px' }} />

          {/* Dev filter */}
          <select value={devFilter} onChange={e => setDevFilter(e.target.value)} style={{
            fontSize: 11, padding: '5px 10px', borderRadius: 20,
            border: `1px solid ${devFilter ? BRAND.black : BRAND.gray200}`,
            background: devFilter ? BRAND.black : BRAND.white,
            color: devFilter ? BRAND.white : BRAND.gray600,
          }}>
            <option value="">Developer</option>
            {DEVELOPERS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          {/* Client filter */}
          <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} style={{
            fontSize: 11, padding: '5px 10px', borderRadius: 20,
            border: `1px solid ${clientFilter ? BRAND.black : BRAND.gray200}`,
            background: clientFilter ? BRAND.black : BRAND.white,
            color: clientFilter ? BRAND.white : BRAND.gray600,
          }}>
            <option value="">Client</option>
            {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {hasFilters && (
            <button onClick={() => { setCatFilter('all'); setSrcFilter('all'); setDevFilter(''); setClientFilter('') }}
              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 20, border: `1px solid ${BRAND.gray200}`, background: BRAND.white, color: BRAND.gray600, cursor: 'pointer' }}>
              ✕ Clear
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '11px 14px', marginBottom: 16, fontSize: 13, color: '#991B1B' }}>
            Crawl failed: {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && tasks.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>—</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: BRAND.gray600, marginBottom: 6 }}>No tasks yet</div>
            <div style={{ fontSize: 13, color: BRAND.gray400 }}>Hit Crawl now to pull from Slack, Gmail & ClickUp</div>
          </div>
        )}

        {/* Loading */}
        {loading && tasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: BRAND.gray400 }}>
            <div style={{ fontSize: 13 }}>Crawling Slack, Gmail & ClickUp…</div>
            <div style={{ marginTop: 16, height: 2, background: BRAND.gray100, borderRadius: 1, overflow: 'hidden', maxWidth: 200, margin: '16px auto 0' }}>
              <div style={{ height: '100%', background: BRAND.black, width: '60%', borderRadius: 1, animation: 'spin 2s ease-in-out infinite alternate' }} />
            </div>
          </div>
        )}

        {/* Archive panel */}
        {showArchive && (
          <div style={{ marginBottom: 28, padding: 16, background: BRAND.white, border: `1px solid ${BRAND.gray100}`, borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.gray400, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 10 }}>
              Archived ({archived.length})
            </div>
            {archived.length === 0 && <div style={{ fontSize: 13, color: BRAND.gray400 }}>Nothing archived yet.</div>}
            {archived.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: `1px solid ${BRAND.gray50}` }}>
                <div style={{ flex: 1, fontSize: 12.5, color: BRAND.gray400, textDecoration: 'line-through' }}>
                  <SourcePill source={t.source} />{t.customTitle || t.title}
                </div>
                <button onClick={() => handleUnarchive(t.id)}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, border: `1px solid ${BRAND.gray200}`, background: BRAND.white, cursor: 'pointer', color: BRAND.gray600 }}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Task sections */}
        {CATEGORIES.map(cat => (
          <Section key={cat} category={cat}
            tasks={filtered.filter(t => !t.archived)}
            onToggle={handleToggle}
            onArchive={handleArchive}
            onUpdate={handleUpdate}
          />
        ))}

      </div>
    </div>
  )
}
