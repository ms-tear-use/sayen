import { useState } from 'react'
import { Heart, Pencil, Trash2 } from 'lucide-react'
import Button from '../../components/Button'
import IconButton from '../../components/IconButton'
import ErrorMessage from '../../components/ErrorMessage'
import Input from '../../components/Input'
import Modal from '../../components/Modal'

const ideas = ['Places to visit', 'Movies to watch', 'Things to do', 'Things to buy', 'Future plans']

export default function GoalBoard({ goals, onSave, onToggle, onDelete }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ id: null, title: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const openNew = (title = '') => {
    setForm({ id: null, title })
    setError('')
    setOpen(true)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({ id: form.id, title: form.title.trim() })
      setOpen(false)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  const openGoals = goals.filter((goal) => !goal.complete)
  const doneGoals = goals.filter((goal) => goal.complete)

  return (
    <section className="section-block">
      <header className="goal-page">
        <h2>
          <Heart size={18} aria-hidden="true" />
          Shared Goals
        </h2>
        <Button type="button" className="goal-create" onClick={() => openNew()}>+ Add</Button>
      </header>
      <p className="muted">Places to visit, movies to watch, things to do, things to buy, future plans.</p>

      {goals.length === 0 && (
        <div className="empty-state">
          <p>Nothing on the list yet.</p>
          <Button type="button" onClick={() => openNew()}>Add something</Button>
        </div>
      )}

      <ul className="plain-list">
        {[...openGoals, ...doneGoals].map((goal) => (
          <li key={goal.id} className="list-card">
            <label className="goal-check">
              <input
                type="checkbox"
                checked={goal.complete}
                onChange={() => onToggle(goal)}
              />
              <span className={goal.complete ? 'goal-check__done' : ''}>{goal.title}</span>
            </label>
            <div className="row-actions">
              <IconButton
                label="Edit"
                onClick={() => {
                  setForm({ id: goal.id, title: goal.title })
                  setError('')
                  setOpen(true)
                }}
              >
                <Pencil size={18} aria-hidden="true" />
              </IconButton>
              <IconButton label="Delete" danger onClick={() => onDelete(goal.id)}><Trash2 size={18} aria-hidden="true" /></IconButton>
            </div>
          </li>
        ))}
      </ul>

      <div className="choice-row">
        {ideas.map((idea) => (
          <button key={idea} type="button" className="choice" onClick={() => openNew(idea)}>
            {idea}
          </button>
        ))}
      </div>

      <Modal open={open} title={form.id ? 'Edit goal' : 'New goal'} onClose={() => setOpen(false)}>
        <form className="stack-form" onSubmit={handleSubmit}>
          <Input
            id="goal-title"
            label="Title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            required
          />
          <ErrorMessage message={error} />
          <Button type="submit" disabled={saving}>{saving ? 'saving...' : 'save'}</Button>
        </form>
      </Modal>
    </section>
  )
}
