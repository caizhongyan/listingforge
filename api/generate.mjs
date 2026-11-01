// ListingForge · 生成接口（质量核心）
// 模型抽象层：默认 openai，可切 claude / deepseek（env: LLM_PROVIDER）
const LANG_NAME = { en: 'English', de: 'German', ja: 'Japanese', fr: 'French', es: 'Spanish' };

const PLATFORM_RULES = {
  amazon: `Amazon 规则：标题≤200字符，前置核心关键词与关键属性（品牌/型号/数量/核心功能），禁用虚假评价、禁用"#1""最佳"等绝对化违禁词，不写促销语，不用感叹号。`,
  shopify: `Shopify 规则：偏 SEO 长尾关键词，自然嵌入搜索词，语气可稍活泼但仍专业，描述利于自然搜索收录。`,
  standalone: `独立站规则：偏品牌故事与调性，强调差异化价值与用户场景，可读性强。`
};

function buildMessages(info, platform, lang) {
  const langName = LANG_NAME[lang] || 'English';
  const sys = `你是一名资深跨境电商文案专家，专精 ${platform.toUpperCase()} 平台的 ${langName} 原生 Listing 撰写，服务中国卖家，所写 Listing 长期位居类目头部。

${PLATFORM_RULES[platform] || PLATFORM_RULES.standalone}

写作要求：
1. 标题：150-200 字符（硬上限 200），前 80 字符必须出现最核心的搜索词；结构为「核心搜索词 + 关键属性（材质/规格/数量/核心功能）+ 主要使用场景 + 目标人群」；不堆砌同义关键词，不加促销语，不用感叹号，除品牌与型号外不用全大写。
2. 卖点：恰好 5 条，每条 100-150 字符；每条以 2-4 个单词的全大写钩子开头（例：LIGHTWEIGHT & PACKABLE），随后写「用户利益 + 支撑特征」；分工固定——第 1 条放最打动人的核心价值，第 2、3 条讲材质、规格与工艺，第 4 条讲真实使用场景，第 5 条讲保养、售后或送礼场景；各条之间不得重复同一个关键词。
3. 描述：70-100 个单词，2-3 段；段落顺序为「使用场景与痛点 → 材质工艺与细节 → 保养方式/送礼/售后」；不要复述标题，不要空话套话。
4. 关键词：10 个逗号分隔的短语，覆盖「头部大词 + 长尾词 + 使用场景词 + 材质工艺词」，不得与标题中已出现的词组完全重复，不写竞品品牌名，不写只差单复数的重复项。
5. 语言：${langName} 原生表达，地道、无翻译腔，用具体可感的细节替代形容词堆砌；避免 elevate、unleash、game-changer、must-have、perfect for everyone 这类空泛 AI 套话。
6. 事实纪律（最高优先级）：只能使用用户提供的产品信息。尺寸、容量、重量、材质等级、认证（dishwasher safe / microwave safe / lead-free / food-grade / FDA 等）、件数、保修，凡用户未提供的一律不得编造，也不得用 high quality / premium 之类的空词替代具体参数；缺失时用不含数字与承诺的通用表述。用户未提供品牌时，绝不虚构品牌名，标题直接从核心品类词写起。

合规底线：禁止医疗宣称、禁止虚假评价与功效承诺、禁止平台违禁的绝对化用语。

严格只输出如下 JSON，不要任何解释、不要 markdown 代码块：
{"title":"","bullets":["","","","",""],"description":"","keywords":[""...10个]}。
title 为商品标题；bullets 为 5 条卖点；description 为商品描述；keywords 为 10 个对应语言的 SEO 关键词。`;
  const user = `产品信息：${info}\n\n请按上述规则撰写完整 Listing。注意：产品信息里没有提供的规格参数（尺寸、容量、认证等）不要编造。`;
  return [
    { role: 'system', content: sys },
    { role: 'user', content: user }
  ];
}

async function callLLM(messages) {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();

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
        max_tokens: 1200,
        system: messages[0].content,
        messages: [{ role: 'user', content: messages[1].content }]
      })
    });
    if (!r.ok) throw new Error('claude:' + (await r.text()).slice(0, 200));
    const j = await r.json();
    return j.content[0].text;
  }

  // OpenAI / DeepSeek 均兼容 chat/completions
  const url = provider === 'deepseek'
    ? 'https://api.deepseek.com/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const key = provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY;
  // 关键取舍（2026-10-31 实测）：DeepSeek 该账号可用模型仅 deepseek-flash / deepseek-v4-pro。
  // 两者都是推理型模型，耗时实测：v4-pro 约 22–37s；flash 约 11s。
  // Vercel Hobby 的 Serverless Function 默认上限仅 10s，用 v4-pro 会必然超时失败。
  // 因此默认选 flash：速度可接受、成本更低，质量与 pro 接近。
  // 若要追求极致文案质量，可设 DEEPSEEK_MODEL=deepseek-v4-pro，但需配合更长的函数超时（付费计划）。
  const model = provider === 'deepseek' ? (process.env.DEEPSEEK_MODEL || 'deepseek-flash') : (process.env.OPENAI_MODEL || 'gpt-4o');
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'authorization': 'Bearer ' + key, 'content-type': 'application/json' },
    // 注意：DeepSeek 的 flash / v4-pro 均为推理型模型，思维链会占用 token 预算。
    // 切勿设置较小的 max_tokens（实测 1600 会导致输出被截断、JSON 不完整而解析失败），此处不传，用服务端默认值。
    body: JSON.stringify({ model, messages, response_format: { type: 'json_object' }, temperature: 0.7 })
  });
  if (!r.ok) throw new Error(provider + ':' + (await r.text()).slice(0, 200));
  const j = await r.json();
  return j.choices[0].message.content;
}

// 读取请求体：兼容各种运行时形态。
// 2026-10-31 上线实测踩坑：Vercel Node 运行时会先把 JSON 体自动解析到 req.body，
// 且 **不存在 req.json() 方法**。原写法 `await req.json()` 必然抛错并落到 catch，
// 表现为「线上点生成一律报 bad request」，而本地 Node≥18 / 部分框架下却正常，
// 属于典型的「本地能跑线上炸」。此处做三重兜底，彻底免疫。
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const body = await readJson(req);
  const { info, platform = 'amazon', lang = 'en' } = body || {};
  if (!info || info.trim().length < 5) return res.status(400).json({ error: '请填写产品信息' });

  try {
    const raw = await callLLM(buildMessages(info.trim(), platform, lang));
    const json = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (!json.title || !Array.isArray(json.bullets)) throw new Error('malformed');
    return res.status(200).json({
      title: json.title,
      bullets: json.bullets.slice(0, 5),
      description: json.description || '',
      keywords: Array.isArray(json.keywords) ? json.keywords.slice(0, 10) : []
    });
  } catch (e) {
    console.error('[generate] error:', e.message);
    // 调试开关：body 里带 debug:true 时回传真实原因（前端不传，仅供内部排查）
    if (body && body.debug === true) return res.status(500).json({ error: '生成失败，请稍后重试', detail: String(e.message).slice(0, 300) });
    return res.status(500).json({ error: '生成失败，请稍后重试' });
  }
}
