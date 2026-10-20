# Imaging Innovation Hot

一个聚焦新兴影像产品的轻量信息雷达。项目从 41 个 RSS 信源抓取内容，完成相关性筛选、事件去重、中文翻译和项目级合并，最终生成两个不依赖后端的静态 HTML 页面。

## 页面

- `data/innovation-product-library.html`：独立的创新影像产品项目库
- `data/imaging-hot-report.html`：影像行业 Hot 报告

创新项目库只保留有明确产品对象和落地证据的内容，例如新品发布、众筹项目、原型、开源项目、AI 影像、空间影像、智能相机和新型专业器材。普通评测、维护更新、法规消息、传闻和传统大厂常规新品会被过滤。

## 主要能力

- 从 41 个中英文 RSS 信源抓取影像行业内容
- 规范化链接并执行硬去重、事件聚类和项目级合并
- 自动翻译标题与摘要，并缓存翻译结果
- 生成可搜索、分类、筛选和收藏的静态项目库
- 长期保留已经发现的创新项目

## 快速开始

需要 Node.js 20 或更高版本。

```bash
npm install
npm run use
```

运行完成后，直接打开：

```text
data/innovation-product-library.html
data/imaging-hot-report.html
```

只生成创新项目库：

```bash
npm run library
```

清空历史积累并重新建库：

```bash
npm run library:rebuild
```

## 翻译

默认使用免密的 Google 翻译入口。翻译发生在生成阶段，访问 HTML 时不会再次请求翻译服务。

如果设置以下任意环境变量，会优先使用 OpenAI 兼容模型；失败时自动退回 Google 翻译：

```text
OPENAI_API_KEY       # gpt-4o-mini
DEEPSEEK_API_KEY     # deepseek-chat
SILICONFLOW_API_KEY  # Qwen/Qwen2.5-7B-Instruct
DASHSCOPE_API_KEY    # qwen-turbo
```

模型和 Base URL 可以用 `OPENAI_TRANSLATE_MODEL`、`OPENAI_BASE_URL` 覆盖。GitHub Actions 的免费出口 IP 经常被 Google 翻译限流（HTTP 429），如果发现标题没有翻译，在仓库 Secrets 里加一个 `DEEPSEEK_API_KEY` 即可稳定走模型翻译。

不要把密钥提交到仓库。项目已忽略 `.env` 和 `.env.*` 文件。

## 常用命令

```bash
npm run check:feeds     # 检查全部 RSS 信源
npm run fetch:feeds     # 抓取 RSS
npm run dedupe:items    # 去重、聚类和筛选
npm run verify:dedupe   # 校验去重结果
npm run translate       # 翻译标题和摘要
npm run report          # 生成 Markdown 报告
npm run html            # 生成 Hot HTML
npm run library         # 更新创新项目库
npm run feed            # 生成 data/feed.xml（RSS）
npm run notify          # 把新增项目推到飞书（需 FEISHU_WEBHOOK）
npm run use             # 完整执行全部步骤
```

## 主要文件

- `sources/imaging-products-rss.json`：影像产品 RSS 信源库
- `scripts/fetch-feeds.mjs`：RSS 抓取
- `scripts/dedupe-items.mjs`：相关性筛选、去重和聚类
- `scripts/translate-items.mjs`：标题与摘要翻译
- `scripts/make-html.mjs`：行业 Hot 页面生成
- `scripts/make-innovation-library.mjs`：创新项目筛选、合并和页面生成
- `scripts/make-feed.mjs`：把项目库导出为 RSS（`data/feed.xml`）
- `scripts/notify-feishu.mjs`：新增项目和构建失败的飞书推送
- `data/innovation-projects.json`：需要长期保留的项目数据库

## 去重逻辑

1. 硬去重：规范化 URL，去掉 RSS 和追踪参数，同源同标题合并。
2. 事件聚类：根据标题相似度、品牌或实体重合、发布时间窗口合并同一事件。
3. 项目合并：只有通过严格创新筛选的内容才能创建项目，低分报道只能补充到已有项目。

项目生成后是普通静态文件，可以部署到 GitHub Pages、Cloudflare Pages、Vercel、Netlify 或任意对象存储。

## 在线部署

站点通过 GitHub Actions 每小时更新并发布到 GitHub Pages：

- 产品库首页：`https://camera.lts4ai.com/`
- Hot 报告：`https://camera.lts4ai.com/hot.html`
- RSS 订阅：`https://camera.lts4ai.com/feed.xml`
- 自动更新：每小时第 17 分钟执行
- 手动更新：在仓库 Actions 页面运行 `Refresh and deploy Pages`

工作流执行 `npm run use`（包含 feed 生成），再把 HTML 与 `feed.xml` 打包为 Pages artifact；生成结果不会每小时提交回仓库。

翻译密钥可配置为 GitHub Actions repository secrets：`OPENAI_API_KEY`、`DEEPSEEK_API_KEY`、`SILICONFLOW_API_KEY` 或 `DASHSCOPE_API_KEY`。未配置时继续使用项目现有的免费翻译回退。

### 飞书推送

新增项目通过飞书**群自定义机器人**推送，不需要创建应用，也不需要企业管理员授权：

1. 在目标飞书群 → 设置 → 群机器人 → 添加机器人 → 自定义机器人，复制 webhook 地址。
2. 仓库 Settings → Secrets and variables → Actions，添加 `FEISHU_WEBHOOK`（必填）。
3. 如果机器人开启了签名校验，再添加 `FEISHU_SECRET`（可选）。
4. 汇总的分数门槛和条数用 `FEISHU_MIN_SCORE`、`FEISHU_LIMIT` 调整（默认不设门槛、最多 10 条），写在 `digest.yml` 的 env 里。

没有合适的群时，可以建一个**只有自己的群**：消息页 → 创建群组 → 不选成员直接创建，再把机器人加进去，消息只有你能看到（官方《飞书的个人使用小技巧》就是用单人群当个人笔记本）。如果企业版限制建群必须选人，可以注册一个个人版账号建一个只有自己的团队，或者拉一个小号建 2 人群后让对方退出。

推送节奏由 `digest.yml` 控制：每天 **11:00 和 17:00**（Asia/Shanghai）各汇总一次，只包含上次汇总之后的新项目；没有新项目就不发。想立刻看一次：Actions → Feishu digest → Run workflow（勾 `dry_run` 只打印不发送）。已发送到的位置记录在 `data/notify-state.json`，已发送的项目 id 也会记录（最近 500 个），手动补发不会重复。

每天至少一条：17:00 之后如果当天还没有发过任何汇总，会补一条「今日无新增」，避免一整天没消息。定时触发的汇总只在 11:00–12:30 / 17:00–18:30 发送，GitHub 把任务拖到半夜时会直接跳过。`pages.yml` 的每小时构建也会兜底检查一次，防止 `digest.yml` 的 cron 被 GitHub 延迟或跳过。

每条汇总最多展示 10 条，并且同一个来源最多 2 条（`FEISHU_MAX_PER_SOURCE` 可调），避免某个高产媒体刷屏；超出部分会在末尾提示“还有 N 个”。

未配置 `FEISHU_WEBHOOK` 时脚本自动跳过，不影响构建；构建失败也会推一条失败告警到同一个群。

### 评分反馈与周度校准

每个项目卡片右下角有「打分」链接，点开是一个预填好的 GitHub issue：填 0-100 分（可以写理由）提交即可。`feedback.yml` 会把分数写进 `data/feedback.json`，评论并关闭 issue。

每周一 10:00（Asia/Shanghai），`calibrate.yml` 用这些反馈重新拟合一次评分偏差：

- 以你的分数为目标、机器原始分（`baseScore`）为基准，学习「类别 / 来源 / 分数段」三个维度上的系统性高估或低估；
- 带时间衰减（半衰期 120 天）的 ridge 回归，样本少于 3 条不生效；
- 单个项目的总调整上限 ±20 分，避免一次打分把排序带偏；
- 结果写入 `data/scoring-profile.json`，之后每小时构建按 `baseScore + 校准偏差` 显示新的创新度。

想马上重算：Actions → Calibrate scores → Run workflow。原始分保存在 `baseScore`，鼠标悬停分数可以看到。

### 防止定时任务被停用

GitHub 会在仓库连续 60 天没有提交时自动停用 schedule 工作流（本项目 2026-09-11 就是这样停的）。`keepalive.yml` 每周一自动提交一次 `.github/keepalive.txt`，保持仓库有 activity。如果 Actions 页面仍显示 workflow 被禁用，手动点一次 Enable 即可恢复。
