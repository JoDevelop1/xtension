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
  assert.equal(readConstant(background, "REPLY_AI_CONFIG_VERSION"), "26");
  assert.equal(readConstant(background, "DEFAULT_CODEX_REASONING_EFFORT"), '"low"');
});

test("AI website content stays off until the user enables AI features", () => {
  const options = read("src/options.js");
  const background = read("src/background.js");
  const html = read("src/options.html");
  const content = read("src/content.js");
  const social = read("src/social.js");
  assert.match(html, /id="reply-ai-enabled" type="checkbox"/);
  assert.match(html, /OpenAI Codex, Claude Code, or your configured Ollama server[\s\S]{0,240}JoDevelop does not receive or store/);
  assert.match(html, /does not sign you in[\s\S]{0,300}No API key is requested/);
  assert.doesNotMatch(html, /reply-ai-data-consent|I agree to this processing/);
  assert.match(options, /dataProcessingConsentVersion: aiEnabled \? REQUIRED_AI_DATA_CONSENT_VERSION : 0/);
  assert.match(options, /enabledInput\?\.addEventListener\("change", async \(\) => \{[\s\S]{0,180}await saveConfig\(\)/);
  assert.match(options, /normalized\.enabled = normalized\.dataProcessingConsentVersion === REQUIRED_AI_DATA_CONSENT_VERSION/);
  assert.match(background, /error\.code = consentGranted \? "not_configured" : "consent_required"/);
  assert.match(content, /await isAiProcessingEnabled\(\)/);
  assert.match(social, /await isAiProcessingEnabled\(\)/);
  assert.match(content, /Number\(config\?\.dataProcessingConsentVersion\) === 2/);
  assert.match(social, /Number\(config\?\.dataProcessingConsentVersion\) === 2/);
  assert.match(content, /action !== "undo" && action !== "redo" && !\(await isAiProcessingEnabled\(\)\)/);
  assert.match(social, /async function runAction[\s\S]{0,260}await isAiProcessingEnabled\(\)/);
});

test("all supported UI locales are complete and the AI disclosure names the real recipient", () => {
  const { localeMessages } = require(path.join(root, "scripts", "locales.js"));
  for (const locale of ["en", "fr", "de", "es", "ja"]) {
    const messages = localeMessages[locale];
    assert.ok(messages.optionsPrivacyTitle);
    assert.match(messages.optionsPrivacyDisclosure, /OpenAI/);
    assert.match(messages.optionsPrivacyDisclosure, /JoDevelop/);
    if (locale !== "en") {
      assert.notEqual(messages.optionsPrivacyDisclosure, localeMessages.en.optionsPrivacyDisclosure, locale);
      assert.notEqual(messages.replyAiConsentRequired, localeMessages.en.replyAiConsentRequired, locale);
    }
  }

  const unchangedTechnicalLabels = new Set([
    "actionTitle",
    "draftLanguageAuto",
    "extensionName",
    "imageGenerationFormatPortrait",
    "imageGenerationMoodWarm",
    "imageGenerationOptionAuto",
    "optionsCodexReasoningUltra",
    "optionsPrompt",
    "optionsPromptHint",
    "optionsTabEngine",
    "optionsTitle",
    "replyStyleOption"
  ]);
  for (const locale of ["de", "es", "ja"]) {
    for (const key of Object.keys(localeMessages.en)) {
      if (localeMessages[locale][key] === localeMessages.en[key]) {
        assert.ok(unchangedTechnicalLabels.has(key), `${locale}/${key} unexpectedly falls back to English`);
      }
    }
  }
});

test("X relationship badges remain independent from optional AI consent", () => {
  const content = read("src/content.js");
  const mainWorld = read("src/main-world.js");
  assert.doesNotMatch(content, /MAIN_WORLD_AI_STATE|syncMainWorldAiProcessingState|installAiStorageListener/);
  assert.doesNotMatch(mainWorld, /AI_STATE_|relationshipObservationEnabled|syncRelationshipObservation/);
  assert.match(mainWorld, /installRelationshipFetchObserver\(\);\s+installRelationshipXhrObserver\(\);/);
  assert.match(mainWorld, /function collectFollowingRelationships\(payload\) \{\s+if \(!payload/);
});

test("the local connector accepts only the official and existing Xtension origins by default", () => {
  const bridge = read("scripts/xtension-ai-bridge.js");
  assert.match(bridge, /OFFICIAL_CHROME_EXTENSION_ORIGIN = "chrome-extension:\/\/mjimpcncnbcngljfdifglncblmljgfkm"/);
  assert.match(bridge, /LEGACY_CHROME_EXTENSION_ORIGIN = "chrome-extension:\/\/bkcoigchdfenookfhogaokpmlkhekeai"/);
  assert.match(bridge, /code: "origin_not_allowed"/);
  assert.match(bridge, /if \(allowedExtensionOrigins\.has\(origin\)\)/);
  assert.match(bridge, /return Boolean\(bridgeToken\) && isBrowserExtensionOrigin\(origin\)/);
  assert.doesNotMatch(bridge, /function isAllowedBrowserExtensionOrigin\(origin\) \{\s+return \/\^chrome-extension/);
});

test("Options presents connector and ChatGPT setup in priority order", () => {
  const html = read("src/options.html");
  const css = read("src/options.css");
  const options = read("src/options.js");
  assert.ok(html.indexOf('class="bridge-download setup-step"') < html.indexOf('class="connection-card setup-step"'));
  assert.ok(html.indexOf('<span class="step-number">1</span>') < html.indexOf('<span class="step-number">2</span>'));
  assert.match(html, /<details class="model-settings">/);
  assert.match(html, /id="options-version"/);
  assert.match(html, /id="reply-ai-connector-installed-version"/);
  assert.match(html, /id="reply-ai-connector-latest-version"/);
  assert.match(html, /id="reply-ai-install-connector"[\s\S]{0,300}id="reply-ai-update-connector"/);
  assert.match(css, /grid-template-columns: 210px minmax\(0, 1fr\)/);
  assert.match(options, /optionsCodexOriginRejected/);
  assert.match(options, /setConnectorDownloadState\("missing"\)/);
  assert.match(options, /setConnectorDownloadState\("outdated", \{ canSelfUpdate \}\)/);
  assert.match(options, /setConnectorDownloadState\("current", \{ canSelfUpdate \}\)/);
});

test("the connector updater verifies release metadata, checksum, signature, and version before restart", () => {
  const bridge = read("scripts/xtension-ai-bridge.js");
  assert.match(bridge, /UPDATE_METADATA_URL = "https:\/\/xtension\.jodevelop\.com\/version\.json"/);
  assert.match(bridge, /pathname === "\/update\/status"/);
  assert.match(bridge, /pathname === "\/update\/install"/);
  assert.match(bridge, /crypto\.timingSafeEqual/);
  assert.match(bridge, /Get-AuthenticodeSignature -LiteralPath/);
  assert.match(bridge, /O=NOVA2G/);
  assert.match(bridge, /update_version_mismatch/);
  assert.match(bridge, /scheduleAutomaticConnectorUpdateCheck\(UPDATE_INITIAL_DELAY_MS\)/);
  assert.match(bridge, /activeRequestCount > 0 \|\| nativeTypeInFlight/);
});

test("multi-provider requests require the connector API that implements them", () => {
  const options = read("src/options.js");
  const background = read("src/background.js");
  assert.match(options, /MINIMUM_CONNECTOR_VERSION = "0\.6\.35"/);
  assert.match(background, /MINIMUM_CONNECTOR_VERSION = "0\.6\.35"/);
  assert.match(background, /compareVersions\(version, MINIMUM_CONNECTOR_VERSION\) >= 0/);
  assert.doesNotMatch(background, /compareVersions\(version, EXTENSION_VERSION\) >= 0/);
});

test("asset generation preserves real Store screenshots and pads the 128px icon", () => {
  const assets = read("scripts/generate_assets.py");
  assert.match(assets, /target_size = max\(1, round\(size \* 0\.75\)\)/);
  assert.doesNotMatch(assets.slice(assets.indexOf("def main():")), /screenshot\(STORE/);
  assert.match(read("tests/social-cdp.mjs"), /Page\.captureScreenshot/);
  assert.match(read("tests/options-cdp.mjs"), /#reply-ai-enabled/);
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

test("top-level post composers place Xtension on a dedicated row above X controls", () => {
  const content = read("src/content.js");
  const css = read("src/content.css");
  const start = content.indexOf("  function shouldUseDedicatedDraftActionRow");
  const end = content.indexOf("\n  function findDraftActionDedicatedPlacement", start);
  assert.ok(start >= 0 && end > start);

  const editorRoot = { getAttribute: () => "", textContent: "" };
  const editor = { closest: () => editorRoot };
  const composer = { textContent: "" };
  const shouldUseDedicatedDraftActionRow = new Function(
    "findComposerSubmitButton",
    "cleanText",
    `${content.slice(start, end)}\nreturn shouldUseDedicatedDraftActionRow;`
  )(
    (scope) => scope.submitButton,
    (value) => String(value || "").replace(/\s+/g, " ").trim()
  );

  for (const label of ["Post", "Poster", "Publicar", "Posten", "ポスト"]) {
    composer.submitButton = { getAttribute: () => label, textContent: label };
    assert.equal(shouldUseDedicatedDraftActionRow(editor, composer), true, label);
  }
  assert.match(css, /\.xtension-draft-actions-host\.is-dedicated-row[\s\S]{0,260}width: 100%/);
  assert.match(content, /Les composeurs de publication doivent[\s\S]{0,260}return isReplyComposer \|\| isPostComposer/);
});

test("X relationship data exposes following and followed-by states without profile requests", async () => {
  const attributes = new Map([["data-xtension-ai-processing-enabled", "1"]]);
  let fetchCount = 0;
  const document = {
    documentElement: {
      setAttribute: (name, value) => attributes.set(name, value),
      getAttribute: (name) => attributes.get(name) || null,
      removeAttribute: (name) => attributes.delete(name)
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
            relationship_perspectives: { following: true, followed_by: false },
            // X peut laisser des booleens historiques contradictoires dans legacy.
            legacy: { screen_name: "FollowedAuthor", following: false, followed_by: true }
          },
          mutual: {
            core: { screen_name: "MutualAuthor" },
            relationship_perspectives: { following: true, followed_by: true }
          },
          stranger: {
            legacy: { screen_name: "OtherAuthor", following: false, followed_by: true }
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
      fetch: async () => {
        fetchCount += 1;
        return response;
      },
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
  assert.equal(fetchCount, 1);
  const followingMap = JSON.parse(attributes.get("data-xtension-following-map"));
  assert.deepEqual({ ...followingMap }, {
    followedauthor: { following: true, followedBy: false },
    mutualauthor: { following: true, followedBy: true },
    otherauthor: { following: false, followedBy: true }
  });
  assert.equal(Object.hasOwn(followingMap, "unknownauthor"), false);
});

test("X timeline renders distinct not-following, following, and mutual badges", () => {
  const content = read("src/content.js");
  const start = content.indexOf("  function enhanceFollowingIndicator");
  const end = content.indexOf("\n  function getVisibleViewerHandle", start);
  assert.ok(start >= 0 && end > start);

  const relationships = new Map([
    ["stranger", { following: false, followedBy: true }],
    ["followed", { following: true, followedBy: false }],
    ["mutual", { following: true, followedBy: true }]
  ]);
  const labels = {
    followingBadgeFollowing: "Abonné",
    followingBadgeNotFollowing: "Non abonné",
    followingBadgeMutual: "Mutuel"
  };
  const badges = [];
  const enhanceFollowingIndicator = new Function(
    "cleanHandle",
    "getTweetStatusContext",
    "findHandleInTweet",
    "followingStatusByHandle",
    "getVisibleViewerHandle",
    "document",
    "localizedText",
    "localizedTemplate",
    "FOLLOWING_BADGE_SELECTOR",
    "FOLLOWING_BADGE_ATTRIBUTE",
    `${content.slice(start, end)}\nreturn enhanceFollowingIndicator;`
  )(
    (value) => String(value || "").replace(/^@/, ""),
    (tweet) => ({ author: tweet.author }),
    () => "",
    relationships,
    () => "viewer",
    {
      createElement: () => ({
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; }
      })
    },
    (key, fallback) => labels[key] || fallback,
    (_key, values, fallback) => fallback.replace("{handle}", values.handle),
    "[data-xtension-following-badge]",
    "data-xtension-following-badge"
  );

  for (const author of ["stranger", "followed", "mutual"]) {
    const host = {
      querySelector: () => null,
      prepend: (badge) => badges.push(badge)
    };
    enhanceFollowingIndicator({ author }, host);
  }

  assert.deepEqual(badges.map((badge) => ({
    state: badge.attributes["data-xtension-following-badge"],
    text: badge.textContent
  })), [
    { state: "not-following", text: "✕ Non abonné" },
    { state: "following", text: "✓ Abonné" },
    { state: "mutual", text: "↔ Mutuel" }
  ]);
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
  assert.match(css, /\[data-xtension-reply-name-row\] > \[data-xtension-reply-timestamp-proxy="true"\]\[data-xtension-reply-timestamp-placement="row"\][\s\S]{0,300}right: 0/);
  assert.match(css, /\[data-xtension-reply-header-row="true"\] > \[data-xtension-reply-timestamp-proxy="true"\]\[data-xtension-reply-timestamp-placement="actions"\][\s\S]{0,240}margin: 0 4px 0 6px !important/);
  assert.match(css, /\[data-xtension-reply-name-row\] \[data-xtension-reply-separator="true"\][\s\S]{0,100}display: none !important/);
  assert.match(content, /markReplyMetadataParts\(userName, placement\.metadata\)/);
  assert.match(content, /currentRow\?\.contains\?\.\(node\)/);
  assert.match(content, /data-xtension-reply-handle/);
  assert.match(content, /data-xtension-reply-timestamp/);
  assert.match(content, /syncReplyTimestampProxy\(userName, host\)/);
  assert.match(content, /proxy = source\.cloneNode\(true\)/);
  assert.match(content, /findReplyTimestampActionPlacement\(userName\)/);
  assert.match(content, /localizedText\("followingBadgeMutual", "Mutual"\)/);
  assert.match(content, /localizedText\("followingBadgeNotFollowing", "Not following"\)/);
  assert.match(content, /const symbol = state === "mutual" \? "↔" : \(following \? "✓" : "✕"\)/);
  assert.match(css, /\[data-xtension-following-badge="not-following"\][\s\S]{0,180}color: rgb\(210, 18, 34\)/);
  assert.match(css, /\[data-xtension-following-badge="mutual"\][\s\S]{0,180}color: rgb\(143, 101, 0\)/);
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

test("the exact X timestamp is inserted immediately before the action cluster", () => {
  const content = read("src/content.js");
  const start = content.indexOf("  function syncReplyTimestampProxy");
  const end = content.indexOf("\n  function findDisplayNameElement", start);
  assert.ok(start >= 0 && end > start);

  const proxyAttributes = new Map();
  const proxy = {
    nextSibling: null,
    parentElement: null,
    textContent: "2 h",
    getAttribute: (name) => proxyAttributes.get(name) || null,
    remove: () => {},
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
    textContent: "2 h"
  };
  const metadata = {
    querySelector: (selector) => selector === "time" ? time : null
  };
  let inserted = null;
  const rowAttributes = new Map();
  const row = {
    children: [],
    querySelector: () => metadata,
    querySelectorAll: () => [],
    setAttribute: (name, value) => rowAttributes.set(name, value)
  };
  const actionGroup = {};
  const headerAttributes = new Map();
  const header = {
    insertBefore: (node, before) => {
      inserted = { node, before };
      node.parentElement = header;
      node.nextSibling = before;
    },
    setAttribute: (name, value) => headerAttributes.set(name, value)
  };
  const hostAttributes = new Map();
  const host = {
    closest: () => row,
    getAttribute: (name) => hostAttributes.get(name) || null,
    setAttribute: (name, value) => hostAttributes.set(name, value)
  };
  const userName = {};
  const fakeDocument = { querySelectorAll: () => [] };
  const syncReplyTimestampProxy = new Function(
    "markReplyMetadataParts",
    "findReplyTimestampActionPlacement",
    "cleanText",
    "document",
    `${content.slice(start, end)}\nreturn syncReplyTimestampProxy;`
  )(
    () => source,
    () => ({ parent: header, before: actionGroup, type: "actions" }),
    (text) => String(text || "").trim(),
    fakeDocument
  );

  syncReplyTimestampProxy(userName, host);

  assert.deepEqual(inserted, { node: proxy, before: actionGroup });
  assert.equal(proxy.textContent, "2 h");
  assert.equal(proxyAttributes.get("data-xtension-reply-timestamp-proxy"), "true");
  assert.equal(proxyAttributes.get("data-xtension-reply-timestamp-placement"), "actions");
  assert.match(proxyAttributes.get("data-xtension-reply-timestamp-signature"), /brestho\/status\/1/);
  assert.equal(rowAttributes.get("data-xtension-reply-timestamp-placement"), "actions");
  assert.equal(headerAttributes.get("data-xtension-reply-header-row"), "true");
});

test("the timestamp action placement selects the slot before Grok and the menu", () => {
  const content = read("src/content.js");
  const start = content.indexOf("  function findReplyTimestampActionPlacement");
  const end = content.indexOf("\n  function syncReplyTimestampProxy", start);
  assert.ok(start >= 0 && end > start);

  const tweet = {
    contains: () => true,
    querySelectorAll: () => [menuButton]
  };
  const header = {
    children: [],
    contains: (node) => node === menuButton,
    parentElement: tweet
  };
  const actionGroup = { parentElement: header };
  const userName = {
    parentElement: header,
    closest: () => tweet,
    getBoundingClientRect: () => ({ top: 100 })
  };
  const menuButton = {
    closest: () => tweet,
    getBoundingClientRect: () => ({ top: 101 }),
    parentElement: actionGroup
  };
  header.children = [userName, actionGroup];
  const findReplyTimestampActionPlacement = new Function(
    "isVisibleElement",
    "getDirectChildContaining",
    "getComputedStyle",
    `${content.slice(start, end)}\nreturn findReplyTimestampActionPlacement;`
  )(
    () => true,
    (_parent, child) => child === userName ? userName : actionGroup,
    () => ({ display: "flex", flexDirection: "row" })
  );

  assert.deepEqual(findReplyTimestampActionPlacement(userName), {
    parent: header,
    before: actionGroup,
    type: "actions"
  });
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
  assert.match(options, /warmup \? "\/warmup" : buildProviderStatusPath\(config\)/);
  assert.match(options, /!getInstalledProviders\(data\)\.length && attempt \+ 1 < delays\.length/);
  assert.match(options, /body: JSON\.stringify\(getProviderRequestConfig\(config\)\)/);
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
  assert.match(installer, /fromUpdate = HasArg\(args, "--from-update"\)/);
  assert.match(installer, /StopInstalledProcesses\(installDir, preserveUpdaterProcess: fromUpdate\)/);
  assert.match(installer, /process\.Kill\(entireProcessTree: !preserveUpdaterProcess\)/);
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

test("successful draft insertion is independent from X publish-button validation", () => {
  const content = read("src/content.js");
  const committedStart = content.indexOf("  function isReplyDraftCommitted");
  const committedEnd = content.indexOf("\n  function replyDraftTextMatches", committedStart);

  assert.ok(committedStart >= 0 && committedEnd > committedStart);
  assert.match(content.slice(committedStart, committedEnd), /return replyDraftTextMatches\(editor, message\)/);
  assert.doesNotMatch(content.slice(committedStart, committedEnd), /findComposerSubmitButton|isDisabledButton/);
});

test("streamed provider errors are preserved and never replayed non-streaming", () => {
  const background = read("src/background.js");
  const content = read("src/content.js");
  const streamOperationStart = background.indexOf("async function streamDraftOperation");
  const streamOperationEnd = background.indexOf("\n// Lit le flux NDJSON", streamOperationStart);
  const contentStreamStart = content.indexOf("  function streamGenerateReplyText");
  const contentStreamEnd = content.indexOf("\n  async function transformReplyText", contentStreamStart);

  assert.ok(streamOperationStart >= 0 && streamOperationEnd > streamOperationStart);
  assert.match(background.slice(streamOperationStart, streamOperationEnd), /error\?\.code !== "bridge_stream_unsupported"/);
  assert.match(background.slice(streamOperationStart, streamOperationEnd), /postToPort\(port, \{[\s\S]{0,180}type: "error"/);
  assert.ok(contentStreamStart >= 0 && contentStreamEnd > contentStreamStart);
  assert.match(content.slice(contentStreamStart, contentStreamEnd), /reject\(streamError\)/);
  assert.doesNotMatch(content.slice(contentStreamStart, contentStreamEnd), /message\.type === "error"\)[\s\S]{0,80}finish\(null\)/);
});

test("X generation prompts require universally postable length", () => {
  const bridge = read("scripts/xtension-ai-bridge.js");

  assert.match(bridge, /function getPlatformLengthInstruction/);
  assert.match(bridge, /at or below 280 visible characters/);
  assert.match(bridge, /getPlatformLengthInstruction\(platformName, "reply"\)/);
  assert.match(bridge, /getPlatformLengthInstruction\(platformName, "post or reply"\)/);
});

test("Claude Code runs subscription-only with tools, persistence, and retries disabled", () => {
  const source = read("scripts/claude-code-client.js");
  const { createClaudeEnvironment, guardLeadingSlash } = require(path.join(root, "scripts", "claude-code-client.js"));
  const previousApiKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-only";
  try {
    const environment = createClaudeEnvironment();
    assert.equal(environment.ANTHROPIC_API_KEY, undefined);
    assert.equal(environment.CLAUDE_CODE_MAX_RETRIES, "0");
  } finally {
    if (previousApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousApiKey;
  }
  assert.match(source, /"--tools", ""/);
  assert.match(source, /"--safe-mode"/);
  assert.match(source, /"--no-session-persistence"/);
  assert.match(source, /"--disable-slash-commands"/);
  assert.match(source, /auth\?\.authMethod === "claude\.ai"/);
  assert.doesNotMatch(source, /--bare/);
  assert.match(guardLeadingSlash("/model opus"), /slash-prefixed text as data/);
});

test("Ollama stays local, disables thinking, and bounds its context", () => {
  const source = read("scripts/ollama-client.js");
  const { MAX_LOCAL_PROMPT_CHARS, normalizeOllamaBaseUrl, truncateLocalPrompt } = require(path.join(root, "scripts", "ollama-client.js"));
  assert.equal(normalizeOllamaBaseUrl("http://127.0.0.1:11434"), "http://127.0.0.1:11434");
  assert.equal(normalizeOllamaBaseUrl("http://192.168.1.10:11434"), "http://192.168.1.10:11434");
  assert.throws(() => normalizeOllamaBaseUrl("https://example.com"), /localhost or a private network/);
  assert.ok(truncateLocalPrompt("x".repeat(MAX_LOCAL_PROMPT_CHARS + 500)).length <= MAX_LOCAL_PROMPT_CHARS);
  assert.match(source, /think: false/);
  assert.match(source, /num_ctx: 8192/);
  assert.match(source, /format: \{[\s\S]{0,180}additionalProperties: false/);
  assert.match(source, /reason === "length" \? "ai_context_overflow"/);
});

test("the connector only uses consented providers and never falls back after output starts", () => {
  const bridge = read("scripts/xtension-ai-bridge.js");
  const chainStart = bridge.indexOf("async function runProviderChain");
  const chainEnd = bridge.indexOf("\nasync function runTransform", chainStart);
  assert.ok(chainStart >= 0 && chainEnd > chainStart);
  const chain = bridge.slice(chainStart, chainEnd);
  assert.match(chain, /if \(!Array\.isArray\(payload\?\.allowedProviders\)\)[\s\S]{0,80}return \["openai-codex"\]/);
  assert.match(chain, /payload\.allowedProviders\.includes\(provider\)/);
  assert.match(chain, /if \(delta\) committed = true/);
  assert.match(chain, /if \(committed \|\| !shouldFallbackProviderError/);
  assert.match(chain, /image \|\| audio[\s\S]{0,100}\["openai-codex"\]/);
  assert.match(read("src/background.js"), /allowedProviders: \[\.\.\.ALLOWED_AI_PROVIDERS\]/);
});

test("options expose Codex, Claude, and Ollama without API-key fields", () => {
  const html = read("src/options.html");
  const options = read("src/options.js");
  assert.match(html, /id="reply-ai-primary-provider"/);
  assert.match(html, /value="openai-codex"/);
  assert.match(html, /value="anthropic-claude"/);
  assert.match(html, /value="local-ollama"/);
  assert.match(html, /id="reply-ai-fallback-enabled"/);
  assert.match(html, /id="reply-ai-claude-model"/);
  assert.match(html, /id="reply-ai-ollama-url"/);
  assert.match(html, /id="reply-ai-ollama-model"/);
  assert.doesNotMatch(html, /type="password"[^>]+api/i);
  assert.match(options, /refreshOllamaModels/);
});

test("the public update manifest cache-busts stable download aliases per release", () => {
  const worker = read("site/src/index.js");
  assert.match(worker, /const releaseQuery = `\?v=\$\{encodeURIComponent\(version\)\}`/);
  assert.match(worker, /connector: `\$\{origin\}\/dl\/XtensionBridgeSetup\.exe\$\{releaseQuery\}`/);
  assert.match(worker, /connector_checksum: `\$\{origin\}\/dl\/XtensionBridgeSetup\.SHA256\.txt\$\{releaseQuery\}`/);
});
