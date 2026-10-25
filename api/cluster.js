// Vercel 서버리스 함수: POST /api/cluster
const { cluster } = require('../_gemini.js');
module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST만 받아요.' }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const [code, data] = await cluster(body || {}, process.env);
  res.status(code).json(data);
};
