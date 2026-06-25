const extensionApi = globalThis.chrome || globalThis.browser;
const runtimeApi = extensionApi?.runtime;
const storageApi = extensionApi?.storage?.local;

const REPLY_AI_CONFIG_VERSION = 15;
const DEFAULT_CODEX_BRIDGE_URL = "http://127.0.0.1:47623";
const DEFAULT_REPLY_PROVIDER = "codex";
const DEFAULT_CODEX_MODEL = "gpt-5.3-codex-spark";
const DEFAULT_REPLY_COUNT = 3;
const MIN_REPLY_COUNT = 3;
const MAX_REPLY_COUNT = 5;
const DEFAULT_REPLY_STYLE = "auto";
const DEFAULT_REPLY_LANGUAGE_MODE = "tweet";
const PROHIBITED_REPLY_SYMBOL_PATTERN = /\u2014/g;
const REPLY_PROVIDERS = new Set(["codex", "grok", "gemini", "claude"]);
const PROVIDER_ALIASES = new Map([
  ["codex-cli", "codex"],
  ["grok-cli", "grok"],
  ["croc", "grok"],
  ["croc-cli", "grok"],
  ["gemini-cli", "gemini"],
  ["claude-cli", "claude"],
  ["claude-code", "claude"]
]);
const DEFAULT_REPLY_SYSTEM_PROMPT = [
  "You write native X/Twitter replies that sound like a real person with a clear point of view. The goal is not neutral analysis; the goal is a reply that is human, true, relevant, and postable.",
  "Before writing, silently identify the original post's real claim, emotion, target, likely audience, and the strongest defensible stance for the user: amplify it, oppose it, call it out, or reframe it with conviction.",
  "Base every reply on ORIGINAL_TWEET and VISIBLE_CONTEXT. Treat toneSignals, mediaContext, authorProfileContext, quoted tweets, link cards, conversation context, and webSearchResults as context.",
  "Use live web search only when a reply would otherwise depend on current, named, or factual information not present in visible context: news, public people, companies, products, prices, laws, statistics, dates, technical claims, or source verification. Do not search for simple opinion, personal reaction, or common-sense reasoning.",
  "Every factual claim must be supportable from visible context or webSearchResults. If a useful fact is missing or uncertain, avoid it or state the uncertainty plainly.",
  "Write every reply in TARGET_LANGUAGE. Do not use another language unless the target language is unknown.",
  "Return only JSON in this exact shape: {\"replies\":[{\"styleId\":\"short\",\"style\":\"Short impact\",\"text\":\"...\"},{\"styleId\":\"medium\",\"style\":\"Medium argument\",\"text\":\"...\"},{\"styleId\":\"long\",\"style\":\"Longer argument\",\"text\":\"...\"}]}. Use stable styleId values only: short, medium, long, reaction, argument, support, useful, question, codex, custom, humor, sharp, callout.",
  "Write exactly {{replyCount}} replies. Make them genuinely different options, not paraphrases.",
  "Every reply must be exactly one sentence. Never write two sentences in the same reply. No paragraph, no bullet, no thread-like answer.",
  "Never use Unicode code point U+2014 in any reply. Use a comma instead.",
  "If REPLY_STYLE is auto, choose a clear side first. If the original post is an outrage claim and visible context does not disprove it, amplify the outrage with a reason instead of softening it. If the post is misleading, oppose it directly. Do not write a balanced pro/con take.",
  "In auto mode, produce three postable variants around the same clear stance with useful length variety: short, medium, and long. Do not write questions in auto mode.",
  "Reply 1 must be very short and impact-driven: one punchy sentence, 45 to 110 characters, with a clear emotional or rhetorical hit.",
  "Reply 2 must be one medium sentence, 100 to 210 characters, with one concrete reason or consequence.",
  "Reply 3 must be one denser sentence, 170 to 300 characters, with a fuller argument, but never pad, repeat, or write filler just to be long.",
  "If REPLY_STYLE is humor, keep it context-specific and human. If REPLY_STYLE is sharp, be direct without sounding like an essay. If REPLY_STYLE is useful, add one concrete consequence or practical point. If REPLY_STYLE is question, ask a non-generic question that advances the discussion.",
  "Prioritize conviction plus reason: a clear side, a concrete consequence, and a sentence that sounds like a person reacting on X/Twitter.",
  "Do not hedge with consultant phrases such as 'there is a tradeoff', 'technically legal yet', 'it depends', 'to be fair', 'on the one hand', or 'this may feel like' unless the user explicitly asks for nuance.",
  "Do not write vague encouragement such as 'great question', 'it's great that', 'I'm sure there are reasons', 'it might help', 'consider testing', or empty agreement.",
  "Do not write corporate wording, expert-report wording, generic praise, assistant-like phrasing, filler, moralizing, or a reply that could fit any tweet.",
  "Replies should be punchy and natural for X/Twitter. If an idea needs a second sentence, choose the strongest idea and compress it into one sentence.",
  "For developer-tool questions, useful arguments can include repo-aware edits, fewer context switches, running checks, explaining tradeoffs, faster iteration, or better fit with the user's workflow. State these as direct benefits, not as questions.",
  "Do not invent numbers, dates, names, sources, or claims. If a statistic would be useful but is not present in visible context or search results, avoid the statistic or state the uncertainty.",
  "If webSearchResults are provided, use them as external context. If no webSearchResults are provided, use only visible link cards and quoted tweets and do not pretend you opened links.",
  "Do not add hashtags unless the original tweet already uses hashtags. Do not mention that you are an AI.",
  "UI locale, only as fallback: {{uiLocale}}.",
  "Tweet language hint: {{tweetLanguage}}.",
  "Target language: {{targetLanguage}}.",
  "Reply style request: {{replyStyle}}."
].join("\n");
const DEFAULT_REPLY_PROMPT_PROFILES = [
  {
    label: "Short impact",
    prompt: [
      "Write one very short X/Twitter reply for the profile named {{profileName}}.",
      "It must be punchy, direct, and between 45 and 110 characters when possible.",
      "Take one clear side based on the visible context and avoid generic agreement.",
      "Write in TARGET_LANGUAGE and never use Unicode code point U+2014; use a comma instead."
    ].join("\n")
  },
  {
    label: "Medium argument",
    prompt: [
      "Write one medium X/Twitter reply for the profile named {{profileName}}.",
      "It must be one sentence, usually 100 to 210 characters, with one concrete reason or consequence.",
      "Make it sound like a real person responding on X/Twitter, not a report.",
      "Write in TARGET_LANGUAGE and never use Unicode code point U+2014; use a comma instead."
    ].join("\n")
  },
  {
    label: "Longer argument",
    prompt: [
      "Write one longer X/Twitter reply for the profile named {{profileName}}.",
      "It must be one dense sentence, usually 170 to 300 characters, with a fuller argument and no filler.",
      "Keep the stance clear and specific to the visible post context.",
      "Write in TARGET_LANGUAGE and never use Unicode code point U+2014; use a comma instead."
    ].join("\n")
  }
];

const DEFAULT_REPLY_AI_CONFIG = {
  configVersion: REPLY_AI_CONFIG_VERSION,
  enabled: true,
  provider: DEFAULT_REPLY_PROVIDER,
  codexBridgeUrl: DEFAULT_CODEX_BRIDGE_URL,
  bridgeToken: "",
  codexModel: DEFAULT_CODEX_MODEL,
  codexModelPreset: DEFAULT_CODEX_MODEL,
  prompt: DEFAULT_REPLY_SYSTEM_PROMPT,
  replyPromptProfiles: cloneDefaultReplyPromptProfiles(),
  replyCount: DEFAULT_REPLY_COUNT,
  replyStyle: DEFAULT_REPLY_STYLE,
  replyLanguageMode: DEFAULT_REPLY_LANGUAGE_MODE
};

const DIAGNOSTIC_LOG_STORAGE_KEY = "xtensionDiagnosticLogs";
const DIAGNOSTIC_LOG_LIMIT = 160;
const DIAGNOSTIC_LOG_STRING_LIMIT = 900;
const BRIDGE_UNREACHABLE_CODE = "bridge_unreachable";
let diagnosticLogWriteQueue = Promise.resolve();

runtimeApi.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) {
    return false;
  }

  if (message.type === "xtension-fetch-image") {
    fetchImageAsDataUrl(message.url).then((image) => {
      sendResponse({
        ok: true,
        image
      });
    }).catch((error) => {
      sendResponse({
        ok: false,
        error: error.message
      });
    });

    return true;
  }

  if (message.type === "xtension-generate-reply-suggestions") {
    sendLoggedAiResponse(
      "reply_suggestions",
      "replies",
      "generation_failed",
      sendResponse,
      () => generateReplySuggestions(message.context, message.locale),
      {
        locale: cleanText(message.locale || ""),
        contextLength: getReplyContextTextLength(message.context),
        hasContext: Boolean(message.context)
      }
    );

    return true;
  }

  if (message.type === "xtension-get-reply-prompt-profiles") {
    getReplyPromptProfilesForUi().then((profiles) => {
      sendResponse({
        ok: true,
        profiles
      });
    }).catch((error) => {
      sendResponse({
        ok: false,
        error: error.message
      });
    });

    return true;
  }

  if (message.type === "xtension-generate-reply-suggestion-profile") {
    const profileIndex = normalizeReplyProfileIndex(message.profileIndex);
    sendLoggedAiResponse(
      "reply_profile",
      "reply",
      "generation_failed",
      sendResponse,
      () => generateReplySuggestionProfile(profileIndex, message.context, message.locale),
      {
        locale: cleanText(message.locale || ""),
        profileIndex,
        contextLength: getReplyContextTextLength(message.context),
        hasContext: Boolean(message.context)
      }
    );

    return true;
  }

  if (message.type === "xtension-correct-reply-draft") {
    sendLoggedAiResponse(
      "draft_correct",
      "correctedText",
      "correction_failed",
      sendResponse,
      () => transformReplyDraft("correct", message.text, message.locale, message.targetLanguage),
      {
        locale: cleanText(message.locale || ""),
        inputLength: String(message.text || "").length
      }
    );

    return true;
  }

  if (message.type === "xtension-translate-reply-draft") {
    sendLoggedAiResponse(
      "draft_translate",
      "translatedText",
      "translation_failed",
      sendResponse,
      () => transformReplyDraft("translate", message.text, message.locale, message.targetLanguage, message.context),
      {
        locale: cleanText(message.locale || ""),
        targetLanguage: cleanText(message.targetLanguage || ""),
        inputLength: String(message.text || "").length,
        hasContext: Boolean(message.context)
      }
    );

    return true;
  }

  if (message.type === "xtension-generate-reply-draft") {
    sendLoggedAiResponse(
      "draft_generate",
      "generatedText",
      "generation_failed",
      sendResponse,
      () => transformReplyDraft("generate", message.text, message.locale, message.targetLanguage, message.context),
      {
        locale: cleanText(message.locale || ""),
        targetLanguage: cleanText(message.targetLanguage || ""),
        inputLength: String(message.text || "").length,
        hasContext: Boolean(message.context)
      }
    );

    return true;
  }

  if (message.type === "xtension-get-diagnostic-logs") {
    getDiagnosticLogs().then((logs) => {
      sendResponse({
        ok: true,
        logs
      });
    }).catch((error) => {
      sendResponse({
        ok: false,
        error: error.message
      });
    });

    return true;
  }

  if (message.type === "xtension-clear-diagnostic-logs") {
    clearDiagnosticLogs().then(() => {
      sendResponse({ ok: true });
    }).catch((error) => {
      sendResponse({
        ok: false,
        error: error.message
      });
    });

    return true;
  }

  if (message.type === "xtension-open-options") {
    openExtensionOptions().then(() => {
      sendResponse({ ok: true });
    }).catch((error) => {
      sendResponse({
        ok: false,
        error: error.message
      });
    });

    return true;
  }

  return false;
});

function sendLoggedAiResponse(operation, responseKey, fallbackCode, sendResponse, task, metadata = {}) {
  const startedAt = Date.now();
  appendDiagnosticLog({
    level: "info",
    area: "ai",
    event: "operation_start",
    operation,
    ...metadata
  }).catch(() => {});

  task().then((value) => {
    appendDiagnosticLog({
      level: "info",
      area: "ai",
      event: "operation_done",
      operation,
      ok: true,
      durationMs: Date.now() - startedAt,
      ...getDiagnosticOutputMetadata(value)
    }).catch(() => {});

    sendResponse({
      ok: true,
      [responseKey]: value
    });
  }).catch((error) => {
    appendDiagnosticLog({
      level: "error",
      area: "ai",
      event: "operation_failed",
      operation,
      ok: false,
      durationMs: Date.now() - startedAt,
      errorCode: error?.code || fallbackCode,
      errorMessage: error?.message || String(error || "")
    }).catch(() => {});

    sendResponse({
      ok: false,
      error: error.message,
      code: error.code || fallbackCode
    });
  });
}

function getDiagnosticOutputMetadata(value) {
  if (Array.isArray(value)) {
    return {
      outputCount: value.length
    };
  }

  return {
    outputLength: String(value || "").length
  };
}

function getReplyContextTextLength(context) {
  return [
    context?.tweetText,
    context?.authorProfileContext,
    ...(Array.isArray(context?.quotedTweets) ? context.quotedTweets.map((item) => item?.text || "") : []),
    ...(Array.isArray(context?.linkCards) ? context.linkCards.map((item) => [item?.title, item?.description].filter(Boolean).join(" ")) : [])
  ].join(" ").length;
}

async function appendDiagnosticLog(entry) {
  const sanitized = sanitizeDiagnosticLogEntry({
    time: new Date().toISOString(),
    ...entry
  });

  diagnosticLogWriteQueue = diagnosticLogWriteQueue.then(async () => {
    const stored = await storageGet({ [DIAGNOSTIC_LOG_STORAGE_KEY]: [] });
    const logs = Array.isArray(stored[DIAGNOSTIC_LOG_STORAGE_KEY]) ? stored[DIAGNOSTIC_LOG_STORAGE_KEY] : [];
    logs.push(sanitized);
    await storageSet({
      [DIAGNOSTIC_LOG_STORAGE_KEY]: logs.slice(-DIAGNOSTIC_LOG_LIMIT)
    });
  }).catch(() => {});

  return diagnosticLogWriteQueue;
}

async function getDiagnosticLogs() {
  const stored = await storageGet({ [DIAGNOSTIC_LOG_STORAGE_KEY]: [] });
  const logs = Array.isArray(stored[DIAGNOSTIC_LOG_STORAGE_KEY]) ? stored[DIAGNOSTIC_LOG_STORAGE_KEY] : [];
  return logs.slice(-DIAGNOSTIC_LOG_LIMIT).reverse();
}

async function clearDiagnosticLogs() {
  await storageSet({ [DIAGNOSTIC_LOG_STORAGE_KEY]: [] });
}

function sanitizeDiagnosticLogEntry(value, depth = 0) {
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return truncateText(value, DIAGNOSTIC_LOG_STRING_LIMIT);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeDiagnosticLogEntry(item, depth + 1));
  }

  if (typeof value !== "object" || depth > 4) {
    return String(value);
  }

  const sanitized = {};
  for (const [key, item] of Object.entries(value)) {
    if (/api.?key|token|authorization|prompt|tweetText|text|content/i.test(key)) {
      sanitized[key] = item ? "[redacted]" : "";
      continue;
    }
    sanitized[key] = sanitizeDiagnosticLogEntry(item, depth + 1);
  }

  return sanitized;
}

function logAiRoute(config, operation, details = {}) {
  const provider = normalizeReplyProvider(config?.provider);
  return appendDiagnosticLog({
    level: "info",
    area: "ai",
    event: "route_selected",
    operation,
    provider,
    route: "ai-bridge",
    bridgeConfigured: Boolean(normalizeCodexBridgeUrl(config?.codexBridgeUrl)),
    bridgeTokenPresent: Boolean(config?.bridgeToken),
    codexModel: normalizeCodexModel(config?.codexModel),
    replyCount: normalizeReplyCount(config?.replyCount),
    replyStyle: normalizeReplyStyle(config?.replyStyle),
    replyLanguageMode: normalizeReplyLanguageMode(config?.replyLanguageMode),
    ...details
  }).catch(() => {});
}

async function fetchImageAsDataUrl(url) {
  const response = await fetch(url, {
    cache: "force-cache",
    credentials: "omit"
  });

  if (!response.ok) {
    throw new Error(`Image ${response.status}`);
  }

  const mimeType = response.headers.get("content-type") || "application/octet-stream";
  const bytes = new Uint8Array(await response.arrayBuffer());

  return {
    mimeType,
    dataUrl: `data:${mimeType};base64,${uint8ArrayToBase64(bytes)}`
  };
}

function uint8ArrayToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

async function openExtensionOptions() {
  const optionsUrl = runtimeApi?.getURL?.("options.html");
  if (optionsUrl && extensionApi?.tabs?.create) {
    await createExtensionTab(optionsUrl);
    return;
  }

  if (runtimeApi?.openOptionsPage) {
    const maybePromise = runtimeApi.openOptionsPage();
    if (maybePromise && typeof maybePromise.then === "function") {
      await maybePromise;
    }
    return;
  }

  throw new Error("Options page is unavailable.");
}

async function createExtensionTab(url) {
  await new Promise((resolve, reject) => {
    try {
      const maybePromise = extensionApi.tabs.create({ url }, () => {
        const error = runtimeApi?.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve();
      });

      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(resolve, reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

async function generateReplySuggestions(context, locale) {
  const config = await getReplyAiConfig();

  if (!config.enabled) {
    logAiRoute(config, "reply_suggestions", {
      enabled: false
    });
    const error = new Error("AI bridge is not configured.");
    error.code = "not_configured";
    throw error;
  }

  const replyCount = normalizeReplyCount(config.replyCount);
  logAiRoute(config, "reply_suggestions", {
    model: normalizeCodexModel(config.codexModel)
  });

  const replies = await generateBridgeReplySuggestions(config, context || {}, locale);
  if (replies.length >= replyCount) {
    return replies.slice(0, replyCount);
  }

  throw new Error("The selected provider returned fewer than three reply suggestions.");
}

async function getReplyPromptProfilesForUi() {
  const config = await getReplyAiConfig();
  return config.replyPromptProfiles.map((profile, index) => ({
    index,
    label: profile.label
  }));
}

async function generateReplySuggestionProfile(profileIndex, context, locale) {
  const config = await getReplyAiConfig();
  const profile = getReplyPromptProfile(config, profileIndex);

  if (!config.enabled) {
    logAiRoute(config, "reply_profile", {
      enabled: false,
      profileIndex,
      profileLabel: profile.label
    });
    const error = new Error("AI bridge is not configured.");
    error.code = "not_configured";
    throw error;
  }

  logAiRoute(config, "reply_profile", {
    model: normalizeCodexModel(config.codexModel),
    profileIndex,
    profileLabel: profile.label
  });

  const reply = await generateBridgeReplySuggestionProfile(config, profileIndex, profile, context || {}, locale);
  if (!reply?.text) {
    throw new Error("The selected provider did not return this reply profile.");
  }

  return reply;
}

async function transformReplyDraft(operation, text, locale, targetLanguage, context) {
  const config = await getReplyAiConfig();
  const draftText = String(text || "").trim();
  const normalizedOperation = normalizeDraftTransformOperation(operation);

  if (!config.enabled) {
    logAiRoute(config, `draft_${normalizedOperation}`, {
      enabled: false
    });
    const error = new Error("AI bridge is not configured.");
    error.code = "not_configured";
    throw error;
  }

  if (!draftText) {
    return "";
  }

  logAiRoute(config, `draft_${normalizedOperation}`, {
    model: normalizeCodexModel(config.codexModel),
    hasContext: Boolean(context)
  });

  const transformedText = await transformReplyDraftWithBridge(config, normalizedOperation, draftText, locale, targetLanguage, context);
  if (normalizedOperation === "correct") {
    return refineDraftCorrection(draftText, transformedText, locale, targetLanguage) || draftText;
  }

  return transformedText || draftText;
}

async function getReplyAiConfig() {
  const stored = await storageGet({ replyAiConfig: null });
  const rawConfig = stored.replyAiConfig || null;
  const config = normalizeReplyAiConfig(rawConfig);

  if (shouldPersistReplyAiConfig(rawConfig, config)) {
    storageSet({ replyAiConfig: config }).catch(() => {});
  }

  return config;
}

function normalizeReplyAiConfig(config) {
  const rawConfig = config && typeof config === "object" ? config : {};
  const normalized = {
    ...DEFAULT_REPLY_AI_CONFIG,
    ...rawConfig
  };

  normalized.configVersion = REPLY_AI_CONFIG_VERSION;
  normalized.enabled = typeof rawConfig.enabled === "boolean" ? rawConfig.enabled : true;
  normalized.provider = normalizeReplyProvider(normalized.provider);
  normalized.codexBridgeUrl = normalizeCodexBridgeUrl(normalized.codexBridgeUrl) || DEFAULT_CODEX_BRIDGE_URL;
  normalized.bridgeToken = cleanText(normalized.bridgeToken || "");
  normalized.codexModel = normalizeProviderModel(normalized.provider, normalized.codexModel);
  normalized.codexModelPreset = cleanText(normalized.codexModelPreset || normalized.codexModel || "");
  normalized.prompt = cleanDraftText(normalized.prompt || DEFAULT_REPLY_SYSTEM_PROMPT) || DEFAULT_REPLY_SYSTEM_PROMPT;
  if (shouldUpgradeDefaultPrompt(rawConfig.prompt)) {
    normalized.prompt = DEFAULT_REPLY_SYSTEM_PROMPT;
  }
  normalized.replyPromptProfiles = normalizeReplyPromptProfiles(normalized.replyPromptProfiles, rawConfig.prompt);
  normalized.replyCount = normalizeReplyCount(normalized.replyCount);
  normalized.replyStyle = normalizeReplyStyle(normalized.replyStyle);
  normalized.replyLanguageMode = normalizeReplyLanguageMode(normalized.replyLanguageMode);

  delete normalized.baseUrl;
  delete normalized.model;
  delete normalized.apiKey;
  delete normalized.webSearchEnabled;
  delete normalized.webSearchApiKey;
  delete normalized.codexEnabled;
  delete normalized.cliModelMode;
  delete normalized.claudeModel;
  delete normalized.geminiModel;
  delete normalized.embeddedLocalEnabled;
  delete normalized.embeddedLocalModel;
  delete normalized.embeddedLocalRoutes;

  return normalized;
}

function cloneDefaultReplyPromptProfiles() {
  return DEFAULT_REPLY_PROMPT_PROFILES.map((profile) => ({ ...profile }));
}

function normalizeReplyPromptProfiles(value, legacyPrompt) {
  const input = Array.isArray(value) ? value : [];
  const defaults = cloneDefaultReplyPromptProfiles();
  const legacy = cleanDraftText(legacyPrompt || "");

  return defaults.map((fallback, index) => {
    const raw = input[index] && typeof input[index] === "object" ? input[index] : {};
    return {
      label: cleanText(raw.label || raw.name || fallback.label).slice(0, 80) || fallback.label,
      prompt: cleanDraftText(raw.prompt || (legacy && index === 0 ? legacy : "") || fallback.prompt) || fallback.prompt
    };
  });
}

function normalizeReplyProfileIndex(value) {
  const index = Number.parseInt(value, 10);
  if (!Number.isFinite(index)) {
    return 0;
  }
  return Math.min(2, Math.max(0, index));
}

function getReplyPromptProfile(config, profileIndex) {
  const profiles = normalizeReplyPromptProfiles(config?.replyPromptProfiles, config?.prompt);
  return profiles[normalizeReplyProfileIndex(profileIndex)] || profiles[0];
}

function shouldUpgradeDefaultPrompt(prompt) {
  const value = String(prompt || "");
  return !value
    || /sharp insight or contrarian angle|useful context or actionable takeaway|punchy social reaction/i.test(value)
    || /toneSignals include humor|Contextual joke|humor,\s*sharp,\s*useful,\s*question|make reply 1 genuinely funny/i.test(value)
    || /You write native X\/Twitter reply suggestions|Make the replies specific and worth choosing|Each reply text should usually be 90 to 260 characters/i.test(value)
    || /high-judgment X\/Twitter reply strategist|one nuanced or tradeoff-based reply|Reasoned argument.*Nuance.*Practical context/i.test(value)
    || /one human reaction with bite, one concise reasoned argument, and one sharper or more memorable take/i.test(value)
    || /Reply 2 must be medium length: usually one or two sentences|Reply 3 must be longer only because it adds substance: usually two to four short sentences/i.test(value);
}

function shouldPersistReplyAiConfig(rawConfig, normalizedConfig) {
  if (!rawConfig || typeof rawConfig !== "object") {
    return true;
  }

  return JSON.stringify(rawConfig) !== JSON.stringify(normalizedConfig);
}

async function generateBridgeReplySuggestions(config, context, locale) {
  const bridgeUrl = normalizeCodexBridgeUrl(config.codexBridgeUrl);
  if (!bridgeUrl) {
    const error = new Error("AI bridge URL is invalid.");
    error.code = "not_configured";
    throw error;
  }

  const startedAt = Date.now();
  const response = await fetchBridgeRequest(`${bridgeUrl}/reply`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...buildBridgeAuthHeaders(config)
    },
    body: JSON.stringify({
      operation: "reply",
      provider: normalizeReplyProvider(config.provider),
      model: normalizeCodexModel(config.codexModel),
      systemPrompt: config.prompt,
      locale,
      context,
      replyCount: normalizeReplyCount(config.replyCount),
      replyStyle: normalizeReplyStyle(config.replyStyle),
      replyLanguageMode: normalizeReplyLanguageMode(config.replyLanguageMode),
      targetLanguage: getReplyTargetLanguage(config, context?.tweetLanguage || "", locale)
    })
  }, {
    operation: "reply_suggestions",
    provider: normalizeReplyProvider(config.provider)
  });

  if (!response.ok) {
    appendDiagnosticLog({
      level: "warn",
      area: "ai",
      event: "bridge_failed",
      operation: "reply_suggestions",
      provider: normalizeReplyProvider(config.provider),
      status: response.status,
      durationMs: Date.now() - startedAt
    }).catch(() => {});
    throw new Error(await formatHttpError(response));
  }

  const data = await response.json();
  const replies = normalizeReplySuggestions(data?.replies || (data?.reply ? [data.reply] : [data]));
  appendDiagnosticLog({
    level: "info",
    area: "ai",
    event: "bridge_done",
    operation: "reply_suggestions",
    provider: normalizeReplyProvider(config.provider),
    outputCount: replies.length,
    durationMs: Date.now() - startedAt
  }).catch(() => {});

  return replies;
}

async function generateBridgeReplySuggestionProfile(config, profileIndex, profile, context, locale) {
  const bridgeUrl = normalizeCodexBridgeUrl(config.codexBridgeUrl);
  if (!bridgeUrl) {
    const error = new Error("AI bridge URL is invalid.");
    error.code = "not_configured";
    throw error;
  }

  const startedAt = Date.now();
  const response = await fetchBridgeRequest(`${bridgeUrl}/reply`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...buildBridgeAuthHeaders(config)
    },
    body: JSON.stringify({
      operation: "reply",
      provider: normalizeReplyProvider(config.provider),
      model: normalizeCodexModel(config.codexModel),
      systemPrompt: profile.prompt,
      replyProfile: {
        index: profileIndex,
        label: profile.label
      },
      locale,
      context,
      replyCount: 1,
      replyStyle: normalizeReplyStyle(config.replyStyle),
      replyLanguageMode: normalizeReplyLanguageMode(config.replyLanguageMode),
      targetLanguage: getReplyTargetLanguage(config, context?.tweetLanguage || "", locale)
    })
  }, {
    operation: "reply_profile",
    provider: normalizeReplyProvider(config.provider),
    profileIndex,
    profileLabel: profile.label
  });

  if (!response.ok) {
    appendDiagnosticLog({
      level: "warn",
      area: "ai",
      event: "bridge_failed",
      operation: "reply_profile",
      provider: normalizeReplyProvider(config.provider),
      profileIndex,
      profileLabel: profile.label,
      status: response.status,
      durationMs: Date.now() - startedAt
    }).catch(() => {});
    throw new Error(await formatHttpError(response));
  }

  const data = await response.json();
  const replies = normalizeReplySuggestions(data?.replies || (data?.reply ? [data.reply] : [data])).slice(0, 1);
  const reply = replies[0] || null;
  appendDiagnosticLog({
    level: "info",
    area: "ai",
    event: "bridge_done",
    operation: "reply_profile",
    provider: normalizeReplyProvider(config.provider),
    profileIndex,
    profileLabel: profile.label,
    outputCount: reply ? 1 : 0,
    durationMs: Date.now() - startedAt
  }).catch(() => {});

  return reply ? {
    ...reply,
    style: profile.label,
    profileIndex,
    profileLabel: profile.label
  } : null;
}

async function transformReplyDraftWithBridge(config, operation, text, locale, targetLanguage, context) {
  const bridgeUrl = normalizeCodexBridgeUrl(config.codexBridgeUrl);
  if (!bridgeUrl) {
    const error = new Error("AI bridge URL is invalid.");
    error.code = "not_configured";
    throw error;
  }

  const response = await fetchBridgeRequest(`${bridgeUrl}/transform`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...buildBridgeAuthHeaders(config)
    },
    body: JSON.stringify({
      operation: normalizeDraftTransformOperation(operation),
      provider: normalizeReplyProvider(config.provider),
      model: normalizeCodexModel(config.codexModel),
      locale,
      targetLanguage,
      context,
      text
    })
  }, {
    operation: `draft_${normalizeDraftTransformOperation(operation)}`,
    provider: normalizeReplyProvider(config.provider)
  });

  if (!response.ok) {
    throw new Error(await formatHttpError(response));
  }

  const data = await response.json();
  return sanitizeGeneratedReplyText(data?.text || data?.correctedText || data?.translatedText || data?.generatedText || "");
}

async function fetchBridgeRequest(url, options, details = {}) {
  const startedAt = Date.now();

  try {
    return await fetch(url, options);
  } catch (error) {
    appendDiagnosticLog({
      level: "warn",
      area: "ai",
      event: "bridge_unreachable",
      ok: false,
      durationMs: Date.now() - startedAt,
      errorMessage: error?.message || String(error || ""),
      ...details
    }).catch(() => {});

    const bridgeError = new Error("Xtension Bridge is not running or is unreachable.");
    bridgeError.code = BRIDGE_UNREACHABLE_CODE;
    bridgeError.cause = error;
    throw bridgeError;
  }
}

function normalizeCodexBridgeUrl(value) {
  try {
    const url = new URL(String(value || DEFAULT_CODEX_BRIDGE_URL).trim());
    if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
      return "";
    }
    return `${url.protocol}//${url.host}`;
  } catch (error) {
    return "";
  }
}

function normalizeCodexModel(value) {
  const model = cleanText(value || "");
  if (!model || model === "__cli_default__") {
    return "";
  }
  return model;
}

function normalizeProviderModel(provider, value) {
  const model = normalizeCodexModel(value);
  if (normalizeReplyProvider(provider) !== "codex" && model === DEFAULT_CODEX_MODEL) {
    return "";
  }
  return model;
}

function normalizeReplyProvider(value) {
  const rawProvider = cleanText(value || "").toLowerCase().replace(/_/g, "-");
  const provider = PROVIDER_ALIASES.get(rawProvider) || rawProvider || DEFAULT_REPLY_PROVIDER;
  return REPLY_PROVIDERS.has(provider) ? provider : DEFAULT_REPLY_PROVIDER;
}

function buildBridgeAuthHeaders(config) {
  const token = cleanText(config?.bridgeToken || "");
  return token ? { "x-xtension-bridge-token": token } : {};
}

function getReplyTargetLanguage(config, tweetLanguage, uiLocale) {
  if (normalizeReplyLanguageMode(config.replyLanguageMode) === "ui") {
    return cleanText(uiLocale || "unknown");
  }

  return cleanText(tweetLanguage || uiLocale || "unknown");
}

async function formatHttpError(response) {
  let body = "";
  try {
    body = await response.text();
  } catch (error) {
    body = "";
  }

  const message = extractHttpErrorMessage(body);
  return message ? `${response.status} ${message}` : `${response.status} ${response.statusText || "HTTP error"}`;
}

function extractHttpErrorMessage(body) {
  const parsed = tryParseJson(body);
  if (parsed) {
    return parsed.error?.message
      || parsed.error
      || parsed.message
      || parsed.detail
      || "";
  }

  return truncateText(cleanText(body), 360);
}

function normalizeReplySuggestions(values) {
  const normalized = [];
  const seen = new Set();
  const input = Array.isArray(values) ? values : [];

  for (const value of input) {
    const reply = normalizeReplySuggestion(value);
    if (!reply.text || isLowQualityReplySuggestion(reply)) {
      continue;
    }

    const key = normalizeComparableText(reply.text);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(reply);
  }

  return normalized.slice(0, MAX_REPLY_COUNT);
}

function normalizeReplySuggestion(value) {
  if (value && typeof value === "object") {
    const styleId = normalizeReplyStyleId(value.styleId || value.style_id || value.style || value.type || "");
    return {
      styleId: styleId || "codex",
      style: cleanText(value.style || value.label || ""),
      text: limitReplySuggestionText(value.text || value.reply || value.content || value.message || "", styleId || "codex")
    };
  }

  return {
    styleId: "codex",
    style: "",
    text: limitReplySuggestionText(value, "codex")
  };
}

function limitReplySuggestionText(value, styleId) {
  const sentence = extractFirstReplySentence(value);
  return clampReplySentence(sentence, getReplySuggestionMaxLength(styleId));
}

function extractFirstReplySentence(value) {
  const text = cleanText(sanitizeGeneratedReplyText(value).replace(/\n+/g, " "));
  if (!text) {
    return "";
  }

  const sentenceMatch = text.match(/^(.+?[.!?…。！？])(?:\s+["'“”‘’([{]*[A-ZÀ-ÖØ-Þ0-9]|\s*$)/);
  return cleanText(sentenceMatch?.[1] || text.replace(/\s*;\s*/g, ", "));
}

function clampReplySentence(value, maxLength) {
  const text = cleanText(value);
  if (!maxLength || text.length <= maxLength) {
    return ensureSentencePunctuation(text);
  }

  const clipped = cleanText(text.slice(0, maxLength).replace(/\s+\S*$/, "").replace(/[,:;\u2013\u2014-]+$/, ""));
  return ensureSentencePunctuation(clipped || text.slice(0, maxLength));
}

function sanitizeGeneratedReplyText(value) {
  return cleanDraftText(value).replace(PROHIBITED_REPLY_SYMBOL_PATTERN, ",");
}

function ensureSentencePunctuation(value) {
  const text = cleanText(value);
  if (!text || /[.!?…。！？]$/.test(text)) {
    return text;
  }
  return `${text}.`;
}

function getReplySuggestionMaxLength(styleId) {
  const normalizedStyleId = normalizeReplyStyleId(styleId);
  if (normalizedStyleId === "short") {
    return 110;
  }
  if (normalizedStyleId === "medium") {
    return 210;
  }
  if (normalizedStyleId === "long") {
    return 300;
  }
  return 220;
}

function isLowQualityReplySuggestion(reply) {
  const text = cleanText(reply?.text || "").toLowerCase();

  if (!text) {
    return true;
  }

  return /\b(?:great question|it'?s great that|it is great that|i'?m sure there are|consider testing|it might help|might help clarify|fresh perspectives|which feature aligns)\b/i.test(text);
}

function refineDraftCorrection(originalText, candidateText, locale, targetLanguage) {
  const original = cleanDraftText(originalText);
  const candidate = cleanDraftText(candidateText);

  if (!candidate || isMetaCorrectionResponse(candidate)) {
    return original;
  }

  if (cleanText(targetLanguage || "").toLowerCase() && cleanText(targetLanguage || "").toLowerCase() !== "unknown") {
    return candidate;
  }

  if (isSuspiciousCorrectionCandidate(original, candidate)) {
    return original;
  }

  return candidate;
}

function isMetaCorrectionResponse(value) {
  const text = normalizeComparableText(value);
  return /\b(?:no correction needed|no corrections needed|aucune correction|pas besoin de correction|nothing to correct|no change needed)\b/i.test(text);
}

function isSuspiciousCorrectionCandidate(original, candidate) {
  const originalValue = normalizeComparableText(original);
  const candidateValue = normalizeComparableText(candidate);

  if (!candidateValue) {
    return true;
  }

  if (candidateValue.length < Math.max(8, originalValue.length * 0.45)) {
    return true;
  }

  const originalTokens = getMeaningfulCorrectionTokens(originalValue);
  if (!originalTokens.length) {
    return false;
  }

  const candidateTokens = new Set(getMeaningfulCorrectionTokens(candidateValue));
  const missing = originalTokens.filter((token) => !candidateTokens.has(token));
  return missing.length > Math.ceil(originalTokens.length * 0.45);
}

function getMeaningfulCorrectionTokens(value) {
  return getCorrectionTokens(value).filter((token) => token.length >= 3 && !/^(?:une?|des?|les?|la|le|ce|ces?|du|aux?|pour|avec|dans|sur|est|sont|pas|you|the|and|for|that|this|with)$/.test(token));
}

function dropsOriginalTokensPreservedByFallback(original, candidate, fallback) {
  if (!fallback || normalizeComparableText(fallback) === normalizeComparableText(original)) {
    return false;
  }

  const originalTokens = new Set(getMeaningfulCorrectionTokens(original));
  const candidateTokens = new Set(getMeaningfulCorrectionTokens(candidate));
  const fallbackTokens = new Set(getMeaningfulCorrectionTokens(fallback));
  const preservedByFallback = Array.from(originalTokens).filter((token) => fallbackTokens.has(token));
  if (!preservedByFallback.length) {
    return false;
  }

  const droppedByCandidate = preservedByFallback.filter((token) => !candidateTokens.has(token));
  return droppedByCandidate.length > Math.ceil(preservedByFallback.length * 0.35);
}

function getCorrectionTokens(value) {
  return normalizeComparableText(value).match(/[a-z0-9]{2,}/g) || [];
}

function normalizeComparableText(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function storageGet(defaults) {
  return new Promise((resolve) => {
    if (!storageApi?.get) {
      resolve(defaults || {});
      return;
    }

    try {
      const maybePromise = storageApi.get(defaults, (result) => {
        resolve(result || defaults || {});
      });
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then((result) => resolve(result || defaults || {}), () => resolve(defaults || {}));
      }
    } catch (error) {
      resolve(defaults || {});
    }
  });
}

function storageSet(values) {
  return new Promise((resolve, reject) => {
    if (!storageApi?.set) {
      resolve();
      return;
    }

    try {
      const maybePromise = storageApi.set(values, () => {
        const error = runtimeApi?.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve();
      });
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(resolve, reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

function truncateText(value, maxLength) {
  const text = cleanText(value);
  if (!maxLength || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function cleanDraftText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeReplyCount(value) {
  const count = Number.parseInt(value, 10);

  if (!Number.isFinite(count)) {
    return DEFAULT_REPLY_COUNT;
  }

  return Math.min(MAX_REPLY_COUNT, Math.max(MIN_REPLY_COUNT, count));
}

function normalizeReplyStyle(value) {
  const style = cleanText(value).toLowerCase();
  const allowed = new Set(["auto", "humor", "sharp", "useful", "question", "codex", "custom"]);

  return allowed.has(style) ? style : DEFAULT_REPLY_STYLE;
}

function normalizeDraftTransformOperation(value) {
  const operation = cleanText(value).toLowerCase();
  const allowed = new Set(["correct", "translate", "generate"]);

  return allowed.has(operation) ? operation : "correct";
}

function normalizeReplyStyleId(value) {
  const style = cleanText(value).toLowerCase();

  if (/short|court|courte|punchy|brief/.test(style)) {
    return "short";
  }
  if (/medium|moyen|moyenne|balanced/.test(style)) {
    return "medium";
  }
  if (/long|longue|detailed|développ|developp/.test(style)) {
    return "long";
  }
  if (/argument|reason|raison|preuve|pourquoi/.test(style)) {
    return "argument";
  }
  if (/reaction|réaction|human|humain|instinct|gut|take/.test(style)) {
    return "reaction";
  }
  if (/callout|call out|dénonc|denonc|scandale/.test(style)) {
    return "callout";
  }
  if (/nuance|tradeoff|équilibre|equilibre|limite|réserve|reserve/.test(style)) {
    return "argument";
  }
  if (/support|agree|accord|positif|positive|soutien/.test(style)) {
    return "support";
  }
  if (/humou?r|joke|funny|meme|vanne|dr[oô]le/.test(style)) {
    return "humor";
  }
  if (/sharp|contrarian|angle|direct|malin|tranch/.test(style)) {
    return "sharp";
  }
  if (/useful|context|takeaway|utile|contexte/.test(style)) {
    return "useful";
  }
  if (/question|relance|engag|conversation/.test(style)) {
    return "question";
  }
  if (/codex|search|recherche/.test(style)) {
    return "codex";
  }

  return "";
}

function normalizeReplyLanguageMode(value) {
  return cleanText(value).toLowerCase() === "ui" ? "ui" : DEFAULT_REPLY_LANGUAGE_MODE;
}
