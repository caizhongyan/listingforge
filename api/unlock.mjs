// 校验前端留存的签名 token 是否有效（无状态，靠 HMAC 密钥识别伪造）。
import crypto from 'crypto';

export default async function handler(req, res) {
  const secret = process.env.UNLOCK_SECRET || process.env.CREEM_API_KEY;
  let body = {};
  try { body = await req.json(); } catch {}

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
