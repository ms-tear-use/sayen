import { useCallback, useEffect, useState } from 'react'
import { enablePush, notificationPermission } from './push'
import { supabase } from '../../supabaseClient'
import { isMissingSchema, schemaHint } from '../../lib/schema'

const fields = [
  ['event_reminders', 'Event reminders'],
  ['schedule_reminders', 'Schedule reminders'],
  ['checkin_reminders', 'Daily check-in'],
]

const defaults = {
  event_reminders: true,
  schedule_reminders: true,
  checkin_reminders: true,
}

export default function NotificationSettings({ userId, heading = true }) {
  const [prefs, setPrefs] = useState(defaults)
  const [permission, setPermission] = useState(notificationPermission())
  const [hint, setHint] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('notification_settings')
      .select('event_reminders, schedule_reminders, checkin_reminders')
      .eq('user_id', userId)
      .maybeSingle()
    if (error && isMissingSchema(error)) {
      setHint(schemaHint)
      return
    }
    if (data) setPrefs({ ...defaults, ...data })
  }, [userId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load().catch(() => {})
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const toggle = async (key) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setHint('')
    if (next[key]) {
      const result = await enablePush(userId)
      setPermission(notificationPermission())
      if (result === 'denied') setPermission('denied')
    }
    const { error } = await supabase.from('notification_settings').upsert({ user_id: userId, ...next })
    if (error && isMissingSchema(error)) setHint(schemaHint)
  }

  return (
    <section className="home-card" aria-label="Notifications">
      {heading && <h2>Notifications</h2>}
      <div className="note-settings">
        {fields.map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            <input type="checkbox" checked={Boolean(prefs[key])} onChange={() => toggle(key)} />
          </label>
        ))}
      </div>
      {permission === 'default' && (
        <button type="button" className="text-button" onClick={async () => setPermission(await enablePush(userId))}>
          Enable notifications
        </button>
      )}
      {permission === 'denied' && (
        <p className="muted">Notifications are currently disabled. Enable them in your browser settings to receive Sayen reminders.</p>
      )}
      {hint && <p className="muted">{hint}</p>}
    </section>
  )
}
