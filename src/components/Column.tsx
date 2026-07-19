import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Label, Status, Task, TeamMember } from '../lib/types'
import { STATUS_META } from '../lib/types'
import { PlusIcon } from './Icons'
import { SortableTaskCard } from './TaskCard'

interface ColumnProps {
  status: Status
  tasks: Task[]
  labelsFor: (taskId: string) => Label[]
  memberFor: (memberId: string | null) => TeamMember | null
  onOpenTask: (task: Task) => void
  onAddTask: (status: Status) => void
  filtered: boolean
}

export function Column({
  status,
  tasks,
  labelsFor,
  memberFor,
  onOpenTask,
  onAddTask,
  filtered,
}: ColumnProps) {
  const meta = STATUS_META[status]
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { type: 'column', status } })

  return (
    <section className={`column${isOver ? ' column--over' : ''}`} aria-label={meta.label}>
      <header className="column__header">
        <span className="column__dot" style={{ background: meta.color }} />
        <h2 className="column__title">{meta.label}</h2>
        <span className="column__count">{tasks.length}</span>
        <button
          className="column__add"
          onClick={() => onAddTask(status)}
          aria-label={`Add task to ${meta.label}`}
        >
          <PlusIcon size={15} />
        </button>
      </header>
      <div className="column__body" ref={setNodeRef}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              labels={labelsFor(task.id)}
              assignee={memberFor(task.assignee_id)}
              onOpen={onOpenTask}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="column__empty">
            {filtered ? 'No matching tasks' : 'Drop tasks here, or press + to add one'}
          </div>
        )}
      </div>
    </section>
  )
}
