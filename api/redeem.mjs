// 订单号自助找回：客户换设备/清缓存后，凭 Creem 订单号重新签发解锁码
// 安全要点：
//   1) 校验只在服务端做——Creem API Key 不下发前端
//   2) 必须同时满足：订单可查到 + 状态为 paid/completed + 商品 ID 属于本产品
//   3) 按 IP 做轻量频率限制，挡批量试探订单号
import { readJson } from './_llm.mjs';
import { signToken } from './verify.mjs';

// 轻量限流：仅在单个函数实例内有效，足够挡住脚本级试探（无状态，不引数据库）
const hits = new Map();
const WINDOW = 10 * 60 * 1000;
const MAX_HITS = 5;
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < WINDOW);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > MAX_HITS;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const apiKey = process.env.CREEM_API_KEY;
  const apiBase = (process.env.CREEM_API_BASE || 'https://api.creem.io').replace(/\/$/, '');
  const productId = process.env.CREEM_PRODUCT_ID;
  const secret = process.env.UNLOCK_SECRET || apiKey;
  if (!apiKey) return res.status(500).json({ error: '未配置 CREEM_API_KEY' });

  const body = await readJson(req);
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: '尝试过于频繁，请 10 分钟后再试' });

  const orderId = String(body.order_id || body.orderId || '').trim().replace(/^["'\s]+|["'\s]+$/g, '');
  if (!/^[A-Za-z0-9_\-]{6,64}$/.test(orderId)) {
    return res.status(400).json({ error: '订单号格式不正确，请从 Creem 付款收据邮件中完整复制' });
  }

  // Creem 的订单查询端点存在多种可能形态，逐个探测（与 verify.mjs 同思路）
  const candidates = [
    `${apiBase}/v1/orders/${encodeURIComponent(orderId)}`,
    `${apiBase}/v1/orders?order_id=${encodeURIComponent(orderId)}`,
    `${apiBase}/v1/orders?id=${encodeURIComponent(orderId)}`
  ];

  const probeLog = [];
  let data = null;
  for (const u of candidates) {
    try {
      const r = await fetch(u, { headers: { 'x-api-key': apiKey } });
      probeLog.push(`${u.replace(apiBase, '')} → ${r.status}`);
      if (r.ok) {
        const j = await r.json();
        const item = Array.isArray(j) ? j[0] : (Array.isArray(j.items) ? j.items[0] : j);
        if (item && (item.status || item.order)) { data = item; break; }
      }
    } catch (e) { probeLog.push(`${u.replace(apiBase, '')} → err`); }
  }

  if (!data) {
    return res.status(404).json({
      error: '未查到该订单，请核对订单号；如确认已付款请联系 support@skuwrite.com',
      ...(body.debug === true ? { probes: probeLog } : {})
    });
  }

  const status = String(data.status || '').toLowerCase();
  if (!['paid', 'completed'].includes(status)) {
    return res.status(402).json({ error: '该订单尚未完成支付', status, ...(body.debug === true ? { probes: probeLog } : {}) });
  }

  // 商品归属校验：避免拿别的产品订单来解锁
  const pid = (data.product && (data.product.id || data.product_id)) || data.product_id || '';
  if (productId && pid && pid !== productId) {
    return res.status(403).json({ error: '该订单不属于本产品', ...(body.debug === true ? { probes: probeLog } : {}) });
  }

  const token = signToken(
    {
      order_id: orderId,
      recovered: true,
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 365
    },
    secret
  );

  return res.status(200).json({ ok: true, token, ...(body.debug === true ? { probes: probeLog, status } : {}) });
}
