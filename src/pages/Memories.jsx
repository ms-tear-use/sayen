import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import ErrorMessage from '../components/ErrorMessage'
import Input from '../components/Input'
import LoadingState from '../components/LoadingState'
import Modal from '../components/Modal'
import PersonName from '../components/PersonName'
import RequireSpace from '../components/RequireSpace'
import Textarea from '../components/Textarea'
import { useSpace } from '../features/auth/hooks'
import { formatDateOnly, formatMonthLabel, todayKey } from '../features/space/dates'
import { linkChoices, linkLabel } from '../features/space/events'
import { friendlyError } from '../lib/errors'
import { isMissingSchema, schemaHint } from '../lib/schema'
import { uploadImage } from '../lib/storage'
import { supabase } from '../supabaseClient'

function MemoryPhotos({ photos, alt, compact = false }) {
  const [index, setIndex] = useState(0)
  if (!photos.length) return null
  const current = photos[index] || photos[0]
  const many = photos.length > 1

  return (
    <div className={`memory-photos ${compact ? 'memory-photos--compact' : ''}`}>
      <img src={current} alt={alt} className="memory-card__image" />
      {many && (
        <div className="memory-photos__nav">
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => setIndex((currentIndex) => (currentIndex - 1 + photos.length) % photos.length)}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span>{index + 1} / {photos.length}</span>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => setIndex((currentIndex) => (currentIndex + 1) % photos.length)}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}

function MemoriesContent() {
  const { space, user, members } = useSpace()
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [milestones, setMilestones] = useState([])
  const [form, setForm] = useState({ title: '', date: todayKey(), caption: '', location: '', milestone_id: '' })
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [view, setView] = useState('card')

  const load = useCallback(async () => {
    let memoryQuery = await supabase
      .from('memories')
      .select('id, title, caption, location, date, image_url, user_id, created_at, milestone_id')
      .eq('space_id', space.id)
      .order('date', { ascending: false })
    if (memoryQuery.error && isMissingSchema(memoryQuery.error)) {
      memoryQuery = await supabase
        .from('memories')
        .select('id, title, caption, location, date, image_url, user_id, created_at')
        .eq('space_id', space.id)
        .order('date', { ascending: false })
    }
    const { data, error: loadError } = memoryQuery
    let milestoneQuery = await supabase.from('important_dates').select('id, title, event_type, emoji, occurrence_date').eq('space_id', space.id)
    if (!milestoneQuery.error) {
      setMilestones(linkChoices(milestoneQuery.data || []))
    }

    if (loadError) throw loadError
    const rows = data || []
    const photoResult = await supabase
      .from('memory_photos')
      .select('id, memory_id, image_url')
      .eq('space_id', space.id)
    const photos = photoResult.error && isMissingSchema(photoResult.error) ? [] : (photoResult.data || [])
    if (photoResult.error && !isMissingSchema(photoResult.error)) throw photoResult.error
    setMemories(rows.map((memory) => ({
      ...memory,
      photos: [
        ...(memory.image_url ? [memory.image_url] : []),
        ...photos.filter((photo) => photo.memory_id === memory.id).map((photo) => photo.image_url),
      ].filter((url, index, list) => list.indexOf(url) === index),
    })))
  }, [space.id])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      load()
        .catch((loadError) => {
          if (active) setError(friendlyError(loadError, "We couldn't load memories."))
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

  useEffect(() => () => {
    previews.forEach((url) => URL.revokeObjectURL(url))
  }, [previews])

  const resetForm = () => {
    setForm({ title: '', date: todayKey(), caption: '', location: '', milestone_id: '' })
    setFiles([])
    previews.forEach((url) => URL.revokeObjectURL(url))
    setPreviews([])
    setFormError('')
  }

  const close = () => {
    setOpen(false)
    resetForm()
  }

  const handleFiles = (event) => {
    const next = [...(event.target.files || [])]
    previews.forEach((url) => URL.revokeObjectURL(url))
    setFiles(next)
    setPreviews(next.map((file) => URL.createObjectURL(file)))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')

    try {
      const urls = []
      for (const file of files) {
        urls.push(await uploadImage('memories', `${space.id}/${crypto.randomUUID()}.jpg`, file))
      }

      let created = await supabase.from('memories').insert({
        space_id: space.id,
        user_id: user.id,
        title: form.title.trim(),
        caption: form.caption.trim() || null,
        location: form.location.trim() || null,
        date: form.date,
        image_url: urls[0] || null,
        milestone_id: form.milestone_id || null,
      }).select('id').single()
      if (created.error && isMissingSchema(created.error)) {
        created = await supabase.from('memories').insert({
          space_id: space.id,
          user_id: user.id,
          title: form.title.trim(),
          caption: form.caption.trim() || null,
          location: form.location.trim() || null,
          date: form.date,
          image_url: urls[0] || null,
        }).select('id').single()
        if (!created.error) setError(schemaHint)
      }
      const data = created.data
      const saveError = created.error

      if (saveError) throw saveError
      if (urls.length && data?.id) {
        const photoResult = await supabase.from('memory_photos').insert(
          urls.map((imageUrl) => ({ memory_id: data.id, space_id: space.id, image_url: imageUrl })),
        )
        if (photoResult.error && !isMissingSchema(photoResult.error)) throw photoResult.error
      }
      await load()
      close()
    } catch (saveError) {
      setFormError(friendlyError(saveError, "We couldn't save that memory."))
    } finally {
      setSaving(false)
    }
  }

  const groups = memories.reduce((map, memory) => {
    const key = memory.date ? memory.date.slice(0, 7) : 'undated'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(memory)
    return map
  }, new Map())

  return (
    <>
      <header className="page-header page-header--row">
        <div>
          <h2>Memories</h2>
          <p>Little moments worth keeping.</p>
        </div>
        <div className="memory-toolbar">
          <div className="memory-views" role="group" aria-label="Memory layout">
            <button type="button" aria-pressed={view === 'card'} aria-label="Card view" className={view === 'card' ? 'memory-views__on' : ''} onClick={() => setView('card')}>
              <LayoutGrid size={18} aria-hidden="true" />
            </button>
            <button type="button" aria-pressed={view === 'list'} aria-label="List view" className={view === 'list' ? 'memory-views__on' : ''} onClick={() => setView('list')}>
              <List size={18} aria-hidden="true" />
            </button>
          </div>
          <Button onClick={() => setOpen(true)}>Add a memory</Button>
        </div>
      </header>

      <ErrorMessage message={error} />
      {loading && <LoadingState compact message="Loading memories..." />}

      {!loading && memories.length === 0 && (
        <EmptyState
          title="No memories yet."
          description="Start saving little moments here."
          action={<Button onClick={() => setOpen(true)}>Add a memory</Button>}
        />
      )}

      {[...groups.entries()].map(([key, items]) => (
        <section key={key} className="memory-month space-panel">
          <h2>{key === 'undated' ? 'Undated' : formatMonthLabel(items[0].date)}</h2>
          <div className={`memory-list ${view === 'list' ? 'memory-list--rows' : 'memory-list--cards'}`}>
            {items.map((memory) => {
              const photos = memory.photos?.length ? memory.photos : (memory.image_url ? [memory.image_url] : [])
              return (
                <article key={memory.id} className={`memory-card ${view === 'list' ? 'memory-card--list' : ''}`}>
                  <MemoryPhotos photos={photos} alt={memory.caption || memory.title} compact={view === 'list'} />
                  <div>
                    <p className="memory-card__date">{formatDateOnly(memory.date)}</p>
                    <h3>{memory.title}</h3>
                    {memory.caption && <p>{memory.caption}</p>}
                    {memory.milestone_id && milestones.some((item) => item.id === memory.milestone_id) && (
                      <p className="memory-card__meta">{linkLabel(milestones.find((item) => item.id === memory.milestone_id))}</p>
                    )}
                    <p className="memory-card__meta">
                      Added by <PersonName members={members} userId={memory.user_id} currentUserId={user.id} />
                      {memory.location ? ` · ${memory.location}` : ''}
                    </p>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}

      <Modal open={open} title="New memory" onClose={close}>
        <form className="stack-form" onSubmit={handleSubmit}>
          <Input
            id="memory-title"
            label="Title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            required
          />
          <Input
            id="memory-date"
            label="Date"
            type="date"
            value={form.date}
            onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
            required
          />
          <Input
            id="memory-location"
            label="Location"
            value={form.location}
            onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
          />
          <Textarea
            id="memory-caption"
            label="Caption"
            rows={3}
            value={form.caption}
            onChange={(event) => setForm((current) => ({ ...current, caption: event.target.value }))}
          />
          <div className="field">
            <label className="field__label" htmlFor="memory-milestone">Link to</label>
            <select
              id="memory-milestone"
              className="input"
              value={form.milestone_id}
              onChange={(event) => setForm((current) => ({ ...current, milestone_id: event.target.value }))}
            >
              <option value="">None</option>
              {milestones.map((item) => (
                <option key={item.id} value={item.id}>{linkLabel(item)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="memory-photo">Photos</label>
            <input id="memory-photo" className="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={handleFiles} />
            {previews.length > 0 && (
              <div className="memory-strip">
                {previews.map((url) => <img key={url} src={url} alt="" />)}
              </div>
            )}
          </div>
          <ErrorMessage message={formError} />
          <Button type="submit" disabled={saving}>{saving ? 'saving...' : 'save memory'}</Button>
        </form>
      </Modal>
    </>
  )
}

export default function Memories({ embedded = false }) {
  if (embedded) return <MemoriesContent />
  return (
    <RequireSpace>
      <main className="page-shell">
        <MemoriesContent />
      </main>
    </RequireSpace>
  )
}
