// 埋点日志：写 Vercel Runtime Logs（供上线后排查 bug）
// 2026-10-31 修正：原先误用了 Next.js App Router 写法（import { NextResponse } from 'next/server'
// 与 Web Request/Response API）。本项目是纯 Node Serverless（Framework=Other，无 next 依赖），
// 该写法在线上会因找不到 'next/server' 模块而整体失败，导致埋点全部丢失
// ——等于上线后处于「看不见 bug」的盲飞状态。改为标准 Node 处理函数。
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(204).end();

  try {
    const body = await readJson(req);
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || '-';
    const ua = req.headers['user-agent'] || '-';
    console.log('[lf-event]', JSON.stringify({
      event: body.event, data: body.data, ip, ua, t: Date.now()
    }));
  } catch (e) {
    console.log('[lf-event-parse-error]', String(e && e.message || e));
  }
  return res.status(204).end();
}
