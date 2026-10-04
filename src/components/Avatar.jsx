import { useState } from 'react'
import { getInitials } from '../lib/helpers'

export default function Avatar({ name = '', src = '', size = 'md' }) {
  const [failed, setFailed] = useState(false)
  const showImage = src && !failed

  return (
    <span className={`avatar avatar--${size}`}>
      {showImage ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true">{getInitials(name)}</span>
      )}
    </span>
  )
}
