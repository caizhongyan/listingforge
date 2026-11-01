// 中文对照翻译接口：把已生成的英文 Listing 逐条译成简体中文，仅供卖家核对阅读
// 设计要点：与生成解耦，生成后异步补，不拖慢主流程
import { callLLM, readJson } from './_llm.mjs';
import crypto from 'crypto';

// 仅付费用户可用：校验解锁 token（与 unlock.mjs 同一套 HMAC 方案）
function tokenValid(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const secret = process.env.UNLOCK_SECRET || process.env.CREEM_API_KEY;
  const [b, s] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(b).digest('base64url');
  if (expected !== s) return false;
  try {
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return false;
  } catch (e) { return false; }
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const body = await readJson(req);
  if (!tokenValid(body.token)) return res.status(403).json({ error: 'unlock required' });
  const texts = Array.isArray(body.texts) ? body.texts.filter(t => typeof t === 'string' && t.trim()) : [];
  if (!texts.length || texts.length > 10) return res.status(400).json({ error: '参数错误' });

  const list = texts.map((t, i) => `${i + 1}. ${String(t).slice(0, 1500)}`).join('\n');
  const messages = [
    {
      role: 'system',
      content: `你是跨境电商文案的翻译审校，负责把英文 Listing 内容译成简体中文，供中国卖家核对。

要求：
- 忠于原意，直译优先，不增删卖点、不添加原文没有的承诺或参数。
- 术语用行业通行译法（如 dishwasher safe → 可洗碗机清洗；listing → Listing）。
- 保留原文的品牌、型号、尺寸单位（in / oz / cm 等）不换算。
- 每条对应一行，用自然口语化的中文，不要翻译腔，不要加解释或备注。
- 严格只输出 JSON：{"zh":["第1条译文","第2条译文",...]}，条数与原文完全一致。`
    },
    { role: 'user', content: list }
  ];

  try {
    const raw = await callLLM(messages, { temperature: 0.3 });
    const json = JSON.parse(String(raw).replace(/```json|```/g, '').trim());
    let zh = Array.isArray(json.zh) ? json.zh : [];
    // 条数不齐时按空串补齐，保证前端索引对齐
    if (zh.length < texts.length) zh = zh.concat(new Array(texts.length - zh.length).fill(''));
    return res.status(200).json({ zh: zh.slice(0, texts.length).map(s => String(s || '')) });
  } catch (e) {
    console.error('[translate] error:', e.message);
    if (body && body.debug === true) return res.status(500).json({ error: 'translation failed', detail: String(e.message).slice(0, 300) });
    return res.status(500).json({ error: 'translation failed' });
  }
}
