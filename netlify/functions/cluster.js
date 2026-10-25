// Netlify 함수: POST /api/cluster (netlify.toml에서 주소를 연결해요)
const { cluster } = require('../../_gemini.js');
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'POST만 받아요.' }) };
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {}
  const [code, data] = await cluster(body, process.env);
  return { statusCode: code, headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(data) };
};
