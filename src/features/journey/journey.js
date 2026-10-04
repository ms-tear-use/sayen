import { dateParts, formatDateOnly } from '../space/dates'

export function journeyTitle(name) {
  const clean = String(name || '').trim()
  if (!clean) return 'Your journey'
  return `${clean}'s journey`
}

export function journeyStart(dateKey) {
  const parts = dateParts(dateKey)
  if (!parts) return null
  return new Date(parts.year, parts.month - 1, parts.day)
}

function addMonths(start, count) {
  const next = new Date(start.getFullYear(), start.getMonth() + count, 1)
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(start.getDate(), last))
  next.setHours(0, 0, 0, 0)
  return next
}

function unit(id, value, singular) {
  return { id, value, label: value === 1 ? singular : `${singular}s` }
}

export function togetherCount(dateKey, now = new Date()) {
  const start = journeyStart(dateKey)
  if (!start) return null
  if (now < start) return { upcoming: true, start }

  let years = 0
  while (years < 200 && addMonths(start, (years + 1) * 12) <= now) years += 1
  let months = 0
  while (months < 12 && addMonths(start, years * 12 + months + 1) <= now) months += 1
  const cursor = addMonths(start, years * 12 + months)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const wholeDays = Math.max(0, Math.round((today - cursor) / 86400000))
  const totalDays = Math.max(0, Math.round((today - start) / 86400000))

  return {
    upcoming: false,
    start,
    totalDays,
    units: [
      unit('years', years, 'year'),
      unit('months', months, 'month'),
      unit('days', wholeDays, 'day'),
      unit('hours', now.getHours(), 'hour'),
    ],
  }
}

export function journeyCaption(dateKey, now = new Date()) {
  const count = togetherCount(dateKey, now)
  if (!count) return ''
  if (count.upcoming) return `Starts ${formatDateOnly(dateKey)}`
  if (count.totalDays >= 1) {
    const days = count.totalDays.toLocaleString('en-US')
    return count.totalDays === 1 ? '1 day of loving each other' : `${days} days of loving each other`
  }
  return `Since ${formatDateOnly(dateKey)}`
}

export function journeyNodeKind(item) {
  if (item?.kind === 'achievement') return 'spark'
  const text = `${item?.title || ''} ${item?.location || ''} ${item?.note || ''}`
  if (/flight|airport|plane|travel|trip|vacation|visit/i.test(text)) return 'travel'
  if (/\b(house|home|moved|moving|apartment)\b/i.test(text)) return 'home'
  return 'heart'
}

export const loveMarks = [
  { id: 'began', label: 'The day it began', emoji: '🤍', days: 0 },
  { id: 'week', label: '1 week of love', emoji: '🌿', days: 7 },
  { id: 'fortnight', label: '2 weeks of love', emoji: '🌱', days: 14 },
  { id: 'month', label: '1 month of love', emoji: '🌸', months: 1 },
  { id: '100', label: '100 days of love', emoji: '💫', days: 100 },
  { id: '6mo', label: '6 months of love', emoji: '🌙', months: 6 },
  { id: 'year', label: '1 year of love', emoji: '✨', years: 1 },
  { id: '500', label: '500 days of love', emoji: '🌟', days: 500 },
  { id: '2y', label: '2 years of love', emoji: '💞', years: 2 },
  { id: '1000', label: '1,000 days of love', emoji: '🎊', days: 1000 },
  { id: '3y', label: '3 years of love', emoji: '🎉', years: 3 },
  { id: '5y', label: '5 years of love', emoji: '🕊️', years: 5 },
  { id: '10y', label: '10 years of love', emoji: '👑', years: 10 },
]

export function markMoment(start, mark) {
  if (!start) return null
  if (mark.years) return addMonths(start, mark.years * 12)
  if (mark.months) return addMonths(start, mark.months)
  const next = new Date(start)
  next.setDate(next.getDate() + (mark.days || 0))
  return next
}

export function journeyMarks(dateKey, now = new Date()) {
  const start = journeyStart(dateKey)
  if (!start) return []
  return loveMarks.map((mark) => {
    const at = markMoment(start, mark)
    return {
      ...mark,
      at,
      reached: Boolean(at && at <= now),
      key: at ? `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}` : '',
      when: at ? formatDateOnly(`${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`) : '',
    }
  }).sort((a, b) => a.at - b.at)
}
