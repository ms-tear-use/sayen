import { useCallback, useEffect, useState } from 'react'
import ErrorMessage from '../components/ErrorMessage'
import LoadingState from '../components/LoadingState'
import RequireSpace from '../components/RequireSpace'
import { useSpace } from '../features/auth/hooks'
import { games } from '../features/games/catalog'
import PlayRound from '../features/games/PlayRound'
import { isSharedToday, parseStoredPrompt, pickPrompt, presentRound, serializePrompt } from '../features/games/round'
import { friendlyError } from '../lib/errors'
import { supabase } from '../supabaseClient'

function PlayContent() {
  const { space, members, user } = useSpace()
  const [selected, setSelected] = useState(null)
  const [round, setRound] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchRounds = async (gameId) => {
    const { data, error: loadError } = await supabase
      .from('games')
      .select('id, name, prompt, created_at, game_answers(id, user_id, answer, created_at)')
      .eq('space_id', space.id)
      .eq('name', gameId)
      .order('created_at', { ascending: false })
      .limit(8)

    if (loadError) throw loadError
    return data || []
  }

  const createRound = async (game, previousPrompt = '') => {
    const nextPrompt = pickPrompt(game, previousPrompt)
    const { data, error: saveError } = await supabase
      .from('games')
      .insert({
        space_id: space.id,
        name: game.id,
        prompt: serializePrompt(nextPrompt),
      })
      .select('id, name, prompt, created_at')
      .single()

    if (saveError) throw saveError
    return { ...data, game_answers: [] }
  }

  const openGame = async (game) => {
    setSelected(game)
    setLoading(true)
    setError('')
    setRound(null)

    try {
      const rows = await fetchRounds(game.id)
      let row = rows[0]

      if (game.daily) {
        row = rows.find((item) => isSharedToday(item.created_at, members))
      }

      if (!row) {
        const previous = rows[0] ? parseStoredPrompt(rows[0].prompt).prompt : ''
        row = await createRound(game, previous)
      }
      setRound(presentRound(row, user.id))
    } catch (loadError) {
      setError(friendlyError(loadError, "We couldn't open that game."))
    } finally {
      setLoading(false)
    }
  }

  const refresh = useCallback(async (roundId) => {
    const { data, error: loadError } = await supabase
      .from('games')
      .select('id, name, prompt, created_at, game_answers(id, user_id, answer, created_at)')
      .eq('id', roundId)
      .single()

    if (loadError) throw loadError
    setRound(presentRound(data, user.id))
  }, [user.id])

  const waiting = Boolean(round?.mine) && !round?.revealed

  useEffect(() => {
    if (!selected || !round?.id || !waiting) return undefined

    const roundId = round.id
    const timer = window.setInterval(() => {
      refresh(roundId).catch(() => {})
    }, 5000)

    return () => window.clearInterval(timer)
  }, [selected, round?.id, waiting, refresh])

  const answer = async (value) => {
    if (!round || !selected) return
    setSaving(true)
    setError('')
    try {
      const { error: saveError } = await supabase.from('game_answers').insert({
        game_id: round.id,
        user_id: user.id,
        answer: value,
      })
      if (saveError) throw saveError
      await refresh(round.id)
    } catch (saveError) {
      setError(friendlyError(saveError, "We couldn't save that answer."))
    } finally {
      setSaving(false)
    }
  }

  const another = async () => {
    if (!selected || !round) return
    setSaving(true)
    setError('')
    try {
      const row = await createRound(selected, round.prompt.prompt)
      setRound(presentRound(row, user.id))
    } catch (saveError) {
      setError(friendlyError(saveError, "We couldn't start a new question."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page-shell">
      {!selected && (
        <>
          <header className="page-header">
            <h1>Play</h1>
            <p>Something small for the two of you.</p>
          </header>
          <div className="feature-list">
            {games.map((game) => (
              <button key={game.id} type="button" className="feature-card" onClick={() => openGame(game)}>
                <span className="feature-card__copy">
                  <span className="feature-card__title">{game.title}</span>
                  <span className="feature-card__text">{game.description}</span>
                </span>
                <span className="feature-card__action">Open<span aria-hidden="true"> ›</span></span>
              </button>
            ))}
          </div>
        </>
      )}

      {selected && loading && <LoadingState compact message="Loading..." />}
      {selected && !loading && round && (
        <PlayRound
          key={round.id}
          game={selected}
          round={round}
          members={members}
          userId={user.id}
          saving={saving}
          error={error}
          onAnswer={answer}
          onNew={another}
          onBack={() => {
            setSelected(null)
            setRound(null)
            setError('')
          }}
        />
      )}
      {selected && !loading && !round && <ErrorMessage message={error || "We couldn't open that game."} />}
    </main>
  )
}

export default function Play() {
  return (
    <RequireSpace>
      <PlayContent />
    </RequireSpace>
  )
}
