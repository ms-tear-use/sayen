import { Bell, Cake, Calendar, Camera, Heart, HeartHandshake } from 'lucide-react'

const icons = {
  heart: Heart,
  hearts: HeartHandshake,
  cake: Cake,
  calendar: Calendar,
  bell: Bell,
  camera: Camera,
}

export default function EventIcon({ name, size = 18 }) {
  const Icon = icons[name]
  if (!Icon) {
    return <span className="event-emoji" style={{ fontSize: size }} aria-hidden="true">{name || '📌'}</span>
  }
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />
}
