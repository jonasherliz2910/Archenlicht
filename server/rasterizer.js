import sharp from 'sharp';
export const MASK_CACHE_SIZE = 8;

export async function rasterize(svg) {
  const input = Buffer.from(svg), { width, height } = await sharp(input).metadata();
  return sharp(input, { density: 300 }).resize(width, height).png().withMetadata({ density: 300 }).toBuffer();
}

export const rasterPixels = svg => sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
export const rasterMask = svg => sharp(Buffer.from(svg)).removeAlpha().greyscale().raw().toBuffer();
