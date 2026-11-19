// Local raster images. The source text refers to an image by its file name; the editor never reads the folder
// of a page. To show an image in the page pane anyway, the file the pupil has chosen is kept in memory and
// addressed by an object URL. Nothing is read without an explicit file selection.
export const LARGE_IMAGE = 2 * 1024 * 1024;

export function sniffImage(b) {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

// Checks a chosen file and returns { name, url, width, height, large } or { error: 'type' | 'decode' }.
// The type comes from the file signature, not from the name or the type the system reports, and the object
// URL is created for a copy labelled with that type.
export async function readImage(file) {
  let type, bitmap;
  try {
    type = sniffImage(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
    if (!type) return { error: 'type' };
    bitmap = await createImageBitmap(file);
  } catch (e) {
    return { error: type ? 'decode' : 'type' };
  }
  const size = { width: bitmap.width, height: bitmap.height };
  if (bitmap.close) bitmap.close();
  return { name: file.name, url: URL.createObjectURL(new Blob([file], { type })), width: size.width, height: size.height, large: file.size > LARGE_IMAGE };
}
