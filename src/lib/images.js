export function compressImage(file, maxSize = 1600, quality = 0.82) {
  if (!file?.type?.startsWith('image/')) {
    return Promise.reject(new Error('Try a JPG or PNG photo.'))
  }

  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)

    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')

      if (!context) {
        URL.revokeObjectURL(url)
        reject(new Error('Try a JPG or PNG photo.'))
        return
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        if (!blob) {
          reject(new Error('Try a JPG or PNG photo.'))
          return
        }
        resolve(new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
      }, 'image/jpeg', quality)
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Try a JPG or PNG photo.'))
    }

    image.src = url
  })
}
