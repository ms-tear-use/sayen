import { supabase } from '../../supabaseClient'

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

export function notificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function enablePush(userId) {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !userId) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission()
  if (permission !== 'granted') return permission

  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!key) return 'granted'

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    })
  }

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  }, { onConflict: 'endpoint' })

  if (error) return 'granted'
  return 'granted'
}
