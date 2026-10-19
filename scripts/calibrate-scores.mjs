import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dataDir = path.join(root, "data");
const projectsPath = path.join(dataDir, "innovation-projects.json");
const feedbackPath = path.join(dataDir, "feedback.json");
const profilePath = path.join(dataDir, "scoring-profile.json");

const LAMBDA = Number(process.env.CALIBRATION_LAMBDA || 2);
const HALF_LIFE_DAYS = Number(process.env.CALIBRATION_HALF_LIFE_DAYS || 120);
const MAX_COEF = Number(process.env.CALIBRATION_MAX_COEF || 15);
const MIN_SAMPLES = Number(process.env.CALIBRATION_MIN_SAMPLES || 3);
const MAX_RESIDUAL = Number(process.env.CALIBRATION_MAX_RESIDUAL || 35);
const MAX_ADJUSTMENT = Number(process.env.CALIBRATION_MAX_ADJUSTMENT || 20);

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function scoreBin(score) {
  if (score < 80) return "70-79";
  if (score < 90) return "80-89";
  return "90-100";
}

function solve(matrix, vector) {
  const size = vector.length;
  const a = matrix.map((row) => [...row]);
  const b = [...vector];

  for (let col = 0; col < size; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < size; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];

    const divisor = a[col][col] || 1e-9;
    for (let row = col + 1; row < size; row += 1) {
      const factor = a[row][col] / divisor;
      if (!factor) continue;
      for (let k = col; k < size; k += 1) a[row][k] -= factor * a[col][k];
      b[row] -= factor * b[col];
    }
  }

  const solution = new Array(size).fill(0);
  for (let row = size - 1; row >= 0; row -= 1) {
    let sum = b[row];
    for (let col = row + 1; col < size; col += 1) sum -= a[row][col] * solution[col];
    solution[row] = sum / (a[row][row] || 1e-9);
  }
  return solution;
}

const projectsData = await readJson(projectsPath, { projects: [] });
const feedbackData = await readJson(feedbackPath, { items: [] });
const projectMap = new Map((projectsData.projects || []).map((project) => [project.id, project]));

// 同一个项目被反复打分时，只取最新一次，避免重复计入。
const latestByProject = new Map();
for (const item of feedbackData.items || []) {
  if (!item.projectId) continue;
  const previous = latestByProject.get(item.projectId);
  if (!previous || String(item.createdAt || "") > String(previous.createdAt || "")) {
    latestByProject.set(item.projectId, item);
  }
}

const samples = [];
for (const item of latestByProject.values()) {
  const project = projectMap.get(item.projectId);
  if (!project) continue;

  const userScore = Number(item.userScore);
  if (!Number.isFinite(userScore) || userScore < 0 || userScore > 100) continue;

  const baseScore = Number(item.baseScore ?? project.baseScore ?? project.innovationScore ?? 0);
  const residual = clamp(userScore - baseScore, -MAX_RESIDUAL, MAX_RESIDUAL);
  const createdAt = new Date(item.createdAt || Date.now());
  const ageDays = Math.max(0, (Date.now() - createdAt.getTime()) / 86400000);
  const weight = Math.max(0.25, 0.5 ** (ageDays / HALF_LIFE_DAYS));

  samples.push({
    projectId: item.projectId,
    userScore,
    baseScore,
    residual,
    weight,
    category: project.projectCategory || "未分类",
    source: project.source?.name || "未知来源",
    bin: scoreBin(baseScore)
  });
}

const categories = [...new Set(samples.map((sample) => sample.category))];
const sources = [...new Set(samples.map((sample) => sample.source))];
const bins = ["70-79", "80-89", "90-100"];

let intercept = 0;
let category = {};
let source = {};
let bin = {};

const active = samples.length >= MIN_SAMPLES;

if (active) {
  const dimensions = 1 + categories.length + sources.length + bins.length;
  const matrix = Array.from({ length: dimensions }, () => new Array(dimensions).fill(0));
  const vector = new Array(dimensions).fill(0);

  for (const sample of samples) {
    const features = [
      1,
      ...categories.map((value) => (value === sample.category ? 1 : 0)),
      ...sources.map((value) => (value === sample.source ? 1 : 0)),
      ...bins.map((value) => (value === sample.bin ? 1 : 0))
    ];
    const weight = sample.weight;

    for (let row = 0; row < dimensions; row += 1) {
      vector[row] += weight * features[row] * sample.residual;
      for (let col = 0; col < dimensions; col += 1) {
        matrix[row][col] += weight * features[row] * features[col];
      }
    }
  }

  // 截距不惩罚，其余特征做 ridge 收缩，样本少时更稳。
  for (let index = 1; index < dimensions; index += 1) matrix[index][index] += LAMBDA;

  const beta = solve(matrix, vector);
  intercept = clamp(beta[0], -MAX_COEF, MAX_COEF);
  category = Object.fromEntries(
    categories.map((value, index) => [value, clamp(beta[1 + index], -MAX_COEF, MAX_COEF)])
  );
  source = Object.fromEntries(
    sources.map((value, index) => [
      value,
      clamp(beta[1 + categories.length + index], -MAX_COEF, MAX_COEF)
    ])
  );
  bin = Object.fromEntries(
    bins.map((value, index) => [
      value,
      clamp(beta[1 + categories.length + sources.length + index], -MAX_COEF, MAX_COEF)
    ])
  );
}

const meanResidual = samples.length
  ? samples.reduce((sum, sample) => sum + sample.residual, 0) / samples.length
  : 0;

const profile = {
  generatedAt: new Date().toISOString(),
  status: active ? "active" : "insufficient",
  method: "weighted-ridge",
  lambda: LAMBDA,
  halfLifeDays: HALF_LIFE_DAYS,
  sampleCount: samples.length,
  minSamples: MIN_SAMPLES,
  meanResidual: Number(meanResidual.toFixed(2)),
  intercept: Number(intercept.toFixed(2)),
  maxAdjustment: MAX_ADJUSTMENT,
  category: Object.fromEntries(Object.entries(category).map(([key, value]) => [key, Number(value.toFixed(2))])),
  source: Object.fromEntries(Object.entries(source).map(([key, value]) => [key, Number(value.toFixed(2))])),
  bin: Object.fromEntries(Object.entries(bin).map(([key, value]) => [key, Number(value.toFixed(2))])),
  samples: samples.map((sample) => ({
    projectId: sample.projectId,
    userScore: sample.userScore,
    baseScore: sample.baseScore,
    residual: sample.residual,
    weight: Number(sample.weight.toFixed(3))
  }))
};

await writeFile(profilePath, JSON.stringify(profile, null, 2), "utf8");

console.log(
  `Calibration ${profile.status}: ${profile.sampleCount} sample(s), mean residual ${profile.meanResidual}, intercept ${profile.intercept}.`
);
if (active) {
  console.log("Category:", JSON.stringify(profile.category));
  console.log("Source:", JSON.stringify(profile.source));
  console.log("Bin:", JSON.stringify(profile.bin));
}
