import { db, endpoint, hash, steps } from '../lib/store.js';
export default endpoint(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  const { id, trackingKey } = req.body || {};
  if (typeof id !== 'string' || typeof trackingKey !== 'string') return res.status(400).json({ error: 'Provide your request reference and tracking key.' });
  const result = await db('status', { id, tokenHash: hash(trackingKey) });
  res.json({ ...result, steps });
});
