export type Status = 'todo' | 'in_progress' | 'in_review' | 'done'
export type Priority = 'low' | 'normal' | 'high'

export const STATUSES: Status[] = ['todo', 'in_progress', 'in_review', 'done']

export const STATUS_META: Record<Status, { label: string; color: string }> = {
  todo: { label: 'To Do', color: 'var(--c-status-todo)' },
  in_progress: { label: 'In Progress', color: 'var(--c-status-progress)' },
  in_review: { label: 'In Review', color: 'var(--c-status-review)' },
  done: { label: 'Done', color: 'var(--c-status-done)' },
}

export const PRIORITY_META: Record<Priority, { label: string; rank: number }> = {
  high: { label: 'High', rank: 0 },
  normal: { label: 'Normal', rank: 1 },
  low: { label: 'Low', rank: 2 },
}

export interface Task {
  id: string
  title: string
  description: string | null
  status: Status
  priority: Priority
  due_date: string | null // ISO date (yyyy-mm-dd)
  assignee_id: string | null
  sort_order: number
  user_id: string
  created_at: string
}

export interface TeamMember {
  id: string
  name: string
  color: string
  user_id: string
  created_at: string
}

export interface Label {
  id: string
  name: string
  color: string
  user_id: string
  created_at: string
}

export interface TaskLabel {
  task_id: string
  label_id: string
}

export interface Comment {
  id: string
  task_id: string
  body: string
  user_id: string
  created_at: string
}

export type ActivityKind =
  | 'created'
  | 'status_changed'
  | 'edited'
  | 'assigned'
  | 'unassigned'
  | 'commented'

export interface Activity {
  id: string
  task_id: string
  kind: ActivityKind
  detail: Record<string, string | null>
  user_id: string
  created_at: string
}

export interface BoardData {
  tasks: Task[]
  members: TeamMember[]
  labels: Label[]
  taskLabels: TaskLabel[]
}

export type NewTask = Pick<Task, 'title' | 'status'> &
  Partial<Pick<Task, 'description' | 'priority' | 'due_date' | 'assignee_id'>>

export type TaskPatch = Partial<
  Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'due_date' | 'assignee_id' | 'sort_order'>
>
