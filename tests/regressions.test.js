"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("all JavaScript release builders use package.json as their version source", () => {
  const packageVersion = require(path.join(root, "package.json")).version;
  const sharedVersion = require(path.join(root, "scripts", "version.js")).version;
  assert.equal(sharedVersion, packageVersion);
  assert.match(read("scripts/build.js"), /require\("\.\/version"\)/);
  assert.match(read("scripts/xtension-ai-bridge.js"), /require\("\.\/version"\)/);
  assert.doesNotMatch(read("scripts/build.js"), /const version = "\d+\.\d+\.\d+"/);
  assert.doesNotMatch(read("scripts/xtension-ai-bridge.js"), /CODEX_CLIENT_VERSION = "\d+\.\d+\.\d+"/);
});

test("browser release ZIP entries use a cross-platform deterministic order", () => {
  const build = read("scripts/build.js");
  assert.match(build, /path\.relative\(dir, left\)\.replace/);
  assert.match(build, /Buffer\.compare\(Buffer\.from\(leftName, "utf8"\), Buffer\.from\(rightName, "utf8"\)\)/);
});

test("the Windows installer records its built product version", () => {
  const installer = read("bridge-installer/Program.cs");
  assert.match(installer, /key\.SetValue\("DisplayVersion", ProductVersion\)/);
  assert.match(installer, /AssemblyInformationalVersionAttribute/);
  assert.doesNotMatch(installer, /key\.SetValue\("DisplayVersion", "\d+\.\d+\.\d+"\)/);
});

test("diagnostic logs have isolated selection and direct copy controls", () => {
  const html = read("src/options.html");
  const css = read("src/options.css");
  const javascript = read("src/options.js");
  assert.match(html, /id="reply-ai-logs-copy"/);
  assert.match(html, /<textarea[^>]+id="reply-ai-logs-output"[^>]+readonly/);
  assert.match(css, /\.diagnostic-log-output[\s\S]*user-select: text/);
  assert.match(css, /\.inline-actions button[\s\S]*user-select: none/);
  assert.match(javascript, /navigator\.clipboard\.writeText\(diagnosticLogText\)/);
});

test("options and background use the same configuration generation", () => {
  const options = read("src/options.js");
  const background = read("src/background.js");
  const readConstant = (source, name) => source.match(new RegExp(`const ${name} = ([^;]+);`))?.[1];
  assert.equal(readConstant(options, "REPLY_AI_CONFIG_VERSION"), readConstant(background, "REPLY_AI_CONFIG_VERSION"));
  assert.equal(readConstant(options, "DEFAULT_CODEX_REASONING_EFFORT"), readConstant(background, "DEFAULT_CODEX_REASONING_EFFORT"));
});

test("AI operations reject an unversioned legacy connector", () => {
  const background = read("src/background.js");
  assert.match(background, /async function ensureCompatibleBridge/);
  assert.match(background, /bridgeCompatibilityCache\.compatible[\s\S]{0,160}return bridgeCompatibilityCache\.version/);
  assert.doesNotMatch(background, /!bridgeCompatibilityCache\.compatible/);
  assert.match(background, /error\.code = "bridge_update_required"/);
  assert.match(background, /installedVersion: version \|\| "unknown"/);
});

test("image generation no longer has a five-minute default cutoff", () => {
  const bridge = read("scripts/xtension-ai-bridge.js");
  assert.match(bridge, /CODEX_IMAGE_TIMEOUT_MS[\s\S]{0,180}10 \* 60 \* 1000/);
  assert.match(bridge, /findImageGenerationItem\(turn\.items\)/);
  assert.match(bridge, /message\.method === "error"/);
});
