import { calendarDate } from '../../lib/timezone'
import { gameById } from './catalog'

export function serializePrompt(prompt) {
  if (prompt.optionA || prompt.optionB) {
    return JSON.stringify({
      prompt: prompt.prompt,
      optionA: prompt.optionA || '',
      optionB: prompt.optionB || '',
    })
  }

  return prompt.prompt
}

export function parseStoredPrompt(value) {
  if (!value) return { prompt: '', optionA: '', optionB: '' }

  try {
    const parsed = JSON.parse(value)
    if (parsed && typeof parsed.prompt === 'string') {
      return {
        prompt: parsed.prompt,
        optionA: parsed.optionA || '',
        optionB: parsed.optionB || '',
      }
    }
  } catch {
    // Older rows stored a plain question.
  }

  return { prompt: value, optionA: '', optionB: '' }
}

export function pickPrompt(game, previousText) {
  const pool = game.prompts.filter((item) => item.prompt !== previousText)
  const source = pool.length ? pool : game.prompts
  return source[Math.floor(Math.random() * source.length)]
}

export function catalogAnswer(gameType, promptText) {
  const game = gameById(gameType)
  return game?.prompts.find((item) => item.prompt === promptText)?.answer || ''
}

export function presentRound(row, userId) {
  const answers = row.game_answers || []
  const byUser = new Map()

  answers.forEach((answer) => {
    if (!byUser.has(answer.user_id)) byUser.set(answer.user_id, answer)
  })

  const mine = byUser.get(userId) || null
  const others = [...byUser.values()].filter((answer) => answer.user_id !== userId)
  const revealed = Boolean(mine) && others.length > 0

  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    prompt: parseStoredPrompt(row.prompt),
    mine,
    partner: revealed ? others[0] : null,
    partnerHasAnswered: others.length > 0,
    revealed,
  }
}

export function isSharedToday(createdAt, members = []) {
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return false

  const zones = members.map((member) => member.timezone).filter(Boolean)
  const usable = zones.length ? zones : ['UTC']

  return usable.some((zone) => {
    try {
      return calendarDate(created, zone) === calendarDate(new Date(), zone)
    } catch {
      return false
    }
  })
}
