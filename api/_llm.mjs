// 共用的模型调用层（generate / translate 共用）
// 支持 openai / deepseek / claude，由 env LLM_PROVIDER 决定
export function providerInfo() {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  if (provider === 'deepseek') {
    return {
      provider,
      url: 'https://api.deepseek.com/v1/chat/completions',
      key: process.env.DEEPSEEK_API_KEY,
      // 关键取舍（2026-10-31 实测）：DeepSeek 该账号可用模型仅 deepseek-flash / deepseek-v4-pro。
      // 两者都是推理型模型，耗时实测：v4-pro 约 22–37s；flash 约 11s。
      // Vercel 的 Serverless Function 默认上限仅 10s（本项目已配 maxDuration: 60）。
      // 注意：切勿设置较小的 max_tokens——推理型模型的思维链与正文共用 token 预算，
      // 实测 max_tokens:1600 会把 JSON 输出截断，导致解析失败、接口全线 500。
      model: process.env.DEEPSEEK_MODEL || 'deepseek-flash'
    };
  }
  return {
    provider,
    url: 'https://api.openai.com/v1/chat/completions',
    key: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o'
  };
}

export async function callLLM(messages, { temperature = 0.7, json = true } = {}) {
  const { provider, url, key, model } = providerInfo();

  if (provider === 'claude') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 1600,
        system: messages[0].content,
        messages: [{ role: 'user', content: messages[1].content }]
      })
    });
    if (!r.ok) throw new Error('claude:' + (await r.text()).slice(0, 200));
    const j = await r.json();
    return j.content[0].text;
  }

  const payload = { model, messages, temperature };
  if (json) payload.response_format = { type: 'json_object' };

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'authorization': 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(provider + ':' + (await r.text()).slice(0, 200));
  const j = await r.json();
  return j.choices[0].message.content;
}

// 读取请求体：兼容各种运行时形态。
// 2026-10-31 上线实测踩坑：Vercel Node 运行时会先把 JSON 体自动解析到 req.body，
// 且 **不存在 req.json() 方法**。原写法 `await req.json()` 必然抛错并落到 catch，
// 表现为「线上点生成一律报 bad request」。此处做三重兜底，彻底免疫。
export async function readJson(req) {
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
