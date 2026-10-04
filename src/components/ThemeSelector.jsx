export default function ThemeSelector({ mode, onChange }) {
  return (
    <div className="choice-row" role="group" aria-label="Theme">
      {['light', 'dark', 'system'].map((option) => (
        <button
          key={option}
          type="button"
          className={`choice ${mode === option ? 'choice--active' : ''}`}
          aria-pressed={mode === option}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
