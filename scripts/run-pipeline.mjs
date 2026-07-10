import { spawn } from "node:child_process";

function run(command, args, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    child.on("exit", (code) => {
      if (code === 0 || allowFailure) {
        resolve(code);
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
      }
    });

    child.on("error", reject);
  });
}

const fetchCode = await run("node", ["scripts/fetch-feeds.mjs"], { allowFailure: true });
if (fetchCode !== 0) {
  console.warn("Fetch finished with source warnings; continuing with successfully fetched items.");
}

await run("node", ["scripts/dedupe-items.mjs"]);
await run("node", ["scripts/verify-dedupe.mjs"]);
