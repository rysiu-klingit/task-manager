import { useState, useEffect, useCallback, useRef } from 'react'
import { loadState, saveState, mergeTasks, setStatus, archiveTask, unarchiveTask, updateTask, loadProfile, saveProfile } from './storage'

const B = {
  cream: '#f6ecd8', creamDark: '#ecdcc0', white: '#ffffff', black: '#0f0f0f',
  pageBg: '#f0f2f5', border: '#e2e8f0', sidebarBorder: '#edf2f7',
  text: '#1a202c', textMuted: '#718096', textLight: '#a0aec0',
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
const STATUS_CFG = {
  open:      { label: 'Open',      color: B.textMuted,  bg: B.pageBg },
  responded: { label: 'Responded', color: '#2b6cb0',    bg: '#ebf8ff' },
  done:      { label: 'Done',      color: '#276749',    bg: '#f0fff4' },
}
const PRIORITIES = ['p1','p2','p3','p4']
const SRCS = ['all','slack','gmail','clickup']
const DEVS = ['Rysiu','Dmytro','Hans','Elias','Huy']
const CLIENTS = ['Geomatikk','Nabo','LanoPro','Ekovilla','Verisec','Optifit','Xensam','Odevo','1825','Schibsted','Arvid Nordquist','Pinerock','Gladsheim','Ozzlights','Migränhjälpen','Other']

function fmtTs(iso) {
  if (!iso) return null
  try {
    const d = new Date(iso); if (isNaN(d)) return null
    const diff = Date.now() - d
    const mins = Math.floor(diff/60000), hours = Math.floor(diff/3600000), days = Math.floor(diff/86400000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('en-GB', { day:'numeric', month:'short' })
  } catch { return null }
}
function fmtFull(iso) {
  try { const d = new Date(iso); if (isNaN(d)) return null; return d.toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) }
  catch { return null }
}

function Avatar({ avatar, name, size = 36, onClick }) {
  return (
    <div onClick={onClick} style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: avatar ? 'transparent' : B.cream,
      border: `2px solid ${B.creamDark}`,
      overflow: 'hidden', cursor: onClick ? 'pointer' : 'default',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, color: B.black,
    }}>
      {avatar
        ? <img src={avatar} alt={name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        : (name || 'R').charAt(0).toUpperCase()
      }
    </div>
  )
}

function StatusPill({ status, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const cfg = STATUS_CFG[status] || STATUS_CFG.open
  const next = { open: ['responded','done'], responded: ['done','open'], done: ['open','responded'] }

  return (
    <div ref={ref} style={{ position:'relative', flexShrink:0 }}>
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o) }} style={{
        fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99,
        border: `1px solid ${cfg.color}40`, background: cfg.bg, color: cfg.color,
        cursor: 'pointer', letterSpacing: '.04em', textTransform: 'uppercase',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {cfg.label}
        <svg width="8" height="8" viewBox="0 0 10 10"><polyline points="2,3 5,7 8,3" fill="none" stroke={cfg.color} strokeWidth="1.5" strokeLinecap="round"/></svg>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', right:0, background:B.white, border:`1px solid ${B.border}`, borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.12)', zIndex:50, minWidth:130, overflow:'hidden' }}>
          {next[status||'open'].map(s => {
            const c = STATUS_CFG[s]
            return (
              <div key={s} onClick={e => { e.stopPropagation(); onChange(s); setOpen(false) }} style={{
                padding: '9px 14px', fontSize: 12, fontWeight: 600, color: c.color,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                background: B.white, transition: 'background .1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = c.bg}
              onMouseLeave={e => e.currentTarget.style.background = B.white}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:c.color }} />
                Mark as {c.label}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EditPanel({ task, onSave, onClose }) {
  const [title, setTitle] = useState(task.customTitle || task.title)
  const [assignee, setAssignee] = useState(task.assignee || '')
  const [client, setClient] = useState(task.client || '')
  return (
    <div style={{ marginTop:12, padding:16, background:'#f7fafc', borderRadius:10, border:`1px solid ${B.border}` }}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:B.textMuted, marginBottom:10 }}>Edit task</div>
      <textarea value={title} onChange={e => setTitle(e.target.value)} rows={2} style={{ width:'100%', fontSize:13, padding:'9px 12px', borderRadius:8, border:`1px solid ${B.border}`, background:B.white, resize:'none', outline:'none', color:B.text, fontFamily:'inherit', lineHeight:1.55, marginBottom:12 }}/>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:B.textMuted, marginBottom:7 }}>Developer</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
            {['', ...DEVS].map(d => (
              <button key={d} onClick={() => setAssignee(d)} style={{ fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:7, border:`1.5px solid ${assignee===d ? B.black : B.border}`, background:assignee===d ? B.black : B.white, color:assignee===d ? B.white : B.textMuted, cursor:'pointer', fontFamily:'inherit' }}>{d||'None'}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:B.textMuted, marginBottom:7 }}>Client</div>
          <select value={client} onChange={e => setClient(e.target.value)} style={{ width:'100%', fontSize:12, padding:'8px 10px', borderRadius:8, border:`1px solid ${B.border}`, background:B.white, color:B.text, fontFamily:'inherit' }}>
            <option value="">— none —</option>
            {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={() => onSave({ customTitle:title, assignee, client })} style={{ fontSize:12, fontWeight:700, padding:'8px 20px', borderRadius:8, border:'none', background:B.black, color:B.white, cursor:'pointer', fontFamily:'inherit' }}>Save</button>
        <button onClick={onClose} style={{ fontSize:12, padding:'8px 14px', borderRadius:8, border:`1px solid ${B.border}`, background:B.white, cursor:'pointer', color:B.textMuted, fontFamily:'inherit' }}>Cancel</button>
      </div>
    </div>
  )
}

function TaskRow({ task, onSetStatus, onArchive, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [hov, setHov] = useState(false)
  const title = task.customTitle || task.title
  const pri = PRIORITY[task.priority] || PRIORITY.p3
  const src = SRC[task.source] || { label: task.source, color: B.textMuted, bg: B.pageBg }
  const ts = fmtTs(task.receivedAt)
  const tsFull = fmtFull(task.receivedAt)
  const isDone = task.status === 'done'

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      padding:'14px 16px',
      background: isDone ? '#fafafa' : B.white,
      border:`1px solid ${task.isNew && !isDone ? '#9ae6b4' : hov && !isDone ? B.creamDark : B.border}`,
      borderLeft:`4px solid ${isDone ? B.border : pri.color}`,
      borderRadius:12, marginBottom:6,
      opacity: isDone ? 0.38 : 1,
      transition:'all .15s',
      boxShadow: hov && !isDone ? '0 4px 16px rgba(0,0,0,.07)' : '0 1px 3px rgba(0,0,0,.03)',
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        {/* Checkbox — cycles open→responded→done */}
        <div onClick={() => onSetStatus(task.id, isDone ? 'open' : task.status === 'responded' ? 'done' : 'responded')} style={{
          width:20, height:20, borderRadius:6, flexShrink:0, marginTop:2,
          border:`2px solid ${isDone ? '#276749' : task.status==='responded' ? '#2b6cb0' : B.border}`,
          background: isDone ? '#276749' : task.status==='responded' ? '#ebf8ff' : B.white,
          display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all .15s',
        }}>
          {isDone && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          {task.status==='responded' && <div style={{ width:6, height:6, borderRadius:'50%', background:'#2b6cb0' }} />}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          {/* Badges + timestamp */}
          <div style={{ display:'flex', gap:5, marginBottom:6, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:'.06em', textTransform:'uppercase', padding:'2px 7px', borderRadius:6, background:pri.bg, color:pri.color, border:`1px solid ${pri.border}` }}>{pri.short}</span>
            <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', padding:'2px 7px', borderRadius:6, background:src.bg, color:src.color }}>{src.label}</span>
            {task.isNew && !isDone && <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6, background:'#c6f6d5', color:'#276749' }}>New</span>}
            {ts && <span title={tsFull||''} style={{ fontSize:11, color:B.textLight }}>· {ts}</span>}
          </div>
          {task.client && <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:B.textLight, marginBottom:4 }}>{task.client}</div>}
          <div style={{ fontSize:14, lineHeight:1.55, fontWeight:600, color: isDone ? B.textLight : B.text, textDecoration: isDone ? 'line-through' : 'none', marginBottom:6 }}>{title}</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            {task.who && <span style={{ fontSize:12, color:B.textMuted, fontWeight:600 }}>{task.who}</span>}
            {task.detail && <span style={{ fontSize:12, color:B.textLight, lineHeight:1.4 }}>{task.detail}</span>}
            {task.assignee && <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:6, background:'#e9d8fd', color:'#6b46c1' }}>{task.assignee}</span>}
            {task.link && (
              <a href={task.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize:11, fontWeight:600, color:'#3182ce', textDecoration:'underline', textUnderlineOffset:2 }}>
                {task.source==='slack' ? 'View thread' : task.source==='gmail' ? 'View email' : 'View task'}
              </a>
            )}
          </div>
        </div>

        {/* Right side — status pill + actions */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
          <StatusPill status={task.status||'open'} onChange={s => onSetStatus(task.id, s)} />
          <div style={{ display:'flex', gap:4, opacity: hov ? 1 : 0, transition:'opacity .15s' }}>
            <button onClick={() => setEditing(e => !e)} style={{ fontSize:11, padding:'4px 8px', borderRadius:6, border:`1px solid ${B.border}`, background: editing ? B.cream : B.white, cursor:'pointer', color:B.textMuted }}>✏</button>
            <button onClick={() => onArchive(task.id)} style={{ fontSize:11, padding:'4px 8px', borderRadius:6, border:`1px solid ${B.border}`, background:B.white, cursor:'pointer', color:B.textMuted }}>↓</button>
          </div>
        </div>
      </div>
      {editing && <EditPanel task={task} onSave={ch => { onUpdate(task.id, ch); setEditing(false) }} onClose={() => setEditing(false)} />}
    </div>
  )
}

function NavItem({ label, active, onClick, count, dot }) {
  return (
    <div onClick={onClick} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderRadius:10, cursor:'pointer', marginBottom:2, background: active ? B.cream : 'transparent', transition:'background .15s' }}>
      {dot && <div style={{ width:7, height:7, borderRadius:'50%', background:dot, flexShrink:0 }} />}
      <span style={{ fontSize:13, fontWeight: active ? 700 : 500, color: active ? B.black : B.textMuted, flex:1 }}>{label}</span>
      {count > 0 && <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:99, background: active ? B.black : B.pageBg, color: active ? B.cream : B.textMuted }}>{count}</span>}
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
  const [statusTab, setStatusTab] = useState('open') // 'open' | 'responded' | 'done'
  const [devFilter, setDevFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showArchive, setShowArchive] = useState(false)
  const [sortBy, setSortBy] = useState('priority')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [profile, setProfile] = useState(loadProfile())
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const fileInputRef = useRef()
  const profileMenuRef = useRef()

  useEffect(() => {
    const s = loadState()
    if (s.tasks.length) { setTasks(s.tasks); setCrawledAt(s.crawledAt) }
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    const closeMenu = e => { if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) setShowProfileMenu(false) }
    document.addEventListener('mousedown', closeMenu)
    return () => { window.removeEventListener('resize', onResize); document.removeEventListener('mousedown', closeMenu) }
  }, [])

  const crawl = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/crawl', { method:'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || data.error || 'Server error')
      const merged = mergeTasks(tasks, data.tasks)
      setTasks(merged); setCrawledAt(data.crawledAt)
      saveState(merged, data.crawledAt)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [tasks])

  const mut = fn => (id, ...args) => setTasks(prev => { const n = fn(prev, id, ...args); saveState(n, crawledAt); return n })
  const handleSetStatus = mut(setStatus)
  const handleArchive = mut(archiveTask)
  const handleUnarchive = mut(unarchiveTask)
  const handleUpdate = useCallback((id, ch) => setTasks(prev => { const n = updateTask(prev, id, ch); saveState(n, crawledAt); return n }), [crawledAt])

  const handleAvatarUpload = e => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const updated = { ...profile, avatar: ev.target.result }
      setProfile(updated); saveProfile(updated)
    }
    reader.readAsDataURL(file)
  }

  const removeAvatar = () => {
    const updated = { ...profile, avatar: null }
    setProfile(updated); saveProfile(updated)
    setShowProfileMenu(false)
  }

  const q = search.toLowerCase()
  const baseFiltered = tasks.filter(t => {
    if (t.archived) return false
    if (t.status !== statusTab) return false
    if (priFilter !== 'all' && t.priority !== priFilter) return false
    if (srcFilter !== 'all' && t.source !== srcFilter) return false
    if (devFilter && t.assignee !== devFilter) return false
    if (clientFilter && t.client !== clientFilter) return false
    if (q && !(t.title?.toLowerCase().includes(q) || t.detail?.toLowerCase().includes(q) || t.who?.toLowerCase().includes(q))) return false
    return true
  })

  const priOrder = { p1:0, p2:1, p3:2, p4:3 }
  const filtered = [...baseFiltered].sort((a, b) => {
    if (sortBy === 'date') return new Date(b.receivedAt||0) - new Date(a.receivedAt||0)
    const pa = priOrder[a.priority]??2, pb = priOrder[b.priority]??2
    if (pa !== pb) return pa - pb
    return new Date(b.receivedAt||0) - new Date(a.receivedAt||0)
  })

  const archived = tasks.filter(t => t.archived)
  const nonArchived = tasks.filter(t => !t.archived)
  const tabCounts = {
    open: nonArchived.filter(t => t.status === 'open').length,
    responded: nonArchived.filter(t => t.status === 'responded').length,
    done: nonArchived.filter(t => t.status === 'done').length,
  }
  const total = filtered.length
  const hasFilters = priFilter !== 'all' || srcFilter !== 'all' || devFilter || clientFilter || search
  const fmtCrawled = iso => iso ? new Date(iso).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : null
  const priCounts = PRIORITIES.reduce((a,p) => { a[p] = nonArchived.filter(t => t.priority===p && t.status===statusTab).length; return a }, {})
  const srcCounts = SRCS.reduce((a,s) => { a[s] = s==='all' ? nonArchived.filter(t => t.status===statusTab).length : nonArchived.filter(t => t.source===s && t.status===statusTab).length; return a }, {})
  const SIDEBAR_W = 250

  const navClose = fn => (...args) => { fn(...args); if (isMobile) setSidebarOpen(false) }

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:B.pageBg, fontFamily:"'Plus Jakarta Sans','Inter',sans-serif", color:B.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
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

      {isMobile && sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:25 }} />}

      {/* ── SIDEBAR ── */}
      <div style={{ width:SIDEBAR_W, flexShrink:0, background:B.white, borderRight:`1px solid ${B.sidebarBorder}`, position:'fixed', left:0, top:0, bottom:0, zIndex:26, display:'flex', flexDirection:'column', overflowY:'auto', transform: isMobile ? (sidebarOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_W}px)`) : 'translateX(0)', transition:'transform .25s ease', boxShadow: isMobile && sidebarOpen ? '4px 0 20px rgba(0,0,0,.15)' : 'none' }}>

        {/* Profile area */}
        <div style={{ padding:'20px 18px 16px', borderBottom:`1px solid ${B.sidebarBorder}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, justifyContent:'space-between' }}>
            <img src="/klingit-logo.png" alt="Klingit" style={{ height:20 }} />
            {isMobile && <button onClick={() => setSidebarOpen(false)} style={{ border:'none', background:'none', fontSize:18, color:B.textMuted, padding:2 }}>✕</button>}
          </div>

          {/* Avatar + name */}
          <div style={{ marginTop:18, display:'flex', alignItems:'center', gap:12 }}>
            <div ref={profileMenuRef} style={{ position:'relative' }}>
              <Avatar avatar={profile.avatar} name={profile.name} size={42} onClick={() => setShowProfileMenu(o => !o)} />
              {/* Upload hint ring */}
              <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:`2px dashed ${B.creamDark}`, opacity: showProfileMenu ? 1 : 0, transition:'opacity .15s', pointerEvents:'none' }} />
              {showProfileMenu && (
                <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, background:B.white, border:`1px solid ${B.border}`, borderRadius:10, boxShadow:'0 8px 24px rgba(0,0,0,.12)', zIndex:60, minWidth:160, overflow:'hidden' }}>
                  <div onClick={() => { fileInputRef.current.click(); setShowProfileMenu(false) }} style={{ padding:'10px 14px', fontSize:12, fontWeight:600, color:B.text, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}
                    onMouseEnter={e => e.currentTarget.style.background=B.pageBg} onMouseLeave={e => e.currentTarget.style.background=B.white}>
                    📷 Upload photo
                  </div>
                  {profile.avatar && (
                    <div onClick={removeAvatar} style={{ padding:'10px 14px', fontSize:12, fontWeight:600, color:'#e53e3e', cursor:'pointer', display:'flex', alignItems:'center', gap:8, borderTop:`1px solid ${B.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background='#fff5f5'} onMouseLeave={e => e.currentTarget.style.background=B.white}>
                      🗑 Remove photo
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:B.black }}>{profile.name}</div>
              <div style={{ fontSize:11, color:B.textLight }}>Project Manager</div>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display:'none' }} />
        </div>

        <div style={{ padding:'12px 10px', flex:1 }}>
          <NavItem label="All Tasks" active={priFilter==='all' && srcFilter==='all' && !showArchive} count={srcCounts.all}
            onClick={navClose(() => { setPriFilter('all'); setSrcFilter('all'); setShowArchive(false) })} />

          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:B.textLight, padding:'12px 14px 6px' }}>Priority</div>
          {PRIORITIES.map(p => {
            const cfg = PRIORITY[p]
            return <NavItem key={p} label={cfg.label} active={priFilter===p} dot={cfg.color} count={priCounts[p]}
              onClick={navClose(() => { setPriFilter(priFilter===p ? 'all' : p); setShowArchive(false) })} />
          })}

          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:B.textLight, padding:'12px 14px 6px' }}>Source</div>
          {SRCS.map(s => (
            <NavItem key={s} label={s==='all' ? 'All sources' : s.charAt(0).toUpperCase()+s.slice(1)}
              active={srcFilter===s && priFilter==='all'} count={srcCounts[s]}
              onClick={navClose(() => { setSrcFilter(s); setPriFilter('all'); setShowArchive(false) })} />
          ))}

          <div style={{ height:1, background:B.sidebarBorder, margin:'12px 4px' }} />
          <NavItem label="Archive" active={showArchive} count={archived.length} onClick={navClose(() => setShowArchive(s => !s))} />
        </div>

        {/* Crawl card */}
        <div style={{ margin:14, padding:16, borderRadius:14, background:`linear-gradient(135deg,${B.black} 0%,#2d3748 100%)` }}>
          <div style={{ fontSize:12, fontWeight:700, color:B.white, marginBottom:2 }}>Crawl sources</div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', marginBottom:12 }}>{crawledAt ? `Updated ${fmtCrawled(crawledAt)}` : 'Not yet crawled'}</div>
          <button onClick={crawl} disabled={loading} style={{ width:'100%', fontSize:11, fontWeight:700, padding:'9px', borderRadius:9, border:'none', background:B.cream, color:B.black, cursor: loading ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            {loading ? <><svg width="11" height="11" viewBox="0 0 12 12" style={{ animation:'spin 1s linear infinite' }}><circle cx="6" cy="6" r="4.5" stroke={B.black} strokeWidth="1.5" strokeDasharray="14 6" fill="none"/></svg>Crawling…</> : 'Crawl now'}
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex:1, marginLeft: isMobile ? 0 : SIDEBAR_W, minWidth:0 }}>

        {/* Top bar */}
        <div style={{ background:'rgba(255,255,255,.92)', backdropFilter:'blur(12px)', borderBottom:`1px solid ${B.border}`, padding:'0 16px', height:58, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {isMobile && <button onClick={() => setSidebarOpen(true)} style={{ border:'none', background:'none', fontSize:20, color:B.text, padding:'4px 6px' }}>☰</button>}
            <div>
              <div style={{ fontSize:11, color:B.textLight, lineHeight:1.2 }}>Task Manager</div>
              <div style={{ fontSize:15, fontWeight:700, color:B.text, lineHeight:1.2 }}>
                {priFilter !== 'all' ? PRIORITY[priFilter].label : srcFilter !== 'all' ? SRC[srcFilter]?.label : 'All Tasks'}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ position:'relative' }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                <circle cx="6.5" cy="6.5" r="5" stroke={B.textLight} strokeWidth="1.5"/>
                <path d="M10.5 10.5L14 14" stroke={B.textLight} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                style={{ fontSize:13, padding:'7px 12px 7px 30px', borderRadius:9, border:`1px solid ${B.border}`, background:B.white, outline:'none', color:B.text, width: isMobile ? 120 : 170 }} />
              {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', border:'none', background:'none', color:B.textLight, fontSize:13 }}>✕</button>}
            </div>
            {/* Avatar in top bar on mobile */}
            {isMobile && <Avatar avatar={profile.avatar} name={profile.name} size={32} onClick={() => setSidebarOpen(true)} />}
          </div>
        </div>

        <div style={{ padding: isMobile ? '14px 12px 60px' : '22px 26px 60px' }}>

          {/* Header banner */}
          <div style={{ borderRadius:16, padding: isMobile ? '18px 18px' : '22px 26px', marginBottom:18, background:`linear-gradient(135deg,${B.black} 0%,#2d3748 100%)`, position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <svg style={{ position:'absolute', right:-10, top:-10, opacity:.06, pointerEvents:'none' }} width="200" height="120" viewBox="0 0 200 120" fill="none">
              <ellipse cx="120" cy="45" rx="110" ry="62" stroke={B.cream} strokeWidth="22"/>
              <ellipse cx="155" cy="60" rx="72" ry="40" stroke={B.cream} strokeWidth="15"/>
            </svg>
            <div style={{ position:'relative' }}>
              <img src="/klingit-logo.png" alt="Klingit" style={{ height:18, filter:'invert(1)', opacity:.8, marginBottom:7 }} />
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight:800, color:B.white, marginBottom:2 }}>Task Manager</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.38)' }}>{crawledAt ? `Last crawled ${fmtCrawled(crawledAt)}` : 'Hit Crawl now to load tasks'}</div>
            </div>
            {/* Profile avatar in banner */}
            <div style={{ position:'relative', zIndex:1 }}>
              <Avatar avatar={profile.avatar} name={profile.name} size={isMobile ? 44 : 54} />
              <div style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,.6)', textAlign:'center', marginTop:5 }}>{profile.name}</div>
            </div>
          </div>

          {/* ── STATUS TABS ── */}
          <div style={{ display:'flex', gap:0, marginBottom:18, background:B.white, borderRadius:12, padding:4, border:`1px solid ${B.border}` }}>
            {['open','responded','done'].map(s => {
              const active = statusTab === s
              const cfg = STATUS_CFG[s]
              return (
                <button key={s} onClick={() => setStatusTab(s)} style={{
                  flex:1, fontSize:12, fontWeight: active ? 700 : 500,
                  padding:'8px 10px', borderRadius:9, border:'none',
                  background: active ? cfg.bg : 'transparent',
                  color: active ? cfg.color : B.textMuted,
                  boxShadow: active ? `0 1px 4px ${cfg.color}25` : 'none',
                  transition:'all .15s', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background: active ? cfg.color : B.textLight, flexShrink:0 }} />
                  {cfg.label}
                  <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:99, background: active ? `${cfg.color}20` : B.pageBg, color: active ? cfg.color : B.textLight }}>
                    {tabCounts[s]}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Stat cards */}
          {nonArchived.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:10, marginBottom:18 }}>
              {PRIORITIES.map(p => {
                const cfg = PRIORITY[p]
                const count = priCounts[p]
                const active = priFilter===p
                return (
                  <div key={p} onClick={() => setPriFilter(active ? 'all' : p)} style={{ background: active ? B.black : B.white, border:`1px solid ${active ? B.black : B.border}`, borderRadius:12, padding:'14px 16px', cursor:'pointer', transition:'all .2s', boxShadow: active ? '0 6px 20px rgba(0,0,0,.14)' : '0 1px 3px rgba(0,0,0,.04)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background: active ? B.cream : cfg.color }} />
                      <span style={{ fontSize:9, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color: active ? 'rgba(255,255,255,.5)' : B.textMuted }}>{cfg.short}</span>
                    </div>
                    <div style={{ fontSize:28, fontWeight:800, color: active ? B.white : cfg.color, fontVariantNumeric:'tabular-nums', lineHeight:1, marginBottom:3 }}>{count}</div>
                    <div style={{ fontSize:10, fontWeight:600, color: active ? 'rgba(255,255,255,.38)' : B.textMuted }}>{cfg.label.replace(`${cfg.short} `,'')}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Progress + sort */}
          {total > 0 && (
            <div style={{ background:B.white, borderRadius:12, padding:'11px 14px', marginBottom:14, border:`1px solid ${B.border}`, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, fontWeight:600, color:B.text }}>{total} task{total!==1?'s':''}{hasFilters?' (filtered)':''}</span>
                  <span style={{ fontSize:11, color:B.textMuted, textTransform:'capitalize' }}>{statusTab}</span>
                </div>
                <div style={{ height:3, background:B.pageBg, borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${Math.min(tabCounts.done/(nonArchived.length||1)*100,100)}%`, background:STATUS_CFG.done.color, borderRadius:99, transition:'width .5s' }} />
                </div>
              </div>
              <div style={{ display:'flex', background:B.pageBg, borderRadius:7, padding:3, gap:2, flexShrink:0 }}>
                {[{id:'priority',label:'Priority'},{id:'date',label:'Date'}].map(s => (
                  <button key={s.id} onClick={() => setSortBy(s.id)} style={{ fontSize:11, fontWeight: sortBy===s.id ? 700 : 500, padding:'4px 10px', borderRadius:5, border:'none', background: sortBy===s.id ? B.white : 'transparent', color: sortBy===s.id ? B.text : B.textMuted, boxShadow: sortBy===s.id ? '0 1px 3px rgba(0,0,0,.1)' : 'none', transition:'all .15s' }}>{s.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div style={{ background:B.white, borderRadius:12, padding:'11px 13px', marginBottom:18, border:`1px solid ${B.border}`, overflowX:'auto' }}>
            <div style={{ display:'flex', gap:6, alignItems:'center', minWidth:'max-content' }}>
              {SRCS.map(s => (
                <button key={s} onClick={() => setSrcFilter(s)} style={{ fontSize:11, fontWeight: srcFilter===s ? 700 : 500, padding:'5px 12px', borderRadius:8, border:`1.5px solid ${srcFilter===s ? B.black : B.border}`, background: srcFilter===s ? B.black : 'transparent', color: srcFilter===s ? B.white : B.textMuted, whiteSpace:'nowrap' }}>
                  {s==='all' ? 'All' : s.charAt(0).toUpperCase()+s.slice(1)}
                </button>
              ))}
              <div style={{ width:1, height:16, background:B.border, flexShrink:0 }} />
              {PRIORITIES.map(p => {
                const active = priFilter===p, cfg = PRIORITY[p]
                return <button key={p} onClick={() => setPriFilter(active ? 'all' : p)} style={{ fontSize:11, fontWeight: active ? 700 : 500, padding:'5px 11px', borderRadius:8, border:`1.5px solid ${active ? cfg.color : B.border}`, background: active ? cfg.bg : 'transparent', color: active ? cfg.color : B.textMuted, whiteSpace:'nowrap' }}>{cfg.short}</button>
              })}
              <div style={{ width:1, height:16, background:B.border, flexShrink:0 }} />
              <div style={{ position:'relative' }}>
                <select value={devFilter} onChange={e => setDevFilter(e.target.value)} style={{ fontSize:11, fontWeight: devFilter ? 700 : 500, padding:'5px 22px 5px 10px', borderRadius:8, border:`1.5px solid ${devFilter ? B.black : B.border}`, background: devFilter ? B.black : 'transparent', color: devFilter ? B.white : B.textMuted }}>
                  <option value="">Dev</option>
                  {DEVS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <svg width="8" height="8" viewBox="0 0 10 10" style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><polyline points="2,3 5,7 8,3" fill="none" stroke={devFilter ? B.white : B.textLight} strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <div style={{ position:'relative' }}>
                <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} style={{ fontSize:11, fontWeight: clientFilter ? 700 : 500, padding:'5px 22px 5px 10px', borderRadius:8, border:`1.5px solid ${clientFilter ? B.black : B.border}`, background: clientFilter ? B.black : 'transparent', color: clientFilter ? B.white : B.textMuted }}>
                  <option value="">Client</option>
                  {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <svg width="8" height="8" viewBox="0 0 10 10" style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}><polyline points="2,3 5,7 8,3" fill="none" stroke={clientFilter ? B.white : B.textLight} strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              {hasFilters && <button onClick={() => { setPriFilter('all'); setSrcFilter('all'); setDevFilter(''); setClientFilter(''); setSearch('') }} style={{ fontSize:11, padding:'5px 10px', borderRadius:8, border:`1px solid ${B.border}`, background:'transparent', color:B.textLight, whiteSpace:'nowrap' }}>✕ Clear</button>}
            </div>
          </div>

          {/* Error */}
          {error && <div style={{ background:'#fff5f5', border:'1px solid #fc8181', borderRadius:10, padding:'11px 14px', marginBottom:12, fontSize:13, color:'#c53030' }}>Crawl failed: {error}</div>}

          {/* Empty state */}
          {!loading && tasks.length===0 && !error && (
            <div style={{ textAlign:'center', padding:'60px 20px', background:B.white, borderRadius:14, border:`1px solid ${B.border}` }}>
              <div style={{ fontSize:36, marginBottom:10 }}>📭</div>
              <div style={{ fontSize:14, fontWeight:700, color:B.text, marginBottom:5 }}>No tasks yet</div>
              <div style={{ fontSize:13, color:B.textLight }}>Hit Crawl now to pull from Slack, Gmail & ClickUp</div>
            </div>
          )}

          {/* Loading */}
          {loading && tasks.length===0 && (
            <div>{[1,2,3,4].map(i => <div key={i} style={{ height:80, background:B.white, borderRadius:12, marginBottom:6, border:`1px solid ${B.border}`, animation:'shimmer 1.4s ease-in-out infinite', animationDelay:`${i*.1}s` }} />)}</div>
          )}

          {/* Archive */}
          {showArchive && (
            <div style={{ marginBottom:22, background:B.white, borderRadius:12, border:`1px solid ${B.border}`, overflow:'hidden' }}>
              <div style={{ padding:'11px 16px', borderBottom:`1px solid ${B.border}`, fontSize:10, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase', color:B.textMuted }}>Archived ({archived.length})</div>
              {archived.length===0
                ? <div style={{ padding:'14px 16px', fontSize:13, color:B.textLight }}>Nothing archived yet.</div>
                : archived.map(t => (
                  <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', borderBottom:`1px solid ${B.sidebarBorder}` }}>
                    <span style={{ fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:4, background:B.pageBg, color:B.textMuted, textTransform:'uppercase' }}>{t.source}</span>
                    <div style={{ flex:1, fontSize:13, color:B.textLight, textDecoration:'line-through', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.customTitle||t.title}</div>
                    <button onClick={() => handleUnarchive(t.id)} style={{ fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:6, border:`1px solid ${B.border}`, background:B.white, color:B.textMuted, flexShrink:0 }}>Restore</button>
                  </div>
                ))
              }
            </div>
          )}

          {/* No results */}
          {tasks.length>0 && filtered.length===0 && !showArchive && (
            <div style={{ textAlign:'center', padding:'32px', background:B.white, borderRadius:12, border:`1px solid ${B.border}`, fontSize:13, color:B.textLight }}>No tasks in this view.</div>
          )}

          {/* Tasks by priority */}
          {sortBy==='date'
            ? filtered.map(t => <TaskRow key={t.id} task={t} onSetStatus={handleSetStatus} onArchive={handleArchive} onUpdate={handleUpdate} />)
            : PRIORITIES.map(p => {
                const items = filtered.filter(t => t.priority===p)
                if (!items.length) return null
                const cfg = PRIORITY[p]
                return (
                  <div key={p} style={{ background:B.white, borderRadius:14, border:`1px solid ${B.border}`, marginBottom:16, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.04)' }}>
                    <div style={{ padding:'11px 16px', borderBottom:`1px solid ${B.sidebarBorder}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:cfg.color }} />
                        <span style={{ fontSize:13, fontWeight:700, color:B.text }}>{cfg.label}</span>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6, background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}` }}>{items.length}</span>
                      </div>
                    </div>
                    <div style={{ padding:'8px 10px' }}>
                      {items.map(t => <TaskRow key={t.id} task={t} onSetStatus={handleSetStatus} onArchive={handleArchive} onUpdate={handleUpdate} />)}
                    </div>
                  </div>
                )
              })
          }
        </div>
      </div>
    </div>
  )
}
