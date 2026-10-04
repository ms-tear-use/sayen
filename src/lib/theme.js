export const accentPalette = {
  pink: '#c98aa0',
  purple: '#8e7cc3',
  blue: '#7ea4c4',
  green: '#86a58f',
  orange: '#d4a574',
}

export const accentOptions = Object.keys(accentPalette)

const lightTokens = {
  '--background': '#faf8f5',
  '--surface': '#fffdfc',
  '--surface-soft': '#f7f4f0',
  '--text': '#292725',
  '--muted-text': '#77716b',
  '--border': 'rgba(41, 39, 37, 0.08)',
  '--shadow-soft': '0 10px 28px rgba(41, 39, 37, 0.06)',
  '--danger': '#8f3d3d',
  '--danger-soft': '#f8eeed',
}

const darkTokens = {
  '--background': '#191817',
  '--surface': '#211f1d',
  '--surface-soft': '#2a2724',
  '--text': '#f3eee8',
  '--muted-text': '#b7aea4',
  '--border': 'rgba(243, 238, 232, 0.1)',
  '--shadow-soft': '0 12px 28px rgba(0, 0, 0, 0.28)',
  '--danger': '#e7b2ab',
  '--danger-soft': '#3a2c2a',
}

export function normalizeAccent(value) {
  if (accentPalette[value]) return value
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase()
  return 'purple'
}

export function resolveAccent(value) {
  if (accentPalette[value]) return accentPalette[value]
  if (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) return value
  return accentPalette.purple
}

export function contrastColor(hex) {
  const clean = hex.replace('#', '')
  const value = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean
  const numeric = Number.parseInt(value, 16)
  if (Number.isNaN(numeric)) return '#ffffff'

  const red = (numeric >> 16) & 255
  const green = (numeric >> 8) & 255
  const blue = numeric & 255
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
  return luminance > 0.64 ? '#241c1a' : '#ffffff'
}

function isSharedPath(pathname) {
  return ['/home', '/journey', '/space', '/check-in', '/memories', '/open-when', '/play', '/calendar'].some((path) => (
    pathname === path || pathname.startsWith(`${path}/`)
  ))
}

export function themeForUser(profile) {
  const mode = profile?.theme_mode || 'system'
  const accent = profile?.accent_color || 'purple'

  return {
    mode: ['light', 'dark', 'system'].includes(mode) ? mode : 'system',
    accent: normalizeAccent(accent),
  }
}

export function themeForPath(pathname, profile, space) {
  const inside = isSharedPath(pathname) && Boolean(space)
  if (!inside) return themeForUser(profile)

  const mode = space?.space_theme_mode || 'system'
  const accent = space?.space_accent_color || 'purple'
  return {
    mode: ['light', 'dark', 'system'].includes(mode) ? mode : 'system',
    accent: normalizeAccent(accent),
  }
}

export function applyTheme(mode = 'system', accent = 'purple') {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolvedMode = mode === 'system' ? (prefersDark ? 'dark' : 'light') : mode
  const tokens = resolvedMode === 'dark' ? darkTokens : lightTokens
  const color = resolveAccent(accent)
  const root = document.documentElement

  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })

  root.style.setProperty('--accent', color)
  root.style.setProperty('--accent-hover', `color-mix(in srgb, ${color} 84%, black)`)
  root.style.setProperty('--accent-contrast', contrastColor(color))
  root.style.setProperty('--accent-soft', `color-mix(in srgb, ${color} 16%, transparent)`)
  root.dataset.theme = resolvedMode
  root.style.colorScheme = resolvedMode

  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', tokens['--background'])
}

export { lightTokens, darkTokens }
