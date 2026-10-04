import { Link } from 'react-router-dom'
import NotificationBell from '../features/notifications/NotificationBell'

export default function Navbar({ backTo }) {
  return (
    <header className={`navbar ${backTo ? '' : 'navbar--brand-only'}`}>
      {backTo ? (
        <Link to={backTo} className="navbar__back">
          back
        </Link>
      ) : (
        <span />
      )}
      <Link to="/home" className="navbar__brand">
        sayen
      </Link>
      <span className="navbar__tools">
        <NotificationBell />
      </span>
    </header>
  )
}
