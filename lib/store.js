import { createHash, timingSafeEqual } from 'node:crypto';

export const hash = value => createHash('sha256').update(value).digest('hex');
export const steps = [
  'Review organisation and administrator',
  'Provision customer subdomain and tenant entries',
  'Configure Okta application and workspace administrator',
  'Verify customer sign-in and workspace permissions',
  'Send onboarding notification',
  'Activate customer workspace'
];

export async function db(operation, data = {}) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/entailink_onboarding_rpc`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.ONBOARDING_DB_SECRET, operation, data })
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.code === '23505' ? 'That workspace name is already reserved.' : body.message || 'Storage is unavailable.');
    error.status = body.code === '23505' ? 409 : body.code === '42501' ? 403 : 400;
    throw error;
  }
  return body;
}

export function requireAdmin(req) {
  const actual = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from(`Bearer ${process.env.ONBOARDING_ADMIN_TOKEN || ''}`);
  if (!process.env.ONBOARDING_ADMIN_TOKEN || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    const error = new Error('Enter a valid operator access key.');
    error.status = 401;
    throw error;
  }
}

export function endpoint(handler) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (req.method !== 'GET') {
        const origin = req.headers.origin;
        const host = req.headers.host;
        if (origin && new URL(origin).host !== host) return res.status(403).json({ error: 'Cross-origin request denied.' });
      }
      if (!process.env.ONBOARDING_DB_SECRET) return res.status(503).json({ error: 'Registration storage is being configured.' });
      await handler(req, res);
    } catch (error) {
      console.error('Onboarding request failed', error.name);
      res.status(error.status || 502).json({ error: error.status ? error.message : 'The service is temporarily unavailable. Please retry.' });
    }
  };
}
