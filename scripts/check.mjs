import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const dirs = ['server', 'public', 'scripts', 'tests', 'api'];
let files = 0;
for (const dir of dirs) for (const name of readdirSync(dir)) {
  if (!/\.(m?js)$/.test(name)) continue;
  const file = join(dir, name), result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) { console.error(result.stderr || result.error); process.exit(1); }
  files++;
}
for (const name of ['Caveat', 'DMSans', 'CormorantGaramond']) for (const suffix of ['.ttf', '-LICENSE.txt']) if (!existsSync(resolve('public/fonts', name + suffix))) throw new Error(`Schriftdatei fehlt: ${name}${suffix}`);
const html = readFileSync('public/index.html', 'utf8');
if (!html.includes('lang="de"') || !html.includes('name="viewport"')) throw new Error('Sprache oder Viewport fehlen.');
console.log(`${files} JavaScript-Dateien syntaktisch geprüft. Schriften, Lizenzen und HTML-Grundstruktur vorhanden.`);
