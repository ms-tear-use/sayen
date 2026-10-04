export default function Input({ label, id, className = '', ...props }) {
  return (
    <div className="field">
      {label && (
        <label htmlFor={id} className="field__label">
          {label}
        </label>
      )}
      <input id={id} className={`input ${className}`.trim()} {...props} />
    </div>
  )
}
