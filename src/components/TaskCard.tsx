import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Label, Task, TeamMember } from '../lib/types'
import { PRIORITY_META } from '../lib/types'
import { dueState, formatDue, initials } from '../lib/utils'
import { CalendarIcon } from './Icons'

interface TaskCardProps {
  task: Task
  labels: Label[]
  assignee: TeamMember | null
  onOpen: (task: Task) => void
  overlay?: boolean
}

export function TaskCardInner({ task, labels, assignee, onOpen, overlay }: TaskCardProps) {
  const due = dueState(task)
  return (
    <div
      className={[
        'card',
        task.status === 'done' ? 'card--done' : '',
        overlay ? 'card--overlay' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onOpen(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(task)
        }
      }}
    >
      {labels.length > 0 && (
        <div className="card__labels">
          {labels.map((l) => (
            <span key={l.id} className="label-pill" style={{ background: l.color }}>
              {l.name}
            </span>
          ))}
        </div>
      )}
      <div className="card__title">{task.title}</div>
      <div className="card__meta">
        {task.priority !== 'normal' && (
          <span className={`badge badge--priority-${task.priority}`}>
            {PRIORITY_META[task.priority].label}
          </span>
        )}
        {task.due_date && due && (
          <span
            className={`badge badge--due${due !== 'later' ? ` badge--due-${due === 'done' ? 'done' : due === 'overdue' ? 'overdue' : 'soon'}` : ''}`}
          >
            <CalendarIcon />
            {formatDue(task.due_date)}
          </span>
        )}
        <span className="card__meta-spacer" />
        {assignee && (
          <span className="avatar" style={{ background: assignee.color }} title={assignee.name}>
            {initials(assignee.name)}
          </span>
        )}
      </div>
    </div>
  )
}

export function SortableTaskCard(props: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
    data: { type: 'task', status: props.task.status },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'card--dragging' : undefined}
      {...attributes}
      {...listeners}
    >
      <TaskCardInner {...props} />
    </div>
  )
}
