import { zonedParts } from '../../lib/timezone'

export const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function minutes(value) {
  const [hour, minute] = String(value || '').slice(0, 5).split(':').map(Number)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return hour * 60 + minute
}

export function scheduleStatus(blocks, timeZone, now = new Date()) {
  const clock = zonedParts(timeZone, now)
  const nowMinutes = clock.hour * 60 + clock.minute
  const today = (blocks || []).filter((block) => happensOn(block.days, clock.weekday))
  const current = today
    .filter((block) => {
      const start = minutes(block.starts_at)
      const end = minutes(block.ends_at)
      return start != null && end != null && nowMinutes >= start && nowMinutes < end
    })
    .sort((a, b) => (minutes(b.starts_at) - minutes(a.starts_at)))[0]

  if (!current) return null
  return { label: current.title }
}

export function scheduleDays(days) {
  const source = Array.isArray(days)
    ? days
    : String(days || '').replace(/[{}]/g, '').split(',')

  return source
    .map((day) => Number(String(day).trim()))
    .filter((day) => day >= 0 && day <= 6)
}

export function happensOn(days, weekday) {
  return scheduleDays(days).includes(Number(weekday))
}

export function dayList(days) {
  return scheduleDays(days).map((day) => dayLabels[day]).join(', ')
}
