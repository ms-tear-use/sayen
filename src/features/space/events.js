import { dateParts, formatDateOnly, formatMonthDay, ordinal, recurrenceOf } from './dates'
import { formatClock } from '../../lib/timezone'

function monthLength(year, month) {
  return new Date(year, month, 0).getDate()
}

export const eventTypes = [
  { id: 'milestone', label: 'Milestone', emoji: '✨', description: 'A meaningful date that can repeat and count the years or months.' },
  { id: 'birthday', label: 'Birthday', emoji: '🎂', description: 'A birth date for a person or a pet. Their age is counted for you.' },
  { id: 'important', label: 'Important Date', emoji: '📌', description: 'A date to remember, like a flight, appointment, or deadline.' },
  { id: 'memory', label: 'Memory', emoji: '📷', description: 'A moment that already happened, with photos and a caption.' },
]

export const milestoneEmoji = ['✨', '⭐', '💫', '🕊️', '🌸']
export const birthdayEmoji = ['🎂', '🎉', '🎈', '🥳', '🎁']
export const importantEmoji = ['📌', '📅', '✈️', '🎟️', '🔔']
export const memoryEmoji = ['📷', '📸', '💭', '🌅', '🫶']

const emojiChoices = {
  milestone: milestoneEmoji,
  birthday: birthdayEmoji,
  important: importantEmoji,
  memory: memoryEmoji,
}

export function emojiOptions(type) {
  return emojiChoices[type] || importantEmoji
}

export function defaultEmoji(type) {
  return eventTypes.find((item) => item.id === type)?.emoji || '📌'
}

export const reminderOptions = [
  { id: 'none', label: 'None' },
  { id: 'at', label: 'At time of event' },
  { id: '10m', label: '10 minutes before' },
  { id: '1h', label: '1 hour before' },
  { id: '1d', label: '1 day before' },
  { id: '1w', label: '1 week before' },
]

export const dayChoices = [
  { id: 0, label: 'S' },
  { id: 1, label: 'M' },
  { id: 2, label: 'T' },
  { id: 3, label: 'W' },
  { id: 4, label: 'T' },
  { id: 5, label: 'F' },
  { id: 6, label: 'S' },
]

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function inferType(event) {
  if (event?.kind === 'memory' || event?.event_type === 'memory') return 'memory'
  const type = event?.event_type
  if (type === 'milestone' || type === 'anniversary') return 'milestone'
  if (type === 'birthday') return 'birthday'
  if (type === 'important' || type === 'reminder') return 'important'
  const title = event?.title || ''
  if (/birthday/i.test(title)) return 'birthday'
  if (/monthsary|anniversary|memorial/i.test(title)) return 'milestone'
  return 'important'
}

export function eventEmoji(event) {
  const stored = String(event?.emoji || '').trim()
  if (stored) return stored
  return defaultEmoji(inferType(event))
}

export function eventIcon(event) {
  return eventEmoji(event)
}

export function personNameOf(event) {
  const stored = String(event?.person_name || '').trim()
  if (stored) return stored
  const match = String(event?.title || '').trim().match(/^(.*?)['’]s\s+birthday$/i)
  return match?.[1]?.trim() || ''
}

function yearCount(event, when) {
  const parts = dateParts(event?.event_date)
  if (!parts || !when) return 0
  return when.getFullYear() - parts.year
}

function monthCount(event, when) {
  const parts = dateParts(event?.event_date)
  if (!parts || !when) return 0
  return (when.getFullYear() - parts.year) * 12 + ((when.getMonth() + 1) - parts.month)
}

export function countsYears(event) {
  if (event?.count_years === true) return true
  if (event?.count_years === false) return false
  return inferType(event) === 'milestone' && event?.count_milestones === true && !/monthsary/i.test(event?.title || '')
}

export function countsMonths(event) {
  if (event?.count_months === true) return true
  if (event?.count_months === false) return false
  return inferType(event) === 'milestone' && event?.count_milestones === true && (/monthsary/i.test(event?.title || '') || event?.recurrence === 'monthly')
}

export function reminderOf(event) {
  if (event?.reminder_when) return event.reminder_when
  if (event?.reminder) return '1d'
  return 'none'
}

export function reminderLabel(value) {
  return reminderOptions.find((item) => item.id === value)?.label || 'None'
}

export function parseDays(value) {
  if (Array.isArray(value)) return value.map(Number).filter((day) => day >= 0 && day <= 6)
  return String(value || '')
    .split(',')
    .map((day) => Number(day.trim()))
    .filter((day) => day >= 0 && day <= 6)
}

export function excludedKeys(event) {
  const value = event?.excluded_dates
  if (Array.isArray(value)) return value.map((item) => String(item).slice(0, 10))
  return String(value || '')
    .replace(/[{}]/g, '')
    .split(',')
    .map((item) => item.trim().slice(0, 10))
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item))
}

export function dateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function occursOn(event, year, month, day) {
  if (event?.occurrence_date) {
    return String(event.occurrence_date).slice(0, 10) === dateKey(year, month, day)
  }

  const parts = dateParts(event?.event_date)
  if (!parts) return false
  const key = dateKey(year, month, day)
  if (excludedKeys(event).includes(key)) return false
  if (event.recurrence_until && key >= String(event.recurrence_until).slice(0, 10)) return false

  const cursor = new Date(year, month - 1, day)
  const start = new Date(parts.year, parts.month - 1, parts.day)
  if (cursor < start) return false

  const mode = event.recurrence || recurrenceOf(event)
  if (mode === 'daily') return true
  if (mode === 'weekly') return cursor.getDay() === start.getDay()
  if (mode === 'weekdays') return cursor.getDay() >= 1 && cursor.getDay() <= 5
  if (mode === 'weekends') return cursor.getDay() === 0 || cursor.getDay() === 6
  if (mode === 'custom') return parseDays(event.recurrence_days).includes(cursor.getDay())
  if (mode === 'yearly') return parts.month === month && parts.day === day && cursor.getDate() === day
  if (mode === 'monthly') return day === Math.min(parts.day, monthLength(year, month))
  return parts.year === year && parts.month === month && parts.day === day
}

export function isRecurring(event) {
  if (!event || event.occurrence_date || event.kind === 'memory') return false
  const mode = event.recurrence || 'none'
  return mode !== 'none'
}

export function repeatLabel(event) {
  const mode = event?.recurrence || 'none'
  if (mode === 'daily') return 'Every day'
  if (mode === 'weekly') return 'Every week'
  if (mode === 'weekdays') return 'Every weekday'
  if (mode === 'weekends') return 'Every weekend'
  if (mode === 'monthly') return 'Every month'
  if (mode === 'yearly') return 'Every year'
  if (mode === 'custom') {
    const names = parseDays(event.recurrence_days).map((day) => dayNames[day])
    return names.length ? names.join(', ') : 'Custom'
  }
  return 'Does not repeat'
}

export function eventLabel(event, when) {
  const type = inferType(event)
  if (type === 'birthday') {
    const age = yearCount(event, when)
    const name = personNameOf(event)
    if (age >= 1) return name ? `${name}'s ${ordinal(age)} birthday` : `${ordinal(age)} birthday`
    return name ? `${name}'s birthday` : (event?.title || 'Birthday')
  }
  return event?.title || (type === 'memory' ? 'Memory' : 'Event')
}

export function eventDetail(event, when) {
  if (inferType(event) !== 'milestone') return ''
  const bits = []
  const years = yearCount(event, when)
  const months = monthCount(event, when)
  if (countsYears(event) && years >= 1) bits.push(`${ordinal(years)} Year`)
  if (countsMonths(event) && months >= 1) bits.push(`${ordinal(months)} Month`)
  return bits.join(' · ')
}

export function hasReminder(event) {
  if (inferType(event) === 'memory') return false
  const when = reminderOf(event)
  return Boolean(when && when !== 'none')
}

export function typeName(type) {
  return eventTypes.find((item) => item.id === type)?.label || 'Event'
}

export function isLinkable(event) {
  if (!event || event.occurrence_date || event.event_type === 'schedule') return false
  const type = inferType(event)
  return type === 'milestone' || type === 'birthday' || type === 'important'
}

export function linkLabel(event) {
  const type = inferType(event)
  const title = String(event?.title || '').trim() || typeName(type)
  return `${typeName(type)} · ${title}`
}

export function linkChoices(events) {
  const order = { milestone: 0, birthday: 1, important: 2 }
  return [...(events || [])]
    .filter(isLinkable)
    .sort((a, b) => {
      const byType = (order[inferType(a)] ?? 9) - (order[inferType(b)] ?? 9)
      if (byType) return byType
      return String(a.title || '').localeCompare(String(b.title || ''))
    })
}

export function presentEvent(source, options = {}) {
  const kind = options.kind || 'date'
  const type = kind === 'memory' ? 'memory' : inferType(source)
  const when = options.when || new Date()
  const emoji = kind === 'memory'
    ? (String(source?.emoji || '').trim() || '📷')
    : eventEmoji(source)
  const title = kind === 'memory' ? (source?.title || 'Memory') : (eventLabel(source, when) || 'Event')
  const detail = kind === 'memory' ? '' : eventDetail(source, when)
  const occurrenceKey = String(options.dateKey || '').slice(0, 10)
  const originalKey = String(source?.event_date || source?.date || occurrenceKey).slice(0, 10)
  const dateText = formatDateOnly(type === 'important' ? (occurrenceKey || originalKey) : originalKey)
  const time = options.time ? formatClock(options.time) : ''
  const location = kind === 'memory' ? (source?.location || '') : ''
  const photo = options.photo || ''
  const ago = options.ago || ''
  const note = String(kind === 'memory' ? (source?.caption || '') : (source?.description || '')).trim()

  let line = ''
  if (type === 'important') line = [dateText, time].filter(Boolean).join(' · ')
  else if (type !== 'milestone' || !detail) line = dateText

  const listLines = []
  if (type === 'milestone' && detail) {
    if (dateText) listLines.push(`Date: ${dateText}`)
    listLines.push(`Count: ${detail}`)
  } else {
    if (type === 'memory' && ago) listLines.push(ago)
    if (type === 'memory' && location) listLines.push(location)
    if (dateText && type !== 'memory') listLines.push(dateText)
    if (type === 'memory' && dateText) listLines.push(dateText)
    if (type === 'important' && time) listLines.push(time)
  }

  return {
    emoji,
    type,
    typeLabel: ago || typeName(type),
    title,
    line,
    listLines,
    note,
    photo,
    location,
    dateText,
    detail,
    time,
  }
}

export function shiftKey(key, days) {
  const parts = dateParts(key)
  if (!parts) return key
  const next = new Date(parts.year, parts.month - 1, parts.day + days)
  return dateKey(next.getFullYear(), next.getMonth() + 1, next.getDate())
}
