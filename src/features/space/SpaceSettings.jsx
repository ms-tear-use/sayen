import { useState } from 'react'
import AccentSelector from '../../components/AccentSelector'
import Button from '../../components/Button'
import ErrorMessage from '../../components/ErrorMessage'
import Input from '../../components/Input'
import ThemeSelector from '../../components/ThemeSelector'
import { friendlyError } from '../../lib/errors'
import { normalizeAccent } from '../../lib/theme'

export default function SpaceSettings({ space, onUpdate }) {
  const [name, setName] = useState(space.name || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const saveTheme = async (patch) => {
    setError('')
    setStatus('')
    try {
      await onUpdate(patch)
      setStatus('saved')
    } catch (saveError) {
      setError(friendlyError(saveError, "We couldn't update the space."))
    }
  }

  const saveName = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setStatus('')
    try {
      await onUpdate({ name: name.trim() })
      setStatus('saved')
    } catch (saveError) {
      setError(friendlyError(saveError, "We couldn't update the space."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-stack">
      <section className="space-panel">
        <h2>Name</h2>
        <form className="stack-form" onSubmit={saveName}>
          <Input
            id="space-name"
            label="Space name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={60}
          />
          <ErrorMessage message={error} />
          {status && <p className="muted" role="status">{status}</p>}
          <Button type="submit" disabled={saving}>{saving ? 'Saving' : 'Save name'}</Button>
        </form>
      </section>
      <section className="space-panel">
        <h2>Look</h2>
        <div className="stack-form">
          <div className="field">
            <span className="field__label">Space theme</span>
            <ThemeSelector
              mode={space.space_theme_mode || 'system'}
              onChange={(mode) => saveTheme({ space_theme_mode: mode })}
            />
          </div>
          <div className="field">
            <span className="field__label">Accent color</span>
            <AccentSelector
              value={space.space_accent_color || 'purple'}
              onChange={(accent) => saveTheme({ space_accent_color: normalizeAccent(accent) })}
            />
          </div>
          <p className="muted">This theme is for Home and Our Space. Me keeps your own theme.</p>
        </div>
      </section>
    </div>
  )
}
