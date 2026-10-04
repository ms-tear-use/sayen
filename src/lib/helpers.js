export function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '·'
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('')
}

export function otherMember(members = [], userId) {
  return members.find((member) => member.user_id !== userId) || null
}

export function memberName(members = [], userId) {
  return members.find((member) => member.user_id === userId)?.display_name || 'them'
}
