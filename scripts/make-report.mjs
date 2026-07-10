import fs from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve("data");
const outputPath = path.join(dataDir, "imaging-hot-report.md");

async function readJsonPrefer(preferred, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(dataDir, preferred), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return JSON.parse(await fs.readFile(path.join(dataDir, fallback), "utf8"));
  }
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

function itemLine(item, index) {
  const time = formatDate(item.publishedAt || item.latestAt);
  const source = item.source?.name || item.source || "Unknown";
  const meta = [source, time].filter(Boolean).join(" · ");
  const title = item.titleZh || item.title;
  const summary = item.summaryZh || "";
  return `${index}. **${title}**  \n   ${meta}${summary ? `  \n   ${summary}` : ""}  \n   ${item.url}`;
}

const [topicsData, selectedData, reportData] = await Promise.all([
  readJsonPrefer("hot-topics.zh.json", "hot-topics.json"),
  readJsonPrefer("items.selected.zh.json", "items.selected.json"),
  fs.readFile(path.join(dataDir, "dedupe-report.json"), "utf8").then(JSON.parse)
]);

const topics = topicsData.items || [];
const selected = selectedData.items || [];
const groups = new Map();

for (const item of selected) {
  const category = item.source?.category || "其他";
  if (!groups.has(category)) groups.set(category, []);
  groups.get(category).push(item);
}

const lines = [];
lines.push(`# 影像产品 Hot`);
lines.push("");
lines.push(`生成时间：${formatDate(reportData.generatedAt)}`);
lines.push("");
lines.push(`原始内容 ${reportData.rawItemCount} 条，全量池 ${reportData.allCount} 条，精选池 ${reportData.selectedCount} 条，热点 ${reportData.hotTopicCount} 个。`);
lines.push("");
lines.push("## 当前热点");
lines.push("");

for (const [index, topic] of topics.slice(0, 12).entries()) {
  lines.push(`${index + 1}. **${topic.titleZh || topic.title}**  `);
  const topicMeta = [...new Set([topic.direction, topic.category, topic.source].filter(Boolean))].join(" · ");
  lines.push(`   ${topicMeta} · ${topic.sourceCount} 个来源 · ${topic.itemCount} 条相关内容 · 新兴度 ${topic.emergingScore || "-"} · 分数 ${topic.score}  `);
  lines.push(`   ${topic.url}`);
}

lines.push("");
lines.push("## 分组精选");
lines.push("");

let globalIndex = 1;
for (const [category, items] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
  lines.push(`### ${category}`);
  lines.push("");
  for (const item of items.slice(0, 8)) {
    lines.push(itemLine(item, globalIndex));
    globalIndex += 1;
  }
  lines.push("");
}

await fs.writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");

console.log(`Report saved to ${outputPath}`);
console.log("");
console.log(lines.slice(0, 42).join("\n"));
