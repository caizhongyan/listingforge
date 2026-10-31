# SKUWrite（原代号 ListingForge）

面向中国跨境卖家的 AI 多语言商品文案生成器：粘贴产品信息，一键生成符合 Amazon / Shopify 规则的多语言 Listing（标题 / 5 条卖点 / 描述 / 10 个关键词）。

- 线上：https://www.skuwrite.com
- 收款：Creem（MoR），one-time $5.99
- 模型：DeepSeek（`deepseek-flash`）
- 部署：Vercel Serverless + 自定义域名

## 接手必读

**完整交接文档见 [`HANDOVER.md`](./HANDOVER.md)** —— 含线上状态、文件结构、环境变量、踩坑备忘、待办优先级、换电脑启动步骤。

## 技术栈

- 前端：原生 HTML/CSS/JS（中文界面，多语言输出）
- 后端：Vercel Serverless Functions (`api/*.mjs`)，`maxDuration: 60`，`cleanUrls: true`
- 模型：DeepSeek（env `LLM_PROVIDER` 抽象层，可扩展 OpenAI / Claude）
- 收款：Creem，one-time $5.99
- 埋点：`track.js` + `api/track.mjs`

## 状态

- ✅ 站点上线，HTTPS，国内可直连
- ✅ 生成接口（EN/JA 实测 7–8s）
- ✅ 收银台 / 解锁 / 埋点 / SEO 地基
- ⏳ **真实支付闭环待验证**（P0）
- ⏳ 首批客户触达（P1）
