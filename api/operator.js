import { db, endpoint, requireAdmin, steps } from '../lib/store.js';

export default endpoint(async (req, res) => {
  requireAdmin(req);
  if (req.method === 'GET') return res.json({ requests: await db('list'), steps });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use GET or POST.' });
  const { id, expectedStep, decision, notes, evidence = {} } = req.body || {};
  const record = await db('get', { id });
  if (expectedStep !== record.step) return res.status(409).json({ error: 'Refresh this request before completing a task.' });
  if (typeof notes !== 'string' || notes.length < 3 || notes.length > 2000) return res.status(400).json({ error: 'Record completion evidence or a review decision.' });
  const required = [[], ['tenantId','domainReference'], ['oktaIssuer','oktaClientId','oktaAdminUserId'], ['accessTestReference'], ['notificationReference'], ['activationReference']][record.step];
  if (!required) return res.status(409).json({ error: 'This request is already finished.' });
  if (required.some(key => typeof evidence[key] !== 'string' || !evidence[key].trim() || evidence[key].length > 500)) {
    return res.status(400).json({ error: 'Complete every evidence field for this task.' });
  }
  if (record.step === 2 && !/^https:\/\/[^/]+(?:\/oauth2\/[^/]+)?\/?$/.test(evidence.oktaIssuer)) return res.status(400).json({ error: 'Enter the HTTPS Okta issuer URL.' });
  // Whitelist evidence. Never accept provider passwords, tokens or client secrets.
  const safeEvidence = Object.fromEntries(required.map(key => [key,evidence[key].trim()]));
  const result = await db('complete', { id, expectedStep, decision, notes, evidence: safeEvidence });
  res.json(result);
});
