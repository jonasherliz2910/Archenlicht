// Build a luminance mask for the renderer; original artwork pixels are never
// recolored, resized or overwritten. Only exterior paper is made transparent.
import sharp from 'sharp';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('server/design-package.json', root), 'utf8'));
const output = new URL('public/assets/design-masks-v1/', root);
await mkdir(output, { recursive: true });
const records = {};
for (const record of manifest.designs) {
  const id = record.id.replace(/^\d+-/, '').toLowerCase(), filename = record.image.split('/').pop();
  const bytes = await readFile(new URL(`public/assets/designpaket-v2-farbe/${filename}`, root));
  const { data, info: { width, height } } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const count = width * height, paper = new Uint8Array(count), exterior = new Uint8Array(count), queue = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    const [r, g, b] = data.subarray(i * 3, i * 3 + 3);
    paper[i] = r >= 244 && g >= 240 && b >= 234 && r - g < 9 && g - b < 10 ? 1 : 0;
  }
  // Intentional breaks in the line drawings must not let the exterior fill
  // erase skin/hair. These short bridges affect the mask, never the artwork.
  const bridges = {
    'ganz-nah': 'M575 623L584 644 M657 875L658 895 M693 937L689 957 M204 1098L219 1098',
    'im-schatten': 'M143 1118L221 1197'
  }[id];
  if (bridges) {
    const barrier = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path d="${bridges}" fill="none" stroke="white" stroke-width="8"/></svg>`)).ensureAlpha().raw().toBuffer();
    for (let i = 0; i < count; i++) if (barrier[i * 4 + 3] > 10) paper[i] = 0;
  }
  let head = 0, tail = 0;
  const visit = i => { if (paper[i] && !exterior[i]) { exterior[i] = 1; queue[tail++] = i; } };
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const i = queue[head++], x = i % width;
    if (x) visit(i - 1); if (x < width - 1) visit(i + 1);
    if (i >= width) visit(i - width); if (i < count - width) visit(i + width);
  }
  const mask = Buffer.alloc(count); let left = width, right = 0, top = height, bottom = 0;
  for (let i = 0; i < count; i++) if (!exterior[i]) {
    mask[i] = 255;
    const x = i % width, y = Math.floor(i / width);
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  // This deliberately open drawing has no closed skin/hair contour. Preserve
  // its original light interior with an explicit silhouette inside the lines.
  if (id === 'ganz-nah') {
    const path = 'M577 624 C519 570 441 547 368 587 C310 619 276 680 271 749 C239 727 207 741 187 774 C170 801 178 827 200 837 C194 866 211 898 242 904 C275 911 305 891 326 869 C309 924 270 966 239 1007 C216 1037 207 1072 205 1100 L232 1060 C289 971 366 967 428 996 L478 1040 L585 1090 L635 1055 L652 1023 L676 1022 C661 1000 668 987 681 968 L692 941 C697 911 681 885 657 877 C644 852 609 838 581 849 L575 850 Q573 835 592 830 Q611 826 601 810 C587 786 580 774 592 746 C601 722 609 689 589 646 C621 659 632 697 606 724 L602 723 C626 694 621 659 584 641 L577 624 Z';
    const interior = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path d="${path}" fill="white"/></svg>`)).ensureAlpha().raw().toBuffer();
    for (let i = 0; i < count; i++) mask[i] = Math.max(mask[i], interior[i * 4 + 3]);
  }
  const png = await sharp(mask, { raw: { width, height, channels: 1 } }).blur(1).png().toBuffer();
  await writeFile(new URL(`${id}.png`, output), png);
  records[id] = { sourceHash: createHash('sha256').update(bytes).digest('hex'), maskHash: createHash('sha256').update(png).digest('hex'), bounds: { x: left, y: top, width: right - left + 1, height: bottom - top + 1 } };
}
await writeFile(new URL('manifest.json', output), JSON.stringify(records, null, 2) + '\n');
console.log('Six renderer masks generated; original artwork unchanged.');
