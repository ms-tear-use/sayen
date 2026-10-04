export function dateParts(value) {
  if (!value) return null
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function formatDateOnly(value) {
  const parts = dateParts(value)
  if (!parts) return ''

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(parts.year, parts.month - 1, parts.day))
}

export function formatMonthLabel(value) {
  const parts = dateParts(value)
  if (!parts) return 'Undated'

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(parts.year, parts.month - 1, 1))
}

export function isYearly(title = '') {
  return /birthday|anniversary/i.test(title)
}

function dateOn(year, monthIndex, day) {
  const last = new Date(year, monthIndex + 1, 0).getDate()
  return new Date(year, monthIndex, Math.min(day, last))
}

export function recurrenceOf(date) {
  if (date?.recurrence) return date.recurrence
  if (/monthsary/i.test(date?.title || '')) return 'monthly'
  if (isYearly(date?.title)) return 'yearly'
  return 'none'
}

export function defaultRecurrence(kind) {
  if (kind === 'Monthsary') return 'monthly'
  if (kind === 'Birthday' || kind === 'Anniversary') return 'yearly'
  return 'none'
}

export function nextOccurrence(value, recurrence, today = new Date()) {
  const parts = dateParts(value)
  if (!parts) return null

  const current = startOfDay(today)
  const yearly = recurrence === true || recurrence === 'yearly'
  if (yearly) {
    let next = dateOn(current.getFullYear(), parts.month - 1, parts.day)
    if (next < current) next = dateOn(current.getFullYear() + 1, parts.month - 1, parts.day)
    return next
  }

  if (recurrence === 'monthly') {
    let next = dateOn(current.getFullYear(), current.getMonth(), parts.day)
    if (next < current) next = dateOn(current.getFullYear(), current.getMonth() + 1, parts.day)
    return next
  }

  const start = new Date(parts.year, parts.month - 1, parts.day)
  if (recurrence === 'daily') return start > current ? start : current
  if (recurrence === 'weekly') {
    if (start >= current) return start
    const delta = (start.getDay() - current.getDay() + 7) % 7
    return new Date(current.getFullYear(), current.getMonth(), current.getDate() + delta)
  }

  return start
}

function dayCount(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / 86400000)
}

export function upcomingLabel(value, title, today = new Date(), recurrence) {
  const mode = recurrence || recurrenceOf({ title })
  const next = nextOccurrence(value, mode, today)
  if (!next) return ''

  const current = startOfDay(today)
  if (mode === 'none' && next < current) return ''

  const days = dayCount(current, next)
  if (days < 0) return ''
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

export function nextUpcoming(dates = [], today = new Date()) {
  return listUpcoming(dates, today, 1)[0] || null
}

export function listUpcoming(dates = [], today = new Date(), limit = 4) {
  return dates
    .filter((date) => date.event_type !== 'schedule' && date.event_type !== 'memory')
    .map((date) => {
      const mode = recurrenceOf(date)
      const label = upcomingLabel(date.event_date, date.title, today, mode)
      const next = nextOccurrence(date.event_date, mode, today)
      if (!label || !next) return null
      const month = String(next.getMonth() + 1).padStart(2, '0')
      const day = String(next.getDate()).padStart(2, '0')
      return { ...date, label, sort: next.getTime(), nextKey: `${next.getFullYear()}-${month}-${day}` }
    })
    .filter(Boolean)
    .sort((a, b) => a.sort - b.sort)
    .slice(0, limit)
}

export function memoriesOnThisDay(memories = [], todayKeyValue) {
  const today = dateParts(todayKeyValue)
  if (!today) return []
  return memories.flatMap((memory) => {
    const parts = dateParts(memory.date)
    if (!parts || parts.month !== today.month || parts.day !== today.day || parts.year >= today.year) return []
    const years = today.year - parts.year
    return [{
      ...memory,
      years,
      ago: years === 1 ? '1 year ago today' : `${years} years ago today`,
    }]
  }).sort((a, b) => a.years - b.years)
}

export function formatMonthDay(value) {
  const parts = dateParts(value)
  if (!parts) return ''
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date(parts.year, parts.month - 1, parts.day))
}

export function daysTogether(dates = [], today = new Date()) {
  const anchor = dates.find((date) => /anniversary/i.test(date.title || ''))
    || dates.find((date) => /first met/i.test(date.title || ''))

  if (!anchor?.event_date) return ''

  const parts = dateParts(anchor.event_date)
  if (!parts) return ''

  const start = new Date(parts.year, parts.month - 1, parts.day)
  const current = startOfDay(today)
  if (start > current) return ''

  const days = dayCount(start, current)
  if (days === 0) return 'together since today'
  if (days === 1) return '1 day together'
  return `${days} days together`
}

export const datePresets = ['Birthday', 'Anniversary', 'Monthsary', 'First met', 'First date', 'Next visit']

export function todayKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function ordinal(number) {
  const value = Math.abs(Math.trunc(number))
  const tail = value % 100
  if (tail >= 11 && tail <= 13) return `${value}th`
  if (value % 10 === 1) return `${value}st`
  if (value % 10 === 2) return `${value}nd`
  if (value % 10 === 3) return `${value}rd`
  return `${value}th`
}

function celebrationKind(title = '') {
  if (/birthday/i.test(title)) return 'birthday'
  if (/monthsary/i.test(title)) return 'monthsary'
  if (/anniversary/i.test(title)) return 'anniversary'
  return ''
}

function subjectName(title, kind, spaceName) {
  const text = String(title || '').trim()
  const possessive = text.match(/^(.*?)['’]s\s+(birthday|anniversary|monthsary)$/i)
  if (possessive?.[1]?.trim()) return possessive[1].trim()
  const named = text.match(/^(.*?)\s+(birthday|anniversary|monthsary)$/i)
  if (named?.[1]?.trim()) return named[1].trim()
  if (kind === 'birthday') return ''
  return (spaceName || 'sayen').trim()
}

export function celebrationLabel(date, when, spaceName = 'sayen') {
  const kind = date?.event_type === 'birthday'
    ? 'birthday'
    : date?.event_type === 'anniversary'
      ? (/monthsary/i.test(date?.title || '') || date?.recurrence === 'monthly' ? 'monthsary' : 'anniversary')
      : celebrationKind(date?.title)
  const parts = dateParts(date?.event_date)
  if (!kind || !parts || !when) return date?.title || ''

  const count = kind === 'monthsary'
    ? (when.getFullYear() - parts.year) * 12 + ((when.getMonth() + 1) - parts.month)
    : when.getFullYear() - parts.year

  if (date.count_milestones === false && kind !== 'birthday') return date.title || ''

  const numbered = kind === 'anniversary' && date.count_milestones === true ? count + 1 : count
  if (numbered < 1) return date.title

  const name = subjectName(date.title, kind, spaceName)
  const word = kind.charAt(0).toUpperCase() + kind.slice(1)
  const phrase = `${ordinal(numbered)} ${word}`
  if (!name || /^(our)$/i.test(name) || name.toLowerCase() === String(spaceName || '').toLowerCase()) return phrase
  return `${name}'s ${phrase}`
}
