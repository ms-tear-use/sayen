import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { friendlyError } from '../../lib/errors'
import { isMissingSchema } from '../../lib/schema'
import { applyTheme, themeForPath } from '../../lib/theme'
import { detectedTimeZone } from '../../lib/timezone'
import { supabase } from '../../supabaseClient'
import SayenContext from './context'

const PROFILE_FIELDS = ['display_name', 'avatar_url', 'timezone', 'country', 'city', 'theme_mode', 'accent_color']
const SPACE_FIELDS = ['name', 'space_theme_mode', 'space_accent_color', 'journey_name', 'journey_started_on', 'journey_date_id']
const spaceColumns = 'id, name, space_theme_mode, space_accent_color, journey_name, journey_started_on, journey_date_id, created_at, updated_at'
const spaceColumnsBasic = 'id, name, space_theme_mode, space_accent_color, created_at, updated_at'

function pick(source, fields) {
  return fields.reduce((patch, field) => {
    if (field in source) patch[field] = source[field]
    return patch
  }, {})
}

const profileColumns = 'user_id, display_name, avatar_url, timezone, country, city, theme_mode, accent_color, created_at, updated_at'
const profileColumnsBasic = 'user_id, display_name, avatar_url, timezone, theme_mode, accent_color, created_at, updated_at'

function suggestedName(user) {
  const fromEmail = user.email?.split('@')[0]?.trim()
  return (fromEmail || 'me').slice(0, 40)
}

async function fetchProfile(userId) {
  let result = await supabase
    .from('profiles')
    .select(profileColumns)
    .eq('user_id', userId)
    .maybeSingle()

  if (result.error && isMissingSchema(result.error)) {
    result = await supabase
      .from('profiles')
      .select(profileColumnsBasic)
      .eq('user_id', userId)
      .maybeSingle()
  }

  if (result.error) throw result.error
  return result.data
}

async function ensureProfile(user) {
  const existing = await fetchProfile(user.id)
  if (existing) return existing

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      user_id: user.id,
      display_name: suggestedName(user),
      timezone: detectedTimeZone(),
    })
    .select(profileColumns)
    .single()

  if (!error) return data

  if (error.code === '23505') {
    const again = await fetchProfile(user.id)
    if (again) return again
  }

  const wrapped = new Error("We couldn't create your profile.")
  wrapped.friendly = true
  throw wrapped
}

async function loadForUser(user) {
  const userId = user.id
  const profile = await ensureProfile(user)

  const { data: membership, error: membershipError } = await supabase
    .from('space_members')
    .select('space_id, joined_at')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (membershipError) throw membershipError
  if (!membership?.space_id) {
    return { profile, space: null, members: profile ? [memberFromProfile(profile)] : [] }
  }

  let spaceResult = await supabase
    .from('spaces')
    .select(spaceColumns)
    .eq('id', membership.space_id)
    .maybeSingle()

  if (spaceResult.error && isMissingSchema(spaceResult.error)) {
    spaceResult = await supabase
      .from('spaces')
      .select(spaceColumnsBasic)
      .eq('id', membership.space_id)
      .maybeSingle()
  }

  if (spaceResult.error) throw spaceResult.error
  const space = spaceResult.data

  const { data: memberRows, error: memberError } = await supabase
    .from('space_members')
    .select('user_id, joined_at')
    .eq('space_id', membership.space_id)
    .order('joined_at', { ascending: true })

  if (memberError) throw memberError

  const ids = (memberRows || []).map((row) => row.user_id)
  let profiles = []

  if (ids.length) {
    let result = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url, timezone, country, city, theme_mode, accent_color')
      .in('user_id', ids)

    if (result.error && isMissingSchema(result.error)) {
      result = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url, timezone, theme_mode, accent_color')
        .in('user_id', ids)
    }

    if (result.error) throw result.error
    profiles = result.data || []
  }

  const byId = new Map(profiles.map((item) => [item.user_id, item]))
  const members = (memberRows || []).map((row) => {
    const match = byId.get(row.user_id)
    return {
      user_id: row.user_id,
      joined_at: row.joined_at,
      display_name: match?.display_name || '',
      avatar_url: match?.avatar_url || '',
      timezone: match?.timezone || '',
      country: match?.country || '',
      city: match?.city || '',
      theme_mode: match?.theme_mode || 'system',
      accent_color: match?.accent_color || 'purple',
      profileMissing: !match,
    }
  })

  return { profile, space, members }
}

function memberFromProfile(profile) {
  return {
    user_id: profile.user_id,
    joined_at: null,
    display_name: profile.display_name || '',
    avatar_url: profile.avatar_url || '',
    timezone: profile.timezone || '',
    country: profile.country || '',
    city: profile.city || '',
    theme_mode: profile.theme_mode || 'system',
    accent_color: profile.accent_color || 'purple',
    profileMissing: false,
  }
}

export default function AuthProvider({ children }) {
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [space, setSpace] = useState(null)
  const [members, setMembers] = useState([])
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const generation = useRef(0)
  const loadedUser = useRef(null)

  const hydrate = useCallback(async (nextSession, active) => {
    const id = generation.current + 1
    generation.current = id

    if (!nextSession?.user) {
      loadedUser.current = null
      setSession(null)
      setProfile(null)
      setSpace(null)
      setMembers([])
      setLoadError('')
      setReady(true)
      return
    }

    try {
      const loaded = await loadForUser(nextSession.user)
      if (!active() || generation.current !== id) return

      setSession(nextSession)
      setProfile(loaded.profile)
      setSpace(loaded.space)
      setMembers(loaded.members)
      setLoadError('')
      loadedUser.current = nextSession.user.id

      const nextTheme = themeForPath(window.location.pathname, loaded.profile, loaded.space)
      applyTheme(nextTheme.mode, nextTheme.accent)
    } catch (error) {
      if (!active() || generation.current !== id) return
      setSession(nextSession)
      setProfile(null)
      setSpace(null)
      setMembers([])
      loadedUser.current = nextSession.user.id
      setLoadError(friendlyError(error, "We couldn't load your space."))
    } finally {
      if (active() && generation.current === id) setReady(true)
    }
  }, [])

  useEffect(() => {
    let active = true
    const isActive = () => active

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) {
        setLoadError(friendlyError(error, 'Your session expired. Please log in again.'))
        setReady(true)
        return
      }
      hydrate(data.session, isActive)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return

      if (event === 'INITIAL_SESSION') return

      if (event === 'TOKEN_REFRESHED') {
        setSession(nextSession)
        return
      }

      if (event === 'SIGNED_OUT') {
        generation.current += 1
        loadedUser.current = null
        setSession(null)
        setProfile(null)
        setSpace(null)
        setMembers([])
        setLoadError('')
        setReady(true)
        return
      }

      if (event === 'SIGNED_IN' && nextSession?.user) {
        if (loadedUser.current === nextSession.user.id) {
          setSession(nextSession)
          return
        }
        setReady(false)
        window.setTimeout(() => {
          if (active) hydrate(nextSession, isActive)
        }, 0)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [hydrate])

  const theme = useMemo(
    () => themeForPath(location.pathname, profile, space),
    [location.pathname, profile, space],
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const paint = () => applyTheme(theme.mode, theme.accent)
    paint()

    if (theme.mode !== 'system') return undefined
    media.addEventListener('change', paint)
    return () => media.removeEventListener('change', paint)
  }, [theme])

  const login = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw error
  }, [])

  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const updateProfile = useCallback(async (patch) => {
    if (!session?.user) {
      const expired = new Error('Your session expired. Please log in again.')
      expired.friendly = true
      throw expired
    }

    const nextPatch = pick(patch, PROFILE_FIELDS)
    const previous = profile
    setProfile((current) => ({ ...current, ...nextPatch }))
    setMembers((current) => current.map((member) => (
      member.user_id === session.user.id
        ? { ...member, ...nextPatch, profileMissing: false }
        : member
    )))

    let result = await supabase
      .from('profiles')
      .update({ ...nextPatch, updated_at: new Date().toISOString() })
      .eq('user_id', session.user.id)
      .select(profileColumns)
      .single()

    if (result.error && isMissingSchema(result.error) && !('country' in nextPatch) && !('city' in nextPatch)) {
      const basicPatch = pick(nextPatch, PROFILE_FIELDS.filter((field) => field !== 'country' && field !== 'city'))
      result = await supabase
        .from('profiles')
        .update({ ...basicPatch, updated_at: new Date().toISOString() })
        .eq('user_id', session.user.id)
        .select(profileColumnsBasic)
        .single()
    }

    if (result.error) {
      setProfile(previous)
      setMembers((current) => current.map((member) => (
        member.user_id === session.user.id
          ? { ...member, country: previous?.country || '', city: previous?.city || '', timezone: previous?.timezone || '' }
          : member
      )))
      throw result.error
    }

    const { data } = result

    setProfile(data)
    return data
  }, [profile, session])

  const updateSpace = useCallback(async (patch) => {
    if (!space?.id) {
      const missing = new Error("We couldn't find your shared space.")
      missing.friendly = true
      throw missing
    }

    const nextPatch = pick(patch, SPACE_FIELDS)
    const previous = space
    setSpace((current) => ({ ...current, ...nextPatch }))

    let result = await supabase
      .from('spaces')
      .update({ ...nextPatch, updated_at: new Date().toISOString() })
      .eq('id', space.id)
      .select(spaceColumns)
      .single()

    if (result.error && isMissingSchema(result.error)) {
      const basicPatch = pick(nextPatch, ['name', 'space_theme_mode', 'space_accent_color'])
      if (!Object.keys(basicPatch).length) {
        setSpace(previous)
        throw result.error
      }
      result = await supabase
        .from('spaces')
        .update({ ...basicPatch, updated_at: new Date().toISOString() })
        .eq('id', space.id)
        .select(spaceColumnsBasic)
        .single()
    }

    if (result.error) {
      setSpace(previous)
      throw result.error
    }

    setSpace(result.data)
    return result.data
  }, [space])

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    profile,
    space,
    members,
    ready,
    loadError,
    login,
    logout,
    updateProfile,
    updateSpace,
    theme,
  }), [session, profile, space, members, ready, loadError, login, logout, updateProfile, updateSpace, theme])

  return (
    <SayenContext.Provider value={value}>
      {children}
    </SayenContext.Provider>
  )
}
