export function isMissingSchema(error) {
  if (!error) return false
  const message = `${error.code || ''} ${error.message || ''}`
  return /42P01|42703|PGRST204|PGRST205|does not exist|schema cache|Could not find the/i.test(message)
}

export const schemaHint = 'Run supabase/life.sql in the Supabase SQL editor, then reload.'
