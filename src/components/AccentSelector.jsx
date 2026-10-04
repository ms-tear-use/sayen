import { accentOptions, accentPalette, resolveAccent } from '../lib/theme'

export default function AccentSelector({ value, onChange }) {
  const custom = typeof value === 'string' && value.startsWith('#')

  return (
    <div className="accent-selector">
      <div className="accent-selector__swatches">
        {accentOptions.map((option) => (
          <button
            key={option}
            type="button"
            className={`swatch ${value === option ? 'swatch--active' : ''}`}
            style={{ background: accentPalette[option] }}
            aria-label={option}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          />
        ))}
        <label className={`custom-color ${custom ? 'custom-color--active' : ''}`}>
          <span className="sr-only">Custom color</span>
          <input
            type="color"
            value={custom ? value : resolveAccent(value)}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      </div>
      <p className="accent-selector__current">{custom ? 'custom' : value}</p>
    </div>
  )
}
