import { useEffect, useState, type FormEvent } from 'react'
import { LABEL_COLORS, MEMBER_COLORS, initials } from '../lib/utils'
import { useBoard } from '../state/BoardContext'
import { TrashIcon, XIcon } from './Icons'

interface ManageModalProps {
  kind: 'team' | 'labels'
  onClose: () => void
}

export function ManageModal({ kind, onClose }: ManageModalProps) {
  const { data, createMember, deleteMember, createLabel, deleteLabel } = useBoard()
  const palette = kind === 'team' ? MEMBER_COLORS : LABEL_COLORS
  const [name, setName] = useState('')
  const [color, setColor] = useState(palette[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const items = kind === 'team' ? data.members : data.labels

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      if (kind === 'team') await createMember(trimmed, color)
      else await createLabel(trimmed, color)
      setName('')
      setColor(palette[(palette.indexOf(color) + 1) % palette.length])
    } catch {
      /* toast shown by context */
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <header className="modal__header">
          <h2>{kind === 'team' ? 'Team members' : 'Labels'}</h2>
          <button className="btn-ghost" onClick={onClose} aria-label="Close">
            <XIcon />
          </button>
        </header>
        <div className="modal__body">
          <form className="manage-form" onSubmit={handleAdd}>
            <input
              className="input"
              placeholder={kind === 'team' ? 'Name, e.g. Priya Patel' : 'Label, e.g. Bug'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
            <div className="color-row" role="radiogroup" aria-label="Color">
              {palette.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  className={`color-swatch${color === c ? ' color-swatch--on' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <button className="btn-primary" disabled={!name.trim() || saving}>
              {saving ? 'Adding…' : 'Add'}
            </button>
          </form>

          {items.length === 0 ? (
            <p className="panel__muted" style={{ marginTop: 14 }}>
              {kind === 'team'
                ? 'No team members yet. Add people to assign tasks to them.'
                : 'No labels yet. Create labels like “Bug” or “Design” to organize tasks.'}
            </p>
          ) : (
            <ul className="manage-list">
              {items.map((item) => (
                <li key={item.id} className="manage-row">
                  {kind === 'team' ? (
                    <span className="avatar avatar--md" style={{ background: item.color }}>
                      {initials(item.name)}
                    </span>
                  ) : (
                    <span className="label-pill" style={{ background: item.color }}>
                      {item.name}
                    </span>
                  )}
                  {kind === 'team' && <span className="manage-row__name">{item.name}</span>}
                  <span className="topbar__spacer" />
                  <button
                    className="btn-ghost btn-ghost--danger"
                    onClick={() => {
                      void (kind === 'team' ? deleteMember(item.id) : deleteLabel(item.id)).catch(
                        () => {},
                      )
                    }}
                    aria-label={`Remove ${item.name}`}
                  >
                    <TrashIcon size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
