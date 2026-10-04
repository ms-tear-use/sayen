const FLAGS = {
  'Asia/Manila': '🇵🇭',
  'Asia/Dubai': '🇦🇪',
  'Asia/Riyadh': '🇸🇦',
  'Asia/Qatar': '🇶🇦',
  'Asia/Kuwait': '🇰🇼',
  'Asia/Bahrain': '🇧🇭',
  'Asia/Singapore': '🇸🇬',
  'Asia/Hong_Kong': '🇭🇰',
  'Asia/Shanghai': '🇨🇳',
  'Asia/Tokyo': '🇯🇵',
  'Asia/Seoul': '🇰🇷',
  'Asia/Kolkata': '🇮🇳',
  'Asia/Bangkok': '🇹🇭',
  'Australia/Sydney': '🇦🇺',
  'Australia/Melbourne': '🇦🇺',
  'Pacific/Auckland': '🇳🇿',
  'Europe/London': '🇬🇧',
  'Europe/Paris': '🇫🇷',
  'Europe/Berlin': '🇩🇪',
  'Europe/Madrid': '🇪🇸',
  'Europe/Rome': '🇮🇹',
  'America/Los_Angeles': '🇺🇸',
  'America/Denver': '🇺🇸',
  'America/Chicago': '🇺🇸',
  'America/New_York': '🇺🇸',
  'America/Phoenix': '🇺🇸',
  'America/Toronto': '🇨🇦',
  'America/Vancouver': '🇨🇦',
  'America/Mexico_City': '🇲🇽',
  'America/Sao_Paulo': '🇧🇷',
}

export function detectedTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function isValidTimeZone(timeZone) {
  if (!timeZone) return false
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format()
    return true
  } catch {
    return false
  }
}

export function timeZoneOptions() {
  const detected = detectedTimeZone()
  const supported = typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : Object.keys(FLAGS)

  return [detected, ...supported.filter((zone) => zone !== detected)]
}

export function flagForTimeZone(timeZone) {
  return FLAGS[timeZone] || ''
}

export function cityName(timeZone) {
  return String(timeZone || '').split('/').pop()?.replace(/_/g, ' ') || ''
}

export function formatLocalTime(timeZone, date = new Date()) {
  if (!isValidTimeZone(timeZone)) return ''

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(date)
}

export function formatMoment(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function zonedParts(timeZone, date = new Date()) {
  const zone = isValidTimeZone(timeZone) ? timeZone : 'UTC'
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const bag = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    weekday: weekdays[bag.weekday] ?? 0,
    hour: Number(bag.hour),
    minute: Number(bag.minute),
  }
}

function clockParts(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant)
  const hour = parts.find((part) => part.type === 'hour')?.value
  const minute = parts.find((part) => part.type === 'minute')?.value
  return `${hour === '24' ? '00' : hour}:${minute}`
}

export function viewerWhen(dateKey, time, fromZone, toZone) {
  const sourceKey = String(dateKey || '').slice(0, 10)
  const clock = String(time || '').slice(0, 5)
  const source = isValidTimeZone(fromZone) ? fromZone : (isValidTimeZone(toZone) ? toZone : 'UTC')
  const target = isValidTimeZone(toZone) ? toZone : source
  if (!clock) return { dateKey: sourceKey, time: '' }
  if (source === target) return { dateKey: sourceKey, time: clock }

  const instant = zonedInstant(sourceKey, clock, source)
  if (!instant) return { dateKey: sourceKey, time: clock }
  return {
    dateKey: calendarDate(instant, target),
    time: clockParts(instant, target),
  }
}

export function formatClock(value) {
  if (!value) return ''
  const [hour, minute] = String(value).slice(0, 5).split(':').map(Number)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return ''
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
}

export function zonedInstant(dateKey, time, timeZone) {
  const dateMatch = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  const timeMatch = String(time || '00:00').match(/^(\d{2}):(\d{2})/)
  if (!dateMatch || !timeMatch || !isValidTimeZone(timeZone)) return null

  const year = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const day = Number(dateMatch[3])
  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])
  let utc = Date.UTC(year, month - 1, day, hour, minute)
  const offsetAt = (ms) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date(ms))
    const pick = (type) => Number(parts.find((part) => part.type === type)?.value)
    const zonedHour = pick('hour') === 24 ? 0 : pick('hour')
    return Date.UTC(pick('year'), pick('month') - 1, pick('day'), zonedHour, pick('minute')) - ms
  }
  utc -= offsetAt(utc)
  return new Date(utc)
}

export function calendarDate(date, timeZone) {
  const zone = isValidTimeZone(timeZone) ? timeZone : 'UTC'
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
