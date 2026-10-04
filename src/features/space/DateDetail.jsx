import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import ErrorMessage from '../../components/ErrorMessage'
import IconButton from '../../components/IconButton'
import LoadingState from '../../components/LoadingState'
import Modal from '../../components/Modal'
import { useSpace } from '../auth/hooks'
import { friendlyError } from '../../lib/errors'
import { isMissingSchema, schemaHint } from '../../lib/schema'
import { uploadImage } from '../../lib/storage'
import { supabase } from '../../supabaseClient'
import DateForm from './DateForm'
import { celebrationLabel, datePresets, formatDateOnly, nextOccurrence, recurrenceOf, todayKey } from './dates'

const emptyForm = {
  id: null,
  kind: 'custom',
  title: '',
  event_date: '',
  description: '',
  recurrence: 'none',
  reminder: false,
}

export default function DateDetail() {
  const { dateId } = useParams()
  const navigate = useNavigate()
  const { space } = useSpace()
  const [date, setDate] = useState(null)
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    let result = await supabase
      .from('important_dates')
      .select('id, title, event_date, description, recurrence, reminder')
      .eq('id', dateId)
      .eq('space_id', space.id)
      .maybeSingle()

    if (result.error && isMissingSchema(result.error)) {
      result = await supabase
        .from('important_dates')
        .select('id, title, event_date, description')
        .eq('id', dateId)
        .eq('space_id', space.id)
        .maybeSingle()
    }

    if (result.error) throw result.error
    setDate(result.data)

    const photoResult = await supabase
      .from('important_date_photos')
      .select('id, image_url')
      .eq('date_id', dateId)
      .order('created_at', { ascending: true })

    if (photoResult.error && !isMissingSchema(photoResult.error)) throw photoResult.error
    setPhotos(photoResult.data || [])
  }, [dateId, space.id])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      load()
        .catch((loadError) => {
          if (active) setError(friendlyError(loadError, "We couldn't open that date."))
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [load])

  const startEdit = () => {
    if (!date) return
    const preset = datePresets.find((item) => item.toLowerCase() === date.title?.toLowerCase()) || 'custom'
    setForm({
      id: date.id,
      kind: preset,
      title: date.title || '',
      event_date: date.event_date?.slice(0, 10) || todayKey(),
      description: date.description || '',
      recurrence: recurrenceOf(date),
      reminder: Boolean(date.reminder),
    })
    setFormError('')
    setOpen(true)
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    const payload = {
      title: form.title.trim(),
      event_date: form.event_date,
      description: form.description.trim() || null,
      recurrence: form.recurrence || 'none',
      reminder: Boolean(form.reminder),
    }
    let result = await supabase.from('important_dates').update(payload).eq('id', date.id).eq('space_id', space.id)
    if (result.error && isMissingSchema(result.error)) {
      result = await supabase.from('important_dates').update({
        title: payload.title,
        event_date: payload.event_date,
        description: payload.description,
      }).eq('id', date.id).eq('space_id', space.id)
      if (!result.error) setFormError(schemaHint)
    }
    if (result.error) {
      setFormError(friendlyError(result.error, "We couldn't save that date."))
      setSaving(false)
      return
    }
    try {
      await load()
      if (!result.error) setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    const { error: deleteError } = await supabase
      .from('important_dates')
      .delete()
      .eq('id', date.id)
      .eq('space_id', space.id)
    if (deleteError) {
      setError(friendlyError(deleteError, "We couldn't delete that date."))
      return
    }
    navigate('/space/calendar')
  }

  const addPhotos = async (event) => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    if (!files.length || !date) return
    setUploading(true)
    setError('')
    try {
      const rows = []
      for (const file of files) {
        const imageUrl = await uploadImage('memories', `${space.id}/dates/${crypto.randomUUID()}.jpg`, file)
        rows.push({ date_id: date.id, space_id: space.id, image_url: imageUrl })
      }
      const { error: saveError } = await supabase.from('important_date_photos').insert(rows)
      if (saveError) throw saveError
      await load()
    } catch (uploadError) {
      setError(isMissingSchema(uploadError) ? schemaHint : friendlyError(uploadError, "We couldn't add that photo."))
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = async (id) => {
    const { error: deleteError } = await supabase
      .from('important_date_photos')
      .delete()
      .eq('id', id)
      .eq('space_id', space.id)
    if (deleteError) {
      setError(friendlyError(deleteError, "We couldn't remove that photo."))
      return
    }
    setPhotos((current) => current.filter((photo) => photo.id !== id))
  }

  useEffect(() => {
    if (!date?.id) return
    navigate(`/space/calendar?date=${String(date.event_date || '').slice(0, 10)}&event=${date.id}`, { replace: true })
  }, [date, navigate])

  if (loading) return <LoadingState compact message="Opening this date..." />
  if (!date) return <ErrorMessage message={error || "We couldn't find that date."} />

  const repeats = recurrenceOf(date)
  const next = nextOccurrence(date.event_date, repeats, new Date())
  const heading = celebrationLabel(date, next, space.name)

  return (
    <article className="date-detail">
      <Link to="/space/calendar" className="text-button">back to calendar</Link>
      <p className="date-detail__when">{formatDateOnly(date.event_date)}</p>
      <h2>{heading}</h2>
      <ErrorMessage message={error} />

      <div className="date-detail__photos">
        {photos.map((photo) => (
          <figure key={photo.id}>
            <img src={photo.image_url} alt="" />
            <IconButton label="Remove photo" danger onClick={() => removePhoto(photo.id)}><Trash2 size={18} aria-hidden="true" /></IconButton>
          </figure>
        ))}
        <label className="date-detail__add">
          {uploading ? 'adding...' : '+'}
          <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={addPhotos} disabled={uploading} />
        </label>
      </div>

      {date.description && <p className="letter-body">{date.description}</p>}
      <p className="muted">Reminder: {date.reminder ? 'Yes' : 'No'}</p>
      <p className="muted">Repeats: {repeats === 'none' ? 'None' : repeats}</p>

      <div className="row-actions">
        <IconButton label="Edit" onClick={startEdit}><Pencil size={18} aria-hidden="true" /></IconButton>
        <IconButton label="Delete" danger onClick={remove}><Trash2 size={18} aria-hidden="true" /></IconButton>
      </div>

      <Modal open={open} title="Edit date" onClose={() => setOpen(false)}>
        <DateForm form={form} setForm={setForm} onSubmit={save} saving={saving} error={formError} />
      </Modal>
    </article>
  )
}
