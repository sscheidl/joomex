// Local raster images: checked by their file signature, embedded as data: URLs. Large photos are scaled down
// in memory (which also drops camera metadata). Nothing is read without an explicit file selection.
export const MAX_IMAGE_INPUT = 20 * 1024 * 1024;
export const SMALL_IMAGE = 200 * 1024;
export const MAX_IMAGE_EMBED = 450 * 1024;

export function sniffImage(b) {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

function toDataUrl(blob, type) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const s = String(reader.result); resolve('data:' + type + ';base64,' + s.slice(s.indexOf(',') + 1)); };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Returns { dataUrl, scaled } or { error: 'big' | 'type' | 'gif' | 'decode' }.
export async function prepareImage(file) {
  if (file.size > MAX_IMAGE_INPUT) return { error: 'big' };
  let type, bitmap;
  try {
    type = sniffImage(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
    if (!type) return { error: 'type' };
    bitmap = await createImageBitmap(file);
  } catch (e) {
    return { error: type ? 'decode' : 'type' };
  }
  try {
    if (file.size <= SMALL_IMAGE) return { dataUrl: await toDataUrl(file, type), scaled: false };
    if (type === 'image/gif') return { error: 'gif' };
    let side = 1280, quality = 0.85;
    for (let attempt = 0; attempt < 4; attempt++) {
      const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const g = canvas.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= MAX_IMAGE_EMBED) return { dataUrl: await toDataUrl(blob, 'image/jpeg'), scaled: true };
      side = Math.round(side * 0.7);
      quality = 0.8;
    }
    return { error: 'big' };
  } catch (e) {
    return { error: 'decode' };
  } finally {
    if (bitmap.close) bitmap.close();
  }
}
