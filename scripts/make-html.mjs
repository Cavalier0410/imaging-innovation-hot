import fs from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve("data");
const outputPath = path.join(dataDir, "imaging-hot-report.html");

async function readJsonPrefer(preferred, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(dataDir, preferred), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return JSON.parse(await fs.readFile(path.join(dataDir, fallback), "utf8"));
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function favicon(url) {
  const host = hostOf(url);
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64` : "";
}

function byCategory(items) {
  const groups = new Map();
  for (const item of items) {
    const category = item.source?.category || "其他";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

function sourceName(item) {
  return item.source?.name || item.source || "Unknown";
}

function topicCard(topic, index) {
  const sources = topic.sourceNames?.length ? topic.sourceNames.join(" / ") : topic.source;
  const title = topic.titleZh || topic.title;
  const searchText = `${topic.title} ${topic.titleZh || ""} ${topic.source} ${sources} ${topic.category || ""} ${topic.direction || ""}`.toLowerCase();
  return `
    <article class="card topic-card" data-kind="topic" data-category="当前热点" data-search="${escapeHtml(searchText)}">
      <div class="rank">${index + 1}</div>
      <div class="card-main">
        <div class="meta-row">
          <span class="pill hot">HOT</span>
          ${topic.direction ? `<span class="pill direction">${escapeHtml(topic.direction)}</span>` : ""}
          ${topic.category ? `<span>${escapeHtml(topic.category)}</span>` : ""}
          <span>${escapeHtml(topic.sourceCount)} 个来源</span>
          <span>${escapeHtml(topic.itemCount)} 条相关内容</span>
          <span>新兴度 ${escapeHtml(topic.emergingScore || "-")}</span>
          <span>分数 ${escapeHtml(topic.score)}</span>
        </div>
        <h2>${escapeHtml(title)}</h2>
        ${topic.titleZh && topic.titleZh !== topic.title ? `<p class="original-title">${escapeHtml(topic.title)}</p>` : ""}
        <p class="source-line">${escapeHtml(sources)}</p>
        <a class="open-link" href="${escapeHtml(topic.url)}" target="_blank" rel="noreferrer">打开原文</a>
      </div>
    </article>`;
}

function itemCard(item, index) {
  const category = item.source?.category || "其他";
  const source = sourceName(item);
  const time = formatDate(item.publishedAt);
  const title = item.titleZh || item.title;
  const summary = item.summaryZh || item.summary || "";
  const searchText = `${item.title} ${item.titleZh || ""} ${item.summary || ""} ${item.summaryZh || ""} ${source} ${category}`.toLowerCase();
  const icon = favicon(item.url);
  return `
    <article class="card item-card" data-kind="item" data-category="${escapeHtml(category)}" data-search="${escapeHtml(searchText)}">
      <div class="source-icon">${icon ? `<img src="${escapeHtml(icon)}" alt="">` : `<span>${escapeHtml(source.slice(0, 1))}</span>`}</div>
      <div class="card-main">
        <div class="meta-row">
          <span class="pill">${escapeHtml(category)}</span>
          <span>${escapeHtml(source)}</span>
          ${time ? `<span>${escapeHtml(time)}</span>` : ""}
          <span>分数 ${escapeHtml(item.score)}</span>
        </div>
        <h3>${escapeHtml(title)}</h3>
        ${item.titleZh && item.titleZh !== item.title ? `<p class="original-title">${escapeHtml(item.title)}</p>` : ""}
        ${summary ? `<p class="summary">${escapeHtml(summary).slice(0, 220)}</p>` : ""}
        <a class="open-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">打开原文</a>
      </div>
    </article>`;
}

const [topicsData, selectedData, reportData] = await Promise.all([
  readJsonPrefer("hot-topics.zh.json", "hot-topics.json"),
  readJsonPrefer("items.selected.zh.json", "items.selected.json"),
  fs.readFile(path.join(dataDir, "dedupe-report.json"), "utf8").then(JSON.parse)
]);

const topics = topicsData.items || [];
const selected = selectedData.items || [];
const groups = byCategory(selected);
const categories = groups.map(([category]) => category);

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>影像产品 Hot</title>
  <link rel="alternate" type="application/rss+xml" title="创新影像产品项目库" href="https://camera.lts4ai.com/feed.xml">
  <style>
    :root {
      --bg: #f6f7f8;
      --panel: #ffffff;
      --text: #182026;
      --muted: #64717c;
      --line: #d9e0e6;
      --accent: #156f86;
      --accent-2: #8b4c24;
      --accent-3: #6f5d9b;
      --good: #25724f;
      --shadow: 0 10px 28px rgba(24, 32, 38, .08);
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    }

    a { color: inherit; }

    .shell {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 48px;
    }

    header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 18px;
      align-items: end;
      border-bottom: 1px solid var(--line);
      padding-bottom: 18px;
    }

    h1 {
      margin: 0;
      font-size: 34px;
      line-height: 1.1;
      letter-spacing: 0;
    }

    .subtitle {
      margin: 8px 0 0;
      color: var(--muted);
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(92px, 1fr));
      gap: 8px;
      min-width: 430px;
    }

    .stat {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px 12px;
      box-shadow: 0 4px 14px rgba(24, 32, 38, .04);
    }

    .stat b {
      display: block;
      font-size: 21px;
      line-height: 1.2;
    }

    .stat span {
      color: var(--muted);
      font-size: 12px;
    }

    .toolbar {
      position: sticky;
      top: 0;
      z-index: 5;
      background: rgba(246, 247, 248, .94);
      backdrop-filter: blur(10px);
      display: grid;
      grid-template-columns: minmax(220px, 360px) 1fr;
      gap: 14px;
      padding: 16px 0;
      border-bottom: 1px solid var(--line);
    }

    .search {
      width: 100%;
      height: 42px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0 13px;
      font: inherit;
      background: var(--panel);
      color: var(--text);
    }

    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .tab {
      height: 36px;
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--text);
      border-radius: 8px;
      padding: 0 12px;
      font: inherit;
      cursor: pointer;
    }

    .tab.active {
      background: var(--text);
      border-color: var(--text);
      color: #fff;
    }

    section {
      margin-top: 28px;
    }

    .section-head {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: baseline;
      margin-bottom: 12px;
    }

    .section-head h2 {
      margin: 0;
      font-size: 22px;
    }

    .section-head p {
      margin: 0;
      color: var(--muted);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
      display: grid;
      gap: 12px;
      min-width: 0;
    }

    .topic-card {
      grid-template-columns: 42px 1fr;
      padding: 14px;
    }

    .item-card {
      grid-template-columns: 38px 1fr;
      padding: 14px;
    }

    .rank {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: #e8f2f5;
      color: var(--accent);
      font-weight: 800;
    }

    .source-icon {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      border: 1px solid var(--line);
      display: grid;
      place-items: center;
      overflow: hidden;
      background: #fafafa;
      color: var(--accent-2);
      font-weight: 800;
    }

    .source-icon img {
      width: 22px;
      height: 22px;
    }

    .card-main { min-width: 0; }

    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      color: var(--muted);
      font-size: 12px;
      margin-bottom: 7px;
    }

    .pill {
      color: var(--accent);
      background: #e7f2f4;
      border-radius: 999px;
      padding: 1px 8px;
      font-weight: 700;
    }

    .pill.hot {
      color: #fff;
      background: var(--accent-2);
    }

    .pill.direction {
      color: #342b78;
      background: #ece9fb;
    }

    h2, h3 {
      margin: 0;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }

    .topic-card h2 {
      font-size: 18px;
      line-height: 1.32;
    }

    .item-card h3 {
      font-size: 16px;
      line-height: 1.35;
    }

    .source-line,
    .original-title,
    .summary {
      color: var(--muted);
      margin: 8px 0 0;
      overflow-wrap: anywhere;
    }

    .original-title {
      font-size: 13px;
    }

    .open-link {
      display: inline-flex;
      align-items: center;
      height: 32px;
      margin-top: 10px;
      color: var(--accent);
      font-weight: 700;
      text-decoration: none;
    }

    .open-link:hover { text-decoration: underline; }

    .category-block {
      margin-top: 18px;
    }

    .category-block h3 {
      margin: 0 0 10px;
      font-size: 18px;
    }

    .hidden { display: none !important; }

    .empty {
      display: none;
      background: var(--panel);
      border: 1px dashed var(--line);
      border-radius: 8px;
      padding: 24px;
      color: var(--muted);
      text-align: center;
    }

    @media (max-width: 860px) {
      header,
      .toolbar {
        grid-template-columns: 1fr;
      }

      .stats {
        min-width: 0;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .grid {
        grid-template-columns: 1fr;
      }

      h1 {
        font-size: 29px;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div>
        <h1>影像产品 Hot</h1>
        <p class="subtitle">生成时间：${escapeHtml(formatDate(reportData.generatedAt))}</p>
      </div>
      <div class="stats" aria-label="统计">
        <div class="stat"><b>${escapeHtml(reportData.rawItemCount)}</b><span>原始内容</span></div>
        <div class="stat"><b>${escapeHtml(reportData.allCount)}</b><span>全量池</span></div>
        <div class="stat"><b>${escapeHtml(reportData.selectedCount)}</b><span>精选池</span></div>
        <div class="stat"><b>${escapeHtml(reportData.hotTopicCount)}</b><span>热点</span></div>
      </div>
    </header>

    <div class="toolbar">
      <input id="search" class="search" type="search" placeholder="搜索品牌、方向、产品、来源">
      <div class="tabs" id="tabs">
        <button class="tab active" data-category="全部">全部</button>
        <button class="tab" data-category="当前热点">当前热点</button>
        ${categories.map((category) => `<button class="tab" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join("")}
      </div>
    </div>

    <section>
      <div class="section-head">
        <h2>当前热点</h2>
        <p>${escapeHtml(topics.length)} 个事件</p>
      </div>
      <div class="grid" id="topics">
        ${topics.map(topicCard).join("")}
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>分组精选</h2>
        <p>${escapeHtml(selected.length)} 条</p>
      </div>
      <div id="items">
        ${groups.map(([category, items]) => `
          <div class="category-block" data-block-category="${escapeHtml(category)}">
            <h3>${escapeHtml(category)} · ${escapeHtml(items.length)}</h3>
            <div class="grid">
              ${items.map(itemCard).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    </section>

    <div id="empty" class="empty">没有匹配的内容</div>
  </main>

  <script>
    const search = document.querySelector("#search");
    const tabs = [...document.querySelectorAll(".tab")];
    const cards = [...document.querySelectorAll(".card")];
    const blocks = [...document.querySelectorAll(".category-block")];
    const empty = document.querySelector("#empty");
    let activeCategory = "全部";

    function applyFilters() {
      const query = search.value.trim().toLowerCase();
      let visibleCount = 0;

      for (const card of cards) {
        const category = card.dataset.category || "";
        const haystack = card.dataset.search || "";
        const categoryMatch = activeCategory === "全部" || category === activeCategory;
        const queryMatch = !query || haystack.includes(query);
        const visible = categoryMatch && queryMatch;
        card.classList.toggle("hidden", !visible);
        if (visible) visibleCount += 1;
      }

      for (const block of blocks) {
        const hasVisible = !!block.querySelector(".card:not(.hidden)");
        block.classList.toggle("hidden", !hasVisible);
      }

      empty.style.display = visibleCount ? "none" : "block";
    }

    for (const tab of tabs) {
      tab.addEventListener("click", () => {
        activeCategory = tab.dataset.category;
        tabs.forEach((item) => item.classList.toggle("active", item === tab));
        applyFilters();
      });
    }

    search.addEventListener("input", applyFilters);
  </script>
</body>
</html>`;

await fs.writeFile(outputPath, html.replace(/[ \t]+$/gm, ""), "utf8");

console.log(`HTML report saved to ${outputPath}`);
