import Button from '../../components/Button'
import ErrorMessage from '../../components/ErrorMessage'
import Input from '../../components/Input'
import Textarea from '../../components/Textarea'
import { datePresets, defaultRecurrence } from './dates'

export default function DateForm({ form, setForm, onSubmit, saving, error }) {
  const chooseKind = (kind) => {
    setForm((current) => {
      const titleIsPreset = !current.title || datePresets.some((item) => item.toLowerCase() === current.title.toLowerCase())
      return {
        ...current,
        kind,
        title: kind === 'custom' ? (titleIsPreset ? '' : current.title) : (titleIsPreset ? kind : current.title),
        recurrence: titleIsPreset ? defaultRecurrence(kind) : current.recurrence,
      }
    })
  }

  return (
    <form className="stack-form" onSubmit={onSubmit}>
      <div className="field">
        <label className="field__label" htmlFor="date-kind">Kind</label>
        <select id="date-kind" className="input" value={form.kind} onChange={(event) => chooseKind(event.target.value)}>
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
        label="Note"
        rows={4}
        value={form.description}
        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
      />
      <div className="field">
        <label className="field__label" htmlFor="date-repeat">Repeats</label>
        <select
          id="date-repeat"
          className="input"
          value={form.recurrence || 'none'}
          onChange={(event) => setForm((current) => ({ ...current, recurrence: event.target.value }))}
        >
          <option value="none">None</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>
      <label className="goal-check">
        <input
          type="checkbox"
          checked={Boolean(form.reminder)}
          onChange={(event) => setForm((current) => ({ ...current, reminder: event.target.checked }))}
        />
        <span>Reminder</span>
      </label>
      <ErrorMessage message={error} />
      <Button type="submit" disabled={saving}>{saving ? 'saving...' : 'save date'}</Button>
    </form>
  )
}
