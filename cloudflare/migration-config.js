export function migrationConfig(env, baseUrl) {
  if (!env.DATABASE_URL || !env.ADMIN_PASSWORD || !env.MIGRATION_ACCESS_PASSWORD) throw new Error('Missing protected migration configuration.');
  if (!/^cf_preview_[a-z0-9_]{1,40}$/.test(env.DATABASE_SCHEMA || '')) throw new Error('An isolated migration schema is required.');
  if (env.MIGRATION_ACCESS_PASSWORD.length < 24) throw new Error('Migration access password is too short.');
  return {
    baseUrl, printBaseUrl: baseUrl, platformOrigins: [],
    shopMode: 'test', isolatedPreview: true, paymentMode: 'local', podbaseMode: 'local',
    mailMode: 'local', newsletterMode: 'local', printMode: 'podbase',
    checkoutEnabled: true, podbaseSubmissionEnabled: false, autoShip: false,
    storageMode: 'postgres', databaseUrl: env.DATABASE_URL, databaseSchema: env.DATABASE_SCHEMA,
    adminEmail: 'migration@archenlicht.test', adminPassword: env.ADMIN_PASSWORD,
    dataDir: '/tmp/archenlicht-migration', publicDir: '/bundle/public',
    sessionHours: 2, serverless: true, legalContactReady: true,
    printRenderer: 'resvg-wasm-2.6.2-srgb300-v1', printLayoutCacheSize: 2,
    workerSecret: env.MIGRATION_JOB_SECRET
  };
}
