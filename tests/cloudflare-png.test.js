import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32 } from 'node:zlib';
import sharp from 'sharp';
import { printPngMetadata } from '../cloudflare/png-metadata.js';

test('Cloudflare PNG preserves every pixel and writes valid, unique 300 DPI/sRGB chunks', async () => {
  const original = await sharp({ create: { width: 7, height: 11, channels: 4, background: { r: 200, g: 217, b: 227, alpha: .5 } } }).png().withMetadata({ density: 72 }).toBuffer();
  const output = printPngMetadata(original), metadata = await sharp(output).metadata();
  assert.equal(metadata.width, 7); assert.equal(metadata.height, 11);
  assert.equal(metadata.density, 300); assert.equal(metadata.space, 'srgb');
  assert.deepEqual(await sharp(output).raw().toBuffer(), await sharp(original).raw().toBuffer());
  const chunks = [];
  for (let offset = 8; offset < output.length;) {
    const size = output.readUInt32BE(offset), type = output.toString('ascii', offset + 4, offset + 8);
    assert.equal(output.readUInt32BE(offset + size + 8), crc32(output.subarray(offset + 4, offset + size + 8)));
    chunks.push(type); offset += size + 12;
  }
  assert.equal(chunks.filter(type => type === 'pHYs').length, 1);
  assert.equal(chunks.filter(type => type === 'sRGB').length, 1);
  assert.ok(!chunks.includes('iCCP'));
  assert.deepEqual(printPngMetadata(output), output);
  assert.throws(() => printPngMetadata(Buffer.from('not a PNG')));
});
