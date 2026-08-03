const extensionApi = globalThis.chrome || globalThis.browser;
const runtimeApi = extensionApi?.runtime;
const storageApi = extensionApi?.storage?.local;
const actionApi = extensionApi?.action || extensionApi?.browserAction;

const REPLY_AI_CONFIG_VERSION = 19;
const DEFAULT_CODEX_BRIDGE_URL = "http://127.0.0.1:47623";
const DEFAULT_CODEX_MODEL = "gpt-5.6-luna";
const DEFAULT_CODEX_REASONING_EFFORT = "max";
const CODEX_REASONING_EFFORTS = ["low", "medium", "high", "xhigh", "max", "ultra"];
const DEFAULT_REPLY_LANGUAGE_MODE = "tweet";
const DEFAULT_REPLY_STYLE = "auto";
const PROHIBITED_REPLY_SYMBOL_PATTERN = /\u2014/g;

const DEFAULT_GENERATE_PROMPT = "Write a punchy, natural X/Twitter post with a clear point of view. Keep it concise, about 1 to 3 sentences, unless the instruction asks for more.";
const DEFAULT_REPLY_PROMPT_PROFILES = [
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

const DEFAULT_REPLY_AI_CONFIG = {
  configVersion: REPLY_AI_CONFIG_VERSION,
  enabled: true,
  codexBridgeUrl: DEFAULT_CODEX_BRIDGE_URL,
  bridgeToken: "",
  codexModel: DEFAULT_CODEX_MODEL,
  codexReasoningEffort: DEFAULT_CODEX_REASONING_EFFORT,
  replyLanguageMode: DEFAULT_REPLY_LANGUAGE_MODE,
  replyStyle: DEFAULT_REPLY_STYLE,
  replyPromptProfiles: cloneDefaultReplyPromptProfiles(),
  generatePrompt: DEFAULT_GENERATE_PROMPT
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

  if (message.type === "xtension-transcribe-dictation") {
    sendLoggedAiResponse(
      "dictation_transcribe",
      "result",
      "transcription_failed",
      sendResponse,
      () => transcribeDictationAudio(message),
      {
        durationMs: Math.max(0, Number(message.durationMs || 0)),
        inputBytes: Math.max(0, Number(message.size || 0)),
        locale: cleanText(message.language || ""),
        mimeType: cleanText(message.mimeType || ""),
        mode: cleanText(message.mode || "")
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

  return false;
});

actionApi?.onClicked?.addListener(() => {
  openExtensionOptions().catch(() => {});
});

// Génération en STREAMING via un port (le token-par-token est impossible avec
// sendMessage). content.js ouvre le port "xtension-generate-stream" ; on relaie le
// flux du bridge (/transform-stream). Si le streaming échoue (bridge trop ancien →
// 404, réseau), on RETOMBE sur la génération non-streaming et on renvoie le texte
// final : la génération marche donc toujours, avec ou sans aperçu au fil de l'eau.
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
    streamGenerateReplyDraft(port, message).catch((error) => {
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

async function streamGenerateReplyDraft(port, message) {
  const config = await getReplyAiConfig();
  const draftText = String(message?.text || "").trim();
  if (!config.enabled) {
    const error = new Error("AI bridge is not configured.");
    error.code = "not_configured";
    throw error;
  }
  if (!draftText) {
    postToPort(port, { type: "done", text: "" });
    return;
  }

  const locale = message?.locale || "";
  const targetLanguage = message?.targetLanguage || "";
  const context = message?.context || null;
  const image = await fetchContextImageDataUrl(context);
  const bridgeUrl = normalizeCodexBridgeUrl(config.codexBridgeUrl);
  if (!bridgeUrl) {
    const error = new Error("AI bridge URL is invalid.");
    error.code = "not_configured";
    throw error;
  }

  try {
    const finalText = await streamTransformFromBridge(config, bridgeUrl, {
      operation: "generate",
      locale,
      targetLanguage,
      context,
      text: draftText,
      generatePrompt: config?.generatePrompt || "",
      model: config?.codexModel || DEFAULT_CODEX_MODEL,
      reasoningEffort: config?.codexReasoningEffort || DEFAULT_CODEX_REASONING_EFFORT,
      ...(image ? { image } : {})
    }, (delta, full) => {
      postToPort(port, { type: "delta", delta, text: full });
    });
    postToPort(port, { type: "done", text: sanitizeGeneratedReplyText(finalText || "") || draftText });
  } catch (error) {
    // Repli : au pire, la génération fonctionne comme avant (sans aperçu live).
    appendDiagnosticLog({
      level: "warn",
      area: "ai",
      event: "generate_stream_fallback",
      error: String(error?.message || error).slice(0, 200)
    }).catch(() => {});
    const text = await transformReplyDraft("generate", draftText, locale, targetLanguage, context);
    postToPort(port, { type: "done", text });
  }
}

// Lit le flux NDJSON de /transform-stream : {"delta":"..."} au fil de l'eau,
// {"done":true,"text":"..."} final. Renvoie le texte final. Lève si l'endpoint est
// absent/en erreur (le repli non-streaming prend alors le relais en amont).
async function streamTransformFromBridge(config, bridgeUrl, body, onDelta) {
  const response = await fetch(`${bridgeUrl}/transform-stream`, {
    method: "POST",
    headers: { "content-type": "application/json", ...buildBridgeAuthHeaders(config) },
    body: JSON.stringify(body)
  });
  if (!response.ok || !response.body) {
    throw new Error(`transform-stream ${response.status}`);
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

  // Génération multimodale : on récupère (best-effort) l'image du tweet pour que
  // le modèle vision puisse la « voir ». N'affecte pas correct/translate.
  const image = normalizedOperation === "generate" ? await fetchContextImageDataUrl(context) : "";

  logAiRoute(config, `draft_${normalizedOperation}`, {
    hasContext: Boolean(context),
    hasImage: Boolean(image)
  });

  const transformedText = await transformReplyDraftWithBridge(config, normalizedOperation, draftText, locale, targetLanguage, context, image);
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
    const image = await fetchImageAsDataUrl(smallUrl);
    // Borne de sécurité : au-delà, on renonce (le bridge limite /transform à ~6 Mo,
    // et une image trop grande ralentit inutilement l'encodage vision).
    if (image?.dataUrl && image.dataUrl.length <= 4 * 1024 * 1024) {
      return image.dataUrl;
    }
    return "";
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
  await fetchBridgeRequest(`${bridgeUrl}/warmup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...buildBridgeAuthHeaders(config)
    },
    body: "{}"
  }, {
    operation: "warmup"
  }).catch(() => {});
}

async function transcribeDictationAudio(message) {
  const config = await getReplyAiConfig();
  const bridgeUrl = normalizeCodexBridgeUrl(config.codexBridgeUrl);
  if (!bridgeUrl) {
    const error = new Error("AI bridge URL is invalid.");
    error.code = "not_configured";
    throw error;
  }

  const response = await fetchBridgeRequest(`${bridgeUrl}/transcribe`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...buildBridgeAuthHeaders(config)
    },
    body: JSON.stringify({
      audioBase64: cleanText(message?.audioBase64 || ""),
      durationMs: Math.max(0, Number(message?.durationMs || 0)),
      language: cleanText(message?.language || ""),
      // Indice non contraignant pour Codex ; la langue transcrite reste auto-détectée.
      hintLanguage: cleanText(message?.hintLanguage || ""),
      mode: cleanText(message?.mode || ""),
      mimeType: cleanText(message?.mimeType || "audio/webm")
    })
  }, {
    operation: "dictation_transcribe"
  });

  if (!response.ok) {
    throw await createBridgeHttpError(response);
  }

  const data = await response.json();
  return {
    text: sanitizeGeneratedReplyText(data?.text || data?.transcript || ""),
    language: cleanText(data?.language || "")
  };
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
    const error = new Error("AI tools are disabled in Xtension settings.");
    error.code = "not_configured";
    throw error;
  }

  const bridgeUrl = normalizeCodexBridgeUrl(config.codexBridgeUrl);
  if (!bridgeUrl) {
    const error = new Error("AI bridge URL is invalid.");
    error.code = "not_configured";
    throw error;
  }

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
      targetLanguage: getReplyTargetLanguage(config, context?.tweetLanguage || "", locale),
      context: context || {},
      systemPrompt: profile.prompt,
      replyProfile: { index: profileIndex, label: profile.label },
      replyStyle: normalizeReplyStyle(config.replyStyle),
      model: config.codexModel,
      reasoningEffort: config.codexReasoningEffort,
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
    profileIndex,
    profileLabel: profile.label
  };
}

async function generateImageWithBridge(message) {
  const config = await getReplyAiConfig();
  if (!config.enabled) {
    const error = new Error("AI tools are disabled in Xtension settings.");
    error.code = "not_configured";
    throw error;
  }

  const prompt = cleanDraftText(message?.prompt || "").slice(0, 5000);
  if (!prompt) {
    const error = new Error("An image prompt is required.");
    error.code = "invalid_request";
    throw error;
  }

  const aspectRatio = normalizeImageAspectRatio(message?.aspectRatio);
  const visualStyle = normalizeImageVisualOption(message?.visualStyle, ["auto", "photorealistic", "illustration", "infographic", "3d"]);
  const framing = normalizeImageVisualOption(message?.framing, ["auto", "close_up", "wide", "top_down"]);
  const mood = normalizeImageVisualOption(message?.mood, ["auto", "bright", "warm", "cinematic", "minimal"]);

  const bridgeUrl = normalizeCodexBridgeUrl(config.codexBridgeUrl);
  const response = await fetchBridgeRequest(`${bridgeUrl}/generate-image`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...buildBridgeAuthHeaders(config)
    },
    body: JSON.stringify({
      prompt,
      referenceImage: cleanText(message?.referenceImage || ""),
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

function normalizeReplyAiConfig(config) {
  const rawConfig = config && typeof config === "object" ? config : {};
  const normalized = {
    ...DEFAULT_REPLY_AI_CONFIG,
    ...rawConfig
  };

  normalized.configVersion = REPLY_AI_CONFIG_VERSION;
  normalized.enabled = typeof rawConfig.enabled === "boolean" ? rawConfig.enabled : true;
  normalized.codexBridgeUrl = normalizeCodexBridgeUrl(normalized.codexBridgeUrl) || DEFAULT_CODEX_BRIDGE_URL;
  normalized.bridgeToken = cleanText(normalized.bridgeToken || "");
  normalized.codexModel = normalizeCodexModel(normalized.codexModel || DEFAULT_CODEX_MODEL);
  normalized.codexReasoningEffort = normalizeCodexReasoningEffort(normalized.codexReasoningEffort || DEFAULT_CODEX_REASONING_EFFORT);
  normalized.replyLanguageMode = normalizeReplyLanguageMode(normalized.replyLanguageMode);
  normalized.replyStyle = normalizeReplyStyle(normalized.replyStyle);
  normalized.replyPromptProfiles = normalizeReplyPromptProfiles(normalized.replyPromptProfiles, rawConfig.prompt);
  normalized.generatePrompt = cleanDraftText(normalized.generatePrompt || DEFAULT_GENERATE_PROMPT) || DEFAULT_GENERATE_PROMPT;

  delete normalized.provider;
  delete normalized.codexModelPreset;
  delete normalized.prompt;
  delete normalized.replyCount;
  delete normalized.baseUrl;
  delete normalized.model;
  delete normalized.apiKey;
  delete normalized.gpu;

  return normalized;
}

function cloneDefaultReplyPromptProfiles() {
  return DEFAULT_REPLY_PROMPT_PROFILES.map((profile) => ({ ...profile }));
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

function shouldPersistReplyAiConfig(rawConfig, normalizedConfig) {
  if (!rawConfig || typeof rawConfig !== "object") {
    return true;
  }

  return JSON.stringify(rawConfig) !== JSON.stringify(normalizedConfig);
}

async function transformReplyDraftWithBridge(config, operation, text, locale, targetLanguage, context, image) {
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
      locale,
      targetLanguage,
      context,
      text,
      generatePrompt: config?.generatePrompt || "",
      model: config?.codexModel || DEFAULT_CODEX_MODEL,
      reasoningEffort: config?.codexReasoningEffort || DEFAULT_CODEX_REASONING_EFFORT,
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
  // Un bridge trop ancien (sans endpoint /transcribe) répond 404 sans code JSON :
  // on synthétise "not_found" pour que l'appelant affiche « mettez à jour le
  // bridge » plutôt que le brut « 404 Not found. ».
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

function normalizeReplyLanguageMode(value) {
  return cleanText(value).toLowerCase() === "ui" ? "ui" : DEFAULT_REPLY_LANGUAGE_MODE;
}
