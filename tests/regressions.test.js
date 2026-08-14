"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

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
  assert.equal(readConstant(background, "REPLY_AI_CONFIG_VERSION"), "24");
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

test("generation prompts request an unbounded number of airy paragraphs without changing corrections", () => {
  const background = read("src/background.js");
  const options = read("src/options.js");
  const bridge = read("scripts/xtension-ai-bridge.js");
  const content = read("src/content.js");
  assert.match(background, /DEFAULT_GENERATE_PROMPT[^;]+Use as many short paragraphs as the content needs/);
  assert.match(options, /DEFAULT_GENERATE_PROMPT[^;]+Use as many short paragraphs as the content needs/);
  assert.match(bridge, /Keep the reply visually airy[\s\S]{0,420}never target a fixed paragraph count/);
  assert.doesNotMatch(bridge, /two or three short paragraphs/);
  assert.match(content, /function sanitizeDisplayedReplyText\(value\) \{\s+return cleanMultilineText\(value\)/);
  assert.match(bridge, /Keep exactly the same number of lines and the same line-break positions as the draft/);
});

test("reply language follows only the post text currently displayed by X", () => {
  const content = read("src/content.js");
  const start = content.indexOf("  function resolveDisplayedTweetLanguage");
  const end = content.indexOf("\n  function collectReplyLinkCards", start);
  assert.ok(start >= 0 && end > start);
  const normalizeLanguageCode = (value) => String(value || "").toLowerCase().split(/[-_]/)[0];
  const resolveWithAttribute = new Function(
    "normalizeLanguageCode",
    "findTweetLanguage",
    "inferDraftLanguage",
    `${content.slice(start, end)}\nreturn resolveDisplayedTweetLanguage;`
  )(normalizeLanguageCode, () => "ja", () => "en");
  const resolveWithInference = new Function(
    "normalizeLanguageCode",
    "findTweetLanguage",
    "inferDraftLanguage",
    `${content.slice(start, end)}\nreturn resolveDisplayedTweetLanguage;`
  )(normalizeLanguageCode, () => "", (value) => /bonjour/i.test(value) ? "fr" : "");

  assert.equal(resolveWithAttribute({}, {}, "English-looking text"), "ja");
  assert.equal(resolveWithInference({}, {}, "Bonjour à tous"), "fr");
  assert.equal(resolveWithInference({}, {}, "12345"), "");
  assert.doesNotMatch(content, /ensureOriginalTweetTextVisible|findTranslationSourceLanguage|findShowOriginalTweetButton/);
  assert.doesNotMatch(content, /translationDetected|originalTextRestored|source_language_unavailable/);
  assert.match(content, /contextText \? "unknown"/);
  assert.match(content, /tweetLanguageSource: explicitTweetLanguage \? "tweet_lang"/);
});

test("reply dialogs use the closest preceding post instead of the first post in a thread", () => {
  const content = read("src/content.js");
  const start = content.indexOf("  function findClosestPrecedingReplyTweet");
  const end = content.indexOf("\n  function findNearestPreviousTweetForReplyEditor", start);
  assert.ok(start >= 0 && end > start);
  const Node = { DOCUMENT_POSITION_FOLLOWING: 4 };
  const findClosestPrecedingReplyTweet = new Function(
    "Node",
    `${content.slice(start, end)}\nreturn findClosestPrecedingReplyTweet;`
  )(Node);
  const editor = {};
  const firstPost = { compareDocumentPosition: () => 4 };
  const repliedToComment = { compareDocumentPosition: () => 4 };
  const laterPost = { compareDocumentPosition: () => 0 };
  assert.equal(
    findClosestPrecedingReplyTweet([firstPost, repliedToComment, laterPost], editor),
    repliedToComment
  );
  assert.doesNotMatch(content, /target\?\._xtensionReplyContext/);
});

test("X relationship data is exposed as a minimal following map for timeline badges", async () => {
  const attributes = new Map();
  const document = {
    documentElement: {
      setAttribute: (name, value) => attributes.set(name, value)
    },
    addEventListener: () => {},
    dispatchEvent: () => {},
    querySelectorAll: () => []
  };
  function XMLHttpRequest() {}
  XMLHttpRequest.prototype.open = function open() {};
  XMLHttpRequest.prototype.send = function send() {};
  XMLHttpRequest.prototype.addEventListener = function addEventListener() {};
  const response = {
    ok: true,
    url: "https://x.com/i/api/graphql/example/HomeTimeline",
    headers: { get: () => "application/json" },
    clone: () => ({
      json: async () => ({
        data: {
          followed: {
            core: { screen_name: "FollowedAuthor" },
            relationship_perspectives: { following: true }
          },
          stranger: {
            legacy: { screen_name: "OtherAuthor", following: false }
          },
          unknown: {
            core: { screen_name: "UnknownAuthor" }
          }
        }
      })
    })
  };
  const context = vm.createContext({
    window: {
      location: { href: "https://x.com/home" },
      fetch: async () => response,
      XMLHttpRequest
    },
    document,
    Event: class Event { constructor(type) { this.type = type; } },
    URL,
    queueMicrotask,
    console
  });
  vm.runInContext(read("src/main-world.js"), context);
  await context.window.fetch("https://x.com/i/api/graphql/example/HomeTimeline");
  await new Promise((resolve) => setImmediate(resolve));
  const followingMap = JSON.parse(attributes.get("data-xtension-following-map"));
  assert.deepEqual({ ...followingMap }, { followedauthor: true, otherauthor: false });
  assert.equal(Object.hasOwn(followingMap, "unknownauthor"), false);
});

test("a long verified name keeps controls left, timestamp right, and handle flush below", () => {
  const content = read("src/content.js");
  const css = read("src/content.css");
  const start = content.indexOf("  function findDisplayNameRow");
  const end = content.indexOf("\n  function isAuthorNameFlexRow", start);
  assert.ok(start >= 0 && end > start);

  const userName = { contains: () => true };
  const outerNameGroup = { parentElement: userName };
  const verifiedNameRow = { parentElement: outerNameGroup };
  const nameContainer = { parentElement: verifiedNameRow };
  const findDisplayNameRow = new Function(
    "isAuthorNameFlexRow",
    "findReplyMetadataFlexItem",
    `${content.slice(start, end)}\nreturn findDisplayNameRow;`
  )(
    (element) => element === verifiedNameRow || element === userName,
    (_scope, row) => row === userName ? { textContent: "@bambino_ · 2h" } : null
  );

  assert.equal(findDisplayNameRow(nameContainer, userName), userName);
  assert.match(css, /\[data-xtension-reply-name-row\][\s\S]{0,220}flex-wrap: wrap !important/);
  assert.match(css, /\[data-xtension-reply-name-row\][\s\S]{0,320}position: relative !important/);
  assert.match(css, /\[data-xtension-reply-metadata\][\s\S]{0,180}flex-basis: 100% !important/);
  assert.match(css, /\[data-xtension-reply-name-row\] \[data-xtension-reply-timestamp="true"\][\s\S]{0,100}display: none !important/);
  assert.match(css, /\[data-xtension-reply-name-row\] > \[data-xtension-reply-timestamp-proxy="true"\][\s\S]{0,300}right: 0/);
  assert.match(css, /\[data-xtension-reply-name-row\] \[data-xtension-reply-separator="true"\][\s\S]{0,100}display: none !important/);
  assert.match(content, /markReplyMetadataParts\(userName, placement\.metadata\)/);
  assert.match(content, /currentRow\?\.contains\?\.\(node\)/);
  assert.match(content, /data-xtension-reply-handle/);
  assert.match(content, /data-xtension-reply-timestamp/);
  assert.match(content, /syncReplyTimestampProxy\(userName, host\)/);
  assert.match(content, /const proxy = source\.cloneNode\(true\)/);
  assert.match(content, /const label = localizedText\("followingBadgeFollowing", "Following"\)/);
  assert.match(content, /state \? "✓" : "✕"/);
  assert.match(css, /\[data-xtension-following-badge="not-following"\][\s\S]{0,180}color: rgb\(210, 18, 34\)/);
  assert.match(css, /\[data-xtension-reply-button\][\s\S]{0,240}background: #138a55/);
});

test("recurring timeline cleanup preserves metadata layout markers on the active author row", () => {
  const content = read("src/content.js");
  const start = content.indexOf("  function cleanupLegacyReplyButtonInjection");
  const end = content.indexOf("\n  function removeReplyButtonAndHost", start);
  assert.ok(start >= 0 && end > start);

  const removed = [];
  const button = { closest: () => host };
  const metadata = {
    getAttribute: (name) => name === "data-xtension-reply-metadata" ? "true" : null,
    removeAttribute: (name) => removed.push(name)
  };
  const row = {
    contains: (node) => node === metadata,
    querySelector: () => button,
    removeAttribute: (name) => removed.push(name)
  };
  const host = {
    closest: () => row,
    getAttribute: (name) => name === "data-xtension-reply-host" ? "name-row" : null,
    querySelector: () => button,
    remove: () => removed.push("host")
  };
  const userName = {
    querySelector: () => host,
    querySelectorAll: (selector) => {
      if (selector === "reply-button") return [button];
      if (selector.includes('[data-xtension-reply-host="inline"]')) return [metadata];
      if (selector === '[data-xtension-reply-name-row="true"]') return [row];
      if (selector === '[data-xtension-reply-host="name-row"]') return [host];
      return [];
    },
    removeAttribute: () => {}
  };
  const cleanupLegacyReplyButtonInjection = new Function(
    "REPLY_BUTTON_SELECTOR",
    "removeReplyButtonAndHost",
    `${content.slice(start, end)}\nreturn cleanupLegacyReplyButtonInjection;`
  )("reply-button", () => {});

  cleanupLegacyReplyButtonInjection(userName);
  assert.deepEqual(removed, []);
});

test("the timestamp is cloned outside X's clipped metadata container", () => {
  const content = read("src/content.js");
  const start = content.indexOf("  function markReplyMetadataParts");
  const end = content.indexOf("\n  function findDisplayNameElement", start);
  assert.ok(start >= 0 && end > start);

  const proxyAttributes = new Map();
  const proxy = {
    getAttribute: (name) => proxyAttributes.get(name) || null,
    removeAttribute: (name) => proxyAttributes.delete(name),
    setAttribute: (name, value) => proxyAttributes.set(name, value)
  };
  const sourceAttributes = new Map([["href", "/brestho/status/1"]]);
  const time = {
    closest: () => source,
    getAttribute: (name) => name === "datetime" ? "2026-08-14T11:40:00Z" : null
  };
  const source = {
    cloneNode: () => proxy,
    closest: () => source,
    getAttribute: (name) => sourceAttributes.get(name) || null,
    querySelector: (selector) => selector === "time" ? time : null,
    setAttribute: (name, value) => sourceAttributes.set(name, value),
    textContent: "2 h"
  };
  const handle = {
    closest: () => handle,
    setAttribute: () => {},
    textContent: "@brestho"
  };
  const metadata = {
    contains: () => true,
    querySelector: (selector) => selector === "time" ? time : null,
    querySelectorAll: (selector) => selector === "a, span, div" ? [handle] : []
  };
  let inserted = null;
  const row = {
    children: [],
    insertBefore: (node, before) => { inserted = { node, before }; },
    querySelector: () => metadata
  };
  const host = { closest: () => row };
  const userName = {
    contains: () => true,
    querySelector: (selector) => selector === "time" ? time : null
  };
  const syncReplyTimestampProxy = new Function(
    "cleanText",
    `${content.slice(start, end)}\nreturn syncReplyTimestampProxy;`
  )((text) => String(text || "").trim());

  syncReplyTimestampProxy(userName, host);

  assert.equal(sourceAttributes.get("data-xtension-reply-timestamp"), "true");
  assert.deepEqual(inserted, { node: proxy, before: metadata });
  assert.equal(proxyAttributes.get("data-xtension-reply-timestamp-proxy"), "true");
  assert.match(proxyAttributes.get("data-xtension-reply-timestamp-signature"), /brestho\/status\/1/);
});

test("social reply adapters cover the requested platforms and never submit posts", () => {
  const build = read("scripts/build.js");
  const social = read("src/social.js");
  const bridge = read("scripts/xtension-ai-bridge.js");
  for (const platform of ["reddit", "facebook", "instagram", "threads", "linkedin", "bluesky", "youtube"]) {
    assert.match(social, new RegExp(`id: "${platform}"`));
  }
  for (const hostname of ["reddit.com", "facebook.com", "instagram.com", "threads.net", "linkedin.com", "bsky.app", "youtube.com"]) {
    assert.match(build, new RegExp(hostname.replace(".", "\\.")));
  }
  assert.match(social, /Nothing is published automatically/);
  assert.doesNotMatch(social, /\.click\(\)|requestSubmit|\.submit\(\)/);
  assert.match(bridge, /getContextPlatformName\(context\)/);
  assert.match(bridge, /Write exactly one postable reply for/);
});

test("suggestions include a user-language translation without inserting it into X", () => {
  const content = read("src/content.js");
  const background = read("src/background.js");
  const options = read("src/options.js");
  const html = read("src/options.html");
  const bridge = read("scripts/xtension-ai-bridge.js");

  assert.match(html, /id="reply-ai-translation-language"[\s\S]{0,180}<option value="fr"/);
  assert.match(options, /DEFAULT_REPLY_TRANSLATION_LANGUAGE = "fr"/);
  assert.match(background, /translationLanguage: normalizeReplyTranslationLanguage\(config\.replyTranslationLanguage\)/);
  assert.match(bridge, /<XTENSION_REPLY>[\s\S]{0,260}<XTENSION_TRANSLATION>/);
  assert.match(bridge, /fullText \|\|= this\.findAgentMessageText\(turn\.items\)/);
  assert.match(bridge, /Array\.isArray\(item\.content\)/);
  assert.match(content, /renderReplySuggestionTranslation\(option, suggestion\)/);
  assert.match(content, /injectReplyDraft\([^,]+, suggestion\.text\)/);
  assert.doesNotMatch(content, /injectReplyDraft\([^,]+, suggestion\.translation\)/);

  const parseStart = bridge.indexOf("function parseReplyTranslationResult");
  const parseEnd = bridge.indexOf("\nasync function translateReplyForDisplay", parseStart);
  assert.ok(parseStart >= 0 && parseEnd > parseStart);
  const parseReplyTranslationResult = new Function(
    "cleanDraftText",
    `${bridge.slice(parseStart, parseEnd)}\nreturn parseReplyTranslationResult;`
  )((value) => String(value || "").trim());
  assert.deepEqual(
    parseReplyTranslationResult('{"reply":"こんにちは","translation":"Bonjour"}'),
    { reply: "こんにちは", translation: "Bonjour" }
  );
  assert.deepEqual(
    parseReplyTranslationResult("<XTENSION_REPLY>\nこんにちは\n</XTENSION_REPLY>\n<XTENSION_TRANSLATION>\nBonjour\n</XTENSION_TRANSLATION>"),
    { reply: "こんにちは", translation: "Bonjour" }
  );
  assert.deepEqual(
    parseReplyTranslationResult("Plain reply fallback"),
    { reply: "Plain reply fallback", translation: "" }
  );
});

test("options warm up and retry the connector automatically on page load", () => {
  const options = read("src/options.js");
  assert.match(options, /BRIDGE_STATUS_RETRY_DELAYS_MS = \[0, 350, 1000\]/);
  assert.match(options, /refreshCodexStatus\(\{ warmup: true, retry: true \}\)/);
  assert.match(options, /warmup \? "\/warmup" : "\/auth\/status"/);
  assert.match(options, /!data\?\.codex\?\.installed && attempt \+ 1 < delays\.length/);
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

test("image generation preloads the first post photo and never drops a selected reference silently", () => {
  const content = read("src/content.js");
  const background = read("src/background.js");
  const bridge = read("scripts/xtension-ai-bridge.js");

  assert.match(content, /referenceInput\.type = "checkbox";\s+referenceInput\.checked = true;/);
  assert.match(content, /loadReferenceImage\(\)\.catch/);
  assert.match(content, /xtension-imagegen-reference-preview/);
  assert.match(content, /hostname\.toLowerCase\(\) !== "pbs\.twimg\.com"/);
  assert.match(content, /!\/\^\\\/media\\\//);
  assert.match(content, /getImageGenerationTweetCandidates/);
  assert.match(content, /statusUrl && statusUrl === primaryStatusUrl/);
  assert.match(content, /document\.addEventListener\("click", rememberReplyImageReference, true\)/);
  assert.match(content, /button\[data-testid="reply"\]/);
  assert.match(content, /getRememberedReplyImageReference\(tweetCandidates\[0\]\)/);
  assert.match(content, /referenceImageRequired: referenceInput\.checked/);
  assert.match(content, /error\.code = "image_reference_missing"/);
  assert.match(content, /error\.code = "image_reference_download_failed"/);

  assert.match(background, /referenceImageRequested: Boolean\(message\.referenceImageRequired\)/);
  assert.match(background, /if \(referenceImageRequired && !referenceImage\)/);
  assert.match(background, /referenceImageRequired,/);
  assert.match(background, /MAX_FETCHED_IMAGE_BYTES/);
  assert.match(background, /\^image\\\/\(\?:png\|jpe\?g\|webp\|gif\)\$/);

  assert.match(bridge, /const referenceImageRequired = payload\?\.referenceImageRequired === true/);
  assert.match(bridge, /referenceImageRequired && !referenceImage/);
  assert.match(bridge, /hasReferenceImage: Boolean\(referenceImage\)/);
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
  assert.match(helper, /target_lease_mismatch/);
  assert.match(helper, /ExpectedFocusedChildHandle/);
  assert.match(bridge, /nativeTypeIsAvailable\(\)/);
  assert.match(bridge, /captureTargetViaHelper/);
  assert.match(bridge, /consumeNativeTypeTarget/);
  assert.match(content, /type: "xtension-native-type-capability"/);
  assert.match(content, /type: "xtension-native-type-prepare"/);
  assert.match(content, /targetToken: prepared\.targetToken/);
  assert.doesNotMatch(content, /document\.title = expectedWindowMarker/);
  assert.match(content, /if \(nativeResult\.available\)[\s\S]{0,180}return false;/);

  const streamStart = content.indexOf("  function streamGenerateReplyText");
  const streamEnd = content.indexOf("\n  async function transformReplyText", streamStart);
  assert.ok(streamStart >= 0 && streamEnd > streamStart);
  assert.doesNotMatch(content.slice(streamStart, streamEnd), /applyDraftTextViaBridge/);
});
