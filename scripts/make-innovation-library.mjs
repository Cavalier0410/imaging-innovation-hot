import fs from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve("data");
const outputDataPath = path.join(dataDir, "innovation-projects.json");
const repoSlug = process.env.GITHUB_REPOSITORY || "Cavalier0410/imaging-innovation-hot";
const outputHtmlPath = path.join(dataDir, "innovation-product-library.html");
const rebuild = process.env.INNOVATION_LIBRARY_REBUILD === "1" || process.argv.includes("--rebuild");
const fetchImages = process.env.FETCH_PROJECT_IMAGES !== "0";
const criteriaVersion = 1;

const trustedDiscoverySources = new Set([
  "Product Hunt",
  "Yanko Design",
  "The Gadgeteer",
  "TechCrunch Hardware",
  "Hackster News",
  "Hackaday",
  "CineD",
  "Newsshooter",
  "Y.M.Cinema",
  "ProVideo Coalition",
  "DroneDJ",
  "360 Rumors"
]);

const titleRejectPatterns = [
  /\breview\b/i,
  /\bcomparison\b/i,
  /\bvs\.?\b/i,
  /^best\b/i,
  /^how\b/i,
  /^why\b/i,
  /^what\b/i,
  /^where\b/i,
  /^opinion\b/i,
  /\bbuyer(?:'s)? guide\b/i,
  /\bmaintenance update\b/i,
  /\bcompliance\b/i,
  /\bsupport cutoff\b/i,
  /\bprice (?:drop|hike)\b/i,
  /\bsavings?\b/i,
  /\bdiscount\b/i,
  /\bsample shots?\b/i,
  /\broadmap\b/i,
  /\bpatent application\b/i,
  /\bproduction discontinued\b/i,
  /\bwhat else is new\b/i,
  /\bnew products from\b/i,
  /\bfirmware\b/i,
  /\btutorial\b/i,
  /\bmastering\b/i,
  /\btop \d+\b/i,
  /\beach frame\b/i,
  /\bholds \d+k\b/i,
  /\bprivacy\b/i,
  /\bloophole\b/i,
  /\bpolicy change\b/i,
  /\bunder \$?\d+/i,
  /\bcheapest\b/i,
  /\bwatch:/i,
  /评测|测评|对比|教程|固件|降价|优惠|传闻|爆料|购买指南/
];

const accessoryRejectPatterns = [
  /\b(?:camera )?bags?\b/i,
  /\bshoulder straps?\b/i,
  /\bcamera straps?\b/i,
  /\bscrew sets?\b/i,
  /\btripod (?:mounting )?plates?\b/i,
  /\bpower stations?\b/i,
  /\bflashlights?\b/i,
  /\bbracelets?\b/i,
  /\bsmartwatch(?:es)?\b/i,
  /\bwatches?\b/i,
  /\bconnectors?\b/i,
  /\bbatter(?:y|ies)\b/i,
  /相机包|肩带|螺丝套装|手表|手环|充电站/
];

const evidenceRejectPatterns = [
  /\brumou?rs?\b/i,
  /\bleak(?:ed|s|ing)?\b/i,
  /\bteas(?:e|es|ed|ing)\b/i,
  /\bmay announce\b/i,
  /\bcould pack\b/i,
  /\breportedly\b/i,
  /\bconcept render\b/i,
  /传闻|爆料|泄露|谍照|可能发布|概念渲染/
];

const projectSignalPatterns = [
  /\bannounc(?:e|ed|es|ing)\b/i,
  /\blaunch(?:ed|es|ing)?\b/i,
  /\bintroduc(?:e|ed|es|ing)\b/i,
  /\bunveil(?:ed|s|ing)?\b/i,
  /\breleas(?:e|ed|es|ing)\b/i,
  /\bdebut(?:ed|s|ing)?\b/i,
  /\bkickstarter\b/i,
  /\bcrowdfund(?:ed|ing)?\b/i,
  /\bpre-?order\b/i,
  /\bnow available\b/i,
  /\bshipping\b/i,
  /\bprototype\b/i,
  /\bbuild your own\b/i,
  /\bDIY\b/,
  /\bopen[ -]source\b/i,
  /\bworld(?:'s|s) first\b/i,
  /\bhas created\b/i,
  /\bhas built\b/i,
  /\bbuilt\b/i,
  /\braised? \$?\d/i,
  /\bfunding\b/i,
  /\bnew\b/i,
  /发布|推出|亮相|首发|众筹|预售|原型|开源|上线|融资|问世/
];

const visualProductPatterns = [
  /\bcameras?\b/i,
  /\bvideo editor\b/i,
  /\bvideo model\b/i,
  /\bimage (?:model|generator|sensor|processing)\b/i,
  /\bphoto(?:graphy)? (?:app|tool|robot|system)\b/i,
  /\bsmart glasses\b/i,
  /\bcamera-free glasses\b/i,
  /\bAR headset\b/i,
  /\bVR headset\b/i,
  /\bVision Pro\b/i,
  /\bspatial (?:computing|video|app|camera|showroom)\b/i,
  /\bimmersive\b/i,
  /\bFPV\b/,
  /\b360 camera\b/i,
  /\baction camera\b/i,
  /\bcinema camera\b/i,
  /\bbroadcast camera\b/i,
  /\bfilm camera\b/i,
  /\bimage sensor\b/i,
  /\bCMOS\b/i,
  /\bviewfinder\b/i,
  /\bfocus stacking\b/i,
  /\bHDR reconstruction\b/i,
  /\bcapture and playback\b/i,
  /\bcapture (?:device|product|card|system)\b/i,
  /\bproduction monitor\b/i,
  /\belectronic ND\b/i,
  /\bdirector(?:'s)? viewfinder\b/i,
  /\bshoot planning\b/i,
  /\bcolor engine\b/i,
  /\bpoint-source fixtures?\b/i,
  /\bcamera robot\b/i,
  /\brobot[^.]{0,80}\bcamera\b/i,
  /\bcamera[^.]{0,80}\brobot\b/i,
  /\bphone lenses?\b/i,
  /\biPhone lenses?\b/i,
  /\bcamera feeder\b/i,
  /相机|摄像|影像|图像模型|视频模型|智能眼镜|空间计算|头显|取景器|传感器|监视器|电子 ND|焦点堆栈|电影机|视觉机器人/
];

const droneVisualPatterns = [
  /\bFPV\b/,
  /\bcameras?\b/i,
  /\bvideo\b/i,
  /\bview\b/i,
  /\bvision\b/i,
  /\bimaging\b/i,
  /\bcapture\b/i,
  /\b360\b/i,
  /\bsensor\b/i,
  /\bcinema\b/i,
  /航拍|影像|相机|摄像|视野|全景/
];

const innovationPatterns = [
  [ /\bAI\b|artificial intelligence|generative|neural|machine learning/i, "AI 影像" ],
  [ /spatial|immersive|Vision Pro|smart glasses|AR headset|VR headset/i, "空间影像" ],
  [ /pocket|portable|compact|wearable|phone-sized|clip onto|56g\b/i, "便携形态" ],
  [ /autonomous|automated|robot|robotic/i, "自动化拍摄" ],
  [ /open[ -]source|DIY|build your own/i, "开源可自制" ],
  [ /computational|HDR reconstruction|scene-linear|image model|video model/i, "计算影像" ],
  [ /wireless|cloud|Frame\.io|native upload|iCloud|remote controll/i, "云端与远程协作" ],
  [ /transparent viewfinder|electronic ND|new sensor|STARVIS|global shutter|full-spectrum|nine-band/i, "新型光学与传感" ],
  [ /modern user interface|large-format film|refined mechanical design/i, "传统介质新设计" ],
  [ /360|ultra-wide|159-degree|fisheye/i, "新视角采集" ],
  [ /low-latency|USB4|Thunderbolt 4|480fps|HFR|high frame rate/i, "高性能工作流" ],
  [ /modular|adaptive|ecosystem|node-based|integrat(?:e|ed|ion)/i, "模块化工作流" ],
  [ /birdwatching|bird feeder|notification/i, "新使用场景" ],
  [ /智能|生成式|空间影像|沉浸式|便携|口袋|穿戴|自动化|机器人|开源|计算摄影|远程控制|云端|透明取景器|电子 ND|全景/i, "新产品形态" ]
];

const conventionalLensPattern = /\b(?:AF|MF)?\s*\d{1,3}(?:-\d{1,3})?mm\b|\bf\/?\d(?:\.\d+)?\b|定焦镜头|变焦镜头/i;
const majorBrandPattern = /\b(?:Canon|Nikon|Sony|Fujifilm|Panasonic|Leica|DJI|ARRI)\b|佳能|尼康|索尼|富士|松下|徕卡|大疆/i;
const traditionalCameraModelPattern = /\bSony RX\d|\bCanon EOS\b|\bNikon Z\d|\bFujifilm (?:X|GFX)[-\s]?\w+|\bPanasonic LUMIX\b|\bLeica (?:Q|M|SL)\d|索尼 RX\d|佳能 EOS|尼康 Z\d|富士 (?:X|GFX)|松下 LUMIX|徕卡 (?:Q|M|SL)\d/i;
const breakthroughCameraPattern = /global shutter|transparent viewfinder|autonomous|camera robot|spatial|immersive|360 camera|open[ -]source|electronic ND|全局快门|透明取景器|自动拍摄|相机机器人|空间影像|沉浸式|开源|电子 ND/i;

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function readSelected() {
  const translated = await readJson(path.join(dataDir, "items.selected.zh.json"), null);
  if (translated) return translated;
  return readJson(path.join(dataDir, "items.selected.json"), { generatedAt: null, items: [] });
}

function matchesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

function classifyCategory(text) {
  if (/smart glasses|camera-free glasses|AR headset|VR headset|Vision Pro|spatial|immersive|智能眼镜|空间计算|头显|沉浸/i.test(text)) {
    return "空间影像与显示";
  }
  if (/AI video|video editor|image generator|image model|HDR reconstruction|computational|neural|scene-linear|生成式|计算影像|图像模型|视频模型/i.test(text)) {
    return "AI 与计算影像";
  }
  if (/camera robot|robot[^.]{0,80}camera|camera[^.]{0,80}robot|bird feeder|birdwatch|autonomous camera|focus stacking|视觉机器人|自动化拍摄|观鸟/i.test(text)) {
    return "智能相机与机器人";
  }
  if (/FPV|360 camera|action camera|drone[^.]{0,80}(?:camera|video|view|vision|capture|imaging|360|sensor)|航拍|全景相机|运动相机/i.test(text)) {
    return "运动影像与航拍";
  }
  if (/pocket camera|iPhone lenses?|phone lenses?|mobile ecosystem|vlog|口袋相机|手机镜头|移动创作/i.test(text)) {
    return "便携与移动创作";
  }
  if (/broadcast camera|capture and playback|production monitor|director(?:['’]s)? viewfinder|shoot planning|Frame\.io|USB4|high frame rate|\bHFR\b|480fps|baseband|广播电影机|现场制作/i.test(text)) {
    return "专业影像新技术";
  }
  if (/lens|optics|filter|viewfinder|sensor|CMOS|\bND\b|lighting|color engine|镜头|滤镜|取景器|传感器|灯光/i.test(text)) {
    return "创新光学与传感";
  }
  return "专业影像新技术";
}

function classifyStage(text, sourceName) {
  if (/kickstarter|crowdfund|众筹/i.test(text)) return "众筹中";
  if (/prototype|build your own|\bDIY\b|open[ -]source|原型|开源|自制/i.test(text)) return "原型/开源";
  if (/raised? \$?\d|funding|valuation|融资|估值/i.test(text)) return "已融资";
  if (/shipping|now available|available to order|released|上线|开售|现已提供/i.test(text)) return "已发布";
  if (/announc|introduc|unveil|launch|debut|发布|推出|亮相|首发/i.test(text)) return "已公布";
  if (sourceName === "Product Hunt") return "已上线";
  return "持续观察";
}

function classifyFormat(text) {
  if (/open[ -]source|\bDIY\b|build your own|开源|自制/i.test(text)) return "开源项目";
  if (/AI model|image model|video model|HDR reconstruction|模型/i.test(text)) return "AI 模型";
  if (/\bapp\b|software|video editor|generator|tool|workflow|软件|应用|编辑器/i.test(text)) return "软件/应用";
  return "硬件产品";
}

function evaluateItem(item) {
  const title = clean(item.title);
  const summary = clean(item.summary);
  const titleZh = clean(item.titleZh);
  const summaryZh = clean(item.summaryZh);
  const text = `${title} ${summary} ${titleZh} ${summaryZh}`;
  const sourceName = item.source?.name || "Unknown";

  if (!title || matchesAny(title, titleRejectPatterns)) return null;
  if (matchesAny(title, accessoryRejectPatterns)) return null;
  if (traditionalCameraModelPattern.test(title) && !breakthroughCameraPattern.test(text)) return null;
  const evidenceText = `${title} ${summary.slice(0, 360)}`;
  if (matchesAny(evidenceText, evidenceRejectPatterns)) return null;
  if (!matchesAny(text, visualProductPatterns)) return null;

  if (/\bdrone/i.test(text) && !matchesAny(text, droneVisualPatterns)) return null;

  const projectSignal = matchesAny(text, projectSignalPatterns);
  const trustedSource = trustedDiscoverySources.has(sourceName);
  const innovationReasons = innovationPatterns
    .filter(([pattern]) => pattern.test(text))
    .map(([, label]) => label)
    .filter((label, index, values) => values.indexOf(label) === index);

  const discoveryException = /camera feeder|birdwatch|观鸟/i.test(text);
  if (!projectSignal && !(trustedSource && (innovationReasons.length >= 2 || discoveryException))) return null;
  if (innovationReasons.length === 0) return null;

  let innovationScore = 35;
  innovationScore += Math.round(Math.min(100, Number(item.emergingScore || 0)) * 0.25);
  innovationScore += Math.min(28, innovationReasons.length * 7);
  if (projectSignal) innovationScore += 8;
  if (trustedSource) innovationScore += 5;
  if (/\b\d+(?:\.\d+)?(?:K|MP|fps|bit|mm|g|W|K|°)\b|\$\d+|£\d+/i.test(text)) innovationScore += 4;
  if (/transparent viewfinder|electronic ND|camera robot|focus stacking|STARVIS|480fps|high frame rate|kickstarter|crowdfund|开源|透明取景器|电子 ND/i.test(text)) {
    innovationScore += 7;
  }

  const conventionalLens = conventionalLensPattern.test(text) && /\blens(?:es)?\b|镜头/i.test(text);
  if (conventionalLens && !/electronic|transparent|phone|iPhone|modular|computational|AI\b|智能|电子|透明|手机/i.test(text)) {
    innovationScore -= 22;
  }
  if (majorBrandPattern.test(text) && innovationReasons.length < 2) innovationScore -= 8;

  innovationScore = Math.max(0, Math.min(100, innovationScore));
  if (innovationScore < 72) return null;

  const stage = classifyStage(text, sourceName);
  const reasons = [...innovationReasons];
  if (stage === "众筹中") reasons.unshift("众筹验证");
  if (stage === "已融资") reasons.unshift("获得融资");
  if (stage === "原型/开源" && !reasons.includes("开源可自制")) reasons.unshift("原型探索");

  return {
    id: item.id,
    title,
    titleZh: titleZh || title,
    summary,
    summaryZh: summaryZh || summary,
    url: item.url,
    normalizedUrl: item.normalizedUrl || item.url,
    publishedAt: item.publishedAt || null,
    source: item.source,
    projectCategory: classifyCategory(text),
    projectStage: stage,
    projectFormat: classifyFormat(text),
    innovationScore,
    innovationReasons: reasons.slice(0, 4),
    references: [
      {
        title,
        url: item.url,
        source: sourceName,
        publishedAt: item.publishedAt || null
      }
    ]
  };
}

const tokenStopWords = new Set([
  "a", "an", "and", "for", "from", "has", "in", "into", "is", "its", "new", "of", "on", "the", "to", "up", "via", "with",
  "aims", "announced", "announces", "bring", "brings", "first", "introduces", "launch", "launched", "releases", "released", "series",
  "camera", "cameras", "product", "products", "tool", "tools", "app", "now"
]);

function titleTokens(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[’']s\b/g, "")
    .replace(/[’']/g, "")
    .match(/[a-z0-9]+(?:\.[0-9]+)?|[\u4e00-\u9fff]{2,}/g)?.filter((token) => token.length > 1 && !tokenStopWords.has(token)) || [];
}

function sameProject(a, b) {
  if (a.normalizedUrl && b.normalizedUrl && a.normalizedUrl === b.normalizedUrl) return true;
  const aTokens = new Set(titleTokens(a.title));
  const bTokens = new Set(titleTokens(b.title));
  if (!aTokens.size || !bTokens.size) return false;
  const shared = [...aTokens].filter((token) => bTokens.has(token));
  const overlap = shared.length / Math.min(aTokens.size, bTokens.size);
  return (shared.length >= 3 && overlap >= 0.68) || (shared.length >= 4 && overlap >= 0.5);
}

function mergeProject(target, incoming, generatedAt) {
  const referenceUrls = new Set((target.references || []).map((reference) => reference.url));
  const references = [...(target.references || [])];
  for (const reference of incoming.references || []) {
    if (!referenceUrls.has(reference.url)) references.push(reference);
  }

  const base = { ...target, ...incoming };
  if (!incoming.imageUrl && target.imageUrl) base.imageUrl = target.imageUrl;
  if (!incoming.imageCheckedAt && target.imageCheckedAt) base.imageCheckedAt = target.imageCheckedAt;
  return {
    ...base,
    references: references.sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""))),
    firstSeenAt: target.firstSeenAt || generatedAt,
    lastSeenAt: generatedAt,
    baseScore: Math.max(
      Number(target.baseScore ?? target.innovationScore ?? 0),
      Number(incoming.baseScore ?? incoming.innovationScore ?? 0)
    ),
    innovationScore: Math.max(Number(target.innovationScore || 0), Number(incoming.innovationScore || 0))
  };
}

async function mapLimit(values, limit, mapper) {
  const results = new Array(values.length);
  let index = 0;
  async function worker() {
    while (index < values.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(values[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

function metaContent(html, key, value) {
  const tags = html.match(/<meta\s+[^>]*>/gi) || [];
  for (const tag of tags) {
    const attrs = {};
    for (const match of tag.matchAll(/([:\w-]+)\s*=\s*["']([^"']*)["']/g)) {
      attrs[match[1].toLowerCase()] = match[2];
    }
    if (String(attrs[key] || "").toLowerCase() === value.toLowerCase() && attrs.content) return attrs.content;
  }
  return "";
}

async function findPreviewImage(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
      }
    });
    if (!response.ok || !String(response.headers.get("content-type") || "").includes("text/html")) return "";
    const html = (await response.text()).slice(0, 350000);
    const image = metaContent(html, "property", "og:image") || metaContent(html, "name", "twitter:image");
    return image ? new URL(image, url).href : "";
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value, withTime = false) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {})
  }).format(date);
}

function sourceName(project) {
  return project.source?.name || "未知来源";
}

function favicon(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  } catch {
    return "";
  }
}

function feedbackUrl(project) {
  const title = `[评分] ${project.titleZh || project.title}`;
  const body = [
    `项目ID: ${project.id}`,
    `项目: ${project.titleZh || project.title}`,
    `机器分: ${project.innovationScore}`,
    "我的评分（0-100）: ",
    "备注（可选）: "
  ].join("\n");
  return `https://github.com/${repoSlug}/issues/new?labels=score-feedback&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function projectCard(project) {
  const search = [
    project.title,
    project.titleZh,
    project.summary,
    project.summaryZh,
    project.projectCategory,
    project.projectStage,
    project.projectFormat,
    sourceName(project),
    ...(project.innovationReasons || [])
  ].join(" ").toLowerCase();
  const icon = favicon(project.url);
  const image = project.imageUrl || "";
  const reasonText = (project.innovationReasons || []).join(" · ");
  const referenceCount = project.references?.length || 1;
  return `
    <article class="project-card" data-id="${escapeHtml(project.id)}" data-category="${escapeHtml(project.projectCategory)}" data-stage="${escapeHtml(project.projectStage)}" data-format="${escapeHtml(project.projectFormat)}" data-score="${escapeHtml(project.innovationScore)}" data-date="${escapeHtml(project.publishedAt || "")}" data-search="${escapeHtml(search)}">
      <div class="media ${image ? "" : "image-failed"}">
        ${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('image-failed')">` : ""}
        <span class="media-fallback">${escapeHtml(project.projectCategory.slice(0, 4))}</span>
        <button class="favorite" type="button" aria-label="收藏项目" title="收藏项目">☆</button>
      </div>
      <div class="project-body">
        <div class="meta-row">
          <span class="stage">${escapeHtml(project.projectStage)}</span>
          <span>${escapeHtml(project.projectFormat)}</span>
          <span title="原始分 ${escapeHtml(project.baseScore)}">创新度 ${escapeHtml(project.innovationScore)}</span>
          ${project.userScore != null ? `<span class="user-score">你 ${escapeHtml(project.userScore)}</span>` : ""}
        </div>
        <h2>${escapeHtml(project.titleZh || project.title)}</h2>
        ${project.titleZh && project.titleZh !== project.title ? `<p class="original-title">${escapeHtml(project.title)}</p>` : ""}
        <p class="summary">${escapeHtml(project.summaryZh || project.summary).slice(0, 210)}</p>
        <p class="reasons">${escapeHtml(reasonText)}</p>
        <div class="project-footer">
          <span class="source">${icon ? `<img src="${escapeHtml(icon)}" alt="">` : ""}${escapeHtml(sourceName(project))} · ${escapeHtml(formatDate(project.publishedAt))}${referenceCount > 1 ? ` · ${referenceCount} 篇报道` : ""}</span>
          <span class="card-links">
            <a class="score-link" href="${escapeHtml(feedbackUrl(project))}" target="_blank" rel="noreferrer">打分</a>
            <a href="${escapeHtml(project.url)}" target="_blank" rel="noreferrer">查看项目</a>
          </span>
        </div>
      </div>
    </article>`;
}

const [selectedData, existingData] = await Promise.all([
  readSelected(),
  rebuild ? Promise.resolve({ projects: [] }) : readJson(outputDataPath, { projects: [] })
]);

const generatedAt = new Date().toISOString();
const candidates = (selectedData.items || []).map(evaluateItem).filter(Boolean);
const projects = (existingData.projects || [])
  .filter((project) => {
    const title = clean(project.title);
    const text = `${title} ${clean(project.summary)}`;
    if (matchesAny(title, titleRejectPatterns) || matchesAny(title, accessoryRejectPatterns)) return false;
    return !(traditionalCameraModelPattern.test(title) && !breakthroughCameraPattern.test(text));
  })
  .map((project) => {
    const text = `${clean(project.title)} ${clean(project.summary)} ${clean(project.titleZh)} ${clean(project.summaryZh)}`;
    return {
      ...project,
      projectCategory: classifyCategory(text),
      projectStage: classifyStage(text, project.source?.name || "Unknown"),
      projectFormat: classifyFormat(text)
    };
  });
let newThisRun = 0;

for (const candidate of candidates.sort((a, b) => b.innovationScore - a.innovationScore)) {
  const existingIndex = projects.findIndex((project) => sameProject(project, candidate));
  if (existingIndex >= 0) {
    projects[existingIndex] = mergeProject(projects[existingIndex], candidate, generatedAt);
  } else {
    projects.push({ ...candidate, baseScore: candidate.innovationScore, firstSeenAt: generatedAt, lastSeenAt: generatedAt });
    newThisRun += 1;
  }
}

// Lower-scoring articles cannot create a project, but can support one that passed the strict gate.
for (const item of selectedData.items || []) {
  const article = {
    title: clean(item.title),
    normalizedUrl: item.normalizedUrl || item.url,
    url: item.url
  };
  const project = projects.find((entry) => sameProject(entry, article));
  if (!project || project.references.some((reference) => reference.url === item.url)) continue;
  project.references.push({
    title: clean(item.title),
    url: item.url,
    source: item.source?.name || "Unknown",
    publishedAt: item.publishedAt || null
  });
  project.references.sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
}

if (fetchImages) {
  await mapLimit(projects, 4, async (project) => {
    if (project.imageUrl || project.imageCheckedAt) return;
    project.imageUrl = await findPreviewImage(project.url);
    project.imageCheckedAt = generatedAt;
  });
}

const [scoringProfile, feedbackData] = await Promise.all([
  readJson(path.join(dataDir, "scoring-profile.json"), null),
  readJson(path.join(dataDir, "feedback.json"), { items: [] })
]);

const latestFeedback = new Map();
for (const item of feedbackData.items || []) {
  if (!item.projectId) continue;
  const previous = latestFeedback.get(item.projectId);
  if (!previous || String(item.createdAt || "") > String(previous.createdAt || "")) {
    latestFeedback.set(item.projectId, item);
  }
}

function calibrationAdjustment(project, baseScore) {
  if (!scoringProfile || scoringProfile.status !== "active") return 0;
  const bin = baseScore < 80 ? "70-79" : baseScore < 90 ? "80-89" : "90-100";
  const adjustment =
    Number(scoringProfile.intercept || 0) +
    Number(scoringProfile.category?.[project.projectCategory] || 0) +
    Number(scoringProfile.source?.[sourceName(project)] || 0) +
    Number(scoringProfile.bin?.[bin] || 0);
  const limit = Number(scoringProfile.maxAdjustment || 20);
  return Math.round(Math.max(-limit, Math.min(limit, adjustment)));
}

for (const project of projects) {
  project.baseScore = Math.round(Number(project.baseScore ?? project.innovationScore ?? 0));
  const adjusted = project.baseScore + calibrationAdjustment(project, project.baseScore);
  project.innovationScore = Math.max(0, Math.min(100, Math.round(adjusted)));

  const feedback = latestFeedback.get(project.id);
  if (feedback) project.userScore = Number(feedback.userScore);
  else delete project.userScore;
}

projects.sort((a, b) => {
  const dateOrder = String(b.publishedAt || "").localeCompare(String(a.publishedAt || ""));
  return dateOrder || b.innovationScore - a.innovationScore;
});

const categoryCounts = Object.fromEntries(
  [...new Set(projects.map((project) => project.projectCategory))]
    .map((category) => [category, projects.filter((project) => project.projectCategory === category).length])
    .sort((a, b) => b[1] - a[1])
);
const sourceCount = new Set(projects.flatMap((project) => (project.references || []).map((reference) => reference.source))).size;
const libraryData = {
  generatedAt,
  sourceGeneratedAt: selectedData.generatedAt || null,
  criteriaVersion,
  stats: {
    scannedThisRun: selectedData.items?.length || 0,
    acceptedThisRun: candidates.length,
    newThisRun,
    projectCount: projects.length,
    categoryCount: Object.keys(categoryCounts).length,
    sourceCount,
    withImageCount: projects.filter((project) => project.imageUrl).length
  },
  categoryCounts,
  projects
};

await fs.writeFile(outputDataPath, JSON.stringify(libraryData, null, 2), "utf8");

const categories = Object.keys(categoryCounts);
const projectJson = JSON.stringify(projects).replace(/</g, "\\u003c");
const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>创新影像产品项目库</title>
  <link rel="alternate" type="application/rss+xml" title="创新影像产品项目库" href="https://camera.lts4ai.com/feed.xml">
  <style>
    :root {
      --bg: #f4f6f7;
      --panel: #fff;
      --text: #172126;
      --muted: #647078;
      --line: #d8dfe3;
      --teal: #176d75;
      --rust: #a3482d;
      --green: #2e7153;
      --violet: #66548f;
      --gold: #946f19;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    }

    button, input, select { font: inherit; }

    .shell {
      width: min(1280px, calc(100% - 32px));
      margin: 0 auto;
      padding: 26px 0 52px;
    }

    header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      align-items: end;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--line);
    }

    .eyebrow {
      color: var(--rust);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
    }

    h1 {
      margin: 4px 0 0;
      font-size: 32px;
      line-height: 1.18;
      letter-spacing: 0;
    }

    .updated {
      margin: 7px 0 0;
      color: var(--muted);
    }

    .stats {
      display: flex;
      gap: 22px;
      align-items: end;
    }

    .stat b {
      display: block;
      font-size: 22px;
      line-height: 1.15;
    }

    .stat span {
      color: var(--muted);
      font-size: 12px;
    }

    .hot-link {
      height: 36px;
      display: inline-flex;
      align-items: center;
      color: var(--teal);
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
    }

    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: grid;
      grid-template-columns: minmax(230px, 1fr) auto;
      gap: 12px;
      padding: 14px 0;
      background: rgba(244, 246, 247, .96);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--line);
    }

    .search {
      height: 40px;
      min-width: 0;
      padding: 0 12px;
      color: var(--text);
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 6px;
      outline: none;
    }

    .search:focus { border-color: var(--teal); }

    .controls {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    select, .favorite-filter {
      height: 40px;
      padding: 0 10px;
      color: var(--text);
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 6px;
    }

    .favorite-filter { cursor: pointer; }

    .favorite-filter.active {
      color: #fff;
      background: var(--gold);
      border-color: var(--gold);
    }

    .tabs {
      display: flex;
      gap: 8px;
      padding: 14px 0 18px;
      overflow-x: auto;
      scrollbar-width: thin;
    }

    .tab {
      height: 34px;
      padding: 0 11px;
      color: var(--text);
      background: transparent;
      border: 1px solid var(--line);
      border-radius: 6px;
      cursor: pointer;
      white-space: nowrap;
    }

    .tab.active {
      color: #fff;
      background: var(--text);
      border-color: var(--text);
    }

    .result-bar {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 12px;
      color: var(--muted);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .project-card {
      min-width: 0;
      overflow: hidden;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 6px 20px rgba(23, 33, 38, .06);
    }

    .media {
      position: relative;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      background: #dfe8e9;
    }

    .media img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .media-fallback {
      display: none;
      width: 100%;
      height: 100%;
      place-items: center;
      color: var(--teal);
      font-size: 18px;
      font-weight: 800;
    }

    .media.image-failed img { display: none; }
    .media.image-failed .media-fallback { display: grid; }

    .favorite {
      position: absolute;
      top: 9px;
      right: 9px;
      width: 34px;
      height: 34px;
      padding: 0;
      border: 1px solid rgba(255,255,255,.8);
      border-radius: 50%;
      color: var(--text);
      background: rgba(255,255,255,.92);
      box-shadow: 0 3px 12px rgba(0,0,0,.14);
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
    }

    .favorite.active {
      color: #fff;
      background: var(--gold);
      border-color: var(--gold);
    }

    .project-body { padding: 14px; }

    .meta-row {
      min-height: 23px;
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      align-items: center;
      color: var(--muted);
      font-size: 12px;
    }

    .stage {
      padding: 2px 7px;
      color: var(--green);
      background: #e9f3ed;
      border-radius: 4px;
      font-weight: 700;
    }

    .project-card h2 {
      min-height: 47px;
      margin: 9px 0 0;
      font-size: 17px;
      line-height: 1.38;
      letter-spacing: 0;
      overflow-wrap: anywhere;
    }

    .original-title {
      min-height: 38px;
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .summary {
      min-height: 66px;
      margin: 10px 0 0;
      color: #46545c;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .reasons {
      min-height: 22px;
      margin: 10px 0 0;
      color: var(--violet);
      font-size: 12px;
      font-weight: 700;
    }

    .project-footer {
      min-height: 39px;
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: end;
      margin-top: 12px;
      padding-top: 11px;
      border-top: 1px solid #edf0f2;
    }

    .source {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 5px;
      color: var(--muted);
      font-size: 11px;
      overflow-wrap: anywhere;
    }

    .source img {
      width: 16px;
      height: 16px;
      flex: 0 0 auto;
    }

    .user-score {
      padding: 2px 7px;
      color: #8a5a00;
      background: #fff3d6;
      border-radius: 4px;
      font-weight: 700;
    }

    .card-links {
      display: flex;
      gap: 10px;
      flex: 0 0 auto;
      align-items: center;
    }

    .score-link {
      color: var(--muted);
    }

    .project-footer a {
      color: var(--teal);
      font-weight: 800;
      text-decoration: none;
      white-space: nowrap;
    }

    .hidden { display: none !important; }

    .empty {
      display: none;
      padding: 48px 16px;
      color: var(--muted);
      text-align: center;
      border-top: 1px solid var(--line);
    }

    @media (max-width: 1020px) {
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      header { grid-template-columns: 1fr; }
      .stats { justify-content: space-between; }
    }

    @media (max-width: 720px) {
      .shell { width: min(100% - 20px, 1280px); padding-top: 18px; }
      .toolbar { grid-template-columns: 1fr; }
      .controls { justify-content: flex-start; }
      .grid { grid-template-columns: 1fr; }
      .stats { gap: 12px; flex-wrap: wrap; }
      .stat { min-width: 72px; }
      h1 { font-size: 27px; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div>
        <div class="eyebrow">Imaging Innovation Library</div>
        <h1>创新影像产品项目库</h1>
        <p class="updated">更新于 ${escapeHtml(formatDate(generatedAt, true))}</p>
      </div>
      <div class="stats" aria-label="项目统计">
        <div class="stat"><b>${projects.length}</b><span>创新项目</span></div>
        <div class="stat"><b>${categories.length}</b><span>产品方向</span></div>
        <div class="stat"><b>${newThisRun}</b><span>本次新增</span></div>
        <div class="stat"><b>${sourceCount}</b><span>有效来源</span></div>
        <a class="hot-link" href="./imaging-hot-report.html">查看行业 Hot</a>
      </div>
    </header>

    <div class="toolbar">
      <input id="search" class="search" type="search" placeholder="搜索产品、品牌、技术或来源">
      <div class="controls">
        <select id="stage" aria-label="项目阶段">
          <option value="全部">全部阶段</option>
          ${[...new Set(projects.map((project) => project.projectStage))].map((stage) => `<option value="${escapeHtml(stage)}">${escapeHtml(stage)}</option>`).join("")}
        </select>
        <select id="format" aria-label="产品形式">
          <option value="全部">全部形式</option>
          ${[...new Set(projects.map((project) => project.projectFormat))].map((format) => `<option value="${escapeHtml(format)}">${escapeHtml(format)}</option>`).join("")}
        </select>
        <select id="sort" aria-label="排序">
          <option value="latest">最新发现</option>
          <option value="score">创新度最高</option>
        </select>
        <button id="favoritesOnly" class="favorite-filter" type="button">★ 收藏</button>
      </div>
    </div>

    <div class="tabs" id="tabs">
      <button class="tab active" data-category="全部">全部 · ${projects.length}</button>
      ${categories.map((category) => `<button class="tab" data-category="${escapeHtml(category)}">${escapeHtml(category)} · ${escapeHtml(categoryCounts[category])}</button>`).join("")}
    </div>

    <div class="result-bar">
      <span id="resultCount">${projects.length} 个项目</span>
      <span>严格项目筛选 · 同产品报道合并</span>
    </div>

    <section class="grid" id="grid">
      ${projects.map(projectCard).join("")}
    </section>
    <div id="empty" class="empty">当前筛选下没有项目</div>
  </main>

  <script>
    const projects = ${projectJson};
    const grid = document.querySelector("#grid");
    const cards = [...document.querySelectorAll(".project-card")];
    const search = document.querySelector("#search");
    const stage = document.querySelector("#stage");
    const format = document.querySelector("#format");
    const sort = document.querySelector("#sort");
    const favoritesOnly = document.querySelector("#favoritesOnly");
    const tabs = [...document.querySelectorAll(".tab")];
    const resultCount = document.querySelector("#resultCount");
    const empty = document.querySelector("#empty");
    const storageKey = "aihot-innovation-favorites";
    let activeCategory = "全部";
    let onlyFavorites = false;
    let favorites = new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"));

    function updateFavoriteButtons() {
      for (const card of cards) {
        const button = card.querySelector(".favorite");
        const active = favorites.has(card.dataset.id);
        button.classList.toggle("active", active);
        button.textContent = active ? "★" : "☆";
        button.setAttribute("aria-label", active ? "取消收藏" : "收藏项目");
        button.title = active ? "取消收藏" : "收藏项目";
      }
    }

    function applyFilters() {
      const query = search.value.trim().toLowerCase();
      let visible = 0;
      for (const card of cards) {
        const matchesCategory = activeCategory === "全部" || card.dataset.category === activeCategory;
        const matchesStage = stage.value === "全部" || card.dataset.stage === stage.value;
        const matchesFormat = format.value === "全部" || card.dataset.format === format.value;
        const matchesSearch = !query || card.dataset.search.includes(query);
        const matchesFavorite = !onlyFavorites || favorites.has(card.dataset.id);
        const show = matchesCategory && matchesStage && matchesFormat && matchesSearch && matchesFavorite;
        card.classList.toggle("hidden", !show);
        if (show) visible += 1;
      }
      resultCount.textContent = visible + " 个项目";
      empty.style.display = visible ? "none" : "block";
    }

    function applySort() {
      const sorted = [...cards].sort((a, b) => {
        if (sort.value === "score") return Number(b.dataset.score) - Number(a.dataset.score);
        return String(b.dataset.date).localeCompare(String(a.dataset.date));
      });
      for (const card of sorted) grid.appendChild(card);
    }

    for (const tab of tabs) {
      tab.addEventListener("click", () => {
        activeCategory = tab.dataset.category;
        tabs.forEach((item) => item.classList.toggle("active", item === tab));
        applyFilters();
      });
    }

    for (const card of cards) {
      card.querySelector(".favorite").addEventListener("click", () => {
        if (favorites.has(card.dataset.id)) favorites.delete(card.dataset.id);
        else favorites.add(card.dataset.id);
        localStorage.setItem(storageKey, JSON.stringify([...favorites]));
        updateFavoriteButtons();
        applyFilters();
      });
    }

    search.addEventListener("input", applyFilters);
    stage.addEventListener("change", applyFilters);
    format.addEventListener("change", applyFilters);
    sort.addEventListener("change", applySort);
    favoritesOnly.addEventListener("click", () => {
      onlyFavorites = !onlyFavorites;
      favoritesOnly.classList.toggle("active", onlyFavorites);
      applyFilters();
    });

    updateFavoriteButtons();
  </script>
</body>
</html>`;

await fs.writeFile(outputHtmlPath, html.replace(/[ \t]+$/gm, ""), "utf8");

console.log(`Innovation library: ${projects.length} projects (${newThisRun} new, ${candidates.length} accepted this run).`);
console.log(`Saved ${outputDataPath}`);
console.log(`Saved ${outputHtmlPath}`);
