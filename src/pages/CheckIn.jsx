import { useCallback, useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import ErrorMessage from '../components/ErrorMessage'
import IconButton from '../components/IconButton'
import PersonName from '../components/PersonName'
import Modal from '../components/Modal'
import RequireSpace from '../components/RequireSpace'
import CheckInFields, { moodLabel, needLabel } from '../features/checkin/CheckInFields'
import { checkInValues, checkInWriteError } from '../features/checkin/payload'
import CheckInMedia, { checkInMedia } from '../features/checkin/CheckInMedia'
import CheckInTime from '../features/checkin/CheckInTime'
import { useSpace } from '../features/auth/hooks'
import { friendlyError } from '../lib/errors'
import { isMissingSchema } from '../lib/schema'
import { uploadCheckInMedia } from '../lib/storage'
import { supabase } from '../supabaseClient'

function CheckInContent() {
  const { space, members, user } = useSpace()
  const [title, setTitle] = useState('')
  const [mood, setMood] = useState('')
  const [message, setMessage] = useState('')
  const [need, setNeed] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [composing, setComposing] = useState(false)
  const [editing, setEditing] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editError, setEditError] = useState('')

  const load = useCallback(async () => {
    let result = await supabase
      .from('daily_checkins')
      .select('id, user_id, title, mood, message, need, created_at, media_url, media_kind')
      .eq('space_id', space.id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (result.error && isMissingSchema(result.error)) {
      result = await supabase
        .from('daily_checkins')
        .select('id, user_id, mood, message, need, created_at, media_url, media_kind')
        .eq('space_id', space.id)
        .order('created_at', { ascending: false })
        .limit(20)
    }
    if (result.error && isMissingSchema(result.error)) {
      result = await supabase
        .from('daily_checkins')
        .select('id, user_id, mood, message, need, created_at')
        .eq('space_id', space.id)
        .order('created_at', { ascending: false })
        .limit(20)
    }
    if (result.error) throw result.error
    setEntries(result.data || [])
  }, [space.id])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      load()
        .catch((loadError) => {
          if (active) setError(friendlyError(loadError, "We couldn't load check-ins."))
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

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const row = {
        space_id: space.id,
        user_id: user.id,
        ...checkInValues({ title, mood, need, message }),
      }
      if (file) {
        const media = await uploadCheckInMedia(space.id, file)
        row.media_url = media.url
        row.media_kind = media.kind
      }
      const { error: saveError } = await supabase.from('daily_checkins').insert(row)
      if (saveError) throw checkInWriteError(saveError)
      setTitle('')
      setMood('')
      setNeed('')
      setMessage('')
      clearNewMedia()
      setComposing(false)
      await load()
    } catch (saveError) {
      setError(friendlyError(saveError, "We couldn't save this check-in."))
    } finally {
      setSaving(false)
    }
  }

  const openComposer = () => {
    setTitle('')
    setMood('')
    setNeed('')
    setMessage('')
    clearNewMedia()
    setError('')
    setComposing(true)
  }

  const closeComposer = () => {
    clearNewMedia()
    setComposing(false)
  }

  const clearNewMedia = () => {
    if (preview?.local) URL.revokeObjectURL(preview.url)
    setFile(null)
    setPreview(null)
  }

  const pickNewMedia = (next) => {
    clearNewMedia()
    if (!next) return
    setFile(next)
    setPreview({
      url: URL.createObjectURL(next),
      kind: next.type.startsWith('video/') ? 'video' : 'photo',
      local: true,
    })
  }

  const startEdit = (entry) => {
    const media = checkInMedia(entry)
    setEditing({
      id: entry.id,
      title: entry.title || '',
      mood: entry.mood || '',
      need: entry.need || '',
      message: entry.message || '',
      mediaUrl: media?.url || '',
      mediaKind: media?.kind || '',
      file: null,
      preview: null,
      removeMedia: false,
    })
    setEditError('')
  }

  const pickEditMedia = (next) => {
    setEditing((current) => {
      if (current?.preview?.local) URL.revokeObjectURL(current.preview.url)
      if (!next) return { ...current, file: null, preview: null }
      return {
        ...current,
        file: next,
        removeMedia: false,
        preview: {
          url: URL.createObjectURL(next),
          kind: next.type.startsWith('video/') ? 'video' : 'photo',
          local: true,
        },
      }
    })
  }

  const saveEdit = async (event) => {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    setEditError('')
    try {
      const patch = checkInValues(editing)
      if (editing.file || editing.removeMedia) {
        if (editing.file) {
          const uploaded = await uploadCheckInMedia(space.id, editing.file)
          patch.media_url = uploaded.url
          patch.media_kind = uploaded.kind
        } else {
          patch.media_url = null
          patch.media_kind = null
        }
      }
      const { error: saveError } = await supabase
        .from('daily_checkins')
        .update(patch)
        .eq('id', editing.id)
        .eq('user_id', user.id)
      if (saveError) throw checkInWriteError(saveError)
      if (editing.preview?.local) URL.revokeObjectURL(editing.preview.url)
      setEditing(null)
      await load()
    } catch (saveError) {
      setEditError(friendlyError(saveError, "We couldn't update that check-in."))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    setError('')
    const { error: deleteError } = await supabase.from('daily_checkins').delete().eq('id', id).eq('user_id', user.id)
    if (deleteError) {
      setError(friendlyError(deleteError, "We couldn't delete that check-in."))
      return
    }
    setEntries((current) => current.filter((entry) => entry.id !== id))
    if (editing?.id === id) setEditing(null)
  }

  return (
    <main className="page-shell">
      <header className="page-header page-header--row">
        <div>
          <h1>Daily check-in</h1>
          <p>One field is enough.</p>
        </div>
        <button type="button" className="button button--secondary" onClick={openComposer}>Update</button>
      </header>

      {error && !composing && <ErrorMessage message={error} />}

      <section className="section-block" aria-label="recent check-ins">
        <h2>Recent</h2>
        {loading && <p className="muted">Loading check-ins...</p>}
        {!loading && entries.length === 0 && (
          <p className="muted">No check-ins yet.</p>
        )}
        <ul className="plain-list">
          {entries.map((entry) => {
            const own = entry.user_id === user.id
            return (
              <li key={entry.id} className="note-card">
                <div className="note-card__top">
                  <strong>
                    <PersonName members={members} userId={entry.user_id} currentUserId={user.id} />
                  </strong>
                  <CheckInTime members={members} currentUserId={user.id} at={entry.created_at} />
                </div>
                {entry.title && <p className="note-card__title">{entry.title}</p>}
                {(entry.mood || entry.need) && (
                  <p className="note-card__mood">
                    {[moodLabel(entry.mood), needLabel(entry.need)].filter(Boolean).join(' · ')}
                  </p>
                )}
                {entry.message && <p>{entry.message}</p>}
                <CheckInMedia entry={entry} />
                {own && (
                  <div className="me-block__actions">
                    <IconButton label="Edit" onClick={() => startEdit(entry)}><Pencil size={18} aria-hidden="true" /></IconButton>
                    <IconButton label="Delete" danger onClick={() => remove(entry.id)}><Trash2 size={18} aria-hidden="true" /></IconButton>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <Modal open={composing} title="Update check-in" onClose={closeComposer}>
        <CheckInFields
          idPrefix="new-checkin"
          title={title}
          setTitle={setTitle}
          mood={mood}
          setMood={setMood}
          need={need}
          setNeed={setNeed}
          message={message}
          setMessage={setMessage}
          onSubmit={handleSubmit}
          saving={saving}
          error={error}
          submitLabel={saving ? 'Saving' : 'Save check-in'}
          mediaPreview={preview}
          onMedia={pickNewMedia}
          onClearMedia={clearNewMedia}
        />
      </Modal>

      <Modal open={Boolean(editing)} title="Edit check-in" onClose={() => setEditing(null)}>
        {editing && (
          <CheckInFields
            idPrefix="edit-checkin"
            title={editing.title}
            setTitle={(value) => setEditing((current) => ({ ...current, title: value }))}
            mood={editing.mood}
            setMood={(value) => setEditing((current) => ({ ...current, mood: value }))}
            need={editing.need}
            setNeed={(value) => setEditing((current) => ({ ...current, need: value }))}
            message={editing.message}
            setMessage={(value) => setEditing((current) => ({ ...current, message: value }))}
            onSubmit={saveEdit}
            saving={saving}
            error={editError}
            submitLabel={saving ? 'Saving' : 'Save changes'}
            mediaPreview={editing.preview || (!editing.removeMedia && editing.mediaUrl ? { url: editing.mediaUrl, kind: editing.mediaKind || 'photo' } : null)}
            onMedia={pickEditMedia}
            onClearMedia={() => setEditing((current) => {
              if (current?.preview?.local) URL.revokeObjectURL(current.preview.url)
              return { ...current, file: null, preview: null, removeMedia: true, mediaUrl: '', mediaKind: '' }
            })}
          />
        )}
      </Modal>
    </main>
  )
}

export default function CheckIn() {
  return (
    <RequireSpace>
      <CheckInContent />
    </RequireSpace>
  )
}
