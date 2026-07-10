import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve(process.env.AIHOT_SOURCES_FILE || "sources/imaging-products-rss.json");
const sourceFile = JSON.parse(await fs.readFile(sourcePath, "utf8"));

const timeoutMs = Number(process.env.FEED_TIMEOUT_MS || 12000);

function stripXml(text) {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFeedTitle(xml) {
  const match = xml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripXml(match[1]).slice(0, 90) : "";
}

function looksLikeFeed(xml) {
  const head = xml.slice(0, 8000);
  return /<(rss|feed|rdf:RDF|channel|item|entry)\b/i.test(head);
}

async function checkSource(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(source.feedUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "AIHOT-Lite RSS Checker/0.1"
      }
    });
    const text = await response.text();
    const itemCount = (text.match(/<(item|entry)\b/gi) || []).length;
    const ok = response.ok && looksLikeFeed(text) && itemCount > 0;

    return {
      source,
      ok,
      status: response.status,
      itemCount,
      title: extractFeedTitle(text)
    };
  } catch (error) {
    return {
      source,
      ok: false,
      status: error.name || "ERROR",
      itemCount: 0,
      title: ""
    };
  } finally {
    clearTimeout(timer);
  }
}

const results = [];
for (const source of sourceFile.sources) {
  results.push(await checkSource(source));
}

const okCount = results.filter((result) => result.ok).length;
const badCount = results.length - okCount;

console.log(`${sourceFile.name}`);
console.log(`Checked: ${new Date().toISOString()}`);
console.log(`OK: ${okCount} / ${results.length}, needs attention: ${badCount}`);
console.log("");

for (const result of results) {
  const mark = result.ok ? "OK " : "BAD";
  const source = result.source;
  const title = result.title ? ` | ${result.title}` : "";
  console.log(
    `${mark} | ${source.priority} | ${source.category} | ${source.name} | ${result.status} | ${result.itemCount} items | ${source.feedUrl}${title}`
  );
}

if (badCount > 0) {
  process.exitCode = 1;
}
