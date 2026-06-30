import { supabase } from './supabase'

const BUCKET = 'plant-photos'
const MAX_DIMENSION = 1200
const JPEG_QUALITY = 0.8

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = (e) => { img.src = e.target.result }
    reader.onerror = reject
    img.onload = () => {
      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width)
          width = MAX_DIMENSION
        } else {
          width = Math.round((width * MAX_DIMENSION) / height)
          height = MAX_DIMENSION
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', JPEG_QUALITY)
    }
    img.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function uploadPlantPhoto(userId, plantId, file) {
  const blob = await resizeImage(file)
  const path = `${userId}/${plantId}/${Date.now()}.jpg`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('plant_photos')
    .insert({ plant_id: plantId, user_id: userId, storage_path: path })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listPlantPhotos(plantId) {
  const { data, error } = await supabase
    .from('plant_photos')
    .select('*')
    .eq('plant_id', plantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getMainPhoto(plantId) {
  const { data, error } = await supabase
    .from('plant_photos')
    .select('*')
    .eq('plant_id', plantId)
    .order('is_main', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function setMainPhoto(plantId, photoId) {
  await supabase.from('plant_photos').update({ is_main: false }).eq('plant_id', plantId).eq('is_main', true)
  const { error } = await supabase.from('plant_photos').update({ is_main: true }).eq('id', photoId)
  if (error) throw error
}

export async function deletePlantPhoto(photo) {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([photo.storage_path])
  if (storageError) throw storageError
  const { error } = await supabase.from('plant_photos').delete().eq('id', photo.id)
  if (error) throw error
}

export async function getSignedUrl(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function getSignedUrls(paths) {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
  if (error) throw error
  const map = {}
  data.forEach((d, i) => { map[paths[i]] = d.signedUrl })
  return map
}