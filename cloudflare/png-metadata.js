const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function chunk(type, data) {
  const output = Buffer.alloc(data.length + 12);
  output.writeUInt32BE(data.length, 0); output.write(type, 4, 4, 'ascii');
  output.set(data, 8);
  let crc = 0xffffffff;
  for (const byte of output.subarray(4, -4)) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  output.writeUInt32BE((crc ^ 0xffffffff) >>> 0, output.length - 4);
  return output;
}
export function printPngMetadata(input) {
  const png = Buffer.from(input);
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.toString('ascii', 12, 16) !== 'IHDR') throw new Error('Invalid raster output.');
  const phys = Buffer.alloc(9);
  phys.writeUInt32BE(Math.round(300 / 0.0254), 0); phys.writeUInt32BE(Math.round(300 / 0.0254), 4); phys[8] = 1;
  // Keep every image byte and add explicit 300 DPI and sRGB metadata after IHDR.
  const chunks = [png.subarray(0, 33), chunk('pHYs', phys), chunk('sRGB', Buffer.from([0]))];
  for (let offset = 33; offset < png.length;) {
    if (offset + 12 > png.length) throw new Error('Truncated PNG.');
    const length = png.readUInt32BE(offset) + 12, type = png.toString('ascii', offset + 4, offset + 8);
    if (offset + length > png.length) throw new Error('Truncated PNG chunk.');
    if (!['pHYs', 'sRGB', 'iCCP', 'eXIf'].includes(type)) chunks.push(png.subarray(offset, offset + length));
    offset += length;
  }
  return Buffer.concat(chunks);
}
