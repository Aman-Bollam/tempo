import { supabase } from './supabase'
import type {
  Activity,
  BoardData,
  Comment,
  Label,
  NewTask,
  Task,
  TaskPatch,
  TeamMember,
} from './types'

export interface DataApi {
  /** Ensure a session exists and return the user id. */
  signIn(): Promise<string>
  fetchBoard(): Promise<BoardData>
  createTask(input: NewTask, sortOrder: number): Promise<Task>
  updateTask(id: string, patch: TaskPatch, prev: Task): Promise<Task>
  deleteTask(id: string): Promise<void>
  createMember(name: string, color: string): Promise<TeamMember>
  deleteMember(id: string): Promise<void>
  createLabel(name: string, color: string): Promise<Label>
  deleteLabel(id: string): Promise<void>
  setTaskLabels(taskId: string, labelIds: string[]): Promise<void>
  fetchTaskDetail(taskId: string): Promise<{ comments: Comment[]; activity: Activity[] }>
  addComment(taskId: string, body: string): Promise<Comment>
}

/* ============================================================
   Supabase implementation.
   Activity rows for task changes are written by a Postgres
   trigger (see supabase/schema.sql), not from the client, so
   the log cannot drift from actual writes.
   ============================================================ */

class SupabaseApi implements DataApi {
  private userId = ''

  async signIn(): Promise<string> {
    const sb = supabase!
    const { data: sessionData } = await sb.auth.getSession()
    if (sessionData.session) {
      this.userId = sessionData.session.user.id
      return this.userId
    }
    const { data, error } = await sb.auth.signInAnonymously()
    if (error || !data.user) throw new Error(error?.message ?? 'Anonymous sign-in failed')
    this.userId = data.user.id
    return this.userId
  }

  async fetchBoard(): Promise<BoardData> {
    const sb = supabase!
    const [tasks, members, labels, taskLabels] = await Promise.all([
      sb.from('tasks').select('*').order('sort_order', { ascending: true }),
      sb.from('team_members').select('*').order('created_at', { ascending: true }),
      sb.from('labels').select('*').order('created_at', { ascending: true }),
      sb.from('task_labels').select('task_id, label_id'),
    ])
    const err = tasks.error ?? members.error ?? labels.error ?? taskLabels.error
    if (err) throw new Error(err.message)
    return {
      tasks: (tasks.data ?? []) as Task[],
      members: (members.data ?? []) as TeamMember[],
      labels: (labels.data ?? []) as Label[],
      taskLabels: taskLabels.data ?? [],
    }
  }

  async createTask(input: NewTask, sortOrder: number): Promise<Task> {
    const { data, error } = await supabase!
      .from('tasks')
      .insert({ ...input, sort_order: sortOrder, user_id: this.userId })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Task
  }

  async updateTask(id: string, patch: TaskPatch): Promise<Task> {
    const { data, error } = await supabase!
      .from('tasks')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Task
  }

  async deleteTask(id: string): Promise<void> {
    const { error } = await supabase!.from('tasks').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  async createMember(name: string, color: string): Promise<TeamMember> {
    const { data, error } = await supabase!
      .from('team_members')
      .insert({ name, color, user_id: this.userId })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as TeamMember
  }

  async deleteMember(id: string): Promise<void> {
    const { error } = await supabase!.from('team_members').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  async createLabel(name: string, color: string): Promise<Label> {
    const { data, error } = await supabase!
      .from('labels')
      .insert({ name, color, user_id: this.userId })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Label
  }

  async deleteLabel(id: string): Promise<void> {
    const { error } = await supabase!.from('labels').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  async setTaskLabels(taskId: string, labelIds: string[]): Promise<void> {
    const sb = supabase!
    const { error: delError } = await sb.from('task_labels').delete().eq('task_id', taskId)
    if (delError) throw new Error(delError.message)
    if (labelIds.length === 0) return
    const rows = labelIds.map((label_id) => ({
      task_id: taskId,
      label_id,
      user_id: this.userId,
    }))
    const { error } = await sb.from('task_labels').insert(rows)
    if (error) throw new Error(error.message)
  }

  async fetchTaskDetail(taskId: string) {
    const sb = supabase!
    const [comments, activity] = await Promise.all([
      sb.from('comments').select('*').eq('task_id', taskId).order('created_at'),
      sb.from('activity').select('*').eq('task_id', taskId).order('created_at', { ascending: false }),
    ])
    const err = comments.error ?? activity.error
    if (err) throw new Error(err.message)
    return {
      comments: (comments.data ?? []) as Comment[],
      activity: (activity.data ?? []) as Activity[],
    }
  }

  async addComment(taskId: string, body: string): Promise<Comment> {
    const { data, error } = await supabase!
      .from('comments')
      .insert({ task_id: taskId, body, user_id: this.userId })
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data as Comment
  }
}

/* ============================================================
   LocalStorage mock — used when Supabase env vars are absent
   so the app runs without a backend (dev/preview only).
   Mirrors the DB trigger by writing activity rows on task
   create/update.
   ============================================================ */

const LS_KEY = 'tempo-mock'

interface MockDb {
  userId: string
  tasks: Task[]
  members: TeamMember[]
  labels: Label[]
  taskLabels: { task_id: string; label_id: string }[]
  comments: Comment[]
  activity: Activity[]
}

const uuid = () => crypto.randomUUID()
const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms))

class MockApi implements DataApi {
  private db: MockDb

  constructor() {
    const raw = localStorage.getItem(LS_KEY)
    this.db = raw
      ? (JSON.parse(raw) as MockDb)
      : {
          userId: uuid(),
          tasks: [],
          members: [],
          labels: [],
          taskLabels: [],
          comments: [],
          activity: [],
        }
    this.save()
  }

  private save() {
    localStorage.setItem(LS_KEY, JSON.stringify(this.db))
  }

  private logActivity(taskId: string, kind: Activity['kind'], detail: Activity['detail'] = {}) {
    this.db.activity.push({
      id: uuid(),
      task_id: taskId,
      kind,
      detail,
      user_id: this.db.userId,
      created_at: new Date().toISOString(),
    })
  }

  async signIn() {
    await delay(120)
    return this.db.userId
  }

  async fetchBoard(): Promise<BoardData> {
    await delay(350)
    return {
      tasks: [...this.db.tasks].sort((a, b) => a.sort_order - b.sort_order),
      members: this.db.members,
      labels: this.db.labels,
      taskLabels: this.db.taskLabels,
    }
  }

  async createTask(input: NewTask, sortOrder: number): Promise<Task> {
    await delay()
    const task: Task = {
      id: uuid(),
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      priority: input.priority ?? 'normal',
      due_date: input.due_date ?? null,
      assignee_id: input.assignee_id ?? null,
      sort_order: sortOrder,
      user_id: this.db.userId,
      created_at: new Date().toISOString(),
    }
    this.db.tasks.push(task)
    this.logActivity(task.id, 'created', { status: task.status })
    this.save()
    return task
  }

  async updateTask(id: string, patch: TaskPatch, prev: Task): Promise<Task> {
    await delay()
    const idx = this.db.tasks.findIndex((t) => t.id === id)
    if (idx === -1) throw new Error('Task not found')
    const next = { ...this.db.tasks[idx], ...patch }
    this.db.tasks[idx] = next

    if (patch.status && patch.status !== prev.status) {
      this.logActivity(id, 'status_changed', { from: prev.status, to: patch.status })
    }
    if (patch.assignee_id !== undefined && patch.assignee_id !== prev.assignee_id) {
      this.logActivity(id, patch.assignee_id ? 'assigned' : 'unassigned', {
        assignee_id: patch.assignee_id,
      })
    }
    if (
      (patch.title && patch.title !== prev.title) ||
      (patch.description !== undefined && patch.description !== prev.description) ||
      (patch.priority && patch.priority !== prev.priority) ||
      (patch.due_date !== undefined && patch.due_date !== prev.due_date)
    ) {
      this.logActivity(id, 'edited', {})
    }
    this.save()
    return next
  }

  async deleteTask(id: string) {
    await delay()
    this.db.tasks = this.db.tasks.filter((t) => t.id !== id)
    this.db.taskLabels = this.db.taskLabels.filter((tl) => tl.task_id !== id)
    this.db.comments = this.db.comments.filter((c) => c.task_id !== id)
    this.db.activity = this.db.activity.filter((a) => a.task_id !== id)
    this.save()
  }

  async createMember(name: string, color: string): Promise<TeamMember> {
    await delay()
    const member: TeamMember = {
      id: uuid(),
      name,
      color,
      user_id: this.db.userId,
      created_at: new Date().toISOString(),
    }
    this.db.members.push(member)
    this.save()
    return member
  }

  async deleteMember(id: string) {
    await delay()
    this.db.members = this.db.members.filter((m) => m.id !== id)
    this.db.tasks = this.db.tasks.map((t) =>
      t.assignee_id === id ? { ...t, assignee_id: null } : t,
    )
    this.save()
  }

  async createLabel(name: string, color: string): Promise<Label> {
    await delay()
    const label: Label = {
      id: uuid(),
      name,
      color,
      user_id: this.db.userId,
      created_at: new Date().toISOString(),
    }
    this.db.labels.push(label)
    this.save()
    return label
  }

  async deleteLabel(id: string) {
    await delay()
    this.db.labels = this.db.labels.filter((l) => l.id !== id)
    this.db.taskLabels = this.db.taskLabels.filter((tl) => tl.label_id !== id)
    this.save()
  }

  async setTaskLabels(taskId: string, labelIds: string[]) {
    await delay(120)
    this.db.taskLabels = this.db.taskLabels.filter((tl) => tl.task_id !== taskId)
    for (const label_id of labelIds) this.db.taskLabels.push({ task_id: taskId, label_id })
    this.save()
  }

  async fetchTaskDetail(taskId: string) {
    await delay(200)
    return {
      comments: this.db.comments
        .filter((c) => c.task_id === taskId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      activity: this.db.activity
        .filter((a) => a.task_id === taskId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    }
  }

  async addComment(taskId: string, body: string): Promise<Comment> {
    await delay()
    const comment: Comment = {
      id: uuid(),
      task_id: taskId,
      body,
      user_id: this.db.userId,
      created_at: new Date().toISOString(),
    }
    this.db.comments.push(comment)
    this.logActivity(taskId, 'commented', {})
    this.save()
    return comment
  }
}

export const api: DataApi = supabase ? new SupabaseApi() : new MockApi()
