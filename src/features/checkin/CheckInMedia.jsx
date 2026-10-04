export function checkInMedia(entry) {
  const url = entry?.media_url
  if (!url) return null
  const kind = entry.media_kind === 'video' || /\.(mp4|webm|mov)(\?|$)/i.test(url) ? 'video' : 'photo'
  return { url, kind }
}

export default function CheckInMedia({ entry }) {
  const media = checkInMedia(entry)
  if (!media) return null
  if (media.kind === 'video') {
    return <video className="checkin-media" src={media.url} controls playsInline />
  }
  return <img className="checkin-media" src={media.url} alt="" />
}
