import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, SquarePen } from 'lucide-react'
import AccentSelector from '../components/AccentSelector'
import Avatar from '../components/Avatar'
import Button from '../components/Button'
import ErrorMessage from '../components/ErrorMessage'
import IconButton from '../components/IconButton'
import Input from '../components/Input'
import Modal from '../components/Modal'
import RequireSpace from '../components/RequireSpace'
import ThemeSelector from '../components/ThemeSelector'
import { useAuth, useProfile, useSpace } from '../features/auth/hooks'
import MySchedule from '../features/schedule/MySchedule'
import NotificationSettings from '../features/notifications/NotificationSettings'
import { friendlyError } from '../lib/errors'
import { isMissingSchema, schemaHint } from '../lib/schema'
import { uploadImage } from '../lib/storage'
import { normalizeAccent } from '../lib/theme'
import { citiesIn, countryNames, matchPlace } from '../lib/places'
import { cityName, detectedTimeZone, isValidTimeZone, timeZoneOptions } from '../lib/timezone'
import { supabase } from '../supabaseClient'

function SettingsContent() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { profile, updateProfile } = useProfile()
  const { space } = useSpace()
  const savedPlace = matchPlace({ country: profile.country, city: profile.city, timeZone: profile.timezone || detectedTimeZone() })
  const [name, setName] = useState(profile.display_name || '')
  const [country, setCountry] = useState(savedPlace?.country || '')
  const [city, setCity] = useState(savedPlace?.city || profile.city || '')
  const [timezone, setTimezone] = useState(profile.timezone || savedPlace?.timeZone || detectedTimeZone())
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [blocks, setBlocks] = useState([])
  const [scheduleHint, setScheduleHint] = useState('')
  const [tab, setTab] = useState('profile')
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  const loadSchedule = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('schedules')
      .select('id, title, days, starts_at, ends_at')
      .eq('space_id', space.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (loadError && isMissingSchema(loadError)) {
      setScheduleHint(schemaHint)
      return
    }
    if (loadError) throw loadError
    setBlocks(data || [])
  }, [space.id, user.id])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      loadSchedule().catch((loadError) => {
        if (active) setError(friendlyError(loadError, "We couldn't load your schedule."))
      })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [loadSchedule])
  const zones = timeZoneOptions()
  const countries = countryNames()
  const cityChoices = citiesIn(country)

  const saveAppearance = async (patch) => {
    setError('')
    setStatus('')
    try {
      await updateProfile(patch)
      setStatus('saved')
    } catch (saveError) {
      setError(friendlyError(saveError, "We couldn't save your appearance."))
    }
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    if (!isValidTimeZone(timezone.trim())) {
      setError("That timezone isn't recognized.")
      return
    }

    setSaving(true)
    setError('')
    setStatus('')
    try {
      await updateProfile({
        display_name: name.trim(),
        timezone: timezone.trim(),
        ...(country && city ? { country, city } : {}),
      })
      setStatus('saved')
    } catch (saveError) {
      setError(isMissingSchema(saveError) ? schemaHint : friendlyError(saveError, "We couldn't save your profile."))
    } finally {
      setSaving(false)
    }
  }

  const saveName = async (event) => {
    event.preventDefault()
    const next = nameDraft.trim()
    if (!next) return
    setSaving(true)
    setError('')
    setStatus('')
    try {
      await updateProfile({ display_name: next })
      setName(next)
      setEditingName(false)
      setStatus('saved')
    } catch (saveError) {
      setError(isMissingSchema(saveError) ? schemaHint : friendlyError(saveError, "We couldn't save your name."))
    } finally {
      setSaving(false)
    }
  }

  const savePhoto = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const url = await uploadImage('avatars', `${user.id}/avatar.jpg`, file)
      await updateProfile({ avatar_url: url })
      setStatus('saved')
    } catch (uploadError) {
      setError(friendlyError(uploadError, "We couldn't save that photo."))
    } finally {
      setUploading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (logoutError) {
      setError(friendlyError(logoutError, "We couldn't log you out."))
    }
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <h1>Me</h1>
      </header>
      <div className="me-tabs" role="tablist" aria-label="Me">
        {[
          ['profile', 'Profile'],
          ['schedule', 'Schedule'],
          ['notifications', 'Notifications'],
          ['themes', 'Themes'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <ErrorMessage message={error} />
      {status && <p className="muted" role="status">{status}</p>}

      {tab === 'profile' && (
      <section className="home-card" aria-label="Profile">
        <div className="me-identity">
          <div className="me-photo">
            <Avatar name={name} src={profile.avatar_url} size="lg" />
            <label className="me-photo__edit">
              <Pencil size={14} aria-hidden="true" />
              <span className="sr-only">{uploading ? 'Saving photo' : 'Edit profile photo'}</span>
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={savePhoto}
                disabled={uploading}
              />
            </label>
          </div>
          <div className="me-name">
            <strong>{name || 'You'}</strong>
            <IconButton label="Edit name" onClick={() => { setNameDraft(name); setEditingName(true) }}>
              <SquarePen size={18} aria-hidden="true" />
            </IconButton>
          </div>
        </div>
        <form className="stack-form" onSubmit={saveProfile}>
          <div className="field">
            <label className="field__label" htmlFor="country">Country</label>
            <select
              id="country"
              className="input"
              value={country}
              onChange={(event) => {
                const next = event.target.value
                const first = citiesIn(next)[0]
                setCountry(next)
                setCity(first?.city || '')
                if (first) setTimezone(first.timeZone)
              }}
            >
              <option value="">Choose a country</option>
              {countries.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="city">City</label>
            <select
              id="city"
              className="input"
              value={city}
              disabled={!country}
              onChange={(event) => {
                const next = event.target.value
                const match = cityChoices.find((place) => place.city === next)
                setCity(next)
                if (match) setTimezone(match.timeZone)
              }}
            >
              <option value="">Choose a city</option>
              {cityChoices.map((place) => (
                <option key={`${place.country}-${place.city}`} value={place.city}>{place.city}</option>
              ))}
            </select>
            <p className="muted">This city shows on Home. The timezone follows it.</p>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="timezone">Timezone</label>
            <select
              id="timezone"
              className="input"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            >
              {zones.map((zone) => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                const found = matchPlace({ timeZone: detectedTimeZone() })
                if (found) {
                  setCountry(found.country)
                  setCity(found.city)
                  setTimezone(found.timeZone)
                  return
                }
                setTimezone(detectedTimeZone())
              }}
            >
              Use this device ({cityName(detectedTimeZone())})
            </button>
          </div>
          <Button type="submit" disabled={saving}>{saving ? 'Saving' : 'Save profile'}</Button>
        </form>
      </section>
      )}

      {tab === 'schedule' && (
      <MySchedule
        heading={false}
        blocks={blocks}
        onSave={async (form) => {
          const payload = {
            title: form.title,
            days: form.days,
            starts_at: form.starts_at,
            ends_at: form.ends_at,
          }
          const write = form.id
            ? supabase.from('schedules').update(payload).eq('id', form.id).eq('user_id', user.id)
            : supabase.from('schedules').insert({ ...payload, space_id: space.id, user_id: user.id })
          const { error: saveError } = await write
          if (saveError) throw new Error(isMissingSchema(saveError) ? schemaHint : friendlyError(saveError, "We couldn't save that schedule."))
          await loadSchedule()
        }}
        onDelete={async (id) => {
          const { error: deleteError } = await supabase.from('schedules').delete().eq('id', id).eq('user_id', user.id)
          if (deleteError) {
            setError(friendlyError(deleteError, "We couldn't delete that schedule."))
            return
          }
          setBlocks((current) => current.filter((block) => block.id !== id))
        }}
      />
      )}
      {tab === 'schedule' && scheduleHint && <p className="muted">{scheduleHint}</p>}

      {tab === 'notifications' && <NotificationSettings userId={user.id} heading={false} />}

      {tab === 'themes' && (
      <section className="home-card" aria-label="Themes">
        <div className="stack-form">
          <div className="field">
            <span className="field__label">Light, dark, or system</span>
            <ThemeSelector
              mode={profile.theme_mode || 'system'}
              onChange={(mode) => saveAppearance({ theme_mode: mode })}
            />
          </div>
          <div className="field">
            <span className="field__label">Accent color</span>
            <AccentSelector
              value={profile.accent_color || 'purple'}
              onChange={(accent) => saveAppearance({ accent_color: normalizeAccent(accent) })}
            />
          </div>
          <p className="muted">This theme is for Me. Home and Our Space keep the space theme.</p>
        </div>
      </section>
      )}

      <Modal open={editingName} title="Edit name" onClose={() => setEditingName(false)}>
        <form className="stack-form" onSubmit={saveName}>
          <Input
            id="display-name"
            label="Display name"
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            required
            maxLength={40}
          />
          <Button type="submit" disabled={saving}>{saving ? 'Saving' : 'Save'}</Button>
        </form>
      </Modal>

      <div className="section-block">
        <Button variant="secondary" onClick={handleLogout}>Log out</Button>
      </div>
    </main>
  )
}

export default function Settings() {
  return (
    <RequireSpace>
      <SettingsContent />
    </RequireSpace>
  )
}
