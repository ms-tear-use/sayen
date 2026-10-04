import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Heart, MoreHorizontal } from 'lucide-react'
import Button from '../../components/Button'
import ErrorMessage from '../../components/ErrorMessage'
import Input from '../../components/Input'
import Modal from '../../components/Modal'
import PersonName from '../../components/PersonName'
import { formatDateOnly, todayKey } from '../space/dates'

function blankForm() {
  const today = todayKey()
  return { id: null, name: '', target_date: today, completed_on: today, complete: false }
}

function GoalMenu({ label, children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="goal-menu" ref={ref}>
      <button
        type="button"
        className="goal-menu__button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="goal-menu__list" role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}

function Progress({ done, total }) {
  const width = total ? Math.round((done / total) * 100) : 0
  return (
    <span className="goal-progress" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total || 0}>
      <span style={{ width: `${width}%` }} />
    </span>
  )
}

export default function GoalTree({
  categories,
  subcategories,
  goals,
  members = [],
  currentUserId,
  onSaveCategory,
  onDeleteCategory,
  onSaveSubcategory,
  onDeleteSubcategory,
  onSaveGoal,
  onToggleGoal,
  onDeleteGoal,
}) {
  const [openCategories, setOpenCategories] = useState(() => new Set())
  const [openSubs, setOpenSubs] = useState(() => new Set())
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(blankForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleSet = (setter, id) => {
    setter((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openModal = (kind, parentId, record = null) => {
    setForm(record ? {
      id: record.id,
      name: record.name || record.title || '',
      target_date: record.target_date?.slice(0, 10) || '',
      completed_on: record.completed_on?.slice(0, 10) || '',
      complete: Boolean(record.complete),
    } : blankForm())
    setError('')
    setModal({ kind, parentId })
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const complete = Boolean(form.complete)
    const completedOn = complete ? (form.completed_on || todayKey()) : null
    try {
      if (modal.kind === 'category') {
        await onSaveCategory({ id: form.id, name: form.name.trim() })
      } else if (modal.kind === 'subcategory') {
        await onSaveSubcategory({
          id: form.id,
          category_id: modal.parentId,
          name: form.name.trim(),
          target_date: form.target_date || null,
          completed_on: completedOn,
          complete,
        })
      } else {
        await onSaveGoal({
          id: form.id,
          subcategory_id: modal.parentId,
          title: form.name.trim(),
          target_date: form.target_date || null,
          completed_on: completedOn,
          complete,
        })
      }
      setModal(null)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  const loose = goals.filter((goal) => !goal.subcategory_id)

  return (
    <div className="goal-tree">
      <header className="goal-page">
        <h2>
          <Heart size={18} aria-hidden="true" />
          Shared Goals
        </h2>
        <Button type="button" className="goal-create" onClick={() => openModal('category', null)}>+ New Category</Button>
      </header>

      {categories.map((category) => {
        const subs = subcategories.filter((item) => item.category_id === category.id)
        const categoryGoals = goals.filter((goal) => subs.some((sub) => sub.id === goal.subcategory_id))
        const done = categoryGoals.filter((goal) => goal.complete).length
        const open = openCategories.has(category.id)
        return (
          <section key={category.id} className={`goal-card ${open ? 'goal-card--open' : ''}`}>
            <div className="goal-head">
              <button type="button" className="goal-toggle" aria-expanded={open} onClick={() => toggleSet(setOpenCategories, category.id)}>
                <span className="goal-head__copy">
                  <span className="goal-head__title">{category.name}</span>
                  <span className="goal-head__count">{done} of {categoryGoals.length} completed</span>
                  <Progress done={done} total={categoryGoals.length} />
                </span>
                <ChevronDown size={18} className="goal-chevron" aria-hidden="true" />
              </button>
              <GoalMenu label={`Actions for ${category.name}`}>
                <button type="button" role="menuitem" onClick={() => openModal('category', null, category)}>Edit</button>
                <button type="button" role="menuitem" className="goal-menu__danger" onClick={() => onDeleteCategory(category.id)}>Delete</button>
              </GoalMenu>
            </div>
            {open && (
              <div className="goal-nest-list">
                {subs.map((sub) => {
                  const items = goals.filter((goal) => goal.subcategory_id === sub.id)
                  const subDone = items.filter((goal) => goal.complete).length
                  const subOpen = openSubs.has(sub.id)
                  return (
                    <div key={sub.id} className={`goal-nest ${sub.complete ? 'goal-nest--done' : ''}`}>
                      <div className="goal-head">
                        <button type="button" className="goal-toggle" aria-expanded={subOpen} onClick={() => toggleSet(setOpenSubs, sub.id)}>
                          <span className="goal-head__copy">
                            <span className="goal-head__title">{sub.name}</span>
                            <span className="goal-head__meta">
                              <span className="goal-head__count">{subDone} of {items.length} completed</span>
                              {sub.target_date && <span className="goal-pill">{formatDateOnly(sub.target_date)}</span>}
                            </span>
                            <Progress done={subDone} total={items.length} />
                          </span>
                          <ChevronDown size={16} className="goal-chevron" aria-hidden="true" />
                        </button>
                        <GoalMenu label={`Actions for ${sub.name}`}>
                          <button type="button" role="menuitem" onClick={() => openModal('subcategory', category.id, sub)}>Edit</button>
                          <button type="button" role="menuitem" className="goal-menu__danger" onClick={() => onDeleteSubcategory(sub.id)}>Delete</button>
                        </GoalMenu>
                      </div>
                      {subOpen && (
                        <div className="goal-items">
                          {items.map((goal) => (
                            <div key={goal.id} className="goal-line">
                              <label className="goal-check">
                                <input type="checkbox" checked={goal.complete} onChange={() => onToggleGoal(goal)} />
                                <span className={goal.complete ? 'goal-check__done' : ''}>{goal.title}</span>
                              </label>
                              <div className="goal-line__side">
                                {goal.target_date && <span className="goal-pill">{formatDateOnly(goal.target_date)}</span>}
                                <GoalMenu label={`Actions for ${goal.title}`}>
                                  <button type="button" role="menuitem" onClick={() => openModal('goal', sub.id, goal)}>Edit</button>
                                  <button type="button" role="menuitem" className="goal-menu__danger" onClick={() => onDeleteGoal(goal.id)}>Delete</button>
                                </GoalMenu>
                              </div>
                              <p className="goal-line__note">
                                {goal.completed_on ? `Completed ${formatDateOnly(goal.completed_on)} · ` : ''}
                                Added by <PersonName members={members} userId={goal.user_id} currentUserId={currentUserId} />
                              </p>
                            </div>
                          ))}
                          {items.length === 0 && <p className="muted">Nothing here yet.</p>}
                          <button type="button" className="text-button" onClick={() => openModal('goal', sub.id)}>Add goal</button>
                        </div>
                      )}
                    </div>
                  )
                })}
                {subs.length === 0 && <p className="muted">No subcategories yet.</p>}
                <button type="button" className="text-button" onClick={() => openModal('subcategory', category.id)}>Add subcategory</button>
              </div>
            )}
          </section>
        )
      })}

      {loose.length > 0 && (
        <section className="goal-card">
          <h3 className="goal-saved">Saved earlier</h3>
          {loose.map((goal) => (
            <div key={goal.id} className="goal-line">
              <label className="goal-check">
                <input type="checkbox" checked={goal.complete} onChange={() => onToggleGoal(goal)} />
                <span className={goal.complete ? 'goal-check__done' : ''}>{goal.title}</span>
              </label>
              <GoalMenu label={`Actions for ${goal.title}`}>
                <button type="button" role="menuitem" className="goal-menu__danger" onClick={() => onDeleteGoal(goal.id)}>Delete</button>
              </GoalMenu>
              <p className="goal-line__note">
                Added by <PersonName members={members} userId={goal.user_id} currentUserId={currentUserId} />
              </p>
            </div>
          ))}
        </section>
      )}

      <Modal
        open={Boolean(modal)}
        title={modal ? `${form.id ? 'Edit' : 'Add'} ${modal.kind}` : ''}
        onClose={() => setModal(null)}
      >
        <form className="stack-form" onSubmit={submit}>
          <Input
            id="goal-name"
            label={modal?.kind === 'goal' ? 'Goal' : 'Name'}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          {modal?.kind !== 'category' && (
            <>
              <Input
                id="goal-target"
                label="Target date"
                type="date"
                value={form.target_date}
                onChange={(event) => setForm((current) => ({ ...current, target_date: event.target.value }))}
              />
              <Input
                id="goal-done"
                label="Date completed"
                type="date"
                value={form.completed_on}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  completed_on: event.target.value,
                  complete: event.target.value ? true : current.complete,
                }))}
              />
              <label className="goal-check">
                <input
                  type="checkbox"
                  checked={form.complete}
                  onChange={(event) => setForm((current) => ({ ...current, complete: event.target.checked }))}
                />
                <span>Completed</span>
              </label>
            </>
          )}
          <ErrorMessage message={error} />
          <Button type="submit" disabled={saving}>{saving ? 'Saving' : 'Save'}</Button>
        </form>
      </Modal>
    </div>
  )
}
