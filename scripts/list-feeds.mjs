import fs from "node:fs/promises";
import path from "node:path";

const sourcePath = path.resolve(process.env.AIHOT_SOURCES_FILE || "sources/imaging-products-rss.json");
const sourceFile = JSON.parse(await fs.readFile(sourcePath, "utf8"));

const groups = new Map();
for (const source of sourceFile.sources) {
  const key = `${source.priority} ${source.category}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(source);
}

console.log(`${sourceFile.name}`);
console.log(`Verified at: ${sourceFile.verifiedAt}`);
console.log(`Total sources: ${sourceFile.sources.length}`);
console.log("");

for (const [group, sources] of [...groups.entries()].sort()) {
  console.log(`[${group}]`);
  for (const source of sources) {
    console.log(`- ${source.name}: ${source.feedUrl}`);
  }
  console.log("");
}
