import { isMissingSchema, schemaHint } from '../../lib/schema'

export function checkInValues({ title, mood, need, message }) {
  return {
    title: String(title || '').trim() || null,
    mood: String(mood || '').trim() || null,
    need: String(need || '').trim() || null,
    message: String(message || '').trim() || null,
  }
}

export function checkInWriteError(error) {
  if (isMissingSchema(error) || error?.code === '23502' || error?.code === '23514') {
    const hint = new Error(schemaHint)
    hint.friendly = true
    return hint
  }
  return error
}
