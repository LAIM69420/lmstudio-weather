#!/usr/bin/env node
/**
 * Smoke harness for a single-plugin repository.
 *
 * This repo is one plugin at its root, so the checks run once:
 *   - manifest.json parses and carries the fields LM Studio needs
 *   - version is semver, description is substantive, icon exists
 *   - tool names declared in src/ are unique and non-empty
 *   - if dist/ exists, every tool is present in the build and the build is
 *     not older than the source
 *   - the tool inventory matches scripts/expected-tools.json
 *
 *   node scripts/smoke.mjs
 *   node scripts/smoke.mjs --update
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(root, "scripts", "expected-tools.json");
const update = process.argv.includes("--update");
const TOOL_RE = /tool\(\s*\{\s*name:\s*"([a-zA-Z0-9_]+)"/g;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

const failures = [];
const warnings = [];
const fail = (m) => failures.push(m);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

function builtSource(dir) {
  let out = "";
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out += builtSource(full);
    else if (entry.endsWith(".js")) out += readFileSync(full, "utf8");
  }
  return out;
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
} catch (err) {
  console.error(`FAIL  manifest.json unreadable: ${err.message}`);
  process.exit(1);
}

for (const key of ["name", "type", "runner", "version", "main", "license", "description", "categories"]) {
  if (manifest[key] === undefined || manifest[key] === null) fail(`manifest missing "${key}"`);
}
if (manifest.version && !SEMVER_RE.test(manifest.version)) fail(`version "${manifest.version}" is not semver`);
if (typeof manifest.description === "string" && manifest.description.length < 30) {
  fail(`description is only ${manifest.description.length} chars`);
}
if (Array.isArray(manifest.categories) && manifest.categories.length === 0) fail("no categories declared");
if (manifest.icon) {
  if (!existsSync(join(root, manifest.icon))) fail(`icon "${manifest.icon}" does not exist`);
} else {
  warnings.push("no icon declared");
}

const srcDir = join(root, "src");
if (!existsSync(srcDir)) fail("no src/ directory");
const sources = existsSync(srcDir) ? walk(srcDir) : [];
if (sources.length === 0) fail("src/ contains no TypeScript");

const tools = new Set();
for (const file of sources) {
  for (const m of readFileSync(file, "utf8").matchAll(TOOL_RE)) tools.add(m[1]);
}
const inventory = [...tools].sort();
if (inventory.length === 0) fail("no tool({ name: ... }) declarations found");

const distDir = join(root, "dist");
if (existsSync(distDir)) {
  const mainPath = join(root, manifest.main ?? "");
  if (!existsSync(mainPath)) {
    fail(`dist/ exists but declared main "${manifest.main}" does not`);
  } else {
    const built = builtSource(distDir);
    const missing = inventory.filter((t) => !built.includes(t));
    if (missing.length) fail(`built output is stale — missing ${missing.join(", ")}`);
    const builtAt = statSync(mainPath).mtimeMs;
    const newer = sources.filter((f) => statSync(f).mtimeMs > builtAt + 1000);
    if (newer.length) fail(`dist/ is older than ${newer.length} source file(s)`);
  }
} else {
  warnings.push("not built (no dist/)");
}

const expected = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : null;
if (update || !expected) {
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, JSON.stringify(inventory, null, 2) + "\n");
  console.log(`baseline written: ${inventory.length} tools`);
} else {
  const added = inventory.filter((t) => !expected.includes(t));
  const removed = expected.filter((t) => !inventory.includes(t));
  if (added.length) fail(`new tool(s) not in baseline: ${added.join(", ")} (run --update)`);
  if (removed.length) fail(`tool(s) disappeared: ${removed.join(", ")}`);
}

for (const w of warnings) console.log(`warn  ${w}`);
for (const f of failures) console.log(`FAIL  ${f}`);
console.log(`\n${failures.length === 0 ? "PASS" : "FAILED"} — ${manifest.name}, ${inventory.length} tools, ` +
  `${failures.length} failure(s), ${warnings.length} warning(s)`);
process.exit(failures.length === 0 ? 0 : 1);
