// 自助找回：客户换设备/清缓存后，凭「付款邮箱」重新签发解锁码
//
// 2026-11-01 实测结论（决定了这里为何用邮箱而不是订单号）：
//   Creem 公开 API v1 的实际形态是
//     GET /v1/checkouts    → 只接受 checkout_id（收据上的 ORD-xxx 不是它，查不到）
//     GET /v1/orders       → 该端点不存在（404）
//     GET /v1/transactions → 只接受 transaction_id，无列表
//     GET /v1/customers    → 接受 customer_id 或 email ✅
//   因此订单号无法验证；邮箱是客户能自助提供、且服务端能核验的唯一凭据。
//
// 安全要点：
//   1) Creem API Key 只在服务端使用，不下发前端
//   2) 该 Creem 账号当前只有本产品一个（$5.99 一次性），因此「是本账号客户」等价于「购买过本产品」
//      ⚠️ 一旦上线第二个产品，此假设失效，必须改为 webhook 落库后按订单核验
//   3) 按 IP 限流，挡批量试探邮箱
import { readJson } from './_llm.mjs';
import { signToken } from './verify.mjs';
import crypto from 'crypto';

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
  const secret = process.env.UNLOCK_SECRET || apiKey;
  if (!apiKey) return res.status(500).json({ error: '未配置 CREEM_API_KEY' });

  const body = await readJson(req);

  // 2026-11-01 关闭：同一 Creem 账号下存在多个产品（不同域名），
  // 「是本账号客户」不能证明「购买的是本产品」，会被其他产品的买家白拿解锁。
  // 仅在账号确认只有单一产品时才可临时开启：Vercel 环境变量 ALLOW_EMAIL_RECOVERY=true
  if (String(process.env.ALLOW_EMAIL_RECOVERY || '').toLowerCase() !== 'true') {
    return res.status(403).json({ error: '该功能暂未开放，请使用解锁码恢复，或联系 support@skuwrite.com' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: '尝试过于频繁，请 10 分钟后再试' });

  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: '请填写购买时使用的邮箱' });
  }

  let data = null;
  let httpStatus = null;
  try {
    const r = await fetch(`${apiBase}/v1/customers?email=${encodeURIComponent(email)}`, {
      headers: { 'x-api-key': apiKey }
    });
    httpStatus = r.status;
    if (r.ok) {
      const j = await r.json();
      data = Array.isArray(j) ? j[0] : (Array.isArray(j.items) ? j.items[0] : j);
    }
  } catch (e) {
    return res.status(502).json({ error: '查询失败，请稍后重试' });
  }

  const customerId = data && (data.id || data.customer_id);
  if (!customerId) {
    return res.status(404).json({
      error: '未找到该邮箱的购买记录。请使用下单时填写的邮箱；仍有问题请联系 support@skuwrite.com',
      ...(body.debug === true ? { httpStatus } : {})
    });
  }

  // 邮箱指纹入库留痕（不可逆），便于日后排查滥用
  const fingerprint = crypto.createHash('sha256').update(email).digest('hex').slice(0, 12);
  console.log('[redeem] recovered by email fp=' + fingerprint + ' customer=' + customerId);

  const token = signToken(
    {
      customer_id: customerId,
      recovered: true,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 365 * 100
    },
    secret
  );

  return res.status(200).json({ ok: true, token, ...(body.debug === true ? { httpStatus, customer_id: customerId } : {}) });
}
