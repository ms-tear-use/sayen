import { dateParts } from './dates'
import { dateKey as eventKey, eventDetail, eventEmoji, eventLabel, hasReminder, occursOn, shiftKey } from './events'
import { viewerWhen } from '../../lib/timezone'

export const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function shiftMonth(year, month, delta) {
  const next = new Date(year, month - 1 + delta, 1)
  return { year: next.getFullYear(), month: next.getMonth() + 1 }
}

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

export function monthCells(year, month) {
  const pad = new Date(year, month - 1, 1).getDay()
  const count = daysInMonth(year, month)
  const cells = Array.from({ length: pad }, () => null)
  for (let day = 1; day <= count; day += 1) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function monthTitle(year, month) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))
}

export function dayTitle(year, month, day) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(year, month - 1, day))
}

export function dateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function localHit(event, year, month, day, viewerZone) {
  const key = eventKey(year, month, day)
  const clock = event.start_time ? String(event.start_time).slice(0, 5) : ''
  const zone = event.time_zone || viewerZone || ''

  if (event.occurrence_date) {
    const wallDate = String(event.event_date || event.occurrence_date).slice(0, 10)
    const local = clock ? viewerWhen(wallDate, clock, zone, viewerZone || zone) : { dateKey: String(event.occurrence_date).slice(0, 10), time: '' }
    if (local.dateKey !== key) return null
    return { sourceKey: String(event.occurrence_date).slice(0, 10), localTime: local.time }
  }

  if (!clock || !zone || !viewerZone || zone === viewerZone) {
    if (!occursOn(event, year, month, day)) return null
    return { sourceKey: key, localTime: clock }
  }

  for (let shift = -2; shift <= 2; shift += 1) {
    const source = shiftKey(key, shift)
    const parts = dateParts(source)
    if (!parts || !occursOn(event, parts.year, parts.month, parts.day)) continue
    const local = viewerWhen(source, clock, zone, viewerZone)
    if (local.dateKey === key) return { sourceKey: source, localTime: local.time }
  }
  return null
}

export function dayItems(dates, memories, year, month, day, spaceName = 'sayen', viewerZone = '') {
  const items = []
  const when = new Date(year, month - 1, day)
  const hits = []

  ;(dates || []).forEach((date) => {
    if (date.event_type === 'schedule') return
    const hit = localHit(date, year, month, day, viewerZone)
    if (hit) hits.push({ date, ...hit })
  })

  const covered = new Set(hits.filter((item) => item.date.occurrence_date && item.date.series_id).map((item) => item.date.series_id))

  hits.forEach((hit) => {
    if (!hit.date.occurrence_date && covered.has(hit.date.id)) return
    items.push({
      id: `date-${hit.date.id}-${year}-${month}-${day}`,
      kind: 'date',
      icon: eventEmoji(hit.date),
      title: eventLabel(hit.date, when, spaceName),
      detail: eventDetail(hit.date, when),
      reminded: hasReminder(hit.date),
      date: hit.date,
      sourceKey: hit.sourceKey,
      localTime: hit.localTime,
    })
  })

  memories.forEach((memory) => {
    const parts = dateParts(memory.date)
    if (!parts || parts.year !== year || parts.month !== month || parts.day !== day) return
    items.push({
      id: `memory-${memory.id}`,
      kind: 'memory',
      icon: memory.emoji || '📷',
      title: memory.title,
      detail: memory.location || '',
      reminded: false,
      memory,
    })
  })

  return items
}
