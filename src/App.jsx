import { useState, useEffect, useCallback } from 'react'
import { loadState, saveState, mergeTasks, toggleTask, archiveTask, unarchiveTask, updateTask } from './storage'

const B = {
  cream: '#f6ecd8',
  white: '#ffffff',
  black: '#0f0f0f',
  gray50: '#fafaf9',
  gray100: '#f0ede8',
  gray200: '#e0dbd2',
  gray300: '#c5bfb4',
  gray400: '#9e9890',
  gray500: '#6e6860',
  gray600: '#4a4540',
  accent: '#d4a843',
  accentLight: '#fdf3dc',
}

const CAT = {
  fire:     { label: 'On fire',  dot: '#dc2626', bg: '#fef2f2', text: '#991b1b' },
  email:    { label: 'Email',    dot: '#d97706', bg: '#fffbeb', text: '#92400e' },
  client:   { label: 'Client',   dot: '#2563eb', bg: '#eff6ff', text: '#1e40af' },
  clickup:  { label: 'ClickUp',  dot: '#7c3aed', bg: '#f5f3ff', text: '#4c1d95' },
  internal: { label: 'Internal', dot: '#059669', bg: '#f0fdf4', text: '#065f46' },
}

const SRC = {
  slack:   { label: 'Slack',   color: '#4A154B' },
  gmail:   { label: 'Gmail',   color: '#c5221f' },
  clickup: { label: 'ClickUp', color: '#7c3aed' },
}

const URGENCY = { high: '#dc2626', medium: '#d97706', low: B.gray200 }
const DEVS = ['Rysiu', 'Dmytro', 'Hans', 'Elias', 'Huy']
const CLIENTS = ['Geomatikk','Nabo','LanoPro','Ekovilla','Verisec','Optifit','Xensam','Odevo','1825','Schibsted','Arvid Nordquist','Pinerock','Gladsheim','Ozzlights','Migränhjälpen','Other']
const CATS = ['fire','email','client','clickup','internal']
const SRCS = ['all','slack','gmail','clickup']

function Pill({ children, active, onClick, color }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 11, fontWeight: active ? 600 : 400, padding: '5px 13px',
      borderRadius: 99, border: `1.5px solid ${active ? (color || B.black) : B.gray200}`,
      background: active ? (color || B.black) : B.white,
      color: active ? B.white : B.gray500,
      cursor: 'pointer', transition: 'all .15s', letterSpacing: '.01em', whiteSpace: 'nowrap',
    }}>{children}</button>
  )
}

function EditPanel({ task, onSave, onClose }) {
  const [title, setTitle] = useState(task.customTitle || task.title)
  const [assignee, setAssignee] = useState(task.assignee || '')
  const [client, setClient] = useState(task.client || '')

  return (
    <div style={{ marginTop: 12, padding: 16, background: B.cream, borderRadius: 10, border: `1px solid ${B.gray200}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: B.gray400, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>Edit task</div>
      <textarea
        value={title}
        onChange={e => setTitle(e.target.value)}
        rows={2}
        style={{ width: '100%', fontSize: 13, padding: '8px 10px', borderRadius: 8, border: `1px solid ${B.gray200}`, background: B.white, resize: 'vertical', outline: 'none', color: B.black, fontFamily: 'inherit', lineHeight: 1.5, marginBottom: 12 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: B.gray400, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Developer</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {['', ...DEVS].map(d => (
              <button key={d} onClick={() => setAssignee(d)} style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6,
                border: `1px solid ${assignee === d ? B.black : B.gray200}`,
                background: assignee === d ? B.black : B.white,
                color: assignee === d ? B.white : B.gray500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{d || 'None'}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: B.gray400, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Client</div>
          <select value={client} onChange={e => setClient(e.target.value)} style={{
            width: '100%', fontSize: 12, padding: '7px 10px', borderRadius: 8,
            border: `1px solid ${B.gray200}`, background: B.white, color: B.black, fontFamily: 'inherit',
          }}>
            <option value="">— none —</option>
            {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onSave({ customTitle: title, assignee, client })} style={{
          fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8,
          border: 'none', background: B.black, color: B.white, cursor: 'pointer', fontFamily: 'inherit',
        }}>Save changes</button>
        <button onClick={onClose} style={{
          fontSize: 12, padding: '7px 14px', borderRadius: 8,
          border: `1px solid ${B.gray200}`, background: B.white, cursor: 'pointer', color: B.gray500, fontFamily: 'inherit',
        }}>Cancel</button>
      </div>
    </div>
  )
}

function TaskRow({ task, onToggle, onArchive, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [hovered, setHovered] = useState(false)
  const title = task.customTitle || task.title
  const cat = CAT[task.category] || CAT.internal

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '13px 16px',
        background: task.checked ? 'transparent' : B.white,
        border: `1px solid ${hovered && !task.checked ? B.gray300 : task.isNew && !task.checked ? '#86efac' : B.gray200}`,
        borderLeft: `3px solid ${task.checked ? B.gray200 : URGENCY[task.urgency]}`,
        borderRadius: 10, marginBottom: 5,
        opacity: task.checked ? 0.3 : 1,
        transition: 'all .15s',
        boxShadow: hovered && !task.checked ? '0 2px 8px rgba(0,0,0,.06)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
        {/* Checkbox */}
        <div onClick={() => onToggle(task.id)} style={{
          width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
          border: `1.5px solid ${task.checked ? B.black : B.gray300}`,
          background: task.checked ? B.black : B.white,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all .15s',
        }}>
          {task.checked && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Source + category badges */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase',
              padding: '2px 7px', borderRadius: 4,
              background: `${(SRC[task.source] || SRC.slack).color}14`,
              color: (SRC[task.source] || SRC.slack).color,
            }}>{(SRC[task.source] || { label: task.source }).label}</span>
            <span style={{
              fontSize: 9.5, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase',
              padding: '2px 7px', borderRadius: 4,
              background: cat.bg, color: cat.text,
            }}>{cat.label}</span>
            {task.isNew && !task.checked && (
              <span style={{ fontSize: 9, fontWeight: 700, background: '#16a34a', color: B.white, padding: '2px 6px', borderRadius: 4, letterSpacing: '.05em' }}>NEW</span>
            )}
          </div>

          {/* Title */}
          <div style={{
            fontSize: 13.5, lineHeight: 1.5, fontWeight: 500,
            color: task.checked ? B.gray400 : B.black,
            textDecoration: task.checked ? 'line-through' : 'none',
            marginBottom: 5,
          }}>
            {title}
            {task.link && <a href={task.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: '#2563eb', marginLeft: 6, fontWeight: 400 }}>↗</a>}
          </div>

          {/* Meta */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {task.who && <span style={{ fontSize: 11.5, color: B.gray600, fontWeight: 500 }}>{task.who}</span>}
            {task.detail && <span style={{ fontSize: 11.5, color: B.gray400, lineHeight: 1.4 }}>{task.detail}</span>}
            {task.when && <span style={{ fontSize: 11, color: B.gray300 }}>· {task.when}</span>}
            {task.assignee && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: '#ede9fe', color: '#5b21b6', border: '1px solid #ddd6fe' }}>{task.assignee}</span>
            )}
            {task.client && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: B.accentLight, color: '#92400e', border: `1px solid ${B.accent}44` }}>{task.client}</span>
            )}
          </div>
        </div>

        {/* Actions - visible on hover */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, opacity: hovered ? 1 : 0, transition: 'opacity .15s' }}>
          <button onClick={() => setEditing(e => !e)} title="Edit" style={{
            fontSize: 12, padding: '4px 9px', borderRadius: 6,
            border: `1px solid ${B.gray200}`, background: editing ? B.gray100 : B.white,
            cursor: 'pointer', color: B.gray500, lineHeight: 1,
          }}>✏</button>
          <button onClick={() => onArchive(task.id)} title="Archive" style={{
            fontSize: 12, padding: '4px 9px', borderRadius: 6,
            border: `1px solid ${B.gray200}`, background: B.white,
            cursor: 'pointer', color: B.gray500, lineHeight: 1,
          }}>↓</button>
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

function Section({ cat, tasks, onToggle, onArchive, onUpdate }) {
  const cfg = CAT[cat]
  const items = tasks.filter(t => t.category === cat && !t.archived)
  if (!items.length) return null
  const done = items.filter(t => t.checked).length
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0 7px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: B.gray500 }}>{cfg.label}</span>
        </div>
        <span style={{ fontSize: 11, color: B.gray300, fontVariantNumeric: 'tabular-nums' }}>{done}/{items.length}</span>
      </div>
      <div style={{ height: 1, background: B.gray200, marginBottom: 8 }} />
      {items.map(t => <TaskRow key={t.id} task={t} onToggle={onToggle} onArchive={onArchive} onUpdate={onUpdate} />)}
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
  const [search, setSearch] = useState('')
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

  const mut = fn => (id, ...args) => setTasks(prev => {
    const next = fn(prev, id, ...args); saveState(next, crawledAt); return next
  })

  const handleToggle = mut(toggleTask)
  const handleArchive = mut(archiveTask)
  const handleUnarchive = mut(unarchiveTask)
  const handleUpdate = useCallback((id, changes) => setTasks(prev => {
    const next = updateTask(prev, id, changes); saveState(next, crawledAt); return next
  }), [crawledAt])

  const clearDone = () => setTasks(prev => { const n = prev.filter(t => !t.checked); saveState(n, crawledAt); return n })

  const q = search.toLowerCase()
  const filtered = tasks.filter(t => {
    if (t.archived) return false
    if (catFilter !== 'all' && t.category !== catFilter) return false
    if (srcFilter !== 'all' && t.source !== srcFilter) return false
    if (devFilter && t.assignee !== devFilter) return false
    if (clientFilter && t.client !== clientFilter) return false
    if (q && !(t.title?.toLowerCase().includes(q) || t.detail?.toLowerCase().includes(q) || t.who?.toLowerCase().includes(q))) return false
    return true
  })

  const archived = tasks.filter(t => t.archived)
  const total = filtered.length
  const done = filtered.filter(t => t.checked).length
  const pct = total ? Math.round((done / total) * 100) : 0
  const hasFilters = catFilter !== 'all' || srcFilter !== 'all' || devFilter || clientFilter || search

  const fmtDate = iso => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div style={{ minHeight: '100vh', background: B.cream, fontFamily: "'Inter', 'Helvetica Neue', sans-serif", color: B.black }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; }
        input, select, button, textarea { font-family: inherit; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%,100% { opacity:.4; } 50% { opacity:1; } }
        select { appearance: none; -webkit-appearance: none; }
        ::placeholder { color: ${B.gray300}; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${B.gray200}; border-radius: 3px; }
        a { text-decoration: none; }
        button { font-family: inherit; }
      `}</style>

      {/* Header */}
      <div style={{
        background: B.white, borderBottom: `1px solid ${B.gray200}`,
        padding: '0 32px', height: 58,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 30,
        boxShadow: '0 1px 12px rgba(0,0,0,.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src="/klingit-logo.png" alt="Klingit" style={{ height: 24, display: 'block' }} />
          <div style={{ width: 1, height: 20, background: B.gray200 }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: B.gray400, letterSpacing: '.01em' }}>Task Manager</span>
          {crawledAt && <span style={{ fontSize: 10.5, color: B.gray300 }}>· {fmtDate(crawledAt)}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {done > 0 && (
            <button onClick={clearDone} style={{ fontSize: 11.5, padding: '6px 14px', borderRadius: 8, border: `1px solid ${B.gray200}`, background: B.white, color: B.gray500, cursor: 'pointer' }}>
              Clear {done} done
            </button>
          )}
          <button onClick={() => setShowArchive(s => !s)} style={{
            fontSize: 11.5, padding: '6px 14px', borderRadius: 8,
            border: `1px solid ${showArchive ? B.gray400 : B.gray200}`,
            background: showArchive ? B.gray100 : B.white,
            color: showArchive ? B.black : B.gray500, cursor: 'pointer',
          }}>
            Archive {archived.length > 0 && `(${archived.length})`}
          </button>
          <button onClick={crawl} disabled={loading} style={{
            fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 8,
            border: 'none', background: loading ? B.gray200 : B.black,
            color: loading ? B.gray400 : B.white, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 7, letterSpacing: '.01em',
            transition: 'background .15s',
          }}>
            {loading
              ? <><svg width="11" height="11" viewBox="0 0 12 12" style={{ animation: 'spin 1s linear infinite' }}><circle cx="6" cy="6" r="4.5" stroke={B.gray400} strokeWidth="1.5" strokeDasharray="14 6" fill="none"/></svg>Crawling…</>
              : <><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="1.6"><path d="M11 6A5 5 0 1 1 6 1"/><polyline points="11,1 11,6 6,6"/></svg>Crawl now</>
            }
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px 60px' }}>

        {/* Stats row */}
        {tasks.filter(t => !t.archived).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 24 }}>
            {CATS.map(cat => {
              const cfg = CAT[cat]
              const count = tasks.filter(t => t.category === cat && !t.archived && !t.checked).length
              const isActive = catFilter === cat
              return (
                <div key={cat} onClick={() => setCatFilter(isActive ? 'all' : cat)} style={{
                  background: isActive ? B.black : B.white,
                  border: `1px solid ${isActive ? B.black : B.gray200}`,
                  borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                  transition: 'all .15s',
                  boxShadow: isActive ? '0 4px 14px rgba(0,0,0,.12)' : '0 1px 4px rgba(0,0,0,.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? B.white : cfg.dot }} />
                    <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: isActive ? B.gray300 : B.gray400 }}>{cfg.label}</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: isActive ? B.white : cfg.dot, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{count}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Progress bar */}
        {total > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{ fontSize: 12, color: B.gray400 }}>{done} of {total} done{hasFilters ? ' (filtered)' : ''}</span>
              <span style={{ fontSize: 12, color: B.gray400, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{pct}%</span>
            </div>
            <div style={{ height: 4, background: B.gray200, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: B.black, borderRadius: 99, transition: 'width .5s ease' }} />
            </div>
          </div>
        )}

        {/* Search + filter bar */}
        <div style={{ background: B.white, border: `1px solid ${B.gray200}`, borderRadius: 14, padding: '14px 16px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: B.gray300 }}>
              <circle cx="6.5" cy="6.5" r="5" stroke={B.gray300} strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke={B.gray300} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks, people, details…"
              style={{
                width: '100%', fontSize: 13, padding: '8px 12px 8px 32px',
                borderRadius: 8, border: `1px solid ${B.gray200}`,
                background: B.gray50, outline: 'none', color: B.black,
                transition: 'border-color .15s',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: B.gray400, fontSize: 14, padding: 2 }}>✕</button>
            )}
          </div>

          {/* Filter row */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Source tabs */}
            <div style={{ display: 'flex', background: B.gray100, borderRadius: 8, padding: 3, gap: 2, marginRight: 4 }}>
              {SRCS.map(s => (
                <button key={s} onClick={() => setSrcFilter(s)} style={{
                  fontSize: 11, fontWeight: srcFilter === s ? 600 : 400,
                  padding: '4px 12px', borderRadius: 6, border: 'none',
                  background: srcFilter === s ? B.white : 'transparent',
                  color: srcFilter === s ? B.black : B.gray500,
                  cursor: 'pointer', transition: 'all .15s', textTransform: 'capitalize',
                  boxShadow: srcFilter === s ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                }}>{s === 'all' ? 'All' : s}</button>
              ))}
            </div>

            {/* Category pills */}
            {CATS.map(cat => (
              <Pill key={cat} active={catFilter === cat} onClick={() => setCatFilter(catFilter === cat ? 'all' : cat)} color={CAT[cat].dot}>
                {CAT[cat].label}
              </Pill>
            ))}

            <div style={{ width: 1, height: 18, background: B.gray200, margin: '0 2px' }} />

            {/* Dev select */}
            <div style={{ position: 'relative' }}>
              <select value={devFilter} onChange={e => setDevFilter(e.target.value)} style={{
                fontSize: 11, padding: '5px 28px 5px 11px', borderRadius: 99,
                border: `1.5px solid ${devFilter ? B.black : B.gray200}`,
                background: devFilter ? B.black : B.white,
                color: devFilter ? B.white : B.gray500, cursor: 'pointer',
              }}>
                <option value="">Developer</option>
                {DEVS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <svg width="10" height="10" viewBox="0 0 10 10" style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><polyline points="2,4 5,7 8,4" fill="none" stroke={devFilter ? B.white : B.gray400} strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>

            {/* Client select */}
            <div style={{ position: 'relative' }}>
              <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} style={{
                fontSize: 11, padding: '5px 28px 5px 11px', borderRadius: 99,
                border: `1.5px solid ${clientFilter ? B.accent : B.gray200}`,
                background: clientFilter ? B.accentLight : B.white,
                color: clientFilter ? '#92400e' : B.gray500, cursor: 'pointer',
              }}>
                <option value="">Client</option>
                {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <svg width="10" height="10" viewBox="0 0 10 10" style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><polyline points="2,4 5,7 8,4" fill="none" stroke={clientFilter ? '#92400e' : B.gray400} strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>

            {hasFilters && (
              <button onClick={() => { setCatFilter('all'); setSrcFilter('all'); setDevFilter(''); setClientFilter(''); setSearch('') }}
                style={{ fontSize: 11, padding: '5px 11px', borderRadius: 99, border: `1px solid ${B.gray200}`, background: B.white, color: B.gray500, cursor: 'pointer' }}>
                ✕ Clear all
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#991b1b' }}>
            Crawl failed: {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && tasks.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '100px 20px' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: B.white, border: `1px solid ${B.gray200}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="4" width="9" height="2" rx="1" fill={B.gray300}/><rect x="3" y="9" width="14" height="2" rx="1" fill={B.gray300}/><rect x="3" y="14" width="6" height="2" rx="1" fill={B.gray300}/></svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: B.gray600, marginBottom: 6 }}>No tasks yet</div>
            <div style={{ fontSize: 13, color: B.gray400 }}>Hit Crawl now to pull from Slack, Gmail & ClickUp</div>
          </div>
        )}

        {/* Loading shimmer */}
        {loading && tasks.length === 0 && (
          <div>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ height: 72, background: B.white, borderRadius: 10, marginBottom: 5, border: `1px solid ${B.gray200}`, animation: 'shimmer 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        )}

        {/* Archive panel */}
        {showArchive && (
          <div style={{ marginBottom: 28, background: B.white, border: `1px solid ${B.gray200}`, borderRadius: 14, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: B.gray400, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              Archived ({archived.length})
            </div>
            {archived.length === 0 && <div style={{ fontSize: 13, color: B.gray400 }}>Nothing archived yet.</div>}
            {archived.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${B.gray100}` }}>
                <div style={{ flex: 1, fontSize: 12.5, color: B.gray400, textDecoration: 'line-through' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: B.gray100, color: B.gray400, marginRight: 7, textTransform: 'uppercase', letterSpacing: '.05em' }}>{t.source}</span>
                  {t.customTitle || t.title}
                </div>
                <button onClick={() => handleUnarchive(t.id)} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: `1px solid ${B.gray200}`, background: B.white, cursor: 'pointer', color: B.gray500, whiteSpace: 'nowrap' }}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}

        {/* No results from search/filter */}
        {tasks.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: B.gray400, fontSize: 13 }}>
            No tasks match your filters.
          </div>
        )}

        {/* Task sections */}
        {CATS.map(cat => (
          <Section key={cat} cat={cat} tasks={filtered} onToggle={handleToggle} onArchive={handleArchive} onUpdate={handleUpdate} />
        ))}

      </div>
    </div>
  )
}
