import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const inputPath = path.resolve(process.env.AIHOT_ITEMS_INPUT || "data/items.raw.json");
const fallbackInputPath = path.resolve("data/items.latest.json");
const outputDir = path.resolve("data");
const allItemsPath = path.join(outputDir, "items.all.json");
const selectedItemsPath = path.join(outputDir, "items.selected.json");
const clustersPath = path.join(outputDir, "clusters.latest.json");
const hotTopicsPath = path.join(outputDir, "hot-topics.json");
const reportPath = path.join(outputDir, "dedupe-report.json");

const sourcePriorityScore = {
  P0: 30,
  P1: 18,
  P2: 8
};

const sourceCategoryBaseline = [
  [/新兴产品/i, 72],
  [/相机|镜头评测|品牌爆料|电影机|视频器材|无人机|运动影像/i, 74],
  [/影像综合/i, 58],
  [/中文影像/i, 38]
];

const traditionalMajorTerms = [
  "canon",
  "nikon",
  "sony",
  "fujifilm",
  "fuji",
  "panasonic",
  "leica",
  "hasselblad",
  "佳能",
  "尼康",
  "索尼",
  "富士",
  "松下",
  "徕卡",
  "哈苏"
];

const emergingBrandTerms = [
  "viltrox",
  "laowa",
  "sirui",
  "samyang",
  "rokinon",
  "ttartisan",
  "7artisans",
  "meike",
  "brightin star",
  "sg-image",
  "venus optics",
  "freewell",
  "moment",
  "peak design",
  "smallrig",
  "tilta",
  "ulanzi",
  "zhiyun",
  "moza",
  "insta360",
  "gopro",
  "dji",
  "obsbot",
  "hoverair",
  "xreal",
  "ray-ban meta",
  "blackmagic",
  "kinefinity",
  "atomos",
  "luminar",
  "topaz",
  "photoroom",
  "runway",
  "kling",
  "luma",
  "midjourney",
  "ideogram",
  "magnific",
  "capcut",
  "descript",
  "screen studio",
  "kadoink",
  "orbit",
  "唯卓仕",
  "老蛙",
  "思锐",
  "美科",
  "铭匠",
  "七工匠",
  "影石",
  "大疆",
  "智云",
  "魔爪",
  "小隼",
  "奥川",
  "浩瀚",
  "阿童木",
  "小蚁",
  "灵眸",
  "可灵",
  "剪映"
];

const emergingDirectionTerms = [
  "kickstarter",
  "crowdfunding",
  "preorder",
  "pre-order",
  "coming soon",
  "teaser",
  "prototype",
  "startup",
  "indie",
  "compact",
  "pocket",
  "portable",
  "modular",
  "creator",
  "content creator",
  "vlogging",
  "ai camera",
  "ai device",
  "ai video",
  "ai photo",
  "generative",
  "text-to-video",
  "image-to-video",
  "computational photography",
  "action camera",
  "360 camera",
  "drone",
  "smart glasses",
  "camera glasses",
  "ar headset",
  "vr headset",
  "spatial computing",
  "vision pro",
  "projector",
  "birdwatching",
  "movie night",
  "phone-sized",
  "wireless",
  "app",
  "app-based",
  "launch",
  "announced",
  "unveiled",
  "众筹",
  "预订",
  "预售",
  "即将推出",
  "预热",
  "原型",
  "小团队",
  "创业",
  "便携",
  "口袋",
  "模块化",
  "创作者",
  "内容创作者",
  "vlog",
  "AI 相机",
  "AI 硬件",
  "AI 设备",
  "AI影像",
  "AI 视频",
  "生成式",
  "文生视频",
  "图生视频",
  "计算摄影",
  "运动相机",
  "全景相机",
  "无人机",
  "智能眼镜",
  "拍摄眼镜",
  "AR 头显",
  "VR 头显",
  "空间计算",
  "投影仪",
  "观鸟",
  "手机大小",
  "无线",
  "应用",
  "カメラ",
  "写真",
  "レンズ",
  "撮影",
  "映像",
  "ビデオ",
  "フォト",
  "クラウドファンディング"
];

const domainTerms = [
  "camera",
  "cameras",
  "lens",
  "lenses",
  "mirrorless",
  "dslr",
  "compact camera",
  "cinema camera",
  "camcorder",
  "cine",
  "cinematography",
  "photography",
  "photographer",
  "filmmaking",
  "full-frame",
  "full frame",
  "aps-c",
  "medium format",
  "micro four thirds",
  "mft",
  "sensor",
  "cmos",
  "stacked sensor",
  "global shutter",
  "rolling shutter",
  "autofocus",
  "auto focus",
  "ibis",
  "stabilization",
  "image stabilization",
  "firmware",
  "mount",
  "lens mount",
  "raw",
  "log",
  "lut",
  "codec",
  "open gate",
  "shutter",
  "aperture",
  "focal length",
  "telephoto",
  "wide-angle",
  "prime lens",
  "zoom lens",
  "macro lens",
  "nd filter",
  "filter",
  "tripod",
  "gimbal",
  "stabilizer",
  "monitor",
  "recorder",
  "lighting",
  "flash",
  "memory card",
  "cfexpress",
  "sd card",
  "drone",
  "smart glasses",
  "camera glasses",
  "ar headset",
  "vr headset",
  "spatial computing",
  "vision pro",
  "projector",
  "birdwatching",
  "ai device",
  "ai video",
  "ai image",
  "ai photo",
  "generative video",
  "text-to-video",
  "image-to-video",
  "video editing",
  "photo editing",
  "creator tool",
  "creator tools",
  "action camera",
  "360 camera",
  "vlogging",
  "content creator",
  "color grading",
  "lightroom",
  "photoshop",
  "capture one",
  "davinci resolve",
  "blackmagic",
  "canon",
  "nikon",
  "sony",
  "fujifilm",
  "fuji",
  "panasonic",
  "lumix",
  "leica",
  "hasselblad",
  "sigma",
  "tamron",
  "om system",
  "olympus",
  "ricoh",
  "pentax",
  "zeiss",
  "viltrox",
  "laowa",
  "sirui",
  "samyang",
  "rokinon",
  "ttartisan",
  "7artisans",
  "insta360",
  "gopro",
  "dji",
  "obsbot",
  "hoverair",
  "xreal",
  "atomos",
  "smallrig",
  "tilta",
  "arri",
  "red camera",
  "kinefinity",
  "esp32",
  "camera module",
  "camera system",
  "periscope camera",
  "telephoto camera",
  "相机",
  "照相机",
  "微单",
  "单反",
  "无反",
  "旁轴",
  "卡片机",
  "紧凑相机",
  "中画幅",
  "全画幅",
  "半画幅",
  "APS-C",
  "M43",
  "镜头",
  "变焦",
  "定焦",
  "广角",
  "长焦",
  "超长焦",
  "微距",
  "卡口",
  "传感器",
  "CMOS",
  "堆栈式",
  "全局快门",
  "自动对焦",
  "对焦",
  "防抖",
  "固件",
  "快门",
  "光圈",
  "焦段",
  "RAW",
  "Log",
  "LUT",
  "编码",
  "编解码",
  "电影机",
  "摄像机",
  "摄影机",
  "摄影",
  "拍摄",
  "视频",
  "影像",
  "人像",
  "风光",
  "云台",
  "稳定器",
  "监视器",
  "录机",
  "灯光",
  "闪光灯",
  "滤镜",
  "三脚架",
  "存储卡",
  "无人机",
  "智能眼镜",
  "拍摄眼镜",
  "AR 头显",
  "VR 头显",
  "空间计算",
  "投影仪",
  "观鸟",
  "AI 硬件",
  "AI 设备",
  "运动相机",
  "全景相机",
  "航拍",
  "后期",
  "调色",
  "佳能",
  "尼康",
  "索尼",
  "富士",
  "松下",
  "徕卡",
  "哈苏",
  "适马",
  "腾龙",
  "奥之心",
  "奥林巴斯",
  "理光",
  "宾得",
  "蔡司",
  "唯卓仕",
  "老蛙",
  "思锐",
  "大疆",
  "影石",
  "GoPro",
  "阿童木",
  "小隼",
  "智云",
  "魔爪",
  "手机",
  "影像旗舰",
  "长焦",
  "潜望",
  "カメラ",
  "写真",
  "レンズ",
  "撮影",
  "映像",
  "ビデオ",
  "フォト"
];

const strictProductTerms = [
  "camera",
  "cameras",
  "lens",
  "lenses",
  "mirrorless",
  "dslr",
  "cinema camera",
  "camcorder",
  "sensor",
  "cmos",
  "global shutter",
  "autofocus",
  "firmware",
  "drone",
  "smart glasses",
  "camera glasses",
  "ar headset",
  "vr headset",
  "spatial computing",
  "vision pro",
  "projector",
  "birdwatching",
  "ai device",
  "ai video",
  "ai image",
  "ai photo",
  "generative video",
  "text-to-video",
  "image-to-video",
  "video editing",
  "photo editing",
  "creator tool",
  "creator tools",
  "action camera",
  "360 camera",
  "gimbal",
  "monitor",
  "recorder",
  "lightroom",
  "photoshop",
  "capture one",
  "davinci resolve",
  "blackmagic",
  "canon",
  "nikon",
  "sony",
  "fujifilm",
  "fuji",
  "panasonic",
  "lumix",
  "leica",
  "hasselblad",
  "sigma",
  "tamron",
  "om system",
  "olympus",
  "ricoh",
  "pentax",
  "zeiss",
  "viltrox",
  "laowa",
  "sirui",
  "samyang",
  "ttartisan",
  "7artisans",
  "insta360",
  "gopro",
  "dji",
  "atomos",
  "smallrig",
  "tilta",
  "obsbot",
  "hoverair",
  "xreal",
  "arri",
  "kinefinity",
  "相机",
  "微单",
  "单反",
  "无反",
  "镜头",
  "卡口",
  "全画幅",
  "中画幅",
  "传感器",
  "CMOS",
  "全局快门",
  "自动对焦",
  "对焦",
  "防抖",
  "固件",
  "电影机",
  "摄像机",
  "摄影机",
  "无人机",
  "智能眼镜",
  "拍摄眼镜",
  "AR 头显",
  "VR 头显",
  "空间计算",
  "投影仪",
  "观鸟",
  "AI 硬件",
  "AI 设备",
  "运动相机",
  "全景相机",
  "云台",
  "稳定器",
  "监视器",
  "录机",
  "佳能",
  "尼康",
  "索尼",
  "富士",
  "松下",
  "徕卡",
  "哈苏",
  "适马",
  "腾龙",
  "大疆",
  "影石"
];

const eventTerms = [
  "launch",
  "release",
  "announce",
  "unveil",
  "introduce",
  "ship",
  "update",
  "rumor",
  "rumored",
  "leak",
  "leaked",
  "review",
  "hands-on",
  "sample gallery",
  "comparison",
  "deal",
  "discount",
  "funding",
  "acquire",
  "partner",
  "发布",
  "推出",
  "宣布",
  "开源",
  "融资",
  "收购",
  "合作",
  "量产",
  "上市",
  "升级",
  "更新",
  "爆料",
  "传闻",
  "泄露",
  "评测",
  "上手",
  "样张",
  "对比",
  "降价",
  "优惠"
];

const negativeTerms = [
  "stock",
  "share buyback",
  "lawsuit",
  "dividend",
  "pharmaceutical",
  "clinical",
  "anthropic",
  "data center",
  "compute lease",
  "nyt connections",
  "connections hints",
  "lilbits",
  "wordle",
  "strands",
  "crossword",
  "streaming",
  "netflix",
  "movie",
  "movies",
  "tv show",
  "box office",
  "celebrity",
  "lawsuit",
  "politics",
  "shortcut",
  "shortcuts",
  "coupon",
  "coupons",
  "sale",
  "discount",
  "deal",
  "deals",
  "top 10",
  "most viewed",
  "how to",
  "guide",
  "tips",
  "tricks",
  "posing",
  "photographing fireworks",
  "股票",
  "回购",
  "股价",
  "基金",
  "药",
  "制药",
  "临床",
  "分红",
  "影视",
  "剧集",
  "票房",
  "明星",
  "小游戏",
  "政治",
  "数据中心",
  "算力",
  "租赁长约",
  "快捷指令",
  "独立宣言",
  "优惠",
  "折扣",
  "降价",
  "促销",
  "早报",
  "教程",
  "指南",
  "技巧",
  "拍摄技巧",
  "榜单"
];

const entityTerms = [
  "apple",
  "samsung",
  "nvidia",
  "sony",
  "canon",
  "nikon",
  "fujifilm",
  "fuji",
  "panasonic",
  "lumix",
  "leica",
  "hasselblad",
  "sigma",
  "tamron",
  "om system",
  "olympus",
  "ricoh",
  "pentax",
  "zeiss",
  "viltrox",
  "laowa",
  "sirui",
  "samyang",
  "rokinon",
  "ttartisan",
  "7artisans",
  "blackmagic",
  "arri",
  "red",
  "kinefinity",
  "dji",
  "insta360",
  "gopro",
  "atomos",
  "smallrig",
  "tilta",
  "iphone",
  "galaxy",
  "pixel",
  "苹果",
  "三星",
  "英伟达",
  "索尼",
  "佳能",
  "尼康",
  "富士",
  "松下",
  "徕卡",
  "哈苏",
  "适马",
  "腾龙",
  "奥之心",
  "奥林巴斯",
  "理光",
  "宾得",
  "蔡司",
  "唯卓仕",
  "老蛙",
  "思锐",
  "大疆",
  "影石",
  "大疆",
  "小米",
  "华为",
  "荣耀",
  "OPPO",
  "vivo"
];

const stopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "into",
  "your",
  "you",
  "are",
  "new",
  "latest",
  "update",
  "updates",
  "review",
  "reviews",
  "news",
  "how",
  "why",
  "what",
  "about",
  "after",
  "before",
  "over",
  "under",
  "again",
  "using",
  "use",
  "发布",
  "推出",
  "宣布",
  "最新",
  "消息",
  "称",
  "如何",
  "为什么",
  "什么",
  "一个",
  "一种",
  "可以",
  "已经",
  "正式",
  "今日",
  "今天"
]);

function sha1(value) {
  return crypto.createHash("sha1").update(value).digest("hex");
}

async function readInput() {
  try {
    return JSON.parse(await fs.readFile(inputPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return JSON.parse(await fs.readFile(fallbackInputPath, "utf8"));
    }
    throw error;
  }
}

function normalizeUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    parsed.pathname = parsed.pathname.replace(/\/amp\/?$/i, "/").replace(/\/+$/g, "") || "/";

    for (const key of [...parsed.searchParams.keys()]) {
      const value = parsed.searchParams.get(key) || "";
      if (/^(utm_|fbclid$|gclid$|yclid$|mc_cid$|mc_eid$)/i.test(key)) {
        parsed.searchParams.delete(key);
      } else if (/^(ref|source|src|from|spm|f)$/i.test(key) && /rss|feed|newsletter|social/i.test(value)) {
        parsed.searchParams.delete(key);
      }
    }

    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return String(url).trim();
  }
}

function normalizeText(value) {
  return decodeEntities(String(value || ""))
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function latinTokens(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !stopWords.has(token));
}

function cjkBigrams(value) {
  const chars = normalizeText(value)
    .replace(/[^\u4e00-\u9fff]/g, "")
    .split("");
  const grams = [];
  for (let index = 0; index < chars.length - 1; index += 1) {
    const gram = `${chars[index]}${chars[index + 1]}`;
    if (!stopWords.has(gram)) grams.push(gram);
  }
  return grams;
}

function textFeatures(item) {
  const text = `${item.title || ""} ${item.summary || ""}`;
  const title = item.title || "";
  return {
    text: normalizeText(text),
    titleText: normalizeText(title),
    tokens: new Set(latinTokens(text)),
    titleTokens: new Set(latinTokens(title)),
    bigrams: new Set(cjkBigrams(title)),
    entities: new Set(entityTerms.filter((term) => normalizeText(text).includes(normalizeText(term)))),
    hasDomainTerm: domainTerms.some((term) => normalizeText(text).includes(normalizeText(term))),
    hasStrictProductTerm: strictProductTerms.some((term) => normalizeText(text).includes(normalizeText(term))),
    hasTraditionalMajorTerm: traditionalMajorTerms.some((term) => normalizeText(text).includes(normalizeText(term))),
    hasEmergingBrandTerm: emergingBrandTerms.some((term) => normalizeText(text).includes(normalizeText(term))),
    hasEmergingDirectionTerm: emergingDirectionTerms.some((term) => normalizeText(text).includes(normalizeText(term))),
    hasLensTerm: /(\blens\b|\blenses\b|镜头|卡口|f\/\d|t\d)/i.test(text),
    hasEventTerm: eventTerms.some((term) => normalizeText(text).includes(normalizeText(term))),
    hasNegativeTerm: negativeTerms.some((term) => normalizeText(text).includes(normalizeText(term)))
  };
}

function titleFingerprint(item) {
  const tokens = [...textFeatures(item).titleTokens].slice(0, 16).join(" ");
  const bigrams = [...textFeatures(item).bigrams].slice(0, 24).join("");
  return tokens || bigrams || normalizeText(item.title);
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

function sharedCount(left, right) {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) count += 1;
  }
  return count;
}

function hoursBetween(left, right) {
  const a = Date.parse(left?.publishedAt || 0);
  const b = Date.parse(right?.publishedAt || 0);
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b) / 36e5;
}

function baseRelevance(item, features) {
  const category = item.source?.category || "";
  const baseline = sourceCategoryBaseline.find(([pattern]) => pattern.test(category))?.[1] ?? 55;
  const isBroadSource = /中文影像|影像综合/i.test(category);
  let score = baseline;

  if (features.hasDomainTerm) score += 18;
  if (features.entities.size > 0) score += 6;
  if (features.hasEventTerm) score += 4;
  if (isBroadSource && !features.hasDomainTerm) score -= features.entities.size > 0 ? 22 : 34;
  if (isBroadSource && !features.hasStrictProductTerm) score -= 34;
  if (isBroadSource && features.hasDomainTerm && !features.hasEventTerm && features.entities.size === 0) score -= 10;
  if (features.hasNegativeTerm) score -= 10;
  if (features.hasNegativeTerm && !features.hasDomainTerm) score -= 28;
  if ((item.summary || "").length > 120) score += 3;
  if (item.source?.priority === "P0") score += 4;
  if (category.includes("新产品发现")) score -= 6;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function contentScore(item, features, relevance) {
  let score = relevance * 0.65 + (sourcePriorityScore[item.source?.priority] || 0);
  if (features.hasEventTerm) score += 8;
  if (features.entities.size > 0) score += 5;
  if ((item.summary || "").length >= 180) score += 4;
  if ((item.title || "").length >= 18 && (item.title || "").length <= 100) score += 3;
  if (features.hasNegativeTerm) score -= 18;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function emergingScore(item, features, relevance) {
  const category = item.source?.category || "";
  let score = relevance * 0.45;

  if (/新兴产品/i.test(category)) score += 28;
  if (/无人机|运动影像|电影机|视频器材/i.test(category)) score += 10;
  if (features.hasEmergingBrandTerm) score += 18;
  if (features.hasEmergingDirectionTerm) score += 18;
  if (features.hasEventTerm) score += 6;
  if (features.hasTraditionalMajorTerm) score -= 16;
  if (features.hasLensTerm && !features.hasEmergingDirectionTerm && !/新兴产品/i.test(category)) score -= 18;
  if (/相机\/镜头评测|品牌爆料/i.test(category) && !features.hasEmergingBrandTerm && !features.hasEmergingDirectionTerm) score -= 18;
  if (/canon|nikon|sony|fujifilm|fuji|panasonic|leica|hasselblad|佳能|尼康|索尼|富士|松下|徕卡|哈苏/i.test(item.source?.name || "")) score -= 10;
  if (features.hasNegativeTerm) score -= 16;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function rankItem(item) {
  const publishedAt = Date.parse(item.publishedAt || 0) || 0;
  return [
    item.emergingScore || 0,
    item.domainRelevance || 0,
    item.score || 0,
    sourcePriorityScore[item.source?.priority] || 0,
    (item.summary || "").length,
    publishedAt
  ];
}

function compareRank(left, right) {
  const a = rankItem(left);
  const b = rankItem(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return b[index] - a[index];
  }
  return 0;
}

function choosePrimary(items) {
  return [...items].sort(compareRank)[0];
}

function hardDedupe(items) {
  const byUrl = new Map();
  const byTitleSource = new Map();
  const duplicateIds = new Set();
  const duplicateRecords = [];

  for (const item of items) {
    const urlKey = item.normalizedUrl;
    if (!urlKey) continue;
    if (!byUrl.has(urlKey)) byUrl.set(urlKey, []);
    byUrl.get(urlKey).push(item);
  }

  for (const group of byUrl.values()) {
    if (group.length < 2) continue;
    const primary = choosePrimary(group);
    for (const item of group) {
      if (item.id === primary.id) continue;
      duplicateIds.add(item.id);
      duplicateRecords.push({
        id: item.id,
        duplicateOfId: primary.id,
        reason: "same_normalized_url",
        title: item.title,
        url: item.url,
        source: item.source?.name
      });
    }
  }

  for (const item of items) {
    if (duplicateIds.has(item.id)) continue;
    const titleKey = `${item.source?.id || "unknown"}|${titleFingerprint(item)}`;
    if (!titleKey.endsWith("|")) {
      if (!byTitleSource.has(titleKey)) byTitleSource.set(titleKey, []);
      byTitleSource.get(titleKey).push(item);
    }
  }

  for (const group of byTitleSource.values()) {
    if (group.length < 2) continue;
    const primary = choosePrimary(group);
    for (const item of group) {
      if (item.id === primary.id || duplicateIds.has(item.id)) continue;
      duplicateIds.add(item.id);
      duplicateRecords.push({
        id: item.id,
        duplicateOfId: primary.id,
        reason: "same_source_same_title",
        title: item.title,
        url: item.url,
        source: item.source?.name
      });
    }
  }

  const duplicateById = new Map(duplicateRecords.map((record) => [record.id, record]));
  const allItems = items.map((item) => {
    const duplicate = duplicateById.get(item.id);
    return {
      ...item,
      duplicateOfId: duplicate?.duplicateOfId ?? null,
      duplicateReason: duplicate?.reason ?? null
    };
  });

  return {
    items: allItems.filter((item) => !item.duplicateOfId),
    duplicates: duplicateRecords,
    allItems
  };
}

function eventSimilarity(left, right) {
  const hours = hoursBetween(left, right);
  if (hours > 96) return { match: false, score: 0, reason: "outside_time_window" };

  const a = left.features;
  const b = right.features;
  const tokenScore = Math.max(jaccard(a.titleTokens, b.titleTokens), jaccard(a.tokens, b.tokens));
  const bigramScore = jaccard(a.bigrams, b.bigrams);
  const entityOverlap = sharedCount(a.entities, b.entities);
  const sharedTokens = sharedCount(a.titleTokens, b.titleTokens);
  const score = Math.max(tokenScore, bigramScore) + Math.min(0.25, entityOverlap * 0.12) + (hours <= 48 ? 0.08 : 0);

  if (tokenScore >= 0.72 || bigramScore >= 0.68) {
    return { match: true, score, reason: "high_title_similarity" };
  }

  if (entityOverlap > 0 && Math.max(tokenScore, bigramScore) >= 0.34) {
    return { match: true, score, reason: "same_entity_similar_title" };
  }

  if (sharedTokens >= 3 && hours <= 72 && score >= 0.48) {
    return { match: true, score, reason: "shared_terms_near_time" };
  }

  return { match: false, score, reason: "below_threshold" };
}

function clusterItems(items) {
  const clusters = [];
  const sortedItems = [...items].sort((a, b) => {
    const left = Date.parse(a.publishedAt || 0) || 0;
    const right = Date.parse(b.publishedAt || 0) || 0;
    return right - left;
  });

  for (const item of sortedItems) {
    let bestCluster = null;
    let bestMatch = { score: 0, reason: "" };

    for (const cluster of clusters) {
      const match = eventSimilarity(item, cluster.primary);
      if (match.match && match.score > bestMatch.score) {
        bestCluster = cluster;
        bestMatch = match;
      }
    }

    if (bestCluster) {
      bestCluster.items.push(item);
      bestCluster.matchReasons.push(bestMatch.reason);
      bestCluster.primary = choosePrimary(bestCluster.items);
    } else {
      clusters.push({
        id: `cluster_${sha1(`${item.normalizedUrl}|${item.title}`).slice(0, 16)}`,
        primary: item,
        items: [item],
        matchReasons: []
      });
    }
  }

  return clusters.map((cluster) => {
    const primary = choosePrimary(cluster.items);
    const sourceNames = [...new Set(cluster.items.map((item) => item.source?.name).filter(Boolean))];
    const latestAt = cluster.items
      .map((item) => item.publishedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
    const clusterId = `cluster_${sha1(`${primary.normalizedUrl}|${primary.title}|${sourceNames.join("|")}`).slice(0, 16)}`;

    return {
      id: clusterId,
      primaryId: primary.id,
      title: decodeEntities(primary.title),
      url: primary.url,
      source: primary.source?.name,
      category: primary.source?.category,
      itemCount: cluster.items.length,
      sourceCount: sourceNames.length,
      sourceNames,
      latestAt,
      score: Math.max(...cluster.items.map((item) => item.score || 0)),
      domainRelevance: Math.max(...cluster.items.map((item) => item.domainRelevance || 0)),
      emergingScore: Math.max(...cluster.items.map((item) => item.emergingScore || 0)),
      hasNegativeSignal: cluster.items.some((item) => item.features?.hasNegativeTerm),
      isLensCentric: cluster.items.some((item) => item.features?.hasLensTerm) && !cluster.items.some((item) => item.features?.hasEmergingDirectionTerm),
      matchReasons: [...new Set(cluster.matchReasons.filter(Boolean))],
      itemIds: cluster.items.map((item) => item.id)
    };
  });
}

function attachClusterFields(items, clusters) {
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const cluster of clusters) {
    for (const itemId of cluster.itemIds) {
      const item = byId.get(itemId);
      if (!item) continue;
      item.clusterId = cluster.id;
      item.clusterRole = item.id === cluster.primaryId ? "primary" : "related";
      item.clusterSourceCount = cluster.sourceCount;
      item.clusterItemCount = cluster.itemCount;
    }
  }
}

function publicItem(item) {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    normalizedUrl: item.normalizedUrl,
    source: item.source,
    publishedAt: item.publishedAt,
    summary: item.summary,
    domainRelevance: item.domainRelevance,
    emergingScore: item.emergingScore,
    score: item.score,
    selected: item.selected,
    duplicateOfId: item.duplicateOfId,
    duplicateReason: item.duplicateReason,
    clusterId: item.clusterId,
    clusterRole: item.clusterRole,
    clusterSourceCount: item.clusterSourceCount,
    clusterItemCount: item.clusterItemCount
  };
}

const input = await readInput();
const rawItems = Array.isArray(input.items) ? input.items : [];
const enriched = rawItems.map((item) => {
  const normalizedUrl = normalizeUrl(item.url);
  const features = textFeatures(item);
  const domainRelevance = baseRelevance(item, features);
  const score = contentScore(item, features, domainRelevance);
  const emerging = emergingScore(item, features, domainRelevance);

  return {
    ...item,
    normalizedUrl,
    features,
    domainRelevance,
    emergingScore: emerging,
    score
  };
});

const hard = hardDedupe(enriched);
const relevantItems = hard.items.filter((item) => item.domainRelevance >= 70);
const clusters = clusterItems(relevantItems);
attachClusterFields(relevantItems, clusters);

const selectedItems = relevantItems
  .filter((item) => {
    if (item.clusterRole !== "primary") return false;
    if (item.features.hasNegativeTerm) return false;
    if (item.domainRelevance < 72 || item.score < 72 || item.emergingScore < 52) return false;
    if (/新兴产品/i.test(item.source?.category || "") && !item.features.hasDomainTerm && !item.features.hasStrictProductTerm) return false;
    return true;
  })
  .map((item) => ({ ...item, title: decodeEntities(item.title), summary: decodeEntities(item.summary), selected: true }))
  .sort(compareRank);

const selectedIds = new Set(selectedItems.map((item) => item.id));
const allItems = relevantItems
  .map((item) => ({
    ...item,
    title: decodeEntities(item.title),
    summary: decodeEntities(item.summary),
    selected: selectedIds.has(item.id)
  }))
  .sort((a, b) => {
    const left = Date.parse(a.publishedAt || 0) || 0;
    const right = Date.parse(b.publishedAt || 0) || 0;
    return right - left;
  });

const hotDirectionSignalTerms = [
  "kickstarter",
  "crowdfunding",
  "prototype",
  "pocket",
  "portable",
  "modular",
  "creator",
  "vlog",
  "ai camera",
  "ai video",
  "ai photo",
  "ai image",
  "generative",
  "text-to-video",
  "image-to-video",
  "360",
  "action camera",
  "drone",
  "fpv",
  "osmo",
  "insta360",
  "gopro",
  "hoverair",
  "smart glasses",
  "camera glasses",
  "ar headset",
  "vr headset",
  "spatial",
  "projector",
  "capture",
  "playback",
  "usb4",
  "thunderbolt",
  "recorder",
  "monitor",
  "viewfinder",
  "topaz",
  "runway",
  "luma",
  "kling",
  "davinci resolve",
  "众筹",
  "原型",
  "口袋",
  "便携",
  "模块化",
  "创作者",
  "全景",
  "运动相机",
  "无人机",
  "智能眼镜",
  "头显",
  "空间计算",
  "投影",
  "采集",
  "录机",
  "监视器",
  "取景器",
  "后期",
  "调色"
];

const visualProductSignalTerms = [
  "camera",
  "photo",
  "image",
  "video",
  "film",
  "cinema",
  "lens",
  "sensor",
  "capture",
  "playback",
  "drone",
  "action camera",
  "360 camera",
  "smart glasses",
  "camera glasses",
  "ar headset",
  "vr headset",
  "spatial",
  "vision pro",
  "projector",
  "davinci resolve",
  "topaz",
  "runway",
  "luma",
  "kling",
  "insta360",
  "gopro",
  "osmo",
  "摄影",
  "拍摄",
  "影像",
  "相机",
  "镜头",
  "传感器",
  "视频",
  "电影",
  "采集",
  "无人机",
  "全景",
  "运动相机",
  "智能眼镜",
  "头显",
  "空间计算",
  "投影"
];

function hasHotDirectionSignal(cluster) {
  const text = normalizeText(`${cluster.title || ""} ${cluster.source || ""} ${(cluster.sourceNames || []).join(" ")}`);
  return hotDirectionSignalTerms.some((term) => text.includes(normalizeText(term)));
}

function hasVisualProductSignal(cluster) {
  const text = normalizeText(`${cluster.title || ""} ${cluster.source || ""} ${(cluster.sourceNames || []).join(" ")}`);
  return visualProductSignalTerms.some((term) => text.includes(normalizeText(term)));
}

function hotDirection(cluster) {
  const category = cluster.category || "";
  const text = normalizeText(`${cluster.title || ""} ${cluster.source || ""} ${(cluster.sourceNames || []).join(" ")}`);

  if (/360|insta360|gopro|action camera|drone|dji|fpv|osmo|无人机|航拍|全景|运动相机/.test(text) || /无人机|运动影像/i.test(category)) {
    return "全景/运动/航拍";
  }

  if (/smart glasses|camera glasses|ar headset|vr headset|spatial|projector|vision pro|智能眼镜|头显|空间计算|投影/.test(text)) {
    return "空间影像/显示";
  }

  if (/\bai\b|ai camera|ai video|ai photo|ai image|topaz|runway|luma|kling|generative|text-to-video|image-to-video|davinci resolve|lightroom|photoshop|capture one|grading|editing|后期|调色/.test(text)) {
    return "AI/后期工作流";
  }

  if (/kickstarter|crowdfunding|prototype|pocket|portable|modular|creator|vlog|capture|playback|usb4|thunderbolt|recorder|monitor|viewfinder|众筹|原型|口袋|便携|模块化|创作者|采集|录机|监视器|取景器/.test(text)) {
    return "创作者硬件";
  }

  if (/viltrox|laowa|sirui|samyang|ttartisan|7artisans|meike|brightin star|sg-image|tilta|freewell|moment|唯卓仕|老蛙|思锐|美科|七工匠|铭匠|影石|小隼/.test(text)) {
    return "新锐品牌/配件";
  }

  if (/电影机|视频器材/i.test(category)) return "创作者硬件";
  if (/品牌爆料|相机\/镜头评测/i.test(category)) return "新锐品牌/配件";
  if (/影像综合/i.test(category)) return "影像产品";
  return /新兴产品/i.test(category) ? "新兴产品发现" : category || "其他";
}

function highEmergingHardwareCluster(cluster) {
  return (
    cluster.emergingScore >= 90 &&
    cluster.domainRelevance >= 72 &&
    /新兴产品|电影机|视频器材|无人机|运动影像|影像综合/i.test(cluster.category || "")
  );
}

function hotCategoryLimit(category) {
  if (/品牌爆料|相机\/镜头评测/i.test(category || "")) return 1;
  if (/无人机|运动影像/i.test(category || "")) return 3;
  if (/影像综合/i.test(category || "")) return 3;
  return 4;
}

function hotMajorBrand(topic) {
  const text = normalizeText(`${topic.title || ""} ${topic.source || ""}`);
  if (/\bdji\b|大疆/.test(text)) return "dji";
  return "";
}

const rankedHotTopics = clusters
  .filter((cluster) => {
    const directionSignal = hasHotDirectionSignal(cluster);
    if (/新兴产品/i.test(cluster.category || "") && !hasVisualProductSignal(cluster)) return false;
    if (cluster.hasNegativeSignal && !highEmergingHardwareCluster(cluster)) return false;
    if (cluster.isLensCentric && !directionSignal) return false;
    if (cluster.emergingScore >= 88 && cluster.domainRelevance >= 72 && (directionSignal || cluster.sourceCount >= 2 || cluster.itemCount >= 2)) return true;
    if (directionSignal && cluster.emergingScore >= 78 && cluster.domainRelevance >= 72) return true;
    if (cluster.sourceCount >= 2 && cluster.domainRelevance >= 65 && cluster.emergingScore >= 60) return true;
    return cluster.itemCount >= 2 && cluster.domainRelevance >= 72 && cluster.score >= 72 && cluster.emergingScore >= 55;
  })
  .map((cluster) => {
    const primary = allItems.find((item) => item.id === cluster.primaryId);
    return {
      id: cluster.id,
      title: cluster.title,
      url: cluster.url,
      source: cluster.source,
      category: cluster.category,
      direction: hotDirection(cluster),
      score: cluster.score,
      domainRelevance: cluster.domainRelevance,
      emergingScore: cluster.emergingScore,
      sourceCount: cluster.sourceCount,
      sourceNames: cluster.sourceNames,
      itemCount: cluster.itemCount,
      latestAt: cluster.latestAt,
      primaryItemId: cluster.primaryId,
      relatedItemIds: cluster.itemIds.filter((id) => id !== cluster.primaryId),
      selected: Boolean(primary && selectedIds.has(primary.id))
    };
  })
  .sort((a, b) => {
    if (a.emergingScore !== b.emergingScore) return b.emergingScore - a.emergingScore;
    if (a.sourceCount !== b.sourceCount) return b.sourceCount - a.sourceCount;
    if (a.itemCount !== b.itemCount) return b.itemCount - a.itemCount;
    if (a.score !== b.score) return b.score - a.score;
    return (Date.parse(b.latestAt || 0) || 0) - (Date.parse(a.latestAt || 0) || 0);
  });

const hotTopics = [];
const hotSourceCounts = new Map();
const hotCategoryCounts = new Map();
const hotDirectionCounts = new Map();
const hotBrandCounts = new Map();
for (const topic of rankedHotTopics) {
  const sourceCount = hotSourceCounts.get(topic.source) || 0;
  const categoryCount = hotCategoryCounts.get(topic.category) || 0;
  const directionCount = hotDirectionCounts.get(topic.direction) || 0;
  const brand = hotMajorBrand(topic);
  const brandCount = brand ? hotBrandCounts.get(brand) || 0 : 0;
  if (hotTopics.length >= 18) break;
  if (sourceCount >= 2) continue;
  if (categoryCount >= hotCategoryLimit(topic.category)) continue;
  if (directionCount >= 5) continue;
  if (brand && brandCount >= 2) continue;
  hotTopics.push(topic);
  hotSourceCounts.set(topic.source, sourceCount + 1);
  hotCategoryCounts.set(topic.category, categoryCount + 1);
  hotDirectionCounts.set(topic.direction, directionCount + 1);
  if (brand) hotBrandCounts.set(brand, brandCount + 1);
}

const generatedAt = new Date().toISOString();
const clusterOutput = clusters
  .sort((a, b) => b.sourceCount - a.sourceCount || b.itemCount - a.itemCount || b.score - a.score)
  .map((cluster) => ({
    ...cluster,
    items: cluster.itemIds.map((id) => {
      const item = allItems.find((candidate) => candidate.id === id) ?? hard.allItems.find((candidate) => candidate.id === id);
      return item ? publicItem(item) : { id };
    })
  }));

const report = {
  generatedAt,
  inputPath: inputPath.endsWith("items.raw.json") ? inputPath : fallbackInputPath,
  rawItemCount: rawItems.length,
  hardDuplicateCount: hard.duplicates.length,
  afterHardDedupeCount: hard.items.length,
  allCount: allItems.length,
  selectedCount: selectedItems.length,
  clusterCount: clusters.length,
  hotTopicCount: hotTopics.length,
  thresholds: {
    allMinDomainRelevance: 70,
    selectedMinDomainRelevance: 72,
    selectedMinScore: 72,
    selectedMinEmergingScore: 52,
    hotStandaloneMinEmergingScore: 78,
    eventWindowHours: 96
  },
  duplicateSamples: hard.duplicates.slice(0, 30)
};

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(allItemsPath, JSON.stringify({ generatedAt, items: allItems.map(publicItem) }, null, 2));
await fs.writeFile(selectedItemsPath, JSON.stringify({ generatedAt, items: selectedItems.map(publicItem) }, null, 2));
await fs.writeFile(clustersPath, JSON.stringify({ generatedAt, clusters: clusterOutput }, null, 2));
await fs.writeFile(hotTopicsPath, JSON.stringify({ generatedAt, items: hotTopics }, null, 2));
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

console.log(`Raw items: ${report.rawItemCount}`);
console.log(`Hard duplicates hidden: ${report.hardDuplicateCount}`);
console.log(`All pool: ${report.allCount}`);
console.log(`Selected pool: ${report.selectedCount}`);
console.log(`Clusters: ${report.clusterCount}`);
console.log(`Hot topics: ${report.hotTopicCount}`);
