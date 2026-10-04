import { Heart } from 'lucide-react'
import Avatar from '../../components/Avatar'
import useNow from '../../hooks/useNow'
import { journeyCaption, togetherCount } from './journey'

export default function JourneyHero({ dateKey, self, partner, onSetup }) {
  const now = useNow(30000)
  const count = dateKey ? togetherCount(dateKey, now) : null
  const caption = dateKey ? journeyCaption(dateKey, now) : ''

  return (
    <div className="journey-hero">
      {(self || partner) && (
        <div className="journey-faces" aria-hidden="true">
          {self && <Avatar name={self.display_name || 'you'} src={self.avatar_url} size="lg" />}
          <span className="journey-badge"><Heart size={18} /></span>
          {partner && <Avatar name={partner.display_name || 'them'} src={partner.avatar_url} size="lg" />}
        </div>
      )}
      {count && !count.upcoming ? (
        <div className="journey-count" aria-label="Time together">
          {count.units.map((item) => (
            <div key={item.id}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      ) : null}
      {caption ? <p className="journey-caption">{caption}</p> : null}
      {!dateKey && (
        onSetup ? (
          <button type="button" className="journey-empty" onClick={onSetup}>
            Add the day you started, or link an anniversary.
          </button>
        ) : (
          <p className="journey-caption">Add the day you started, or link an anniversary.</p>
        )
      )}
    </div>
  )
}
