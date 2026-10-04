import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import Button from '../../components/Button'
import IconButton from '../../components/IconButton'
import EmojiPicker from '../../components/EmojiPicker'
import ErrorMessage from '../../components/ErrorMessage'
import Input from '../../components/Input'
import Modal from '../../components/Modal'
import { emojiFor, splitEmoji, withEmoji } from '../../lib/emoji'
import { formatClock } from '../../lib/timezone'
import { dayLabels, dayList, scheduleDays } from './days'

const empty = { id: null, title: '', emoji: '', days: [1, 2, 3, 4, 5], starts_at: '09:00', ends_at: '17:30' }

function clockValue(value) {
  return String(value || '').slice(0, 5)
}

export default function MySchedule({ blocks, onSave, onDelete, heading = true }) {
  const [form, setForm] = useState(empty)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleDay = (day) => {
    setForm((current) => {
      const days = scheduleDays(current.days)
      const next = days.includes(day)
        ? days.filter((item) => item !== day)
        : [...days, day].sort((a, b) => a - b)
      return { ...current, days: next }
    })
  }

  const startCreate = () => {
    setForm(empty)
    setError('')
    setOpen(true)
  }

  const startEdit = (block) => {
    const parsed = splitEmoji(block.title)
    setForm({
      id: block.id,
      title: parsed.label || block.title,
      emoji: parsed.emoji,
      days: scheduleDays(block.days),
      starts_at: clockValue(block.starts_at),
      ends_at: clockValue(block.ends_at),
    })
    setError('')
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    setForm(empty)
    setError('')
  }

  const usePreset = async (preset) => {
    setSaving(true)
    setError('')
    try {
      await onSave({
        id: null,
        title: withEmoji(preset.emoji, preset.title),
        days: preset.days,
        starts_at: preset.starts_at,
        ends_at: preset.ends_at,
      })
      close()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!scheduleDays(form.days).length) {
      setError('Choose at least one day.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({
        id: form.id,
        title: withEmoji(form.emoji, form.title.trim()),
        days: scheduleDays(form.days),
        starts_at: form.starts_at,
        ends_at: form.ends_at,
      })
      close()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    await onDelete(id)
    if (form.id === id) close()
  }

  return (
    <section className="home-card" aria-label="My schedule">
      <div className="page-header--row">
        {heading && <h2>My schedule</h2>}
        {!open && (
          <button type="button" className={`home-card__action${heading ? '' : ' home-card__action--end'}`} onClick={startCreate}>Add</button>
        )}
      </div>
      <p className="muted">Weekly hours in your timezone. The emoji for the current block shows on your photo at Home.</p>

      {blocks.length === 0 && !open && (
        <p className="muted">No hours yet.</p>
      )}

      <ul className="me-blocks">
        {blocks.map((block) => {
          const shown = emojiFor(block.title)
          return (
            <li key={block.id} className="me-block">
              <span className="me-block__mark" aria-hidden="true">{shown.emoji || '⏰'}</span>
              <div>
                <strong>{shown.label}</strong>
                <p className="muted">
                  {dayList(block.days)}
                  {' · '}
                  {formatClock(block.starts_at)}–{formatClock(block.ends_at)}
                </p>
              </div>
              <div className="me-block__actions">
                <IconButton label="Edit" onClick={() => startEdit(block)}><Pencil size={18} aria-hidden="true" /></IconButton>
                <IconButton label="Delete" danger onClick={() => remove(block.id)}><Trash2 size={18} aria-hidden="true" /></IconButton>
              </div>
            </li>
          )
        })}
      </ul>

      {!open && (
        <div className="choice-row">
          <button type="button" className="choice" disabled={saving} onClick={() => usePreset({ title: 'Work', emoji: '💼', days: [1, 2, 3, 4, 5], starts_at: '09:00', ends_at: '17:30' })}>Add work, weekdays</button>
          <button type="button" className="choice" disabled={saving} onClick={() => usePreset({ title: 'Lunch', emoji: '🍽️', days: [1, 2, 3, 4, 5], starts_at: '12:00', ends_at: '13:00' })}>Add lunch, weekdays</button>
        </div>
      )}

      <Modal open={open} title={form.id ? 'Edit hours' : 'New hours'} onClose={close}>
        <form className="stack-form me-schedule-form" onSubmit={submit}>
          <EmojiPicker value={form.emoji} onChange={(emoji) => setForm((current) => ({ ...current, emoji }))} />
          <Input
            id="schedule-title"
            label="Title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Work"
            required
          />
          <div className="field">
            <span className="field__label">Days</span>
            <div className="choice-row">
              {dayLabels.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  className={`choice ${scheduleDays(form.days).includes(index) ? 'choice--active' : ''}`}
                  aria-pressed={scheduleDays(form.days).includes(index)}
                  onClick={() => toggleDay(index)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="me-times">
            <Input id="schedule-start" label="Starts" type="time" value={form.starts_at} onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))} required />
            <Input id="schedule-end" label="Ends" type="time" value={form.ends_at} onChange={(event) => setForm((current) => ({ ...current, ends_at: event.target.value }))} required />
          </div>
          <ErrorMessage message={error} />
          <div className="me-form-actions">
            <Button type="submit" disabled={saving}>{saving ? 'Saving' : form.id ? 'Save changes' : 'Add to schedule'}</Button>
            <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </section>
  )
}
