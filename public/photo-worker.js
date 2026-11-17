import { renderStudioPhotographs } from './studio-photography.js';
import { renderLifestylePhoto } from './lifestyle-photos.js';

let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.catch(() => {}).then(async () => {
    try {
      const canvases = data.kind === 'studio'
        ? await renderStudioPhotographs(data.input)
        : [await renderLifestylePhoto(data.input)];
      const images = canvases.map(canvas => canvas.transferToImageBitmap());
      self.postMessage({ id: data.id, images, scene: canvases[0].studioScene }, images);
    } catch (error) { self.postMessage({ id: data.id, error: error.message }); }
  });
};
