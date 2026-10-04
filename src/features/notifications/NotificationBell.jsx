import { useCallback, useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Modal from '../../components/Modal'
import { useAuth } from '../auth/hooks'
import { friendlyError } from '../../lib/errors'
import { calendarDate, detectedTimeZone } from '../../lib/timezone'
import { supabase } from '../../supabaseClient'

function dayLabel(value, zone) {
  const key = calendarDate(new Date(value), zone)
  const today = calendarDate(new Date(), zone)
  if (key === today) return 'Today'
  const yesterday = calendarDate(new Date(Date.now() - 86400000), zone)
  if (key === yesterday) return 'Yesterday'
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date(`${key}T00:00:00`))
}

export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const zone = detectedTimeZone()

  const load = useCallback(async () => {
    if (!user) return
    const { data, error: loadError } = await supabase
      .from('notifications')
      .select('id, title, body, href, fire_at, read_at')
      .eq('user_id', user.id)
      .order('fire_at', { ascending: false })
      .limit(40)
    if (loadError) {
      setError(friendlyError(loadError, "We couldn't load notifications."))
      return
    }
    setError('')
    setItems(data || [])
  }, [user])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load().catch(() => {})
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const unread = items.some((item) => !item.read_at)

  const openItem = async (item) => {
    if (!item.read_at) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id)
      setItems((current) => current.map((row) => (row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row)))
    }
    setOpen(false)
    if (item.href) navigate(item.href)
  }

  const dismiss = async (item) => {
    await supabase.from('notifications').delete().eq('id', item.id)
    setItems((current) => current.filter((row) => row.id !== item.id))
  }

  const groups = items.reduce((map, item) => {
    const label = dayLabel(item.fire_at, zone)
    if (!map.has(label)) map.set(label, [])
    map.get(label).push(item)
    return map
  }, new Map())

  return (
    <>
      <button type="button" className={`nav-bell ${unread ? 'nav-bell--on' : ''}`} aria-label="Notifications" onClick={() => { setOpen(true); load() }}>
        <Bell size={20} aria-hidden="true" />
      </button>
      <Modal open={open} title="Notifications" className="modal--sheet" onClose={() => setOpen(false)}>
        {error && <p className="muted">{error}</p>}
        {items.length === 0 && !error && <p className="muted">Nothing new.</p>}
        {[...groups.entries()].map(([label, rows]) => (
          <section key={label} className="note-group">
            <h3>{label}</h3>
            <ul className="plain-list">
              {rows.map((item) => (
                <li key={item.id} className={`note-row ${item.read_at ? '' : 'note-row--new'}`}>
                  <button type="button" onClick={() => openItem(item)}>
                    <strong>{item.title}</strong>
                    {item.body && <span>{item.body}</span>}
                  </button>
                  <button type="button" aria-label="Dismiss" onClick={() => dismiss(item)}>×</button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Modal>
    </>
  )
}
