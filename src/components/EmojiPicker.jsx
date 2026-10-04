import { useEffect, useRef, useState } from 'react'
import 'emoji-picker-element'
import Modal from './Modal'

function PickerPanel({ onPick }) {
  const onPickRef = useRef(onPick)

  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  useEffect(() => {
    const node = document.getElementById('sayen-emoji-picker')
    if (!node) return undefined
    const handle = (event) => {
      const emoji = event.detail?.unicode
      if (emoji) onPickRef.current(emoji)
    }
    node.addEventListener('emoji-click', handle)
    return () => node.removeEventListener('emoji-click', handle)
  }, [])

  const mode = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  return <emoji-picker id="sayen-emoji-picker" className={mode} />
}

export function EmojiDialog({ open, onClose, onPick, recent = [] }) {
  const choose = (emoji) => {
    onPick(emoji)
    onClose()
  }

  return (
    <Modal open={open} title="Choose an emoji" className="modal--sheet" onClose={onClose}>
      {open && (
        <>
          {recent.length > 0 && (
            <div className="emoji-picker-block">
              <span className="emoji-picker-label">Recently used</span>
              <div className="emoji-choices" role="group" aria-label="Recently used">
                {recent.slice(0, 4).map((emoji) => (
                  <button key={emoji} type="button" className="emoji-choice" onClick={() => choose(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
          <PickerPanel onPick={choose} />
        </>
      )}
    </Modal>
  )
}

export default function EmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="field">
      <span className="field__label">Emoji</span>
      <div className="emoji-open-row">
        <button type="button" className="emoji-open" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <span className="emoji-open__mark" aria-hidden="true">{value || '☺'}</span>
          {value ? 'Change emoji' : 'Choose emoji'}
        </button>
        {value && (
          <button type="button" className="text-button" onClick={() => onChange('')}>Clear</button>
        )}
      </div>
      <Modal open={open} title="Choose an emoji" onClose={() => setOpen(false)}>
        {open && (
          <PickerPanel onPick={(emoji) => {
            onChange(emoji)
            setOpen(false)
          }} />
        )}
      </Modal>
    </div>
  )
}
