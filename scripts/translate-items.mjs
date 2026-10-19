import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve("data");
const cachePath = path.join(dataDir, "translation-cache.json");
const selectedPath = path.join(dataDir, "items.selected.json");
const topicsPath = path.join(dataDir, "hot-topics.json");
const selectedZhPath = path.join(dataDir, "items.selected.zh.json");
const topicsZhPath = path.join(dataDir, "hot-topics.zh.json");
const concurrency = Number(process.env.TRANSLATE_CONCURRENCY || 3);
const maxSummaryLength = Number(process.env.TRANSLATE_SUMMARY_CHARS || 520);
const googleFailureLimit = Number(process.env.TRANSLATE_GOOGLE_FAILURE_LIMIT || 5);
let googleTranslationAvailable = true;
let googleConsecutiveFailures = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sha1(value) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

function hasEnoughChinese(value) {
  const text = String(value || "").replace(/\s+/g, "");
  if (!text) return true;
  const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  return cjk / text.length > 0.45;
}

function clean(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function loadCache() {
  return readJson(cachePath, {});
}

async function saveCache(cache) {
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), "utf8");
}

async function requestGoogleTranslation(text) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "auto");
  url.searchParams.set("tl", "zh-CN");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 AIHOT-Lite Translator/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`Google translate HTTP ${response.status}`);
  }

  const payload = await response.json();
  return clean((payload?.[0] || []).map((part) => part?.[0] || "").join(""));
}

async function translateByGoogle(text) {
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const translated = await requestGoogleTranslation(text);
      googleConsecutiveFailures = 0;
      return translated;
    } catch (error) {
      lastError = error;
      const retryable = /HTTP (429|5\d\d)/.test(error.message);
      if (!retryable || attempt === 1) break;
      await sleep(1200 + attempt * 1800);
    }
  }

  googleConsecutiveFailures += 1;
  if (googleConsecutiveFailures >= googleFailureLimit) {
    googleTranslationAvailable = false;
  }

  throw lastError;
}

function resolveTranslationBackend() {
  const baseUrlOverride = process.env.OPENAI_BASE_URL;
  const modelOverride = process.env.OPENAI_TRANSLATE_MODEL || process.env.TRANSLATE_MODEL;

  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: baseUrlOverride || "https://api.openai.com/v1",
      model: modelOverride || "gpt-4o-mini"
    };
  }

  if (process.env.DEEPSEEK_API_KEY) {
    return {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: baseUrlOverride || "https://api.deepseek.com/v1",
      model: modelOverride || "deepseek-chat"
    };
  }

  if (process.env.SILICONFLOW_API_KEY) {
    return {
      apiKey: process.env.SILICONFLOW_API_KEY,
      baseUrl: baseUrlOverride || "https://api.siliconflow.cn/v1",
      model: modelOverride || "Qwen/Qwen2.5-7B-Instruct"
    };
  }

  if (process.env.DASHSCOPE_API_KEY) {
    return {
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseUrl: baseUrlOverride || "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: modelOverride || "qwen-turbo"
    };
  }

  return null;
}

async function translateByOpenAI(text) {
  const backend = resolveTranslationBackend();
  if (!backend) return null;

  const { apiKey, baseUrl, model } = backend;

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "你是影像行业资讯编辑。把英文标题或摘要翻译成简洁自然的中文，保留品牌、型号、镜头规格、卡口、价格和专有名词。只输出译文。"
        },
        { role: "user", content: text }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI-compatible translate HTTP ${response.status}`);
  }

  const payload = await response.json();
  return clean(payload?.choices?.[0]?.message?.content || "");
}

async function translateText(text, cache) {
  const value = clean(text);
  if (!value || hasEnoughChinese(value)) return value;

  const key = sha1(value);
  if (cache[key]) return cache[key];

  let translated = null;
  try {
    translated = await translateByOpenAI(value);
  } catch (error) {
    console.warn(`Model translation failed, falling back: ${error.message}`);
  }

  if (!translated && googleTranslationAvailable) {
    try {
      translated = await translateByGoogle(value);
    } catch (error) {
      if (googleTranslationAvailable) {
        console.warn(`Google translation failed, keeping source text: ${error.message}`);
      } else {
        console.warn(`Google translation disabled for this run after repeated failures: ${error.message}`);
      }
    }
  }

  if (translated) {
    cache[key] = translated;
    return translated;
  }

  return value;
}

async function mapLimit(values, limit, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < values.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(values[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

const [selectedData, topicsData, cache] = await Promise.all([
  readJson(selectedPath, { generatedAt: null, items: [] }),
  readJson(topicsPath, { generatedAt: null, items: [] }),
  loadCache()
]);

let translatedCount = 0;

const selectedItems = await mapLimit(selectedData.items || [], concurrency, async (item) => {
  const titleZh = await translateText(item.title, cache);
  const summarySource = item.summary ? item.summary.slice(0, maxSummaryLength) : "";
  const summaryZh = summarySource ? await translateText(summarySource, cache) : "";
  if (titleZh !== item.title || summaryZh !== summarySource) translatedCount += 1;
  return {
    ...item,
    titleZh,
    summaryZh
  };
});

const topicItems = await mapLimit(topicsData.items || [], concurrency, async (topic) => {
  const titleZh = await translateText(topic.title, cache);
  if (titleZh !== topic.title) translatedCount += 1;
  return {
    ...topic,
    titleZh
  };
});

await Promise.all([
  fs.writeFile(selectedZhPath, JSON.stringify({ ...selectedData, items: selectedItems }, null, 2), "utf8"),
  fs.writeFile(topicsZhPath, JSON.stringify({ ...topicsData, items: topicItems }, null, 2), "utf8"),
  saveCache(cache)
]);

console.log(`Translated/loaded ${selectedItems.length} selected items and ${topicItems.length} hot topics.`);
console.log(`Changed this run: ${translatedCount}`);
console.log(`Saved ${selectedZhPath}`);
console.log(`Saved ${topicsZhPath}`);
