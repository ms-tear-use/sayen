import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Clock, Heart, House, MapPin, MoreHorizontal, Pencil, Plane, Sparkles, UserRound } from 'lucide-react'
import Button from '../components/Button'
import ErrorMessage from '../components/ErrorMessage'
import IconButton from '../components/IconButton'
import LoadingState from '../components/LoadingState'
import Modal from '../components/Modal'
import RequireSpace from '../components/RequireSpace'
import { useProfile, useSpace } from '../features/auth/hooks'
import JourneyEditor from '../features/journey/JourneyEditor'
import JourneyHero from '../features/journey/JourneyHero'
import { journeyMarks, journeyNodeKind, journeyTitle } from '../features/journey/journey'
import { formatDateOnly } from '../features/space/dates'
import { inferType, isRecurring, personNameOf, typeName } from '../features/space/events'
import useNow from '../hooks/useNow'
import { friendlyError } from '../lib/errors'
import { memberName } from '../lib/helpers'
import { detectedTimeZone, formatClock, viewerWhen } from '../lib/timezone'
import { supabase } from '../supabaseClient'

const nodeIcons = { heart: Heart, spark: Sparkles, travel: Plane, home: House }

function ItemMenu({ children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div className="journey-menu" ref={ref}>
      <button
        type="button"
        className="journey-menu__button"
        aria-label="More"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="journey-menu__panel" role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}

function TimelineItem({ item, onDelete }) {
  const Icon = nodeIcons[item.node] || Heart
  const hasMenu = Boolean(item.href || item.deletable)

  return (
    <li className={`journey-feed__item ${item.soon ? 'journey-feed__item--soon' : ''}`}>
      <span className="journey-node" aria-hidden="true"><Icon size={18} /></span>
      <article className="journey-item">
        <div className="journey-item__top">
          <h3>{item.title}</h3>
          {hasMenu && (
            <ItemMenu>
              {item.href && <Link role="menuitem" to={item.href}>Open</Link>}
              {item.deletable && (
                <button type="button" role="menuitem" className="journey-menu__danger" onClick={() => onDelete(item)}>Delete</button>
              )}
            </ItemMenu>
          )}
        </div>
        <span className="journey-pill">{item.badge}</span>
        <p className="journey-meta">
          <CalendarDays size={16} aria-hidden="true" />
          <span>{formatDateOnly(item.dateKey)}</span>
          {item.time && (
            <>
              <Clock size={16} aria-hidden="true" />
              <span>{item.time}</span>
            </>
          )}
        </p>
        {(item.location || item.person) && (
          <p className="journey-meta">
            {item.location && (
              <>
                <MapPin size={16} aria-hidden="true" />
                <span>{item.location}</span>
              </>
            )}
            {item.person && (
              <>
                <UserRound size={16} aria-hidden="true" />
                <span>{item.person}</span>
              </>
            )}
          </p>
        )}
        {item.note && <p className="journey-note">{item.note}</p>}
        {item.photo && (
          <div className="journey-media">
            <img src={item.photo} alt="" />
          </div>
        )}
        {(item.href || item.deletable) && (
          <div className="journey-item__actions">
            {item.href && <Link className="button button--primary" to={item.href}>Open</Link>}
            {item.deletable && (
              <button type="button" className="journey-item__ghost" onClick={() => onDelete(item)}>Delete</button>
            )}
          </div>
        )}
      </article>
    </li>
  )
}

function buildFeed({ dates, memories, startKey, now, members, zone }) {
  const items = []

  dates.forEach((date) => {
    if (date.event_type === 'schedule' || date.occurrence_date) return
    const type = inferType(date)
    const key = String(date.event_date || '').slice(0, 10)
    if (!key) return
    const local = date.start_time ? viewerWhen(key, date.start_time, date.time_zone || zone, zone) : null
    const shownKey = local?.dateKey || key
    if (startKey && shownKey < startKey) return
    items.push({
      id: date.id,
      kind: 'date',
      node: journeyNodeKind({ kind: 'date', title: date.title, note: date.description }),
      badge: typeName(type),
      title: date.title || 'Event',
      dateKey: shownKey,
      time: local?.time ? formatClock(local.time) : '',
      location: '',
      person: type === 'birthday' ? personNameOf(date) : '',
      note: String(date.description || '').trim(),
      photo: '',
      href: `/space/calendar?date=${shownKey}&event=${date.id}`,
      deletable: !isRecurring(date),
      soon: false,
      sort: 0,
    })
  })

  memories.forEach((memory) => {
    const key = String(memory.date || '').slice(0, 10)
    if (!key || (startKey && key < startKey)) return
    items.push({
      id: memory.id,
      kind: 'memory',
      node: journeyNodeKind({ kind: 'memory', title: memory.title, location: memory.location, note: memory.caption }),
      badge: 'Memory',
      title: memory.title || 'Memory',
      dateKey: key,
      time: '',
      location: memory.location || '',
      person: memory.user_id ? memberName(members, memory.user_id) : '',
      note: String(memory.caption || '').trim(),
      photo: memory.image_url || '',
      href: `/space/calendar?date=${key}&event=${memory.id}`,
      deletable: true,
      soon: false,
      sort: 0,
    })
  })

  if (startKey) {
    journeyMarks(startKey, now).forEach((mark) => {
      if (!mark.key) return
      items.push({
        id: `mark-${mark.id}`,
        kind: 'achievement',
        node: 'spark',
        badge: 'Achievement',
        title: mark.label,
        dateKey: mark.key,
        time: '',
        location: '',
        person: '',
        note: mark.reached ? 'Reached' : 'Still ahead',
        photo: '',
        href: '',
        deletable: false,
        soon: !mark.reached,
        sort: 1,
      })
    })
  }

  return items.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.sort - b.sort)
}

function JourneyContent() {
  const { space, members, user, updateSpace } = useSpace()
  const { profile } = useProfile()
  const now = useNow(30000)
  const zone = profile?.timezone || detectedTimeZone()
  const [dates, setDates] = useState([])
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      const load = async () => {
        let dateResult = await supabase
          .from('important_dates')
          .select('id, title, event_date, description, event_type, occurrence_date, recurrence, start_time, time_zone, emoji, person_name')
          .eq('space_id', space.id)
        if (dateResult.error) {
          dateResult = await supabase
            .from('important_dates')
            .select('id, title, event_date, description, event_type, occurrence_date, recurrence')
            .eq('space_id', space.id)
        }
        if (dateResult.error) {
          dateResult = await supabase
            .from('important_dates')
            .select('id, title, event_date, description, recurrence')
            .eq('space_id', space.id)
        }
        if (dateResult.error) throw dateResult.error

        let memoryResult = await supabase
          .from('memories')
          .select('id, title, caption, location, date, image_url, user_id, emoji')
          .eq('space_id', space.id)
        if (memoryResult.error) {
          memoryResult = await supabase
            .from('memories')
            .select('id, title, caption, location, date, image_url, user_id')
            .eq('space_id', space.id)
        }
        if (memoryResult.error) throw memoryResult.error
        if (!active) return
        setDates(dateResult.data || [])
        setMemories(memoryResult.data || [])
      }
      load()
        .catch((loadError) => {
          if (active) setError(friendlyError(loadError, "We couldn't load your journey."))
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [space.id])

  const milestones = dates.filter((item) => inferType(item) === 'milestone' && !item.occurrence_date)
  const linked = milestones.find((item) => item.id === space.journey_date_id) || null
  const startKey = String(linked?.event_date || space.journey_started_on || '').slice(0, 10)
  const self = members.find((member) => member.user_id === user.id) || null
  const partner = members.find((member) => member.user_id !== user.id) || null
  const feed = buildFeed({ dates, memories, startKey, now, members, zone })

  const confirmDelete = async () => {
    if (!pending) return
    setRemoving(true)
    setError('')
    const table = pending.kind === 'memory' ? 'memories' : 'important_dates'
    const { error: deleteError } = await supabase.from(table).delete().eq('id', pending.id).eq('space_id', space.id)
    if (deleteError) {
      setError(friendlyError(deleteError, "We couldn't delete that."))
      setRemoving(false)
      return
    }
    if (pending.kind === 'memory') setMemories((current) => current.filter((item) => item.id !== pending.id))
    else setDates((current) => current.filter((item) => item.id !== pending.id))
    setPending(null)
    setRemoving(false)
  }

  return (
    <main className="page-shell">
      <header className="page-header--row journey-page__head">
        <h1>{journeyTitle(space.journey_name)}</h1>
        <IconButton label="Edit journey" onClick={() => setEditing(true)}>
          <Pencil size={18} aria-hidden="true" />
        </IconButton>
      </header>
      <ErrorMessage message={error} />
      {loading ? (
        <LoadingState compact message="Loading your journey..." />
      ) : (
        <>
          <section className="home-card journey-hero-card" aria-label="Time together">
            <JourneyHero dateKey={startKey} self={self} partner={partner} onSetup={() => setEditing(true)} />
          </section>
          <section className="journey-timeline" aria-label="Timeline">
            <h2>Timeline</h2>
            {feed.length === 0 ? (
              <p className="muted">Moments you save will show up on this line.</p>
            ) : (
              <ol className="journey-feed">
                {feed.map((item) => (
                  <TimelineItem key={`${item.kind}-${item.id}`} item={item} onDelete={setPending} />
                ))}
              </ol>
            )}
          </section>
        </>
      )}

      <JourneyEditor
        open={editing}
        space={space}
        startKey={startKey}
        linkedId={linked?.id || ''}
        updateSpace={updateSpace}
        onClose={() => setEditing(false)}
      />

      <Modal open={Boolean(pending)} title="Delete this event?" className="modal--sheet" onClose={() => setPending(null)}>
        <div className="stack-form">
          <p>{pending?.title}</p>
          <Button onClick={confirmDelete} disabled={removing}>{removing ? 'Deleting' : 'Delete'}</Button>
          <button type="button" className="journey-item__ghost" onClick={() => setPending(null)}>Cancel</button>
        </div>
      </Modal>
    </main>
  )
}

export default function Journey() {
  return (
    <RequireSpace>
      <JourneyContent />
    </RequireSpace>
  )
}
