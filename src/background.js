const extensionApi = globalThis.chrome || globalThis.browser;
const runtimeApi = extensionApi?.runtime;
const storageApi = extensionApi?.storage?.local;
const actionApi = extensionApi?.action || extensionApi?.browserAction;
const EXTENSION_VERSION = runtimeApi?.getManifest?.().version || "";
// UI-only connector releases must not disable otherwise compatible AI tools.
// Raise this value only when the loopback API changes incompatibly.
const MINIMUM_CONNECTOR_VERSION = "0.6.35";

const REPLY_AI_CONFIG_VERSION = 27;
const REQUIRED_AI_DATA_CONSENT_VERSION = 2;
const DEFAULT_CODEX_BRIDGE_URL = "http://127.0.0.1:47623";
const DEFAULT_CODEX_MODEL = "gpt-5.6-luna";
const DEFAULT_AI_PRIMARY_PROVIDER = "auto";
const DEFAULT_CLAUDE_MODEL = "sonnet";
const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "hf.co/unsloth/Qwen3.8-27B-GGUF:UD-Q2_K_XL";
const ALLOWED_AI_PROVIDERS = ["openai-codex", "anthropic-claude", "local-ollama"];
// Les réponses X sont courtes et bien délimitées. Le mode low est le meilleur
// compromis mesuré sur ce parcours (Luna low ~3,7 s contre ~6,3 s en medium),
// tout en restant réglable dans les options.
const DEFAULT_CODEX_REASONING_EFFORT = "low";
const CODEX_REASONING_EFFORTS = ["low", "medium", "high", "xhigh", "max", "ultra"];
const DEFAULT_REPLY_TRANSLATION_LANGUAGE = "fr";
const REPLY_TRANSLATION_LANGUAGES = new Set(["fr", "en", "es", "de", "ja"]);
const DEFAULT_REPLY_STYLE = "auto";
const PROHIBITED_REPLY_SYMBOL_PATTERN = /\u2014/g;

const LEGACY_GENERATE_PROMPT_V20 = "Write a punchy, natural X/Twitter post with a clear point of view. Keep it concise, about 1 to 3 sentences, unless the instruction asks for more.";
const LEGACY_GENERATE_PROMPT_V21 = "Write a punchy, natural X/Twitter post with a clear point of view. Keep it concise. When the post contains more than one sentence or idea, use two short paragraphs separated by exactly one blank line; otherwise use one line. Never return a dense block.";
const LEGACY_GENERATE_PROMPT_V23 = "Write a punchy, natural X/Twitter post with a clear point of view. Keep it concise and visually airy. Put each distinct sentence, idea, reaction, or transition in its own very short paragraph whenever natural, separated by exactly one blank line. Use as many short paragraphs as the content needs; never target a fixed paragraph count or combine ideas merely to reduce it. A very short one-sentence post may remain one paragraph.";
const LEGACY_SHARED_GENERATE_PROMPT_V26 = "Write a punchy, natural social-media post or reply with a clear point of view. Follow the visible platform's conventions and length limits. Keep it concise and visually airy. Put each distinct sentence, idea, reaction, or transition in its own very short paragraph whenever natural, separated by exactly one blank line. Use as many short paragraphs as the content needs; never target a fixed paragraph count or combine ideas merely to reduce it. A very short one-sentence post may remain one paragraph.";
const DEFAULT_GENERATE_PROMPT = "Write a punchy, natural new social-media post with a clear point of view. Follow the visible platform's conventions and length limits. Keep it concise and visually airy. Put each distinct sentence, idea, reaction, or transition in its own very short paragraph whenever natural, separated by exactly one blank line. Use as many short paragraphs as the content needs; never target a fixed paragraph count or combine ideas merely to reduce it. A very short one-sentence post may remain one paragraph.";
const DEFAULT_REPLY_GENERATE_PROMPT = "Write a relevant, natural social-media reply to the visible post. Address its actual point directly, add a clear point of view, and avoid generic agreement or unrelated commentary. Follow the visible platform's conventions and length limits. Keep it concise and visually airy, with one blank line between distinct ideas when natural.";
const LEGACY_REPLY_PROMPT_PROFILES_V20 = [
  {
    label: "Short impact",
    prompt: "Write one very short, punchy and direct X/Twitter reply, ideally 45 to 110 characters. Take one clear side from the visible context and avoid generic agreement."
  },
  {
    label: "Medium argument",
    prompt: "Write one natural X/Twitter reply in one sentence, ideally 100 to 210 characters, with one concrete reason or consequence."
  },
  {
    label: "Longer argument",
    prompt: "Write one dense, specific X/Twitter reply, ideally 170 to 300 characters, with a fuller argument and no filler."
  }
];
const LEGACY_REPLY_PROMPT_PROFILES_V21 = [
  {
    label: "Short impact",
    prompt: "Write one very short, punchy and direct X/Twitter reply, ideally 45 to 110 characters. Take one clear side from the visible context and avoid generic agreement."
  },
  {
    label: "Medium argument",
    prompt: "Write one natural X/Twitter reply as two short sentences in two short paragraphs separated by exactly one blank line, ideally 120 to 230 characters, with one concrete reason or consequence. Never return a dense block."
  },
  {
    label: "Longer argument",
    prompt: "Write one specific X/Twitter reply in two or three short paragraphs separated by exactly one blank line, ideally 180 to 320 characters, with a fuller argument and no filler. Never return a dense block."
  }
];
const LEGACY_REPLY_PROMPT_PROFILES_V23 = [
  {
    label: "Short impact",
    prompt: "Write one very short, punchy and direct X/Twitter reply, ideally 45 to 110 characters. Take one clear side from the visible context and avoid generic agreement."
  },
  {
    label: "Medium argument",
    prompt: "Write one natural X/Twitter reply, ideally 120 to 230 characters, with one concrete reason or consequence. Keep it visually airy: give each distinct sentence or idea its own very short paragraph, separated by exactly one blank line. Use as many short paragraphs as the reply needs; never target a fixed paragraph count."
  },
  {
    label: "Longer argument",
    prompt: "Write one specific X/Twitter reply, ideally 180 to 320 characters, with a fuller argument and no filler. Keep it visually airy: put each distinct sentence, idea, reaction, or transition in its own very short paragraph, separated by exactly one blank line. Use as many short paragraphs as the reply needs; never target a fixed paragraph count."
  }
];
const DEFAULT_REPLY_PROMPT_PROFILES = [
  {
    label: "Short impact",
    prompt: "Write one very short, punchy and direct social-media reply. Follow the visible platform's conventions, take one clear side from the context, and avoid generic agreement."
  },
  {
    label: "Medium argument",
    prompt: "Write one natural social-media reply with one concrete reason or consequence. Follow the visible platform's conventions and length limits. Keep it visually airy: give each distinct sentence or idea its own very short paragraph, separated by exactly one blank line. Use as many short paragraphs as the reply needs; never target a fixed paragraph count."
  },
  {
    label: "Longer argument",
    prompt: "Write one specific social-media reply with a fuller argument and no filler. Follow the visible platform's conventions and length limits. Keep it visually airy: put each distinct sentence, idea, reaction, or transition in its own very short paragraph, separated by exactly one blank line. Use as many short paragraphs as the reply needs; never target a fixed paragraph count."
  }
];

const DEFAULT_REPLY_AI_CONFIG = {
  configVersion: REPLY_AI_CONFIG_VERSION,
  enabled: false,
  dataProcessingConsentVersion: 0,
  codexBridgeUrl: DEFAULT_CODEX_BRIDGE_URL,
  bridgeToken: "",
  aiPrimaryProvider: DEFAULT_AI_PRIMARY_PROVIDER,
  aiFallbackEnabled: true,
  codexModel: DEFAULT_CODEX_MODEL,
  codexReasoningEffort: DEFAULT_CODEX_REASONING_EFFORT,
  claudeModel: DEFAULT_CLAUDE_MODEL,
  ollamaUrl: DEFAULT_OLLAMA_URL,
  ollamaModel: DEFAULT_OLLAMA_MODEL,
  replyTranslationLanguage: DEFAULT_REPLY_TRANSLATION_LANGUAGE,
  replyStyle: DEFAULT_REPLY_STYLE,
  replyPromptProfiles: cloneDefaultReplyPromptProfiles(),
  generatePrompt: DEFAULT_GENERATE_PROMPT,
  replyGeneratePrompt: DEFAULT_REPLY_GENERATE_PROMPT
};

const DIAGNOSTIC_LOG_STORAGE_KEY = "xtensionDiagnosticLogs";
const DIAGNOSTIC_LOG_LIMIT = 160;
const DIAGNOSTIC_LOG_STRING_LIMIT = 900;
const BRIDGE_UNREACHABLE_CODE = "bridge_unreachable";
const BRIDGE_COMPATIBILITY_CACHE_MS = 5 * 60 * 1000;
const CONTEXT_IMAGE_CACHE_TTL_MS = 2 * 60 * 1000;
const CONTEXT_IMAGE_CACHE_LIMIT = 8;
const MAX_FETCHED_IMAGE_BYTES = 7 * 1024 * 1024;
let diagnosticLogWriteQueue = Promise.resolve();
let bridgeCompatibilityCache = null;
const contextImageCache = new Map();

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
        error: error.message,
        code: error.code || "image_fetch_failed"
      });
    });

    return true;
  }

  if (message.type === "xtension-get-reply-prompt-profiles") {
    getReplyPromptProfilesForUi().then((profiles) => {
      sendResponse({ ok: true, profiles });
    }).catch((error) => {
      sendResponse({ ok: false, error: error.message, code: error.code || "generation_failed" });
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

  if (message.type === "xtension-generate-image") {
    sendLoggedAiResponse(
      "image_generate",
      "image",
      "image_generation_failed",
      sendResponse,
      () => generateImageWithBridge(message),
      {
        promptLength: String(message.prompt || "").length,
        referenceImageRequested: Boolean(message.referenceImageRequired),
        hasReferenceImage: Boolean(message.referenceImage)
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
      () => transformReplyDraft("generate", message.text, message.locale, message.targetLanguage, message.context, message.composerKind),
      {
        locale: cleanText(message.locale || ""),
        targetLanguage: cleanText(message.targetLanguage || ""),
        inputLength: String(message.text || "").length,
        hasContext: Boolean(message.context),
        composerKind: normalizeDraftComposerKind(message.composerKind, message.context)
      }
    );

    return true;
  }

  if (message.type === "xtension-warmup-bridge") {
    warmupBridge().then(() => {
      sendResponse({ ok: true });
    }).catch(() => {
      // Préchauffage best-effort : on n'expose aucune erreur au composeur.
      sendResponse({ ok: false });
    });

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

  if (message.type === "xtension-native-type") {
    handleNativeTypeRequest(message)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({
        ok: false,
        code: error?.code || "native_type_failed",
        error: error?.message
      }));

    return true;
  }

  if (message.type === "xtension-native-type-prepare") {
    handleNativeTypePrepareRequest(message)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({
        ok: false,
        code: error?.code || "native_type_failed",
        error: error?.message
      }));

    return true;
  }

  if (message.type === "xtension-native-type-capability") {
    handleNativeTypeCapabilityRequest()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({
        ok: false,
        code: error?.code || "native_type_unavailable",
        error: error?.message
      }));

    return true;
  }

  return false;
});

actionApi?.onClicked?.addListener(() => {
  openExtensionOptions().catch(() => {});
});

// Génération en STREAMING via un port (le token-par-token est impossible avec
// sendMessage). content.js ouvre le port "xtension-generate-stream" ; on relaie le
// flux du bridge (/transform-stream). Si le streaming échoue (bridge trop ancien →
// 404, réseau), on RETOMBE sur l'appel non-streaming et on renvoie le texte
// final : l'opération marche donc toujours, avec ou sans aperçu au fil de l'eau.
// Vaut pour la correction, la traduction et la génération : sur ces trois
// opérations l'utilisateur voyait auparavant un écran figé pendant toute la
// durée de l'inférence.
runtimeApi.onConnect?.addListener((port) => {
  if (!port || port.name !== "xtension-generate-stream") {
    return;
  }
  let handled = false;
  port.onMessage.addListener((message) => {
    if (handled || message?.type !== "start") {
      return;
    }
    handled = true;
    streamDraftOperation(port, message).catch((error) => {
      postToPort(port, { type: "error", error: error?.message || "Generation failed.", code: error?.code || "" });
    });
  });
});

function postToPort(port, message) {
  try {
    port.postMessage(message);
  } catch (error) {
    // port fermé côté content : rien à faire
  }
}

async function streamDraftOperation(port, message) {
  const config = await getReplyAiConfig();
  const operation = normalizeDraftTransformOperation(message?.operation || "generate");
  const draftText = String(message?.text || "").trim();
  if (!config.enabled) {
    throw createAiDisabledError(config);
  }
  if (!draftText) {
    postToPort(port, { type: "done", text: "" });
    return;
  }

  const locale = message?.locale || "";
  const targetLanguage = message?.targetLanguage || "";
  const context = message?.context || null;
  const composerKind = normalizeDraftComposerKind(message?.composerKind, context);
  // Seule la génération exploite l'image du tweet ; la récupérer pour une
  // correction ne ferait qu'ajouter un téléchargement au chemin critique.
  const image = operation === "generate" ? await fetchContextImageDataUrl(context) : "";
  const bridgeUrl = normalizeCodexBridgeUrl(config.codexBridgeUrl);
  if (!bridgeUrl) {
    const error = new Error("AI bridge URL is invalid.");
    error.code = "not_configured";
    throw error;
  }

  await ensureCompatibleBridge(config, bridgeUrl);

  try {
    const finalText = await streamTransformFromBridge(config, bridgeUrl, {
      operation,
      locale,
      targetLanguage,
      context,
      text: draftText,
      generatePrompt: getDraftGeneratePrompt(config, composerKind),
      ...getProviderRequestConfig(config),
      ...(image ? { image } : {})
    }, (delta, full) => {
      postToPort(port, { type: "delta", delta, text: full });
    });
    const cleaned = sanitizeGeneratedReplyText(finalText || "");
    const finalValue = operation === "correct"
      ? (refineDraftCorrection(draftText, cleaned, locale, targetLanguage) || draftText)
      : (cleaned || draftText);
    postToPort(port, { type: "done", text: finalValue });
  } catch (error) {
    // Seul un ancien connecteur dépourvu de /transform-stream justifie un repli
    // non-streaming. Une erreur explicite du fournisseur (quota, login, timeout,
    // surcharge...) doit rester une erreur : la rejouer doublerait la requête.
    if (error?.code !== "bridge_stream_unsupported") {
      appendDiagnosticLog({
        level: "error",
        area: "ai",
        event: "draft_stream_failed",
        operation,
        errorCode: error?.code || "generation_failed",
        errorMessage: String(error?.message || error).slice(0, 200)
      }).catch(() => {});
      postToPort(port, {
        type: "error",
        error: error?.message || "Generation failed.",
        code: error?.code || "generation_failed"
      });
      return;
    }

    // Compatibilité avec un connecteur ancien : une seule tentative classique.
    appendDiagnosticLog({
      level: "warn",
      area: "ai",
      event: "draft_stream_fallback",
      operation,
      error: String(error?.message || error).slice(0, 200)
    }).catch(() => {});
    const text = await transformReplyDraft(operation, draftText, locale, targetLanguage, context, composerKind);
    postToPort(port, { type: "done", text });
  }
}

// Lit le flux NDJSON de /transform-stream : {"delta":"..."} au fil de l'eau,
// {"done":true,"text":"..."} final. Renvoie le texte final. Seule l'absence de
// l'endpoint autorise le repli non-streaming en amont.
async function streamTransformFromBridge(config, bridgeUrl, body, onDelta) {
  const response = await fetchBridgeRequest(`${bridgeUrl}/transform-stream`, {
    method: "POST",
    headers: { "content-type": "application/json", ...buildBridgeAuthHeaders(config) },
    body: JSON.stringify(body)
  }, {
    operation: `draft_stream_${normalizeDraftTransformOperation(body?.operation)}`
  });
  if (response.status === 404) {
    const error = new Error("The installed connector does not support streaming transforms.");
    error.code = "bridge_stream_unsupported";
    throw error;
  }
  if (!response.ok) {
    throw await createBridgeHttpError(response);
  }
  if (!response.body) {
    const error = new Error("The installed connector does not expose a readable transform stream.");
    error.code = "bridge_stream_unsupported";
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalText = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) {
        continue;
      }
      let obj;
      try {
        obj = JSON.parse(line);
      } catch (error) {
        continue;
      }
      if (obj.error) {
        const error = new Error(obj.error);
        error.code = obj.code || "";
        throw error;
      }
      if (obj.done) {
        finalText = obj.text || finalText;
      } else if (typeof obj.delta === "string") {
        finalText += obj.delta;
        if (typeof onDelta === "function") {
          onDelta(obj.delta, finalText);
        }
      }
    }
  }
  return finalText;
}

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

  if (value && typeof value === "object" && typeof value.text === "string") {
    return {
      outputLength: value.text.length
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
  return appendDiagnosticLog({
    level: "info",
    area: "ai",
    event: "route_selected",
    operation,
    route: "codex-app-server",
    bridgeConfigured: Boolean(normalizeCodexBridgeUrl(config?.codexBridgeUrl)),
    bridgeTokenPresent: Boolean(config?.bridgeToken),
    replyTranslationLanguage: normalizeReplyTranslationLanguage(config?.replyTranslationLanguage),
    ...details
  }).catch(() => {});
}

// Hôtes d'images autorisés. L'URL vient du DOM de x.com, donc d'une source que
// la page contrôle : sans cette liste, la page ferait émettre au service worker
// des requêtes arbitraires depuis l'origine privilégiée de l'extension.
const ALLOWED_IMAGE_HOSTS = new Set([
  "pbs.twimg.com",
  "abs.twimg.com",
  "video.twimg.com"
]);

function isAllowedImageUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    return false;
  }
  return parsed.protocol === "https:" && ALLOWED_IMAGE_HOSTS.has(parsed.hostname.toLowerCase());
}

async function fetchImageAsDataUrl(url) {
  if (!isAllowedImageUrl(url)) {
    throw createImageFetchError("Image host is not allowed.", "image_host_not_allowed");
  }

  const response = await fetch(url, {
    cache: "force-cache",
    credentials: "omit"
  });

  if (!response.ok) {
    throw createImageFetchError(`Image ${response.status}`, "image_fetch_failed");
  }

  const mimeType = cleanText(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
  if (!/^image\/(?:png|jpe?g|webp|gif)$/i.test(mimeType)) {
    throw createImageFetchError("The downloaded resource is not a supported image.", "image_type_unsupported");
  }
  const declaredLength = Number(response.headers.get("content-length")) || 0;
  if (declaredLength > MAX_FETCHED_IMAGE_BYTES) {
    throw createImageFetchError("The post image is too large to use as a reference.", "image_too_large");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) {
    throw createImageFetchError("The downloaded image is empty.", "image_fetch_failed");
  }
  if (bytes.length > MAX_FETCHED_IMAGE_BYTES) {
    throw createImageFetchError("The post image is too large to use as a reference.", "image_too_large");
  }

  return {
    mimeType,
    byteLength: bytes.length,
    dataUrl: `data:${mimeType};base64,${uint8ArrayToBase64(bytes)}`
  };
}

function createImageFetchError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
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

async function transformReplyDraft(operation, text, locale, targetLanguage, context, composerKind) {
  const config = await getReplyAiConfig();
  const draftText = String(text || "").trim();
  const normalizedOperation = normalizeDraftTransformOperation(operation);
  const normalizedComposerKind = normalizeDraftComposerKind(composerKind, context);

  if (!config.enabled) {
    logAiRoute(config, `draft_${normalizedOperation}`, {
      enabled: false
    });
    throw createAiDisabledError(config);
  }

  if (!draftText) {
    return "";
  }

  // Génération multimodale : on récupère (best-effort) l'image du tweet pour que
  // le modèle vision puisse la « voir ». N'affecte pas correct/translate.
  const image = normalizedOperation === "generate" ? await fetchContextImageDataUrl(context) : "";

  logAiRoute(config, `draft_${normalizedOperation}`, {
    hasContext: Boolean(context),
    hasImage: Boolean(image),
    composerKind: normalizedComposerKind
  });

  const transformedText = await transformReplyDraftWithBridge(config, normalizedOperation, draftText, locale, targetLanguage, context, image, normalizedComposerKind);
  if (normalizedOperation === "correct") {
    return refineDraftCorrection(draftText, transformedText, locale, targetLanguage) || draftText;
  }

  return transformedText || draftText;
}

// Récupère la première image du tweet (contexte) en data URL, en version LÉGÈRE
// (pbs name=small) et bornée en taille. Best-effort : toute erreur -> pas d'image
// (génération texte seul). Ne jamais faire échouer la génération à cause de l'image.
async function fetchContextImageDataUrl(context) {
  try {
    const media = Array.isArray(context?.mediaContext) ? context.mediaContext : [];
    const item = media.find((entry) => entry && entry.type === "image" && entry.imageUrl);
    if (!item) {
      return "";
    }
    const smallUrl = toSmallImageUrl(item.imageUrl);
    const now = Date.now();
    const cached = contextImageCache.get(smallUrl);
    if (cached && now - cached.at < CONTEXT_IMAGE_CACHE_TTL_MS) {
      return await cached.promise;
    }

    const promise = fetchImageAsDataUrl(smallUrl).then((image) => {
      // Borne de sécurité : au-delà, on renonce (le bridge limite /transform à
      // ~6 Mo, et une image trop grande ralentit inutilement l'encodage vision).
      return image?.dataUrl && image.dataUrl.length <= 4 * 1024 * 1024
        ? image.dataUrl
        : "";
    });
    contextImageCache.set(smallUrl, { at: now, promise });
    while (contextImageCache.size > CONTEXT_IMAGE_CACHE_LIMIT) {
      contextImageCache.delete(contextImageCache.keys().next().value);
    }
    promise.catch(() => {
      if (contextImageCache.get(smallUrl)?.promise === promise) {
        contextImageCache.delete(smallUrl);
      }
    });
    return await promise;
  } catch (error) {
    return "";
  }
}

// Demande la variante légère d'une image pbs.twimg.com (name=small) au lieu de large.
function toSmallImageUrl(url) {
  try {
    const parsed = new URL(url);
    if (/pbs\.twimg\.com/i.test(parsed.hostname) && parsed.searchParams.has("name")) {
      parsed.searchParams.set("name", "small");
      return parsed.href;
    }
    return url;
  } catch (error) {
    return url;
  }
}

async function warmupBridge() {
  const config = await getReplyAiConfig();
  if (config?.enabled === false) {
    return;
  }
  const bridgeUrl = normalizeCodexBridgeUrl(config.codexBridgeUrl);
  if (!bridgeUrl) {
    return;
  }
  // Démarre le connecteur Codex et vérifie l'authentification ChatGPT. Best-effort.
  await ensureCompatibleBridge(config, bridgeUrl);
  await fetchBridgeRequest(`${bridgeUrl}/warmup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...buildBridgeAuthHeaders(config)
    },
    // Le modèle est transmis pour que le connecteur prépare un fil du bon
    // modèle avant la première action de l'utilisateur.
    body: JSON.stringify(getProviderRequestConfig(config))
  }, {
    operation: "warmup"
  });
}

async function getReplyPromptProfilesForUi() {
  const config = await getReplyAiConfig();
  return normalizeReplyPromptProfiles(config.replyPromptProfiles).map((profile, index) => ({
    index,
    label: profile.label
  }));
}

async function generateReplySuggestionProfile(profileIndex, context, locale) {
  const config = await getReplyAiConfig();
  const profile = getReplyPromptProfile(config, profileIndex);
  if (!config.enabled) {
    throw createAiDisabledError(config);
  }

  const bridgeUrl = normalizeCodexBridgeUrl(config.codexBridgeUrl);
  if (!bridgeUrl) {
    const error = new Error("AI bridge URL is invalid.");
    error.code = "not_configured";
    throw error;
  }

  await ensureCompatibleBridge(config, bridgeUrl);

  logAiRoute(config, "reply_profile", {
    profileIndex,
    profileLabel: profile.label,
    hasContext: Boolean(context)
  });

  const image = await fetchContextImageDataUrl(context);

  const response = await fetchBridgeRequest(`${bridgeUrl}/reply`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...buildBridgeAuthHeaders(config)
    },
    body: JSON.stringify({
      locale: cleanText(locale || ""),
      targetLanguage: getReplyTargetLanguage(context?.tweetLanguage || ""),
      translationLanguage: normalizeReplyTranslationLanguage(config.replyTranslationLanguage),
      context: context || {},
      systemPrompt: profile.prompt,
      replyProfile: { index: profileIndex, label: profile.label },
      replyStyle: normalizeReplyStyle(config.replyStyle),
      ...getProviderRequestConfig(config),
      ...(image ? { image } : {})
    })
  }, {
    operation: "reply_profile",
    profileIndex
  });

  if (!response.ok) {
    throw await createBridgeHttpError(response);
  }

  const data = await response.json();
  const text = sanitizeGeneratedReplyText(data?.text || data?.reply?.text || data?.reply || "");
  if (!text) {
    throw new Error("Codex did not return a reply for this prompt.");
  }
  return {
    styleId: "custom",
    style: profile.label,
    text,
    translation: sanitizeGeneratedReplyText(data?.translation || data?.reply?.translation || ""),
    translationLanguage: normalizeReplyTranslationLanguage(
      data?.translationLanguage || data?.reply?.translationLanguage || config.replyTranslationLanguage
    ),
    profileIndex,
    profileLabel: profile.label
  };
}

async function generateImageWithBridge(message) {
  const config = await getReplyAiConfig();
  if (!config.enabled) {
    throw createAiDisabledError(config);
  }

  const prompt = cleanDraftText(message?.prompt || "").slice(0, 5000);
  if (!prompt) {
    const error = new Error("An image prompt is required.");
    error.code = "invalid_request";
    throw error;
  }

  const referenceImage = cleanText(message?.referenceImage || "");
  const referenceImageRequired = message?.referenceImageRequired === true;
  if (referenceImageRequired && !referenceImage) {
    const error = new Error("The selected post image was not loaded.");
    error.code = "image_reference_required";
    throw error;
  }

  const aspectRatio = normalizeImageAspectRatio(message?.aspectRatio);
  const visualStyle = normalizeImageVisualOption(message?.visualStyle, ["auto", "photorealistic", "illustration", "infographic", "3d"]);
  const framing = normalizeImageVisualOption(message?.framing, ["auto", "close_up", "wide", "top_down"]);
  const mood = normalizeImageVisualOption(message?.mood, ["auto", "bright", "warm", "cinematic", "minimal"]);

  const bridgeUrl = normalizeCodexBridgeUrl(config.codexBridgeUrl);
  await ensureCompatibleBridge(config, bridgeUrl);
  const response = await fetchBridgeRequest(`${bridgeUrl}/generate-image`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...buildBridgeAuthHeaders(config)
    },
    body: JSON.stringify({
      prompt,
      referenceImage,
      referenceImageRequired,
      aspectRatio,
      visualStyle,
      framing,
      mood,
      model: config.codexModel,
      reasoningEffort: config.codexReasoningEffort
    })
  }, {
    operation: "image_generate"
  });

  if (!response.ok) {
    throw await createBridgeHttpError(response);
  }
  const data = await response.json();
  if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(data?.dataUrl || "")) {
    const error = new Error("Codex completed without returning an image.");
    error.code = "image_generation_failed";
    throw error;
  }
  return {
    dataUrl: data.dataUrl,
    mimeType: cleanText(data.mimeType || "image/png"),
    revisedPrompt: cleanDraftText(data.revisedPrompt || ""),
    aspectRatio: normalizeImageAspectRatio(data.aspectRatio || aspectRatio),
    visualStyle: normalizeImageVisualOption(data.visualStyle || visualStyle, ["auto", "photorealistic", "illustration", "infographic", "3d"]),
    framing: normalizeImageVisualOption(data.framing || framing, ["auto", "close_up", "wide", "top_down"]),
    mood: normalizeImageVisualOption(data.mood || mood, ["auto", "bright", "warm", "cinematic", "minimal"]),
    requestedSize: cleanText(data.requestedSize || ""),
    width: Number(data.width) || 0,
    height: Number(data.height) || 0
  };
}

function normalizeImageAspectRatio(value) {
  const ratio = cleanText(value || "").replace(/\s+/g, "");
  return ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"].includes(ratio) ? ratio : "1:1";
}

function normalizeImageVisualOption(value, allowedValues) {
  const option = cleanText(value || "").toLowerCase();
  return allowedValues.includes(option) ? option : "auto";
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

function createAiDisabledError(config) {
  const consentGranted = Number(config?.dataProcessingConsentVersion) === REQUIRED_AI_DATA_CONSENT_VERSION;
  const error = new Error(consentGranted
    ? "AI tools are disabled in Xtension settings."
    : "Enable AI features in Xtension options first.");
  error.code = consentGranted ? "not_configured" : "consent_required";
  return error;
}

function normalizeReplyAiConfig(config) {
  const rawConfig = config && typeof config === "object" ? config : {};
  const previousConfigVersion = Number(rawConfig.configVersion) || 0;
  const normalized = {
    ...DEFAULT_REPLY_AI_CONFIG,
    ...rawConfig
  };

  normalized.configVersion = REPLY_AI_CONFIG_VERSION;
  normalized.dataProcessingConsentVersion = Number(rawConfig.dataProcessingConsentVersion) === REQUIRED_AI_DATA_CONSENT_VERSION
    ? REQUIRED_AI_DATA_CONSENT_VERSION
    : 0;
  normalized.enabled = normalized.dataProcessingConsentVersion === REQUIRED_AI_DATA_CONSENT_VERSION
    && rawConfig.enabled === true;
  normalized.codexBridgeUrl = normalizeCodexBridgeUrl(normalized.codexBridgeUrl) || DEFAULT_CODEX_BRIDGE_URL;
  normalized.bridgeToken = cleanText(normalized.bridgeToken || "");
  normalized.codexModel = normalizeCodexModel(normalized.codexModel || DEFAULT_CODEX_MODEL);
  normalized.codexReasoningEffort = normalizeCodexReasoningEffort(normalized.codexReasoningEffort || DEFAULT_CODEX_REASONING_EFFORT);
  normalized.aiPrimaryProvider = normalizeAiPrimaryProvider(normalized.aiPrimaryProvider);
  normalized.aiFallbackEnabled = normalized.aiFallbackEnabled !== false;
  normalized.claudeModel = normalizeProviderModel(normalized.claudeModel, DEFAULT_CLAUDE_MODEL);
  normalized.ollamaUrl = normalizeOllamaUrl(normalized.ollamaUrl) || DEFAULT_OLLAMA_URL;
  normalized.ollamaModel = normalizeProviderModel(normalized.ollamaModel, DEFAULT_OLLAMA_MODEL);

  // Migration vers la v20 : l'ancien défaut "max" coûtait ~1,2 s par requête.
  // On ne le remplace que s'il s'agit bien de l'ancien défaut hérité, jamais
  // d'un réglage que l'utilisateur aurait choisi après cette migration.
  if (previousConfigVersion < 20 && cleanText(rawConfig.codexReasoningEffort || "") === "max") {
    normalized.codexReasoningEffort = DEFAULT_CODEX_REASONING_EFFORT;
  }
  if (previousConfigVersion < 21 && cleanText(rawConfig.codexReasoningEffort || "") === "medium") {
    normalized.codexReasoningEffort = DEFAULT_CODEX_REASONING_EFFORT;
  }
  normalized.replyTranslationLanguage = normalizeReplyTranslationLanguage(normalized.replyTranslationLanguage);
  normalized.replyStyle = normalizeReplyStyle(normalized.replyStyle);
  normalized.replyPromptProfiles = (
    previousConfigVersion < 22 && (
      usesLegacyReplyPromptProfiles(rawConfig.replyPromptProfiles, LEGACY_REPLY_PROMPT_PROFILES_V20)
      || usesLegacyReplyPromptProfiles(rawConfig.replyPromptProfiles, LEGACY_REPLY_PROMPT_PROFILES_V21)
    )
  ) || (previousConfigVersion < 24 && usesLegacyReplyPromptProfiles(rawConfig.replyPromptProfiles, LEGACY_REPLY_PROMPT_PROFILES_V23))
    ? cloneDefaultReplyPromptProfiles()
    : normalizeReplyPromptProfiles(normalized.replyPromptProfiles, rawConfig.prompt);
  normalized.generatePrompt = cleanDraftText(normalized.generatePrompt || DEFAULT_GENERATE_PROMPT) || DEFAULT_GENERATE_PROMPT;
  if (
    (previousConfigVersion < 22 && [LEGACY_GENERATE_PROMPT_V20, LEGACY_GENERATE_PROMPT_V21].includes(cleanDraftText(rawConfig.generatePrompt || "")))
    || (previousConfigVersion < 24 && cleanDraftText(rawConfig.generatePrompt || "") === LEGACY_GENERATE_PROMPT_V23)
    || (previousConfigVersion < 27 && cleanDraftText(rawConfig.generatePrompt || "") === LEGACY_SHARED_GENERATE_PROMPT_V26)
  ) {
    normalized.generatePrompt = DEFAULT_GENERATE_PROMPT;
  }
  normalized.replyGeneratePrompt = cleanDraftText(normalized.replyGeneratePrompt || DEFAULT_REPLY_GENERATE_PROMPT) || DEFAULT_REPLY_GENERATE_PROMPT;

  delete normalized.provider;
  delete normalized.codexModelPreset;
  delete normalized.prompt;
  delete normalized.replyCount;
  delete normalized.baseUrl;
  delete normalized.model;
  delete normalized.apiKey;
  delete normalized.gpu;
  delete normalized.replyLanguageMode;

  return normalized;
}

function cloneDefaultReplyPromptProfiles() {
  return DEFAULT_REPLY_PROMPT_PROFILES.map((profile) => ({ ...profile }));
}

function usesLegacyReplyPromptProfiles(value, legacyProfiles) {
  if (!Array.isArray(value) || !Array.isArray(legacyProfiles) || value.length < legacyProfiles.length) {
    return false;
  }
  return legacyProfiles.every((legacy, index) => {
    const profile = value[index] && typeof value[index] === "object" ? value[index] : {};
    return cleanText(profile.label || profile.name || "") === legacy.label
      && cleanDraftText(profile.prompt || "") === legacy.prompt;
  });
}

function normalizeReplyPromptProfiles(value, legacyPrompt) {
  const input = Array.isArray(value) ? value : [];
  const legacy = cleanDraftText(legacyPrompt || "");
  return cloneDefaultReplyPromptProfiles().map((fallback, index) => {
    const raw = input[index] && typeof input[index] === "object" ? input[index] : {};
    return {
      label: cleanText(raw.label || raw.name || fallback.label).slice(0, 80) || fallback.label,
      prompt: cleanDraftText(raw.prompt || (legacy && index === 0 ? legacy : "") || fallback.prompt).slice(0, 5000) || fallback.prompt
    };
  });
}

function normalizeReplyProfileIndex(value) {
  const index = Number.parseInt(value, 10);
  return Number.isFinite(index) ? Math.min(2, Math.max(0, index)) : 0;
}

function getReplyPromptProfile(config, profileIndex) {
  return normalizeReplyPromptProfiles(config?.replyPromptProfiles)[normalizeReplyProfileIndex(profileIndex)] || DEFAULT_REPLY_PROMPT_PROFILES[0];
}

function normalizeReplyStyle(value) {
  const style = cleanText(value).toLowerCase();
  return ["auto", "humor", "sharp", "useful", "question"].includes(style) ? style : DEFAULT_REPLY_STYLE;
}

function normalizeCodexModel(value) {
  const model = cleanText(value);
  return /^[a-z0-9][a-z0-9._:-]{0,127}$/i.test(model) ? model : DEFAULT_CODEX_MODEL;
}

function normalizeCodexReasoningEffort(value) {
  const effort = cleanText(value).toLowerCase();
  return CODEX_REASONING_EFFORTS.includes(effort) ? effort : DEFAULT_CODEX_REASONING_EFFORT;
}

function normalizeAiPrimaryProvider(value) {
  const provider = cleanText(value).toLowerCase();
  return provider === "auto" || ALLOWED_AI_PROVIDERS.includes(provider)
    ? provider
    : DEFAULT_AI_PRIMARY_PROVIDER;
}

function normalizeProviderModel(value, fallback) {
  const model = cleanText(value);
  return model && !/[\x00-\x1f\s]/.test(model) && model.length <= 240 ? model : fallback;
}

function getProviderRequestConfig(config) {
  return {
    allowedProviders: [...ALLOWED_AI_PROVIDERS],
    primaryProvider: normalizeAiPrimaryProvider(config?.aiPrimaryProvider),
    fallbackEnabled: config?.aiFallbackEnabled !== false,
    model: normalizeCodexModel(config?.codexModel || DEFAULT_CODEX_MODEL),
    reasoningEffort: normalizeCodexReasoningEffort(config?.codexReasoningEffort || DEFAULT_CODEX_REASONING_EFFORT),
    claudeModel: normalizeProviderModel(config?.claudeModel, DEFAULT_CLAUDE_MODEL),
    ollamaUrl: normalizeOllamaUrl(config?.ollamaUrl) || DEFAULT_OLLAMA_URL,
    ollamaModel: normalizeProviderModel(config?.ollamaModel, DEFAULT_OLLAMA_MODEL)
  };
}

function shouldPersistReplyAiConfig(rawConfig, normalizedConfig) {
  if (!rawConfig || typeof rawConfig !== "object") {
    return true;
  }

  return JSON.stringify(rawConfig) !== JSON.stringify(normalizedConfig);
}

async function transformReplyDraftWithBridge(config, operation, text, locale, targetLanguage, context, image, composerKind) {
  const bridgeUrl = normalizeCodexBridgeUrl(config.codexBridgeUrl);
  if (!bridgeUrl) {
    const error = new Error("AI bridge URL is invalid.");
    error.code = "not_configured";
    throw error;
  }

  await ensureCompatibleBridge(config, bridgeUrl);

  const response = await fetchBridgeRequest(`${bridgeUrl}/transform`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...buildBridgeAuthHeaders(config)
    },
    body: JSON.stringify({
      operation: normalizeDraftTransformOperation(operation),
      locale,
      targetLanguage,
      context,
      text,
      generatePrompt: getDraftGeneratePrompt(config, normalizeDraftComposerKind(composerKind, context)),
      ...getProviderRequestConfig(config),
      ...(image ? { image } : {})
    })
  }, {
    operation: `draft_${normalizeDraftTransformOperation(operation)}`
  });

  if (!response.ok) {
    throw await createBridgeHttpError(response);
  }

  const data = await response.json();
  return sanitizeGeneratedReplyText(data?.text || data?.correctedText || data?.translatedText || data?.generatedText || "");
}

// La frappe native (isTrusted:true via SendInput) n'est disponible que si le
// connecteur l'annonce (Windows + helper present). On lit la capacite deja mise
// en cache par ensureCompatibleBridge ; un connecteur trop ancien n'expose aucune
// capabilities et la reponse est false -> l'extension garde son injection actuelle.
async function bridgeSupportsNativeType(config) {
  try {
    await ensureCompatibleBridge(config);
  } catch (error) {
    return false;
  }
  return Boolean(
    bridgeCompatibilityCache?.capabilities?.nativeType
    && Number(bridgeCompatibilityCache?.capabilities?.nativeTypeProtocol || 0) >= 3
  );
}

async function prepareNativeTypeWithBridge(config, expectedBrowser) {
  const bridgeUrl = normalizeCodexBridgeUrl(config.codexBridgeUrl);
  if (!bridgeUrl) {
    const error = new Error("AI bridge URL is invalid.");
    error.code = "not_configured";
    throw error;
  }

  const response = await fetchBridgeRequest(`${bridgeUrl}/type-target`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...buildBridgeAuthHeaders(config)
    },
    body: JSON.stringify({ expectedBrowser })
  }, {
    operation: "native_type_prepare"
  });

  if (!response.ok) {
    throw await createBridgeHttpError(response);
  }
  return response.json().catch(() => ({}));
}

async function typeTextWithBridge(config, text, replaceExisting, targetToken, expectedBrowser) {
  const bridgeUrl = normalizeCodexBridgeUrl(config.codexBridgeUrl);
  if (!bridgeUrl) {
    const error = new Error("AI bridge URL is invalid.");
    error.code = "not_configured";
    throw error;
  }

  const response = await fetchBridgeRequest(`${bridgeUrl}/type`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...buildBridgeAuthHeaders(config)
    },
    body: JSON.stringify({
      text,
      replaceExisting: Boolean(replaceExisting),
      targetToken,
      expectedBrowser
    })
  }, {
    operation: "native_type"
  });

  if (!response.ok) {
    throw await createBridgeHttpError(response);
  }
  return response.json().catch(() => ({}));
}

// Repond au content-script qui veut taper le texte via l'entree Windows native.
// Le content-script n'utilise le repli DOM que si cette capacite n'est pas
// annoncee ; un echec apres le demarrage natif est retourne sans reinsertion.
async function handleNativeTypeRequest(message) {
  const config = await getReplyAiConfig();
  if (!config.enabled) {
    return { ok: false, code: Number(config?.dataProcessingConsentVersion) === REQUIRED_AI_DATA_CONSENT_VERSION ? "disabled" : "consent_required" };
  }
  const text = String(message?.text || "");
  if (!text.trim()) {
    return { ok: false, code: "empty" };
  }
  if (!(await bridgeSupportsNativeType(config))) {
    return { ok: false, code: "native_type_unavailable" };
  }
  const targetToken = normalizeNativeTypeTargetToken(message?.targetToken);
  const expectedBrowser = normalizeNativeTypeBrowser(message?.expectedBrowser);
  if (!targetToken || !expectedBrowser) {
    return { ok: false, code: "native_type_target_required" };
  }
  await typeTextWithBridge(config, text, message?.replaceExisting, targetToken, expectedBrowser);
  return { ok: true, typed: true };
}

async function handleNativeTypePrepareRequest(message) {
  const config = await getReplyAiConfig();
  if (!config.enabled) {
    return { ok: false, code: Number(config?.dataProcessingConsentVersion) === REQUIRED_AI_DATA_CONSENT_VERSION ? "disabled" : "consent_required" };
  }
  if (!(await bridgeSupportsNativeType(config))) {
    return { ok: false, code: "native_type_unavailable" };
  }
  const expectedBrowser = normalizeNativeTypeBrowser(message?.expectedBrowser);
  if (!expectedBrowser) {
    return { ok: false, code: "native_type_target_required" };
  }
  const result = await prepareNativeTypeWithBridge(config, expectedBrowser);
  const targetToken = normalizeNativeTypeTargetToken(result?.targetToken);
  return targetToken
    ? { ok: true, targetToken }
    : { ok: false, code: "native_type_target_invalid" };
}

async function handleNativeTypeCapabilityRequest() {
  const config = await getReplyAiConfig();
  if (!config.enabled) {
    return { ok: false, available: false, code: Number(config?.dataProcessingConsentVersion) === REQUIRED_AI_DATA_CONSENT_VERSION ? "disabled" : "consent_required" };
  }
  const available = await bridgeSupportsNativeType(config);
  return { ok: true, available };
}

function normalizeNativeTypeBrowser(value) {
  const browser = cleanText(value || "").toLowerCase();
  return ["chrome", "edge", "firefox"].includes(browser) ? browser : "";
}

function normalizeNativeTypeTargetToken(value) {
  const token = cleanText(value || "");
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : "";
}

async function ensureCompatibleBridge(config, bridgeUrl) {
  const normalizedUrl = normalizeCodexBridgeUrl(bridgeUrl || config?.codexBridgeUrl);
  if (!normalizedUrl) {
    const error = new Error("AI bridge URL is invalid.");
    error.code = "not_configured";
    throw error;
  }

  const now = Date.now();
  if (bridgeCompatibilityCache
      && bridgeCompatibilityCache.url === normalizedUrl
      && bridgeCompatibilityCache.compatible
      && now - bridgeCompatibilityCache.checkedAt < BRIDGE_COMPATIBILITY_CACHE_MS) {
    return bridgeCompatibilityCache.version;
  }

  const response = await fetchBridgeRequest(`${normalizedUrl}/ping`, {
    method: "GET",
    headers: buildBridgeAuthHeaders(config)
  }, {
    operation: "connector_version_check"
  });
  if (!response.ok) {
    throw await createBridgeHttpError(response);
  }

  const data = await response.json().catch(() => ({}));
  const version = cleanText(data?.version || data?.connectorVersion || "");
  const capabilities = data?.capabilities && typeof data.capabilities === "object" ? data.capabilities : {};
  const compatible = version && compareVersions(version, MINIMUM_CONNECTOR_VERSION) >= 0;
  bridgeCompatibilityCache = { url: normalizedUrl, checkedAt: now, version, compatible, capabilities };
  if (!compatible) {
    appendDiagnosticLog({
      level: "error",
      area: "ai",
      event: "connector_update_required",
      expectedVersion: MINIMUM_CONNECTOR_VERSION,
      installedVersion: version || "unknown"
    }).catch(() => {});
    throw createBridgeUpdateError(version);
  }
  return version;
}

function createBridgeUpdateError(version) {
  const installed = cleanText(version || "") || "unknown";
  const error = new Error(`Update the Xtension connector (installed: ${installed}, required: ${MINIMUM_CONNECTOR_VERSION}).`);
  error.code = "bridge_update_required";
  return error;
}

function compareVersions(left, right) {
  const parse = (value) => String(value || "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference) return difference;
  }
  return 0;
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

function normalizeOllamaUrl(value) {
  try {
    const url = new URL(String(value || DEFAULT_OLLAMA_URL).trim());
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    const privateHost = ["localhost", "127.0.0.1", "::1"].includes(host)
      || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
      || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)
      || (() => {
        const match = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
        return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
      })();
    if (!["http:", "https:"].includes(url.protocol) || !privateHost || url.username || url.password) {
      return "";
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

function buildBridgeAuthHeaders(config) {
  const token = cleanText(config?.bridgeToken || "");
  return token ? { "x-xtension-bridge-token": token } : {};
}

function getReplyTargetLanguage(tweetLanguage) {
  return cleanText(tweetLanguage || "unknown");
}

async function formatHttpError(response) {
  return (await createBridgeHttpError(response)).message;
}

async function createBridgeHttpError(response) {
  let body = "";
  try {
    body = await response.text();
  } catch (error) {
    body = "";
  }

  const parsed = tryParseJson(body);
  const message = extractHttpErrorMessageFromParsed(parsed)
    || (!parsed ? truncateText(cleanText(body), 360) : "")
    || response.statusText
    || "HTTP error";
  const error = new Error(`${response.status} ${message}`);
  // Un connecteur trop ancien répond 404 sans code JSON : on synthétise
  // "not_found" pour que l'appelant affiche « mettez à jour le connecteur »
  // plutôt que le brut « 404 Not found. ».
  error.code = cleanText(parsed?.code || "") || (response.status === 404 ? "not_found" : "");
  error.status = response.status;
  return error;
}

function extractHttpErrorMessage(body) {
  const parsed = tryParseJson(body);
  if (parsed) {
    return extractHttpErrorMessageFromParsed(parsed);
  }

  return truncateText(cleanText(body), 360);
}

function extractHttpErrorMessageFromParsed(parsed) {
  if (!parsed) {
    return "";
  }

  return parsed.error?.message
    || parsed.error
    || parsed.message
    || parsed.detail
    || "";
}

function sanitizeGeneratedReplyText(value) {
  return cleanDraftText(value).replace(PROHIBITED_REPLY_SYMBOL_PATTERN, ",");
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

function normalizeDraftTransformOperation(value) {
  const operation = cleanText(value).toLowerCase();
  const allowed = new Set(["correct", "translate", "generate"]);

  return allowed.has(operation) ? operation : "correct";
}

function normalizeDraftComposerKind(value, context) {
  const explicit = cleanText(value || context?.composerKind).toLowerCase();
  return explicit === "reply" ? "reply" : "post";
}

function getDraftGeneratePrompt(config, composerKind) {
  return composerKind === "reply"
    ? cleanDraftText(config?.replyGeneratePrompt || DEFAULT_REPLY_GENERATE_PROMPT)
    : cleanDraftText(config?.generatePrompt || DEFAULT_GENERATE_PROMPT);
}

function normalizeReplyTranslationLanguage(value) {
  const language = cleanText(value).toLowerCase().split(/[-_]/)[0];
  return REPLY_TRANSLATION_LANGUAGES.has(language) ? language : DEFAULT_REPLY_TRANSLATION_LANGUAGE;
}
