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
4. 阈值和条数用 `FEISHU_MIN_SCORE`（默认 80）、`FEISHU_LIMIT`（默认 5）调整，写在 `pages.yml` 的 env 里。

未配置 `FEISHU_WEBHOOK` 时脚本自动跳过，不影响构建；构建失败也会推一条失败告警到同一个群。

### 防止定时任务被停用

GitHub 会在仓库连续 60 天没有提交时自动停用 schedule 工作流（本项目 2026-09-11 就是这样停的）。`keepalive.yml` 每周一自动提交一次 `.github/keepalive.txt`，保持仓库有 activity。如果 Actions 页面仍显示 workflow 被禁用，手动点一次 Enable 即可恢复。
