import opentype from 'opentype.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const fontPath = new URL('../public/fonts/Caveat.ttf', import.meta.url);
export const font = opentype.loadSync(fileURLToPath(fontPath));
export const FONT_VERSION = `Caveat-${createHash('sha256').update(readFileSync(fontPath)).digest('hex')}`;
