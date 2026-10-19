import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const webhook = process.env.FEISHU_WEBHOOK;
const secret = process.env.FEISHU_SECRET;
const siteUrl = (process.env.SITE_URL || "https://camera.lts4ai.com").replace(/\/$/, "");
const isFailure = process.argv.includes("--failure");
const limit = Number(process.env.FEISHU_LIMIT || 5);
const minScore = Number(process.env.FEISHU_MIN_SCORE || 80);
const windowMinutes = Number(process.env.FEISHU_WINDOW_MINUTES || 100);

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
    return;
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
}

function runUrl() {
  const server = process.env.GITHUB_SERVER_URL || "https://github.com";
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  if (!repo || !runId) return null;
  return `${server}/${repo}/actions/runs/${runId}`;
}

if (isFailure) {
  const url = runUrl();
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
  process.exit(0);
}

const dataPath = path.join(process.cwd(), "data", "innovation-projects.json");
let data;
try {
  data = JSON.parse(await readFile(dataPath, "utf8"));
} catch (error) {
  console.log(`No project data to notify (${error.message}); skipping.`);
  process.exit(0);
}

const cutoff = Date.now() - windowMinutes * 60 * 1000;
const fresh = (data.projects || [])
  .filter((project) => project.firstSeenAt && new Date(project.firstSeenAt).getTime() >= cutoff)
  .filter((project) => Number(project.innovationScore || 0) >= minScore)
  .sort((a, b) => Number(b.innovationScore || 0) - Number(a.innovationScore || 0));

if (fresh.length === 0) {
  console.log("No new projects above threshold; skipping Feishu notification.");
  process.exit(0);
}

const top = fresh.slice(0, limit);
const lines = top.map((project, index) => {
  const title = project.titleZh || project.title || "未命名项目";
  const link = project.url || project.normalizedUrl || siteUrl;
  const source = project.source?.name || project.references?.[0]?.source || "";
  const meta = [project.projectCategory, project.projectStage, source].filter(Boolean).join(" · ");
  return `**${index + 1}. ${Number(project.innovationScore || 0)} 分** [${title}](${link})\n${meta}`;
});

const more = fresh.length > top.length ? `\n\n还有 ${fresh.length - top.length} 个新项目，去项目库看全部。` : "";

await post(
  card({
    config: { wide_screen_mode: true },
    header: {
      template: "blue",
      title: { tag: "plain_text", content: `影像雷达 · 新增 ${fresh.length} 个创新项目` }
    },
    elements: [
      { tag: "div", text: { tag: "lark_md", content: lines.join("\n\n") } },
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `${more}\n\n[打开创新影像产品项目库](${siteUrl}/) · [行业 Hot 报告](${siteUrl}/hot.html)`
        }
      }
    ]
  })
);
