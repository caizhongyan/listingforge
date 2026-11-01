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

---

## 十一、2026-11-01 更新记录（本次已完成）

### 1. P0 真实支付闭环 —— 已验证通过 ✅

支付宝扫码付 $5.99（订单 `ORD-1A194C498535AE13`）→ Creem 成功页 → 回跳首页 → 解锁生效（完整卖点 + 关键词 + 一键复制）。
**唯一待办：到 Creem 后台确认订单状态为 paid，并留意首笔提现到账周期（通常 7-14 天）。**

### 2. 修复「付款后需要重新生成」缺陷

- 现象：点解锁跳收银台后，生成结果丢失，付款回来只能重新生成
- 原因：结果只存在内存变量 `lastResult`，页面导航到 Creem 再回跳必然重载，变量清空
- 修复：跳转前把「表单内容 + 结果」写入 sessionStorage（key `lf_pending`），回跳 `/?paid=1` 后自动恢复，并以已解锁态渲染。已解锁用户中途从收银台退出返回也能恢复

### 3. 重写生成 prompt（质量升级）

- 标题：150-200 字符目标、前 80 字符必含核心搜索词、结构「核心词+关键属性+场景+人群」
- 卖点：5 条，每条 100-150 字符，**全大写钩子开头**，五条分工固定（价值/材质/工艺/场景/保养送礼），不重复关键词
- 描述：70-100 词，三段式（场景痛点 → 材质工艺 → 保养送礼）
- 关键词：10 个，头部词+长尾+场景+材质，避免与标题重复
- 新增**事实纪律**：用户未提供的尺寸/容量/认证（dishwasher safe、lead-free 等）一律禁止编造，未给品牌不虚构品牌名
- 禁用 AI 套话（elevate / unleash / game-changer / must-have 等）
- 首页输入框提示改为引导用户补充规格参数（输入越全，质量越高）

### 4. 新增踩坑记录（重要）

**不要给 generate.mjs 设置较小的 `max_tokens`。** DeepSeek 的 flash / v4-pro 都是推理型模型，思维链占用同一 token 预算；实测设 1600 会截断输出 → JSON 不完整 → 解析失败 → 全部请求返回 500「生成失败」。现在不传该参数，用服务端默认值。

**生成耗时上升到 20-40 秒**（原 7.9 秒是极短输出的结果）。prompt 变复杂后推理耗时增加，与输出长度关系不大。已在 `app.js` 加实时计时器缓解等待焦虑。Vercel `maxDuration: 60` 尚有余量，但若后续再加长输出需盯住 60 秒上限。

**生成接口支持调试开关**：请求体带 `"debug": true` 时，500 响应会额外返回 `detail` 字段（真实错误原因），前端不传，仅供内部排查。

### 5. 本机环境备忘

- 电脑没装系统级 Git，用 WorkBuddy 便携版：`C:/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.3.0/mingw64/bin/git.exe`
- GitHub 授权走**设备码流程**（Git 凭据窗口选 `Sign in with a code` → 打开 github.com/login/device 输入码 → Authorize）。浏览器回跳 `127.0.0.1:xxxx` 的方式会 ERR_CONNECTION_REFUSED
- 凭据已存入 Git Credential Manager，后续 `git push` 可直接执行

### 6. 中文对照阅读（2026-11-01 新增）

付费用户在英文结果基础上，标题/每条卖点/描述下方会多一行**浅灰中文释义**，仅供核对阅读。

- 实现：英文结果先渲染（不拖慢），随后前端异步调 `/api/translate` 补中文，返回后局部重绘
- `/api/translate` **需要解锁 token**（与 unlock.mjs 同一套 HMAC 校验），非付费用户返回 403，防止被当成免费翻译器
- 中文对照**不进入复制内容**（复制前会剔除 `.zh` 节点），客户粘贴到后台的仍是纯目标语言文案
- 新增 `api/_llm.mjs` 共用模块：callLLM + readJson 由 generate / translate 共用，后续加接口直接 import

### 7. 当前遗留风险

**生成耗时 30-42 秒且波动较大**（实测 30.3 / 32.7 / 37.5 / 41.8 秒），距离 Vercel `maxDuration: 60` 的安全余量在收窄。若某次推理耗时超过 60 秒，该次生成会失败（前端提示「生成失败，请稍后重试」）。可行缓解手段（尚未实施）：
1. 提供「快速模式」开关：短 prompt、输出更短，约 10 秒出稿、质量略降
2. 进一步压缩输出长度目标
3. 升级 Vercel 付费计划，把 maxDuration 提到 300s 并换用 deepseek-v4-pro（质量更高但更慢）

### 8. 解锁码备份与换设备恢复（2026-11-01 新增）

**背景**：解锁凭证只存在浏览器 localStorage（有效期 1 年）且没有任何账号体系，客户清缓存 / 换浏览器 / 换电脑就会回到锁定态，此前只能人工救。

- **支付成功页**（实际地址 `/success`，`/success.html` 会 308 跳转）现在直接展示**解锁码全文 + 复制按钮**，并提示「复制后存到微信收藏或笔记」
- 成功页**取消了自动跳转**（原来是 1.4 秒自动跳走，用户来不及保存），改为按钮「开始生成文案」→ `/?paid=1`
- **首页底部新增「解锁码 / 恢复购买」**入口：
  - 已解锁：显示当前解锁码，可一键复制
  - 已锁定：粘贴解锁码 → 调 `/api/unlock` 校验签名与有效期 → 通过则写回 localStorage 并刷新解锁
- 支付回跳后的状态提示也会提醒用户去底部备份解锁码

**仍未覆盖的情况**：客户既没保存解锁码、又清空了浏览器 —— 目前只能人工处理（邮箱 support@skuwrite.com）。要做「凭订单号自助找回」，需要确认 Creem API 是否支持按 order_id / 邮箱反查订单，验证通过后再加 `/api/redeem` 接口。
