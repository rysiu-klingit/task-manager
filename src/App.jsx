import { useState, useEffect, useCallback } from 'react'
import { loadState, saveState, mergeTasks, toggleTask, archiveTask, unarchiveTask, updateTask } from './storage'

const B = {
  cream: '#f6ecd8',
  creamDark: '#ecdcc0',
  white: '#ffffff',
  black: '#0f0f0f',
  dark: '#1a1a2e',
  pageBg: '#f0f2f5',
  sidebarBg: '#ffffff',
  border: '#e2e8f0',
  sidebarBorder: '#edf2f7',
  text: '#1a202c',
  textMuted: '#718096',
  textLight: '#a0aec0',
}

const PRIORITY = {
  p1: { label: 'P1 Critical', short: 'P1', color: '#e53e3e', bg: '#fff5f5', border: '#fc8181' },
  p2: { label: 'P2 High',     short: 'P2', color: '#dd6b20', bg: '#fffaf0', border: '#f6ad55' },
  p3: { label: 'P3 Medium',   short: 'P3', color: '#2b6cb0', bg: '#ebf8ff', border: '#63b3ed' },
  p4: { label: 'P4 Low',      short: 'P4', color: '#718096', bg: '#f7fafc', border: '#cbd5e0' },
}

const SRC = {
  slack:   { label: 'Slack',   color: '#4A154B', bg: '#4A154B15' },
  gmail:   { label: 'Gmail',   color: '#c5221f', bg: '#c5221f15' },
  clickup: { label: 'ClickUp', color: '#6b46c1', bg: '#6b46c115' },
}

const PRIORITIES = ['p1','p2','p3','p4']
const SRCS = ['all','slack','gmail','clickup']
const DEVS = ['Rysiu','Dmytro','Hans','Elias','Huy']
const CLIENTS = ['Geomatikk','Nabo','LanoPro','Ekovilla','Verisec','Optifit','Xensam','Odevo','1825','Schibsted','Arvid Nordquist','Pinerock','Gladsheim','Ozzlights','Migränhjälpen','Other']

function fmtTs(iso) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (isNaN(d)) return null
    const now = new Date()
    const diff = now - d
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  } catch { return null }
}

function fmtFull(iso) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (isNaN(d)) return null
    return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return null }
}

function NavItem({ label, active, onClick, icon, count }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px',
      borderRadius: 10, cursor: 'pointer', marginBottom: 2,
      background: active ? B.cream : 'transparent',
      transition: 'background .15s',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? B.black : B.white,
        boxShadow: active ? '0 4px 12px rgba(0,0,0,.2)' : '0 2px 6px rgba(0,0,0,.08)',
        flexShrink: 0, fontSize: 13,
        filter: active ? 'none' : 'none',
      }}>
        <span style={{ filter: active ? 'invert(1)' : 'none' }}>{icon}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? B.black : B.textMuted, flex: 1 }}>{label}</span>
      {count > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: active ? B.black : B.pageBg, color: active ? B.cream : B.textMuted }}>{count}</span>}
    </div>
  )
}

function EditPanel({ task, onSave, onClose }) {
  const [title, setTitle] = useState(task.customTitle || task.title)
  const [assignee, setAssignee] = useState(task.assignee || '')
  const [client, setClient] = useState(task.client || '')

  return (
    <div style={{ marginTop: 12, padding: 16, background: '#f7fafc', borderRadius: 10, border: `1px solid ${B.border}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: B.textMuted, marginBottom: 10 }}>Edit task</div>
      <textarea value={title} onChange={e => setTitle(e.target.value)} rows={2} style={{
        width: '100%', fontSize: 13, padding: '9px 12px', borderRadius: 8, border: `1px solid ${B.border}`,
        background: B.white, resize: 'none', outline: 'none', color: B.text, fontFamily: 'inherit', lineHeight: 1.55, marginBottom: 12,
      }}/>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: B.textMuted, marginBottom: 7 }}>Developer</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {['', ...DEVS].map(d => (
              <button key={d} onClick={() => setAssignee(d)} style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 7,
                border: `1.5px solid ${assignee === d ? B.black : B.border}`,
                background: assignee === d ? B.black : B.white,
                color: assignee === d ? B.white : B.textMuted,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{d || 'None'}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: B.textMuted, marginBottom: 7 }}>Client</div>
          <select value={client} onChange={e => setClient(e.target.value)} style={{
            width: '100%', fontSize: 12, padding: '8px 10px', borderRadius: 8, border: `1px solid ${B.border}`,
            background: B.white, color: B.text, fontFamily: 'inherit',
          }}>
            <option value="">— none —</option>
            {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave({ customTitle: title, assignee, client })} style={{
          fontSize: 12, fontWeight: 700, padding: '8px 20px', borderRadius: 8, border: 'none',
          background: B.black, color: B.white, cursor: 'pointer', fontFamily: 'inherit',
        }}>Save</button>
        <button onClick={onClose} style={{
          fontSize: 12, padding: '8px 14px', borderRadius: 8, border: `1px solid ${B.border}`,
          background: B.white, cursor: 'pointer', color: B.textMuted, fontFamily: 'inherit',
        }}>Cancel</button>
      </div>
    </div>
  )
}

function TaskRow({ task, onToggle, onArchive, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [hov, setHov] = useState(false)
  const title = task.customTitle || task.title
  const pri = PRIORITY[task.priority] || PRIORITY.p3
  const src = SRC[task.source] || { label: task.source, color: B.textMuted, bg: B.pageBg }
  const ts = fmtTs(task.receivedAt)
  const tsFull = fmtFull(task.receivedAt)

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '14px 18px',
        background: task.checked ? '#fafafa' : B.white,
        border: `1px solid ${task.isNew && !task.checked ? '#9ae6b4' : hov && !task.checked ? B.creamDark : B.border}`,
        borderLeft: `4px solid ${task.checked ? B.border : pri.color}`,
        borderRadius: 12, marginBottom: 6,
        opacity: task.checked ? 0.35 : 1,
        transition: 'all .15s',
        boxShadow: hov && !task.checked ? '0 4px 16px rgba(0,0,0,.07)' : '0 1px 3px rgba(0,0,0,.03)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Checkbox */}
        <div onClick={() => onToggle(task.id)} style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 2,
          border: `2px solid ${task.checked ? B.black : B.border}`,
          background: task.checked ? B.black : B.white,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          transition: 'all .15s',
        }}>
          {task.checked && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badge row + timestamp */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Priority badge */}
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 6,
              background: pri.bg, color: pri.color, border: `1px solid ${pri.border}`,
            }}>{pri.short}</span>
            {/* Source badge */}
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 6, background: src.bg, color: src.color,
            }}>{src.label}</span>
            {task.isNew && !task.checked && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: '#c6f6d5', color: '#276749' }}>New</span>
            )}
            {/* Timestamp */}
            {ts && (
              <span title={tsFull || ''} style={{ fontSize: 11, color: B.textLight, marginLeft: 2 }}>· {ts}</span>
            )}
            {task.link && (
              <a href={task.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: '#3182ce', marginLeft: 2, fontWeight: 600 }}>↗</a>
            )}
          </div>

          {/* Title */}
          <div style={{
            fontSize: 14, lineHeight: 1.55, fontWeight: 600,
            color: task.checked ? B.textLight : B.text,
            textDecoration: task.checked ? 'line-through' : 'none',
            marginBottom: 6,
          }}>{title}</div>

          {/* Meta row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {task.who && <span style={{ fontSize: 12, color: B.textMuted, fontWeight: 600 }}>{task.who}</span>}
            {task.detail && <span style={{ fontSize: 12, color: B.textLight, lineHeight: 1.4 }}>{task.detail}</span>}
            {task.assignee && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 6, background: '#e9d8fd', color: '#6b46c1' }}>{task.assignee}</span>
            )}
            {task.client && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 6, background: B.cream, color: '#92400e' }}>{task.client}</span>
            )}
          </div>
        </div>

        {/* Hover actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, opacity: hov ? 1 : 0, transition: 'opacity .15s' }}>
          <button onClick={() => setEditing(e => !e)} style={{
            fontSize: 12, padding: '5px 10px', borderRadius: 7,
            border: `1px solid ${B.border}`, background: editing ? B.cream : B.white,
            cursor: 'pointer', color: B.textMuted,
          }}>✏</button>
          <button onClick={() => onArchive(task.id)} style={{
            fontSize: 12, padding: '5px 10px', borderRadius: 7,
            border: `1px solid ${B.border}`, background: B.white,
            cursor: 'pointer', color: B.textMuted,
          }}>↓</button>
        </div>
      </div>

      {editing && (
        <EditPanel task={task} onSave={ch => { onUpdate(task.id, ch); setEditing(false) }} onClose={() => setEditing(false)} />
      )}
    </div>
  )
}

export default function App() {
  const [tasks, setTasks] = useState([])
  const [crawledAt, setCrawledAt] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [priFilter, setPriFilter] = useState('all')
  const [srcFilter, setSrcFilter] = useState('all')
  const [devFilter, setDevFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showArchive, setShowArchive] = useState(false)
  const [sortBy, setSortBy] = useState('priority') // 'priority' | 'date'

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

  const mut = fn => (id, ...args) => setTasks(prev => { const n = fn(prev, id, ...args); saveState(n, crawledAt); return n })
  const handleToggle = mut(toggleTask)
  const handleArchive = mut(archiveTask)
  const handleUnarchive = mut(unarchiveTask)
  const handleUpdate = useCallback((id, ch) => setTasks(prev => { const n = updateTask(prev, id, ch); saveState(n, crawledAt); return n }), [crawledAt])
  const clearDone = () => setTasks(prev => { const n = prev.filter(t => !t.checked); saveState(n, crawledAt); return n })

  const q = search.toLowerCase()
  const baseFiltered = tasks.filter(t => {
    if (t.archived) return false
    if (priFilter !== 'all' && t.priority !== priFilter) return false
    if (srcFilter !== 'all' && t.source !== srcFilter) return false
    if (devFilter && t.assignee !== devFilter) return false
    if (clientFilter && t.client !== clientFilter) return false
    if (q && !(t.title?.toLowerCase().includes(q) || t.detail?.toLowerCase().includes(q) || t.who?.toLowerCase().includes(q))) return false
    return true
  })

  // Sort
  const priOrder = { p1: 0, p2: 1, p3: 2, p4: 3 }
  const filtered = [...baseFiltered].sort((a, b) => {
    if (sortBy === 'date') {
      const da = a.receivedAt ? new Date(a.receivedAt) : new Date(0)
      const db = b.receivedAt ? new Date(b.receivedAt) : new Date(0)
      return db - da
    }
    // priority sort: by priority first, then by date within same priority
    const pa = priOrder[a.priority] ?? 2
    const pb = priOrder[b.priority] ?? 2
    if (pa !== pb) return pa - pb
    const da = a.receivedAt ? new Date(a.receivedAt) : new Date(0)
    const db = b.receivedAt ? new Date(b.receivedAt) : new Date(0)
    return db - da
  })

  const archived = tasks.filter(t => t.archived)
  const total = filtered.length
  const done = filtered.filter(t => t.checked).length
  const pct = total ? Math.round((done / total) * 100) : 0
  const hasFilters = priFilter !== 'all' || srcFilter !== 'all' || devFilter || clientFilter || search
  const fmtCrawled = iso => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null

  // Priority counts for sidebar
  const priCounts = PRIORITIES.reduce((acc, p) => {
    acc[p] = tasks.filter(t => t.priority === p && !t.archived && !t.checked).length
    return acc
  }, {})
  const srcCounts = SRCS.reduce((acc, s) => {
    acc[s] = s === 'all' ? tasks.filter(t => !t.archived && !t.checked).length : tasks.filter(t => t.source === s && !t.archived && !t.checked).length
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: B.pageBg, fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif", color: B.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        *{box-sizing:border-box}
        input,select,button,textarea{font-family:inherit}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%,100%{opacity:.2}50%{opacity:.5}}
        select{appearance:none;-webkit-appearance:none}
        ::placeholder{color:${B.textLight}}
        a{text-decoration:none}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:${B.border};border-radius:2px}
        button{cursor:pointer}
      `}</style>

      {/* ── SIDEBAR ── */}
      <div style={{
        width: 260, flexShrink: 0, background: B.sidebarBg,
        borderRight: `1px solid ${B.sidebarBorder}`,
        position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 20,
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '26px 20px 18px', borderBottom: `1px solid ${B.sidebarBorder}` }}>
          <img src="/klingit-logo.png" alt="Klingit" style={{ height: 22 }} />
        </div>

        <div style={{ padding: '14px 12px', flex: 1 }}>
          {/* Main nav */}
          <NavItem label="All Tasks" active={priFilter === 'all' && srcFilter === 'all' && !showArchive} icon="📋" count={srcCounts.all}
            onClick={() => { setPriFilter('all'); setSrcFilter('all'); setShowArchive(false) }} />

          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: B.textLight, padding: '12px 14px 6px' }}>Priority</div>
          {PRIORITIES.map(p => {
            const cfg = PRIORITY[p]
            return (
              <NavItem key={p} label={cfg.label} active={priFilter === p} icon={p === 'p1' ? '🔴' : p === 'p2' ? '🟠' : p === 'p3' ? '🔵' : '⚪'} count={priCounts[p]}
                onClick={() => { setPriFilter(priFilter === p ? 'all' : p); setShowArchive(false) }} />
            )
          })}

          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: B.textLight, padding: '12px 14px 6px' }}>Source</div>
          {SRCS.map(s => (
            <NavItem key={s} label={s === 'all' ? 'All sources' : s.charAt(0).toUpperCase() + s.slice(1)}
              active={srcFilter === s && priFilter === 'all'}
              icon={s === 'all' ? '🌐' : s === 'slack' ? '💬' : s === 'gmail' ? '✉️' : '📌'}
              count={srcCounts[s]}
              onClick={() => { setSrcFilter(s); setPriFilter('all'); setShowArchive(false) }}
            />
          ))}

          <div style={{ height: 1, background: B.sidebarBorder, margin: '12px 4px' }} />
          <NavItem label="Archive" active={showArchive} icon="📦" count={archived.length} onClick={() => setShowArchive(s => !s)} />
        </div>

        {/* Crawl card */}
        <div style={{ margin: 16, padding: 18, borderRadius: 16, background: `linear-gradient(135deg, ${B.black} 0%, #2d3748 100%)` }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: B.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, fontSize: 16 }}>↺</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: B.white, marginBottom: 3 }}>Crawl sources</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 14 }}>
            {crawledAt ? `Updated ${fmtCrawled(crawledAt)}` : 'Not yet crawled'}
          </div>
          <button onClick={crawl} disabled={loading} style={{
            width: '100%', fontSize: 11, fontWeight: 700, padding: '9px', borderRadius: 10,
            border: 'none', background: B.cream, color: B.black, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {loading
              ? <><svg width="11" height="11" viewBox="0 0 12 12" style={{ animation: 'spin 1s linear infinite' }}><circle cx="6" cy="6" r="4.5" stroke={B.black} strokeWidth="1.5" strokeDasharray="14 6" fill="none"/></svg>Crawling…</>
              : 'Crawl now'
            }
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, marginLeft: 260 }}>

        {/* Top bar */}
        <div style={{
          background: 'rgba(255,255,255,.85)', backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${B.border}`, padding: '0 32px', height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div>
            <div style={{ fontSize: 11, color: B.textLight, marginBottom: 1 }}>Pages / Task Manager</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: B.text }}>
              {priFilter !== 'all' ? PRIORITY[priFilter].label : srcFilter !== 'all' ? SRC[srcFilter].label : 'All Tasks'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="6.5" cy="6.5" r="5" stroke={B.textLight} strokeWidth="1.5"/>
                <path d="M10.5 10.5L14 14" stroke={B.textLight} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                style={{ fontSize: 13, padding: '8px 14px 8px 32px', borderRadius: 10, border: `1px solid ${B.border}`, background: B.white, outline: 'none', color: B.text, width: 180 }}
              />
              {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: B.textLight, fontSize: 13 }}>✕</button>}
            </div>
            {done > 0 && <button onClick={clearDone} style={{ fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 10, border: `1px solid ${B.border}`, background: B.white, color: B.textMuted }}>Clear {done} done</button>}
          </div>
        </div>

        <div style={{ padding: '28px 32px 60px' }}>

          {/* Header banner */}
          <div style={{ borderRadius: 20, padding: '26px 32px', marginBottom: 28, background: `linear-gradient(135deg, ${B.black} 0%, #2d3748 100%)`, position: 'relative', overflow: 'hidden' }}>
            <svg style={{ position: 'absolute', right: -10, top: -10, opacity: .07, pointerEvents: 'none' }} width="280" height="160" viewBox="0 0 280 160" fill="none">
              <ellipse cx="180" cy="70" rx="150" ry="85" stroke={B.cream} strokeWidth="28"/>
              <ellipse cx="220" cy="90" rx="100" ry="55" stroke={B.cream} strokeWidth="18"/>
            </svg>
            <img src="/klingit-logo.png" alt="Klingit" style={{ height: 22, filter: 'invert(1)', opacity: .85, marginBottom: 10 }} />
            <div style={{ fontSize: 22, fontWeight: 800, color: B.white, marginBottom: 4 }}>Task Manager</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)' }}>
              {crawledAt ? `Last crawled ${fmtCrawled(crawledAt)}` : 'Hit Crawl now to load your tasks'}
            </div>
          </div>

          {/* Priority stat cards */}
          {tasks.filter(t => !t.archived).length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
              {PRIORITIES.map(p => {
                const cfg = PRIORITY[p]
                const count = tasks.filter(t => t.priority === p && !t.archived && !t.checked).length
                const active = priFilter === p
                return (
                  <div key={p} onClick={() => setPriFilter(active ? 'all' : p)} style={{
                    background: active ? B.black : B.white,
                    border: `1px solid ${active ? B.black : B.border}`,
                    borderRadius: 18, padding: '20px 22px', cursor: 'pointer',
                    boxShadow: active ? '0 8px 24px rgba(0,0,0,.18)' : '0 2px 8px rgba(0,0,0,.05)',
                    transition: 'all .2s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: active ? B.cream : cfg.color }} />
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: active ? 'rgba(255,255,255,.5)' : B.textMuted }}>{cfg.short}</span>
                    </div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: active ? B.white : cfg.color, fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 6 }}>{count}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: active ? 'rgba(255,255,255,.4)' : B.textMuted }}>{cfg.label.replace(`${cfg.short} `, '')}</div>
                    <div style={{ marginTop: 12, height: 3, borderRadius: 99, background: active ? 'rgba(255,255,255,.1)' : `${cfg.color}20` }}>
                      <div style={{ height: '100%', borderRadius: 99, background: active ? B.cream : cfg.color, width: `${Math.min(count * 8, 100)}%`, transition: 'width .4s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Progress + sort bar */}
          {total > 0 && (
            <div style={{ background: B.white, borderRadius: 14, padding: '14px 18px', marginBottom: 18, border: `1px solid ${B.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: B.text }}>{done} of {total} done{hasFilters ? ' (filtered)' : ''}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: B.text }}>{pct}%</span>
                </div>
                <div style={{ height: 5, background: B.pageBg, borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: B.black, borderRadius: 99, transition: 'width .5s' }} />
                </div>
              </div>
              {/* Sort toggle */}
              <div style={{ display: 'flex', background: B.pageBg, borderRadius: 8, padding: 3, gap: 2, flexShrink: 0 }}>
                {[{ id: 'priority', label: 'Priority' }, { id: 'date', label: 'Date' }].map(s => (
                  <button key={s.id} onClick={() => setSortBy(s.id)} style={{
                    fontSize: 11, fontWeight: sortBy === s.id ? 700 : 500, padding: '5px 12px', borderRadius: 6,
                    border: 'none', background: sortBy === s.id ? B.white : 'transparent',
                    color: sortBy === s.id ? B.text : B.textMuted,
                    boxShadow: sortBy === s.id ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
                    transition: 'all .15s',
                  }}>{s.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div style={{ background: B.white, borderRadius: 14, padding: '14px 16px', marginBottom: 22, border: `1px solid ${B.border}`, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Source tabs */}
            {SRCS.map(s => (
              <button key={s} onClick={() => setSrcFilter(s)} style={{
                fontSize: 11, fontWeight: srcFilter === s ? 700 : 500, padding: '6px 14px', borderRadius: 9,
                border: `1.5px solid ${srcFilter === s ? B.black : B.border}`,
                background: srcFilter === s ? B.black : 'transparent',
                color: srcFilter === s ? B.white : B.textMuted,
              }}>{s === 'all' ? 'All sources' : s.charAt(0).toUpperCase() + s.slice(1)}</button>
            ))}
            <div style={{ width: 1, height: 18, background: B.border, margin: '0 3px' }} />
            {/* Priority pills */}
            {PRIORITIES.map(p => {
              const active = priFilter === p
              const cfg = PRIORITY[p]
              return (
                <button key={p} onClick={() => setPriFilter(active ? 'all' : p)} style={{
                  fontSize: 11, fontWeight: active ? 700 : 500, padding: '6px 12px', borderRadius: 9,
                  border: `1.5px solid ${active ? cfg.color : B.border}`,
                  background: active ? cfg.bg : 'transparent',
                  color: active ? cfg.color : B.textMuted,
                }}>{cfg.short}</button>
              )
            })}
            <div style={{ width: 1, height: 18, background: B.border, margin: '0 3px' }} />
            {/* Dev */}
            <div style={{ position: 'relative' }}>
              <select value={devFilter} onChange={e => setDevFilter(e.target.value)} style={{
                fontSize: 11, fontWeight: devFilter ? 700 : 500, padding: '6px 24px 6px 12px', borderRadius: 9,
                border: `1.5px solid ${devFilter ? B.black : B.border}`,
                background: devFilter ? B.black : 'transparent',
                color: devFilter ? B.white : B.textMuted,
              }}>
                <option value="">Developer</option>
                {DEVS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <svg width="9" height="9" viewBox="0 0 10 10" style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><polyline points="2,3 5,7 8,3" fill="none" stroke={devFilter ? B.white : B.textLight} strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            {/* Client */}
            <div style={{ position: 'relative' }}>
              <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} style={{
                fontSize: 11, fontWeight: clientFilter ? 700 : 500, padding: '6px 24px 6px 12px', borderRadius: 9,
                border: `1.5px solid ${clientFilter ? B.black : B.border}`,
                background: clientFilter ? B.black : 'transparent',
                color: clientFilter ? B.white : B.textMuted,
              }}>
                <option value="">Client</option>
                {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <svg width="9" height="9" viewBox="0 0 10 10" style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><polyline points="2,3 5,7 8,3" fill="none" stroke={clientFilter ? B.white : B.textLight} strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            {hasFilters && (
              <button onClick={() => { setPriFilter('all'); setSrcFilter('all'); setDevFilter(''); setClientFilter(''); setSearch('') }}
                style={{ fontSize: 11, padding: '6px 12px', borderRadius: 9, border: `1px solid ${B.border}`, background: 'transparent', color: B.textLight }}>
                ✕ Clear
              </button>
            )}
          </div>

          {/* Error */}
          {error && <div style={{ background: '#fff5f5', border: '1px solid #fc8181', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#c53030' }}>Crawl failed: {error}</div>}

          {/* Empty state */}
          {!loading && tasks.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '80px 20px', background: B.white, borderRadius: 20, border: `1px solid ${B.border}` }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>📭</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: B.text, marginBottom: 6 }}>No tasks yet</div>
              <div style={{ fontSize: 13, color: B.textLight }}>Hit Crawl now to pull from Slack, Gmail & ClickUp</div>
            </div>
          )}

          {/* Loading shimmer */}
          {loading && tasks.length === 0 && (
            <div>{[1,2,3,4,5].map(i => (
              <div key={i} style={{ height: 84, background: B.white, borderRadius: 12, marginBottom: 6, border: `1px solid ${B.border}`, animation: 'shimmer 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
            ))}</div>
          )}

          {/* Archive */}
          {showArchive && (
            <div style={{ marginBottom: 28, background: B.white, borderRadius: 18, border: `1px solid ${B.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${B.border}`, fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: B.textMuted }}>
                Archived ({archived.length})
              </div>
              {archived.length === 0
                ? <div style={{ padding: '18px 20px', fontSize: 13, color: B.textLight }}>Nothing archived yet.</div>
                : archived.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${B.sidebarBorder}` }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: B.pageBg, color: B.textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.source}</span>
                    <div style={{ flex: 1, fontSize: 13, color: B.textLight, textDecoration: 'line-through' }}>{t.customTitle || t.title}</div>
                    <button onClick={() => handleUnarchive(t.id)} style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 7, border: `1px solid ${B.border}`, background: B.white, color: B.textMuted }}>Restore</button>
                  </div>
                ))
              }
            </div>
          )}

          {/* No results */}
          {tasks.length > 0 && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', background: B.white, borderRadius: 16, border: `1px solid ${B.border}`, fontSize: 13, color: B.textLight }}>No tasks match your filters.</div>
          )}

          {/* Task list — flat, sorted */}
          {sortBy === 'date'
            ? (
              <div>
                {filtered.map(t => (
                  <TaskRow key={t.id} task={t} onToggle={handleToggle} onArchive={handleArchive} onUpdate={handleUpdate} />
                ))}
              </div>
            )
            : (
              PRIORITIES.map(p => {
                const items = filtered.filter(t => t.priority === p)
                if (!items.length) return null
                const cfg = PRIORITY[p]
                const catDone = items.filter(t => t.checked).length
                return (
                  <div key={p} style={{ background: B.white, borderRadius: 18, border: `1px solid ${B.border}`, marginBottom: 20, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
                    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${B.sidebarBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: B.text }}>{cfg.label}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>{items.length}</span>
                      </div>
                      <span style={{ fontSize: 12, color: B.textLight }}>{catDone}/{items.length} done</span>
                    </div>
                    <div style={{ padding: '10px 14px' }}>
                      {items.map(t => <TaskRow key={t.id} task={t} onToggle={handleToggle} onArchive={handleArchive} onUpdate={handleUpdate} />)}
                    </div>
                  </div>
                )
              })
            )
          }

        </div>
      </div>
    </div>
  )
}
