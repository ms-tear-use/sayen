import { Link } from 'react-router-dom'

export default function IconButton({ label, children, to, danger = false, className = '', ...props }) {
  const classes = `icon-button ${danger ? 'icon-button--danger' : ''} ${className}`.trim()
  if (to) {
    return (
      <Link to={to} className={classes} aria-label={label} title={label}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" className={classes} aria-label={label} title={label} {...props}>
      {children}
    </button>
  )
}
