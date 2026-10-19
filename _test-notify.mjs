import http from "node:http";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const script = "D:/探索/imaging-innovation-hot/scripts/notify-feishu.mjs";
const source = JSON.parse(await readFile("data/innovation-projects.json", "utf8"));
source.projects.slice(0, 3).forEach((project, index) => {
  project.firstSeenAt = new Date().toISOString();
  project.innovationScore = 95 - index;
});

const dir = await mkdtemp(path.join(os.tmpdir(), "notify-test-"));
await mkdir(path.join(dir, "data"), { recursive: true });
await writeFile(path.join(dir, "data", "innovation-projects.json"), JSON.stringify(source));

let received = null;
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    received = body;
    res.setHeader("content-type", "application/json");
    res.end('{"code":0,"msg":"success"}');
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

process.chdir(dir);
process.env.FEISHU_WEBHOOK = `http://127.0.0.1:${port}/hook`;
delete process.env.FEISHU_SECRET;
await import(pathToFileURL(script).href);
await new Promise((resolve) => setTimeout(resolve, 200));
server.close();

const payload = JSON.parse(received);
console.log("msg_type:", payload.msg_type);
console.log("header:", payload.card.header.title.content);
const lines = payload.card.elements[0].text.content.split("\n\n");
console.log("items in card:", lines.length);
console.log("first line:", lines[0].slice(0, 120));
console.log("has sign:", Boolean(payload.sign));

process.env.FEISHU_SECRET = "test-secret";
received = null;
const server2 = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    received = body;
    res.end('{"code":0}');
  });
});
await new Promise((resolve) => server2.listen(0, "127.0.0.1", resolve));
process.env.FEISHU_WEBHOOK = `http://127.0.0.1:${server2.address().port}/hook`;
await import(pathToFileURL(script).href + "?v=2");
await new Promise((resolve) => setTimeout(resolve, 200));
server2.close();

const signed = JSON.parse(received);
console.log("signed timestamp:", signed.timestamp, "sign length:", signed.sign.length);
