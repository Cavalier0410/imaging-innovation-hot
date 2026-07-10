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
OPENAI_API_KEY
DEEPSEEK_API_KEY
SILICONFLOW_API_KEY
DASHSCOPE_API_KEY
```

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
npm run use             # 完整执行全部步骤
```

## 主要文件

- `sources/imaging-products-rss.json`：影像产品 RSS 信源库
- `scripts/fetch-feeds.mjs`：RSS 抓取
- `scripts/dedupe-items.mjs`：相关性筛选、去重和聚类
- `scripts/translate-items.mjs`：标题与摘要翻译
- `scripts/make-html.mjs`：行业 Hot 页面生成
- `scripts/make-innovation-library.mjs`：创新项目筛选、合并和页面生成
- `data/innovation-projects.json`：需要长期保留的项目数据库

## 去重逻辑

1. 硬去重：规范化 URL，去掉 RSS 和追踪参数，同源同标题合并。
2. 事件聚类：根据标题相似度、品牌或实体重合、发布时间窗口合并同一事件。
3. 项目合并：只有通过严格创新筛选的内容才能创建项目，低分报道只能补充到已有项目。

项目生成后是普通静态文件，可以部署到 GitHub Pages、Cloudflare Pages、Vercel、Netlify 或任意对象存储。
