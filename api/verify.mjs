// 处理 Creem 支付成功回跳：
//   Creem 会在 success_url 后附加 ?checkout_id=...&signature=...
// 最稳妥的履约依据 = 服务端主动用 checkout_id 去 Creem 查询订单真实状态，
// 而不是信任可被伪造的回跳签名。Creem 一次性结账支付成功后的状态是 'completed'
// （个别来源/旧版可能返回 'paid'），查到这两种状态之一才签发 HMAC 签名 token。
// 前端把 token 存 localStorage，之后每次生成由 /api/unlock 校验 token 防伪。
// 零数据库、无状态。
import crypto from 'crypto';

export function signToken(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export default async function handler(req, res) {
  const apiKey = process.env.CREEM_API_KEY;
  const apiBase = (process.env.CREEM_API_BASE || 'https://api.creem.io').replace(/\/$/, '');
  const secret = process.env.UNLOCK_SECRET || apiKey;
  const url = new URL(req.url, 'http://localhost');
  const p = Object.fromEntries(url.searchParams.entries());

  if (!apiKey) return res.status(500).json({ ok: false, error: '未配置 CREEM_API_KEY' });

  const checkoutId = p.checkout_id || p.checkoutId;
  if (!checkoutId) return res.status(400).json({ ok: false, error: '缺少 checkout_id 回跳参数' });

  // 主动查询 Creem 订单状态（以服务端查询结果为准）
  try {
    let data = null, lastHttp = null;
    const candidateUrls = [
      `${apiBase}/v1/checkouts/${encodeURIComponent(checkoutId)}`,
      `${apiBase}/v1/checkouts?checkout_id=${encodeURIComponent(checkoutId)}`,
      `${apiBase}/v1/checkouts?id=${encodeURIComponent(checkoutId)}`
    ];
    for (const u of candidateUrls) {
      try {
        const r = await fetch(u, { headers: { 'x-api-key': apiKey } });
        lastHttp = r.status;
        if (r.ok) { data = await r.json(); break; }
      } catch (_) { /* try next */ }
    }
    if (!data) return res.status(502).json({ ok: false, error: '查询 Creem 订单失败', http: lastHttp });

    if (Array.isArray(data)) data = data[0];
    else if (data && Array.isArray(data.items) && data.items.length) data = data.items[0];

    const paid = ['paid', 'completed'].includes(data.status);
    if (!paid) {
      return res.status(402).json({ ok: false, error: '订单尚未支付', status: data.status || 'unknown' });
    }

    const token = signToken(
      {
        checkout_id: checkoutId,
        order_id: (data.order && data.order.id) || '',
        customer_id: (data.customer && data.customer.id) || '',
        product_id: (data.product && data.product.id) || '',
        iat: Date.now(),
        exp: Date.now() + 1000 * 60 * 60 * 24 * 365
      },
      secret
    );

    return res.status(200).json({ ok: true, token });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
