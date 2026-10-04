import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LayoutGrid, List } from 'lucide-react'
import ErrorMessage from '../components/ErrorMessage'
import LoadingState from '../components/LoadingState'
import Modal from '../components/Modal'
import RequireSpace from '../components/RequireSpace'
import { useProfile, useSpace } from '../features/auth/hooks'
import { enablePush } from '../features/notifications/push'
import {
  dayItems,
  dayTitle,
  daysInMonth,
  monthCells,
  monthTitle,
  shiftMonth,
  weekdays,
} from '../features/space/calendar'
import EventForm from '../features/space/EventForm'
import EventIcon from '../features/space/EventIcon'
import { EventCard, EventRow } from '../features/space/EventPreview'
import EventView from '../features/space/EventView'
import { dateParts, formatMonthDay } from '../features/space/dates'
import {
  countsMonths,
  countsYears,
  dateKey,
  defaultEmoji,
  eventDetail,
  eventEmoji,
  eventLabel,
  excludedKeys,
  hasReminder,
  inferType,
  isLinkable,
  isRecurring,
  linkChoices,
  parseDays,
  personNameOf,
  presentEvent,
  reminderOf,
} from '../features/space/events'
import { friendlyError } from '../lib/errors'
import { isMissingSchema, schemaHint } from '../lib/schema'
import { uploadImage } from '../lib/storage'
import { detectedTimeZone, viewerWhen } from '../lib/timezone'
import { supabase } from '../supabaseClient'

function weekLabel(start, end) {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const left = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)
  const right = new Intl.DateTimeFormat('en-US', sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' }).format(end)
  return `${left} – ${right}`
}

const dateColumns = 'id, title, event_date, description, recurrence, reminder, event_type, start_time, end_time, reminder_when, count_milestones, subject_user_id, recurrence_days, created_by, series_id, occurrence_date, excluded_dates, recurrence_until, time_zone, emoji, count_years, count_months, person_name'
const dateColumnsPrevious = 'id, title, event_date, description, recurrence, reminder, event_type, start_time, end_time, reminder_when, count_milestones, subject_user_id, recurrence_days, created_by, series_id, occurrence_date, excluded_dates, recurrence_until, time_zone'

function blankForm(day, members) {
  return {
    id: null,
    root_id: null,
    scope: 'all',
    occurrence_key: day,
    event_type: 'important',
    title: '',
    person_name: '',
    emoji: '📌',
    event_date: day,
    start_time: '',
    end_time: '17:00',
    recurrence: 'none',
    recurrence_days: [],
    reminder_when: 'none',
    count_years: false,
    count_months: false,
    count_milestones: false,
    subject_user_id: members[0]?.user_id || '',
    description: '',
    caption: '',
    location: '',
    milestone_id: '',
    photos: [],
  }
}

function viewTitle(item, when) {
  if (!item) return 'Event'
  if (item.kind === 'memory') return item.memory?.title || item.title || 'Memory'
  const source = item.date || {}
  if (inferType(source) === 'birthday') return eventLabel(source, when) || source.title || 'Birthday'
  return source.title || item.title || 'Event'
}

function previewFor(item, hideDate) {
  const source = item.kind === 'memory' ? item.memory : item.date
  const key = item.kind === 'memory'
    ? String(item.memory?.date || '').slice(0, 10)
    : dateKey(item.year, item.month, item.day)
  return presentEvent(source, {
    kind: item.kind === 'memory' ? 'memory' : 'date',
    when: new Date(item.year, item.month - 1, item.day),
    dateKey: key,
    time: item.localTime,
    photo: item.memory?.image_url || '',
    hideDate,
  })
}

function Agenda({ items, layout, grouped, onOpen }) {
  const groups = []
  items.forEach((item) => {
    const key = dateKey(item.year, item.month, item.day)
    const last = groups[groups.length - 1]
    if (!last || last.key !== key) groups.push({ key, items: [item] })
    else last.items.push(item)
  })
  const blocks = grouped ? groups : [{ key: 'all', items }]

  if (layout === 'card') {
    return (
      <div className="event-cards">
        {blocks.map((group) => (
          <div key={group.key} className="event-cards__group">
            {grouped && <h3 className="event-list__day">{formatMonthDay(group.key)}</h3>}
            <div className="event-cards event-cards--wrap">
              {group.items.map((item) => (
                <EventCard key={`${item.id}-${item.occurrenceKey}`} preview={previewFor(item, false)} onClick={() => onOpen(item)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {blocks.map((group) => (
        <div key={group.key}>
          {grouped && <h3 className="event-list__day">{formatMonthDay(group.key)}</h3>}
          <ul className="event-list">
            {group.items.map((item) => (
              <li key={`${item.id}-${item.occurrenceKey}`}>
                <EventRow preview={previewFor(item, true)} onClick={() => onOpen(item)} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function CalendarContent() {
  const { space, user, members } = useSpace()
  const { profile } = useProfile()
  const zone = profile.timezone || detectedTimeZone()
  const [params, setParams] = useSearchParams()
  const today = new Date()
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 })
  const [selected, setSelected] = useState(today.getDate())
  const [dates, setDates] = useState([])
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [panel, setPanel] = useState(null)
  const [photos, setPhotos] = useState([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [view, setView] = useState('month')
  const [agendaLayout, setAgendaLayout] = useState('list')

  const load = useCallback(async () => {
    let dateResult = await supabase.from('important_dates').select(dateColumns).eq('space_id', space.id)
    if (dateResult.error && isMissingSchema(dateResult.error)) {
      dateResult = await supabase.from('important_dates').select(dateColumnsPrevious).eq('space_id', space.id)
    }
    if (dateResult.error && isMissingSchema(dateResult.error)) {
      dateResult = await supabase.from('important_dates').select('id, title, event_date, description, recurrence, reminder').eq('space_id', space.id)
    }
    let memoryResult = await supabase.from('memories').select('id, title, caption, location, date, image_url, user_id, milestone_id, emoji').eq('space_id', space.id)
    if (memoryResult.error && isMissingSchema(memoryResult.error)) {
      memoryResult = await supabase.from('memories').select('id, title, caption, location, date, image_url, user_id, milestone_id').eq('space_id', space.id)
    }
    if (memoryResult.error && isMissingSchema(memoryResult.error)) {
      memoryResult = await supabase.from('memories').select('id, title, caption, location, date, image_url, user_id').eq('space_id', space.id)
    }
    if (memoryResult.error && isMissingSchema(memoryResult.error)) {
      memoryResult = await supabase.from('memories').select('id, title, location, date, user_id').eq('space_id', space.id)
    }
    if (dateResult.error) throw dateResult.error
    if (memoryResult.error) throw memoryResult.error
    setDates(dateResult.data || [])
    setMemories(memoryResult.data || [])
  }, [space.id])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      load()
        .catch((loadError) => {
          if (active) setError(friendlyError(loadError, "We couldn't load the calendar."))
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

  const focusDate = () => new Date(cursor.year, cursor.month - 1, selected)

  const setFocus = (date) => {
    setCursor({ year: date.getFullYear(), month: date.getMonth() + 1 })
    setSelected(date.getDate())
  }

  const go = (delta) => {
    if (view === 'month') {
      const next = shiftMonth(cursor.year, cursor.month, delta)
      setCursor(next)
      setSelected((day) => Math.min(day, daysInMonth(next.year, next.month)))
      return
    }
    const next = focusDate()
    if (view === 'year') next.setFullYear(next.getFullYear() + delta)
    else if (view === 'week') next.setDate(next.getDate() + delta * 7)
    else next.setDate(next.getDate() + delta)
    setFocus(next)
  }

  const itemsOn = (year, month, day) => dayItems(dates, memories, year, month, day, space.name, zone)
    .map((item) => ({ ...item, occurrenceKey: item.sourceKey || dateKey(year, month, day), year, month, day }))

  const itemsFor = (day) => itemsOn(cursor.year, cursor.month, day)

  const fetchPhotos = async (item) => {
    if (item.kind === 'memory') {
      const result = await supabase.from('memory_photos').select('id, image_url').eq('memory_id', item.memory.id)
      const rows = []
      if (item.memory.image_url) rows.push({ id: `cover-${item.memory.id}`, url: item.memory.image_url, cover: true })
      ;(result.data || []).forEach((photo) => {
        if (!rows.some((row) => row.url.split('?')[0] === photo.image_url.split('?')[0])) {
          rows.push({ id: photo.id, url: photo.image_url, storedId: photo.id })
        }
      })
      return rows
    }
    if (item.kind !== 'date') return []
    const result = await supabase.from('important_date_photos').select('id, image_url').eq('date_id', item.date.id).order('created_at', { ascending: true })
    return (result.data || []).map((photo) => ({ id: photo.id, url: photo.image_url, storedId: photo.id }))
  }

  const openDetail = async (item) => {
    setPanel({ name: 'detail', item })
    setPhotos(await fetchPhotos(item))
  }

  useEffect(() => {
    const eventId = params.get('event')
    const date = params.get('date')
    if (!eventId && !date) return undefined
    const parts = dateParts(date)
    const timer = window.setTimeout(() => {
      if (parts) {
        setCursor({ year: parts.year, month: parts.month })
        setSelected(parts.day)
        setView('day')
      }
      if (!eventId || loading) return
      const found = dates.find((item) => item.id === eventId)
      const memory = memories.find((item) => item.id === eventId)
      const when = parts ? new Date(parts.year, parts.month - 1, parts.day) : new Date()
      if (found) {
        openDetail({
          kind: 'date',
          date: found,
          icon: eventEmoji(found),
          title: eventLabel(found, when, space.name),
          detail: eventDetail(found, when),
          reminded: hasReminder(found),
          occurrenceKey: date || found.event_date,
        })
      } else if (memory) {
        openDetail({
          kind: 'memory',
          memory,
          icon: memory.emoji || '📷',
          title: memory.title,
          occurrenceKey: date || memory.date,
        })
      }
      setParams({}, { replace: true })
    }, 0)
    return () => window.clearTimeout(timer)
    // The URL is cleared after the event opens, so this does not need openDetail in the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, loading, dates, memories, setParams, space.name])

  const formFromItem = async (item) => {
    if (item.kind === 'memory') {
      return {
        ...blankForm(item.occurrenceKey, members),
        id: item.memory.id,
        event_type: 'memory',
        emoji: item.memory.emoji || '📷',
        title: item.memory.title || '',
        event_date: item.memory.date?.slice(0, 10) || item.occurrenceKey,
        location: item.memory.location || '',
        caption: item.memory.caption || '',
        milestone_id: item.memory.milestone_id || '',
        photos: await fetchPhotos(item),
      }
    }
    const date = item.date
    const nextPhotos = await fetchPhotos(item)
    return {
      ...blankForm(item.occurrenceKey, members),
      id: date.id,
      root_id: date.series_id || date.id,
      event_type: inferType(date),
      emoji: date.emoji || defaultEmoji(inferType(date)),
      title: date.title || '',
      person_name: personNameOf(date),
      event_date: date.event_date?.slice(0, 10) || item.occurrenceKey,
      start_time: date.start_time ? String(date.start_time).slice(0, 5) : '',
      end_time: date.end_time ? String(date.end_time).slice(0, 5) : '17:00',
      recurrence: inferType(date) === 'birthday' ? 'yearly' : (date.recurrence || 'none'),
      recurrence_days: parseDays(date.recurrence_days),
      reminder_when: inferType(date) === 'memory' ? 'none' : reminderOf(date),
      count_years: countsYears(date),
      count_months: countsMonths(date),
      count_milestones: countsYears(date) || countsMonths(date),
      description: date.description || '',
      occurrence_key: item.occurrenceKey,
      was_recurring: isRecurring(date),
      photos: nextPhotos,
    }
  }

  const inViewerZone = (dateKeyValue, time, fromZone) => {
    if (!time) return { dateKey: dateKeyValue, time: '' }
    return viewerWhen(dateKeyValue, time, fromZone || zone, zone)
  }

  const startCreate = () => {
    setFormError('')
    setPhotos([])
    setPanel({ name: 'form', initial: blankForm(dateKey(cursor.year, cursor.month, selected), members) })
  }

  const startAddMemory = (milestoneId) => {
    setFormError('')
    setPhotos([])
    setPanel({
      name: 'form',
      initial: {
        ...blankForm(dateKey(cursor.year, cursor.month, selected), members),
        event_type: 'memory',
        emoji: '📷',
        reminder_when: 'none',
        milestone_id: milestoneId,
      },
    })
  }

  const openMemoryDetail = (memory) => {
    const parts = dateParts(memory.date)
    openDetail({
      kind: 'memory',
      memory,
      icon: memory.emoji || '📷',
      title: memory.title,
      occurrenceKey: String(memory.date || '').slice(0, 10),
      year: parts?.year,
      month: parts?.month,
      day: parts?.day,
    })
  }

  const openMilestoneDetail = (date) => {
    const now = new Date()
    openDetail({
      kind: 'date',
      date,
      icon: eventEmoji(date),
      title: eventLabel(date, now),
      occurrenceKey: String(date.event_date || '').slice(0, 10),
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    })
  }

  const startEdit = async (item, scope = 'all') => {
    const initial = await formFromItem(item)
    initial.scope = scope
    if (scope === 'all' && item.date?.series_id) {
      const root = dates.find((date) => date.id === item.date.series_id)
      if (root) initial.id = root.id
    }
    if (item.date?.start_time) {
      const wallDate = item.date.occurrence_date
        ? String(item.date.event_date || item.occurrenceKey).slice(0, 10)
        : (scope === 'this' || scope === 'following' ? item.occurrenceKey : initial.event_date)
      const local = inViewerZone(wallDate, item.date.start_time, item.date.time_zone)
      initial.event_date = local.dateKey
      initial.start_time = local.time
    } else if (scope === 'this' || scope === 'following') {
      initial.event_date = item.occurrenceKey
    }
    setFormError('')
    setPanel({ name: 'form', initial })
  }

  const uploadPhotos = async (files, folder) => {
    const urls = []
    for (const file of files) {
      urls.push(await uploadImage('memories', `${space.id}/${folder}/${crypto.randomUUID()}.jpg`, file))
    }
    return urls
  }

  const saveDatePhotos = async (dateId, formPhotos) => {
    const removed = (formPhotos || []).filter((photo) => photo.removed && photo.storedId)
    const files = (formPhotos || []).filter((photo) => photo.file && !photo.removed).map((photo) => photo.file)
    if (removed.length) {
      await supabase.from('important_date_photos').delete().in('id', removed.map((photo) => photo.storedId))
    }
    const urls = await uploadPhotos(files, 'dates')
    if (urls.length) {
      const result = await supabase.from('important_date_photos').insert(urls.map((imageUrl) => ({
        date_id: dateId,
        space_id: space.id,
        image_url: imageUrl,
      })))
      if (result.error && !isMissingSchema(result.error)) throw result.error
    }
  }

  const saveEvent = async (form) => {
    setSaving(true)
    setFormError('')
    try {
      if (form.reminder_when && form.reminder_when !== 'none') enablePush(user.id)
      if (form.event_type === 'memory') {
        await saveMemory(form)
      } else {
        await saveDate(form)
      }
      await load()
      setPanel(null)
    } catch (saveError) {
      setFormError(isMissingSchema(saveError) ? schemaHint : friendlyError(saveError, "We couldn't save that event."))
    } finally {
      setSaving(false)
    }
  }

  const saveMemory = async (form) => {
    const files = (form.photos || []).filter((photo) => photo.file && !photo.removed).map((photo) => photo.file)
    const urls = await uploadPhotos(files, 'memories')
    const memoryBody = {
      title: form.title.trim(),
      caption: form.caption.trim() || null,
      location: form.location.trim() || null,
      date: form.event_date,
      emoji: form.emoji || '📷',
      milestone_id: form.milestone_id || null,
    }
    const withoutLink = { ...memoryBody }
    delete withoutLink.milestone_id
    delete withoutLink.emoji
    if (form.id) {
      let saved = await supabase.from('memories').update(memoryBody).eq('id', form.id).eq('space_id', space.id)
      if (saved.error && isMissingSchema(saved.error)) {
        saved = await supabase.from('memories').update(withoutLink).eq('id', form.id).eq('space_id', space.id)
        if (!saved.error) setError(schemaHint)
      }
      if (saved.error) throw saved.error
      const removed = (form.photos || []).filter((photo) => photo.removed && photo.storedId)
      if (removed.length) await supabase.from('memory_photos').delete().in('id', removed.map((photo) => photo.storedId))
      if (urls.length) {
        await supabase.from('memory_photos').insert(urls.map((imageUrl) => ({ memory_id: form.id, space_id: space.id, image_url: imageUrl })))
      }
      return
    }
    let created = await supabase.from('memories').insert({
      ...memoryBody,
      space_id: space.id,
      user_id: user.id,
      image_url: urls[0] || null,
    }).select('id').single()
    if (created.error && isMissingSchema(created.error)) {
      created = await supabase.from('memories').insert({
        ...withoutLink,
        space_id: space.id,
        user_id: user.id,
        image_url: urls[0] || null,
      }).select('id').single()
      if (!created.error) setError(schemaHint)
    }
    if (created.error) throw created.error
    const data = created.data
    if (urls.length && data?.id) {
      await supabase.from('memory_photos').insert(urls.map((imageUrl) => ({ memory_id: data.id, space_id: space.id, image_url: imageUrl })))
    }
  }

  const saveDate = async (form) => {
    const payload = {
      title: form.title.trim(),
      event_date: form.event_date,
      description: form.description.trim() || null,
      recurrence: form.event_type === 'birthday' ? 'yearly' : (form.event_type === 'memory' ? 'none' : (form.recurrence || 'none')),
      reminder: Boolean(form.reminder_when && form.reminder_when !== 'none' && form.event_type !== 'memory'),
      event_type: form.event_type === 'anniversary' ? 'milestone' : (form.event_type === 'reminder' ? 'important' : form.event_type),
      emoji: form.emoji || defaultEmoji(form.event_type),
      start_time: form.event_type === 'important' && form.start_time ? form.start_time : null,
      end_time: null,
      reminder_when: form.event_type === 'memory' ? 'none' : (form.reminder_when || 'none'),
      count_milestones: Boolean(form.count_years || form.count_months),
      count_years: form.event_type === 'milestone' ? Boolean(form.count_years) : false,
      count_months: form.event_type === 'milestone' ? Boolean(form.count_months) : false,
      person_name: form.event_type === 'birthday' ? (form.person_name || '').trim() : null,
      subject_user_id: null,
      recurrence_days: form.recurrence === 'custom' ? form.recurrence_days.join(',') : null,
      time_zone: zone,
    }
    const previous = { ...payload }
    delete previous.emoji
    delete previous.count_years
    delete previous.count_months
    delete previous.person_name
    const legacy = {
      title: payload.title,
      event_date: payload.event_date,
      description: payload.description,
      recurrence: ['none', 'monthly', 'yearly'].includes(payload.recurrence) ? payload.recurrence : 'none',
      reminder: payload.reminder,
    }

    const write = (body, id) => (id
      ? supabase.from('important_dates').update(body).eq('id', id).eq('space_id', space.id).select('id').single()
      : supabase.from('important_dates').insert({ ...body, space_id: space.id, created_by: user.id }).select('id').single())

    if (form.id && form.scope === 'this' && form.was_recurring) {
      const root = dates.find((date) => date.id === form.root_id) || dates.find((date) => date.id === form.id)
      const excluded = [...new Set([...excludedKeys(root), form.occurrence_key])]
      let excludeResult = await supabase.from('important_dates').update({ excluded_dates: excluded }).eq('id', root.id)
      if (excludeResult.error && isMissingSchema(excludeResult.error)) throw excludeResult.error
      let created = await write({ ...payload, recurrence: 'none', occurrence_date: form.occurrence_key, series_id: root.id }, null)
      if (created.error && isMissingSchema(created.error)) {
        created = await write({ ...previous, recurrence: 'none', occurrence_date: form.occurrence_key, series_id: root.id }, null)
        if (!created.error) setError(schemaHint)
      }
      if (created.error && isMissingSchema(created.error)) {
        const hint = new Error(schemaHint)
        hint.friendly = true
        throw hint
      }
      if (created.error) throw created.error
      await saveDatePhotos(created.data.id, form.photos)
      return
    }

    if (form.id && form.scope === 'following' && form.was_recurring) {
      const root = dates.find((date) => date.id === form.root_id) || dates.find((date) => date.id === form.id)
      const untilResult = await supabase.from('important_dates').update({ recurrence_until: form.occurrence_key }).eq('id', root.id)
      if (untilResult.error && isMissingSchema(untilResult.error)) throw untilResult.error
      let created = await write(payload, null)
      if (created.error && isMissingSchema(created.error)) {
        created = await write(previous, null)
        if (!created.error) setError(schemaHint)
      }
      if (created.error && isMissingSchema(created.error)) {
        const hint = new Error(schemaHint)
        hint.friendly = true
        throw hint
      }
      if (created.error) throw created.error
      await saveDatePhotos(created.data.id, form.photos)
      return
    }

    let result = await write(payload, form.id)
    if (result.error && isMissingSchema(result.error)) {
      result = await write(previous, form.id)
      if (!result.error) setError(schemaHint)
    }
    if (result.error && isMissingSchema(result.error)) {
      result = await write(legacy, form.id)
      if (!result.error) setError(schemaHint)
    }
    if (result.error) throw result.error
    if (result.data?.id) await saveDatePhotos(result.data.id, form.photos)
  }

  const askDelete = (item) => {
    if (item.kind === 'date' && isRecurring(item.date)) {
      setPanel({ name: 'scope', action: 'delete', item })
      return
    }
    setPanel({ name: 'scope', action: 'delete-once', item })
  }

  const removeEvent = async (item, scope) => {
    setSaving(true)
    setError('')
    try {
      if (item.kind === 'memory') {
        const { error: deleteError } = await supabase.from('memories').delete().eq('id', item.memory.id).eq('space_id', space.id)
        if (deleteError) throw deleteError
      } else if (!isRecurring(item.date) || scope === 'all') {
        const rootId = item.date.series_id || item.date.id
        const { error: deleteError } = await supabase.from('important_dates').delete().eq('id', rootId).eq('space_id', space.id)
        if (deleteError) throw deleteError
      } else if (scope === 'this') {
        const root = dates.find((date) => date.id === (item.date.series_id || item.date.id))
        const excluded = [...new Set([...excludedKeys(root), item.occurrenceKey])]
        if (item.date.occurrence_date) {
          await supabase.from('important_dates').delete().eq('id', item.date.id)
        }
        const { error: updateError } = await supabase.from('important_dates').update({ excluded_dates: excluded }).eq('id', root.id)
        if (updateError) throw updateError
      } else {
        const rootId = item.date.series_id || item.date.id
        const { error: updateError } = await supabase.from('important_dates').update({ recurrence_until: item.occurrenceKey }).eq('id', rootId)
        if (updateError) throw updateError
      }
      await load()
      setPanel(null)
    } catch (deleteError) {
      setError(isMissingSchema(deleteError) ? schemaHint : friendlyError(deleteError, "We couldn't delete that event."))
    } finally {
      setSaving(false)
    }
  }

  const focus = focusDate()
  const weekStart = new Date(focus)
  weekStart.setDate(focus.getDate() - focus.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    return date
  })
  const when = new Date(cursor.year, cursor.month - 1, selected)
  const isCurrentMonth = cursor.year === today.getFullYear() && cursor.month === today.getMonth() + 1
  const heading = view === 'year'
    ? String(cursor.year)
    : view === 'week'
      ? weekLabel(weekStart, weekDays[6])
      : view === 'day'
        ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(focus)
        : monthTitle(cursor.year, cursor.month)

  const range = view === 'year'
    ? [new Date(cursor.year, 0, 1), new Date(cursor.year, 11, 31)]
    : view === 'week'
      ? [weekStart, weekDays[6]]
      : view === 'day'
        ? [focus, focus]
        : [new Date(cursor.year, cursor.month - 1, 1), new Date(cursor.year, cursor.month, 0)]
  const agenda = []
  for (let date = new Date(range[0]); date <= range[1]; date.setDate(date.getDate() + 1)) {
    itemsOn(date.getFullYear(), date.getMonth() + 1, date.getDate()).forEach((item) => agenda.push(item))
  }
  const listTitle = view === 'year'
    ? String(cursor.year)
    : view === 'month'
      ? monthTitle(cursor.year, cursor.month)
      : view === 'week'
        ? weekLabel(weekStart, weekDays[6])
        : new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(focus)
  const emptyList = view === 'year'
    ? 'Nothing this year.'
    : view === 'month'
      ? 'Nothing this month.'
      : view === 'week'
        ? 'Nothing this week.'
        : 'Nothing on this day.'
  const eventLinks = linkChoices(dates)
  const viewingEvent = panel?.name === 'detail' && panel.item?.kind === 'date' && isLinkable(panel.item.date)
    ? panel.item.date
    : null
  const linkedMemories = viewingEvent
    ? memories.filter((memory) => memory.milestone_id === viewingEvent.id).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    : []
  const linkedMilestone = panel?.name === 'detail' && panel.item?.kind === 'memory'
    ? dates.find((date) => date.id === panel.item.memory?.milestone_id)
    : null
  const detailWhen = panel?.item?.year
    ? new Date(panel.item.year, (panel.item.month || 1) - 1, panel.item.day || 1)
    : when

  return (
    <>
      <ErrorMessage message={error} />
      {loading ? (
        <LoadingState compact message="Loading the calendar..." />
      ) : (
        <section className="calendar" aria-label={heading}>
          <div className="calendar__nav">
            <div className="calendar__period">
              <button type="button" className="calendar__shift" aria-label={`Previous ${view}`} onClick={() => go(-1)}>‹</button>
              <button type="button" className="calendar__shift" aria-label={`Next ${view}`} onClick={() => go(1)}>›</button>
              <h2>{heading}</h2>
            </div>
            <button type="button" className="calendar__add" onClick={startCreate}>+ add event</button>
          </div>
          <div className="calendar__views" role="tablist" aria-label="Calendar view">
            {['year', 'month', 'week', 'day'].map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={view === name}
                className={`calendar__view ${view === name ? 'calendar__view--on' : ''}`}
                onClick={() => setView(name)}
              >
                {name}
              </button>
            ))}
          </div>
          {view === 'year' && (
            <div className="calendar__year">
              {Array.from({ length: 12 }, (_, index) => {
                const month = index + 1
                let icons = []
                for (let day = 1; day <= daysInMonth(cursor.year, month) && icons.length < 3; day += 1) {
                  icons = [...new Set([...icons, ...itemsOn(cursor.year, month, day).map((item) => item.icon)])].slice(0, 3)
                }
                const isTodayMonth = cursor.year === today.getFullYear() && month === today.getMonth() + 1
                const label = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(cursor.year, index, 1))
                return (
                  <button
                    key={month}
                    type="button"
                    className={`calendar__month ${isTodayMonth ? 'calendar__day--today' : ''} ${cursor.month === month ? 'calendar__day--selected' : ''}`}
                    onClick={() => {
                      setCursor({ year: cursor.year, month })
                      setSelected(isTodayMonth ? today.getDate() : 1)
                      setView('month')
                    }}
                  >
                    <span>{label}</span>
                    <span className="calendar__marks">{icons.map((icon) => <EventIcon key={icon} name={icon} size={12} />)}</span>
                  </button>
                )
              })}
            </div>
          )}
          {view === 'month' && (
            <>
              <div className="calendar__weekdays" aria-hidden="true">
                {weekdays.map((day) => <span key={day}>{day.slice(0, 1)}</span>)}
              </div>
              <div className="calendar__grid">
                {monthCells(cursor.year, cursor.month).map((day, index) => {
                  if (!day) return <span key={`empty-${index}`} />
                  const items = itemsFor(day)
                  const icons = [...new Set(items.map((item) => item.icon))].slice(0, 3)
                  const isToday = isCurrentMonth && day === today.getDate()
                  const isSelected = day === selected
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`calendar__day ${isToday ? 'calendar__day--today' : ''} ${isSelected ? 'calendar__day--selected' : ''}`}
                      aria-pressed={isSelected}
                      aria-label={dayTitle(cursor.year, cursor.month, day)}
                      onClick={() => setSelected(day)}
                    >
                      <span className="calendar__number">{day}</span>
                      <span className="calendar__marks">{icons.map((icon) => <EventIcon key={icon} name={icon} size={12} />)}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
          {view === 'week' && (
            <>
              <div className="calendar__weekdays" aria-hidden="true">
                {weekdays.map((day) => <span key={day}>{day.slice(0, 1)}</span>)}
              </div>
              <div className="calendar__grid">
                {weekDays.map((date) => {
                  const year = date.getFullYear()
                  const month = date.getMonth() + 1
                  const day = date.getDate()
                  const items = itemsOn(year, month, day)
                  const icons = [...new Set(items.map((item) => item.icon))].slice(0, 3)
                  const isToday = year === today.getFullYear() && month === today.getMonth() + 1 && day === today.getDate()
                  const isSelected = year === cursor.year && month === cursor.month && day === selected
                  return (
                    <button
                      key={`${year}-${month}-${day}`}
                      type="button"
                      className={`calendar__day ${isToday ? 'calendar__day--today' : ''} ${isSelected ? 'calendar__day--selected' : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => setFocus(date)}
                    >
                      <span className="calendar__number">{day}</span>
                      <span className="calendar__marks">{icons.map((icon) => <EventIcon key={icon} name={icon} size={12} />)}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
          {view === 'day' && (
            <p className="calendar__focus">{dayTitle(cursor.year, cursor.month, selected)}</p>
          )}
          <div className="calendar__footer">
            <button type="button" className="text-button" onClick={() => setFocus(new Date())}>Today</button>
          </div>
        </section>
      )}

      {!loading && (
        <section className="calendar-day" aria-label={listTitle}>
          <div className="calendar-day__head">
            <h2>{listTitle}</h2>
            <div className="calendar-views" role="group" aria-label="Day layout">
              <button type="button" aria-pressed={agendaLayout === 'card'} aria-label="Card view" className={agendaLayout === 'card' ? 'calendar-views__on' : ''} onClick={() => setAgendaLayout('card')}>
                <LayoutGrid size={18} aria-hidden="true" />
              </button>
              <button type="button" aria-pressed={agendaLayout === 'list'} aria-label="List view" className={agendaLayout === 'list' ? 'calendar-views__on' : ''} onClick={() => setAgendaLayout('list')}>
                <List size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
          {agenda.length === 0 && <p className="muted">{emptyList}</p>}
          <Agenda
            items={agenda}
            layout={agendaLayout}
            grouped={view !== 'day'}
            onOpen={openDetail}
          />
        </section>
      )}

      <Modal
        open={panel?.name === 'detail'}
        title={viewTitle(panel?.item, detailWhen)}
        className="modal--sheet modal--event"
        onClose={() => setPanel(null)}
      >
        {panel?.name === 'detail' && (
          <EventView
            item={panel.item}
            when={detailWhen}
            photos={photos}
            members={members}
            currentUserId={user.id}
            spaceName={space.name}
            viewerZone={zone}
            linkedMemories={linkedMemories}
            linkedMilestone={linkedMilestone}
            onOpenMemory={openMemoryDetail}
            onOpenMilestone={openMilestoneDetail}
            onAddMemory={viewingEvent ? () => startAddMemory(viewingEvent.id) : undefined}
            onEdit={() => {
              if (panel.item.kind === 'date' && isRecurring(panel.item.date)) setPanel({ name: 'scope', action: 'edit', item: panel.item })
              else startEdit(panel.item, 'all')
            }}
            onDelete={() => askDelete(panel.item)}
          />
        )}
      </Modal>

      <Modal
        open={panel?.name === 'form'}
        title={panel?.initial?.id ? 'Edit event' : 'Add event'}
        className="modal--sheet"
        onClose={() => setPanel(null)}
      >
        {panel?.name === 'form' && (
          <EventForm
            key={`${panel.initial.id || 'new'}-${panel.initial.scope}-${panel.initial.event_type}`}
            initial={{ ...panel.initial, photos: panel.initial.photos ?? photos }}
            links={eventLinks}
            userId={user.id}
            saving={saving}
            error={formError}
            onSubmit={saveEvent}
          />
        )}
      </Modal>

      <Modal
        open={panel?.name === 'scope' || panel?.name === 'confirm'}
        title={panel?.action === 'edit' ? 'Edit recurring event' : 'Delete this event?'}
        className="modal--sheet"
        onClose={() => setPanel(null)}
      >
        {panel?.name === 'scope' && panel.action === 'delete-once' && (
          <div className="scope-sheet">
            <p>Delete this event?</p>
            <button type="button" className="scope-sheet__danger" disabled={saving} onClick={() => removeEvent(panel.item, 'all')}>Delete</button>
            <button type="button" onClick={() => setPanel({ name: 'detail', item: panel.item })}>Cancel</button>
          </div>
        )}
        {panel?.name === 'scope' && panel.action !== 'delete-once' && (
          <div className="scope-sheet">
            <p>{panel.action === 'edit' ? 'What would you like to change?' : 'Delete this event?'}</p>
            {['this', 'following', 'all'].map((scope) => (
              <button
                key={scope}
                type="button"
                disabled={saving}
                onClick={() => {
                  if (panel.action === 'edit') startEdit(panel.item, scope)
                  else removeEvent(panel.item, scope)
                }}
              >
                {scope === 'this' ? 'This event only' : scope === 'following' ? 'This and following events' : 'All events'}
              </button>
            ))}
            <button type="button" onClick={() => setPanel({ name: 'detail', item: panel.item })}>Cancel</button>
          </div>
        )}
      </Modal>
    </>
  )
}

export default function Calendar({ embedded = false }) {
  if (embedded) return <CalendarContent />
  return (
    <RequireSpace>
      <main className="page-shell">
        <CalendarContent />
      </main>
    </RequireSpace>
  )
}
