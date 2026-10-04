import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Cloud,
  CloudRain,
  Eye,
  Heart,
  Image,
  Mail,
  MapPin,
  X,
  Pencil,
  Trash2,
  Meh,
  MessageCircle,
  Moon,
  Smile,
  Sparkles,
  Sun,
} from 'lucide-react'
import Avatar from '../components/Avatar'
import IconButton from '../components/IconButton'
import EmojiPicker from '../components/EmojiPicker'
import ErrorMessage from '../components/ErrorMessage'
import Modal from '../components/Modal'
import RequireSpace from '../components/RequireSpace'
import { useAuth, useProfile, useSpace } from '../features/auth/hooks'
import CheckInFields from '../features/checkin/CheckInFields'
import { checkInValues, checkInWriteError } from '../features/checkin/payload'
import CheckInMedia, { checkInMedia } from '../features/checkin/CheckInMedia'
import CheckInTime from '../features/checkin/CheckInTime'
import JourneyCard from '../features/journey/JourneyCard'
import { distanceBetween, matchPlace } from '../lib/places'
import { listUpcoming, memoriesOnThisDay } from '../features/space/dates'
import { presentEvent } from '../features/space/events'
import { EventCard } from '../features/space/EventPreview'
import { scheduleStatus } from '../features/schedule/days'
import useNow from '../hooks/useNow'
import { emojiFor, splitEmoji, withEmoji } from '../lib/emoji'
import { friendlyError } from '../lib/errors'
import { uploadCheckInMedia } from '../lib/storage'
import { isMissingSchema, schemaHint } from '../lib/schema'
import { calendarDate, cityName, detectedTimeZone, flagForTimeZone, formatClock, formatLocalTime, isValidTimeZone, viewerWhen, zonedParts } from '../lib/timezone'
import { memberName } from '../lib/helpers'
import { supabase } from '../supabaseClient'

const statusChoices = [
  'At work',
  'Lunch break',
  'Commuting',
  'At home',
  'Resting',
  'Sleeping',
  'Out',
  'Traveling',
  'Busy',
  'Available',
  "Don't disturb",
]

const moodLabels = { great: 'Great', good: 'Good', okay: 'Okay', 'not great': 'Not great', rough: 'Rough' }
const needLabels = { talk: 'Talk', reassurance: 'Reassurance', attention: 'Attention', distraction: 'Distraction', space: 'Space' }
const moodIcons = { great: Sun, good: Smile, okay: Meh, 'not great': Cloud, rough: CloudRain }
const needIcons = { talk: MessageCircle, reassurance: Heart, attention: Eye, distraction: Sparkles, space: Moon }

function StatusPill({ row, onClear, clearing }) {
  const shown = splitEmoji(row.label)
  return (
    <p className="home-pill">
      {shown.emoji
        ? <span aria-hidden="true">{shown.emoji}</span>
        : <span className="home-pill__dot" aria-hidden="true" />}
      <span>
        {shown.label}
        {row.ends_at ? <em> · until {formatClock(row.ends_at)}</em> : null}
      </span>
      {onClear && (
        <button type="button" className="home-pill__x" onClick={onClear} disabled={clearing} aria-label="Remove status">
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </p>
  )
}

function ScheduleBadge({ member, schedules, now }) {
  const blocks = schedules.filter((block) => block.user_id === member.user_id)
  const current = scheduleStatus(blocks, member.timezone, now)
  if (!current?.label) return null
  const shown = emojiFor(current.label)
  if (!shown.emoji) return null

  return (
    <button type="button" className="sched-badge" aria-label={shown.label}>
      <span aria-hidden="true">{shown.emoji}</span>
      <span className="sched-badge__tip" role="tooltip">{shown.label}</span>
    </button>
  )
}

function CheckInMeta({ entry }) {
  const Mood = moodIcons[entry.mood]
  const Need = needIcons[entry.need]
  return (
    <>
      {entry.title ? <p className="home-check__title">{entry.title}</p> : null}
      {(entry.mood || entry.need) && (
        <p className="home-check__meta">
          {entry.mood && (
            <span>
              {Mood && <Mood size={16} aria-hidden="true" />}
              {moodLabels[entry.mood] || entry.mood}
            </span>
          )}
          {entry.need && (
            <span>
              {Need && <Need size={16} aria-hidden="true" />}
              {needLabels[entry.need] || entry.need}
            </span>
          )}
        </p>
      )}
      {entry.message ? <p className="home-check__note">{entry.message}</p> : null}
      <CheckInMedia entry={entry} />
    </>
  )
}

function statusCurrent(row, timeZone, now) {
  if (!row?.label) return false
  if (!row.ends_at) return true
  const clock = zonedParts(timeZone, now)
  const [hour, minute] = String(row.ends_at).slice(0, 5).split(':').map(Number)
  return clock.hour < hour || (clock.hour === hour && clock.minute < minute)
}

function HomeContent() {
  const { user } = useAuth()
  const { profile } = useProfile()
  const { space, members } = useSpace()
  const zone = profile?.timezone || detectedTimeZone()
  const now = useNow()
  const [statuses, setStatuses] = useState([])
  const [schedules, setSchedules] = useState([])
  const [checkins, setCheckins] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [memories, setMemories] = useState([])
  const [hint, setHint] = useState('')
  const [error, setError] = useState('')
  const [draft, setDraft] = useState({ choice: '', custom: '', ends_at: '', emoji: '' })
  const [editingStatus, setEditingStatus] = useState(false)
  const [savingStatus, setSavingStatus] = useState(false)
  const [editingCheckIn, setEditingCheckIn] = useState(null)
  const [addingCheckIn, setAddingCheckIn] = useState(null)
  const [savingCheckIn, setSavingCheckIn] = useState(false)
  const [checkInError, setCheckInError] = useState('')

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      const load = async () => {
      let missing = false
      const mark = (result) => {
        if (result.error && isMissingSchema(result.error)) {
          missing = true
          return []
        }
        if (result.error) throw result.error
        return result.data || []
      }

      const statusResult = await supabase.from('member_statuses').select('user_id, label, ends_at').eq('space_id', space.id)
      const scheduleResult = await supabase.from('schedules').select('id, user_id, title, days, starts_at, ends_at').eq('space_id', space.id)
      let checkinResult = await supabase.from('daily_checkins').select('id, user_id, title, mood, message, need, created_at, media_url, media_kind').eq('space_id', space.id).order('created_at', { ascending: false }).limit(12)
      if (checkinResult.error && isMissingSchema(checkinResult.error)) {
        missing = true
        checkinResult = await supabase.from('daily_checkins').select('id, user_id, mood, message, need, created_at, media_url, media_kind').eq('space_id', space.id).order('created_at', { ascending: false }).limit(12)
      }
      if (checkinResult.error && isMissingSchema(checkinResult.error)) {
        missing = true
        checkinResult = await supabase.from('daily_checkins').select('id, user_id, mood, message, need, created_at').eq('space_id', space.id).order('created_at', { ascending: false }).limit(12)
      }
      const homeDateColumns = 'id, title, event_date, description, recurrence, event_type, reminder_when, reminder, count_milestones, count_years, count_months, person_name, emoji, start_time, time_zone'
      let dateResult = await supabase.from('important_dates').select(homeDateColumns).eq('space_id', space.id)
      if (dateResult.error && isMissingSchema(dateResult.error)) {
        missing = true
        dateResult = await supabase.from('important_dates').select('id, title, event_date, description, recurrence, event_type, reminder_when, reminder, count_milestones').eq('space_id', space.id)
      }
      if (dateResult.error && isMissingSchema(dateResult.error)) {
        missing = true
        dateResult = await supabase.from('important_dates').select('id, title, event_date, description, recurrence').eq('space_id', space.id)
      }
      const memoryResult = await supabase.from('memories').select('id, title, image_url, date, user_id').eq('space_id', space.id).order('date', { ascending: false }).limit(200)

      if (!active) return
      setStatuses(mark(statusResult))
      setSchedules(mark(scheduleResult))
      setCheckins(mark(checkinResult))
      if (dateResult.error) throw dateResult.error
      setUpcoming(listUpcoming(dateResult.data || [], new Date()))
      setMemories(memoryResult.data || [])
      if (memoryResult.error) throw memoryResult.error
      setHint(missing ? schemaHint : '')
    }

    load().catch((loadError) => {
      if (active) setError(friendlyError(loadError, "We couldn't load home."))
    })
    }, 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [space.id, user.id])

  const openStatus = () => {
    setDraft({ choice: '', custom: '', ends_at: '', emoji: '' })
    setEditingStatus(true)
  }

  const clearStatus = async () => {
    setSavingStatus(true)
    setError('')
    try {
      const { error: deleteError } = await supabase.from('member_statuses').delete().eq('user_id', user.id)
      if (deleteError) throw deleteError
      setStatuses((current) => current.filter((item) => item.user_id !== user.id))
      setEditingStatus(false)
    } catch (deleteError) {
      setError(isMissingSchema(deleteError) ? schemaHint : friendlyError(deleteError, "We couldn't remove your status."))
    } finally {
      setSavingStatus(false)
    }
  }

  const saveStatus = async (event) => {
    event.preventDefault()
    const text = (draft.choice === 'Custom' ? draft.custom : draft.choice).trim()
    const label = withEmoji(draft.emoji, text)
    if (!label) return
    setSavingStatus(true)
    setError('')
    try {
      const row = {
        user_id: user.id,
        space_id: space.id,
        label,
        ends_at: draft.ends_at || null,
        updated_at: new Date().toISOString(),
      }
      const { error: saveError } = await supabase.from('member_statuses').upsert(row)
      if (saveError) throw saveError
      setStatuses((current) => [...current.filter((item) => item.user_id !== user.id), row])
      setEditingStatus(false)
    } catch (saveError) {
      setError(isMissingSchema(saveError) ? schemaHint : friendlyError(saveError, "We couldn't save your status."))
    } finally {
      setSavingStatus(false)
    }
  }

  const openNewCheckIn = () => {
    setAddingCheckIn({ title: '', mood: '', need: '', message: '', file: null, preview: null })
    setCheckInError('')
  }

  const closeNewCheckIn = () => {
    if (addingCheckIn?.preview?.local) URL.revokeObjectURL(addingCheckIn.preview.url)
    setAddingCheckIn(null)
  }

  const saveNewCheckIn = async (event) => {
    event.preventDefault()
    if (!addingCheckIn) return
    setSavingCheckIn(true)
    setCheckInError('')
    try {
      const row = {
        space_id: space.id,
        user_id: user.id,
        ...checkInValues(addingCheckIn),
      }
      if (addingCheckIn.file) {
        const uploaded = await uploadCheckInMedia(space.id, addingCheckIn.file)
        row.media_url = uploaded.url
        row.media_kind = uploaded.kind
      }
      const { data, error: saveError } = await supabase
        .from('daily_checkins')
        .insert(row)
        .select('id, user_id, title, mood, message, need, created_at, media_url, media_kind')
        .single()
      if (saveError) throw checkInWriteError(saveError)
      if (addingCheckIn.preview?.local) URL.revokeObjectURL(addingCheckIn.preview.url)
      setCheckins((current) => [data, ...current.filter((item) => item.id !== data.id)])
      setAddingCheckIn(null)
    } catch (saveError) {
      setCheckInError(friendlyError(saveError, "We couldn't save this check-in."))
    } finally {
      setSavingCheckIn(false)
    }
  }

  const startEditCheckIn = (entry) => {
    const media = checkInMedia(entry)
    setEditingCheckIn({
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
    setCheckInError('')
  }

  const saveCheckIn = async (event) => {
    event.preventDefault()
    if (!editingCheckIn) return
    setSavingCheckIn(true)
    setCheckInError('')
    try {
      const values = checkInValues(editingCheckIn)
      const patch = { ...values }
      if (editingCheckIn.file || editingCheckIn.removeMedia) {
        if (editingCheckIn.file) {
          const uploaded = await uploadCheckInMedia(space.id, editingCheckIn.file)
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
        .eq('id', editingCheckIn.id)
        .eq('user_id', user.id)
      if (saveError) throw checkInWriteError(saveError)
      if (editingCheckIn.preview?.local) URL.revokeObjectURL(editingCheckIn.preview.url)
      setCheckins((current) => current.map((item) => (
        item.id === editingCheckIn.id
          ? {
            ...item,
            ...values,
            media_url: patch.media_url === undefined ? item.media_url : patch.media_url,
            media_kind: patch.media_kind === undefined ? item.media_kind : patch.media_kind,
          }
          : item
      )))
      setEditingCheckIn(null)
    } catch (saveError) {
      setCheckInError(friendlyError(saveError, "We couldn't update that check-in."))
    } finally {
      setSavingCheckIn(false)
    }
  }

  const removeCheckIn = async (id) => {
    setCheckInError('')
    const { error: deleteError } = await supabase.from('daily_checkins').delete().eq('id', id).eq('user_id', user.id)
    if (deleteError) {
      setCheckInError(friendlyError(deleteError, "We couldn't delete that check-in."))
      return
    }
    setCheckins((current) => current.filter((item) => item.id !== id))
  }

  const people = [...members].sort((a, b) => {
    if (a.user_id === user.id) return -1
    if (b.user_id === user.id) return 1
    return 0
  })
  const savedZone = members.find((member) => member.user_id === user.id)?.timezone
  const ownZone = isValidTimeZone(savedZone) ? savedZone : detectedTimeZone()
  const selfMember = people.find((member) => member.user_id === user.id)
  const partner = people.find((member) => member.user_id !== user.id)
  const apart = distanceBetween(
    matchPlace({ country: selfMember?.country, city: selfMember?.city, timeZone: ownZone }),
    matchPlace({ country: partner?.country, city: partner?.city, timeZone: partner?.timezone }),
  )

  return (
    <main className="page-shell home">
      <ErrorMessage message={error} />
      {hint && <p className="muted">{hint}</p>}

      <section className="home-pair" aria-label="How we're doing">
        <div className="home-pair__people">
          {people.map((member) => {
            const row = statuses.find((item) => item.user_id === member.user_id)
            const active = statusCurrent(row, member.timezone, now)
            const self = member.user_id === user.id
            return (
              <article key={member.user_id} className="home-person">
                <div className="home-avatar">
                  <Avatar name={member.display_name || 'them'} src={member.avatar_url} size="lg" />
                  <ScheduleBadge member={member} schedules={schedules} now={now} />
                </div>
                <div className="home-person__body">
                  <h3>
                    {member.display_name || 'them'}
                    {self && <span className="you-mark"> (you)</span>}
                  </h3>
                  <p className="home-clock">
                    <time>{formatLocalTime(self ? ownZone : member.timezone, now)}</time>
                  </p>
                  <p className="home-zone">
                    <span aria-hidden="true">{flagForTimeZone(self ? ownZone : member.timezone)}</span>
                    {member.city || cityName(self ? ownZone : member.timezone)}
                  </p>
                  {active ? (
                    <div className="home-pills">
                      <StatusPill row={row} onClear={self ? clearStatus : null} clearing={savingStatus} />
                    </div>
                  ) : self ? (
                    <button type="button" className="home-add-status" onClick={openStatus}>
                      + add status
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
        {apart && (
          <div className="home-distance" aria-label={apart.same ? `Same city, ${apart.from}` : `${apart.label} between ${apart.from} and ${apart.to}`}>
            {apart.same ? (
              <p className="home-distance__same">
                <MapPin size={16} aria-hidden="true" />
                Same city
                <span>{apart.from}</span>
              </p>
            ) : (
              <>
                <span className="home-distance__city">
                  <MapPin size={14} aria-hidden="true" />
                  {apart.from}
                </span>
                <span className="home-distance__mid">
                  <span className="home-distance__line" aria-hidden="true" />
                  <strong>{apart.label}</strong>
                  <span className="home-distance__note">apart</span>
                </span>
                <span className="home-distance__city home-distance__city--end">
                  {apart.to}
                  <MapPin size={14} aria-hidden="true" />
                </span>
              </>
            )}
          </div>
        )}
      </section>

      <JourneyCard />

      <section className="home-card" aria-label="How we're doing">
        <div className="page-header--row">
          <h2><Heart size={18} aria-hidden="true" /> How We're Doing</h2>
          <button type="button" className="home-card__action" onClick={openNewCheckIn}>Update</button>
        </div>
        {checkInError && !editingCheckIn && !addingCheckIn && <ErrorMessage message={checkInError} />}
        <div className="home-check">
          {people.map((member) => {
            const self = member.user_id === user.id
            const zone = self ? ownZone : member.timezone
            const today = calendarDate(now, zone)
            const entry = checkins.find((item) => item.user_id === member.user_id && calendarDate(new Date(item.created_at), zone) === today)
            return { member, self, entry }
          }).sort((a, b) => {
            if (a.entry && b.entry) return new Date(b.entry.created_at) - new Date(a.entry.created_at)
            if (a.entry) return -1
            if (b.entry) return 1
            return 0
          }).map(({ member, self, entry }) => {
            return (
              <article key={member.user_id}>
                <div className="home-check__top">
                  <strong>
                    {memberName(members, member.user_id)}
                    {self && <span className="you-mark"> (you)</span>}
                  </strong>
                  {entry && <CheckInTime members={members} currentUserId={user.id} at={entry.created_at} />}
                </div>
                {entry ? (
                  <CheckInMeta entry={entry} />
                ) : (
                  <p className="muted">No check-in yet</p>
                )}
                {self && entry && (
                  <div className="home-check__actions">
                    <IconButton label="Edit" onClick={() => startEditCheckIn(entry)}><Pencil size={18} aria-hidden="true" /></IconButton>
                    <IconButton label="Delete" danger onClick={() => removeCheckIn(entry.id)}><Trash2 size={18} aria-hidden="true" /></IconButton>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <section className="home-card" aria-label="Upcoming">
          <h2><CalendarDays size={18} aria-hidden="true" /> Upcoming</h2>
          {upcoming.length ? (
            <div className="event-cards event-cards--wrap">
              {upcoming.map((item) => {
                const when = new Date(item.sort)
                const local = item.start_time ? viewerWhen(item.nextKey, item.start_time, item.time_zone || zone, zone) : null
                const preview = presentEvent(item, {
                  when,
                  dateKey: local?.dateKey || item.nextKey,
                  time: local?.time || '',
                })
                return (
                  <EventCard
                    key={item.id}
                    preview={preview}
                    href={`/space/calendar?date=${item.nextKey}&event=${item.id}`}
                  />
                )
              })}
            </div>
          ) : (
            <p className="muted">Nothing coming up.</p>
          )}
      </section>

      {memoriesOnThisDay(memories, calendarDate(now, zone)).length > 0 && (
        <section className="home-card" aria-label="On this day">
          <h2><Image size={18} aria-hidden="true" /> On This Day</h2>
          <p className="on-this-day__lead">A little look back at your memories.</p>
          <div className="on-this-day">
            {memoriesOnThisDay(memories, calendarDate(now, zone)).map((memory) => (
              <EventCard
                key={memory.id}
                preview={presentEvent(memory, {
                  kind: 'memory',
                  dateKey: memory.date,
                  photo: memory.image_url || '',
                  ago: memory.ago,
                })}
                href={`/space/calendar?date=${calendarDate(now, zone)}&event=${memory.id}`}
              />
            ))}
          </div>
        </section>
      )}

      <section className="home-card" aria-label="Recent memories">
        <div className="page-header--row">
          <h2><Image size={18} aria-hidden="true" /> Recent Memories</h2>
          <Link to="/space/memories" className="home-card__action">All</Link>
        </div>
        {memories.filter((item) => item.image_url).length === 0 ? (
          <p className="muted">Photos you save will show up here.</p>
        ) : (
          <div className="event-cards event-cards--memories">
            {memories.filter((item) => item.image_url).slice(0, 6).map((memory) => (
              <EventCard
                key={memory.id}
                preview={presentEvent(memory, {
                  kind: 'memory',
                  dateKey: memory.date,
                  photo: memory.image_url || '',
                })}
                href={`/space/calendar?date=${String(memory.date || '').slice(0, 10)}&event=${memory.id}`}
              />
            ))}
          </div>
        )}
      </section>

      <Modal open={editingStatus} title="Add status" onClose={() => setEditingStatus(false)}>
        <form className="stack-form home-status" onSubmit={saveStatus}>
          <EmojiPicker value={draft.emoji} onChange={(emoji) => setDraft((current) => ({ ...current, emoji }))} />
          <div className="home-status__controls">
            <div className="home-status__field">
              <label htmlFor="my-status">Status</label>
              <select
                id="my-status"
                className="input"
                value={draft.choice}
                onChange={(event) => setDraft((current) => ({ ...current, choice: event.target.value }))}
              >
                <option value="">Choose</option>
                {statusChoices.map((choice) => (
                  <option key={choice} value={choice}>{choice}</option>
                ))}
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div className="home-status__field">
              <label htmlFor="status-until">Until</label>
              <input
                id="status-until"
                className="input"
                type="time"
                value={draft.ends_at}
                onChange={(event) => setDraft((current) => ({ ...current, ends_at: event.target.value }))}
              />
            </div>
          </div>
          {draft.choice === 'Custom' && (
            <input
              className="input home-status__custom"
              value={draft.custom}
              placeholder="Custom status"
              aria-label="Custom status"
              onChange={(event) => setDraft((current) => ({ ...current, custom: event.target.value }))}
              required
            />
          )}
          <button type="submit" className="button button--primary" disabled={savingStatus || !draft.choice}>
            {savingStatus ? 'Saving' : 'Save'}
          </button>
        </form>
      </Modal>

      <Modal open={Boolean(addingCheckIn)} title="Update check-in" onClose={closeNewCheckIn}>
        {addingCheckIn && (
          <CheckInFields
            idPrefix="home-new-checkin"
            title={addingCheckIn.title}
            setTitle={(value) => setAddingCheckIn((current) => ({ ...current, title: value }))}
            mood={addingCheckIn.mood}
            setMood={(value) => setAddingCheckIn((current) => ({ ...current, mood: value }))}
            need={addingCheckIn.need}
            setNeed={(value) => setAddingCheckIn((current) => ({ ...current, need: value }))}
            message={addingCheckIn.message}
            setMessage={(value) => setAddingCheckIn((current) => ({ ...current, message: value }))}
            mediaPreview={addingCheckIn.preview}
            onMedia={(next) => setAddingCheckIn((current) => {
              if (current?.preview?.local) URL.revokeObjectURL(current.preview.url)
              if (!next) return { ...current, file: null, preview: null }
              return {
                ...current,
                file: next,
                preview: {
                  url: URL.createObjectURL(next),
                  kind: next.type.startsWith('video/') ? 'video' : 'photo',
                  local: true,
                },
              }
            })}
            onClearMedia={() => setAddingCheckIn((current) => {
              if (current?.preview?.local) URL.revokeObjectURL(current.preview.url)
              return { ...current, file: null, preview: null }
            })}
            onSubmit={saveNewCheckIn}
            saving={savingCheckIn}
            error={checkInError}
            submitLabel={savingCheckIn ? 'Saving' : 'Save check-in'}
          />
        )}
      </Modal>

      <Modal open={Boolean(editingCheckIn)} title="Edit check-in" onClose={() => setEditingCheckIn(null)}>
        {editingCheckIn && (
          <CheckInFields
            idPrefix="home-checkin"
            title={editingCheckIn.title}
            setTitle={(value) => setEditingCheckIn((current) => ({ ...current, title: value }))}
            mood={editingCheckIn.mood}
            setMood={(value) => setEditingCheckIn((current) => ({ ...current, mood: value }))}
            need={editingCheckIn.need}
            setNeed={(value) => setEditingCheckIn((current) => ({ ...current, need: value }))}
            message={editingCheckIn.message}
            setMessage={(value) => setEditingCheckIn((current) => ({ ...current, message: value }))}
            mediaPreview={editingCheckIn.preview || (!editingCheckIn.removeMedia && editingCheckIn.mediaUrl ? { url: editingCheckIn.mediaUrl, kind: editingCheckIn.mediaKind || 'photo' } : null)}
            onMedia={(next) => setEditingCheckIn((current) => {
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
            })}
            onClearMedia={() => setEditingCheckIn((current) => {
              if (current?.preview?.local) URL.revokeObjectURL(current.preview.url)
              return { ...current, file: null, preview: null, removeMedia: true, mediaUrl: '', mediaKind: '' }
            })}
            onSubmit={saveCheckIn}
            saving={savingCheckIn}
            error={checkInError}
            submitLabel={savingCheckIn ? 'Saving' : 'Save changes'}
          />
        )}
      </Modal>

      <div className="home-links">
        <Link to="/open-when"><Mail size={18} aria-hidden="true" /> Open when</Link>
        <Link to="/play"><Sparkles size={18} aria-hidden="true" /> Play</Link>
      </div>
    </main>
  )
}

export default function Home() {
  return (
    <RequireSpace>
      <HomeContent />
    </RequireSpace>
  )
}
