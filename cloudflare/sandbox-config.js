import { migrationConfig } from './migration-config.js';

export const SANDBOX_ORIGIN = 'https://archenlicht-checkout-test.jonas-herliz2910.workers.dev';

// A separate acceptance deployment; neither the production shop nor the fully
// simulated migration preview can be switched to these provider settings.
export function sandboxConfig(env) {
  if (!/^cf_preview_sandbox_[a-z0-9_]{1,24}$/.test(env.DATABASE_SCHEMA || '')) throw new Error('An isolated acceptance schema is required.');
  if (!/^(sk|rk)_test_[A-Za-z0-9_]+$/.test(env.STRIPE_SECRET_KEY || '') || !/^whsec_[A-Za-z0-9_]+$/.test(env.STRIPE_WEBHOOK_SECRET || '')) throw new Error('Only Stripe sandbox credentials are accepted.');
  if (env.PODBASE_API_KEY || env.PODBASE_SUBMISSION_ENABLED === 'true') throw new Error('Actual production is forbidden in acceptance testing.');
  if (!['false', 'true', undefined].includes(env.SANDBOX_MAIL_ENABLED)) throw new Error('Invalid acceptance mail switch.');
  return {
    ...migrationConfig(env, SANDBOX_ORIGIN),
    existingStoreOnly: true,
    paymentMode: 'sandbox', stripeKey: env.STRIPE_SECRET_KEY, stripeWebhook: env.STRIPE_WEBHOOK_SECRET,
    mailMode: env.SANDBOX_MAIL_ENABLED === 'true' ? 'resend-test' : 'local',
    mailPublicUrl: SANDBOX_ORIGIN, mailTestRecipients: ['info@archenlicht.de'],
    resendKey: env.RESEND_API_KEY, resendWebhook: env.RESEND_WEBHOOK_SECRET,
    mailEnabledSince: env.MAIL_ENABLED_SINCE
  };
}
