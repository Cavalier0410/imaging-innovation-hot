import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function preparePages({ dataDir, outputDir }) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await copyFile(path.join(dataDir, "innovation-product-library.html"), path.join(outputDir, "index.html"));
  await copyFile(path.join(dataDir, "imaging-hot-report.html"), path.join(outputDir, "hot.html"));
  await copyFile(
    path.join(dataDir, "imaging-hot-report.html"),
    path.join(outputDir, "imaging-hot-report.html")
  );
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
