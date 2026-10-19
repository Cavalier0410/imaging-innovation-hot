import crypto from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const isFailure = args.has("--failure");
const isDigest = args.has("--digest");
const isDryRun = args.has("--dry-run");

const webhook = process.env.FEISHU_WEBHOOK;
const secret = process.env.FEISHU_SECRET;
const siteUrl = (process.env.SITE_URL || "https://camera.lts4ai.com").replace(/\/$/, "");
const minScore = Number(process.env.FEISHU_MIN_SCORE || (isDigest ? 0 : 80));
const limit = Number(process.env.FEISHU_LIMIT || (isDigest ? 10 : 5));
const fallbackWindowHours = Number(process.env.FEISHU_WINDOW_HOURS || 12);

const statePath = path.join(process.cwd(), "data", "notify-state.json");
const dataPath = path.join(process.cwd(), "data", "innovation-projects.json");

function sign(timestamp) {
  const stringToSign = `${timestamp}\n${secret}`;
  return crypto.createHmac("sha256", stringToSign).update("").digest("base64");
}

function card(payload) {
  const body = { msg_type: "interactive", card: payload };

  if (secret) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    body.timestamp = timestamp;
    body.sign = sign(timestamp);
  }

  return body;
}

async function post(body) {
  if (!webhook) {
    console.log("FEISHU_WEBHOOK not set; skipping Feishu notification.");
    return false;
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Feishu webhook HTTP ${response.status}: ${text}`);
  }

  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (parsed && parsed.code && parsed.code !== 0) {
    throw new Error(`Feishu webhook error: ${text}`);
  }

  console.log("Feishu notification sent.");
  return true;
}

function runUrl() {
  const server = process.env.GITHUB_SERVER_URL || "https://github.com";
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  if (!repo || !runId) return null;
  return `${server}/${repo}/actions/runs/${runId}`;
}

function shanghaiStamp() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());
}

function projectLine(project, index) {
  const title = project.titleZh || project.title || "未命名项目";
  const link = project.url || project.normalizedUrl || siteUrl;
  const source = project.source?.name || project.references?.[0]?.source || "";
  const meta = [project.projectCategory, project.projectStage, source].filter(Boolean).join(" · ");
  const score = Number(project.innovationScore || 0);
  return `**${index + 1}. ${score} 分** [${title}](${link})\n${meta}`;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

if (isFailure) {
  const url = runUrl();
  if (isDryRun) {
    console.log("DRY RUN: failure alert");
  } else {
    await post(
      card({
        config: { wide_screen_mode: true },
        header: {
          template: "red",
          title: { tag: "plain_text", content: "影像雷达 · 构建失败" }
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: [
                `**时间**：${new Date().toISOString()}`,
                url ? `**运行记录**：[打开 Actions](${url})` : null,
                "页面仍是上一次成功构建的版本，请检查 RSS 源或构建日志。"
              ]
                .filter(Boolean)
                .join("\n")
            }
          }
        ]
      })
    );
  }
  process.exit(0);
}

const data = await readJson(dataPath, null);
if (!data) {
  console.log("No project data to notify; skipping.");
  process.exit(0);
}

let fresh;

if (isDigest) {
  const state = await readJson(statePath, {});
  const since = state.lastDigestAt
    ? new Date(state.lastDigestAt)
    : new Date(Date.now() - fallbackWindowHours * 60 * 60 * 1000);

  fresh = (data.projects || [])
    .filter((project) => project.firstSeenAt && new Date(project.firstSeenAt) > since)
    .filter((project) => Number(project.innovationScore || 0) >= minScore)
    .sort((a, b) => {
      const score = Number(b.innovationScore || 0) - Number(a.innovationScore || 0);
      if (score !== 0) return score;
      return new Date(b.firstSeenAt || 0) - new Date(a.firstSeenAt || 0);
    });

  console.log(
    `Digest window since ${since.toISOString()}: ${fresh.length} new project(s)` +
      (isDryRun ? " (dry run)" : "")
  );
} else {
  const runStamp = data.generatedAt;
  fresh = (data.projects || [])
    .filter((project) => project.firstSeenAt && project.firstSeenAt === runStamp)
    .filter((project) => Number(project.innovationScore || 0) >= minScore)
    .sort((a, b) => Number(b.innovationScore || 0) - Number(a.innovationScore || 0));
}

if (fresh.length === 0) {
  console.log("No new projects above threshold; skipping Feishu notification.");
  process.exit(0);
}

const top = fresh.slice(0, limit);
const intro = isDigest
  ? `**${shanghaiStamp()} 汇总** · 自上次推送以来的新项目`
  : "本次构建新增的项目";
const more = fresh.length > top.length ? `\n\n还有 ${fresh.length - top.length} 个，去项目库看全部。` : "";
const content = `${intro}\n\n${top.map(projectLine).join("\n\n")}`;

const payload = card({
  config: { wide_screen_mode: true },
  header: {
    template: "blue",
    title: { tag: "plain_text", content: `影像雷达 · 新增 ${fresh.length} 个创新项目` }
  },
  elements: [
    { tag: "div", text: { tag: "lark_md", content } },
    {
      tag: "div",
      text: {
        tag: "lark_md",
        content: `${more}\n\n[打开创新影像产品项目库](${siteUrl}/) · [行业 Hot 报告](${siteUrl}/hot.html)`
      }
    }
  ]
});

if (isDryRun) {
  console.log(`DRY RUN: would send ${top.length}/${fresh.length} item(s).`);
  console.log(JSON.stringify(payload).slice(0, 2000));
  process.exit(0);
}

await post(payload);

if (isDigest) {
  await writeFile(
    statePath,
    JSON.stringify(
      {
        lastDigestAt: new Date().toISOString(),
        lastCount: fresh.length
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(`Updated data/notify-state.json (${fresh.length} sent).`);
}
