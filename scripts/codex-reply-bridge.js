const http = require("http");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const port = Number(process.env.XTENSION_BRIDGE_PORT || process.env.CODEX_REPLY_BRIDGE_PORT || 47623);
const hostname = "127.0.0.1";
const maxBodyBytes = 128 * 1024;
const agentTimeoutMs = Number(process.env.XTENSION_BRIDGE_TIMEOUT_MS || process.env.REPLY_BRIDGE_TIMEOUT_MS || 70000);
const maxImageCount = 4;
const maxImageBytes = 6 * 1024 * 1024;
const bridgeToken = cleanText(process.env.XTENSION_BRIDGE_TOKEN || "");
const codexReasoningEffort = normalizeReasoningEffort(process.env.XTENSION_CODEX_REASONING_EFFORT || "low");
const bridgeLogFile = cleanText(process.env.XTENSION_BRIDGE_LOG_FILE || getDefaultBridgeLogFile());
const bridgeLogMaxBytes = 2 * 1024 * 1024;
const prohibitedReplySymbolPattern = /\u2014/g;
let bridgeRequestSequence = 0;
const providerRunQueues = new Map();

const providerOrder = ["codex", "grok", "gemini", "claude"];
const providerAliases = new Map([
  ["codex-cli", "codex"],
  ["openai-codex", "codex"],
  ["grok-cli", "grok"],
  ["croc", "grok"],
  ["croc-cli", "grok"],
  ["gemini-cli", "gemini"],
  ["claude-cli", "claude"],
  ["claude-code", "claude"]
]);

const providerDefinitions = {
  codex: {
    id: "codex",
    label: "Codex CLI",
    envVar: "CODEX_CLI",
    commandNames: ["codex"],
    windowsCandidates: [windowsNpmCommand("codex.cmd")],
    supportsSchema: true,
    supportsImages: true,
    buildInvocation: buildCodexInvocation
  },
  grok: {
    id: "grok",
    label: "Grok CLI",
    envVar: "GROK_CLI",
    commandNames: ["grok"],
    windowsCandidates: [path.join(os.homedir(), ".grok", "bin", "grok.exe")],
    supportsSchema: false,
    supportsImages: false,
    maxConcurrentRuns: 1,
    minStartIntervalMs: 900,
    buildInvocation: buildGrokInvocation
  },
  gemini: {
    id: "gemini",
    label: "Gemini CLI",
    envVar: "GEMINI_CLI",
    commandNames: ["gemini"],
    windowsCandidates: [windowsNpmCommand("gemini.cmd")],
    supportsSchema: false,
    supportsImages: false,
    buildInvocation: buildGeminiInvocation
  },
  claude: {
    id: "claude",
    label: "Claude Code CLI",
    envVar: "CLAUDE_CLI",
    commandNames: ["claude"],
    windowsCandidates: [path.join(os.homedir(), ".local", "bin", "claude.exe")],
    supportsSchema: true,
    supportsImages: false,
    buildInvocation: buildClaudeInvocation
  }
};

const replySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    replies: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          styleId: { type: "string" },
          style: { type: "string" },
          text: { type: "string" }
        },
        required: ["styleId", "style", "text"]
      }
    }
  },
  required: ["replies"]
};

const transformSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    text: { type: "string" }
  },
  required: ["text"]
};

const replySchemaPath = writeTempSchema(replySchema, "reply");
const transformSchemaPath = writeTempSchema(transformSchema, "transform");

const server = http.createServer(async (request, response) => {
  if (!setCorsHeaders(request, response)) {
    sendJson(response, 403, { ok: false, error: "Origin is not allowed." });
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (!isAuthorizedRequest(request)) {
    sendJson(response, 401, { ok: false, error: "Bridge token is invalid or missing." });
    return;
  }

  if (request.method === "GET" && (request.url === "/health" || request.url === "/providers")) {
    sendJson(response, 200, {
      ok: true,
      defaultProvider: getDefaultProviderId(),
      providers: await detectProviders()
    });
    return;
  }

  if (request.method !== "POST" || !["/reply", "/correct", "/transform"].includes(request.url)) {
    sendJson(response, 404, { ok: false, error: "Not found." });
    return;
  }

  let requestId = "";
  let requestStartedAt = 0;
  let requestProviderId = "";
  let requestOperation = "";

  try {
    requestId = createBridgeRequestId();
    requestStartedAt = Date.now();
    const payload = await readJsonBody(request);
    const providerId = getRequestProviderId(payload?.provider);
    const model = cleanText(payload?.model || "");
    const operation = request.url === "/reply"
      ? "reply"
      : request.url === "/correct"
        ? "correct"
        : normalizeDraftTransformOperation(payload?.operation);

    requestProviderId = providerId;
    requestOperation = operation;
    logBridgeEvent("request_started", {
      requestId,
      operation,
      provider: providerId,
      model: model || "cli-default"
    });

    if (request.url === "/correct" || request.url === "/transform") {
      const text = await transformDraftWithProvider(providerId, {
        ...payload,
        operation: request.url === "/correct" ? "correct" : payload?.operation
      });
      logBridgeEvent("request_done", {
        requestId,
        operation,
        provider: providerId,
        durationMs: Date.now() - requestStartedAt,
        outputLength: text.length
      });
      sendJson(response, 200, { ok: true, provider: providerId, text, correctedText: text });
      return;
    }

    const replies = await generateRepliesWithProvider(providerId, payload);
    logBridgeEvent("request_done", {
      requestId,
      operation,
      provider: providerId,
      durationMs: Date.now() - requestStartedAt,
      outputCount: replies.length
    });
    sendJson(response, 200, { ok: true, provider: providerId, replies });
  } catch (error) {
    logBridgeEvent("request_failed", {
      requestId,
      operation: requestOperation,
      provider: requestProviderId,
      durationMs: requestStartedAt ? Date.now() - requestStartedAt : 0,
      statusCode: error.statusCode || 500,
      error: error.message || "Xtension Bridge failed."
    });
    sendJson(response, error.statusCode || 500, {
      ok: false,
      error: error.message || "Xtension Bridge failed."
    });
  }
});

server.listen(port, hostname, () => {
  const url = `http://${hostname}:${port}`;
  console.log(`Xtension Bridge listening on ${url}`);
  logBridgeEvent("server_started", {
    url,
    pid: process.pid,
    logFile: bridgeLogFile || ""
  });
});

function setCorsHeaders(request, response) {
  const origin = String(request.headers.origin || "");
  if (origin && !isAllowedBrowserExtensionOrigin(origin)) {
    return false;
  }

  if (origin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Headers", "content-type, x-xtension-bridge-token");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  return true;
}

function isAllowedBrowserExtensionOrigin(origin) {
  return /^(?:chrome|chrome-extension|moz-extension|edge-extension):\/\/[a-z0-9-]+$/i.test(origin);
}

function isAuthorizedRequest(request) {
  if (!bridgeToken) {
    return true;
  }

  return cleanText(request.headers["x-xtension-bridge-token"] || "") === bridgeToken;
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(value));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        const error = new Error("Request body is too large.");
        error.statusCode = 413;
        reject(error);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      try {
        const body = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(body));
      } catch (error) {
        error.statusCode = 400;
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

async function generateRepliesWithProvider(providerId, payload) {
  const provider = getProviderDefinition(providerId);
  const context = payload?.context && typeof payload.context === "object" ? payload.context : {};
  const locale = String(payload?.locale || "en");
  const replyCount = normalizeReplyCount(payload?.replyCount);
  const replyStyle = normalizeReplyStyle(payload?.replyStyle);
  const targetLanguage = cleanText(payload?.targetLanguage || locale || "unknown");
  const model = cleanText(payload?.model || "");
  const replyProfile = normalizeReplyProfile(payload?.replyProfile);
  const imageFiles = provider.supportsImages ? await prepareImageFiles(context) : [];
  const prompt = buildReplyPrompt({
    provider,
    systemPrompt: payload?.systemPrompt,
    context,
    locale,
    replyCount,
    replyStyle,
    targetLanguage,
    replyProfile
  });

  try {
    const stdout = await runProviderExec(provider, prompt, replySchemaPath, replySchema, model, imageFiles, true);
    const parsed = parseStructuredOutput(stdout);
    const rawReplies = parsed?.replies
      || (parsed?.text ? [parsed] : [])
      || (replyCount === 1 ? [{ styleId: "custom", style: replyProfile?.label || "", text: stdout }] : []);
    const replies = normalizeReplies(rawReplies, replyCount);

    if (!replies.length) {
      throw new Error(`${provider.label} did not return replies.`);
    }

    return replies;
  } finally {
    cleanupFiles(imageFiles);
  }
}

function buildReplyPrompt({ provider, systemPrompt, context, locale, replyCount, replyStyle, targetLanguage, replyProfile }) {
  const renderedSystemPrompt = renderPromptTemplate(cleanDraftText(systemPrompt || ""), {
    uiLocale: locale,
    tweetLanguage: context?.tweetLanguage || "",
    targetLanguage,
    replyStyle,
    replyCount,
    profileName: replyProfile?.label || ""
  });
  const singleProfile = replyCount === 1 && replyProfile?.label;
  const userDraftInstruction = cleanDraftText(context?.userDraftInstruction || "");

  if (provider.id === "grok") {
    return buildGrokReplyPrompt({
      renderedSystemPrompt,
      context,
      locale,
      replyCount,
      replyStyle,
      targetLanguage,
      replyProfile,
      singleProfile
    });
  }

  return [
    renderedSystemPrompt || "Generate native X/Twitter reply suggestions.",
    "",
    `You are running through ${provider.label}.`,
    singleProfile
      ? `Generate exactly one X/Twitter reply for the profile named "${replyProfile.label}".`
      : `Generate exactly ${replyCount} X/Twitter reply suggestions for the user.`,
    "First understand the conversation. Identify the original post's real point, emotion, target, likely audience, and the strongest defensible stance for the user: amplify it, oppose it, call it out, or reframe it with conviction.",
    "Use live web search only when the reply needs current or named factual context: news, public people, companies, products, laws, prices, statistics, dates, technical claims, source verification, or a specific meme/event that visible context does not explain.",
    "Do not search for simple opinion, common-sense reasoning, or personal reaction. Search is a tool for factual confidence, not filler.",
    `Every reply must be in this target language: ${targetLanguage}.`,
    singleProfile
      ? `Requested profile: ${replyProfile.label}. Follow the profile prompt above over generic variety rules.`
      : `Requested style: ${replyStyle}. If it is auto, choose one clear stance first, then produce useful length variety: one short impact reply, one medium argument, and one longer argument. Otherwise keep every reply in that style while varying length and angle.`,
    ...(userDraftInstruction ? [
      "The user typed this extra instruction in the draft box. Treat it as a priority when creating suggestions, without copying it verbatim unless that is clearly intended:",
      userDraftInstruction
    ] : []),
    "Every reply must be exactly one sentence. Never write two sentences in the same reply. No paragraph, no bullet, no thread-like answer.",
    "Never use Unicode code point U+2014 in any reply. Use a comma instead.",
    ...(singleProfile ? [] : [
      "Reply 1 must be very short and impact-driven: one punchy sentence, 45 to 110 characters, with a clear emotional or rhetorical hit.",
      "Reply 2 must be one medium sentence, 100 to 210 characters, with one concrete reason or consequence.",
      "Reply 3 must be one denser sentence, 170 to 300 characters, with a fuller argument, but never pad, repeat, or write filler just to be long."
    ]),
    "If images are attached or image URLs are present in context, use their visual context when the selected CLI can inspect them; otherwise use the visible surrounding text and image metadata only.",
    "Every factual claim must be supported by visible context or search results. If the needed fact is uncertain, avoid it or say it cautiously.",
    "If the original post is an outrage claim and visible context does not disprove it, amplify the outrage with a reason instead of softening it. If the post is misleading, oppose it directly. Do not write a balanced pro/con take.",
    "Prioritize conviction plus reason: clear side, concrete consequence, and wording that sounds like a person reacting on X/Twitter.",
    "Avoid hedging phrases like 'there is a tradeoff', 'technically legal yet', 'it depends', 'to be fair', 'on the one hand', and 'this may feel like' unless the user explicitly asked for nuance.",
    "Avoid generic praise, empty agreement, assistant-like wording, corporate tone, expert-report wording, moralizing, and replies that could fit any tweet.",
    "Replies should be punchy and natural for X/Twitter. If an idea needs a second sentence, choose the strongest idea and compress it into one sentence.",
    singleProfile
      ? "Return JSON only in this shape: {\"replies\":[{\"styleId\":\"custom\",\"style\":\"...\",\"text\":\"...\"}]}. The array must contain exactly one item."
      : "Return JSON only in this shape: {\"replies\":[{\"styleId\":\"short|medium|long|reaction|argument|support|useful|question|codex|custom|humor|sharp|callout\",\"style\":\"...\",\"text\":\"...\"}]}",
    "",
    `UI locale: ${locale}`,
    "Context JSON:",
    JSON.stringify(context, null, 2)
  ].join("\n");
}

function buildGrokReplyPrompt({ renderedSystemPrompt, context, locale, replyCount, replyStyle, targetLanguage, replyProfile, singleProfile }) {
  const userDraftInstruction = cleanDraftText(context?.userDraftInstruction || "");

  return [
    "Return one valid JSON object only. Do not write a plan, analysis, tool request, search note, or commentary.",
    renderedSystemPrompt || "Generate native X/Twitter reply suggestions.",
    singleProfile
      ? `Task: generate exactly one X/Twitter reply for the profile named "${replyProfile.label}".`
      : `Task: generate exactly ${replyCount} X/Twitter reply suggestions.`,
    "Use only the visible Context JSON below. Do not search, browse, inspect files, gather more context, or mention missing context.",
    "If the context is thin, write a natural cautious reply based only on the visible text.",
    `Target language: ${targetLanguage}. UI locale: ${locale}.`,
    singleProfile
      ? `Requested profile: ${replyProfile.label}. Follow the profile prompt above.`
      : `Requested style: ${replyStyle}. If it is auto, return useful length variety.`,
    ...(userDraftInstruction ? [
      "User extra instruction for these suggestions:",
      userDraftInstruction,
      "Respect that instruction when drafting each reply."
    ] : []),
    "Each reply text must be exactly one sentence. No bullets, no paragraphs, no thread.",
    "Never use Unicode code point U+2014 in any reply. Use a comma instead.",
    singleProfile
      ? "Return exactly this shape: {\"replies\":[{\"styleId\":\"custom\",\"style\":\"...\",\"text\":\"...\"}]}. The replies array must contain exactly one item."
      : "Return exactly this shape: {\"replies\":[{\"styleId\":\"short|medium|long|custom\",\"style\":\"...\",\"text\":\"...\"}]}.",
    "",
    "Context JSON:",
    JSON.stringify(context || {}, null, 2)
  ].join("\n");
}

async function transformDraftWithProvider(providerId, payload) {
  const provider = getProviderDefinition(providerId);
  const text = cleanDraftText(payload?.text || "");
  if (!text) {
    return "";
  }

  const locale = String(payload?.locale || "en");
  const model = cleanText(payload?.model || "");
  const operation = normalizeDraftTransformOperation(payload?.operation);
  const targetLanguage = cleanText(payload?.targetLanguage || payload?.context?.tweetLanguage || locale || "unknown");
  const prompt = buildDraftTransformPrompt(provider, operation, text, locale, targetLanguage, payload?.context);

  const stdout = await runProviderExec(provider, prompt, transformSchemaPath, transformSchema, model, [], false);
  const parsed = parseStructuredOutput(stdout);
  const nested = parseMaybeNestedJson(parsed?.text || parsed?.correctedText || parsed?.translatedText || parsed?.generatedText || "");
  return sanitizeGeneratedReplyText(nested?.text || nested?.correctedText || nested?.translatedText || nested?.generatedText || parsed?.text || parsed?.correctedText || parsed?.translatedText || parsed?.generatedText || "") || text;
}

function buildDraftTransformPrompt(provider, operation, text, locale, targetLanguage, context) {
  const instructions = {
    correct: [
      "Correct the draft and return the result in this target language: " + targetLanguage + ".",
      "If the draft is already in the target language, keep that language and fix spelling, grammar, syntax, punctuation, capitalization, agreement, conjugation, word order, and spacing.",
      "If the draft is in a different language from the target language, infer the intended meaning, fix the mistakes, and translate that corrected meaning into the target language.",
      "Preserve meaning, tone, register, valid informal wording, slang, idioms, emojis, mentions, hashtags, URLs, and line breaks, but not mistakes.",
      "Do not preserve misspellings, missing letters, broken grammar, or phonetic spelling. Informal language may stay informal, but it must be correctly written.",
      "Example: if the draft is \"Sa va pa marcher !\", return \"Ça va pas marcher !\" or \"Ça ne va pas marcher !\".",
      "Example: if the draft is \"thii wil not chose the righ ting\" and the target language is French, return \"Je ne choisirai pas le bon truc\" or another fluent French correction of the intended meaning.",
      "Never answer with a meta sentence like \"No correction needed\". Always return the corrected text itself.",
      "Do not make the text more formal, do not rewrite valid wording, and do not add facts or commentary."
    ],
    translate: [
      "Translate this X/Twitter reply draft.",
      `Translate it into this target language: ${targetLanguage}.`,
      "If the draft contains spelling, grammar, or syntax mistakes, infer the intended meaning and translate that corrected meaning.",
      "The returned text must be fluent, grammatical, and correctly spelled in the target language, including accents, agreement, and conjugation.",
      "Do not imitate typos, missing letters, broken grammar, or phonetic spelling from the draft.",
      "Example: if the draft is \"Tis will no work!\" and the target language is French, return \"Ça ne va pas marcher !\" or \"Ça ne marchera pas !\", never \"Sa va pa marcher !\".",
      "Preserve meaning, tone, slang, emojis, mentions, hashtags, URLs, and line breaks, but not mistakes.",
      "Do not add facts, explanations, hashtags, or commentary."
    ],
    generate: [
      "Write one native X/Twitter post/reply that expresses and expands the user's draft intention.",
      "Draft is the user's intended message. Do not answer Draft as if another person wrote it.",
      "Preserve the user's stance, emotion, and meaning. If Draft has mistakes, infer the intended meaning instead of reproducing the mistakes.",
      "If Draft says \"je ne suis pas content\", the output must say that the user is not happy, with optional useful detail.",
      `Write the generated reply in this target language: ${targetLanguage}.`,
      "The returned text must be fluent, grammatical, and correctly spelled in the target language.",
      "Use the original tweet context when provided, but do not replace the user's intent with a reaction to the context.",
      "Be specific, conversational, concise, and do not invent facts."
    ]
  }[operation];

  return [
    ...instructions,
    "Never use Unicode code point U+2014 in the returned text. Use a comma instead.",
    "Return JSON only in this shape: {\"text\":\"...\"}",
    `UI locale: ${locale}`,
    "",
    "Draft:",
    text,
    "",
    "Context JSON:",
    JSON.stringify(context || {}, null, 2)
  ].join("\n");
}

async function runProviderExec(provider, prompt, schemaPath, schema, model, imageFiles = [], allowSearch = true) {
  const executable = await resolveProviderExecutable(provider);
  const installed = await commandExists(executable);
  if (!installed) {
    const error = new Error(`${provider.label} was not detected by the bridge.`);
    error.statusCode = 424;
    throw error;
  }

  const providerPrompt = provider.supportsSchema ? prompt : appendSchemaHint(prompt, schema);
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const invocation = provider.buildInvocation({
      prompt: providerPrompt,
      schemaPath,
      schema,
      model,
      imageFiles,
      allowSearch
    });

    try {
      return await scheduleProviderRun(provider, () => runChildProcess(provider, executable, invocation));
    } catch (error) {
      if (!isProviderRateLimitError(error) || attempt >= maxAttempts) {
        throw error;
      }

      const delayMs = 1200 * attempt;
      logBridgeEvent("provider_retry", {
        provider: provider.id,
        attempt,
        nextAttempt: attempt + 1,
        delayMs,
        reason: "rate_limit"
      });
      await delay(delayMs);
    }
  }

  throw new Error(`${provider.label} failed.`);
}

function scheduleProviderRun(provider, task) {
  const maxConcurrentRuns = Number(provider.maxConcurrentRuns || 0);
  const minStartIntervalMs = Number(provider.minStartIntervalMs || 0);
  if (maxConcurrentRuns <= 0 && minStartIntervalMs <= 0) {
    return task();
  }

  const state = getProviderRunQueueState(provider.id);
  return new Promise((resolve, reject) => {
    state.queue.push({
      enqueuedAt: Date.now(),
      task,
      resolve,
      reject
    });
    drainProviderRunQueue(provider, state);
  });
}

function getProviderRunQueueState(providerId) {
  const key = cleanText(providerId || "default") || "default";
  if (!providerRunQueues.has(key)) {
    providerRunQueues.set(key, {
      queue: [],
      running: 0,
      nextStartAt: 0,
      timer: null
    });
  }
  return providerRunQueues.get(key);
}

function drainProviderRunQueue(provider, state) {
  const maxConcurrentRuns = Math.max(1, Number(provider.maxConcurrentRuns || 1));
  const minStartIntervalMs = Math.max(0, Number(provider.minStartIntervalMs || 0));
  if (state.running >= maxConcurrentRuns || !state.queue.length) {
    return;
  }

  const waitMs = Math.max(0, state.nextStartAt - Date.now());
  if (waitMs > 0) {
    if (!state.timer) {
      state.timer = setTimeout(() => {
        state.timer = null;
        drainProviderRunQueue(provider, state);
      }, waitMs);
    }
    return;
  }

  const item = state.queue.shift();
  const queuedMs = Date.now() - item.enqueuedAt;
  state.running += 1;
  state.nextStartAt = Date.now() + minStartIntervalMs;
  if (queuedMs > 25 || state.queue.length) {
    logBridgeEvent("provider_queue_start", {
      provider: provider.id,
      queuedMs,
      running: state.running,
      waiting: state.queue.length
    });
  }

  Promise.resolve()
    .then(item.task)
    .then(item.resolve, item.reject)
    .finally(() => {
      state.running = Math.max(0, state.running - 1);
      drainProviderRunQueue(provider, state);
    });

  drainProviderRunQueue(provider, state);
}

function runChildProcess(provider, executable, invocation) {
  return new Promise((resolve, reject) => {
    const cleanup = invocation.cleanup || (() => {});
    const childStartedAt = Date.now();
    let settled = false;
    logBridgeEvent("provider_started", {
      provider: provider.id,
      executable: path.basename(executable),
      args: sanitizeProviderArgs(invocation.args)
    });
    const child = spawn(executable, invocation.args, {
      cwd: invocation.cwd || process.cwd(),
      env: buildProviderEnv(),
      shell: process.platform === "win32" && /\.(?:cmd|bat)$/i.test(executable),
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    function finish(error, value) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      cleanup();
      if (error) {
        reject(error);
        return;
      }
      resolve(value);
    }

    const timeout = setTimeout(() => {
      child.kill();
      const errorMessage = isProviderRateLimitError(stderr)
        ? `${provider.label} rate limited: ${truncateText(stderr, 700)}`
        : `${provider.label} timed out.`;
      logBridgeEvent("provider_timeout", {
        provider: provider.id,
        durationMs: Date.now() - childStartedAt,
        timeoutMs: agentTimeoutMs,
        stderr: truncateText(stderr, 700)
      });
      finish(new Error(errorMessage));
    }, agentTimeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      if (!settled && isProviderRateLimitError(stderr)) {
        child.kill();
        logBridgeEvent("provider_rate_limited", {
          provider: provider.id,
          durationMs: Date.now() - childStartedAt,
          stderr: truncateText(stderr, 700)
        });
        finish(new Error(`${provider.label} rate limited: ${truncateText(stderr, 700)}`));
      }
    });

    child.on("error", (error) => {
      finish(new Error(`Unable to start ${provider.label}: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code !== 0) {
        logBridgeEvent("provider_failed", {
          provider: provider.id,
          exitCode: code,
          durationMs: Date.now() - childStartedAt,
          stderr: truncateText(stderr || stdout, 700)
        });
        finish(new Error(`${provider.label} exited with ${code}: ${truncateText(stderr || stdout, 700)}`));
        return;
      }

      logBridgeEvent("provider_done", {
        provider: provider.id,
        durationMs: Date.now() - childStartedAt,
        outputBytes: Buffer.byteLength(stdout, "utf8")
      });
      finish(null, stdout);
    });

    child.stdin.end(invocation.stdin || "");
  });
}

function buildCodexInvocation({ prompt, schemaPath, model, imageFiles, allowSearch }) {
  const args = [
    ...(allowSearch ? ["--search"] : []),
    ...(codexReasoningEffort ? ["-c", `model_reasoning_effort="${codexReasoningEffort}"`] : []),
    "exec",
    "--ephemeral",
    "--sandbox",
    "read-only"
  ];

  if (model) {
    args.push("--model", model);
  }

  for (const imageFile of imageFiles) {
    args.push("--image", imageFile);
  }

  args.push("--output-schema", schemaPath, "-");

  return {
    args,
    stdin: prompt
  };
}

function buildGrokInvocation({ prompt, model }) {
  const promptPath = writeTempPrompt(prompt, "grok");
  const args = [
    "--no-alt-screen",
    "--output-format",
    "plain",
    "--permission-mode",
    "dontAsk",
    "--no-plan",
    "--disable-web-search",
    "--no-subagents",
    "--no-memory",
    "--verbatim",
    "--sandbox",
    "read-only",
    "--max-turns",
    "2",
    "--no-wait-for-background",
    "--prompt-file",
    promptPath
  ];

  if (model) {
    args.push("--model", model);
  }

  return {
    args,
    cleanup: () => cleanupFiles([promptPath])
  };
}

function buildGeminiInvocation({ prompt, model }) {
  const args = [
    "--prompt",
    "Return only the JSON object requested in stdin.",
    "--output-format",
    "text",
    "--approval-mode",
    "plan"
  ];

  if (model) {
    args.push("--model", model);
  }

  return {
    args,
    stdin: prompt
  };
}

function buildClaudeInvocation({ prompt, schema, model }) {
  const args = [
    "-p",
    "--output-format",
    "json",
    "--permission-mode",
    "plan",
    "--no-session-persistence",
    "--tools",
    "",
    "--json-schema",
    JSON.stringify(schema)
  ];

  if (model) {
    args.push("--model", model);
  }

  return {
    args,
    stdin: prompt
  };
}

function appendSchemaHint(prompt, schema) {
  return [
    prompt,
    "",
    "The final output must be a single JSON object with no markdown, no code fence, and no commentary.",
    "It must satisfy this JSON schema:",
    JSON.stringify(schema)
  ].join("\n");
}

function buildProviderEnv() {
  const env = { ...process.env };
  const home = cleanText(process.env.XTENSION_BRIDGE_USER_HOME || process.env.USERPROFILE || process.env.HOME || os.homedir());

  if (home) {
    env.USERPROFILE = env.USERPROFILE || home;
    env.HOME = env.HOME || home;
    env.APPDATA = env.APPDATA || path.join(home, "AppData", "Roaming");
    env.LOCALAPPDATA = env.LOCALAPPDATA || path.join(home, "AppData", "Local");
  }

  const pathParts = [
    env.PATH || env.Path || "",
    home ? path.join(home, "AppData", "Roaming", "npm") : "",
    home ? path.join(home, ".local", "bin") : "",
    home ? path.join(home, ".grok", "bin") : ""
  ].filter(Boolean);

  env.PATH = Array.from(new Set(pathParts.join(path.delimiter).split(path.delimiter).filter(Boolean))).join(path.delimiter);
  env.Path = env.PATH;
  return env;
}

function createBridgeRequestId() {
  bridgeRequestSequence += 1;
  return `${process.pid}-${Date.now().toString(36)}-${bridgeRequestSequence.toString(36)}`;
}

function logBridgeEvent(event, details = {}) {
  if (!bridgeLogFile) {
    return;
  }

  const entry = JSON.stringify({
    time: new Date().toISOString(),
    event,
    ...details
  });

  try {
    fs.mkdirSync(path.dirname(bridgeLogFile), { recursive: true });
    rotateBridgeLogIfNeeded();
    fs.appendFileSync(bridgeLogFile, `${entry}\n`, "utf8");
  } catch (error) {
    // Logging must never break reply generation.
  }
}

function rotateBridgeLogIfNeeded() {
  try {
    const stats = fs.statSync(bridgeLogFile);
    if (stats.size < bridgeLogMaxBytes) {
      return;
    }

    const rotatedFile = `${bridgeLogFile}.1`;
    try {
      fs.unlinkSync(rotatedFile);
    } catch (error) {
      // Best-effort rotation.
    }
    fs.renameSync(bridgeLogFile, rotatedFile);
  } catch (error) {
    // No existing log to rotate.
  }
}

function getDefaultBridgeLogFile() {
  const baseDir = process.env.LOCALAPPDATA
    || (os.homedir() ? path.join(os.homedir(), "AppData", "Local") : os.tmpdir());
  return path.join(baseDir, "Xtension", "Bridge", "bridge.log");
}

function sanitizeProviderArgs(args) {
  return (args || []).map((arg) => {
    const value = cleanText(arg);
    if (/xtension-bridge-.*\.(?:txt|json)$/i.test(path.basename(value))) {
      return path.basename(value);
    }
    return value;
  });
}

async function detectProviders() {
  return Promise.all(providerOrder.map(async (providerId) => detectProvider(providerDefinitions[providerId])));
}

async function detectProvider(provider) {
  const executable = await resolveProviderExecutable(provider);
  const installed = await commandExists(executable);
  return {
    id: provider.id,
    label: provider.label,
    executable,
    installed,
    usable: installed,
    supportsImages: provider.supportsImages,
    supportsStructuredOutput: provider.supportsSchema
  };
}

async function resolveProviderExecutable(provider) {
  const envValue = cleanText(process.env[provider.envVar] || "");
  if (envValue) {
    return envValue;
  }

  for (const candidate of getProviderCandidates(provider)) {
    if (path.isAbsolute(candidate)) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      continue;
    }

    if (await commandExists(candidate)) {
      return candidate;
    }
  }

  return provider.commandNames[0];
}

function getProviderCandidates(provider) {
  return [
    ...(process.platform === "win32" ? provider.windowsCandidates || [] : []),
    ...(provider.commandNames || [])
  ].filter(Boolean);
}

function getProviderDefinition(providerId) {
  const normalized = normalizeProviderId(providerId);
  const provider = providerDefinitions[normalized];
  if (!provider) {
    const error = new Error(`Unsupported reply provider: ${providerId || "unknown"}.`);
    error.statusCode = 400;
    throw error;
  }
  return provider;
}

function getRequestProviderId(value) {
  return normalizeProviderId(value || process.env.XTENSION_REPLY_PROVIDER || "codex") || "codex";
}

function getDefaultProviderId() {
  return getRequestProviderId(process.env.XTENSION_REPLY_PROVIDER || "codex");
}

function normalizeProviderId(value) {
  const id = cleanText(value).toLowerCase().replace(/_/g, "-");
  return providerAliases.get(id) || id;
}

function writeTempSchema(schema, prefix) {
  const file = path.join(os.tmpdir(), `xtension-bridge-${prefix}-${process.pid}-${Date.now()}.schema.json`);
  fs.writeFileSync(file, `${JSON.stringify(schema)}\n`, "utf8");
  return file;
}

function writeTempPrompt(prompt, prefix) {
  const file = path.join(os.tmpdir(), `xtension-bridge-${prefix}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
  fs.writeFileSync(file, prompt, "utf8");
  return file;
}

async function prepareImageFiles(context) {
  const urls = extractImageUrls(context).slice(0, maxImageCount);
  const files = [];

  for (const url of urls) {
    const file = await downloadImageToTempFile(url).catch(() => "");
    if (file) {
      files.push(file);
    }
  }

  return files;
}

function extractImageUrls(context) {
  const media = Array.isArray(context?.mediaContext) ? context.mediaContext : [];
  const urls = media
    .map((item) => item?.imageUrl || item?.url || "")
    .filter((url) => /^https:\/\/[^/]*twimg\.com\//i.test(url));

  return Array.from(new Set(urls));
}

async function downloadImageToTempFile(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Xtension Bridge"
      }
    });

    if (!response.ok) {
      return "";
    }

    const mimeType = response.headers.get("content-type") || "";
    if (!/^image\/(?:png|jpe?g|webp|gif)/i.test(mimeType)) {
      return "";
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > maxImageBytes) {
      return "";
    }

    const extension = imageExtensionFromMimeType(mimeType);
    const file = path.join(os.tmpdir(), `xtension-bridge-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`);
    fs.writeFileSync(file, bytes);
    return file;
  } finally {
    clearTimeout(timeout);
  }
}

function imageExtensionFromMimeType(mimeType) {
  if (/png/i.test(mimeType)) {
    return "png";
  }
  if (/webp/i.test(mimeType)) {
    return "webp";
  }
  if (/gif/i.test(mimeType)) {
    return "gif";
  }
  return "jpg";
}

function cleanupFiles(files) {
  for (const file of files || []) {
    try {
      fs.unlinkSync(file);
    } catch (error) {
      // Best-effort temp cleanup.
    }
  }
}

function commandExists(command) {
  const value = cleanText(command);
  if (!value) {
    return Promise.resolve(false);
  }

  if (path.isAbsolute(value)) {
    return Promise.resolve(fs.existsSync(value));
  }

  return new Promise((resolve) => {
    const checker = process.platform === "win32" ? "where.exe" : "which";
    const child = spawn(checker, [value], {
      env: buildProviderEnv(),
      windowsHide: true
    });
    const timeout = setTimeout(() => {
      child.kill();
      resolve(false);
    }, 1500);

    child.on("error", () => {
      clearTimeout(timeout);
      resolve(false);
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      resolve(code === 0);
    });
  });
}

function isProviderRateLimitError(error) {
  return /(?:429|too many requests|rate limit|resource-exhausted)/i.test(error?.message || String(error || ""));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function windowsNpmCommand(fileName) {
  return process.env.APPDATA ? path.join(process.env.APPDATA, "npm", fileName) : "";
}

function normalizeDraftTransformOperation(value) {
  const operation = cleanText(value).toLowerCase();
  return ["correct", "translate", "generate"].includes(operation) ? operation : "correct";
}

function parseStructuredOutput(text) {
  const value = String(text || "").trim();
  const direct = tryParseJson(value);
  const unwrapped = unwrapStructuredValue(direct);
  if (unwrapped) {
    return unwrapped;
  }

  const object = tryParseJson(extractJsonObject(value));
  const unwrappedObject = unwrapStructuredValue(object);
  if (unwrappedObject) {
    return unwrappedObject;
  }

  const array = tryParseJson(extractJsonArray(value));
  if (Array.isArray(array)) {
    return { replies: array };
  }

  return {};
}

function unwrapStructuredValue(value, depth = 0) {
  if (!value || depth > 4) {
    return null;
  }

  if (Array.isArray(value)) {
    return { replies: value };
  }

  if (typeof value === "string") {
    return parseStructuredOutput(value);
  }

  if (typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value.replies) || typeof value.text === "string" || typeof value.correctedText === "string" || typeof value.translatedText === "string" || typeof value.generatedText === "string") {
    return value;
  }

  for (const key of ["result", "response", "output", "message", "content", "answer"]) {
    const nested = value[key];
    if (!nested) {
      continue;
    }

    if (Array.isArray(nested)) {
      const text = nested.map((item) => item?.text || item?.content || item).filter(Boolean).join("\n");
      const parsed = unwrapStructuredValue(text, depth + 1);
      if (parsed) {
        return parsed;
      }
    } else {
      const parsed = unwrapStructuredValue(nested, depth + 1);
      if (parsed) {
        return parsed;
      }
    }
  }

  return null;
}

function parseMaybeNestedJson(value) {
  const text = cleanDraftText(value);
  return tryParseJson(text) || tryParseJson(extractJsonObject(text)) || null;
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function extractJsonObject(value) {
  const text = String(value || "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : "";
}

function extractJsonArray(value) {
  const text = String(value || "");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  return start >= 0 && end > start ? text.slice(start, end + 1) : "";
}

function normalizeReplies(values, count) {
  const replies = [];
  const seen = new Set();
  const input = Array.isArray(values) ? values : [];

  for (const value of input) {
    const reply = normalizeReply(value);
    if (!reply.text || isLowQualityReply(reply)) {
      continue;
    }

    const key = normalizeComparableText(reply.text);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    replies.push(reply);
  }

  return replies.slice(0, count);
}

function normalizeReply(value) {
  if (value && typeof value === "object") {
    const styleId = normalizeReplyStyleId(value.styleId || value.style_id || value.style || value.type || "codex");
    return {
      styleId,
      style: cleanText(value.style || ""),
      text: limitReplyText(value.text || value.reply || value.content || value.message || "", styleId)
    };
  }

  return {
    styleId: "codex",
    style: "",
    text: limitReplyText(value, "codex")
  };
}

function limitReplyText(value, styleId) {
  const sentence = extractFirstReplySentence(value);
  return clampReplySentence(sentence, getReplyMaxLength(styleId));
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
  return cleanDraftText(value).replace(prohibitedReplySymbolPattern, ",");
}

function ensureSentencePunctuation(value) {
  const text = cleanText(value);
  if (!text || /[.!?…。！？]$/.test(text)) {
    return text;
  }
  return `${text}.`;
}

function getReplyMaxLength(styleId) {
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

function isLowQualityReply(reply) {
  const text = cleanText(reply?.text || "").toLowerCase();

  if (!text) {
    return true;
  }

  return /\b(?:great question|it'?s great that|it is great that|i'?m sure there are|consider testing|it might help|might help clarify|fresh perspectives|which feature aligns)\b/i.test(text);
}

function normalizeReplyCount(value) {
  const count = Number.parseInt(value, 10);

  if (!Number.isFinite(count)) {
    return 3;
  }

  return Math.min(5, Math.max(1, count));
}

function normalizeReplyProfile(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return {
    index: Number.isFinite(Number.parseInt(value.index, 10)) ? Number.parseInt(value.index, 10) : 0,
    label: cleanText(value.label || value.name || "Reply")
  };
}

function normalizeReplyStyle(value) {
  const style = cleanText(value).toLowerCase();
  return ["auto", "humor", "sharp", "useful", "question"].includes(style) ? style : "auto";
}

function normalizeReasoningEffort(value) {
  const effort = cleanText(value).toLowerCase();
  return ["low", "medium", "high", "xhigh"].includes(effort) ? effort : "low";
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

  return "codex";
}

function renderPromptTemplate(template, values) {
  let output = String(template || "");
  for (const [key, value] of Object.entries(values || {})) {
    output = output.replaceAll(`{{${key}}}`, cleanText(value));
  }
  return output;
}

function normalizeComparableText(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function truncateText(value, maxLength) {
  const text = cleanText(value);
  if (!maxLength || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
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
