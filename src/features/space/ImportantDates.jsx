import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import Button from '../../components/Button'
import IconButton from '../../components/IconButton'
import ErrorMessage from '../../components/ErrorMessage'
import Input from '../../components/Input'
import Modal from '../../components/Modal'
import Textarea from '../../components/Textarea'
import { datePresets, formatDateOnly, isYearly, todayKey, upcomingLabel } from './dates'

function emptyForm() {
  return { id: null, kind: 'Birthday', title: 'Birthday', event_date: todayKey(), description: '' }
}

export default function ImportantDates({ dates, onSave, onDelete }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const startCreate = () => {
    setForm(emptyForm())
    setError('')
    setOpen(true)
  }

  const startEdit = (date) => {
    const preset = datePresets.find((item) => item.toLowerCase() === date.title?.toLowerCase()) || 'custom'
    setForm({
      id: date.id,
      kind: preset,
      title: date.title || '',
      event_date: date.event_date?.slice(0, 10) || '',
      description: date.description || '',
    })
    setError('')
    setOpen(true)
  }

  const chooseKind = (kind) => {
    setForm((current) => {
      const titleIsPreset = !current.title || datePresets.some((item) => item.toLowerCase() === current.title.toLowerCase())
      return {
        ...current,
        kind,
        title: kind === 'custom' ? (titleIsPreset ? '' : current.title) : (titleIsPreset ? kind : current.title),
      }
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({
        id: form.id,
        title: form.title.trim(),
        event_date: form.event_date,
        description: form.description.trim(),
      })
      setOpen(false)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  const sorted = [...dates].sort((a, b) => String(a.event_date || '').localeCompare(String(b.event_date || '')))

  return (
    <section className="section-block">
      <div className="page-header--row">
        <h2>Important dates</h2>
        <div className="row-actions">
          <Link to="/calendar" className="text-button">calendar</Link>
          <Button type="button" onClick={startCreate}>Add a date</Button>
        </div>
      </div>

      {sorted.length === 0 && (
        <div className="empty-state">
          <p>No important dates yet.</p>
          <Button type="button" onClick={startCreate}>Add a date</Button>
        </div>
      )}

      <ul className="plain-list">
        {sorted.map((date) => {
          const label = upcomingLabel(date.event_date, date.title)
          return (
            <li key={date.id} className="list-card">
              <div>
                <strong>{date.title}</strong>
                <p className="muted">
                  {formatDateOnly(date.event_date)}
                  {label ? ` · ${label}` : ''}
                  {isYearly(date.title) ? ' · each year' : ''}
                </p>
                {date.description && <p>{date.description}</p>}
              </div>
              <div className="row-actions">
                <IconButton label="Edit" onClick={() => startEdit(date)}><Pencil size={18} aria-hidden="true" /></IconButton>
                <IconButton label="Delete" danger onClick={() => onDelete(date.id)}><Trash2 size={18} aria-hidden="true" /></IconButton>
              </div>
            </li>
          )
        })}
      </ul>

      <Modal open={open} title={form.id ? 'Edit date' : 'New date'} onClose={() => setOpen(false)}>
        <form className="stack-form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="field__label" htmlFor="date-kind">Kind</label>
            <select
              id="date-kind"
              className="input"
              value={form.kind}
              onChange={(event) => chooseKind(event.target.value)}
            >
              {datePresets.map((preset) => (
                <option key={preset} value={preset}>{preset}</option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </div>
          <Input
            id="date-title"
            label="Title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            required
          />
          <Input
            id="date-day"
            label="Date"
            type="date"
            value={form.event_date}
            onChange={(event) => setForm((current) => ({ ...current, event_date: event.target.value }))}
            required
          />
          <Textarea
            id="date-description"
            label="Description"
            rows={3}
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
          <ErrorMessage message={error} />
          <Button type="submit" disabled={saving}>{saving ? 'saving...' : 'save date'}</Button>
        </form>
      </Modal>
    </section>
  )
}
