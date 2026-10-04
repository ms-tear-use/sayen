export default function Textarea({ label, id, className = '', ...props }) {
  return (
    <div className="field">
      {label && (
        <label htmlFor={id} className="field__label">
          {label}
        </label>
      )}
      <textarea id={id} className={`textarea ${className}`.trim()} {...props} />
    </div>
  )
}
