import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const offsets = { at: 0, '10m': 10, '1h': 60, '1d': 1440, '1w': 10080 }

Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return new Response('Missing Supabase env', { status: 500 })

  const supabase = createClient(url, key)
  const now = Date.now()
  const [{ data: events }, { data: members }, { data: profiles }, { data: settings }, { data: subscriptions }, { data: existing }, { data: checkins }] = await Promise.all([
    supabase.from('important_dates').select('id, space_id, title, event_date, event_type, recurrence, recurrence_days, reminder, reminder_when, count_milestones, count_years, count_months, person_name, emoji, start_time, end_time, created_by, series_id, occurrence_date, excluded_dates, recurrence_until, time_zone, description'),
    supabase.from('space_members').select('space_id, user_id'),
    supabase.from('profiles').select('user_id, timezone'),
    supabase.from('notification_settings').select('user_id, event_reminders, schedule_reminders, checkin_reminders'),
    supabase.from('push_subscriptions').select('user_id, endpoint, p256dh, auth'),
    supabase.from('notifications').select('user_id, dedupe_key').gte('created_at', new Date(now - 10 * 86400000).toISOString()),
    supabase.from('daily_checkins').select('user_id, created_at').gte('created_at', new Date(now - 2 * 86400000).toISOString()),
  ])

  const seen = new Set((existing || []).map((row) => `${row.user_id}:${row.dedupe_key}`))
  const prefs = new Map((settings || []).map((row) => [row.user_id, row]))
  const subs = new Map()
  ;(subscriptions || []).forEach((row) => {
    const list = subs.get(row.user_id) || []
    list.push(row)
    subs.set(row.user_id, list)
  })

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:sayen@localhost'
  if (publicKey && privateKey) webpush.setVapidDetails(subject, publicKey, privateKey)

  const zoneOf = (userId) => (profiles || []).find((profile) => profile.user_id === userId)?.timezone || 'UTC'

  const deliver = async (userId, dedupe, title, body, href, fireAt) => {
    const token = `${userId}:${dedupe}`
    if (seen.has(token)) return
    seen.add(token)
    await supabase.from('notifications').insert({
      user_id: userId,
      dedupe_key: dedupe,
      title,
      body,
      href,
      fire_at: new Date(fireAt).toISOString(),
    })
    if (!publicKey || !privateKey) return
    await Promise.all((subs.get(userId) || []).map((sub) => webpush.sendNotification({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    }, JSON.stringify({ title, body, url: href })).catch(() => {})))
  }

  for (const event of events || []) {
    if (event.event_type === 'schedule' || event.event_type === 'memory') continue
    const when = event.reminder_when || (event.reminder ? '1d' : 'none')
    if (!offsets.hasOwnProperty.call(offsets, when)) continue
    const people = (members || []).filter((member) => member.space_id === event.space_id).map((member) => member.user_id)
    const recipients = people.length ? people : (event.created_by ? [event.created_by] : [])
    for (const userId of recipients) {
      const pref = prefs.get(userId)
      const allowed = pref?.event_reminders !== false
      if (!allowed) continue
      const eventZone = event.time_zone || zoneOf(userId)
      const viewerZone = zoneOf(userId)
      const today = localKey(new Date(), eventZone)
      for (let shift = -1; shift <= 8; shift += 1) {
        const key = addDays(today, shift)
        if (!occurs(event, key)) continue
        const fire = fireAt(key, event.start_time || '09:00', eventZone, offsets[when])
        if (fire == null || now < fire || now - fire > 2 * 60 * 60 * 1000) continue
        const text = message(event, key, when, viewerZone, eventZone)
        await deliver(userId, `${event.id}:${key}:${when}`, text.title, text.body, `/space/calendar?date=${key}&event=${event.id}`, fire)
      }
    }
  }

  for (const member of members || []) {
    const pref = prefs.get(member.user_id)
    if (pref?.checkin_reminders === false) continue
    const zone = zoneOf(member.user_id)
    const today = localKey(new Date(), zone)
    const fire = fireAt(today, '20:00', zone, 0)
    if (fire == null || now < fire || now - fire > 2 * 60 * 60 * 1000) continue
    const already = (checkins || []).some((row) => row.user_id === member.user_id && localKey(new Date(row.created_at), zone) === today)
    if (already) continue
    await deliver(member.user_id, `checkin:${today}`, 'A little check-in', 'How is today going?', '/check-in', fire)
  }

  return new Response('ok')
})

function localKey(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function addDays(key, days) {
  const [year, month, day] = key.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return next.toISOString().slice(0, 10)
}

function fireAt(key, time, timeZone, minutesBefore) {
  const [year, month, day] = key.split('-').map(Number)
  const [hour, minute] = String(time).slice(0, 5).split(':').map(Number)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(Date.UTC(year, month - 1, day, hour, minute)))
  const pick = (type) => Number(parts.find((part) => part.type === type)?.value)
  const zoned = Date.UTC(pick('year'), pick('month') - 1, pick('day'), pick('hour') === 24 ? 0 : pick('hour'), pick('minute'))
  const instant = Date.UTC(year, month - 1, day, hour, minute) - (zoned - Date.UTC(year, month - 1, day, hour, minute))
  return instant - minutesBefore * 60000
}

function occurs(event, key) {
  if (event.occurrence_date) return String(event.occurrence_date).slice(0, 10) === key
  if (!event.event_date || key < String(event.event_date).slice(0, 10)) return false
  if (event.recurrence_until && key >= String(event.recurrence_until).slice(0, 10)) return false
  const excluded = Array.isArray(event.excluded_dates) ? event.excluded_dates.map((item) => String(item).slice(0, 10)) : []
  if (excluded.includes(key)) return false
  const start = new Date(`${String(event.event_date).slice(0, 10)}T00:00:00Z`)
  const cursor = new Date(`${key}T00:00:00Z`)
  const mode = event.recurrence || 'none'
  if (mode === 'daily') return true
  if (mode === 'weekly' || mode === 'none') return mode === 'none' ? key === String(event.event_date).slice(0, 10) : cursor.getUTCDay() === start.getUTCDay()
  if (mode === 'weekdays') return cursor.getUTCDay() >= 1 && cursor.getUTCDay() <= 5
  if (mode === 'weekends') return cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6
  if (mode === 'custom') return String(event.recurrence_days || '').split(',').map(Number).includes(cursor.getUTCDay())
  if (mode === 'monthly') return cursor.getUTCDate() === start.getUTCDate()
  if (mode === 'yearly') return cursor.getUTCMonth() === start.getUTCMonth() && cursor.getUTCDate() === start.getUTCDate()
  return key === String(event.event_date).slice(0, 10)
}

function ordinal(number) {
  const value = Math.abs(Math.trunc(number))
  const tail = value % 100
  if (tail >= 11 && tail <= 13) return `${value}th`
  if (value % 10 === 1) return `${value}st`
  if (value % 10 === 2) return `${value}nd`
  if (value % 10 === 3) return `${value}rd`
  return `${value}th`
}

function kindOf(event) {
  if (event.event_type === 'milestone' || event.event_type === 'anniversary') return 'milestone'
  if (event.event_type === 'birthday') return 'birthday'
  if (event.event_type === 'memory') return 'memory'
  return 'important'
}

function monthDay(key) {
  const [year, month, day] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(new Date(year, month - 1, day))
}

function message(event, key, when, viewerZone, eventZone) {
  const kind = kindOf(event)
  const icon = event.emoji || (kind === 'birthday' ? '🎂' : kind === 'milestone' ? '✨' : kind === 'memory' ? '📷' : '📌')
  const lead = when === '1d' ? 'Tomorrow' : when === '1w' ? 'Next week' : when === '1h' ? 'In 1 hour' : when === '10m' ? 'In 10 minutes' : 'Today'
  const [year, month] = key.split('-').map(Number)
  const startYear = Number(String(event.event_date || key).slice(0, 4))
  const startMonth = Number(String(event.event_date || key).slice(5, 7))
  const years = year - startYear
  const months = years * 12 + (month - startMonth)
  let headline = event.title || 'Event'
  let body = monthDay(key)
  if (kind === 'birthday') {
    const name = String(event.person_name || '').trim() || (String(event.title || '').match(/^(.*?)['’]s\s+birthday$/i)?.[1] || '').trim()
    if (years >= 1) headline = name ? `${name}'s ${ordinal(years)} birthday` : `${ordinal(years)} birthday`
  } else if (kind === 'milestone') {
    const bits = []
    const countYears = event.count_years === true || (event.count_years == null && event.count_milestones === true && !/monthsary/i.test(event.title || ''))
    const countMonths = event.count_months === true || (event.count_months == null && event.count_milestones === true && (/monthsary/i.test(event.title || '') || event.recurrence === 'monthly'))
    if (countYears && years >= 1) bits.push(`${ordinal(years)} Year`)
    if (countMonths && months >= 1) bits.push(`${ordinal(months)} Month`)
    body = bits.join(' · ') || monthDay(key)
  } else if (event.start_time) {
    const instant = fireAt(key, String(event.start_time).slice(0, 5), eventZone || viewerZone, 0)
    body = new Intl.DateTimeFormat('en-US', {
      timeZone: viewerZone || 'UTC',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(instant))
  }
  return { title: `${icon} ${lead}: ${headline}`, body }
}
