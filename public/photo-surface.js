// Shared image/canvas primitives keep the exact same composition on the main
// thread (older browsers) and in an OffscreenCanvas worker (modern browsers).
export const inPhotoWorker = typeof document === 'undefined';
export function photoCanvas(width, height) {
  if (inPhotoWorker) return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}
export function photoImage(url) {
  if (inPhotoWorker) return fetch(url).then(response => {
    if (!response.ok) throw new Error('Fotovorlage nicht verfügbar');
    return response.blob();
  }).then(blob => createImageBitmap(blob));
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Fotovorlage nicht verfügbar'));
    image.src = url;
  });
}
