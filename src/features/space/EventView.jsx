import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Pencil, Trash2, X } from 'lucide-react'
import { eventDetail, eventEmoji, eventLabel, hasReminder, inferType, isLinkable, linkLabel, presentEvent, reminderLabel, reminderOf, repeatLabel, typeName } from './events'
import { EventCard } from './EventPreview'
import { formatDateOnly, formatMonthDay } from './dates'
import { formatClock, viewerWhen } from '../../lib/timezone'
import PersonName from '../../components/PersonName'

function photoUrl(photo) {
  return photo?.url || photo?.image_url || ''
}

function Field({ label, children }) {
  if (children == null || children === false || children === '') return null
  return (
    <div className="event-field">
      <span className="event-field__label">{label}</span>
      <div className="event-field__value">{children}</div>
    </div>
  )
}

function PhotoViewer({ photos, index, title, onIndex, onClose }) {
  const count = photos.length
  const step = (delta) => onIndex((index + delta + count) % count)

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation()
        onClose()
      } else if (event.key === 'ArrowRight') {
        event.stopImmediatePropagation()
        onIndex((current) => (current + 1) % count)
      } else if (event.key === 'ArrowLeft') {
        event.stopImmediatePropagation()
        onIndex((current) => (current - 1 + count) % count)
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [count, onClose, onIndex])

  return createPortal(
    <div className="event-lightbox" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="event-lightbox__close" aria-label="Close photo" onClick={onClose}>
        <X size={18} aria-hidden="true" />
      </button>
      {count > 1 && (
        <button type="button" className="event-lightbox__nav event-lightbox__nav--prev" aria-label="Previous photo" onClick={() => step(-1)}>
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
      )}
      <img src={photos[index]} alt="" />
      {count > 1 && (
        <button type="button" className="event-lightbox__nav event-lightbox__nav--next" aria-label="Next photo" onClick={() => step(1)}>
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      )}
      {count > 1 && <p className="event-lightbox__count">{index + 1} / {count}</p>}
    </div>,
    document.body,
  )
}

export default function EventView({ item, when, photos, members, currentUserId, viewerZone, linkedMemories = [], linkedMilestone = null, onOpenMemory, onOpenMilestone, onAddMemory, onEdit, onDelete }) {
  const [zoomIndex, setZoomIndex] = useState(null)
  const [hero, setHero] = useState(0)
  const source = item.date || item.memory || {}
  const type = item.kind === 'memory' ? 'memory' : inferType(source)
  const emoji = item.icon || eventEmoji(source)
  const heading = type === 'birthday' ? eventLabel(source, when) : (item.kind === 'memory' ? item.title : (source.title || item.title))
  const milestone = type === 'milestone' ? eventDetail(source, when) : ''
  const reminded = type !== 'memory' && hasReminder(source)
  const reminder = reminded ? reminderLabel(reminderOf(source)) : ''
  const repeat = type === 'memory' ? '' : repeatLabel(source)
  const wallDate = source.occurrence_date
    ? String(source.event_date || item.occurrenceKey || '').slice(0, 10)
    : String(item.occurrenceKey || source.event_date || source.date || '').slice(0, 10)
  const local = source.start_time
    ? viewerWhen(wallDate, source.start_time, source.time_zone || viewerZone, viewerZone)
    : null
  const time = local?.time ? formatClock(local.time) : ''
  const dateKey = local?.dateKey || wallDate
  const shownDate = type === 'memory' ? formatDateOnly(dateKey) : formatMonthDay(dateKey)
  const note = item.kind === 'memory' ? item.memory?.caption : source.description
  const location = item.memory?.location || ''
  const gallery = photos.map(photoUrl).filter(Boolean)
  const reminderText = reminder === 'At time of event' ? 'At event time' : reminder
  const openPhoto = (index) => { if (index >= 0) setZoomIndex(index) }
  const heroIndex = photos.length ? Math.min(hero, photos.length - 1) : 0
  const dateLabel = type === 'birthday' ? 'Birth date' : 'Date'

  return (
    <div className={`event-view event-view--${type}`}>
      <header className="event-view__intro">
        <h3 className="event-view__title">
          <span className="event-view__mark" aria-hidden="true">{emoji}</span>
          <span>{heading || 'Untitled'}</span>
        </h3>
        <p className="event-view__kind">{typeName(type)}</p>
        {type === 'memory' && note && <p className="event-view__caption">{note}</p>}
      </header>

      <div className="event-fields">
        <Field label={dateLabel}>{shownDate}</Field>
        {type === 'milestone' && <Field label="Count">{milestone}</Field>}
        {type === 'important' && time && (
          <Field label="Time">
            <span className="event-time-line">
              <span>{time}</span>
              <span className="event-view__hint">Your partner sees this in their own timezone.</span>
            </span>
          </Field>
        )}
        {type === 'memory' && <Field label="Location">{location}</Field>}
        {type !== 'memory' && repeat && repeat !== 'Does not repeat' && <Field label="Repeat">{repeat}</Field>}
        {reminded && <Field label="Reminder">{reminderText}</Field>}
        {type === 'memory' && (
          <Field label="Added by">
            <PersonName members={members} userId={item.memory?.user_id} currentUserId={currentUserId} />
          </Field>
        )}
        {type === 'memory' && linkedMilestone && (
          <Field label="Linked to">
            <button type="button" className="event-link event-link--inline" onClick={() => onOpenMilestone?.(linkedMilestone)}>
              <strong>{linkLabel(linkedMilestone)}</strong>
            </button>
          </Field>
        )}
        {note && type !== 'memory' && (
          <Field label="Note">
            <p className="event-field__note">{note}</p>
          </Field>
        )}
      </div>

      {type !== 'memory' && isLinkable(source) && (
        <section className="event-links" aria-label="Memories">
          <h4>Memories</h4>
          {linkedMemories.length === 0 ? (
            <p className="muted">No memories linked yet.</p>
          ) : (
            <div className="event-cards">
              {linkedMemories.map((memory) => (
                <EventCard
                  key={memory.id}
                  preview={presentEvent(memory, { kind: 'memory', dateKey: memory.date, photo: memory.image_url || '' })}
                  onClick={() => onOpenMemory?.(memory)}
                />
              ))}
            </div>
          )}
          {onAddMemory && (
            <button type="button" className="event-links__add" onClick={onAddMemory}>+ Add Memory</button>
          )}
        </section>
      )}

      {photos.length > 0 && (
        <section className="event-photos-block" aria-label="Photos">
          <div className="event-photos-block__top">
            <span className="event-field__label">Photos</span>
            <span className="event-photos-block__count">{photos.length}</span>
          </div>
          <div className="memory-gallery">
            <figure className="memory-gallery__hero">
              <button type="button" onClick={() => openPhoto(heroIndex)} aria-label="View photo">
                <img src={photoUrl(photos[heroIndex])} alt="" />
              </button>
            </figure>
            {photos.length > 1 && (
              <div className="memory-gallery__row">
                {photos.map((photo, index) => (
                  <figure key={photo.id || `${photoUrl(photo)}-${index}`}>
                    <button
                      type="button"
                      className={index === heroIndex ? 'is-current' : ''}
                      aria-current={index === heroIndex ? 'true' : undefined}
                      aria-label={`Show photo ${index + 1}`}
                      onClick={() => setHero(index)}
                    >
                      <img src={photoUrl(photo)} alt="" />
                    </button>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <div className="event-view__bar">
        <button type="button" className="button button--primary event-view__edit" onClick={onEdit}>
          <Pencil size={16} aria-hidden="true" />
          Edit
        </button>
        <button type="button" className="event-view__delete" onClick={onDelete} aria-label="Delete">
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>

      {zoomIndex != null && gallery[zoomIndex] && (
        <PhotoViewer
          photos={gallery}
          index={zoomIndex}
          title={heading || 'Photo'}
          onIndex={setZoomIndex}
          onClose={() => setZoomIndex(null)}
        />
      )}
    </div>
  )
}
