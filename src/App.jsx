import { useState, useEffect, useCallback } from 'react'
import { loadState, saveState, mergeTasks, toggleTask, archiveTask, unarchiveTask, updateTask } from './storage'

const B = {
  cream: '#f6ecd8',
  creamDark: '#ecdcc0',
  white: '#ffffff',
  black: '#1a1a2e',
  blackTrue: '#0f0f0f',
  sidebar: '#f8f9fa',
  sidebarBorder: '#e9ecef',
  accent: '#f6ecd8',
  accentDark: '#d4a843',
  text: '#2d3748',
  textMuted: '#718096',
  textLight: '#a0aec0',
  border: '#e2e8f0',
  cardBg: '#ffffff',
  pageBg: '#f0f2f5',
  red: '#e53e3e',
  orange: '#dd6b20',
  blue: '#3182ce',
  purple: '#6b46c1',
  green: '#276749',
}

const CAT = {
  fire:     { label: 'On fire',  color: B.red,    bg: '#fff5f5' },
  email:    { label: 'Email',    color: B.orange,  bg: '#fffaf0' },
  client:   { label: 'Client',   color: B.blue,    bg: '#ebf8ff' },
  clickup:  { label: 'ClickUp',  color: B.purple,  bg: '#faf5ff' },
  internal: { label: 'Internal', color: B.green,   bg: '#f0fff4' },
}

const SRC = {
  slack:   { label: 'Slack',   color: '#4A154B' },
  gmail:   { label: 'Gmail',   color: '#c5221f' },
  clickup: { label: 'ClickUp', color: '#6b46c1' },
}

const URGENCY = { high: B.red, medium: B.orange, low: B.border }
const DEVS = ['Rysiu','Dmytro','Hans','Elias','Huy']
const CLIENTS = ['Geomatikk','Nabo','LanoPro','Ekovilla','Verisec','Optifit','Xensam','Odevo','1825','Schibsted','Arvid Nordquist','Pinerock','Gladsheim','Ozzlights','Migränhjälpen','Other']
const CATS = ['fire','email','client','clickup','internal']
const SRCS = ['all','slack','gmail','clickup']

function NavItem({ label, active, onClick, icon }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
      borderRadius: 12, cursor: 'pointer', marginBottom: 4,
      background: active ? B.cream : 'transparent',
      transition: 'all .2s',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? B.blackTrue : B.white,
        boxShadow: active ? '0 4px 14px rgba(0,0,0,.15)' : '0 2px 8px rgba(0,0,0,.08)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, filter: active ? 'invert(1)' : 'none' }}>{icon}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? B.blackTrue : B.textMuted }}>{label}</span>
    </div>
  )
}

function EditPanel({ task, onSave, onClose }) {
  const [title, setTitle] = useState(task.customTitle || task.title)
  const [assignee, setAssignee] = useState(task.assignee || '')
  const [client, setClient] = useState(task.client || '')
  return (
    <div style={{ marginTop: 12, padding: 16, background: '#f7fafc', borderRadius: 12, border: `1px solid ${B.border}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: B.textMuted, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>Edit task</div>
      <textarea value={title} onChange={e => setTitle(e.target.value)} rows={2} style={{
        width: '100%', fontSize: 13.5, padding: '9px 12px', borderRadius: 10,
        border: `1px solid ${B.border}`, background: B.white, resize: 'none',
        outline: 'none', color: B.text, fontFamily: 'inherit', lineHeight: 1.55, marginBottom: 12,
      }}/>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: B.textMuted, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 7 }}>Developer</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {['', ...DEVS].map(d => (
              <button key={d} onClick={() => setAssignee(d)} style={{
                fontSize: 11, fontWeight: 600, padding: '4px 11px', borderRadius: 8,
                border: `1.5px solid ${assignee === d ? B.blackTrue : B.border}`,
                background: assignee === d ? B.blackTrue : B.white,
                color: assignee === d ? B.white : B.textMuted,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{d || 'None'}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: B.textMuted, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 7 }}>Client</div>
          <select value={client} onChange={e => setClient(e.target.value)} style={{
            width: '100%', fontSize: 12, padding: '8px 12px', borderRadius: 10,
            border: `1px solid ${B.border}`, background: B.white, color: B.text, fontFamily: 'inherit',
          }}>
            <option value="">— none —</option>
            {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave({ customTitle: title, assignee, client })} style={{
          fontSize: 12, fontWeight: 700, padding: '8px 20px', borderRadius: 10, border: 'none',
          background: `linear-gradient(135deg, ${B.blackTrue}, #2d3748)`, color: B.white,
          cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(0,0,0,.2)',
        }}>Save changes</button>
        <button onClick={onClose} style={{
          fontSize: 12, padding: '8px 16px', borderRadius: 10,
          border: `1px solid ${B.border}`, background: B.white, cursor: 'pointer', color: B.textMuted, fontFamily: 'inherit',
        }}>Cancel</button>
      </div>
    </div>
  )
}

function TaskRow({ task, onToggle, onArchive, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [hov, setHov] = useState(false)
  const title = task.customTitle || task.title
  const cat = CAT[task.category] || CAT.internal
  const src = SRC[task.source] || { label: task.source, color: B.textMuted }

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      padding: '14px 16px',
      background: task.checked ? '#fafafa' : B.white,
      border: `1px solid ${task.isNew && !task.checked ? '#9ae6b4' : hov && !task.checked ? B.creamDark : B.border}`,
      borderLeft: `4px solid ${task.checked ? B.border : URGENCY[task.urgency]}`,
      borderRadius: 12, marginBottom: 8,
      opacity: task.checked ? 0.4 : 1,
      transition: 'all .15s',
      boxShadow: hov && !task.checked ? '0 4px 20px rgba(0,0,0,.06)' : '0 1px 4px rgba(0,0,0,.03)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div onClick={() => onToggle(task.id)} style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
          border: `2px solid ${task.checked ? B.blackTrue : B.border}`,
          background: task.checked ? B.blackTrue : B.white,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          boxShadow: task.checked ? '0 2px 8px rgba(0,0,0,.15)' : 'none',
          transition: 'all .15s',
        }}>
          {task.checked && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 5, marginBottom: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 6, background: `${src.color}15`, color: src.color }}>{src.label}</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 6, background: cat.bg, color: cat.color }}>{cat.label}</span>
            {task.isNew && !task.checked && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 6, background: '#c6f6d5', color: '#276749' }}>New</span>}
            {task.link && <a href={task.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: B.blue, fontWeight: 600 }}>↗</a>}
          </div>

          <div style={{ fontSize: 14, lineHeight: 1.55, fontWeight: 600, color: task.checked ? B.textLight : B.text, textDecoration: task.checked ? 'line-through' : 'none', marginBottom: 6 }}>
            {title}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {task.who && <span style={{ fontSize: 12, color: B.textMuted, fontWeight: 600 }}>{task.who}</span>}
            {task.detail && <span style={{ fontSize: 12, color: B.textLight, lineHeight: 1.4 }}>{task.detail}</span>}
            {task.when && <span style={{ fontSize: 11, color: B.textLight }}>· {task.when}</span>}
            {task.assignee && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 6, background: '#e9d8fd', color: '#6b46c1' }}>{task.assignee}</span>}
            {task.client && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 6, background: B.cream, color: B.accentDark }}>{task.client}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 5, flexShrink: 0, opacity: hov ? 1 : 0, transition: 'opacity .15s' }}>
          <button onClick={() => setEditing(e => !e)} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: `1px solid ${B.border}`, background: editing ? B.cream : B.white, cursor: 'pointer', color: B.textMuted }}>✏</button>
          <button onClick={() => onArchive(task.id)} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: `1px solid ${B.border}`, background: B.white, cursor: 'pointer', color: B.textMuted }}>↓</button>
        </div>
      </div>

      {editing && <EditPanel task={task} onSave={ch => { onUpdate(task.id, ch); setEditing(false) }} onClose={() => setEditing(false)} />}
    </div>
  )
}

function StatCard({ label, count, color, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: active ? `linear-gradient(135deg, ${B.blackTrue} 0%, #2d3748 100%)` : B.white,
      borderRadius: 20, padding: '20px 24px', cursor: 'pointer',
      boxShadow: active ? '0 8px 24px rgba(0,0,0,.2)' : '0 2px 12px rgba(0,0,0,.06)',
      border: `1px solid ${active ? 'transparent' : B.border}`,
      transition: 'all .2s',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: active ? 'rgba(255,255,255,.6)' : B.textMuted, marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 700, color: active ? B.white : color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{count}</div>
      <div style={{ marginTop: 12, height: 4, borderRadius: 2, background: active ? 'rgba(255,255,255,.15)' : `${color}22` }}>
        <div style={{ height: '100%', width: `${Math.min(count * 10, 100)}%`, borderRadius: 2, background: active ? B.cream : color, transition: 'width .4s' }} />
      </div>
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
        width: sidebarCollapsed ? 70 : 260, flexShrink: 0,
        background: B.white, borderRight: `1px solid ${B.sidebarBorder}`,
        display: 'flex', flexDirection: 'column',
        position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 20,
        transition: 'width .25s ease', overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '28px 20px 20px', borderBottom: `1px solid ${B.sidebarBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/klingit-logo.png" alt="Klingit" style={{ height: 22, flexShrink: 0 }} />
          </div>
        </div>

        {/* Nav */}
        <div style={{ padding: '16px 12px', flex: 1, overflowY: 'auto' }}>
          <NavItem label="Dashboard" active={catFilter === 'all' && !showArchive} icon="📋" onClick={() => { setCatFilter('all'); setShowArchive(false) }} />
          <NavItem label="On fire" active={catFilter === 'fire'} icon="🔴" onClick={() => { setCatFilter(catFilter === 'fire' ? 'all' : 'fire'); setShowArchive(false) }} />
          <NavItem label="Email" active={catFilter === 'email'} icon="📧" onClick={() => { setCatFilter(catFilter === 'email' ? 'all' : 'email'); setShowArchive(false) }} />
          <NavItem label="Client" active={catFilter === 'client'} icon="🤝" onClick={() => { setCatFilter(catFilter === 'client' ? 'all' : 'client'); setShowArchive(false) }} />
          <NavItem label="ClickUp" active={catFilter === 'clickup'} icon="✅" onClick={() => { setCatFilter(catFilter === 'clickup' ? 'all' : 'clickup'); setShowArchive(false) }} />
          <NavItem label="Internal" active={catFilter === 'internal'} icon="⚙️" onClick={() => { setCatFilter(catFilter === 'internal' ? 'all' : 'internal'); setShowArchive(false) }} />

          <div style={{ height: 1, background: B.sidebarBorder, margin: '12px 4px' }} />
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: B.textLight, padding: '4px 16px 8px' }}>Sources</div>
          {SRCS.map(s => (
            <NavItem key={s} label={s === 'all' ? 'All sources' : s.charAt(0).toUpperCase() + s.slice(1)} active={srcFilter === s} icon={s === 'slack' ? '💬' : s === 'gmail' ? '✉️' : s === 'clickup' ? '📌' : '🌐'} onClick={() => setSrcFilter(s)} />
          ))}

          <div style={{ height: 1, background: B.sidebarBorder, margin: '12px 4px' }} />
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: B.textLight, padding: '4px 16px 8px' }}>Account</div>
          <NavItem label="Archive" active={showArchive} icon="📦" onClick={() => setShowArchive(s => !s)} />
        </div>

        {/* Help card */}
        <div style={{ margin: 16, padding: 20, borderRadius: 16, background: `linear-gradient(135deg, ${B.blackTrue} 0%, #2d3748 100%)`, color: B.white }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: B.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 18 }}>?</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Need help?</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginBottom: 14 }}>Hit crawl to refresh your tasks</div>
          <button onClick={crawl} disabled={loading} style={{
            width: '100%', fontSize: 11, fontWeight: 700, padding: '9px', borderRadius: 10,
            border: 'none', background: B.cream, color: B.blackTrue, cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {loading
              ? <><svg width="11" height="11" viewBox="0 0 12 12" style={{ animation: 'spin 1s linear infinite' }}><circle cx="6" cy="6" r="4.5" stroke={B.blackTrue} strokeWidth="1.5" strokeDasharray="14 6" fill="none"/></svg>Crawling…</>
              : 'Crawl now'
            }
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, marginLeft: sidebarCollapsed ? 70 : 260, transition: 'margin-left .25s ease', display: 'flex', flexDirection: 'column' }}>

        {/* Top nav */}
        <div style={{
          background: 'rgba(255,255,255,.8)', backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${B.border}`, padding: '0 32px', height: 66,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div>
            <div style={{ fontSize: 11, color: B.textLight, marginBottom: 2 }}>Pages / Task Manager</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: B.text }}>
              {catFilter === 'all' ? 'All Tasks' : CAT[catFilter]?.label || catFilter}
              {showArchive ? ' / Archive' : ''}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="6.5" cy="6.5" r="5" stroke={B.textLight} strokeWidth="1.5"/>
                <path d="M10.5 10.5L14 14" stroke={B.textLight} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Type here..."
                style={{ fontSize: 13, padding: '8px 14px 8px 34px', borderRadius: 10, border: `1px solid ${B.border}`, background: B.white, outline: 'none', color: B.text, width: 200 }}
              />
              {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: B.textLight, fontSize: 13, padding: 2 }}>✕</button>}
            </div>

            {done > 0 && (
              <button onClick={clearDone} style={{ fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 10, border: `1px solid ${B.border}`, background: B.white, color: B.textMuted }}>
                Clear {done} done
              </button>
            )}

            <button onClick={() => setShowArchive(s => !s)} style={{
              fontSize: 12, fontWeight: 600, padding: '8px 16px', borderRadius: 10,
              border: `1px solid ${showArchive ? B.blackTrue : B.border}`,
              background: showArchive ? B.blackTrue : B.white,
              color: showArchive ? B.white : B.textMuted,
            }}>Archive {archived.length > 0 && `(${archived.length})`}</button>
          </div>
        </div>

        <div style={{ padding: '28px 32px', flex: 1 }}>

          {/* Header banner — like Purity's teal header */}
          <div style={{
            borderRadius: 20, padding: '28px 32px', marginBottom: 28,
            background: `linear-gradient(135deg, ${B.blackTrue} 0%, #2d3748 60%, ${B.black} 100%)`,
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Decorative waves like Purity */}
            <svg style={{ position: 'absolute', right: -20, top: -20, opacity: .08, pointerEvents: 'none' }} width="300" height="180" viewBox="0 0 300 180" fill="none">
              <ellipse cx="200" cy="80" rx="160" ry="90" stroke={B.cream} strokeWidth="30"/>
              <ellipse cx="240" cy="100" rx="110" ry="60" stroke={B.cream} strokeWidth="20"/>
            </svg>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
                <img src="/klingit-logo.png" alt="Klingit" style={{ height: 28, filter: 'invert(1)', opacity: .9 }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: B.white, marginBottom: 4 }}>Task Manager</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)' }}>
                {crawledAt ? `Last updated ${fmtDate(crawledAt)}` : 'Hit Crawl now to load your tasks'}
              </div>
            </div>
          </div>

          {/* Stat cards — Purity style grid */}
          {tasks.filter(t => !t.archived).length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 28 }}>
              {CATS.map(cat => {
                const cfg = CAT[cat]
                const count = tasks.filter(t => t.category === cat && !t.archived && !t.checked).length
                return (
                  <StatCard key={cat} label={cfg.label} count={count} color={cfg.color} active={catFilter === cat}
                    onClick={() => setCatFilter(catFilter === cat ? 'all' : cat)} />
                )
              })}
            </div>
          )}

          {/* Progress bar */}
          {total > 0 && (
            <div style={{ background: B.white, borderRadius: 16, padding: '16px 20px', marginBottom: 20, boxShadow: '0 2px 12px rgba(0,0,0,.05)', border: `1px solid ${B.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: B.text }}>{done} of {total} tasks completed{hasFilters ? ' (filtered)' : ''}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: B.text }}>{pct}%</span>
              </div>
              <div style={{ height: 6, background: B.pageBg, borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${B.blackTrue}, #4a5568)`, borderRadius: 99, transition: 'width .5s ease' }} />
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div style={{ background: B.white, borderRadius: 16, padding: '16px 20px', marginBottom: 24, boxShadow: '0 2px 12px rgba(0,0,0,.05)', border: `1px solid ${B.border}`, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {SRCS.map(s => (
              <button key={s} onClick={() => setSrcFilter(s)} style={{
                fontSize: 11, fontWeight: srcFilter === s ? 700 : 500, padding: '6px 14px', borderRadius: 10,
                border: `1.5px solid ${srcFilter === s ? B.blackTrue : B.border}`,
                background: srcFilter === s ? B.blackTrue : 'transparent',
                color: srcFilter === s ? B.white : B.textMuted, letterSpacing: '.02em',
              }}>{s === 'all' ? 'All sources' : s.charAt(0).toUpperCase() + s.slice(1)}</button>
            ))}

            <div style={{ width: 1, height: 20, background: B.border, margin: '0 4px' }} />

            {CATS.map(cat => {
              const active = catFilter === cat
              return (
                <button key={cat} onClick={() => setCatFilter(active ? 'all' : cat)} style={{
                  fontSize: 11, fontWeight: active ? 700 : 500, padding: '6px 14px', borderRadius: 10,
                  border: `1.5px solid ${active ? CAT[cat].color : B.border}`,
                  background: active ? `${CAT[cat].color}15` : 'transparent',
                  color: active ? CAT[cat].color : B.textMuted,
                }}>{CAT[cat].label}</button>
              )
            })}

            <div style={{ width: 1, height: 20, background: B.border, margin: '0 4px' }} />

            <div style={{ position: 'relative' }}>
              <select value={devFilter} onChange={e => setDevFilter(e.target.value)} style={{
                fontSize: 11, fontWeight: devFilter ? 700 : 500, padding: '6px 26px 6px 13px', borderRadius: 10,
                border: `1.5px solid ${devFilter ? B.blackTrue : B.border}`,
                background: devFilter ? B.blackTrue : 'transparent',
                color: devFilter ? B.white : B.textMuted,
              }}>
                <option value="">Developer</option>
                {DEVS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <svg width="9" height="9" viewBox="0 0 10 10" style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><polyline points="2,3 5,7 8,3" fill="none" stroke={devFilter ? B.white : B.textLight} strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>

            <div style={{ position: 'relative' }}>
              <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} style={{
                fontSize: 11, fontWeight: clientFilter ? 700 : 500, padding: '6px 26px 6px 13px', borderRadius: 10,
                border: `1.5px solid ${clientFilter ? B.blackTrue : B.border}`,
                background: clientFilter ? B.blackTrue : 'transparent',
                color: clientFilter ? B.white : B.textMuted,
              }}>
                <option value="">Client</option>
                {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <svg width="9" height="9" viewBox="0 0 10 10" style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><polyline points="2,3 5,7 8,3" fill="none" stroke={clientFilter ? B.white : B.textLight} strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>

            {hasFilters && (
              <button onClick={() => { setCatFilter('all'); setSrcFilter('all'); setDevFilter(''); setClientFilter(''); setSearch('') }}
                style={{ fontSize: 11, padding: '6px 12px', borderRadius: 10, border: `1px solid ${B.border}`, background: 'transparent', color: B.textLight }}>
                ✕ Clear
              </button>
            )}
          </div>

          {/* Error */}
          {error && <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: B.red }}>Crawl failed: {error}</div>}

          {/* Empty state */}
          {!loading && tasks.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '80px 20px', background: B.white, borderRadius: 20, border: `1px solid ${B.border}` }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: B.text, marginBottom: 8 }}>No tasks yet</div>
              <div style={{ fontSize: 13, color: B.textLight }}>Hit Crawl now to pull from Slack, Gmail & ClickUp</div>
            </div>
          )}

          {/* Loading shimmer */}
          {loading && tasks.length === 0 && (
            <div>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ height: 82, background: B.white, borderRadius: 12, marginBottom: 8, border: `1px solid ${B.border}`, animation: 'shimmer 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          )}

          {/* Archive */}
          {showArchive && (
            <div style={{ marginBottom: 28, background: B.white, borderRadius: 20, border: `1px solid ${B.border}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${B.border}`, fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: B.textMuted }}>
                Archived ({archived.length})
              </div>
              {archived.length === 0
                ? <div style={{ padding: '20px', fontSize: 13, color: B.textLight }}>Nothing archived yet.</div>
                : archived.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: `1px solid ${B.sidebarBorder}` }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: B.pageBg, color: B.textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.source}</span>
                    <div style={{ flex: 1, fontSize: 13, color: B.textLight, textDecoration: 'line-through' }}>{t.customTitle || t.title}</div>
                    <button onClick={() => handleUnarchive(t.id)} style={{ fontSize: 11, fontWeight: 600, padding: '5px 14px', borderRadius: 8, border: `1px solid ${B.border}`, background: B.white, color: B.textMuted }}>Restore</button>
                  </div>
                ))
              }
            </div>
          )}

          {/* No results */}
          {tasks.length > 0 && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', background: B.white, borderRadius: 16, border: `1px solid ${B.border}`, fontSize: 13, color: B.textLight }}>
              No tasks match your filters.
            </div>
          )}

          {/* Task sections */}
          {CATS.map(cat => {
            const cfg = CAT[cat]
            const items = filtered.filter(t => t.category === cat && !t.archived)
            if (!items.length) return null
            const catDone = items.filter(t => t.checked).length
            return (
              <div key={cat} style={{ background: B.white, borderRadius: 20, border: `1px solid ${B.border}`, marginBottom: 20, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.04)' }}>
                <div style={{ padding: '16px 20px', borderBottom: `1px solid ${B.sidebarBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: B.text }}>{cfg.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: `${cfg.color}15`, color: cfg.color }}>{items.length}</span>
                  </div>
                  <span style={{ fontSize: 12, color: B.textLight }}>{catDone}/{items.length} done</span>
                </div>
                <div style={{ padding: '12px 16px' }}>
                  {items.map(t => <TaskRow key={t.id} task={t} onToggle={handleToggle} onArchive={handleArchive} onUpdate={handleUpdate} />)}
                </div>
              </div>
            )
          })}

        </div>
      </div>
    </div>
  )
}
