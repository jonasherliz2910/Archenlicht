import { photoCanvas, photoImage } from './photo-surface.js';
import { deviceProfile, printFrame } from './device-preview.js';
import { caseColor } from './case-colors.js';
import { LIFESTYLE_MODEL } from './lifestyle-scenes.js';

let worker, sequence = 0, unavailable = false;
const pending = new Map();
function stopWorker(error) {
  unavailable = true; worker?.terminate(); worker = null;
  for (const task of pending.values()) { clearTimeout(task.timeout); task.reject(error); }
  pending.clear();
}
function getWorker() {
  if (unavailable || typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return null;
  if (!worker) {
    const url = typeof __PHOTO_WORKER_URL__ === 'undefined' ? '/photo-worker.js' : __PHOTO_WORKER_URL__;
    worker = new Worker(url, { type: 'module', name: 'archenlicht-photos' });
    worker.onerror = () => stopWorker(new Error('Foto-Hintergrundprozess nicht verfügbar'));
    worker.onmessage = ({ data }) => {
      const task = pending.get(data.id);
      if (!task) { data.images?.forEach(image => image.close()); return; }
      clearTimeout(task.timeout); pending.delete(data.id);
      if (data.error) task.reject(new Error(data.error));
      else task.resolve(data.images.map(image => {
        const canvas = photoCanvas(image.width, image.height);
        canvas.getContext('2d').drawImage(image, 0, 0); image.close();
        if (data.scene) canvas.dataset.scene = data.scene;
        return canvas;
      }));
    };
  }
  return worker;
}
export async function renderPhotoInBackground(kind, input, fallback) {
  try {
    const renderer = getWorker();
    if (!renderer) return fallback();
    // Rasterize the SVG directly at its original texture dimensions, exactly
    // as the synchronous renderer does. No extra resampling of text or motifs.
    const image = await photoImage(input.imageUrl);
    const profile = deviceProfile(kind === 'studio' ? input.model : LIFESTYLE_MODEL);
    const frame = printFrame(input.model, profile), surface = photoCanvas(profile.width, profile.height);
    const context = surface.getContext('2d', { willReadFrequently: true });
    context.fillStyle = caseColor(input.backgroundId).hex;
    context.fillRect(0, 0, surface.width, surface.height);
    context.drawImage(image, frame.x, frame.y, frame.width, frame.height);
    const ink = context.getImageData(0, 0, surface.width, surface.height), id = ++sequence;
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => stopWorker(new Error('Foto-Berechnung unterbrochen')), 45000);
      pending.set(id, { resolve, reject, timeout });
      try { renderer.postMessage({ id, kind, input: { ...input, ink } }, [ink.data.buffer]); }
      catch (error) { clearTimeout(timeout); pending.delete(id); reject(error); }
    });
  } catch { return fallback(); }
}
