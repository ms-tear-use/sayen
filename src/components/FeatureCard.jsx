import { Link } from 'react-router-dom'

export default function FeatureCard({ to, title, text, action, children }) {
  return (
    <Link className="feature-card" to={to}>
      <span className="feature-card__copy">
        <span className="feature-card__title">{title}</span>
        <span className="feature-card__text">{text}</span>
        {children}
      </span>
      <span className="feature-card__action">{action}<span aria-hidden="true"> ›</span></span>
    </Link>
  )
}
