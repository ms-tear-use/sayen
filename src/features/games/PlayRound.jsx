import { useState } from 'react'
import Button from '../../components/Button'
import ErrorMessage from '../../components/ErrorMessage'
import Textarea from '../../components/Textarea'
import { catalogAnswer } from './round'
import PersonName from '../../components/PersonName'
import { memberName } from '../../lib/helpers'

export default function PlayRound({
  game,
  round,
  members,
  userId,
  saving,
  error,
  onAnswer,
  onNew,
  onBack,
}) {
  const [draft, setDraft] = useState('')
  const [choice, setChoice] = useState('')
  const partner = members.find((member) => member.user_id !== userId)
  const partnerLabel = partner?.display_name || 'them'
  const note = catalogAnswer(game.id, round.prompt.prompt)

  const submit = () => {
    const value = game.answerStyle === 'choice' ? choice : draft.trim()
    if (!value) return
    onAnswer(value)
  }

  return (
    <div className="stack-form">
      <button type="button" className="text-button" onClick={onBack}>all games</button>
      <header className="page-header">
        <h1>{game.title}</h1>
        <p>{game.description}</p>
      </header>

      <section className="card play-question">
        <h2>{round.prompt.prompt}</h2>

        {!round.mine && game.answerStyle === 'choice' && (
          <div className="stack-form">
            {[round.prompt.optionA, round.prompt.optionB].filter(Boolean).map((option) => (
              <button
                key={option}
                type="button"
                className={`choice choice--block ${choice === option ? 'choice--active' : ''}`}
                aria-pressed={choice === option}
                onClick={() => setChoice(option)}
              >
                {option}
              </button>
            ))}
            <Button type="button" onClick={submit} disabled={!choice || saving}>
              {saving ? 'saving...' : "that's my answer"}
            </Button>
          </div>
        )}

        {!round.mine && game.answerStyle !== 'choice' && (
          <div className="stack-form">
            <Textarea
              id="game-answer"
              label="Your answer"
              rows={4}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button type="button" onClick={submit} disabled={!draft.trim() || saving}>
              {saving ? 'saving...' : "that's my answer"}
            </Button>
          </div>
        )}

        {round.mine && !round.revealed && (
          <p>
            Your answer is in.
            {round.partnerHasAnswered ? '' : ` Waiting for ${partnerLabel}.`}
          </p>
        )}

        {round.revealed && (
          <div className="reveal">
            <article>
              <h3><PersonName members={members} userId={userId} currentUserId={userId} /></h3>
              <p>{round.mine.answer}</p>
            </article>
            {round.partner && (
              <article>
                <h3>{memberName(members, round.partner.user_id)}</h3>
                <p>{round.partner.answer}</p>
              </article>
            )}
            {note && <p className="muted">We had this in mind: {note}</p>}
          </div>
        )}

        <ErrorMessage message={error} />
      </section>

      {round.revealed && !game.daily && (
        <Button type="button" variant="secondary" onClick={onNew} disabled={saving}>
          another question
        </Button>
      )}
      {round.revealed && game.daily && (
        <p className="muted">That's today's question.</p>
      )}
    </div>
  )
}
