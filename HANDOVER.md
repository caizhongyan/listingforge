# 项目交接文档 · SKUWrite（原项目代号 ListingForge）

> 最后更新：2026-11-01 07:50（北京时间）
> 用途：换电脑 / 换会话继续工作时，读这一份即可接手，无需回看历史对话。
> **本文件不含任何明文密钥**，可安全推送到 GitHub。密钥清单见本地 `密钥_仅本地勿上传.md`（已 gitignore）。

---

## 一、项目定位（一句话）

面向**中国跨境卖家**的 AI 多语言商品文案生成器。用户粘贴产品信息 → 一键生成符合 Amazon / Shopify 规则的多语言 Listing（标题 / 5 条卖点 / 描述 / 10 个关键词）。

- 载体：**网页**（非小程序）
- 部署：**Vercel**（境外）
- 域名：**https://www.skuwrite.com**（已绑定，HTTPS，国内可直连）
- 模型：**DeepSeek**（境外服务端调用，避开国内合规问题）
- 收款：**Creem**（MoR 代收款商，one-time **$5.99**，人民币提现支付宝）
- 商业模式：Freemium —— 免费预览几条，完整版 $5.99 一次性解锁

---

## 二、线上现状（已实测通过）

| 项目 | 状态 | 备注 |
|---|---|---|
| 首页 https://www.skuwrite.com | ✅ 200 | 国内可直连 |
| 根域 skuwrite.com | ✅ 308 → www | Vercel 勾了 Redirect apex to www |
| /success（支付成功页） | ✅ 200 | 曾 404，已修 |
| /sitemap.xml | ✅ 200 | 已收录 3 条 URL |
| /robots.txt | ✅ 200 | |
| /privacy.html、/terms.html | ✅ 200 | |
| /api/generate 生成接口 | ✅ 实测英文 7.9s / 日语 7.6s | 返回 5 卖点 + 10 关键词 |
| /api/checkout 收银台 | ✅ 返回 checkout_url | `mode=prod` 真实收款 |
| /api/unlock 解锁校验 | ✅ 伪 token 正确返回 `{"valid":false}` | |
| /api/track 埋点 | ✅ 204 | |

**代码与 GitHub 完全同步**（`git status` 干净，最新提交 `ca4daba`）。

---

## 三、文件结构

```
listingforge_deploy_20261031/
├── index.html          主页面（表单 + 结果展示 + 付费墙）
├── success.html        支付成功页（展示解锁码）
├── privacy.html        隐私政策
├── terms.html          服务条款
├── app.js              前端逻辑
├── style.css           样式
├── track.js            埋点前端
├── sitemap.xml         SEO
├── robots.txt          SEO
├── vercel.json         {"functions":{"api/*.mjs":{"maxDuration":60}},"cleanUrls":true}
├── api/
│   ├── generate.mjs    核心：AI 生成（人设 + 平台规则 + 多语言 native）
│   ├── checkout.mjs    创建 Creem 收银台
│   ├── unlock.mjs      校验解锁 token
│   └── track.mjs       埋点接收（标准 Node 写法）
├── local-dev.mjs       本地预览（不部署，已 gitignore）
├── deploy-console.html 内部部署指引（不部署，已 gitignore）
├── README.md
└── HANDOVER.md         本文件
```

---

## 四、各平台入口与账号

| 平台 | 用途 | 入口 |
|---|---|---|
| GitHub | 代码仓库 | https://github.com/caizhongyan/listingforge |
| Vercel | 部署 + 环境变量 + 域名绑定 | vercel.com 项目 `listingforge` |
| Creem | 收款（MoR） | creem.io，Product ID 见本地密钥文件 |
| DeepSeek | 大模型 | platform.deepseek.com，已充值 ¥50 |
| Spaceship | 域名 + DNS | spaceship.com，域名 1 年 $9.08（至 2027-10-31） |

---

## 五、Vercel 环境变量（6 个，全部已配置在生产环境）

| 变量名 | 用途 | 值 |
|---|---|---|
| `LLM_PROVIDER` | 模型提供方 | `deepseek` |
| `DEEPSEEK_API_KEY` | 模型密钥 | 见本地密钥文件 |
| `DEEPSEEK_MODEL` | 模型名（可选） | 默认 `deepseek-flash` |
| `CREEM_API_KEY` | 收款密钥 | 见本地密钥文件 |
| `CREEM_PRODUCT_ID` | Creem 产品 ID | 见本地密钥文件 |
| `CREEM_API_BASE` | Creem API 地址 | `https://api.creem.io` |
| `UNLOCK_SECRET` | 解锁 token 签名密钥 | 见本地密钥文件 |
| `APP_URL` | 站点地址（**占位，代码自动取请求 host**） | 占位即可 |

> 代码里**没有任何硬编码密钥**（已扫描确认）。所以换电脑不必迁移密钥——它们都在 Vercel 后台，登录即可见。

---

## 六、踩过的坑（换电脑后务必记得，能省几小时）

1. **Vercel Node 运行时没有 `req.json()`** —— 原写法线上必抛错，所有 POST 返回 400。已改为三重兜底：`req.body` → `req.json()` → 读流。**新写 API 时别用 `req.json()` 作为唯一途径。**
2. **`track.mjs` 曾误用 Next.js 写法**（`import { NextResponse } from 'next/server'`）—— 项目无 next 依赖，会直接崩。已改标准 Node 处理函数。
3. **支付成功回跳 404（致命）** —— success_url 拼成 `/success`，但真实文件是 `success.html`，Vercel 不自动映射。客户付了钱却拿不到解锁。已改为 `/success.html` + `cleanUrls:true` 兜底。
4. **Vercel 后台的 Deploy 按钮是坏的** —— 一直卡在 "Deploying" 无部署。**一律用 `git push origin main` 触发生产部署。**
5. **`*.vercel.app` 在国内被拦** —— 必须绑自定义域名才能国内访问。
6. **DeepSeek 账号只有 `deepseek-flash` 和 `deepseek-v4-pro`** —— `deepseek-chat` 不存在。v4-pro 太慢会超 Vercel Hobby 10s 限制，**必须用 flash**（配合 `maxDuration: 60`）。
7. **DeepSeek 未充值会返回 402** —— 已充 ¥50。
8. **SSH 推送可能被系统权限拦截** —— 被拦时改 HTTPS：`git remote set-url origin https://github.com/caizhongyan/listingforge.git`
9. **Spaceship DNS API 格式**：PUT 用 `{"items":[...]}` 对象格式，DELETE 用**纯数组**格式，两者语义不同，混用会报错。
10. **Spaceship 结账有 "$0.00 试用" 陷阱** —— 只买域名，别勾 SSL / 邮箱托管。
11. **域名绑定别重复** —— 只加 `www.skuwrite.com` 并勾 "Redirect apex to www"，不要同时加根域。
12. **`search.google.com`（GSC）国内连不上**（ERR_CONNECTION_TIMED_OUT）—— 需代理，或暂时搁置。

---

## 七、待办（按优先级）

### P0 · 今天必须做
- [ ] **真实支付 $5.99 走完整闭环** —— 唯一尚未验证的环节。证明钱能到账 + 解锁码生效。
      → https://www.skuwrite.com 生成 → 解锁 → Creem 付款 → 看是否跳成功页

### P1 · 本周
- [ ] **第一批客户触达**（手动，不投广告、不做 SEO）
      目标渠道：知无不言（跨境电商卖家社区）、小红书、抖音、知乎"跨境电商"话题、亚马逊卖家群、Shopify 中文圈
      目标：先手动发 10 条，看点击与询价，有人问再谈放大
- [ ] `support@skuwrite.com` 配置邮件转发（否则收不到客户邮件）

### P2 · 有空再做
- [ ] GSC 提交 sitemap（需代理；不提交也会被慢慢发现）
- [ ] Vercel 开启 Web Analytics

---

## 八、换电脑后的启动步骤

1. 新电脑装 Git + Node
2. `git clone https://github.com/caizhongyan/listingforge.git`（SSH 被拦就用 HTTPS）
3. 登录 Vercel / Creem / DeepSeek / Spaceship（密钥都在各平台后台，无需迁移）
4. 读本文件第六节的坑，再动手改代码
5. 改完 `git push origin main` 触发部署（**别点 Vercel 的 Deploy 按钮**）

---

## 九、成本台账

| 项目 | 金额 |
|---|---|
| 域名 skuwrite.com（1 年） | $9.08 |
| DeepSeek 充值 | ¥50 |
| Vercel | $0（Hobby 免费额度） |
| Creem | $0 固定成本，按单抽成 |
| **合计已投入** | **约 ¥115** |

盈亏平衡参考：约 **84 名付费用户**（按此前测算口径）。

---

## 十、重要决策记录（避免反复讨论）

- 用户初心：**复刻别人已成功的项目来赚钱**，宁缺毋滥、上线即高质量
- 已决定：**跳过阶段 0 验证**（直接上线看真实付费）
- 已决定：**不接短信验证**（降低复杂度）
- passportpicz.com 为上一项目，**已冻结为"活样本"**，不投入、不赚钱
- 分工：AI 写代码 / 调 API / 改 DNS；用户负责账号登录、付款、授权点击
