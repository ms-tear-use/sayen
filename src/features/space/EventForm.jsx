import { useState } from 'react'
import { EmojiDialog } from '../../components/EmojiPicker'
import Button from '../../components/Button'
import ErrorMessage from '../../components/ErrorMessage'
import Input from '../../components/Input'
import Textarea from '../../components/Textarea'
import { dayChoices, defaultEmoji, emojiOptions, eventTypes, linkLabel, reminderOptions } from './events'

const milestoneRepeat = [
  ['none', 'Does not repeat'],
  ['monthly', 'Every month'],
  ['yearly', 'Every year'],
  ['custom', 'Custom'],
]

const importantRepeat = [
  ['none', 'Does not repeat'],
  ['daily', 'Every day'],
  ['weekly', 'Every week'],
  ['monthly', 'Every month'],
  ['yearly', 'Every year'],
  ['custom', 'Custom'],
]

function recentEmojiKey(userId) {
  return `sayen-recent-emojis:${userId || 'local'}`
}

function readRecentEmojis(userId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(recentEmojiKey(userId)) || '[]')
    if (!Array.isArray(parsed)) return []
    return [...new Set(parsed.filter((item) => typeof item === 'string' && item))].slice(0, 4)
  } catch {
    return []
  }
}

function saveRecentEmoji(userId, emoji) {
  const next = [emoji, ...readRecentEmojis(userId).filter((item) => item !== emoji)].slice(0, 4)
  localStorage.setItem(recentEmojiKey(userId), JSON.stringify(next))
  return next
}

function EmojiChoices({ choices, value, userId, onChange }) {
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState(() => readRecentEmojis(userId))

  const remember = (emoji) => {
    setRecent(saveRecentEmoji(userId, emoji))
    onChange(emoji)
  }

  return (
    <div className="field emoji-picker-block">
      {recent.length > 0 && (
        <div>
          <span className="emoji-picker-label">Recently used</span>
          <div className="emoji-choices" role="group" aria-label="Recently used">
            {recent.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`emoji-choice ${value === emoji ? 'emoji-choice--on' : ''}`}
                aria-pressed={value === emoji}
                onClick={() => remember(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <span className="emoji-picker-label">Suggestions</span>
        <div className="emoji-choices" role="group" aria-label="Suggestions">
          {choices.slice(0, 5).map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={`emoji-choice ${value === emoji ? 'emoji-choice--on' : ''}`}
              aria-pressed={value === emoji}
              onClick={() => onChange(emoji)}
            >
              {emoji}
            </button>
          ))}
          <button type="button" className="emoji-choice" aria-label="Choose your own emoji" onClick={() => setOpen(true)}>+</button>
        </div>
      </div>
      <EmojiDialog open={open} recent={recent} onClose={() => setOpen(false)} onPick={remember} />
    </div>
  )
}

export default function EventForm({ initial, links = [], userId, saving, error, onSubmit }) {
  const [form, setForm] = useState(initial)
  const [photos, setPhotos] = useState(initial.photos || [])
  const type = form.event_type
  const repeats = type === 'milestone' ? milestoneRepeat : type === 'important' ? importantRepeat : []

  const patch = (next) => setForm((current) => ({ ...current, ...next }))

  const chooseType = (eventType) => {
    patch({
      event_type: eventType,
      emoji: defaultEmoji(eventType),
      recurrence: eventType === 'birthday' ? 'yearly' : (eventType === 'memory' ? 'none' : (form.recurrence || 'none')),
      reminder_when: eventType === 'memory' ? 'none' : (eventType === 'important' ? (form.reminder_when || 'none') : (form.reminder_when && form.reminder_when !== 'none' ? form.reminder_when : '1d')),
      count_years: eventType === 'milestone' ? Boolean(form.count_years) : false,
      count_months: eventType === 'milestone' ? Boolean(form.count_months) : false,
    })
  }

  const addPhotos = (event) => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    setPhotos((current) => [
      ...current,
      ...files.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) })),
    ])
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const person = String(form.person_name || '').trim()
    onSubmit({
      ...form,
      person_name: person,
      title: type === 'birthday' ? `${person}'s birthday` : form.title.trim(),
      emoji: form.emoji || defaultEmoji(type),
      reminder_when: type === 'memory' ? 'none' : (form.reminder_when || 'none'),
      recurrence: type === 'birthday' ? 'yearly' : (type === 'memory' ? 'none' : (form.recurrence || 'none')),
      photos,
    })
  }

  return (
    <form className="stack-form event-form" onSubmit={handleSubmit}>
      <div className="field">
        <span className="field__label">Event type</span>
        <div className="event-types">
          {eventTypes.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`event-type ${type === item.id ? 'event-type--on' : ''}`}
              aria-pressed={type === item.id}
              onClick={() => chooseType(item.id)}
            >
              <span className="event-type__name">{item.label}</span>
              <span className="event-type__desc">{item.description}</span>
            </button>
          ))}
        </div>
      </div>

      <EmojiChoices
        choices={emojiOptions(type)}
        value={form.emoji || defaultEmoji(type)}
        userId={userId}
        onChange={(emoji) => patch({ emoji })}
      />

      {type === 'birthday' ? (
        <Input
          id="event-person"
          label="Whose birthday"
          value={form.person_name || ''}
          onChange={(event) => patch({ person_name: event.target.value })}
          required
          maxLength={80}
          placeholder="Ayen, Mom, a pet"
        />
      ) : (
        <Input
          id="event-title"
          label="Title"
          value={form.title}
          onChange={(event) => patch({ title: event.target.value })}
          required
          maxLength={80}
        />
      )}

      {(type === 'memory' || type === 'important') && (
        <Textarea
          id="event-note"
          label={type === 'memory' ? 'Caption' : 'Note'}
          rows={4}
          value={type === 'memory' ? form.caption : form.description}
          onChange={(event) => patch(type === 'memory' ? { caption: event.target.value } : { description: event.target.value })}
          placeholder={type === 'memory' ? 'A little note about this day' : 'Add a note'}
        />
      )}

      <Input
        id="event-date"
        label={type === 'birthday' ? 'Birth date' : type === 'milestone' ? 'Original date' : 'Date'}
        type="date"
        value={form.event_date}
        onChange={(event) => patch({ event_date: event.target.value })}
        required
      />

      {type === 'important' && (
        <div className="field">
          <div className="event-time-line">
            <label className="field__label" htmlFor="event-start">Time</label>
            {form.start_time && <span className="event-view__hint">Your partner sees this in their own timezone.</span>}
          </div>
          <input
            id="event-start"
            className="input"
            type="time"
            value={form.start_time || ''}
            onChange={(event) => patch({ start_time: event.target.value })}
          />
        </div>
      )}

      {type === 'memory' && (
        <Input
          id="event-place"
          label="Location"
          value={form.location}
          onChange={(event) => patch({ location: event.target.value })}
        />
      )}

      {type === 'birthday' && <p className="event-fixed">Repeat · Every year</p>}

      {repeats.length > 0 && (
        <div className="field">
          <label className="field__label" htmlFor="event-repeat">Repeat</label>
          <select
            id="event-repeat"
            className="input"
            value={form.recurrence || 'none'}
            onChange={(event) => patch({ recurrence: event.target.value })}
          >
            {repeats.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
      )}

      {form.recurrence === 'custom' && type !== 'memory' && type !== 'birthday' && (
        <div className="event-days" role="group" aria-label="Days">
          {dayChoices.map((day, index) => {
            const on = form.recurrence_days.includes(day.id)
            return (
              <button
                key={`${day.id}-${index}`}
                type="button"
                className={`event-day ${on ? 'event-day--on' : ''}`}
                aria-pressed={on}
                onClick={() => patch({
                  recurrence_days: on
                    ? form.recurrence_days.filter((value) => value !== day.id)
                    : [...form.recurrence_days, day.id],
                })}
              >
                {day.label}
              </button>
            )
          })}
        </div>
      )}

      {type === 'milestone' && (
        <div className="event-counts">
          <label className="goal-check">
            <input
              type="checkbox"
              checked={Boolean(form.count_years)}
              onChange={(event) => patch({ count_years: event.target.checked })}
            />
            <span>Count years</span>
          </label>
          <label className="goal-check">
            <input
              type="checkbox"
              checked={Boolean(form.count_months)}
              onChange={(event) => patch({ count_months: event.target.checked })}
            />
            <span>Count months</span>
          </label>
          <p className="muted">Counts appear on later dates, like 2nd Year or 12th Month.</p>
        </div>
      )}

      {type !== 'memory' && (
        <div className="field">
          <label className="field__label" htmlFor="event-reminder">Reminder</label>
          <select
            id="event-reminder"
            className="input"
            value={form.reminder_when || 'none'}
            onChange={(event) => patch({ reminder_when: event.target.value })}
          >
            {reminderOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>
      )}

      {type !== 'memory' && type !== 'important' && (
        <Textarea
          id="event-note"
          label="Note"
          rows={4}
          value={form.description}
          onChange={(event) => patch({ description: event.target.value })}
          placeholder="Add a note"
        />
      )}

      {type === 'memory' && (
        <div className="field">
          <label className="field__label" htmlFor="event-milestone">Link to</label>
          <select
            id="event-milestone"
            className="input"
            value={form.milestone_id || ''}
            onChange={(event) => patch({ milestone_id: event.target.value })}
          >
            <option value="">None</option>
            {links.map((item) => (
              <option key={item.id} value={item.id}>{linkLabel(item)}</option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <span className="field__label">Photos</span>
        <div className="event-photos">
          {photos.filter((photo) => !photo.removed).map((photo) => (
            <figure key={photo.id}>
              <img src={photo.url} alt="" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setPhotos((current) => current.map((item) => (item.id === photo.id ? { ...item, removed: true } : item)))}
              >
                ×
              </button>
            </figure>
          ))}
          <label className="event-photos__add">
            +
            <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={addPhotos} />
          </label>
        </div>
      </div>

      <ErrorMessage message={error} />
      <Button type="submit" disabled={saving}>{saving ? 'Saving' : 'Save'}</Button>
    </form>
  )
}
