import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";

const sourcePath = path.resolve(process.env.AIHOT_SOURCES_FILE || "sources/imaging-products-rss.json");
const outputDir = path.resolve("data");
const rawItemsPath = path.join(outputDir, "items.raw.json");
const itemsPath = path.join(outputDir, "items.latest.json");
const reportPath = path.join(outputDir, "fetch-report.json");
const timeoutMs = Number(process.env.FEED_TIMEOUT_MS || 12000);
const concurrency = Number(process.env.FEED_CONCURRENCY || 8);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  cdataPropName: "#cdata",
  trimValues: true
});

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(" ");
  if (typeof value === "object") {
    return text(value["#cdata"] ?? value["#text"] ?? value._ ?? Object.values(value));
  }
  return "";
}

function stripHtml(value) {
  return decodeEntities(text(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function getAtomLink(link) {
  const links = asArray(link);
  const alternate = links.find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    return !entry["@rel"] || entry["@rel"] === "alternate";
  });
  const selected = alternate ?? links[0];
  if (!selected) return "";
  if (typeof selected === "string") return selected;
  return selected["@href"] ?? text(selected);
}

function normalizeUrl(value) {
  const url = text(value).trim();
  if (!url) return "";

  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function parseDate(value) {
  const raw = text(value).trim();
  if (!raw) return null;
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? raw : new Date(timestamp).toISOString();
}

function itemId(sourceId, url, title) {
  return crypto
    .createHash("sha1")
    .update(`${sourceId}|${url || ""}|${title || ""}`)
    .digest("hex");
}

function parseFeed(xml, source) {
  const data = parser.parse(xml);
  const rssChannel = data.rss?.channel;
  const atomFeed = data.feed;
  const rdfFeed = data["rdf:RDF"];

  let rawItems = [];
  if (rssChannel?.item) rawItems = asArray(rssChannel.item);
  else if (atomFeed?.entry) rawItems = asArray(atomFeed.entry);
  else if (rdfFeed?.item) rawItems = asArray(rdfFeed.item);

  return rawItems
    .map((entry) => {
      const title = stripHtml(entry.title);
      const url = normalizeUrl(entry.link?.["@href"] ?? getAtomLink(entry.link) ?? entry.guid);
      const publishedAt = parseDate(
        entry.pubDate ??
          entry.published ??
          entry.updated ??
          entry["dc:date"] ??
          entry["atom:published"] ??
          entry["atom:updated"]
      );
      const summary = stripHtml(
        entry.description ??
          entry.summary ??
          entry.content ??
          entry["content:encoded"] ??
          entry["media:description"]
      ).slice(0, 1200);

      return {
        id: itemId(source.id, url, title),
        title,
        url,
        summary,
        publishedAt,
        fetchedAt: new Date().toISOString(),
        source: {
          id: source.id,
          name: source.name,
          category: source.category,
          priority: source.priority,
          language: source.language,
          region: source.region
        }
      };
    })
    .filter((item) => item.title && item.url);
}

async function fetchSource(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(source.feedUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "AIHOT-Lite Feed Fetcher/0.1"
      }
    });
    const xml = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const items = parseFeed(xml, source);
    return {
      ok: true,
      sourceId: source.id,
      sourceName: source.name,
      feedUrl: source.feedUrl,
      itemCount: items.length,
      items
    };
  } catch (error) {
    return {
      ok: false,
      sourceId: source.id,
      sourceName: source.name,
      feedUrl: source.feedUrl,
      itemCount: 0,
      error: error.message || error.name || String(error),
      items: []
    };
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit(values, limit, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < values.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(values[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker())
  );
  return results;
}

const sourceFile = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const startedAt = new Date().toISOString();
const results = await mapLimit(sourceFile.sources, concurrency, fetchSource);
const items = results.flatMap((result) => result.items).sort((a, b) => {
  const left = Date.parse(a.publishedAt || 0) || 0;
  const right = Date.parse(b.publishedAt || 0) || 0;
  return right - left;
});

const report = {
  startedAt,
  finishedAt: new Date().toISOString(),
  sourceCount: sourceFile.sources.length,
  okSourceCount: results.filter((result) => result.ok).length,
  failedSourceCount: results.filter((result) => !result.ok).length,
  rawItemCount: results.reduce((sum, result) => sum + result.itemCount, 0),
  savedItemCount: items.length,
  results: results.map(({ items: _items, ...result }) => result)
};

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(rawItemsPath, JSON.stringify({ generatedAt: report.finishedAt, items }, null, 2));
await fs.writeFile(itemsPath, JSON.stringify({ generatedAt: report.finishedAt, items }, null, 2));
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

console.log(`Fetched ${report.rawItemCount} raw items from ${report.okSourceCount}/${report.sourceCount} sources.`);
console.log(`Saved ${report.savedItemCount} raw items to ${rawItemsPath}.`);
if (report.failedSourceCount > 0) {
  console.log(`Needs attention: ${report.failedSourceCount} source(s). See ${reportPath}.`);
  process.exitCode = 1;
}
