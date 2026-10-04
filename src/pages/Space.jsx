import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { CalendarDays, Image, ListChecks, Settings, Users } from 'lucide-react'
import MemberCard from '../components/MemberCard'
import RequireSpace from '../components/RequireSpace'
import { useSpace } from '../features/auth/hooks'
import GoalsSection from '../features/goals/GoalsSection'
import DateDetail from '../features/space/DateDetail'
import SpaceSettings from '../features/space/SpaceSettings'
import useNow from '../hooks/useNow'
import Calendar from './Calendar'
import Memories from './Memories'

const sections = [
  { to: '/space/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/space/memories', label: 'Memories', icon: Image },
  { to: '/space/goals', label: 'Goals', icon: ListChecks },
  { to: '/space/settings', label: 'Settings', icon: Settings },
  { to: '/space/members', label: 'Members', icon: Users },
]

function SpaceFrame() {
  const { space, members, user, updateSpace } = useSpace()
  const now = useNow()

  return (
    <main className="page-shell">
      <header className="page-header">
        <h1>{space.name || 'Our space'}</h1>
      </header>
      <nav className="section-nav" aria-label="Our space">
        {sections.map((item) => {
          const Icon = item.icon
          return (
            <NavLink key={item.to} to={item.to}>
              <Icon size={16} aria-hidden="true" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>
      <Routes>
        <Route index element={<Navigate to="calendar" replace />} />
        <Route path="calendar" element={<Calendar embedded />} />
        <Route path="calendar/:dateId" element={<DateDetail />} />
        <Route path="memories" element={<Memories embedded />} />
        <Route path="goals" element={<GoalsSection />} />
        <Route path="settings" element={<SpaceSettings space={space} onUpdate={updateSpace} />} />
        <Route path="members" element={<Members members={members} now={now} currentUserId={user.id} />} />
      </Routes>
    </main>
  )
}

function Members({ members, now, currentUserId }) {
  return (
    <section>
      <h2>Members</h2>
      <div className="people">
        {members.map((member) => (
          <MemberCard
            key={member.user_id}
            member={member}
            now={now}
            you={member.user_id === currentUserId}
          />
        ))}
      </div>
    </section>
  )
}

export default function Space() {
  return (
    <RequireSpace>
      <SpaceFrame />
    </RequireSpace>
  )
}
