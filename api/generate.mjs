// ListingForge · 生成接口（质量核心）
// 模型抽象层：默认 openai，可切 claude / deepseek（env: LLM_PROVIDER）
const LANG_NAME = { en: 'English', de: 'German', ja: 'Japanese', fr: 'French', es: 'Spanish' };

const PLATFORM_RULES = {
  amazon: `Amazon 规则：标题≤200字符，前置核心关键词与关键属性（品牌/型号/数量/核心功能），禁用虚假评价、禁用"#1""最佳"等绝对化违禁词，不写促销语。`,
  shopify: `Shopify 规则：偏 SEO 长尾关键词，自然嵌入搜索词，语气可稍活泼但仍专业，描述利于自然搜索收录。`,
  standalone: `独立站规则：偏品牌故事与调性，强调差异化价值与用户场景，可读性强。`
};

function buildMessages(info, platform, lang) {
  const langName = LANG_NAME[lang] || 'English';
  const sys = `你是一名资深的跨境电商${langName}文案写手，服务于在 ${platform.toUpperCase()} 销售的中国卖家。
${PLATFORM_RULES[platform] || PLATFORM_RULES.standalone}
要求：
- 全部内容用 ${langName} 原生表达，地道、无翻译腔。
- 合规底线：禁止医疗宣称、禁止虚假评价、禁止绝对化违禁词（如 guaranteed/#1/best 若平台禁用）。
- 严格只输出如下 JSON，不要任何解释或 markdown 代码块：
{"title":"","bullets":["","","","",""],"description":"","keywords":["","",...10个]}。
- title 为商品标题；bullets 为 5 条卖点；description 为 2-3 句商品描述；keywords 为 10 个对应语言的 SEO 关键词。`;
  const user = `产品信息：${info}\n请按上述规则生成。`;
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
  const model = provider === 'deepseek' ? (process.env.DEEPSEEK_MODEL || 'deepseek-chat') : (process.env.OPENAI_MODEL || 'gpt-4o');
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'authorization': 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, response_format: { type: 'json_object' }, temperature: 0.7 })
  });
  if (!r.ok) throw new Error(provider + ':' + (await r.text()).slice(0, 200));
  const j = await r.json();
  return j.choices[0].message.content;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  let body;
  try { body = await req.json(); } catch (e) { return res.status(400).json({ error: 'bad request' }); }
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
    return res.status(500).json({ error: '生成失败，请稍后重试' });
  }
}
