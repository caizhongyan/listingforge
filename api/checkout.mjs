// 创建 Creem 收银台会话，返回 checkout_url 让前端跳转支付
// 环境变量（在 Vercel 后台配置）：
//   CREEM_API_BASE    https://api.creem.io  （测试期用 https://test-api.creem.io）
//   CREEM_API_KEY     Creem 后台的 API Key
//   CREEM_PRODUCT_ID  你在 Creem 创建的 ¥39 一次性产品 ID（prod_xxx）
//   APP_URL           https://listingforge.com

export default async function handler(req, res) {
  const apiBase = process.env.CREEM_API_BASE || 'https://api.creem.io';
  const apiKey = process.env.CREEM_API_KEY;
  const productId = process.env.CREEM_PRODUCT_ID;

  // 回跳地址优先取「本次请求实际访问的域名」，这样正式域名、www、预览域名都能自动正确
  const reqHost = (req.headers['x-forwarded-host'] || req.headers['host'] || '').split(',')[0].trim();
  const appUrl = (
    reqHost ? `https://${reqHost}` : (process.env.APP_URL || 'https://www.listingforge.com')
  ).replace(/\/$/, '');

  if (!apiKey || !productId) {
    return res.status(500).json({ error: 'Creem 未配置：请在 Vercel 设置 CREEM_API_KEY / CREEM_PRODUCT_ID' });
  }

  const successUrl = `${appUrl}/success`;

  try {
    const r = await fetch(`${apiBase}/v1/checkouts`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        request_id: `lf_${Date.now()}`,
        success_url: successUrl
      })
    });
    const data = await r.json();
    if (!data.checkout_url) {
      return res.status(502).json({ error: '创建收银台失败', detail: data });
    }
    return res.status(200).json({ checkout_url: data.checkout_url });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
