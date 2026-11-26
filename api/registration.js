import { db, endpoint, hash } from '../lib/store.js';

export default endpoint(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (!data || JSON.stringify(data).length > 6000) return res.status(400).json({ error: 'Invalid registration.' });
  const fields = ['organisation', 'adminName', 'email', 'slug', 'role', 'erp'];
  if (fields.some(field => typeof data[field] !== 'string' || !data[field].trim() || data[field].length > 160)) {
    return res.status(400).json({ error: 'Complete all registration fields.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || !/^[a-z][a-z0-9-]{2,39}$/.test(data.slug) || !data.consent || data.website) {
    return res.status(400).json({ error: 'Check the email, workspace name and consent.' });
  }
  if (!['BUYER','SUPPLIER','SSO'].includes(data.role) || !['ERPNEXT','ODOO','ZOHO','OTHER','NONE'].includes(data.erp)) return res.status(400).json({ error: 'Invalid role or ERP.' });
  if (!/^[0-9a-f-]{36}$/.test(data.id || '') || !/^[0-9a-f]{64}$/.test(data.trackingKey || '')) return res.status(400).json({ error: 'Refresh the page and retry.' });
  const result = await db('register', {
    ...Object.fromEntries(fields.map(field => [field, data[field].trim()])),
    id: data.id, tokenHash: hash(data.trackingKey),
    ipHash: hash(req.headers['x-forwarded-for']?.split(',')[0].trim() || 'unknown')
  });
  res.status(201).json(result);
});
