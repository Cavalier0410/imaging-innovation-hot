import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const siteUrl = (process.env.SITE_URL || "https://camera.lts4ai.com").replace(/\/$/, "");
const limit = Number(process.env.FEED_LIMIT || 60);
const root = process.cwd();
const dataPath = path.join(root, "data", "innovation-projects.json");
const outputPath = path.join(root, "data", "feed.xml");

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripTags(value = "") {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toRfc822(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
}

const data = JSON.parse(await readFile(dataPath, "utf8"));
const projects = [...(data.projects || [])]
  .sort((a, b) => {
    const left = new Date(b.firstSeenAt || b.publishedAt || 0).getTime();
    const right = new Date(a.firstSeenAt || a.publishedAt || 0).getTime();
    return left - right;
  })
  .slice(0, limit);

const items = projects
  .map((project) => {
    const title = project.titleZh || project.title || "未命名项目";
    const description = stripTags(project.summaryZh || project.summary || "").slice(0, 500);
    const link = project.url || project.normalizedUrl || `${siteUrl}/`;
    const pubDate = toRfc822(project.firstSeenAt || project.publishedAt);
    const categories = [project.projectCategory, project.projectStage, project.projectFormat]
      .filter(Boolean)
      .map((category) => `      <category>${escapeXml(category)}</category>`)
      .join("\n");

    return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(project.id || link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description)}</description>
${categories}
    </item>`;
  })
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>创新影像产品项目库</title>
    <link>${escapeXml(`${siteUrl}/`)}</link>
    <description>从 41 个中英文影像信源中筛出的创新影像产品项目，每小时更新。</description>
    <language>zh-CN</language>
    <lastBuildDate>${toRfc822(data.generatedAt)}</lastBuildDate>
    <atom:link href="${escapeXml(`${siteUrl}/feed.xml`)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>
`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, xml, "utf8");
console.log(`Wrote ${projects.length} items to data/feed.xml.`);
