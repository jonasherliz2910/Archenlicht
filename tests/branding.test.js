import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { BRAND } from '../server/catalog.js';

test('Freigegebenes Original-Logo bleibt bytegleich und ungeteilt in Shop, Karte und Social-Profil', async () => {
  const source = readFileSync('Logoentwürfe/Archenlicht-02.png'), publicLogo = readFileSync('public/assets/archenlicht-logo.png');
  assert.deepEqual(publicLogo, source);
  const image = await sharp(publicLogo).metadata(); assert.equal(image.width / image.height, 2);
  assert.equal(BRAND.logo, '/assets/archenlicht-logo.png'); assert.deepEqual(BRAND.colors, { paper: '#FCF8EF', sage: '#A6B99B', forest: '#163E29' });
  const embeddedOriginal = `data:image/png;base64,${source.toString('base64')}`;
  for (const file of ['geschenkkarte-entwurf.svg', 'social-profil.svg']) assert.ok(readFileSync(`public/assets/${file}`, 'utf8').includes(embeddedOriginal));
  const card = await sharp('public/assets/geschenkkarte-entwurf.png').metadata(); assert.equal(card.width, 1181); assert.equal(card.height, 1772); assert.equal(card.density, 300);
});
