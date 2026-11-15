# Cloudflare compatibility trial — 15 November 2026

## Scope

This is a separate technical trial on branch `codex/cloudflare-test`, not a
replacement for the deployed shop. Production remains at commit `74074b7` on
Vercel with checkout and Podbase submission disabled. No DNS change, hosting
purchase, customer migration or production deployment is included.

The trial tests the two CPU-heavy parts of a potential Cloudflare migration:

- generating full-resolution personalised PNGs from the actual shop motifs,
  text placement and official Podbase print templates;
- the shop's existing scrypt password parameters with fixed dummy values.

It contains no Stripe, Podbase, Resend or database credentials. It cannot
register a customer, send email, charge a payment or submit a manufacturing
order. The password check is a compatibility test, not an implemented login.

## Implementation

The native Sharp rasterizer remains unchanged in behavior. Font loading,
rasterization and print-template loading are extracted into small modules so
the trial can provide platform-specific implementations. The Cloudflare build
uses resvg-wasm 2.6.2; the deployed Vercel shop continues to use Sharp.

Build-time validation checks the original artwork/mask/foreground hashes.
The exact font data is embedded. Original foreground PNGs are loaded through
the static-assets binding and their hashes are checked again before rendering;
only the current motif stays cached in memory. The existing OpenType code produces the same text paths. The
same template validation and placement code runs with the alternate rasterizer.
Generated PNGs carry explicit sRGB and 300 DPI metadata. Pixel checks compare
the alternate renderer against the existing native renderer; images are not
expected to be byte-identical because rasterization/antialiasing differs.

The test runs rendering and scrypt inside a SQLite-backed Durable Object.
The outer Worker only forwards requests and serves the small test page.
No Durable Object user data is written. The test limits expensive requests
to 20 per minute, checks the request origin, accepts bounded configuration
JSON rather than arbitrary SVG, and keeps one large print mask cached.

Cloudflare documents Free-plan SQLite-backed Durable Objects and a default
30-second CPU budget for Durable Object invocations. This differs from the
10 ms limit of ordinary Free Worker requests. The account's real deployment
and runtime limits must still be checked; a successful local run is not proof
of a complete free production shop.

## Deployment settings for this trial only

| Setting | Value |
| --- | --- |
| GitHub repository | `jonasherliz2910/Archenlicht` |
| Branch | `codex/cloudflare-test` |
| Project name | `archenlicht-cloudflare-test` |
| Root directory | repository root |
| Build command | `pnpm run build:cloudflare-test` |
| Deploy command | `pnpm run deploy:cloudflare-test` |
| Preview builds | disabled for the first trial |
| Secrets / provider keys | none |

Do not deploy the current `main` branch with these commands: the trial scripts
exist only on the trial branch. If the initial Cloudflare screen does not
allow the branch to be selected, do not perform a knowingly failing main-branch
deployment; connect the prepared branch using the supported project setup.
Keep the account on Workers Free. Do not connect `archenlicht.de` at this stage.

## Reproduce locally

```text
pnpm install --frozen-lockfile
pnpm run build:cloudflare-test
pnpm exec wrangler dev --config cloudflare/wrangler.jsonc --local --port 8792
node scripts/check-cloudflare-test.mjs
```

Native behavior checks:

```text
node --test --test-concurrency=1 tests/production-print.test.js tests/design-package.test.js tests/shop.test.js tests/cloudflare-png.test.js
```

Evidence is stored in ignored `test-results/cloudflare/`. Local execution does
not establish actual Cloudflare production CPU consumption or availability.

### Completed local checks

- 28 existing design, print-template and shop tests passed after extracting the
  native rasterizer/font/template modules; the ordinary web build also passed.
- PNG metadata regression passed: pixels unchanged, valid chunk checksums,
  unique 300 DPI/sRGB metadata, replacement of conflicting density metadata.
- 57 comparisons in the actual local Workers/Durable Objects runtime passed:
  all six motifs in all nine colors on iPhone 14 Pro, plus custom text on
  iPhone 14 Pro MagSafe, Google Pixel 9 Pro and Samsung Galaxy S24 Ultra.
  Dimensions, template hash and exact placement matched the original pipeline.
  Worst mean difference was 0.060 on a 0–255 channel scale; no channel sample
  differed by more than 40. Missing templates and overlong text were rejected.
- Desktop 1440 px and mobile 390 px UI checks passed, including a mobile
  custom-text MagSafe render; no JavaScript errors or horizontal overflow.
- After moving PNGs out of the Worker bundle into static assets, all six
  black-background outputs were checked again for byte-identical results.
- Wrangler's deployment dry run passed; final compressed upload is about
  1.29 MiB including the WebAssembly module. No upload/deployment occurred.
- Password hashing/checking succeeded with dummy values only. The measured
  local render times of roughly 2.8–4.2 seconds and scrypt test time of 105 ms
  are wall times, not measurements of Cloudflare production CPU billing.

## Remaining after this trial

1. Deploy the trial to the user's free Cloudflare account and inspect actual
   runtime/CPU/memory failures and cold starts.
2. Implement and verify the full backend, session handling, database access,
   webhooks, reliable background processing, print persistence and authenticated
   administration. None of those services is migrated by this print trial.
3. Define a separate renderer/version identity before persisting production
   print files, so old files remain immutable and no renderer switch reuses an
   old production cache key.
4. Verify free-tier resource budgets for the complete shop, revise hosting
   disclosures/contracts as needed, and test complete purchases before moving
   the domain. Existing sales blockers remain in force.

## Sources checked 15 November 2026

- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/ci-cd/builds/
- https://sharp.pixelplumbing.com/install/
- https://github.com/thx/resvg-js
