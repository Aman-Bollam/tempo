import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import type { Activity, Comment, Priority, Status, Task } from '../lib/types'
import { STATUS_META, STATUSES } from '../lib/types'
import { initials, timeAgo } from '../lib/utils'
import { useBoard } from '../state/BoardContext'
import { ClockIcon, CommentIcon, TrashIcon, XIcon } from './Icons'

interface TaskDetailPanelProps {
  task: Task
  onClose: () => void
}

export function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const { data, updateTask, deleteTask, setTaskLabels } = useBoard()

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [activity, setActivity] = useState<Activity[] | null>(null)
  const [detailError, setDetailError] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const taskLabelIds = data.taskLabels.filter((tl) => tl.task_id === task.id).map((tl) => tl.label_id)

  const loadDetail = useCallback(async () => {
    setDetailError(false)
    try {
      const detail = await api.fetchTaskDetail(task.id)
      setComments(detail.comments)
      setActivity(detail.activity)
    } catch {
      setDetailError(true)
    }
  }, [task.id])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function commitTitle() {
    const trimmed = title.trim()
    if (!trimmed) {
      setTitle(task.title)
      return
    }
    if (trimmed !== task.title) void updateTask(task.id, { title: trimmed })
  }

  function commitDescription() {
    const trimmed = description.trim()
    const next = trimmed === '' ? null : trimmed
    if (next !== task.description) void updateTask(task.id, { description: next })
  }

  async function submitComment(e: FormEvent) {
    e.preventDefault()
    const body = commentDraft.trim()
    if (!body || postingComment) return
    setPostingComment(true)
    try {
      const comment = await api.addComment(task.id, body)
      setComments((c) => [...(c ?? []), comment])
      setCommentDraft('')
      void loadDetail()
    } catch {
      /* toast handled globally on next board action; keep draft so nothing is lost */
    } finally {
      setPostingComment(false)
    }
  }

  const memberName = (id: string | null) =>
    id ? (data.members.find((m) => m.id === id)?.name ?? 'someone') : null

  function activityText(a: Activity): string {
    switch (a.kind) {
      case 'created':
        return `Created in ${STATUS_META[(a.detail.status as Status) ?? 'todo'].label}`
      case 'status_changed':
        return `Moved from ${STATUS_META[(a.detail.from as Status) ?? 'todo'].label} → ${STATUS_META[(a.detail.to as Status) ?? 'todo'].label}`
      case 'assigned':
        return `Assigned to ${memberName(a.detail.assignee_id) ?? 'a teammate'}`
      case 'unassigned':
        return 'Unassigned'
      case 'edited':
        return 'Details edited'
      case 'commented':
        return 'Comment added'
    }
  }

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <aside className="panel" aria-label="Task details">
        <header className="panel__header">
          <span className="badge" style={{ background: 'var(--c-well)', color: 'var(--c-text-secondary)' }}>
            {STATUS_META[task.status].label}
          </span>
          <div className="topbar__spacer" />
          {confirmDelete ? (
            <span className="panel__confirm">
              Delete this task?
              <button
                className="btn-ghost btn-ghost--danger"
                onClick={() => {
                  void deleteTask(task.id).then(onClose).catch(() => {})
                }}
              >
                Delete
              </button>
              <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button
              className="btn-ghost btn-ghost--danger"
              onClick={() => setConfirmDelete(true)}
              aria-label="Delete task"
            >
              <TrashIcon />
            </button>
          )}
          <button className="btn-ghost" onClick={onClose} aria-label="Close panel">
            <XIcon />
          </button>
        </header>

        <div className="panel__body">
          <input
            className="panel__title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            maxLength={200}
            aria-label="Task title"
          />

          <div className="panel__props">
            <PanelProp label="Status">
              <select
                className="select"
                value={task.status}
                onChange={(e) => void updateTask(task.id, { status: e.target.value as Status })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </PanelProp>
            <PanelProp label="Priority">
              <select
                className="select"
                value={task.priority}
                onChange={(e) => void updateTask(task.id, { priority: e.target.value as Priority })}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </PanelProp>
            <PanelProp label="Due date">
              <input
                type="date"
                className="input"
                value={task.due_date ?? ''}
                onChange={(e) => void updateTask(task.id, { due_date: e.target.value || null })}
              />
            </PanelProp>
            <PanelProp label="Assignee">
              <select
                className="select"
                value={task.assignee_id ?? ''}
                onChange={(e) => void updateTask(task.id, { assignee_id: e.target.value || null })}
              >
                <option value="">Unassigned</option>
                {data.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </PanelProp>
          </div>

          {data.labels.length > 0 && (
            <div className="field">
              <label>Labels</label>
              <div className="label-picker">
                {data.labels.map((l) => {
                  const on = taskLabelIds.includes(l.id)
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
                        void setTaskLabels(
                          task.id,
                          on ? taskLabelIds.filter((id) => id !== l.id) : [...taskLabelIds, l.id],
                        ).catch(() => {})
                      }
                    >
                      {l.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="field">
            <label>Description</label>
            <textarea
              className="textarea"
              placeholder="Add a description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={commitDescription}
              maxLength={4000}
            />
          </div>

          <section className="panel__section">
            <h3>
              <CommentIcon size={13} /> Comments
            </h3>
            {detailError ? (
              <p className="panel__muted">
                Couldn’t load comments.{' '}
                <button className="panel__link" onClick={() => void loadDetail()}>
                  Retry
                </button>
              </p>
            ) : comments === null ? (
              <div className="skeleton" style={{ height: 48 }} />
            ) : comments.length === 0 ? (
              <p className="panel__muted">No comments yet.</p>
            ) : (
              <ul className="comment-list">
                {comments.map((c) => (
                  <li key={c.id} className="comment">
                    <span className="avatar" style={{ background: 'var(--c-accent)' }}>
                      {initials('You')}
                    </span>
                    <div>
                      <div className="comment__meta">
                        You · <time>{timeAgo(c.created_at)}</time>
                      </div>
                      <div className="comment__body">{c.body}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <form className="comment-form" onSubmit={submitComment}>
              <input
                className="input"
                placeholder="Write a comment…"
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                maxLength={2000}
              />
              <button className="btn-primary" disabled={!commentDraft.trim() || postingComment}>
                {postingComment ? '…' : 'Post'}
              </button>
            </form>
          </section>

          <section className="panel__section">
            <h3>
              <ClockIcon size={13} /> Activity
            </h3>
            {detailError ? (
              <p className="panel__muted">Couldn’t load activity.</p>
            ) : activity === null ? (
              <div className="skeleton" style={{ height: 48 }} />
            ) : activity.length === 0 ? (
              <p className="panel__muted">No activity yet.</p>
            ) : (
              <ul className="activity-list">
                {activity.map((a) => (
                  <li key={a.id} className="activity">
                    <span className="activity__dot" />
                    <span className="activity__text">{activityText(a)}</span>
                    <time className="activity__time">{timeAgo(a.created_at)}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </>
  )
}

function PanelProp({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}
