import fs from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve("data");

async function readJson(name) {
  return JSON.parse(await fs.readFile(path.join(dataDir, name), "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const [allData, selectedData, clustersData, hotTopicsData, report] = await Promise.all([
  readJson("items.all.json"),
  readJson("items.selected.json"),
  readJson("clusters.latest.json"),
  readJson("hot-topics.json"),
  readJson("dedupe-report.json")
]);

const all = allData.items || [];
const selected = selectedData.items || [];
const clusters = clustersData.clusters || [];
const hotTopics = hotTopicsData.items || [];
const allIds = new Set(all.map((item) => item.id));
const clusterIds = new Set(clusters.map((cluster) => cluster.id));
const seenUrls = new Map();

assert(all.length === report.allCount, "items.all.json count does not match dedupe-report.json");
assert(selected.length === report.selectedCount, "items.selected.json count does not match dedupe-report.json");
assert(clusters.length === report.clusterCount, "clusters.latest.json count does not match dedupe-report.json");
assert(hotTopics.length === report.hotTopicCount, "hot-topics.json count does not match dedupe-report.json");

for (const item of all) {
  assert(!item.duplicateOfId, `all pool contains a hard duplicate: ${item.id}`);
  assert(item.domainRelevance >= report.thresholds.allMinDomainRelevance, `all item below relevance threshold: ${item.id}`);
  assert(item.clusterId && clusterIds.has(item.clusterId), `all item missing valid clusterId: ${item.id}`);

  if (item.normalizedUrl) {
    const existing = seenUrls.get(item.normalizedUrl);
    assert(!existing, `duplicate normalizedUrl in all pool: ${item.normalizedUrl}`);
    seenUrls.set(item.normalizedUrl, item.id);
  }
}

for (const item of selected) {
  assert(allIds.has(item.id), `selected item not found in all pool: ${item.id}`);
  assert(item.selected === true, `selected item missing selected=true: ${item.id}`);
  assert(item.clusterRole === "primary", `selected item is not cluster primary: ${item.id}`);
  assert(item.domainRelevance >= report.thresholds.selectedMinDomainRelevance, `selected item below relevance threshold: ${item.id}`);
  assert(item.score >= report.thresholds.selectedMinScore, `selected item below score threshold: ${item.id}`);
  assert(item.emergingScore >= report.thresholds.selectedMinEmergingScore, `selected item below emerging threshold: ${item.id}`);
}

for (const topic of hotTopics) {
  assert(clusterIds.has(topic.id), `hot topic missing cluster: ${topic.id}`);
  assert(
    topic.itemCount >= 2 || topic.sourceCount >= 2 || topic.emergingScore >= report.thresholds.hotStandaloneMinEmergingScore,
    `hot topic has no cluster or emerging signal: ${topic.id}`
  );
  assert(topic.primaryItemId, `hot topic missing primary item: ${topic.id}`);
}

console.log("Dedupe verification OK");
console.log(`All: ${all.length}, selected: ${selected.length}, clusters: ${clusters.length}, hot topics: ${hotTopics.length}`);
