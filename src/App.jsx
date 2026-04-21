import { useState, useEffect, useCallback } from 'react'
import { loadState, saveState, mergeTasks, toggleTask, archiveTask, unarchiveTask, updateTask } from './storage'

const B = {
  cream: '#f6ecd8',
  white: '#ffffff',
  black: '#0f0f0f',
  gray100: '#ede8de',
  gray200: '#d8d1c5',
  gray300: '#b0a99c',
  gray400: '#857e72',
  gray500: '#58534d',
  gray600: '#332f2b',
}

const CAT = {
  fire:     { label: 'On fire',  dot: '#dc2626', textColor: '#991b1b', bgColor: '#fef2f2' },
  email:    { label: 'Email',    dot: '#b45309', textColor: '#78350f', bgColor: '#fffbeb' },
  client:   { label: 'Client',   dot: '#1d4ed8', textColor: '#1e3a8a', bgColor: '#eff6ff' },
  clickup:  { label: 'ClickUp',  dot: '#6d28d9', textColor: '#3b0764', bgColor: '#f5f3ff' },
  internal: { label: 'Internal', dot: '#047857', textColor: '#064e3b', bgColor: '#ecfdf5' },
}

const SRC = {
  slack:   { label: 'Slack',   color: '#4A154B' },
  gmail:   { label: 'Gmail',   color: '#b91c1c' },
  clickup: { label: 'ClickUp', color: '#5b21b6' },
}

const URGENCY = { high: '#dc2626', medium: '#b45309', low: B.gray200 }
const DEVS = ['Rysiu','Dmytro','Hans','Elias','Huy']
const CLIENTS = ['Geomatikk','Nabo','LanoPro','Ekovilla','Verisec','Optifit','Xensam','Odevo','1825','Schibsted','Arvid Nordquist','Pinerock','Gladsheim','Ozzlights','Migränhjälpen','Other']
const CATS = ['fire','email','client','clickup','internal']
const SRCS = ['all','slack','gmail','clickup']

function EditPanel({ task, onSave, onClose }) {
  const [title, setTitle] = useState(task.customTitle || task.title)
  const [assignee, setAssignee] = useState(task.assignee || '')
  const [client, setClient] = useState(task.client || '')

  return (
    <div style={{ marginTop: 14, padding: 20, background: B.cream, border: `1px solid ${B.gray200}` }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: B.gray400, marginBottom: 10 }}>Edit task</div>
      <textarea value={title} onChange={e => setTitle(e.target.value)} rows={2} style={{
        width: '100%', fontSize: 13.5, padding: '10px 12px', border: `1px solid ${B.gray200}`,
        background: B.white, resize: 'none', outline: 'none', color: B.black, fontFamily: 'inherit',
        lineHeight: 1.55, marginBottom: 14,
      }}/>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: B.gray400, marginBottom: 8 }}>Developer</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {['', ...DEVS].map(d => (
              <button key={d} onClick={() => setAssignee(d)} style={{
                fontSize: 11, fontWeight: 600, padding: '5px 11px',
                border: `1.5px solid ${assignee === d ? B.black : B.gray200}`,
                background: assignee === d ? B.black : B.white,
                color: assignee === d ? B.white : B.gray500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{d || 'None'}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: B.gray400, marginBottom: 8 }}>Client</div>
          <div style={{ position: 'relative' }}>
            <select value={client} onChange={e => setClient(e.target.value)} style={{
              width: '100%', fontSize: 12, padding: '8px 30px 8px 11px',
              border: `1px solid ${B.gray200}`, background: B.white, color: B.black,
              fontFamily: 'inherit', appearance: 'none',
            }}>
              <option value="">— none —</option>
              {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <svg width="10" height="10" viewBox="0 0 10 10" style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><polyline points="2,3 5,7 8,3" fill="none" stroke={B.gray400} strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave({ customTitle: title, assignee, client })} style={{
          fontSize: 11, fontWeight: 800, padding: '9px 22px', border: 'none',
          background: B.black, color: B.white, cursor: 'pointer', fontFamily: 'inherit',
          letterSpacing: '.08em', textTransform: 'uppercase',
        }}>Save changes</button>
        <button onClick={onClose} style={{
          fontSize: 11, fontWeight: 600, padding: '9px 16px',
          border: `1.5px solid ${B.gray200}`, background: 'transparent',
          cursor: 'pointer', color: B.gray500, fontFamily: 'inherit',
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
  const src = SRC[task.source] || { label: task.source, color: B.gray400 }

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '14px 18px',
        background: task.checked ? 'transparent' : B.white,
        border: `1px solid ${task.isNew && !task.checked ? '#86efac' : hov && !task.checked ? B.gray300 : B.gray200}`,
        borderLeft: `3px solid ${task.checked ? B.gray200 : URGENCY[task.urgency]}`,
        marginBottom: 4,
        opacity: task.checked ? 0.28 : 1,
        transition: 'border-color .12s, opacity .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Checkbox */}
        <div onClick={() => onToggle(task.id)} style={{
          width: 18, height: 18, flexShrink: 0, marginTop: 2,
          border: `1.5px solid ${task.checked ? B.black : B.gray300}`,
          background: task.checked ? B.black : B.white,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          transition: 'all .12s',
        }}>
          {task.checked && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badge row */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
              padding: '2px 7px', background: `${src.color}12`, color: src.color,
            }}>{src.label}</span>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
              padding: '2px 7px', background: cat.bgColor, color: cat.textColor,
            }}>{cat.label}</span>
            {task.isNew && !task.checked && (
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', background: '#15803d', color: B.white, padding: '2px 7px' }}>New</span>
            )}
            {task.link && <a href={task.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: '#1d4ed8', fontWeight: 700 }}>↗</a>}
          </div>

          {/* Title */}
          <div style={{
            fontSize: 14, lineHeight: 1.55, fontWeight: 500,
            color: task.checked ? B.gray300 : B.black,
            textDecoration: task.checked ? 'line-through' : 'none',
            marginBottom: task.who || task.detail || task.assignee || task.client ? 7 : 0,
          }}>{title}</div>

          {/* Meta */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {task.who && <span style={{ fontSize: 12, color: B.gray500, fontWeight: 600 }}>{task.who}</span>}
            {task.detail && <span style={{ fontSize: 12, color: B.gray400, lineHeight: 1.4 }}>{task.detail}</span>}
            {task.when && <span style={{ fontSize: 11, color: B.gray300 }}>· {task.when}</span>}
            {task.assignee && (
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', padding: '2px 8px', background: '#ede9fe', color: '#5b21b6' }}>{task.assignee}</span>
            )}
            {task.client && (
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', padding: '2px 8px', background: B.gray100, color: B.gray600 }}>{task.client}</span>
            )}
          </div>
        </div>

        {/* Hover actions */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, opacity: hov ? 1 : 0, transition: 'opacity .15s' }}>
          <button onClick={() => setEditing(e => !e)} style={{
            fontSize: 11, padding: '5px 9px', border: `1px solid ${B.gray200}`,
            background: editing ? B.gray100 : B.white, cursor: 'pointer', color: B.gray500,
          }}>✏</button>
          <button onClick={() => onArchive(task.id)} style={{
            fontSize: 11, padding: '5px 9px', border: `1px solid ${B.gray200}`,
            background: B.white, cursor: 'pointer', color: B.gray500,
          }}>↓</button>
        </div>
      </div>

      {editing && (
        <EditPanel
          task={task}
          onSave={ch => { onUpdate(task.id, ch); setEditing(false) }}
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
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0 9px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot }} />
          <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: B.gray500 }}>{cfg.label}</span>
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
    <div style={{ minHeight: '100vh', background: B.cream, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", color: B.black }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        *{box-sizing:border-box}
        input,select,button,textarea{font-family:inherit}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%,100%{opacity:.25}50%{opacity:.6}}
        select{appearance:none;-webkit-appearance:none}
        ::placeholder{color:${B.gray300}}
        a{text-decoration:none}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:${B.gray200}}
        button{cursor:pointer}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{
        background: B.white, borderBottom: `1px solid ${B.gray200}`,
        padding: '0 40px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 30,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <img src="/klingit-logo.png" alt="Klingit" style={{ height: 28, display: 'block' }} />
          <div style={{ width: 1, height: 24, background: B.gray200 }} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: B.black, lineHeight: 1.2 }}>Task Manager</div>
            {crawledAt && <div style={{ fontSize: 10, color: B.gray300, marginTop: 2 }}>Updated {fmtDate(crawledAt)}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {done > 0 && (
            <button onClick={clearDone} style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
              padding: '8px 16px', border: `1.5px solid ${B.gray200}`,
              background: 'transparent', color: B.gray500,
            }}>Clear {done} done</button>
          )}
          <button onClick={() => setShowArchive(s => !s)} style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
            padding: '8px 16px',
            border: `1.5px solid ${showArchive ? B.black : B.gray200}`,
            background: showArchive ? B.black : 'transparent',
            color: showArchive ? B.white : B.gray500,
          }}>Archive {archived.length > 0 && `(${archived.length})`}</button>
          <button onClick={crawl} disabled={loading} style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
            padding: '9px 22px', border: 'none',
            background: loading ? B.gray200 : B.black,
            color: loading ? B.gray400 : B.white,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {loading
              ? <><svg width="11" height="11" viewBox="0 0 12 12" style={{ animation: 'spin 1s linear infinite' }}><circle cx="6" cy="6" r="4.5" stroke={B.gray400} strokeWidth="1.5" strokeDasharray="14 6" fill="none"/></svg>Crawling…</>
              : <><svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="1.8"><path d="M11 6A5 5 0 1 1 6 1"/><polyline points="11,1 11,6 6,6"/></svg>Crawl now</>
            }
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: '0 auto', padding: '36px 32px 80px' }}>

        {/* ── STAT CARDS ── */}
        {tasks.filter(t => !t.archived).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 32 }}>
            {CATS.map(cat => {
              const cfg = CAT[cat]
              const count = tasks.filter(t => t.category === cat && !t.archived && !t.checked).length
              const active = catFilter === cat
              return (
                <div key={cat} onClick={() => setCatFilter(active ? 'all' : cat)} style={{
                  background: active ? B.black : B.white,
                  border: `1.5px solid ${active ? B.black : B.gray200}`,
                  padding: '18px 20px', cursor: 'pointer', transition: 'all .15s',
                }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color: active ? B.white : cfg.dot, fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 8 }}>{count}</div>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.13em', textTransform: 'uppercase', color: active ? B.gray300 : B.gray400 }}>{cfg.label}</div>
                  <div style={{ marginTop: 10, height: 2, background: active ? '#333' : cfg.dot, width: '36%', opacity: active ? .4 : .35 }} />
                </div>
              )
            })}
          </div>
        )}

        {/* ── PROGRESS ── */}
        {total > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: B.gray400 }}>
                {done} of {total} tasks done{hasFilters ? ' (filtered)' : ''}
              </span>
              <span style={{ fontSize: 10, fontWeight: 800, color: B.gray500, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
            </div>
            <div style={{ height: 3, background: B.gray200, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: B.black, transition: 'width .5s ease' }} />
            </div>
          </div>
        )}

        {/* ── FILTER PANEL ── */}
        <div style={{ background: B.white, border: `1px solid ${B.gray200}`, padding: '18px 20px', marginBottom: 28 }}>
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
              <circle cx="6.5" cy="6.5" r="5" stroke={B.gray300} strokeWidth="1.5"/>
              <path d="M10.5 10.5L14 14" stroke={B.gray300} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks, people, clients…"
              style={{
                width: '100%', fontSize: 13.5, padding: '10px 36px',
                border: `1.5px solid ${search ? B.black : B.gray200}`,
                background: B.cream, outline: 'none', color: B.black,
                transition: 'border-color .15s',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', border:'none', background:'none', color:B.gray400, fontSize:14, padding:2 }}>✕</button>
            )}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Source */}
            {SRCS.map(s => (
              <button key={s} onClick={() => setSrcFilter(s)} style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
                padding: '6px 13px',
                border: `1.5px solid ${srcFilter === s ? B.black : B.gray200}`,
                background: srcFilter === s ? B.black : 'transparent',
                color: srcFilter === s ? B.white : B.gray500,
              }}>{s === 'all' ? 'All sources' : s}</button>
            ))}

            <div style={{ width: 1, height: 18, background: B.gray200, margin: '0 4px' }} />

            {/* Category */}
            {CATS.map(cat => {
              const active = catFilter === cat
              return (
                <button key={cat} onClick={() => setCatFilter(active ? 'all' : cat)} style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
                  padding: '6px 13px',
                  border: `1.5px solid ${active ? CAT[cat].dot : B.gray200}`,
                  background: active ? CAT[cat].dot : 'transparent',
                  color: active ? B.white : B.gray500,
                }}>{CAT[cat].label}</button>
              )
            })}

            <div style={{ width: 1, height: 18, background: B.gray200, margin: '0 4px' }} />

            {/* Dev select */}
            <div style={{ position: 'relative' }}>
              <select value={devFilter} onChange={e => setDevFilter(e.target.value)} style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
                padding: '6px 26px 6px 13px',
                border: `1.5px solid ${devFilter ? B.black : B.gray200}`,
                background: devFilter ? B.black : 'transparent',
                color: devFilter ? B.white : B.gray500,
              }}>
                <option value="">Developer</option>
                {DEVS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <svg width="9" height="9" viewBox="0 0 10 10" style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><polyline points="2,3 5,7 8,3" fill="none" stroke={devFilter ? B.white : B.gray400} strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>

            {/* Client select */}
            <div style={{ position: 'relative' }}>
              <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
                padding: '6px 26px 6px 13px',
                border: `1.5px solid ${clientFilter ? B.black : B.gray200}`,
                background: clientFilter ? B.black : 'transparent',
                color: clientFilter ? B.white : B.gray500,
              }}>
                <option value="">Client</option>
                {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <svg width="9" height="9" viewBox="0 0 10 10" style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><polyline points="2,3 5,7 8,3" fill="none" stroke={clientFilter ? B.white : B.gray400} strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>

            {hasFilters && (
              <button onClick={() => { setCatFilter('all'); setSrcFilter('all'); setDevFilter(''); setClientFilter(''); setSearch('') }} style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
                padding: '6px 12px', border: `1.5px solid ${B.gray200}`,
                background: 'transparent', color: B.gray400,
              }}>✕ Clear</button>
            )}
          </div>
        </div>

        {/* ── ERROR ── */}
        {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#991b1b' }}>Crawl failed: {error}</div>}

        {/* ── EMPTY STATE ── */}
        {!loading && tasks.length === 0 && !error && (
          <div style={{ textAlign: 'center', padding: '100px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: B.gray300, marginBottom: 10 }}>No tasks yet</div>
            <div style={{ fontSize: 13, color: B.gray400 }}>Hit Crawl now to pull from Slack, Gmail & ClickUp</div>
          </div>
        )}

        {/* ── LOADING ── */}
        {loading && tasks.length === 0 && (
          <div>
            {[80,72,88,76,80].map((h, i) => (
              <div key={i} style={{ height: h, background: B.white, border: `1px solid ${B.gray200}`, marginBottom: 4, animation: 'shimmer 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        )}

        {/* ── ARCHIVE ── */}
        {showArchive && (
          <div style={{ marginBottom: 36, background: B.white, border: `1px solid ${B.gray200}` }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${B.gray200}`, fontSize: 9, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase', color: B.gray400 }}>
              Archived ({archived.length})
            </div>
            {archived.length === 0
              ? <div style={{ padding: '16px 20px', fontSize: 13, color: B.gray400 }}>Nothing archived yet.</div>
              : archived.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${B.gray100}` }}>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', padding: '2px 7px', background: B.gray100, color: B.gray400 }}>{t.source}</span>
                  <div style={{ flex: 1, fontSize: 13, color: B.gray300, textDecoration: 'line-through' }}>{t.customTitle || t.title}</div>
                  <button onClick={() => handleUnarchive(t.id)} style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase',
                    padding: '6px 14px', border: `1.5px solid ${B.gray200}`,
                    background: 'transparent', color: B.gray500,
                  }}>Restore</button>
                </div>
              ))
            }
          </div>
        )}

        {/* ── NO RESULTS ── */}
        {tasks.length > 0 && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', fontSize: 13, color: B.gray400 }}>No tasks match your filters.</div>
        )}

        {/* ── TASKS ── */}
        {CATS.map(cat => (
          <Section key={cat} cat={cat} tasks={filtered} onToggle={handleToggle} onArchive={handleArchive} onUpdate={handleUpdate} />
        ))}

      </div>
    </div>
  )
}
