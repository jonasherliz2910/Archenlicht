import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), exec = promisify(execFile);
const source = process.argv[2];
if (!source) throw new Error('Pass the local original project directory containing the ignored credential files.');
const match = async (path, expression) => {
  const matches = [...new Set((await readFile(resolve(source, path), 'utf8')).match(expression) || [])];
  assert.equal(matches.length, 1, `Expected one credential in ${path}`); return matches[0];
};
const keys = {
  stripe: await match('.tools/stripe-live-key.txt', /\b(?:sk|rk)_live_[A-Za-z0-9_]+/g),
  resend: await match('resend', /\bre_[A-Za-z0-9_-]+/g),
  podbase: (await readFile(resolve(source, '.tools/podbase-api-key.txt'), 'utf8')).trim()
};
const dir = resolve('test-results/cloudflare-provider-access'); await mkdir(dir, { recursive: true });
const name = 'archenlicht-provider-check-' + randomBytes(4).toString('hex');
const token = 'Bearer ' + randomBytes(32).toString('base64url');
const path = resolve(dir, 'wrangler.json');
await writeFile(path, JSON.stringify({ name, main: resolve('tests/fixtures/cloudflare-provider-access-worker.js'),
  compatibility_date: '2026-11-15', compatibility_flags: ['nodejs_compat'], workers_dev: true, observability: { enabled: false },
  vars: { PROBE_TOKEN_HASH: createHash('sha256').update(token).digest('hex') }
}, null, 2));
const wrangler = resolve(require.resolve('wrangler/package.json'), '../bin/wrangler.js');
async function cli(args) {
  try { return await exec(process.execPath, [wrangler, ...args, '--config', path], { windowsHide: true, timeout: 90000, maxBuffer: 200000,
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: '034941a8bd5f3920086ed2245813e885' } }); }
  catch (error) { throw new Error(`Cloudflare probe ${args[0]} failed (${error.code || 'unknown'}); credentials were not logged.`); }
}
const report = { readOnly: true, temporaryWorker: name };
try {
  const deployed = await cli(['deploy']);
  const url = deployed.stdout.match(/https:\/\/archenlicht-provider-check-[a-f0-9]{8}\.jonas-herliz2910\.workers\.dev/)?.[0];
  assert.ok(url, 'Cloudflare probe URL missing');
  let available;
  for (let attempt = 0; attempt < 15; attempt++) {
    available = await fetch(url + '/check', { method: 'POST', body: '{}' });
    if (available.headers.get('X-Archenlicht-Probe') === 'read-only') break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  assert.equal(available.headers.get('X-Archenlicht-Probe'), 'read-only', 'Temporary Worker has not propagated');
  assert.equal(available.status, 404);
  const response = await fetch(url + '/check', { method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' }, body: JSON.stringify(keys), signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200);
  report.result = await response.json();
  console.log(JSON.stringify(report.result, null, 2));
  assert.equal(report.result.stripe.status, 200);
  assert.equal(report.result.podbase.catalogStatus, 200);
  assert.equal(report.result.podbase.orderReadStatus, 200);
  assert.ok(report.result.resend.status === 200 || report.result.resend.status === 401 && report.result.resend.restriction === 'sending-only');
  report.passed = true;
} finally {
  await cli(['delete', '--force']);
  report.temporaryWorkerDeleted = true;
  await writeFile(resolve(dir, 'report.json'), JSON.stringify(report, null, 2));
  console.log('Temporary read-only probe deleted. No provider settings were changed.');
}
