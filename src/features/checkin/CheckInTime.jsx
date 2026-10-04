import { detectedTimeZone, flagForTimeZone, formatLocalTime, isValidTimeZone } from '../../lib/timezone'

function cityName(timeZone) {
  return String(timeZone || '').split('/').pop()?.replace(/_/g, ' ') || ''
}

export default function CheckInTime({ members = [], currentUserId, at }) {
  const when = new Date(at)
  if (Number.isNaN(when.getTime())) return null

  const mine = members.find((member) => member.user_id === currentUserId)
  const other = members.find((member) => member.user_id !== currentUserId)
  const yourZone = isValidTimeZone(mine?.timezone) ? mine.timezone : detectedTimeZone()
  const clocks = []
  const yours = formatLocalTime(yourZone, when)
  if (yours) clocks.push({ timezone: yourZone, clock: yours, you: true })
  if (isValidTimeZone(other?.timezone) && other.timezone !== yourZone) {
    const theirs = formatLocalTime(other.timezone, when)
    if (theirs) clocks.push({ timezone: other.timezone, clock: theirs, you: false })
  }
  if (!clocks.length) return null

  return (
    <time dateTime={when.toISOString()} className="checkin-times">
      {clocks.map((item) => {
        const flag = flagForTimeZone(item.timezone)
        const city = cityName(item.timezone)
        return (
          <span key={item.timezone} className={item.you ? 'checkin-times__you' : 'checkin-times__other'}>
            {item.clock}
            {!item.you && flag && (
              <>
                {' '}
                <span aria-hidden="true">{flag}</span>
                <span className="sr-only">{city}</span>
              </>
            )}
            {!item.you && !flag && city && ` ${city}`}
          </span>
        )
      })}
    </time>
  )
}
