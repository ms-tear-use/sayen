export default function LoadingState({ message = 'Loading...', compact = false }) {
  return (
    <div className={compact ? 'loading-state loading-state--compact' : 'loading-state'} role="status">
      <div className="spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  )
}
