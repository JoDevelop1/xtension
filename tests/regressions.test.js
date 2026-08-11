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
  assert.equal(readConstant(background, "REPLY_AI_CONFIG_VERSION"), "21");
  assert.equal(readConstant(background, "DEFAULT_CODEX_REASONING_EFFORT"), '"low"');
});

test("generated text keeps one blank line between short paragraphs", () => {
  const content = read("src/content.js");
  const cleanStart = content.indexOf("  function cleanMultilineText");
  const normalizeStart = content.indexOf("  function normalizeUrlFragments", cleanStart);
  const normalizeEnd = content.indexOf("\n  function extractVisibleText", normalizeStart);
  assert.ok(cleanStart >= 0 && normalizeStart > cleanStart && normalizeEnd > normalizeStart);
  const source = `${content.slice(cleanStart, normalizeStart)}\n${content.slice(normalizeStart, normalizeEnd)}\nreturn cleanMultilineText;`;
  const cleanMultilineText = new Function(source)();
  assert.equal(
    cleanMultilineText("Premier paragraphe.  \r\n \r\n Deuxième paragraphe.\n\n\nTroisième."),
    "Premier paragraphe.\n\nDeuxième paragraphe.\n\nTroisième."
  );
});

test("generation prompts request airy paragraphs without changing corrections", () => {
  const background = read("src/background.js");
  const options = read("src/options.js");
  const bridge = read("scripts/xtension-ai-bridge.js");
  assert.match(background, /DEFAULT_GENERATE_PROMPT[^;]+exactly one blank line/);
  assert.match(options, /DEFAULT_GENERATE_PROMPT[^;]+exactly one blank line/);
  assert.match(bridge, /When the reply contains more than one sentence or idea[\s\S]{0,220}exactly one blank line/);
  assert.match(bridge, /Keep exactly the same number of lines and the same line-break positions as the draft/);
});

test("latency optimizations refill threads and share context image work", () => {
  const background = read("src/background.js");
  const bridge = read("scripts/xtension-ai-bridge.js");
  assert.match(background, /const contextImageCache = new Map\(\)/);
  assert.match(background, /contextImageCache\.set\(smallUrl, \{ at: now, promise \}\)/);
  assert.match(bridge, /this\.spareThreadPromise/);
  assert.match(bridge, /this\.prewarmThread\(selectedModel\)\.catch\(\(\) => \{\}\)/);
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

test("the Windows connector builds, signs, packages, and installs the native input helper", () => {
  const packageJson = require(path.join(root, "package.json"));
  const release = packageJson.scripts["bridge:release"];
  const installerBuild = read("scripts/build-bridge-installer.ps1");
  const installer = read("bridge-installer/Program.cs");
  const signing = read("scripts/sign-bridge.ps1");

  assert.match(release, /bridge:input:build/);
  assert.ok(release.indexOf("bridge:input:build") < release.indexOf("bridge:sign"));
  assert.match(installerBuild, /bridge-input\\XtensionInput\.exe/);
  assert.match(installer, /File\.Copy\([^\n]+XtensionInput\.exe/);
  assert.match(signing, /bridge-input\\XtensionInput\.exe/);
});

test("native draft insertion uses SendInput targeting and never silently falls back after an advertised attempt", () => {
  const helper = read("bridge-input/Program.cs");
  const bridge = read("scripts/xtension-ai-bridge.js");
  const content = read("src/content.js");

  assert.match(helper, /KeyEventUnicode = 0x0004/);
  assert.match(helper, /SendInput\(\(uint\)nativeInputs\.Length/);
  assert.match(helper, /GetGUIThreadInfo/);
  assert.match(helper, /target_marker_mismatch/);
  assert.match(bridge, /nativeTypeIsAvailable\(\)/);
  assert.match(bridge, /expectedWindowMarker[\s\S]{0,180}expectedBrowser/);
  assert.match(content, /type: "xtension-native-type-capability"/);
  assert.match(content, /document\.title = expectedWindowMarker/);
  assert.match(content, /createNativeWindowMarker\(\)/);
  assert.match(content, /if \(nativeResult\.available\)[\s\S]{0,180}return false;/);

  const streamStart = content.indexOf("  function streamGenerateReplyText");
  const streamEnd = content.indexOf("\n  async function transformReplyText", streamStart);
  assert.ok(streamStart >= 0 && streamEnd > streamStart);
  assert.doesNotMatch(content.slice(streamStart, streamEnd), /applyDraftTextViaBridge/);
});
