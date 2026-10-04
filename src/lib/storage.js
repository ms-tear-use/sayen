import { compressImage } from './images'
import { supabase } from '../supabaseClient'

export async function uploadImage(bucket, path, file) {
  let prepared

  try {
    prepared = await compressImage(file)
  } catch (error) {
    const friendly = new Error(error.message || 'Try a JPG or PNG photo.')
    friendly.friendly = true
    throw friendly
  }

  const { error } = await supabase.storage.from(bucket).upload(path, prepared, {
    contentType: 'image/jpeg',
    upsert: true,
  })

  if (error) throw error

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}`
}

const videoTypes = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

export async function uploadCheckInMedia(spaceId, file) {
  if (file?.type?.startsWith('video/')) {
    const ext = videoTypes[file.type]
    if (!ext) {
      const friendly = new Error('Use an MP4, WebM, or MOV video.')
      friendly.friendly = true
      throw friendly
    }
    if (file.size > 25 * 1024 * 1024) {
      const friendly = new Error('Keep the video under 25 MB.')
      friendly.friendly = true
      throw friendly
    }
    const path = `${spaceId}/checkins/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('memories').upload(path, file, {
      contentType: file.type,
      upsert: false,
    })
    if (error) {
      const friendly = new Error("We couldn't save that video.")
      friendly.friendly = true
      throw friendly
    }
    const { data } = supabase.storage.from('memories').getPublicUrl(path)
    return { url: `${data.publicUrl}?v=${Date.now()}`, kind: 'video' }
  }

  const url = await uploadImage('memories', `${spaceId}/checkins/${crypto.randomUUID()}.jpg`, file)
  return { url, kind: 'photo' }
}
