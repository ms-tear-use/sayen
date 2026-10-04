export function friendlyError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback
  if (error.friendly && error.message) return error.message

  const raw = `${error.message || ''} ${error.details || ''}`.toLowerCase()

  if (raw.includes('invalid login') || raw.includes('invalid credentials')) {
    return "That email or password doesn't look right."
  }

  if (raw.includes('email not confirmed')) {
    return 'Confirm your email, then try again.'
  }

  if (
    raw.includes('failed to fetch')
    || raw.includes('networkerror')
    || raw.includes('network request failed')
    || raw.includes('load failed')
    || raw.includes('fetch')
  ) {
    return 'We could not connect. Check your connection and try again.'
  }

  if (raw.includes('jwt') || raw.includes('refresh token') || raw.includes('session')) {
    return 'Your session expired. Please log in again.'
  }

  if (raw.includes('row-level security') || raw.includes('permission denied') || error.code === '42501') {
    return "You don't have access to that."
  }

  if (raw.includes('bucket') || raw.includes('storage')) {
    return "We couldn't save that photo. Uploads may still need to be set up."
  }

  if (error.code === '23505') {
    return 'That is already saved.'
  }

  if (error.code === 'PGRST116') {
    return 'We found an unexpected number of results.'
  }

  return fallback
}
