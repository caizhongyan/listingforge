// 临时诊断接口：仅探测 Creem API 端点是否存在、返回结构长什么样。
// 只回状态码与字段名（不含任何字段值/客户数据），排查完成后即删除。
export default async function handler(req, res) {
  const apiKey = process.env.CREEM_API_KEY;
  const apiBase = (process.env.CREEM_API_BASE || 'https://api.creem.io').replace(/\/$/, '');
  if (!apiKey) return res.status(500).json({ error: 'no key' });

  const paths = [
    '/v1/transactions',
    '/v1/transactions?page_size=1',
    '/v1/transactions?page=1',
    '/v1/checkouts',
    '/v1/customers'
  ];

  const out = [];
  for (const p of paths) {
    try {
      const r = await fetch(apiBase + p, { headers: { 'x-api-key': apiKey } });
      let shape = null;
      try {
        const j = await r.json();
        if (Array.isArray(j)) shape = { array: j.length, keys: j[0] ? Object.keys(j[0]) : [] };
        else if (j && typeof j === 'object') shape = { keys: Object.keys(j), msg: j.message || j.error, nested: j.items ? { array: j.items.length, keys: j.items[0] ? Object.keys(j.items[0]) : [] } : undefined };
      } catch (e) { shape = { parse: 'fail' }; }
      out.push({ path: p, status: r.status, shape });
    } catch (e) {
      out.push({ path: p, error: String(e).slice(0, 80) });
    }
  }
  return res.status(200).json({ apiBase, results: out });
}
