import { Component } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import BottomNavigation from './components/BottomNavigation'
import LoadingState from './components/LoadingState'
import Navbar from './components/Navbar'
import NotificationBell from './features/notifications/NotificationBell'
import AuthProvider from './features/auth/AuthProvider'
import { useAuth } from './features/auth/hooks'
import CheckIn from './pages/CheckIn'
import Home from './pages/Home'
import Journey from './pages/Journey'
import Login from './pages/Login'
import OpenWhen from './pages/OpenWhen'
import Play from './pages/Play'
import Settings from './pages/Settings'
import Space from './pages/Space'

function isSpaceSection(pathname) {
  return pathname === '/space' || /^\/space\/(calendar|memories|goals|settings|members)$/.test(pathname)
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="loading-state">
          <h1>sayen</h1>
          <p>Something unexpected happened. Reload the page and try again.</p>
        </div>
      )
    }
    return this.props.children
  }
}

function Private({ children }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  return children
}

function Shell() {
  const { session, ready } = useAuth()
  const location = useLocation()

  if (!ready) return <LoadingState message="Loading your space..." />

  const authed = Boolean(session)
  const path = location.pathname
  const backTo = authed && path.startsWith('/space/calendar/')
    ? '/space/calendar'
    : authed && path !== '/login' && path !== '/home' && path !== '/settings' && !isSpaceSection(path)
      ? '/home'
      : null

  return (
    <div className="app-shell">
      <div className="app-frame">
        {authed && (
          <div className="nav-column">
            <div className="nav-tools">
              <Link to="/home" className="brand">sayen</Link>
              <NotificationBell />
            </div>
            <BottomNavigation />
          </div>
        )}
        <div className="app-main">
          {authed && <Navbar backTo={backTo} />}
          <Routes>
            <Route path="/" element={authed ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />} />
            <Route path="/login" element={authed ? <Navigate to="/home" replace /> : <Login />} />
            <Route path="/home" element={<Private><Home /></Private>} />
            <Route path="/journey" element={<Private><Journey /></Private>} />
            <Route path="/space/*" element={<Private><Space /></Private>} />
            <Route path="/check-in" element={<Private><CheckIn /></Private>} />
            <Route path="/calendar" element={<Navigate to="/space/calendar" replace />} />
            <Route path="/memories" element={<Navigate to="/space/memories" replace />} />
            <Route path="/open-when" element={<Private><OpenWhen /></Private>} />
            <Route path="/play" element={<Private><Play /></Private>} />
            <Route path="/settings" element={<Private><Settings /></Private>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function routerBasename() {
  const base = import.meta.env.BASE_URL || '/'
  if (base === '/') return undefined
  return base.endsWith('/') ? base.slice(0, -1) : base
}

export default function App() {
  return (
    <BrowserRouter basename={routerBasename()}>
      <AppErrorBoundary>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </AppErrorBoundary>
    </BrowserRouter>
  )
}
