import Button from './Button'
import EmptyState from './EmptyState'
import ErrorMessage from './ErrorMessage'
import { useAuth, useProfile, useSpace } from '../features/auth/hooks'

export default function RequireSpace({ children }) {
  const { logout } = useAuth()
  const { profile } = useProfile()
  const { space, loadError } = useSpace()

  if (loadError) {
    return (
      <main className="page-shell">
        <ErrorMessage message={loadError} />
        <Button variant="secondary" onClick={logout}>log out</Button>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="page-shell">
        <EmptyState
          title="We couldn't find your profile."
          description="This account is signed in, but there isn't a profile to load."
          action={<Button variant="secondary" onClick={logout}>log out</Button>}
        />
      </main>
    )
  }

  if (!space) {
    return (
      <main className="page-shell">
        <EmptyState
          title="We couldn't find your shared space."
          description="This account isn't connected to the space yet."
          action={<Button variant="secondary" onClick={logout}>log out</Button>}
        />
      </main>
    )
  }

  return children
}
