// 校验前端留存的签名 token 是否有效（无状态，靠 HMAC 密钥识别伪造）。
import crypto from 'crypto';

// 与 generate.mjs 同样的三重兜底：Vercel Node 运行时没有 req.json()，只有 req.body。
async function readJson(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object') return req.body;
    try { return JSON.parse(req.body); } catch (e) { /* 继续兜底 */ }
  }
  if (typeof req.json === 'function') {
    try { return await req.json(); } catch (e) { /* 继续兜底 */ }
  }
  try {
    const chunks = [];
    for await (const c of req) chunks.push(Buffer.from(c));
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

export default async function handler(req, res) {
  const secret = process.env.UNLOCK_SECRET || process.env.CREEM_API_KEY;
  const body = await readJson(req);

  const token = body.token;
  if (!token || !token.includes('.')) return res.status(200).json({ valid: false });

  const [b, s] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(b).digest('base64url');
  if (expected !== s) return res.status(200).json({ valid: false });

  let payload;
  try { payload = JSON.parse(Buffer.from(b, 'base64url').toString()); }
  catch { return res.status(200).json({ valid: false }); }

  if (payload.exp && Date.now() > payload.exp) return res.status(200).json({ valid: false });

  return res.status(200).json({ valid: true, order_id: payload.order_id });
}
