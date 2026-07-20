import { useEffect, useMemo, useState } from 'react'
import { Board } from './components/Board'
import {
  BoardIcon,
  MoonIcon,
  PlusIcon,
  SearchIcon,
  SunIcon,
  TagIcon,
  UsersIcon,
  XIcon,
} from './components/Icons'
import { ManageModal } from './components/ManageModal'
import { NewTaskModal } from './components/NewTaskModal'
import { TaskDetailPanel } from './components/TaskDetailPanel'
import type { Label, Priority, Status, Task, TeamMember } from './lib/types'
import { STATUSES } from './lib/types'
import { isOverdue, initials } from './lib/utils'
import { useBoard } from './state/BoardContext'

type Theme = 'light' | 'dark'

function initialTheme(): Theme {
  const stored = localStorage.getItem('tempo-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const { phase, errorMsg, data, reload, toast, dismissToast } = useBoard()

  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [labelFilter, setLabelFilter] = useState('')

  const [newTaskStatus, setNewTaskStatus] = useState<Status | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [manageOpen, setManageOpen] = useState<'team' | 'labels' | null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('tempo-theme', theme)
  }, [theme])

  const filtersActive =
    search.trim() !== '' || priorityFilter !== '' || assigneeFilter !== '' || labelFilter !== ''

  const labelsByTask = useMemo(() => {
    const map = new Map<string, Label[]>()
    const labelById = new Map(data.labels.map((l) => [l.id, l]))
    for (const tl of data.taskLabels) {
      const label = labelById.get(tl.label_id)
      if (!label) continue
      const list = map.get(tl.task_id) ?? []
      list.push(label)
      map.set(tl.task_id, list)
    }
    return map
  }, [data.labels, data.taskLabels])

  const memberById = useMemo(
    () => new Map<string, TeamMember>(data.members.map((m) => [m.id, m])),
    [data.members],
  )

  const visibleTasks = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false
      if (priorityFilter && t.priority !== priorityFilter) return false
      if (assigneeFilter && t.assignee_id !== assigneeFilter) return false
      if (labelFilter && !(labelsByTask.get(t.id) ?? []).some((l) => l.id === labelFilter))
        return false
      return true
    })
  }, [data.tasks, search, priorityFilter, assigneeFilter, labelFilter, labelsByTask])

  const tasksByStatus = useMemo(() => {
    const map = Object.fromEntries(STATUSES.map((s) => [s, [] as Task[]])) as Record<Status, Task[]>
    for (const t of visibleTasks) map[t.status].push(t)
    for (const s of STATUSES) map[s].sort((a, b) => a.sort_order - b.sort_order)
    return map
  }, [visibleTasks])

  const stats = useMemo(
    () => ({
      total: data.tasks.length,
      done: data.tasks.filter((t) => t.status === 'done').length,
      overdue: data.tasks.filter(isOverdue).length,
    }),
    [data.tasks],
  )

  const openTask = openTaskId ? (data.tasks.find((t) => t.id === openTaskId) ?? null) : null

  const sidebarSections = (
    <>
      <div className="sidebar__section" aria-label="Board summary">
        <h4>Overview</h4>
        <div className="sidebar__stat">
          <span>Total tasks</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="sidebar__stat">
          <span>Completed</span>
          <strong>{stats.done}</strong>
        </div>
        <div className="sidebar__stat">
          <span>Overdue</span>
          <strong className={stats.overdue > 0 ? 'sidebar__stat-danger' : ''}>
            {stats.overdue}
          </strong>
        </div>
      </div>

      <div className="sidebar__section">
        <h4>
          Team
          <button
            className="sidebar__section-add"
            onClick={() => setManageOpen('team')}
            aria-label="Manage team"
          >
            <PlusIcon size={13} />
          </button>
        </h4>
        {data.members.length === 0 ? (
          <p className="sidebar__hint">Add teammates to assign tasks.</p>
        ) : (
          data.members.map((m) => (
            <button
              key={m.id}
              className={`sidebar__row${assigneeFilter === m.id ? ' sidebar__row--active' : ''}`}
              onClick={() => setAssigneeFilter(assigneeFilter === m.id ? '' : m.id)}
              title={`Filter by ${m.name}`}
            >
              <span className="avatar" style={{ background: m.color }}>
                {initials(m.name)}
              </span>
              <span className="sidebar__row-name">{m.name}</span>
            </button>
          ))
        )}
      </div>

      <div className="sidebar__section">
        <h4>
          Labels
          <button
            className="sidebar__section-add"
            onClick={() => setManageOpen('labels')}
            aria-label="Manage labels"
          >
            <PlusIcon size={13} />
          </button>
        </h4>
        {data.labels.length === 0 ? (
          <p className="sidebar__hint">Create labels like “Bug” or “Design”.</p>
        ) : (
          <div className="sidebar__labels">
            {data.labels.map((l) => (
              <button
                key={l.id}
                className="label-pill label-pill--pick"
                style={{
                  background: labelFilter === l.id ? l.color : 'transparent',
                  color: labelFilter === l.id ? '#fff' : l.color,
                  borderColor: l.color,
                }}
                onClick={() => setLabelFilter(labelFilter === l.id ? '' : l.id)}
                title={`Filter by ${l.name}`}
              >
                {l.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <img src="/favicon.svg" alt="" className="sidebar__logo" />
          <span>Tempo</span>
        </div>
        <nav className="sidebar__nav">
          <span className="sidebar__nav-item sidebar__nav-item--active">
            <BoardIcon /> Board
          </span>
        </nav>
        {sidebarSections}
        <div className="sidebar__footer">
          <button
            className="btn-ghost"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace__header">
          <div className="workspace__title">
            <img src="/favicon.svg" alt="" className="workspace__logo" />
            <h1>Board</h1>
          </div>
          {phase === 'ready' && (
            <>
              <div className="search">
                <SearchIcon />
                <input
                  placeholder="Search tasks…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search tasks by title"
                />
              </div>
              <select
                className="select select--inline"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as Priority | '')}
                aria-label="Filter by priority"
              >
                <option value="">Priority: all</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
              <select
                className="select select--inline workspace__assignee-filter"
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                aria-label="Filter by assignee"
              >
                <option value="">Assignee: all</option>
                {data.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              {filtersActive && (
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setSearch('')
                    setPriorityFilter('')
                    setAssigneeFilter('')
                    setLabelFilter('')
                  }}
                >
                  <XIcon size={13} /> Clear
                </button>
              )}
              <div className="workspace__spacer" />
              <div className="workspace__mobile-actions">
                <button className="btn-ghost" onClick={() => setManageOpen('team')}>
                  <UsersIcon />
                </button>
                <button className="btn-ghost" onClick={() => setManageOpen('labels')}>
                  <TagIcon />
                </button>
              </div>
              <button className="btn-primary" onClick={() => setNewTaskStatus('todo')}>
                <PlusIcon size={14} /> New task
              </button>
            </>
          )}
        </header>

        {phase === 'loading' && <BoardSkeleton />}

        {phase === 'error' && (
          <div className="state-screen">
            <h2>Couldn’t load your board</h2>
            <p>{errorMsg}</p>
            <button className="btn-primary" onClick={reload}>
              Try again
            </button>
          </div>
        )}

        {phase === 'ready' &&
          (data.tasks.length === 0 && !filtersActive ? (
            <div className="state-screen">
              <h2>Your board is empty</h2>
              <p>
                Create your first task to get started. Drag cards between columns to track progress
                from To&nbsp;Do to Done.
              </p>
              <button className="btn-primary" onClick={() => setNewTaskStatus('todo')}>
                <PlusIcon size={14} /> Create a task
              </button>
            </div>
          ) : (
            <Board
              tasksByStatus={tasksByStatus}
              labelsFor={(id) => labelsByTask.get(id) ?? []}
              memberFor={(id) => (id ? (memberById.get(id) ?? null) : null)}
              onOpenTask={(t) => setOpenTaskId(t.id)}
              onAddTask={(status) => setNewTaskStatus(status)}
              filtered={filtersActive}
            />
          ))}
      </main>

      {newTaskStatus && (
        <NewTaskModal initialStatus={newTaskStatus} onClose={() => setNewTaskStatus(null)} />
      )}
      {openTask && <TaskDetailPanel task={openTask} onClose={() => setOpenTaskId(null)} />}
      {manageOpen && <ManageModal kind={manageOpen} onClose={() => setManageOpen(null)} />}

      {toast && (
        <div className={`toast${toast.kind === 'error' ? ' toast--error' : ''}`} role="alert">
          {toast.msg}
          <button onClick={dismissToast} aria-label="Dismiss">
            <XIcon size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

function BoardSkeleton() {
  return (
    <div className="board" aria-label="Loading board">
      {STATUSES.map((s) => (
        <div key={s} className="column" style={{ padding: 10, gap: 8 }}>
          <div className="skeleton" style={{ height: 18, width: '55%', marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 64 }} />
          <div className="skeleton" style={{ height: 84 }} />
          <div className="skeleton" style={{ height: 64, opacity: 0.6 }} />
        </div>
      ))}
    </div>
  )
}
