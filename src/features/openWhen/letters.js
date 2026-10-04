// The table stores text letters today.
// Later rows can include content_type, media_url, and unlock_at
// without changing this reader.

export function normalizeLetter(row) {
  return {
    ...row,
    contentType: row.content_type || 'text',
    mediaUrl: row.media_url || '',
    unlockAt: row.unlock_at || null,
  }
}

export function isLocked(letter, viewerId, today = new Date()) {
  if (!letter.unlockAt) return false
  if (letter.user_id === viewerId) return false
  const unlock = new Date(letter.unlockAt)
  if (Number.isNaN(unlock.getTime())) return false
  return unlock > today
}

export const letterSuggestions = [
  'Open when you miss me',
  "Open when you're having a bad day",
  "Open when you can't sleep",
  'Open when you need reassurance',
]
