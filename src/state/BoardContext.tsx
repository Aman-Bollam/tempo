/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../lib/api'
import type { BoardData, Label, NewTask, Status, Task, TaskPatch, TeamMember } from '../lib/types'

type Phase = 'loading' | 'error' | 'ready'

interface BoardContextValue {
  phase: Phase
  errorMsg: string | null
  data: BoardData
  toast: { msg: string; kind: 'info' | 'error' } | null
  dismissToast: () => void
  reload: () => void
  createTask: (input: NewTask) => Promise<Task>
  updateTask: (id: string, patch: TaskPatch) => Promise<void>
  moveTask: (id: string, status: Status, beforeTaskId: string | null) => void
  deleteTask: (id: string) => Promise<void>
  createMember: (name: string, color: string) => Promise<TeamMember>
  deleteMember: (id: string) => Promise<void>
  createLabel: (name: string, color: string) => Promise<Label>
  deleteLabel: (id: string) => Promise<void>
  setTaskLabels: (taskId: string, labelIds: string[]) => Promise<void>
}

const EMPTY: BoardData = { tasks: [], members: [], labels: [], taskLabels: [] }

const BoardContext = createContext<BoardContextValue | null>(null)

export function useBoard(): BoardContextValue {
  const ctx = useContext(BoardContext)
  if (!ctx) throw new Error('useBoard must be used inside BoardProvider')
  return ctx
}

export function BoardProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [data, setData] = useState<BoardData>(EMPTY)
  const [toast, setToast] = useState<BoardContextValue['toast']>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const showToast = useCallback((msg: string, kind: 'info' | 'error' = 'error') => {
    clearTimeout(toastTimer.current)
    setToast({ msg, kind })
    toastTimer.current = setTimeout(() => setToast(null), 4500)
  }, [])

  const dismissToast = useCallback(() => {
    clearTimeout(toastTimer.current)
    setToast(null)
  }, [])

  const load = useCallback(async () => {
    setPhase('loading')
    setErrorMsg(null)
    try {
      await api.signIn()
      setData(await api.fetchBoard())
      setPhase('ready')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Run a mutation optimistically: apply `optimistic` now, roll back to the
   *  prior snapshot and toast if `commit` rejects. */
  const mutate = useCallback(
    async (optimistic: (d: BoardData) => BoardData, commit: () => Promise<void>) => {
      let snapshot: BoardData = EMPTY
      setData((d) => {
        snapshot = d
        return optimistic(d)
      })
      try {
        await commit()
      } catch (err) {
        setData(snapshot)
        showToast(err instanceof Error ? err.message : 'Change failed — reverted')
        throw err
      }
    },
    [showToast],
  )

  const createTask = useCallback(
    async (input: NewTask) => {
      const columnTasks = data.tasks.filter((t) => t.status === input.status)
      const sortOrder =
        columnTasks.length === 0 ? 1000 : Math.max(...columnTasks.map((t) => t.sort_order)) + 1000
      try {
        const task = await api.createTask(input, sortOrder)
        setData((d) => ({ ...d, tasks: [...d.tasks, task] }))
        return task
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not create task')
        throw err
      }
    },
    [data.tasks, showToast],
  )

  const updateTask = useCallback(
    async (id: string, patch: TaskPatch) => {
      const prev = data.tasks.find((t) => t.id === id)
      if (!prev) return
      await mutate(
        (d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
        async () => {
          const saved = await api.updateTask(id, patch, prev)
          setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? saved : t)) }))
        },
      )
    },
    [data.tasks, mutate],
  )

  /** Drop a task into `status`, ordered before `beforeTaskId` (or at the end). */
  const moveTask = useCallback(
    (id: string, status: Status, beforeTaskId: string | null) => {
      const task = data.tasks.find((t) => t.id === id)
      if (!task) return
      const column = data.tasks
        .filter((t) => t.status === status && t.id !== id)
        .sort((a, b) => a.sort_order - b.sort_order)

      let sortOrder: number
      if (column.length === 0) {
        sortOrder = 1000
      } else if (beforeTaskId === null) {
        sortOrder = column[column.length - 1].sort_order + 1000
      } else {
        const idx = column.findIndex((t) => t.id === beforeTaskId)
        if (idx === -1) {
          sortOrder = column[column.length - 1].sort_order + 1000
        } else if (idx === 0) {
          sortOrder = column[0].sort_order / 2
        } else {
          sortOrder = (column[idx - 1].sort_order + column[idx].sort_order) / 2
        }
      }

      if (task.status === status && task.sort_order === sortOrder) return
      void updateTask(id, { status, sort_order: sortOrder }).catch(() => {})
    },
    [data.tasks, updateTask],
  )

  const deleteTask = useCallback(
    (id: string) =>
      mutate(
        (d) => ({
          ...d,
          tasks: d.tasks.filter((t) => t.id !== id),
          taskLabels: d.taskLabels.filter((tl) => tl.task_id !== id),
        }),
        () => api.deleteTask(id),
      ),
    [mutate],
  )

  const createMember = useCallback(
    async (name: string, color: string) => {
      try {
        const member = await api.createMember(name, color)
        setData((d) => ({ ...d, members: [...d.members, member] }))
        return member
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not add member')
        throw err
      }
    },
    [showToast],
  )

  const deleteMember = useCallback(
    (id: string) =>
      mutate(
        (d) => ({
          ...d,
          members: d.members.filter((m) => m.id !== id),
          tasks: d.tasks.map((t) => (t.assignee_id === id ? { ...t, assignee_id: null } : t)),
        }),
        () => api.deleteMember(id),
      ),
    [mutate],
  )

  const createLabel = useCallback(
    async (name: string, color: string) => {
      try {
        const label = await api.createLabel(name, color)
        setData((d) => ({ ...d, labels: [...d.labels, label] }))
        return label
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not create label')
        throw err
      }
    },
    [showToast],
  )

  const deleteLabel = useCallback(
    (id: string) =>
      mutate(
        (d) => ({
          ...d,
          labels: d.labels.filter((l) => l.id !== id),
          taskLabels: d.taskLabels.filter((tl) => tl.label_id !== id),
        }),
        () => api.deleteLabel(id),
      ),
    [mutate],
  )

  const setTaskLabels = useCallback(
    (taskId: string, labelIds: string[]) =>
      mutate(
        (d) => ({
          ...d,
          taskLabels: [
            ...d.taskLabels.filter((tl) => tl.task_id !== taskId),
            ...labelIds.map((label_id) => ({ task_id: taskId, label_id })),
          ],
        }),
        () => api.setTaskLabels(taskId, labelIds),
      ),
    [mutate],
  )

  return (
    <BoardContext.Provider
      value={{
        phase,
        errorMsg,
        data,
        toast,
        dismissToast,
        reload: () => void load(),
        createTask,
        updateTask,
        moveTask,
        deleteTask,
        createMember,
        deleteMember,
        createLabel,
        deleteLabel,
        setTaskLabels,
      }}
    >
      {children}
    </BoardContext.Provider>
  )
}
