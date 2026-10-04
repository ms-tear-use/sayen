export function splitEmoji(value) {
  const text = String(value || '').trim()
  const match = text.match(/^(\p{Extended_Pictographic}\uFE0F?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*)\s+([\s\S]+)$/u)
  if (!match) return { emoji: '', label: text }
  return { emoji: match[1], label: match[2].trim() }
}

export function withEmoji(emoji, title) {
  const text = splitEmoji(title).label.trim()
  if (!text) return ''
  return emoji ? `${emoji} ${text}` : text
}

export function emojiFor(value) {
  const parsed = splitEmoji(value)
  if (parsed.emoji) return parsed

  const text = parsed.label.toLowerCase()
  let emoji = ''
  if (/lunch|breakfast|dinner|meal|eat|snack/.test(text)) emoji = '🍽️'
  else if (/work|office|shift|job/.test(text)) emoji = '💼'
  else if (/sleep|nap|bed/.test(text)) emoji = '😴'
  else if (/commut|drive|bus|train/.test(text)) emoji = '🚗'
  else if (/travel|flight|plane/.test(text)) emoji = '✈️'
  else if (/gym|workout|exercise/.test(text)) emoji = '💪'
  else if (/study|school|class/.test(text)) emoji = '📚'
  else if (/rest|break|coffee/.test(text)) emoji = '☕'
  else if (/home/.test(text)) emoji = '🏠'
  else if (/sick|ill/.test(text)) emoji = '🤒'
  else if (/busy|disturb/.test(text)) emoji = '🌙'
  else if (/out/.test(text)) emoji = '🎉'
  else if (text) emoji = '😊'

  return { emoji, label: parsed.label }
}
