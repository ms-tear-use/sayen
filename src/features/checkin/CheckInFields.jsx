import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import Button from '../../components/Button'
import ErrorMessage from '../../components/ErrorMessage'
import Textarea from '../../components/Textarea'

export const moods = [
  { value: 'great', label: 'Great' },
  { value: 'good', label: 'Good' },
  { value: 'okay', label: 'Okay' },
  { value: 'not great', label: 'Not great' },
  { value: 'rough', label: 'Rough' },
]

export const needs = [
  { value: 'talk', label: 'Talk' },
  { value: 'reassurance', label: 'Reassurance' },
  { value: 'distraction', label: 'Distraction' },
  { value: 'attention', label: 'Attention' },
  { value: 'space', label: 'Space' },
]

export function moodLabel(value) {
  if (!value) return ''
  return moods.find((item) => item.value === value)?.label || value
}

export function needLabel(value) {
  if (!value) return ''
  return needs.find((item) => item.value === value)?.label || value
}

function OptionalChoices({ legend, options, value, onChange, customId }) {
  const known = options.some((item) => item.value === value)
  return (
    <fieldset className="checkin-block">
      <legend className="checkin-block__label">
        <span>{legend}</span>
        <span className="checkin-optional">optional</span>
      </legend>
      <div className="choice-row">
        {options.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`choice ${value === item.value ? 'choice--active' : ''}`}
            aria-pressed={value === item.value}
            onClick={() => onChange(value === item.value ? '' : item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <input
        id={customId}
        className="input"
        value={known ? '' : value}
        placeholder="Or type your own"
        aria-label={`${legend}, or type your own`}
        onChange={(event) => onChange(event.target.value)}
      />
    </fieldset>
  )
}

export default function CheckInFields({
  title = '',
  setTitle,
  mood,
  setMood,
  need,
  setNeed,
  message,
  setMessage,
  onSubmit,
  saving,
  error,
  submitLabel,
  className = '',
  idPrefix = 'checkin',
  mediaPreview = null,
  onMedia,
  onClearMedia,
}) {
  const libraryRef = useRef(null)
  const cameraFileRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const facingRef = useRef('user')
  const [cameraOn, setCameraOn] = useState(false)
  const [facing, setFacing] = useState('user')
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [cameraError, setCameraError] = useState('')
  const canRecord = typeof MediaRecorder !== 'undefined'

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const closeCamera = () => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.stop()
    }
    recorderRef.current = null
    stopStream()
    setRecording(false)
    setCameraOn(false)
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      recorder.stop()
    }
  }, [])

  useEffect(() => {
    if (!recording) return undefined
    const timer = window.setInterval(() => setSeconds((current) => current + 1), 1000)
    return () => window.clearInterval(timer)
  }, [recording])

  useEffect(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (!cameraOn || !video || !stream) return undefined
    video.srcObject = stream
    video.play().catch(() => {})
    return undefined
  }, [cameraOn, facing])

  const attachStream = (stream) => {
    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
  }

  const openCamera = async (nextFacing = facingRef.current) => {
    setCameraError('')
    facingRef.current = nextFacing
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraFileRef.current?.click()
      return
    }
    stopStream()
    const attempts = [
      { video: { facingMode: nextFacing }, audio: false },
      { video: true, audio: false },
    ]
    let lastError = null
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        setFacing(nextFacing)
        setCameraOn(true)
        attachStream(stream)
        return
      } catch (error) {
        lastError = error
      }
    }
    if (lastError?.name === 'NotAllowedError' || lastError?.name === 'PermissionDeniedError') {
      setCameraError('Camera access was blocked. You can still choose a file.')
      return
    }
    if (lastError?.name === 'NotFoundError') {
      setCameraError('No camera found. You can still choose a file.')
      return
    }
    cameraFileRef.current?.click()
  }

  const pickFile = (event) => {
    const next = event.target.files?.[0] || null
    event.target.value = ''
    if (!next) return
    closeCamera()
    onMedia?.(next)
  }

  const takePhoto = () => {
    const video = videoRef.current
    if (!video?.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError("We couldn't take that photo.")
        return
      }
      const shot = new File([blob], 'checkin.jpg', { type: 'image/jpeg' })
      closeCamera()
      onMedia?.(shot)
    }, 'image/jpeg', 0.9)
  }

  const toggleRecord = async () => {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    let stream = streamRef.current
    if (!stream) return
    try {
      const withAudio = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingRef.current },
        audio: true,
      })
      stopStream()
      stream = withAudio
      attachStream(stream)
    } catch {
      stream = streamRef.current
    }
    if (!stream) return
    const types = ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4']
    const mimeType = types.find((type) => MediaRecorder.isTypeSupported(type)) || ''
    let recorder
    try {
      recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    } catch {
      setCameraError("This browser can't record video. Take a photo instead.")
      return
    }
    const chunks = []
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data)
    }
    recorder.onstop = () => {
      const type = (recorder.mimeType || 'video/webm').split(';')[0]
      const clip = new File([new Blob(chunks, { type })], type === 'video/mp4' ? 'checkin.mp4' : 'checkin.webm', { type })
      recorderRef.current = null
      stopStream()
      setRecording(false)
      setCameraOn(false)
      if (!clip.size) {
        setCameraError("We couldn't save that recording.")
        return
      }
      onMedia?.(clip)
    }
    recorderRef.current = recorder
    setSeconds(0)
    setRecording(true)
    recorder.start()
  }

  const filled = [title, mood, need, message].some((value) => String(value || '').trim()) || Boolean(mediaPreview?.url)

  return (
    <form className={`stack-form checkin-form ${className}`.trim()} onSubmit={onSubmit}>
      <div className="checkin-block">
        <div className="checkin-block__label">
          <label className="field__label" htmlFor={`${idPrefix}-title`}>Title</label>
          <span className="checkin-optional">optional</span>
        </div>
        <input
          id={`${idPrefix}-title`}
          className="input"
          value={title}
          onChange={(event) => setTitle?.(event.target.value)}
          placeholder="A short title"
        />
      </div>

      <OptionalChoices
        legend="Mood"
        options={moods}
        value={mood || ''}
        onChange={setMood}
        customId={`${idPrefix}-mood-custom`}
      />

      <div className="checkin-block">
        <div className="checkin-block__label">
          <label className="field__label" htmlFor={`${idPrefix}-message`}>What's on your mind?</label>
          <span className="checkin-optional">optional</span>
        </div>
        <Textarea
          id={`${idPrefix}-message`}
          rows={4}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="A few words is enough."
        />
      </div>

      <OptionalChoices
        legend="What do you need?"
        options={needs}
        value={need || ''}
        onChange={setNeed}
        customId={`${idPrefix}-need-custom`}
      />

      <div className="checkin-block">
        <div className="checkin-block__label">
          <span className="field__label">Photo or video</span>
          <span className="checkin-optional">optional</span>
        </div>
        <div className="checkin-capture__actions">
          <Button type="button" variant="secondary" onClick={() => libraryRef.current?.click()}>
            Choose a file
          </Button>
          <Button type="button" variant="secondary" onClick={() => openCamera('user')} disabled={recording}>
            <Camera size={18} aria-hidden="true" /> Open camera
          </Button>
        </div>
        <input
          ref={libraryRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          onChange={pickFile}
        />
        <input
          ref={cameraFileRef}
          className="sr-only"
          type="file"
          accept="image/*,video/*"
          capture="user"
          onChange={pickFile}
        />
        {cameraError && <p className="muted">{cameraError}</p>}
        {cameraOn && (
          <div className="checkin-capture">
            <video
              ref={videoRef}
              className={`checkin-media ${facing === 'user' ? 'checkin-camera--mirror' : ''}`}
              autoPlay
              playsInline
              muted
            />
            <div className="checkin-camera-bar">
              <button type="button" className="text-button" onClick={takePhoto} disabled={recording}>Take photo</button>
              {canRecord && (
                <button type="button" className="text-button" onClick={toggleRecord}>
                  {recording ? `Stop (${seconds}s)` : 'Record'}
                </button>
              )}
              <button
                type="button"
                className="text-button"
                onClick={() => openCamera(facing === 'user' ? 'environment' : 'user')}
                disabled={recording}
              >
                Flip
              </button>
              <button type="button" className="text-button" onClick={closeCamera} disabled={recording}>Close</button>
            </div>
          </div>
        )}
        {!cameraOn && mediaPreview?.url && (
          mediaPreview.kind === 'video'
            ? <video className="checkin-media" src={mediaPreview.url} controls playsInline />
            : <img className="checkin-media" src={mediaPreview.url} alt="" />
        )}
        {!cameraOn && mediaPreview?.url && (
          <button type="button" className="text-button" onClick={onClearMedia}>Remove photo or video</button>
        )}
      </div>

      <p className="muted checkin-hint">One field is enough. A title, mood, note, photo, or what you need.</p>
      <ErrorMessage message={error} />
      <Button type="submit" disabled={saving || !filled}>{submitLabel}</Button>
    </form>
  )
}
