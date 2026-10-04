import { Link } from 'react-router-dom'

function Shell({ href, onClick, className, children }) {
  if (href) return <Link to={href} className={className}>{children}</Link>
  return <button type="button" onClick={onClick} className={className}>{children}</button>
}

export function EventCard({ preview, href, onClick }) {
  return (
    <Shell href={href} onClick={onClick} className={`event-card event-card--${preview.type}`}>
      <span className="event-card__kicker">
        <span aria-hidden="true">{preview.emoji}</span>
        {preview.typeLabel}
      </span>
      {preview.type === 'memory' && preview.photo && <img src={preview.photo} alt="" />}
      <strong>{preview.title}</strong>
      {preview.listLines.length > 0
        ? preview.listLines.map((line) => <span key={line} className="event-card__line">{line}</span>)
        : preview.line && <span className="event-card__line">{preview.line}</span>}
      {preview.note && <span className="event-card__note">{preview.note}</span>}
    </Shell>
  )
}

export function EventRow({ preview, onClick }) {
  return (
    <button type="button" className="event-row" onClick={onClick}>
      <span className="event-row__emoji" aria-hidden="true">{preview.emoji}</span>
      <span className="event-row__copy">
        <strong>{preview.title}</strong>
        {preview.listLines.map((line) => <span key={line} className="event-row__meta">{line}</span>)}
        {preview.note && <span className="event-row__note">{preview.note}</span>}
      </span>
      {preview.photo && <img className="event-row__thumb" src={preview.photo} alt="" />}
    </button>
  )
}
