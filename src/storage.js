const STORAGE_KEY = 'taskmaster_v2'

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { tasks: [], crawledAt: null }
    return JSON.parse(raw)
  } catch {
    return { tasks: [], crawledAt: null }
  }
}

export function saveState(tasks, crawledAt) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, crawledAt }))
  } catch {}
}

export function mergeTasks(existing, fresh) {
  const checkedIds = new Set(existing.filter(t => t.checked).map(t => t.id))
  const archivedIds = new Set(existing.filter(t => t.archived).map(t => t.id))
  const existingIds = new Set(existing.map(t => t.id))
  const overrides = {}
  existing.forEach(t => {
    if (t.customTitle || t.assignee || t.client) {
      overrides[t.id] = { customTitle: t.customTitle, assignee: t.assignee, client: t.client }
    }
  })
  return fresh.map(task => ({
    ...task,
    checked: checkedIds.has(task.id),
    archived: archivedIds.has(task.id),
    isNew: !existingIds.has(task.id),
    ...(overrides[task.id] || {}),
  }))
}

export function toggleTask(tasks, id) {
  return tasks.map(t => t.id === id ? { ...t, checked: !t.checked } : t)
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
