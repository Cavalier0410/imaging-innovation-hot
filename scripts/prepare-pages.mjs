import { access, copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function preparePages({ dataDir, outputDir }) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await copyFile(path.join(dataDir, "innovation-product-library.html"), path.join(outputDir, "index.html"));
  await copyFile(path.join(dataDir, "imaging-hot-report.html"), path.join(outputDir, "hot.html"));
  await copyFile(
    path.join(dataDir, "imaging-hot-report.html"),
    path.join(outputDir, "imaging-hot-report.html")
  );

  const feedPath = path.join(dataDir, "feed.xml");
  if (await exists(feedPath)) {
    await copyFile(feedPath, path.join(outputDir, "feed.xml"));
  }

  await writeFile(path.join(outputDir, ".nojekyll"), "");
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const root = process.cwd();
  await preparePages({
    dataDir: path.join(root, "data"),
    outputDir: path.join(root, "_site")
  });
  console.log("Prepared GitHub Pages artifact in _site/.");
}
