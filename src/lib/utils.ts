import type { Task } from './types'

export const MEMBER_COLORS = [
  '#5b5bd6', '#e5484d', '#30a46c', '#e5a100', '#0091ff',
  '#d6409f', '#12a594', '#f76b15', '#8e4ec6', '#3e63dd',
]

export const LABEL_COLORS = [
  '#e5484d', '#f76b15', '#e5a100', '#30a46c', '#12a594',
  '#0091ff', '#3e63dd', '#8e4ec6', '#d6409f', '#8b8d98',
]

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export type DueState = 'overdue' | 'soon' | 'later' | 'done'

/** Classify a task's due date for badge styling. */
export function dueState(task: Task): DueState | null {
  if (!task.due_date) return null
  if (task.status === 'done') return 'done'
  const today = startOfToday()
  const due = new Date(task.due_date + 'T00:00:00')
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 2) return 'soon'
  return 'later'
}

export function isOverdue(task: Task): boolean {
  return dueState(task) === 'overdue'
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function formatDue(dateStr: string): string {
  const due = new Date(dateStr + 'T00:00:00')
  const today = startOfToday()
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  return due.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: due.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
