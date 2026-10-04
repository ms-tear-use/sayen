import { useEffect, useState } from 'react'
import Button from '../../components/Button'
import ErrorMessage from '../../components/ErrorMessage'
import Input from '../../components/Input'
import Modal from '../../components/Modal'
import { friendlyError } from '../../lib/errors'
import { isMissingSchema, schemaHint } from '../../lib/schema'
import { supabase } from '../../supabaseClient'
import { inferType, linkLabel } from '../space/events'
import { formatDateOnly } from '../space/dates'
import { journeyTitle } from './journey'

export default function JourneyEditor({ open, space, startKey, linkedId, updateSpace, onClose }) {
  const [milestones, setMilestones] = useState([])
  const [name, setName] = useState('')
  const [linkId, setLinkId] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    let active = true
    const timer = window.setTimeout(() => {
      setName(space.journey_name || '')
      setLinkId(linkedId || '')
      setDate(startKey || '')
      setFormError('')
      supabase
        .from('important_dates')
        .select('id, title, event_date, event_type, occurrence_date, emoji')
        .eq('space_id', space.id)
        .then((result) => {
          if (!active || result.error) return
          setMilestones((result.data || []).filter((item) => inferType(item) === 'milestone' && !item.occurrence_date))
        })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [open, space.id, space.journey_name, startKey, linkedId])

  const save = async (event) => {
    event.preventDefault()
    const chosen = milestones.find((item) => item.id === linkId)
    const started = String(chosen?.event_date || date || '').slice(0, 10)
    setSaving(true)
    setFormError('')
    try {
      await updateSpace({
        journey_name: name.trim(),
        journey_started_on: started || null,
        journey_date_id: chosen?.id || null,
      })
      onClose()
    } catch (saveError) {
      setFormError(isMissingSchema(saveError) ? schemaHint : friendlyError(saveError, "We couldn't save your journey."))
    } finally {
      setSaving(false)
    }
  }

  const chosen = milestones.find((item) => item.id === linkId)

  return (
    <Modal open={open} title="Your journey" className="modal--sheet" onClose={onClose}>
      <form className="stack-form" onSubmit={save}>
        <Input
          id="journey-name"
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          placeholder="Sayen"
        />
        <p className="muted journey-preview">{journeyTitle(name)}</p>
        <div className="field">
          <label className="field__label" htmlFor="journey-link">Started from</label>
          <select
            id="journey-link"
            className="input"
            value={linkId}
            onChange={(event) => setLinkId(event.target.value)}
          >
            <option value="">A date</option>
            {milestones.map((item) => (
              <option key={item.id} value={item.id}>{linkLabel(item)}</option>
            ))}
          </select>
        </div>
        {linkId ? (
          <p className="journey-caption">{formatDateOnly(chosen?.event_date) || 'This milestone has no date yet.'}</p>
        ) : (
          <Input
            id="journey-date"
            label="Date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        )}
        <ErrorMessage message={formError} />
        <Button type="submit" disabled={saving}>{saving ? 'Saving' : 'Save'}</Button>
      </form>
    </Modal>
  )
}
