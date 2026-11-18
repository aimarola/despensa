import { supabase } from './supabase'

/** Reduce la foto del móvil (varios MB) a una miniatura JPEG ligera */
export async function compressImage(file: File, maxSize = 640, quality = 0.78): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('No se pudo leer la imagen'))
      i.src = url
    })
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale)
    const h = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas no disponible')
    ctx.drawImage(img, 0, 0, w, h)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo comprimir'))), 'image/jpeg', quality),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Sube la foto a Supabase Storage y devuelve su URL pública */
export async function uploadProductImage(householdId: string, file: File): Promise<string> {
  const blob = await compressImage(file)
  const path = `${householdId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
  if (error) throw error
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
}

/** Borra una foto propia del Storage (las de Open Food Facts se ignoran) */
export async function deleteProductImage(url: string | null) {
  if (!url) return
  const marker = '/product-images/'
  const i = url.indexOf(marker)
  if (i < 0 || !url.includes('supabase')) return
  await supabase.storage.from('product-images').remove([url.slice(i + marker.length)])
}
