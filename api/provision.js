import { db, endpoint, requireAdmin } from '../lib/store.js';

export default endpoint(async (req, res) => {
  requireAdmin(req);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  const record = await db('get', { id: req.body?.id });
  if (record.step !== 1) return res.status(409).json({ error: 'Domain provisioning is available after review approval.' });
  if (!process.env.PROVISIONING_VERCEL_TOKEN || !process.env.CUSTOMER_PORTAL_PROJECT_ID) {
    return res.status(503).json({ error: 'Automatic domain creation awaits a Vercel provisioning token and the tenant-aware customer portal project. Complete the domain task manually and record its reference.' });
  }
  const domain = `${record.slug}.zapplink.com`;
  const base = `https://api.vercel.com/v10/projects/${encodeURIComponent(process.env.CUSTOMER_PORTAL_PROJECT_ID)}/domains`;
  const query = process.env.PROVISIONING_VERCEL_TEAM_ID ? `?teamId=${encodeURIComponent(process.env.PROVISIONING_VERCEL_TEAM_ID)}` : '';
  const headers = { Authorization: `Bearer ${process.env.PROVISIONING_VERCEL_TOKEN}`, 'Content-Type': 'application/json' };
  let response = await fetch(`${base}/${domain}${query}`, { headers, signal: AbortSignal.timeout(10000) });
  if (response.status === 404) response = await fetch(`${base}${query}`, { method:'POST',headers,body:JSON.stringify({name:domain}),signal:AbortSignal.timeout(10000) });
  if (!response.ok) return res.status(502).json({ error: 'Vercel could not provision the customer domain. Check the project, token and DNS settings.' });
  const result = await response.json();
  res.json({ domain, verified: result.verified, verification: result.verification || [], message: 'Domain entry exists. Verify DNS, HTTPS and the application tenant entry before completing this task.' });
});
