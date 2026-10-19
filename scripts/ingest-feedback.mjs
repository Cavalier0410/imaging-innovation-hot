import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const feedbackPath = path.join(root, "data", "feedback.json");
const projectsPath = path.join(root, "data", "innovation-projects.json");

const issueNumber = Number(process.env.ISSUE_NUMBER || 0);
const body = process.env.ISSUE_BODY || "";
const repo = process.env.GITHUB_REPOSITORY || "Cavalier0410/imaging-innovation-hot";
const dryRun = process.env.DRY_RUN === "1" || process.argv.includes("--dry-run");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function git(args) {
  execFileSync("git", args, { stdio: "inherit" });
}

if (!issueNumber) fail("Missing ISSUE_NUMBER.");
if (!body.trim()) fail("Empty issue body.");

const idMatch = body.match(/项目\s*ID\s*[:：]\s*([A-Za-z0-9]+)/i);
const scoreMatch = body.match(/我的评分[^\n:：]*[:：]\s*(\d{1,3})/);
const noteMatch = body.match(/备注[^\n:：]*[:：]\s*([^\n]*)/);
const machineMatch = body.match(/机器分[^\n:：]*[:：]\s*(\d{1,3})/);

if (!idMatch) fail("No project id found in issue body.");
if (!scoreMatch) fail("No score found in issue body (expected `我的评分（0-100）: 65`).");

const projectId = idMatch[1];
const userScore = Number(scoreMatch[1]);
const machineScore = machineMatch ? Number(machineMatch[1]) : null;
const note = noteMatch ? noteMatch[1].trim() : "";

if (!Number.isInteger(userScore) || userScore < 0 || userScore > 100) {
  fail(`Score out of range: ${scoreMatch[1]}`);
}

const feedback = JSON.parse(await readFile(feedbackPath, "utf8").catch(() => '{"items":[]}'));
const projects = JSON.parse(await readFile(projectsPath, "utf8").catch(() => '{"projects":[]}'));
const project = (projects.projects || []).find((item) => item.id === projectId);
const baseScore = project ? Number(project.baseScore ?? project.innovationScore ?? 0) : machineScore;

const record = {
  issue: issueNumber,
  projectId,
  projectTitle: project?.titleZh || project?.title || "",
  userScore,
  baseScore,
  machineScore,
  note,
  createdAt: new Date().toISOString()
};

const items = Array.isArray(feedback.items) ? feedback.items : [];
const existing = items.findIndex((item) => item.issue === issueNumber || item.projectId === projectId);
if (existing >= 0) items[existing] = record;
else items.push(record);

const next = { generatedAt: new Date().toISOString(), items };
await writeFile(feedbackPath, JSON.stringify(next, null, 2), "utf8");
console.log(`Recorded ${projectId}: user ${userScore}, base ${baseScore}, issue #${issueNumber}.`);

if (dryRun) {
  console.log("DRY RUN: skipping git and issue updates.");
  process.exit(0);
}

git(["add", "data/feedback.json"]);
const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" });
if (status.trim()) {
  git(["commit", "-m", `chore: record score feedback #${issueNumber}`]);
  git(["pull", "--rebase", "--autostash"]);
  git(["push"]);
}

const comment = [
  `已记录：**${record.projectTitle || projectId}**`,
  "",
  `- 你的评分：**${userScore}**`,
  `- 机器分：**${baseScore ?? "未知"}**`,
  note ? `- 备注：${note}` : null,
  "",
  "下周一 10:00 的校准会把它计入评分体系。"
]
  .filter((line) => line !== null)
  .join("\n");

execFileSync(
  "gh",
  ["issue", "comment", String(issueNumber), "--repo", repo, "--body", comment],
  { stdio: "inherit" }
);
execFileSync(
  "gh",
  ["issue", "edit", String(issueNumber), "--repo", repo, "--add-label", "recorded"],
  { stdio: "inherit" }
);
execFileSync("gh", ["issue", "close", String(issueNumber), "--repo", repo], { stdio: "inherit" });
