const STORAGE_KEY = 'taskmaster_v3'
const PROFILE_KEY = 'taskmaster_profile'

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { tasks: [], crawledAt: null }
    return JSON.parse(raw)
  } catch { return { tasks: [], crawledAt: null } }
}

export function saveState(tasks, crawledAt) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, crawledAt })) } catch {}
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? JSON.parse(raw) : { name: 'Rysiu', avatar: null }
  } catch { return { name: 'Rysiu', avatar: null } }
}

export function saveProfile(profile) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)) } catch {}
}

export function mergeTasks(existing, fresh) {
  const byId = {}
  existing.forEach(t => { byId[t.id] = t })
  const existingIds = new Set(existing.map(t => t.id))
  return fresh.map(task => ({
    ...task,
    status: byId[task.id]?.status || 'open',
    archived: byId[task.id]?.archived || false,
    isNew: !existingIds.has(task.id),
    customTitle: byId[task.id]?.customTitle,
    assignee: byId[task.id]?.assignee || task.assignee,
    client: byId[task.id]?.client || task.client,
  }))
}

// status: 'open' | 'responded' | 'done'
export function setStatus(tasks, id, status) {
  return tasks.map(t => t.id === id ? { ...t, status } : t)
}
export function archiveTask(tasks, id) {
  return tasks.map(t => t.id === id ? { ...t, archived: true } : t)
}
export function unarchiveTask(tasks, id) {
  return tasks.map(t => t.id === id ? { ...t, archived: false } : t)
}
export function updateTask(tasks, id, changes) {
  return tasks.map(t => t.id === id ? { ...t, ...changes } : t)
}
// Keep for compatibility
export function toggleTask(tasks, id) {
  return tasks.map(t => t.id === id ? { ...t, status: t.status === 'done' ? 'open' : 'done' } : t)
}
