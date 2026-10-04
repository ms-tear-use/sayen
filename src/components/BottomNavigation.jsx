import { House, UserRound, Users } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/home', label: 'Home', end: true, icon: House },
  { to: '/space', label: 'Our Space', end: false, icon: Users },
  { to: '/settings', label: 'Me', end: true, icon: UserRound },
]

export default function BottomNavigation() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}
          >
            <Icon size={22} aria-hidden="true" />
            {item.label}
          </NavLink>
        )
      })}
    </nav>
  )
}
