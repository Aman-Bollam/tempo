import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Status } from '../lib/types'
import { STATUS_META, STATUSES } from '../lib/types'
import { useBoard } from '../state/BoardContext'
import { XIcon } from './Icons'

interface NewTaskModalProps {
  initialStatus: Status
  onClose: () => void
}

export function NewTaskModal({ initialStatus, onClose }: NewTaskModalProps) {
  const { data, createTask, setTaskLabels } = useBoard()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<Status>(initialStatus)
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal')
  const [dueDate, setDueDate] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      const task = await createTask({
        title: trimmed,
        status,
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
        assignee_id: assigneeId || null,
      })
      if (labelIds.length > 0) await setTaskLabels(task.id, labelIds)
      onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={handleSubmit}>
        <header className="modal__header">
          <h2>New task</h2>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close">
            <XIcon />
          </button>
        </header>
        <div className="modal__body">
          <div className="field">
            <label htmlFor="nt-title">Title</label>
            <input
              id="nt-title"
              ref={titleRef}
              className="input"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="nt-desc">Description</label>
            <textarea
              id="nt-desc"
              className="textarea"
              placeholder="Add more detail… (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={4000}
            />
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="nt-status">Column</label>
              <select
                id="nt-status"
                className="select"
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="nt-priority">Priority</label>
              <select
                id="nt-priority"
                className="select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'low' | 'normal' | 'high')}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="nt-due">Due date</label>
              <input
                id="nt-due"
                type="date"
                className="input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="nt-assignee">Assignee</label>
              <select
                id="nt-assignee"
                className="select"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {data.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {data.labels.length > 0 && (
            <div className="field">
              <label>Labels</label>
              <div className="label-picker">
                {data.labels.map((l) => {
                  const on = labelIds.includes(l.id)
                  return (
                    <button
                      key={l.id}
                      type="button"
                      className="label-pill label-pill--pick"
                      style={{
                        background: on ? l.color : 'transparent',
                        color: on ? '#fff' : l.color,
                        borderColor: l.color,
                      }}
                      onClick={() =>
                        setLabelIds((ids) =>
                          on ? ids.filter((id) => id !== l.id) : [...ids, l.id],
                        )
                      }
                    >
                      {l.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <footer className="modal__footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={!title.trim() || saving}>
            {saving ? 'Creating…' : 'Create task'}
          </button>
        </footer>
      </form>
    </div>
  )
}
