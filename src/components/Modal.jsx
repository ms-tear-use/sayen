import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function Modal({ open, title, onClose, children, className = '' }) {
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined

    const previouslyFocused = document.activeElement
    const dialog = dialogRef.current
    const field = dialog?.querySelector('textarea, select, input:not([type="file"]):not([type="hidden"])')
    if (field) field.focus()
    else dialog?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab' || !dialog) return
      const focusable = dialog.querySelectorAll('button, [href], input, textarea, select')
      if (!focusable.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className={`modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {className.includes('modal--sheet') && (
          <div
            className="modal__grab"
            onPointerDown={(event) => {
              if (window.matchMedia('(min-width: 768px)').matches) return
              const sheet = dialogRef.current
              if (!sheet) return
              const start = event.clientY
              sheet.setPointerCapture(event.pointerId)
              const move = (pointer) => {
                const next = Math.max(0, pointer.clientY - start)
                sheet.style.transform = `translateY(${next}px)`
              }
              const end = (pointer) => {
                const next = Math.max(0, pointer.clientY - start)
                sheet.style.transform = ''
                sheet.removeEventListener('pointermove', move)
                sheet.removeEventListener('pointerup', end)
                sheet.removeEventListener('pointercancel', end)
                if (next > 90) onCloseRef.current()
              }
              sheet.addEventListener('pointermove', move)
              sheet.addEventListener('pointerup', end)
              sheet.addEventListener('pointercancel', end)
            }}
          />
        )}
        <div className="modal__header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close" title="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="modal__body">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
