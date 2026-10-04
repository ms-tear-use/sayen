import { useContext } from 'react'
import SayenContext from './context'

function useSayen() {
  const value = useContext(SayenContext)
  if (!value) {
    throw new Error('Sayen is still starting.')
  }
  return value
}

export function useAuth() {
  const value = useSayen()
  return {
    session: value.session,
    user: value.user,
    ready: value.ready,
    login: value.login,
    logout: value.logout,
    loadError: value.loadError,
  }
}

export function useProfile() {
  const value = useSayen()
  return {
    profile: value.profile,
    updateProfile: value.updateProfile,
  }
}

export function useSpace() {
  const value = useSayen()
  return {
    space: value.space,
    members: value.members,
    updateSpace: value.updateSpace,
    ready: value.ready,
    loadError: value.loadError,
    user: value.user,
  }
}

export function useTheme() {
  const value = useSayen()
  return value.theme
}
