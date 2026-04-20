const STORAGE_KEY = 'taskmaster_v1'

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
  const existingIds = new Set(existing.map(t => t.id))

  return fresh.map(task => ({
    ...task,
    checked: checkedIds.has(task.id),
    isNew: !existingIds.has(task.id),
  }))
}

export function toggleTask(tasks, id) {
  return tasks.map(t => t.id === id ? { ...t, checked: !t.checked } : t)
}
