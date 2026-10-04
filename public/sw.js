self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'sayen', body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(self.registration.showNotification(payload.title || 'sayen', {
    body: payload.body || '',
    data: { url: payload.url || 'space/calendar' },
    icon: 'favicon.svg',
  }))
})

function appUrl(path) {
  const clean = String(path || 'home').replace(/^\//, '')
  return new URL(clean, self.registration.scope).href
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = appUrl(event.notification.data?.url || 'space/calendar')
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const open = windows.find((windowClient) => windowClient.url.startsWith(self.location.origin))
    if (open) {
      open.focus()
      return open.navigate(url)
    }
    return clients.openWindow(url)
  }))
})
