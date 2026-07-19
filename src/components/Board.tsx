import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useState } from 'react'
import type { Label, Status, Task, TeamMember } from '../lib/types'
import { STATUSES } from '../lib/types'
import { useBoard } from '../state/BoardContext'
import { Column } from './Column'
import { TaskCardInner } from './TaskCard'

interface BoardProps {
  tasksByStatus: Record<Status, Task[]>
  labelsFor: (taskId: string) => Label[]
  memberFor: (memberId: string | null) => TeamMember | null
  onOpenTask: (task: Task) => void
  onAddTask: (status: Status) => void
  filtered: boolean
}

/* closestCorners alone misses drops on tall empty columns (their corners
   are far from the pointer even when it's inside them), so prefer whatever
   droppable actually contains the pointer. */
const collisionDetection: CollisionDetection = (args) => {
  const withinPointer = pointerWithin(args)
  return withinPointer.length > 0 ? withinPointer : closestCorners(args)
}

export function Board({
  tasksByStatus,
  labelsFor,
  memberFor,
  onOpenTask,
  onAddTask,
  filtered,
}: BoardProps) {
  const { moveTask, data } = useBoard()
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    const task = data.tasks.find((t) => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const overId = String(over.id)
    if (STATUSES.includes(overId as Status)) {
      // Dropped on a column body: append to the end of that column.
      moveTask(String(active.id), overId as Status, null)
      return
    }
    // Dropped on a task: insert before it, in that task's column.
    const overTask = data.tasks.find((t) => t.id === overId)
    if (overTask) moveTask(String(active.id), overTask.status, overTask.id)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="board">
        {STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            labelsFor={labelsFor}
            memberFor={memberFor}
            onOpenTask={onOpenTask}
            onAddTask={onAddTask}
            filtered={filtered}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <TaskCardInner
            task={activeTask}
            labels={labelsFor(activeTask.id)}
            assignee={memberFor(activeTask.assignee_id)}
            onOpen={() => {}}
            overlay
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}
