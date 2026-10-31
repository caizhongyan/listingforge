# ListingForge

面向中国跨境卖家的 AI 商品文案工具：粘贴产品信息，一键生成多语言 Listing（标题 / 卖点 / 描述 / 关键词），符合 Amazon / Shopify / 独立站平台规则。

## 技术栈
- 前端：原生 HTML/CSS/JS（中文界面，多语言输出）
- 后端：Vercel Serverless Functions (api/*.mjs)
- 模型：境外大模型主用（OpenAI / Claude），国产（DeepSeek）作兜底，env `LLM_PROVIDER` 切换
- 收款：Creem（MoR，人民币提现支付宝）— 待从 passportpicz 移植
- 埋点：track.js + api/track.mjs（错误上报 + Web Analytics）

## 环境变量
- `LLM_PROVIDER` = openai | claude | deepseek
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY`
- `OPENAI_MODEL` / `CLAUDE_MODEL` / `DEEPSEEK_MODEL`（可选）

## 状态
- ✅ 生成主链路骨架（form + /api/generate + UI + 错误上报）
- ⏳ Creem 付费墙（移植 passportpicz 已验证代码）
- ⏳ privacy/terms 合规润色（钱守正）
- ⏳ 阶段 0 验证（发帖找首批付费意向用户）
