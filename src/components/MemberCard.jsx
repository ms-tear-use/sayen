import Avatar from './Avatar'
import { cityName, flagForTimeZone, formatLocalTime } from '../lib/timezone'

export default function MemberCard({ member, now, compact = false, you = false }) {
  const name = member.display_name || 'them'
  const time = formatLocalTime(member.timezone, now)
  const flag = flagForTimeZone(member.timezone)

  return (
    <article className={`member-card ${compact ? 'member-card--compact' : ''}`}>
      <Avatar name={name} src={member.avatar_url} />
      <div className="member-card__copy">
        <h2>
          {name}
          {you && <span className="you-mark"> (you)</span>}
        </h2>
        <p className="member-card__place">
          {flag && <span aria-hidden="true">{flag}</span>}
          {member.city || cityName(member.timezone) || 'No city yet'}
        </p>
        {time ? (
          <p className="member-card__time">
            <time dateTime={now.toISOString()}>{time}</time>
            <span className="sr-only">{member.timezone}</span>
          </p>
        ) : (
          <p className="member-card__time">local time unavailable</p>
        )}
      </div>
    </article>
  )
}
