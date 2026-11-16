import { OPERATOR } from '../public/legal-content.js';

export const SHOP_ORIGIN = 'https://www.archenlicht.de';
export function productionConfig(env) {
  for (const name of ['DATABASE_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'PODBASE_API_KEY', 'PODBASE_STORE_ID', 'RESEND_API_KEY', 'RESEND_WEBHOOK_SECRET', 'MAIL_ENABLED_SINCE', 'CRON_SECRET']) {
    if (!env[name] || env[name].includes('[SENSITIVE]')) throw new Error('Missing production setting: ' + name);
  }
  if (env.DATABASE_SCHEMA !== 'public') throw new Error('Production requires the existing public schema.');
  if (!/^postgres(?:ql)?:\/\//.test(env.DATABASE_URL)) throw new Error('Invalid database configuration.');
  if (env.CRON_SECRET.length < 32) throw new Error('Job secret is too short.');
  for (const name of ['CHECKOUT_ENABLED', 'PODBASE_SUBMISSION_ENABLED', 'OPENING_OFFER_ENABLED']) {
    if (env[name] !== undefined && !['true', 'false'].includes(env[name])) throw new Error('Invalid switch: ' + name);
  }
  return {
    baseUrl: SHOP_ORIGIN, printBaseUrl: SHOP_ORIGIN, mailPublicUrl: SHOP_ORIGIN,
    platformOrigins: ['https://archenlicht.de'],
    shopMode: 'live', paymentMode: 'live', podbaseMode: 'production', printMode: 'podbase',
    mailMode: 'resend', newsletterMode: 'resend',
    checkoutEnabled: env.CHECKOUT_ENABLED === 'true', podbaseSubmissionEnabled: env.PODBASE_SUBMISSION_ENABLED === 'true',
    openingOfferEnabled: env.OPENING_OFFER_ENABLED !== 'false', legalContactReady: Boolean(OPERATOR.phone),
    storageMode: 'postgres', databaseUrl: env.DATABASE_URL, databaseSchema: 'public',
    existingStoreOnly: true, adminEmail: 'info@archenlicht.de',
    stripeKey: env.STRIPE_SECRET_KEY, stripeWebhook: env.STRIPE_WEBHOOK_SECRET,
    stripePaymentConfiguration: env.STRIPE_PAYMENT_CONFIGURATION,
    podbaseKey: env.PODBASE_API_KEY, podbaseStoreId: env.PODBASE_STORE_ID,
    podbaseBaseUrl: 'https://open-api.podbase.com',
    resendKey: env.RESEND_API_KEY, resendWebhook: env.RESEND_WEBHOOK_SECRET,
    mailEnabledSince: env.MAIL_ENABLED_SINCE, mailTestRecipients: [],
    dataDir: '/tmp/archenlicht', publicDir: '/bundle/public',
    sessionHours: 2, serverless: true, autoShip: false,
    printRenderer: 'resvg-wasm-2.6.2-srgb300-v1', printLayoutCacheSize: 2,
    workerSecret: env.CRON_SECRET
  };
}
