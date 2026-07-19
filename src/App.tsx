import { useMemo, useState } from 'react'
import { Board } from './components/Board'
import { SearchIcon, PlusIcon, TagIcon, UsersIcon, XIcon } from './components/Icons'
import { ManageModal } from './components/ManageModal'
import { NewTaskModal } from './components/NewTaskModal'
import { TaskDetailPanel } from './components/TaskDetailPanel'
import type { Label, Priority, Status, Task, TeamMember } from './lib/types'
import { STATUSES } from './lib/types'
import { isOverdue, initials } from './lib/utils'
import { useBoard } from './state/BoardContext'

export default function App() {
  const { phase, errorMsg, data, reload, toast, dismissToast } = useBoard()

  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [labelFilter, setLabelFilter] = useState('')

  const [newTaskStatus, setNewTaskStatus] = useState<Status | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)
  const [manageOpen, setManageOpen] = useState<'team' | 'labels' | null>(null)

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

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__brand">
          <img src="/favicon.svg" alt="" className="topbar__logo" />
          Tempo
        </div>
        <div className="topbar__spacer" />
        <div className="topbar__stats" aria-label="Board summary">
          <span className="stat-chip">
            <strong>{stats.total}</strong> tasks
          </span>
          <span className="stat-chip">
            <strong>{stats.done}</strong> done
          </span>
          {stats.overdue > 0 && (
            <span className="stat-chip stat-chip--overdue">
              <strong>{stats.overdue}</strong> overdue
            </span>
          )}
        </div>
        <div className="avatar-stack" aria-label="Team">
          {data.members.slice(0, 5).map((m) => (
            <span key={m.id} className="avatar" style={{ background: m.color }} title={m.name}>
              {initials(m.name)}
            </span>
          ))}
        </div>
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

      {phase === 'ready' && (
        <>
          <div className="toolbar">
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
              className="select select--inline"
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
            <select
              className="select select--inline"
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              aria-label="Filter by label"
            >
              <option value="">Label: all</option>
              {data.labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
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
            <div className="topbar__spacer" />
            <button className="btn-ghost" onClick={() => setManageOpen('team')}>
              <UsersIcon /> Team
            </button>
            <button className="btn-ghost" onClick={() => setManageOpen('labels')}>
              <TagIcon /> Labels
            </button>
            <button className="btn-primary" onClick={() => setNewTaskStatus('todo')}>
              <PlusIcon size={14} /> New task
            </button>
          </div>

          {data.tasks.length === 0 && !filtersActive ? (
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
          )}
        </>
      )}

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
    <div className="board" aria-label="Loading board" style={{ marginTop: 58 }}>
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
