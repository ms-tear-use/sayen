import { useCallback, useEffect, useState } from 'react'
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
import { isLocked, letterSuggestions, normalizeLetter } from '../features/openWhen/letters'
import { formatMoment } from '../lib/timezone'
import { friendlyError } from '../lib/errors'
import { supabase } from '../supabaseClient'

function LetterBody({ letter }) {
  if (letter.contentType === 'photo' && letter.mediaUrl) {
    return <img src={letter.mediaUrl} alt="" className="letter-media" />
  }
  if (letter.contentType === 'voice' && letter.mediaUrl) {
    return <audio controls src={letter.mediaUrl} />
  }
  if (letter.contentType === 'video' && letter.mediaUrl) {
    return <video controls src={letter.mediaUrl} className="letter-media" />
  }
  if (letter.contentType !== 'text' && !letter.message) {
    return <p>This kind of letter isn't ready to open yet.</p>
  }
  return <p className="letter-body">{letter.message}</p>
}

function OpenWhenContent() {
  const { space, user, members } = useSpace()
  const [letters, setLetters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [active, setActive] = useState(null)
  const [title, setTitle] = useState(letterSuggestions[0])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('open_when_letters')
      .select('*')
      .eq('space_id', space.id)
      .order('created_at', { ascending: false })

    if (loadError) throw loadError
    setLetters((data || []).map(normalizeLetter))
  }, [space.id])

  useEffect(() => {
    let activeRequest = true
    const timer = window.setTimeout(() => {
      load()
        .catch((loadError) => {
          if (activeRequest) setError(friendlyError(loadError, "We couldn't load letters."))
        })
        .finally(() => {
          if (activeRequest) setLoading(false)
        })
    }, 0)
    return () => {
      activeRequest = false
      window.clearTimeout(timer)
    }
  }, [load])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')

    try {
      const { error: saveError } = await supabase.from('open_when_letters').insert({
        space_id: space.id,
        user_id: user.id,
        title: title.trim(),
        message: message.trim(),
      })
      if (saveError) throw saveError
      setMessage('')
      setComposerOpen(false)
      await load()
    } catch (saveError) {
      setFormError(friendlyError(saveError, "We couldn't save this letter."))
    } finally {
      setSaving(false)
    }
  }

  const locked = active ? isLocked(active, user.id) : false

  return (
    <main className="page-shell">
      <header className="page-header page-header--row">
        <div>
          <h1>Open when</h1>
          <p>A small note for a later moment.</p>
        </div>
        <Button onClick={() => setComposerOpen(true)}>Write one</Button>
      </header>

      <ErrorMessage message={error} />
      {loading && <LoadingState compact message="Loading letters..." />}

      {!loading && letters.length === 0 && (
        <EmptyState
          title="No letters yet."
          description="Leave one for a moment that's coming."
          action={<Button onClick={() => setComposerOpen(true)}>Write one</Button>}
        />
      )}

      <ul className="plain-list">
        {letters.map((letter) => (
          <li key={letter.id}>
            <button type="button" className="letter-card" onClick={() => setActive(letter)}>
              <span className="letter-card__title">{letter.title}</span>
              <span className="letter-card__meta">
                <PersonName members={members} userId={letter.user_id} currentUserId={user.id} />
                {' · '}
                {formatMoment(letter.created_at)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Modal open={Boolean(active)} title={active?.title || 'Letter'} onClose={() => setActive(null)}>
        {active && (
          <div className="letter-open">
            <p className="muted">
              <PersonName members={members} userId={active.user_id} currentUserId={user.id} />
              {' · '}
              {formatMoment(active.created_at)}
            </p>
            {locked ? (
              <p>This one opens later.</p>
            ) : (
              <LetterBody letter={active} />
            )}
          </div>
        )}
      </Modal>

      <Modal open={composerOpen} title="New letter" onClose={() => setComposerOpen(false)}>
        <form className="stack-form" onSubmit={handleSubmit}>
          <Input id="letter-title" label="Title" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <div className="choice-row">
            {letterSuggestions.map((suggestion) => (
              <button key={suggestion} type="button" className="choice" onClick={() => setTitle(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
          <Textarea
            id="letter-message"
            label="Message"
            rows={6}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
          />
          <ErrorMessage message={formError} />
          <Button type="submit" disabled={saving}>{saving ? 'saving...' : 'save letter'}</Button>
        </form>
      </Modal>
    </main>
  )
}

export default function OpenWhen() {
  return (
    <RequireSpace>
      <OpenWhenContent />
    </RequireSpace>
  )
}
