"use strict";

// Xtension AI Bridge — 100 % local, sans cloud ni clé API.
//   • Correction / traduction / reformulation via un petit LLM local
//     (llama.cpp + Gemma 3 4B GGUF, CPU) — endpoint POST /transform (et /correct).
//   • Dictée vocale via Parakeet (ggml, livré avec whisper.cpp) avec repli
//     whisper.cpp / faster-whisper — endpoint POST /transcribe.
// Les binaires et modèles sont téléchargés automatiquement au premier usage
// dans %ProgramData%\Xtension\Bridge. Aucun provider CLI, aucun OAuth.

const http = require("http");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");

const port = Number(process.env.XTENSION_BRIDGE_PORT || 47623);
const hostname = "127.0.0.1";
const maxBodyBytes = 128 * 1024;
// /transform peut porter une image (data URL base64) pour la génération multimodale.
const maxTransformBodyBytes = 6 * 1024 * 1024;
const maxTranscriptionBodyBytes = 18 * 1024 * 1024;
const maxAudioBytes = 12 * 1024 * 1024;
const transcriptionTimeoutMs = Number(process.env.XTENSION_TRANSCRIPTION_TIMEOUT_MS || 120000);
const bridgeToken = cleanText(process.env.XTENSION_BRIDGE_TOKEN || "");
const bridgeLogFile = cleanText(process.env.XTENSION_BRIDGE_LOG_FILE || getDefaultBridgeLogFile());
const bridgeLogMaxBytes = 2 * 1024 * 1024;
const prohibitedReplySymbolPattern = /—/g;
let bridgeRequestSequence = 0;

// --- Transcription (dictée vocale) ---
// Moteur principal : Parakeet TDT 0.6B v3 (portage ggml livré dans le zip
// whisper.cpp v1.9.1). Choix validé par benchmark sur machine réelle (CPU,
// 16 threads) : phrase de 4 s transcrite en ~0,7 s et phrase de 10 s en ~0,9 s
// (chargement du modèle inclus, one-shot), contre ~6 s par phrase avec l'ancien
// whisper large-v3-turbo. Surtout, l'architecture transducteur n'émet AUCUN
// token sans parole : un silence donne un texte vide, jamais une hallucination
// (« Thank you. », « Sous-titres réalisés par la communauté d'Amara.org », ...).
// Parakeet couvre 25 langues européennes (fr, en, de, es, it, pt, ...) avec
// ponctuation et majuscules automatiques.
// Repli : whisper.cpp small-q5_1 (+ VAD Silero + fenêtre d'encodage adaptée)
// pour les langues hors Parakeet ou si Parakeet est indisponible.
const whisperCppReleaseUrl = "https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.1/whisper-bin-x64.zip";
const parakeetModelFileName = process.env.XTENSION_PARAKEET_MODEL_FILE || "ggml-parakeet-tdt-0.6b-v3-q8_0.bin";
const parakeetModelUrl = process.env.XTENSION_PARAKEET_MODEL_URL || "https://huggingface.co/ggml-org/parakeet-GGUF/resolve/main/ggml-parakeet-tdt-0.6b-v3-q8_0.bin";
const parakeetModelMinBytes = 600 * 1024 * 1024;
// Langues gérées par Parakeet TDT 0.6B v3 (25 langues européennes).
const parakeetLanguages = new Set([
  "bg", "cs", "da", "de", "el", "en", "es", "et", "fi", "fr", "hr", "hu",
  "it", "lt", "lv", "mt", "nl", "pl", "pt", "ro", "ru", "sk", "sl", "sv", "uk"
]);
const whisperCppModelFileName = process.env.XTENSION_WHISPER_MODEL_FILE || "ggml-small-q5_1.bin";
const whisperCppModelUrl = process.env.XTENSION_WHISPER_MODEL_URL || "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin";
const whisperCppModelMinBytes = 150 * 1024 * 1024;
// VAD Silero pour le repli whisper : le décodeur ne voit que les segments de
// parole, donc un clip silencieux répond vide en ~40 ms au lieu d'halluciner.
const whisperVadModelFileName = "ggml-silero-v5.1.2.bin";
const whisperVadModelUrl = "https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin";
const whisperVadModelMinBytes = 500 * 1024;
const whisperVadEnabled = process.env.XTENSION_WHISPER_VAD !== "0";
const whisperThreads = Number(process.env.XTENSION_WHISPER_THREADS || Math.max(4, Math.floor(os.cpus().length / 2)));
const whisperServerHost = "127.0.0.1";
// Port volontairement différent des anciens 47625/47626 : si un whisper-server
// d'une version précédente (modèle turbo) tourne encore, on ne le réutilise pas.
const whisperServerPort = Number(process.env.XTENSION_WHISPER_PORT || 47627);
// Un clip n'est transcrit que s'il contient au moins ~1/4 s d'énergie vocale :
// les segments de souffle ou de bruit sont coupés avant d'invoquer un moteur.
const transcriptionMinSpeechMs = 250;
const whisperServerState = { promise: null, process: null, vadActive: false };
let whisperCppInstallPromise = null;
let transcriptionWarmupPromise = null;

// --- LLM local (llama.cpp + modèle GGUF choisi selon la RAM) ---
// Sélection ADAPTATIVE (benchmark FR correction/reformulation/traduction sur des
// cas phonétiques durs). Toute la gamme est en Gemma 4 (dernière génération
// Google, avril 2026, Apache 2.0). Plus la machine a de RAM, plus le modèle est
// fiable :
//   >= 14 Go : Gemma 4 12B  -> 8/8 parfait (aussi bon que Qwen2.5-14B, + léger).
//    9-14 Go : Gemma 4 E4B  -> ~6/8, 0 inversion de sens (bien mieux que les 7-8B).
//    < 9 Go  : Gemma 3 4B   -> garde-fou léger (évite l'OOM sur petites machines).
// Écartés par le benchmark : les 7-8B (Qwen/Qwen3) inversent les négations même
// en Q8 ; Qwen2.5-14B (8/8) est égalé par Gemma 4 12B en plus léger.
// Surchargable via XTENSION_LLM_MODEL_URL / XTENSION_LLM_MODEL_FILE.
const llamaReleaseUrl = "https://github.com/ggml-org/llama.cpp/releases/download/b9882/llama-b9882-bin-win-cpu-x64.zip";

// Chaque tier a aussi un projecteur vision (mmproj-F16.gguf, dans le même repo)
// pour la génération MULTIMODALE : le modèle peut alors « voir » l'image du tweet.
// Téléchargé en best-effort ; si absent, on reste en texte seul (sans --mmproj).
const localModelTiers = [
  { minRamGb: 14, file: "gemma-4-12b-it-Q4_K_M.gguf", url: "https://huggingface.co/unsloth/gemma-4-12b-it-GGUF/resolve/main/gemma-4-12b-it-Q4_K_M.gguf", mmprojFile: "mmproj-gemma-4-12b-F16.gguf", mmprojUrl: "https://huggingface.co/unsloth/gemma-4-12b-it-GGUF/resolve/main/mmproj-F16.gguf" },
  { minRamGb: 9, file: "gemma-4-E4B-it-Q4_K_M.gguf", url: "https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf", mmprojFile: "mmproj-gemma-4-E4B-F16.gguf", mmprojUrl: "https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/mmproj-F16.gguf" },
  { minRamGb: 0, file: "gemma-3-4b-it-Q4_K_M.gguf", url: "https://huggingface.co/unsloth/gemma-3-4b-it-GGUF/resolve/main/gemma-3-4b-it-Q4_K_M.gguf", mmprojFile: "mmproj-gemma-3-4b-F16.gguf", mmprojUrl: "https://huggingface.co/unsloth/gemma-3-4b-it-GGUF/resolve/main/mmproj-F16.gguf" }
];

function selectLocalModelTier() {
  const totalRamGb = os.totalmem() / (1024 ** 3);
  const tier = localModelTiers.find((candidate) => totalRamGb >= candidate.minRamGb) || localModelTiers[localModelTiers.length - 1];
  return { ...tier, ramGb: Math.round(totalRamGb * 10) / 10 };
}

const selectedModelTier = selectLocalModelTier();
const llmModelUrl = process.env.XTENSION_LLM_MODEL_URL || selectedModelTier.url;
const llmModelFileName = process.env.XTENSION_LLM_MODEL_FILE || selectedModelTier.file;
// Projecteur vision (multimodal). Vide => texte seul.
const llmMmprojFileName = process.env.XTENSION_LLM_MMPROJ_FILE || selectedModelTier.mmprojFile || "";
const llmMmprojUrl = process.env.XTENSION_LLM_MMPROJ_URL || selectedModelTier.mmprojUrl || "";
const llmServerHost = "127.0.0.1";
const llmServerPort = Number(process.env.XTENSION_LLM_PORT || 47624);
const llmContextSize = Number(process.env.XTENSION_LLM_CTX || 4096);
const llmTimeoutMs = Number(process.env.XTENSION_LLM_TIMEOUT_MS || 120000);
const llmThreads = Number(process.env.XTENSION_LLM_THREADS || Math.max(4, Math.floor(os.cpus().length / 2)));

// --- Mode GPU (CUDA) optionnel, activable via le réglage des options ---
// Par défaut on reste en CPU (build universel, aucune dépendance). Si l'utilisateur
// active le GPU (carte NVIDIA + pilote CUDA), on télécharge le build CUDA de
// llama.cpp + son runtime cudart, et on lance llama-server avec offload GPU
// (-ngl). Les deux builds coexistent dans des dossiers séparés (llama / llama-cuda)
// pour pouvoir basculer sans re-télécharger.
const llamaCudaReleaseUrl = process.env.XTENSION_LLAMA_CUDA_URL
  || "https://github.com/ggml-org/llama.cpp/releases/download/b9882/llama-b9882-bin-win-cuda-12.4-x64.zip";
const cudartReleaseUrl = process.env.XTENSION_CUDART_URL
  || "https://github.com/ggml-org/llama.cpp/releases/download/b9882/cudart-llama-bin-win-cuda-12.4-x64.zip";
// Nombre de couches offloadées sur le GPU. Normalement CALCULÉ automatiquement
// selon la VRAM détectée (voir computeGpuLoadPlan). L'env XTENSION_LLM_GPU_LAYERS,
// si défini, PRIME sur ce calcul (debug / forçage). null => calcul auto.
const rawGpuLayersOverride = process.env.XTENSION_LLM_GPU_LAYERS;
const llmGpuLayersOverride = (rawGpuLayersOverride != null
  && String(rawGpuLayersOverride).trim() !== ""
  && Number.isFinite(Number(rawGpuLayersOverride)))
  ? Number(rawGpuLayersOverride)
  : null;
// Réserves VRAM (Mo). RESERVE : jamais allouée, pour le bureau Windows/Chrome
// (accél. GPU) et les pics. COMPUTE : buffer de calcul CUDA (obligatoire dès
// qu'une couche est sur GPU). Surchargeables pour l'ajustement fin d'une machine.
const vramReserveMb = Number(process.env.XTENSION_LLM_VRAM_RESERVE_MB || 1024);
const vramComputeBufferMb = Number(process.env.XTENSION_LLM_VRAM_COMPUTE_MB || 768);
// VRAM totale supposée (Mo) quand nvidia-smi est indisponible : on dimensionne
// prudemment (offload partiel) plutôt que de risquer un -ngl 999 aveugle.
const assumedVramMb = Number(process.env.XTENSION_LLM_VRAM_ASSUMED_MB || 6144);
// Au-dessous de ce total VRAM (Mo), la vision (mmproj) part sur le CPU (chemin
// froid, ~1×/génération, impact vitesse quasi nul) pour préserver la VRAM du LLM.
const vramMmprojCpuThresholdMb = Number(process.env.XTENSION_LLM_MMPROJ_CPU_THRESHOLD_MB || 12288);
// Dernier plan de chargement GPU calculé (exposé par /status, journalisé).
let lastGpuPlan = null;

function getBridgeConfigPath() {
  return path.join(getBridgeDataDir(), "config.json");
}

function readBridgeConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(getBridgeConfigPath(), "utf8"));
    return { gpu: Boolean(parsed && parsed.gpu) };
  } catch (error) {
    return { gpu: false };
  }
}

function writeBridgeConfig(config) {
  try {
    fs.mkdirSync(getBridgeDataDir(), { recursive: true });
    fs.writeFileSync(getBridgeConfigPath(), `${JSON.stringify({ gpu: Boolean(config.gpu) }, null, 2)}\n`, "utf8");
    return true;
  } catch (error) {
    logBridgeEvent("bridge_config_write_failed", { error: truncateText(error.message || "", 200) });
    return false;
  }
}

let bridgeConfig = readBridgeConfig();

// L'env XTENSION_LLM_GPU (1/true/on ou 0/false/off) prime sur le réglage persisté.
function isGpuModeEnabled() {
  const override = cleanText(process.env.XTENSION_LLM_GPU || "").toLowerCase();
  if (override === "1" || override === "true" || override === "on") {
    return true;
  }
  if (override === "0" || override === "false" || override === "off") {
    return false;
  }
  return Boolean(bridgeConfig.gpu);
}

function getLlamaEngineDir(gpu) {
  return path.join(getLlmDir(), gpu ? "llama-cuda" : "llama");
}

function isGpuBuildInstalled() {
  return fs.existsSync(path.join(getLlamaEngineDir(true), "llama-server.exe"));
}

let llmInstallPromise = null;
let llmServerPromise = null;
let llmServerProcess = null;
let llmReady = false;

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

  if (request.method === "GET" && (request.url === "/health" || request.url === "/status" || request.url === "/providers")) {
    const gpu = isGpuModeEnabled();
    sendJson(response, 200, {
      ok: true,
      engine: "local",
      defaultProvider: "local",
      providers: [{ id: "local", label: "Local AI engine", installed: true, usable: true }],
      llm: {
        installed: await isLlmInstalled(),
        ready: llmReady,
        model: llmModelFileName,
        mode: gpu ? "gpu" : "cpu",
        gpu,
        gpuBuildInstalled: isGpuBuildInstalled(),
        // Plan de chargement adaptatif VRAM (mode GPU, une fois le serveur lancé).
        ...(gpu && lastGpuPlan ? {
          vram: {
            vramTotalMb: lastGpuPlan.vramTotalMb,
            vramFreeMb: lastGpuPlan.vramFreeMb,
            nglUsed: lastGpuPlan.ngl,
            layersTotal: lastGpuPlan.layersTotal,
            kvOnGpu: lastGpuPlan.kvOnGpu,
            kvType: lastGpuPlan.kvType,
            mmprojOnGpu: lastGpuPlan.mmprojOnGpu,
            flashAttn: lastGpuPlan.flashAttn,
            marginMb: lastGpuPlan.marginMb,
            source: lastGpuPlan.source
          }
        } : {})
      },
      transcription: { available: true }
    });
    return;
  }

  // Réglage du mode d'exécution (CPU/GPU) piloté par les options de l'extension.
  if (request.method === "POST" && request.url === "/config") {
    try {
      const payload = await readJsonBody(request, maxBodyBytes);
      await applyGpuPreference(Boolean(payload?.gpu));
      const gpu = isGpuModeEnabled();
      sendJson(response, 200, {
        ok: true,
        gpu,
        mode: gpu ? "gpu" : "cpu",
        gpuBuildInstalled: isGpuBuildInstalled(),
        ready: llmReady
      });
    } catch (error) {
      sendJson(response, error.statusCode || 500, { ok: false, error: error.message || "Config update failed." });
    }
    return;
  }

  // Génération en STREAMING (NDJSON) : une ligne {"delta":"..."} par token au fil
  // de l'eau, puis une ligne finale {"done":true,"text":"<texte complet nettoyé>"}.
  // Additif : /transform (non-streaming) reste le chemin de repli.
  if (request.method === "POST" && request.url === "/transform-stream") {
    let started = false;
    const streamRequestId = createBridgeRequestId();
    const streamStartedAt = Date.now();
    try {
      const payload = await readJsonBody(request, maxTransformBodyBytes);
      logBridgeEvent("request_started", { requestId: streamRequestId, operation: `${normalizeDraftTransformOperation(payload?.operation)}_stream` });
      response.writeHead(200, {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache",
        "x-accel-buffering": "no"
      });
      started = true;
      const text = await transformDraftLocal(payload, (delta) => {
        response.write(`${JSON.stringify({ delta })}\n`);
      });
      response.write(`${JSON.stringify({ done: true, text })}\n`);
      response.end();
      logBridgeEvent("request_done", { requestId: streamRequestId, operation: "transform_stream", durationMs: Date.now() - streamStartedAt, outputLength: text.length });
    } catch (error) {
      const message = error?.message || "Local AI request failed.";
      const code = cleanText(error?.code || "");
      logBridgeEvent("request_failed", { requestId: streamRequestId, operation: "transform_stream", statusCode: error?.statusCode || 500, code: code || undefined, error: message });
      if (started) {
        try { response.write(`${JSON.stringify({ error: message, code })}\n`); } catch (e) { /* ignore */ }
        try { response.end(); } catch (e) { /* ignore */ }
      } else {
        sendJson(response, error.statusCode || 500, { ok: false, error: message, ...(code ? { code } : {}) });
      }
    }
    return;
  }

  if (request.method !== "POST" || !["/correct", "/transform", "/transcribe", "/warmup"].includes(request.url)) {
    sendJson(response, 404, { ok: false, error: "Not found." });
    return;
  }

  let requestId = "";
  let requestStartedAt = 0;
  let requestOperation = "";

  try {
    requestId = createBridgeRequestId();
    requestStartedAt = Date.now();

    if (request.url === "/warmup") {
      requestOperation = "warmup";
      logBridgeEvent("request_started", { requestId, operation: requestOperation });
      // La dictée se prépare en tâche de fond (binaires + modèle Parakeet +
      // inférence à vide) pour que le premier clic sur le micro soit déjà chaud.
      warmupTranscription().catch(() => {});
      await ensureLlmReady();
      logBridgeEvent("request_done", { requestId, operation: requestOperation, durationMs: Date.now() - requestStartedAt });
      sendJson(response, 200, { ok: true, ready: llmReady });
      return;
    }

    const payload = await readJsonBody(
      request,
      request.url === "/transcribe" ? maxTranscriptionBodyBytes : maxTransformBodyBytes
    );

    if (request.url === "/transcribe") {
      requestOperation = "transcribe";
      logBridgeEvent("request_started", {
        requestId,
        operation: requestOperation,
        mimeType: cleanText(payload?.mimeType || ""),
        mode: cleanText(payload?.mode || ""),
        audioBase64Length: String(payload?.audioBase64 || "").length
      });
      const result = await transcribeAudio(payload);
      logBridgeEvent("request_done", {
        requestId,
        operation: requestOperation,
        durationMs: Date.now() - requestStartedAt,
        outputLength: result.text.length,
        engine: result.engine,
        language: result.language || ""
      });
      sendJson(response, 200, {
        ok: true,
        text: result.text,
        transcript: result.text,
        engine: result.engine,
        language: result.language || ""
      });
      return;
    }

    const operation = request.url === "/correct" ? "correct" : normalizeDraftTransformOperation(payload?.operation);
    requestOperation = operation;
    logBridgeEvent("request_started", { requestId, operation });

    const text = await transformDraftLocal({
      ...payload,
      operation: request.url === "/correct" ? "correct" : payload?.operation
    });
    logBridgeEvent("request_done", {
      requestId,
      operation,
      durationMs: Date.now() - requestStartedAt,
      outputLength: text.length
    });
    sendJson(response, 200, { ok: true, engine: "local", text, correctedText: text });
  } catch (error) {
    const errorCode = cleanText(error.code || "");
    logBridgeEvent("request_failed", {
      requestId,
      operation: requestOperation,
      durationMs: requestStartedAt ? Date.now() - requestStartedAt : 0,
      statusCode: error.statusCode || 500,
      code: errorCode || undefined,
      error: error.message || "Xtension Bridge failed."
    });
    sendJson(response, error.statusCode || 500, {
      ok: false,
      error: error.message || "Xtension Bridge failed.",
      ...(errorCode ? { code: errorCode } : {})
    });
  }
});

server.listen(port, hostname, () => {
  const url = `http://${hostname}:${port}`;
  console.log(`Xtension Bridge listening on ${url}`);
  logBridgeEvent("server_started", { url, pid: process.pid, logFile: bridgeLogFile || "" });
  logBridgeEvent("llm_model_selected", {
    model: llmModelFileName,
    ramGb: selectedModelTier.ramGb,
    tierMinRamGb: selectedModelTier.minRamGb
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

function readJsonBody(request, limitBytes = maxBodyBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
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

// ============================================================================
// Correction / traduction / reformulation via LLM local
// ============================================================================

async function transformDraftLocal(payload, onDelta) {
  const text = cleanDraftText(payload?.text || "");
  if (!text) {
    return "";
  }

  const locale = String(payload?.locale || "en");
  const operation = normalizeDraftTransformOperation(payload?.operation);
  const targetLanguage = cleanText(payload?.targetLanguage || payload?.context?.tweetLanguage || locale || "unknown");
  const { system, user } = buildDraftTransformPrompt(operation, text, locale, targetLanguage, payload?.context, payload?.generatePrompt);

  const raw = await runLocalCompletion(system, user, {
    maxTokens: operation === "generate" ? 700 : 400,
    temperature: operation === "generate" ? 0.7 : 0.1,
    // Image du tweet (data URL base64) pour la génération multimodale, le cas échéant.
    image: payload?.image,
    // Streaming (facultatif) : remonte chaque token au fur et à mesure.
    ...(typeof onDelta === "function" ? { onDelta } : {})
  });
  return sanitizeGeneratedReplyText(raw) || text;
}

function buildDraftTransformPrompt(operation, text, locale, targetLanguage, context, generatePrompt) {
  const instructions = {
    correct: [
      "You correct an X/Twitter draft and return the corrected result in the requested target language (given on the last line of these instructions).",
      "If the draft is already in the target language, keep that language and fix spelling, grammar, syntax, punctuation, capitalization, agreement, conjugation, word order, and spacing.",
      "If the draft is in a different language from the target language, infer the intended meaning, fix the mistakes, and translate that corrected meaning into the target language.",
      "Preserve meaning, tone, register, valid informal wording, slang, idioms, emojis, mentions, hashtags, URLs, and line breaks, but not mistakes.",
      "NEVER change the meaning of the draft. In particular, never add, remove, or flip a negation (ne, n', pas, plus, jamais, rien, aucun, sans, non): if the draft is affirmative, the correction must stay affirmative; if the draft is negative, it must stay negative. Do not turn a statement into its opposite.",
      "Keep every idea and every piece of content of the draft: do not drop, omit, shorten, or summarize any part, so the corrected text is at least as complete as the draft. But you MUST rewrite every wrong or abbreviated word into its correct full form; keeping the same content does not mean keeping the same misspelled characters.",
      "CRITICAL: keep the exact line structure of the draft. Correct it line by line and keep each line on its own line. The output MUST have exactly the same number of lines as the draft, including blank lines. Never merge several lines into one line, never turn a multi-line list into a single sentence, and never replace a line break with a comma, semicolon, colon, dash, or space.",
      "Example: if the draft is these four lines:\nvoici mon plan pour demain\n- alle o marche\n- fair a mangé\n- apeler mamie\nthen return exactly four lines:\nVoici mon plan pour demain\n- Aller marcher\n- Faire à manger\n- Appeler mamie\nand NEVER collapse them into one line such as \"Voici mon plan pour demain : aller marcher, faire à manger, appeler mamie.\".",
      "Do not preserve misspellings, missing letters, broken grammar, or phonetic spelling. Informal language may stay informal, but it must be correctly written.",
      "Rewrite SMS, texting, and phonetic spelling into real, correctly written words. Examples in French: \"g\" becomes \"j'ai\"; \"koi\" becomes \"quoi\"; \"c\" or \"C\" used for \"c'est\" becomes \"c'est\"; \"ct\" becomes \"c'était\"; \"jsuis\" becomes \"je suis\"; \"stp\" becomes \"s'il te plaît\"; \"pcq\" becomes \"parce que\"; \"tkt\" becomes \"t'inquiète\"; \"bcp\" becomes \"beaucoup\".",
      "Example: if the draft is \"Sa va pa marcher !\", return \"Ça va pas marcher !\" or \"Ça ne va pas marcher !\".",
      "Example: if the draft is \"g du mal a comprandre ce ki se pass\" and the target language is French, return \"J'ai du mal à comprendre ce qui se passe.\": here \"g\" means \"j'ai\" and the sentence is affirmative, so NEVER add \"ne ... pas\" and never turn it into \"je n'ai pas de mal\".",
      "Example: if the draft is \"c koi la bon frase\" and the target language is French, return \"C'est quoi la bonne phrase ?\" (fix \"c koi\" into \"c'est quoi\").",
      "Example: if the draft is \"je sui pa dakor\" and the target language is French, return \"Je ne suis pas d'accord.\": use the verb être (\"ne suis pas d'accord\"), never \"n'ai pas d'accord\".",
      "Example: if the draft is \"la corexion sa march ou pa\" and the target language is French, return \"La correction, ça marche ou pas ?\" and never \"Ça marche, ou pas ?\": the word \"correction\" must stay because it is in the draft.",
      "Example: if the draft is \"thii wil not chose the righ ting\" and the target language is French, return \"Je ne choisirai pas le bon truc\" or another fluent French correction of the intended meaning.",
      "Never answer with a meta sentence like \"No correction needed\". Always return the corrected text itself.",
      "Do not make the text more formal, do not rewrite valid wording, and do not add facts or commentary."
    ],
    translate: [
      "You translate this X/Twitter reply draft into the requested target language (given on the last line of these instructions).",
      "If the draft contains spelling, grammar, or syntax mistakes, infer the intended meaning and translate that corrected meaning.",
      "The returned text must be fluent, grammatical, and correctly spelled in the target language, including accents, agreement, and conjugation.",
      "Do not imitate typos, missing letters, broken grammar, or phonetic spelling from the draft.",
      "Example: if the draft is \"Tis will no work!\" and the target language is French, return \"Ça ne va pas marcher !\" or \"Ça ne marchera pas !\", never \"Sa va pa marcher !\".",
      "Preserve meaning, tone, slang, emojis, mentions, hashtags, URLs, and line breaks, but not mistakes.",
      "Do not add facts, explanations, hashtags, or commentary."
    ],
    generate: [
      "The user's message below is an INSTRUCTION describing the X/Twitter post you must write. Write that post so it does exactly what the instruction asks.",
      "Do NOT correct, translate, or merely rephrase the instruction: produce the requested post itself. Example: if the instruction is \"un commentaire sarcastique sur les Bretons\", write an actual sarcastic comment about Bretons, not a corrected version of that sentence.",
      "Write the post in the requested target language (given on the last line of these instructions).",
      "Write in a natural, human X/Twitter voice with a clear point of view. Do not say that you are an AI, do not add meta commentary, and do not wrap the post in quotation marks.",
      "Do not invent specific fake facts, numbers, names, or quotes."
    ]
  }[operation];

  const suffix = ["Never use the Unicode character U+2014 (em dash). Use a comma instead."];
  if (operation === "generate") {
    const style = cleanText(generatePrompt || "");
    if (style) {
      suffix.push("Also follow these style instructions from the user, they are very important: " + style);
    }
  } else {
    suffix.push("Preserve the draft's line breaks exactly: the output must have the same number of lines as the draft, with the line breaks in the same places, as real newline characters. Do not merge separate lines into one line, do not turn lines into a comma-separated sentence, and do not add line breaks that were not in the draft.");
  }
  suffix.push("Return ONLY the resulting text itself, with nothing else: no quotes, no JSON, no labels such as \"text:\", no explanation, no markdown, no code block. Output just the text.");
  // La langue cible est la SEULE partie variable : on la met en toute dernière
  // ligne pour que tout le bloc d'instructions et d'exemples au-dessus (~1500
  // tokens, constant) forme un préfixe identique quelle que soit la langue. Avec
  // cache_prompt:true, ce préfixe n'est traité qu'une fois (un seul préchauffage
  // suffit pour toutes les langues) ; seules cette ligne et le brouillon, courts,
  // sont réanalysés à chaque appel.
  suffix.push("The target language for your output is: " + targetLanguage + ".");
  const system = instructions.concat(suffix).join("\n");

  // Pas de métadonnée (locale/langue) dans le message utilisateur, sinon le modèle
  // peut les recopier dans sa sortie.
  const label = operation === "generate" ? "Instruction (write the post it asks for):" : "Draft:";
  const userParts = [label, text];
  if (context && typeof context === "object" && Object.keys(context).length) {
    userParts.push("", "Context JSON (for reference only, do not reply to it):", JSON.stringify(context));
  }

  return { system, user: userParts.join("\n") };
}

// ============================================================================
// Moteur LLM local (llama.cpp)
// ============================================================================

function getLlmDir() {
  return path.join(getBridgeDataDir(), "llm");
}

async function runLocalCompletion(systemPrompt, userPrompt, options = {}) {
  const baseUrl = await ensureLlmReady();
  // Multimodal : on n'inclut l'image QUE si un projecteur vision est chargé
  // (sinon le modèle texte-seul ignorerait/rejetterait le contenu image). NE
  // JAMAIS passer une data URL base64 par cleanText (corromprait le base64).
  const image = String(options.image || "");
  const hasImage = /^data:image\//i.test(image) && Boolean(getMmprojPath());
  const userContent = hasImage
    ? [
        { type: "text", text: userPrompt },
        { type: "image_url", image_url: { url: image } }
      ]
    : userPrompt;
  const body = {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ],
    temperature: Number.isFinite(options.temperature) ? options.temperature : 0.1,
    top_p: 0.9,
    max_tokens: Math.max(32, Number(options.maxTokens || 400)),
    chat_template_kwargs: { enable_thinking: false },
    // Le prompt système de correction fait ~1500 tokens : sans cache, llama.cpp le
    // réanalyse à chaque appel (~13 s sur un 7B, ~25 s sur un 14B en CPU). Avec le
    // cache, il n'est traité qu'une fois par session ; les corrections suivantes
    // tombent à ~2 s (7B) / ~4-5 s (14B). Le préchauffage au démarrage (warmupLlm)
    // amorce ce cache pour que la première correction réelle soit déjà « à chaud ».
    cache_prompt: true
  };

  // Streaming : si un callback onDelta est fourni, on demande le flux SSE de
  // llama.cpp et on remonte chaque token au fur et à mesure. Le texte complet est
  // renvoyé à la fin (identique au mode non-streaming, mêmes filtres).
  const streaming = typeof options.onDelta === "function";
  if (streaming) {
    body.stream = true;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), llmTimeoutMs);
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!res.ok) {
      const detail = truncateText(await res.text().catch(() => ""), 300);
      throw createBridgeError(`Local AI request failed (${res.status}). ${detail}`, {
        code: "llm_failed",
        statusCode: 502
      });
    }
    let fullContent;
    if (streaming) {
      fullContent = await consumeLlmChatStream(res, options.onDelta);
    } else {
      const data = await res.json();
      fullContent = data?.choices?.[0]?.message?.content || "";
    }
    const raw = stripReasoning(fullContent || "");
    return sanitizeGeneratedReplyText(unwrapPlainTextResult(raw));
  } catch (error) {
    if (error && error.statusCode) {
      throw error;
    }
    throw createBridgeError(`Local AI request failed: ${error.message || error}`, {
      code: "llm_failed",
      statusCode: 502
    });
  } finally {
    clearTimeout(timer);
  }
}

// Lit le flux SSE de /v1/chat/completions (llama.cpp) : lignes « data: {json} »
// dont choices[0].delta.content porte chaque token. Appelle onDelta(token) au fil
// de l'eau et renvoie le texte complet concaténé.
async function consumeLlmChatStream(res, onDelta) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
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
      if (!line.startsWith("data:")) {
        continue;
      }
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") {
        continue;
      }
      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content || "";
        if (delta) {
          full += delta;
          try {
            onDelta(delta, full);
          } catch (error) {
            // le consommateur ne doit pas casser la lecture du flux
          }
        }
      } catch (error) {
        // ligne partielle/non-JSON : ignorée
      }
    }
  }
  return full;
}

// Les transformations demandent du texte BRUT (pas de JSON) pour préserver
// fidèlement les sauts de ligne. Ce filet déballe quand même un éventuel
// {"text":"..."} valide ou des fences markdown/guillemets encadrants.
function unwrapPlainTextResult(raw) {
  let text = String(raw || "").trim();
  const direct = tryParseJson(text);
  if (direct && typeof direct.text === "string") {
    text = direct.text;
  } else {
    const objStr = extractJsonObject(text);
    const obj = objStr ? tryParseJson(objStr) : null;
    if (obj && typeof obj.text === "string") {
      text = obj.text;
    }
  }
  text = text.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "").trim();
  if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1);
  }
  return text;
}

function stripReasoning(value) {
  let s = String(value || "");
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, "");
  if (/<think>/i.test(s)) {
    s = s.replace(/[\s\S]*<\/think>/i, "");
  }
  return s.replace(/```(?:json)?/gi, "").trim();
}

function ensureLlmReady() {
  if (llmServerPromise) {
    return llmServerPromise;
  }

  llmServerPromise = (async () => {
    let engine = await resolveLlmEngine();
    if (!engine) {
      await ensureLlmInstalled();
      engine = await resolveLlmEngine();
    }
    if (!engine) {
      throw createBridgeError("Local AI model could not be installed.", {
        code: "llm_unavailable",
        statusCode: 424
      });
    }
    // S'assurer que le projecteur vision est présent AVANT de lancer le serveur,
    // même si le modèle était déjà installé (sinon le chemin d'install est sauté
    // et --mmproj ne serait jamais ajouté -> multimodal inactif). Best-effort.
    await ensureMmprojInstalled();
    return startLlmServer(engine.executable, engine.model, engine.gpu);
  })().catch((error) => {
    llmServerPromise = null;
    throw error;
  });

  return llmServerPromise;
}

function stopLlmServer() {
  if (llmServerProcess) {
    try {
      llmServerProcess.kill();
    } catch (error) {
      // best effort
    }
  }
  llmServerProcess = null;
  llmReady = false;
  llmServerPromise = null;
}

// Applique la préférence GPU (depuis le réglage des options). Persiste, et si le
// mode a changé, arrête llama-server puis relance en tâche de fond avec le
// nouveau mode (télécharge le build CUDA au besoin).
async function applyGpuPreference(gpu) {
  const next = Boolean(gpu);
  const changed = Boolean(bridgeConfig.gpu) !== next;
  bridgeConfig = { ...bridgeConfig, gpu: next };
  writeBridgeConfig(bridgeConfig);
  logBridgeEvent("bridge_config_updated", { gpu: next, changed });
  if (changed) {
    stopLlmServer();
    // Relance non bloquante : le premier /transform réel attendra la fin de
    // l'installation/chargement du nouveau moteur.
    ensureLlmReady().catch((error) => {
      logBridgeEvent("llm_restart_failed", { error: truncateText(error.message || "", 200) });
    });
  }
  return bridgeConfig;
}

async function resolveLlmEngine() {
  const gpu = isGpuModeEnabled();
  const engineDir = getLlamaEngineDir(gpu);
  const executableCandidates = [
    process.env.XTENSION_LLAMA_SERVER,
    path.join(engineDir, "llama-server.exe"),
    // Repli sur un llama-server système uniquement en CPU (un binaire système
    // n'est pas garanti CUDA, on ne veut pas l'utiliser pour le mode GPU).
    ...(gpu ? [] : ["llama-server", "llama-server.exe"])
  ].filter(Boolean);
  const modelCandidates = [
    process.env.XTENSION_LLM_MODEL,
    path.join(getLlmDir(), "models", llmModelFileName)
  ].filter(Boolean);

  const executable = await resolveExecutable(executableCandidates);
  const model = modelCandidates.find((candidate) => cleanText(candidate) && fs.existsSync(candidate));
  if (!executable || !model) {
    return null;
  }
  return { executable, model, gpu };
}

async function isLlmInstalled() {
  return Boolean(await resolveLlmEngine());
}

function ensureLlmInstalled() {
  if (!llmInstallPromise) {
    llmInstallPromise = installLlmEngine().finally(() => {
      llmInstallPromise = null;
    });
  }
  return llmInstallPromise;
}

async function installLlmEngine() {
  const gpu = isGpuModeEnabled();
  const llmDir = getLlmDir();
  const engineDir = getLlamaEngineDir(gpu);
  const modelsDir = path.join(llmDir, "models");
  const downloadsDir = path.join(llmDir, "downloads");
  const modelFile = path.join(modelsDir, llmModelFileName);

  fs.mkdirSync(engineDir, { recursive: true });
  fs.mkdirSync(modelsDir, { recursive: true });
  fs.mkdirSync(downloadsDir, { recursive: true });

  if (!fs.existsSync(path.join(engineDir, "llama-server.exe"))) {
    const releaseUrl = gpu ? llamaCudaReleaseUrl : llamaReleaseUrl;
    logBridgeEvent("llm_auto_install_started", { component: gpu ? "llama.cpp (CUDA)" : "llama.cpp (CPU)", url: releaseUrl });
    await installLlamaBuild(releaseUrl, engineDir, downloadsDir);
    // En mode GPU, le runtime CUDA (cudart) fournit les DLL (cudart64_*, cublas*)
    // nécessaires à côté de llama-server.exe.
    if (gpu) {
      logBridgeEvent("llm_auto_install_started", { component: "CUDA runtime (cudart)", url: cudartReleaseUrl });
      await installLlamaBuild(cudartReleaseUrl, engineDir, downloadsDir, { requireServer: false });
    }
  }

  if (!fs.existsSync(modelFile)) {
    logBridgeEvent("llm_auto_install_started", { component: llmModelFileName, url: llmModelUrl });
    await downloadFileIfMissing(llmModelUrl, modelFile, 500 * 1024 * 1024);
  }

  // Projecteur vision (multimodal), best-effort.
  await ensureMmprojInstalled();

  logBridgeEvent("llm_auto_install_done", {
    mode: gpu ? "gpu" : "cpu",
    executable: path.join(engineDir, "llama-server.exe"),
    model: modelFile,
    mmproj: getMmprojPath() ? path.basename(getMmprojPath()) : ""
  });
}

function getMmprojPath() {
  if (!llmMmprojFileName) {
    return "";
  }
  const candidate = path.join(getLlmDir(), "models", llmMmprojFileName);
  return fs.existsSync(candidate) ? candidate : "";
}

// Télécharge le projecteur vision s'il est configuré et absent. Best-effort : un
// échec (repo sans mmproj, réseau) laisse le bridge en TEXTE SEUL, sans casser
// l'installation ni le démarrage du serveur.
async function ensureMmprojInstalled() {
  if (!llmMmprojFileName || !llmMmprojUrl || getMmprojPath()) {
    return;
  }
  try {
    const modelsDir = path.join(getLlmDir(), "models");
    fs.mkdirSync(modelsDir, { recursive: true });
    const mmprojFile = path.join(modelsDir, llmMmprojFileName);
    logBridgeEvent("llm_auto_install_started", { component: llmMmprojFileName, url: llmMmprojUrl });
    await downloadFileIfMissing(llmMmprojUrl, mmprojFile, 10 * 1024 * 1024);
    logBridgeEvent("mmproj_installed", { file: llmMmprojFileName });
  } catch (error) {
    logBridgeEvent("mmproj_download_failed", { error: truncateText(error.message || "", 200) });
  }
}

// Télécharge un zip de release llama.cpp (ou cudart) et copie son contenu dans
// `engineDir`. requireServer=false pour les paquets sans llama-server.exe (cudart).
async function installLlamaBuild(url, engineDir, downloadsDir, options = {}) {
  const requireServer = options.requireServer !== false;
  const zipName = path.basename(new URL(url).pathname) || "llama-build.zip";
  const zipFile = path.join(downloadsDir, zipName);
  const extractDir = path.join(downloadsDir, zipName.replace(/\.zip$/i, ""));

  await downloadFileIfMissing(url, zipFile, 1024 * 1024);
  await extractZip(zipFile, extractDir);

  if (requireServer) {
    const serverPath = findFileRecursive(extractDir, "llama-server.exe");
    if (!serverPath) {
      throw createBridgeError("Downloaded llama.cpp package did not contain llama-server.exe.", {
        code: "llm_unavailable",
        statusCode: 424
      });
    }
    fs.cpSync(path.dirname(serverPath), engineDir, { recursive: true, force: true });
  } else {
    // Paquet cudart : copier toutes les DLL à côté de llama-server.exe.
    fs.cpSync(extractDir, engineDir, { recursive: true, force: true });
  }
  fs.rmSync(extractDir, { recursive: true, force: true });
}

// ----------------------------------------------------------------------------
// Chargement adaptatif VRAM / RAM (mode GPU uniquement)
// ----------------------------------------------------------------------------
// Objectif : charger le maximum sur la VRAM et faire déborder le reste vers la
// RAM de façon MAÎTRISÉE (offload partiel -ngl N calculé), pour ne jamais
// atteindre le « sysmem fallback » du pilote NVIDIA (paging silencieux 5-50×
// plus lent). Tout est best-effort : si la détection échoue, on retombe sur un
// dimensionnement prudent, jamais un crash.

// P0 — Détection VRAM via nvidia-smi. Renvoie { totalMb, freeMb } du premier GPU
// ou null (pas de nvidia-smi, non-NVIDIA, timeout).
async function detectGpuVram() {
  try {
    const smi = await resolveExecutable([
      process.env.XTENSION_NVIDIA_SMI,
      "nvidia-smi",
      "nvidia-smi.exe",
      "C:\\Windows\\System32\\nvidia-smi.exe"
    ].filter(Boolean));
    if (!smi) {
      logBridgeEvent("llm_vram_detect_skipped", { reason: "nvidia-smi not found" });
      return null;
    }
    const result = await runProcessCapture(smi, [
      "--query-gpu=memory.total,memory.free",
      "--format=csv,noheader,nounits"
    ], { timeoutMs: 4000 });
    const firstLine = String(result.stdout || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (!firstLine) {
      return null;
    }
    const parts = firstLine.split(",").map((part) => Number(part.trim()));
    const totalMb = parts[0];
    const freeMb = parts[1];
    if (!Number.isFinite(totalMb) || !Number.isFinite(freeMb) || totalMb <= 0 || freeMb < 0) {
      return null;
    }
    return { totalMb, freeMb };
  } catch (error) {
    logBridgeEvent("llm_vram_detect_failed", { error: truncateText(error.message || "", 200) });
    return null;
  }
}

// Lecteur minimal de métadonnées GGUF : en-tête (magic, version, tensor_count,
// kv_count) puis paires clé/valeur, dont on ne retient que les quelques entiers
// utiles au dimensionnement (couches + dimensions du KV). Lecture par fenêtres
// de 1 Mo, en sautant (avance de curseur) les grosses valeurs comme le
// vocabulaire tokenizer, sans jamais charger le fichier entier (~7 Go).
// Best-effort : renvoie {} sur toute anomalie -> l'appelant retombe sur la table.
function readGgufMetadata(modelPath) {
  const WANT = {
    ".block_count": "blockCount",
    ".embedding_length": "embeddingLength",
    ".attention.head_count": "headCount",
    ".attention.head_count_kv": "headCountKv",
    ".attention.key_length": "keyLength",
    ".attention.value_length": "valueLength"
  };
  // Tailles (octets) des types scalaires GGUF ; 8=string, 9=array traités à part.
  const SCALAR_SIZE = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8 };
  let fd = -1;
  try {
    fd = fs.openSync(modelPath, "r");
    const fileSize = fs.fstatSync(fd).size;
    const CHUNK = 1024 * 1024;
    let buf = Buffer.alloc(0);
    let bufStart = 0; // offset fichier de buf[0]
    let pos = 0;      // offset fichier du prochain octet à consommer

    const ensure = (n) => {
      const rel = pos - bufStart;
      if (rel >= 0 && rel + n <= buf.length) {
        return;
      }
      if (pos + n > fileSize) {
        throw new Error("gguf_eof");
      }
      const toRead = Math.min(Math.max(CHUNK, n), fileSize - pos);
      const chunk = Buffer.alloc(toRead);
      const got = fs.readSync(fd, chunk, 0, toRead, pos);
      if (got < n) {
        throw new Error("gguf_short_read");
      }
      buf = got === toRead ? chunk : chunk.subarray(0, got);
      bufStart = pos;
    };
    const take = (n) => {
      ensure(n);
      const rel = pos - bufStart;
      const out = buf.subarray(rel, rel + n);
      pos += n;
      return out;
    };
    const u32 = () => take(4).readUInt32LE(0);
    const u64 = () => Number(take(8).readBigUInt64LE(0));
    const readKey = () => {
      const len = u64();
      if (len > 512) { // une clé GGUF est courte ; au-delà = anomalie
        pos += len;
        return "";
      }
      return take(len).toString("utf8");
    };
    const readScalar = (type) => {
      switch (type) {
        case 0: return take(1).readUInt8(0);
        case 1: return take(1).readInt8(0);
        case 2: return take(2).readUInt16LE(0);
        case 3: return take(2).readInt16LE(0);
        case 4: return take(4).readUInt32LE(0);
        case 5: return take(4).readInt32LE(0);
        case 6: return take(4).readFloatLE(0);
        case 7: return take(1).readUInt8(0);
        case 10: return Number(take(8).readBigUInt64LE(0));
        case 11: return Number(take(8).readBigInt64LE(0));
        case 12: return take(8).readDoubleLE(0);
        default: return null;
      }
    };
    const skipValue = (type) => {
      if (type === 8) { // string
        pos += u64();
        return;
      }
      if (type === 9) { // array : elemType(u32) + count(u64) + éléments
        const elemType = u32();
        const count = u64();
        if (elemType === 8) {
          for (let i = 0; i < count; i += 1) {
            pos += u64();
          }
        } else {
          const size = SCALAR_SIZE[elemType];
          if (!size) {
            throw new Error("gguf_bad_array_type");
          }
          pos += size * count;
        }
        return;
      }
      const size = SCALAR_SIZE[type];
      if (!size) {
        throw new Error("gguf_bad_type");
      }
      pos += size;
    };

    if (take(4).toString("ascii") !== "GGUF") {
      return {};
    }
    const version = u32();
    if (version < 2 || version > 3) {
      return {}; // v1 (compteurs u32) non géré -> repli table
    }
    u64(); // tensor_count (non utilisé, consommé pour avancer)
    const kvCount = u64();
    const meta = {};
    const wantSuffixes = Object.keys(WANT);
    for (let i = 0; i < kvCount; i += 1) {
      const key = readKey();
      const type = u32();
      const suffix = wantSuffixes.find((s) => key.endsWith(s));
      if (suffix && type !== 8 && type !== 9) {
        const value = readScalar(type);
        if (Number.isFinite(value) && value > 0) {
          meta[WANT[suffix]] = Math.floor(value);
        }
      } else {
        skipValue(type);
      }
      if (Object.keys(meta).length === wantSuffixes.length) {
        break; // toutes les clés utiles trouvées
      }
    }
    return meta;
  } catch (error) {
    return {};
  } finally {
    if (fd >= 0) {
      try { fs.closeSync(fd); } catch (e) { /* best effort */ }
    }
  }
}

// Repli grossier sur le nombre de couches quand la lecture GGUF échoue (table
// par tier ; les vraies valeurs viennent du GGUF, ceci n'est qu'un garde-fou).
function fallbackBlockCount(fileName) {
  const name = String(fileName || "").toLowerCase();
  if (name.includes("12b")) return 48;
  if (name.includes("e4b")) return 34;
  if (name.includes("4b")) return 34;
  return 32;
}

// Estime la taille du cache KV (Mo) pour le contexte donné, toutes couches, en
// fp16 ou quantifié q8_0 (~1 o/élément). Utilise les dimensions d'attention du
// GGUF (key_length/value_length quand présents — important pour Gemma dont le
// head_dim ne vaut pas embedding/heads). Renvoie null si les infos manquent.
function estimateKvMb(meta, ctxTokens, quantized) {
  const layers = meta.blockCount;
  const heads = meta.headCount;
  const headsKv = meta.headCountKv || heads;
  let kLen = meta.keyLength;
  let vLen = meta.valueLength;
  if ((!kLen || !vLen) && meta.embeddingLength && heads) {
    const headDim = meta.embeddingLength / heads;
    kLen = kLen || headDim;
    vLen = vLen || headDim;
  }
  if (![layers, headsKv, kLen, vLen, ctxTokens].every((v) => Number.isFinite(v) && v > 0)) {
    return null;
  }
  const bytesPerElem = quantized ? 1 : 2; // q8_0 ≈ 1 o/élément (surcoût de bloc négligé)
  const bytesPerTokenPerLayer = headsKv * (kLen + vLen) * bytesPerElem;
  const bytes = ctxTokens * layers * bytesPerTokenPerLayer;
  return bytes / (1024 * 1024);
}

// P1 + P2 + P3 — Construit le plan de chargement GPU : nombre de couches à
// offloader (-ngl), type de KV, et placement de la vision. L'override d'env prime
// toujours. Sans VRAM détectée, dimensionnement prudent (VRAM basse supposée).
async function computeGpuLoadPlan(model) {
  const ctx = llmContextSize;
  const plan = {
    ngl: 999,
    nglMode: "all",
    flashAttn: true,
    kvType: "f16",
    kvOnGpu: true,
    mmprojOnGpu: true,
    vramTotalMb: null,
    vramFreeMb: null,
    layersTotal: null,
    perLayerMb: null,
    modelSizeMb: null,
    kvEstimateMb: null,
    marginMb: null,
    source: "override"
  };

  // 1) Override d'env : prime sur tout le calcul auto (debug / forçage).
  if (llmGpuLayersOverride != null) {
    plan.ngl = llmGpuLayersOverride;
    plan.nglMode = "override";
    plan.source = "override";
    lastGpuPlan = plan;
    logBridgeEvent("llm_vram_plan", { ...plan });
    return plan;
  }

  // 2) Métadonnées du modèle (couches + dimensions KV) et taille du fichier.
  const meta = readGgufMetadata(model);
  const blockCount = meta.blockCount || fallbackBlockCount(path.basename(model));
  plan.layersTotal = blockCount;
  let modelSizeMb = null;
  try {
    modelSizeMb = fs.statSync(model).size / (1024 * 1024);
    plan.modelSizeMb = Math.round(modelSizeMb);
  } catch (error) {
    modelSizeMb = null;
  }

  // 3) VRAM disponible (best-effort). Échec => VRAM basse supposée (prudent).
  const vram = await detectGpuVram();
  let totalMb;
  let freeMb;
  if (vram) {
    totalMb = vram.totalMb;
    freeMb = vram.freeMb;
    plan.source = meta.blockCount ? "gguf+smi" : "table+smi";
  } else {
    totalMb = assumedVramMb;
    freeMb = assumedVramMb;
    plan.source = meta.blockCount ? "gguf+assumed" : "table+assumed";
  }
  plan.vramTotalMb = Math.round(totalMb);
  plan.vramFreeMb = Math.round(freeMb);

  // Sans taille de fichier ou sans nombre de couches, impossible de dimensionner :
  // tout sur GPU (-ngl 999), flash-attn quand même. Prudent mais fonctionnel.
  if (!modelSizeMb || !blockCount) {
    lastGpuPlan = plan;
    logBridgeEvent("llm_vram_plan", { ...plan });
    return plan;
  }

  const perLayerMb = modelSizeMb / (blockCount + 2);
  plan.perLayerMb = Math.round(perLayerMb * 10) / 10;
  const computeBufferMb = Math.round(vramComputeBufferMb * Math.max(1, ctx / 4096));

  // Combien de couches tiennent, en réservant le buffer de calcul, la réserve
  // système ET le KV (chemin chaud : il reste collé aux couches sur le GPU).
  const planFor = (quantized) => {
    const kvMb = estimateKvMb(meta, ctx, quantized);
    const kvReserve = kvMb != null ? kvMb : 0;
    const weightsBudgetMb = freeMb - vramReserveMb - computeBufferMb - kvReserve;
    const layersThatFit = Math.floor(weightsBudgetMb / perLayerMb);
    return { kvMb, layersThatFit };
  };

  // P2 — rétrécir le KV AVANT de sacrifier des couches : fp16 d'abord ; si offload
  // partiel, retenter en KV quantifié q8_0 (≈ ÷2 du KV) pour regagner des couches.
  let quantized = false;
  let step = planFor(false);
  if (step.layersThatFit < blockCount + 1) {
    const q = planFor(true);
    if (q.layersThatFit > step.layersThatFit) {
      quantized = true;
      step = q;
    }
  }

  const ngl = Math.max(0, Math.min(step.layersThatFit, blockCount + 1));
  plan.kvType = quantized ? "q8_0" : "f16";
  plan.kvEstimateMb = step.kvMb != null ? Math.round(step.kvMb) : null;
  if (ngl >= blockCount + 1) {
    plan.ngl = 999;
    plan.nglMode = "all";
  } else {
    plan.ngl = ngl;
    plan.nglMode = "partial";
  }

  // P3 — vision (mmproj) sur CPU si petit GPU OU si le LLM est déjà en offload
  // partiel (chaque Mo de VRAM compte). Chemin froid : impact vitesse négligeable.
  const smallGpu = totalMb <= vramMmprojCpuThresholdMb;
  plan.mmprojOnGpu = !(smallGpu || plan.nglMode === "partial");

  // Marge estimée = VRAM libre - (poids offloadés + KV + buffer de calcul + réserve).
  const weightsOnGpuMb = plan.ngl === 999 ? modelSizeMb : ngl * perLayerMb;
  const kvOnGpuMb = step.kvMb != null ? step.kvMb : 0;
  plan.marginMb = Math.round(freeMb - vramReserveMb - computeBufferMb - weightsOnGpuMb - kvOnGpuMb);

  lastGpuPlan = plan;
  logBridgeEvent("llm_vram_plan", { ...plan });
  return plan;
}

async function startLlmServer(executable, model, gpu) {
  const baseUrl = `http://${llmServerHost}:${llmServerPort}`;

  if (llmReady && llmServerProcess && !llmServerProcess.killed) {
    return baseUrl;
  }
  if (await isLlmServerHealthy(baseUrl)) {
    llmReady = true;
    return baseUrl;
  }

  // Mode GPU : plan de chargement adaptatif (VRAM détectée -> -ngl calculé, KV,
  // vision). Recalculé à CHAQUE démarrage, donc aussi après un changement de mode
  // via /config (applyGpuPreference -> stopLlmServer -> ensureLlmReady). Mode CPU :
  // pas de plan, -ngl 0.
  const plan = gpu ? await computeGpuLoadPlan(model) : null;
  if (!gpu) {
    lastGpuPlan = null;
  }

  const args = [
    "-m", model,
    "--host", llmServerHost,
    "--port", String(llmServerPort),
    "-c", String(llmContextSize),
    "-t", String(llmThreads),
    // Mode GPU : offload calculé (-ngl N, ou 999 si tout tient). Mode CPU : -ngl 0.
    "-ngl", gpu ? String(plan.ngl) : "0",
    "--jinja",
    "--no-webui"
  ];
  if (gpu) {
    // P2 — flash-attention systématique en mode GPU : réduit le KV et accélère
    // (aujourd'hui non passé donc « auto » — le forçage garantit le gain).
    args.push("-fa", "on");
    // KV quantifié q8_0 quand la VRAM serre (décidé dans le plan).
    if (plan.kvType === "q8_0") {
      args.push("-ctk", "q8_0", "-ctv", "q8_0");
    }
  }
  // Multimodal : charge le projecteur vision s'il est présent (le modèle peut
  // alors « voir » les images passées dans la requête).
  const mmprojPath = getMmprojPath();
  if (mmprojPath) {
    args.push("--mmproj", mmprojPath);
    // P3 — vision sur CPU quand la VRAM serre : le LLM reste 100 % GPU (rapide),
    // seule l'image est encodée sur CPU (rare, ~1× par génération).
    if (gpu && plan && !plan.mmprojOnGpu) {
      args.push("--no-mmproj-offload");
    }
  }

  logBridgeEvent("llm_server_starting", {
    executable: path.basename(executable),
    model: path.basename(model),
    threads: llmThreads,
    mode: gpu ? "gpu" : "cpu",
    ...(gpu ? { ngl: plan.ngl, kvType: plan.kvType, flashAttn: true, mmprojOnGpu: plan.mmprojOnGpu } : {})
  });
  // Mode CPU (défaut) : build CPU de llama.cpp + -ngl 0, et on MASQUE tout GPU au
  // processus (rien n'est chargé en VRAM). Mode GPU : build CUDA + -ngl N, on ne
  // masque rien pour laisser llama.cpp voir la carte.
  const child = spawn(executable, args, {
    env: gpu
      ? buildBridgeEnv()
      : {
          ...buildBridgeEnv(),
          CUDA_VISIBLE_DEVICES: "",
          HIP_VISIBLE_DEVICES: "",
          GGML_VK_VISIBLE_DEVICES: ""
        },
    windowsHide: true,
    stdio: ["ignore", "ignore", "ignore"]
  });
  llmServerProcess = child;
  llmReady = false;
  // Absorbe un échec de spawn (voir startWhisperServer) : sans ce listener, un
  // événement 'error' non géré ferait tomber tout le bridge.
  child.on("error", (error) => {
    logBridgeEvent("llm_server_spawn_failed", { error: truncateText(error.message || "", 200) });
    llmReady = false;
    llmServerProcess = null;
    llmServerPromise = null;
  });
  child.on("exit", () => {
    llmReady = false;
    llmServerProcess = null;
    llmServerPromise = null;
  });

  const ready = await waitForLlmServer(baseUrl, 240000);
  if (!ready) {
    try { child.kill(); } catch (error) { /* best effort */ }
    llmServerProcess = null;
    throw createBridgeError("Local AI engine did not start in time.", {
      code: "llm_unavailable",
      statusCode: 504
    });
  }

  llmReady = true;
  logBridgeEvent("llm_server_ready", { url: baseUrl });
  // Préchauffage en tâche de fond : on amorce le cache du prompt de correction
  // (le préfixe ~1500 tokens partagé par toutes les langues) sans bloquer la
  // disponibilité du serveur. Couplé à un /warmup appelé par l'extension quand
  // l'utilisateur ouvre le composeur, la première correction réelle est déjà
  // « à chaud ».
  primeLlmCache(baseUrl).catch(() => {});
  return baseUrl;
}

async function primeLlmCache(baseUrl) {
  try {
    const { system, user } = buildDraftTransformPrompt("correct", "bonjour sa va", "fr", "French", null, "");
    const body = {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.1,
      top_p: 0.9,
      max_tokens: 8,
      chat_template_kwargs: { enable_thinking: false },
      cache_prompt: true
    };
    await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    logBridgeEvent("llm_cache_primed", {});
  } catch (error) {
    // best effort
  }
}

async function isLlmServerHealthy(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/health`);
    return res.ok;
  } catch (error) {
    return false;
  }
}

async function waitForLlmServer(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isLlmServerHealthy(baseUrl)) {
      return true;
    }
    await delay(700);
  }
  return false;
}

// ============================================================================
// Transcription vocale (Parakeet en premier, whisper.cpp / faster-whisper en repli)
// ============================================================================

async function transcribeAudio(payload) {
  // Ne JAMAIS passer le base64 audio par cleanText : ce dernier normalise des
  // espaces et corromprait le flux (des octets seraient retirés au milieu de
  // l'audio). Un simple trim suffit à enlever d'éventuels espaces d'encodage.
  const audioBase64 = String(payload?.audioBase64 || "").trim();
  if (!audioBase64) {
    throw createBridgeError("No audio was provided.", {
      code: "no_speech",
      statusCode: 400
    });
  }

  const audioBytes = Buffer.from(audioBase64, "base64");
  if (!audioBytes.length) {
    throw createBridgeError("No audio was provided.", {
      code: "no_speech",
      statusCode: 400
    });
  }

  if (audioBytes.length > maxAudioBytes) {
    throw createBridgeError("The recording is too long.", {
      code: "audio_too_large",
      statusCode: 413
    });
  }

  const mimeType = cleanText(payload?.mimeType || "audio/webm");
  const language = normalizeTranscriptionLanguage(payload?.language || "");
  // Indice de langue non contraignant (locale du navigateur) : il ne force
  // JAMAIS la langue transcrite, il sert uniquement à choisir le moteur le plus
  // adapté quand la langue parlée est inconnue (dictée en auto-détection).
  const hintLanguage = normalizeTranscriptionLanguage(payload?.hintLanguage || "");
  const extension = audioExtensionFromMimeType(mimeType);
  const sourceFile = path.join(os.tmpdir(), `xtension-bridge-dictation-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`);
  const tempFiles = [sourceFile];
  fs.writeFileSync(sourceFile, audioBytes);

  logBridgeEvent("transcription_audio_ready", {
    mimeType,
    bytes: audioBytes.length,
    extension,
    language: language || "auto"
  });

  try {
    const wavFile = await convertAudioToWav(sourceFile, tempFiles);
    // Sans WAV (ffmpeg absent), les moteurs principaux (Parakeet, whisper) sont
    // hors-jeu : seul faster-whisper peut décoder le webm/opus brut. Si lui non
    // plus n'est pas là, on renvoie une erreur EXPLICITE sur ffmpeg plutôt qu'un
    // « transcription indisponible » trompeur.
    if (!wavFile) {
      logBridgeEvent("transcription_ffmpeg_missing", { mimeType });
    }
    const audioInfo = wavFile ? analyzeWavAudio(wavFile) : null;

    // Garde d'énergie : un clip sans parole réelle (souffle, clavier, silence)
    // renvoie immédiatement un texte vide, sans invoquer de moteur. Aucune
    // hallucination possible et réponse en quelques millisecondes.
    if (audioInfo && audioInfo.speechMs < transcriptionMinSpeechMs) {
      return { text: "", engine: "silence-gate", language };
    }

    // Chaque moteur renvoie null s'il est INDISPONIBLE ; s'il a tourné, son
    // résultat (même vide : silence légitime) est retourné tel quel, sans
    // cascader vers un moteur plus lent.
    const preferredLanguage = language || hintLanguage;
    if (wavFile && (!preferredLanguage || parakeetLanguages.has(preferredLanguage))) {
      const result = await transcribeWithParakeet(wavFile, tempFiles);
      if (result) {
        return {
          text: filterTranscript(result.text, audioInfo, true),
          engine: "parakeet",
          language
        };
      }
    }

    if (wavFile) {
      const result = await transcribeViaWhisperServer(wavFile, language, audioInfo);
      if (result) {
        return {
          text: filterTranscript(result.text, audioInfo, result.vadActive),
          engine: "whisper-server",
          language: result.language || language
        };
      }
    }

    if (wavFile) {
      const whisperCpp = await resolveWhisperCppEngine();
      if (whisperCpp) {
        const result = await transcribeWithWhisperCpp(whisperCpp, wavFile, language, tempFiles, audioInfo);
        if (result) {
          return {
            text: filterTranscript(result.text, audioInfo, result.vadActive),
            engine: "whisper.cpp",
            language
          };
        }
      }
    }

    const fasterWhisper = await resolveFasterWhisperEngine();
    if (fasterWhisper) {
      const result = await transcribeWithFasterWhisper(fasterWhisper, sourceFile, language);
      return {
        text: filterTranscript(result.text, audioInfo, true),
        engine: "faster-whisper",
        language: result.language || language
      };
    }

    if (!wavFile) {
      throw createBridgeError("ffmpeg is required for dictation but was not found. Install ffmpeg and make it available on the PATH.", {
        code: "ffmpeg_missing",
        statusCode: 424
      });
    }

    throw createBridgeError("Local transcription is not installed in Xtension Bridge.", {
      code: "transcription_unavailable",
      statusCode: 424
    });
  } finally {
    cleanupFiles(tempFiles);
  }
}

// Analyse un WAV PCM 16 bits (produit par notre conversion ffmpeg) : durée
// totale et durée de parole estimée par l'énergie RMS de trames de 20 ms.
function analyzeWavAudio(wavFile) {
  try {
    const buffer = fs.readFileSync(wavFile);
    if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
      return null;
    }

    let offset = 12;
    let dataOffset = -1;
    let dataSize = 0;
    let channels = 1;
    let sampleRate = 16000;
    let bitsPerSample = 16;
    let audioFormat = 1;
    while (offset + 8 <= buffer.length) {
      const chunkId = buffer.toString("ascii", offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      if (chunkId === "fmt " && offset + 24 <= buffer.length) {
        audioFormat = buffer.readUInt16LE(offset + 8);
        channels = buffer.readUInt16LE(offset + 10);
        sampleRate = buffer.readUInt32LE(offset + 12);
        bitsPerSample = buffer.readUInt16LE(offset + 22);
      } else if (chunkId === "data") {
        dataOffset = offset + 8;
        dataSize = Math.min(chunkSize, buffer.length - dataOffset);
        break;
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }
    if (dataOffset < 0 || audioFormat !== 1 || bitsPerSample !== 16 || channels < 1 || sampleRate <= 0) {
      return null;
    }

    const bytesPerFrame = 2 * channels;
    const totalSamples = Math.floor(dataSize / bytesPerFrame);
    const windowSamples = Math.max(1, Math.round(sampleRate * 0.02));
    let speechMs = 0;
    for (let start = 0; start + windowSamples <= totalSamples; start += windowSamples) {
      let sum = 0;
      for (let index = 0; index < windowSamples; index += 1) {
        const sample = buffer.readInt16LE(dataOffset + (start + index) * bytesPerFrame) / 32768;
        sum += sample * sample;
      }
      if (Math.sqrt(sum / windowSamples) >= 0.008) {
        speechMs += 20;
      }
    }

    return {
      durationMs: Math.round((totalSamples / sampleRate) * 1000),
      speechMs
    };
  } catch (error) {
    return null;
  }
}

// Fenêtre d'encodage whisper proportionnelle à la durée réelle du clip (+
// marge) : whisper padde sinon chaque clip à 30 s et paie ~6x le coût encodeur
// nécessaire pour une phrase de dictée de quelques secondes.
function whisperAudioCtxForDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs >= 28000) {
    return 0;
  }
  return Math.min(1500, Math.max(192, Math.ceil((durationMs / 1000) * 50) + 96));
}

async function convertAudioToWav(sourceFile, tempFiles) {
  const ffmpeg = await resolveFfmpegExecutable();
  if (!ffmpeg) {
    return "";
  }
  const wavFile = `${sourceFile}.16k.wav`;
  tempFiles.push(wavFile);
  await runProcessCapture(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", sourceFile,
    "-ac", "1", "-ar", "16000",
    wavFile
  ], { timeoutMs: Math.min(30000, transcriptionTimeoutMs) });
  return fs.existsSync(wavFile) ? wavFile : "";
}

function findWhisperServerExecutable() {
  const candidates = [
    process.env.XTENSION_WHISPER_SERVER,
    path.join(getBridgeDataDir(), "speech", "whisper.cpp", "whisper-server.exe")
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function speechModelPath(fileName) {
  return path.join(getBridgeDataDir(), "speech", "models", fileName);
}

// Téléchargement à la demande d'un modèle de dictée, dédupliqué : une requête
// interim et une requête finale simultanées ne déclenchent qu'un téléchargement.
const speechModelDownloads = new Map();

function ensureSpeechModel(fileName, url, minBytes) {
  const modelPath = speechModelPath(fileName);
  if (fs.existsSync(modelPath) && fs.statSync(modelPath).size >= minBytes) {
    return Promise.resolve(modelPath);
  }
  if (!shouldAutoInstallWhisperCpp()) {
    return Promise.resolve("");
  }
  if (speechModelDownloads.has(fileName)) {
    return speechModelDownloads.get(fileName);
  }

  const download = (async () => {
    fs.mkdirSync(path.dirname(modelPath), { recursive: true });
    logBridgeEvent("speech_model_download", { model: fileName, url });
    await downloadFileIfMissing(url, modelPath, minBytes);
    return fs.existsSync(modelPath) ? modelPath : "";
  })().catch((error) => {
    logBridgeEvent("speech_model_download_failed", { model: fileName, error: truncateText(error.message || "", 200) });
    return "";
  }).finally(() => {
    speechModelDownloads.delete(fileName);
  });

  speechModelDownloads.set(fileName, download);
  return download;
}

// --- Parakeet (moteur principal) ---

async function resolveParakeetEngine() {
  const executableCandidates = [
    process.env.XTENSION_PARAKEET_CLI,
    path.join(getBridgeDataDir(), "speech", "whisper.cpp", "parakeet-cli.exe")
  ].filter(Boolean);

  let executable = await resolveExecutable(executableCandidates);
  if (!executable && shouldAutoInstallWhisperCpp()) {
    await ensureWhisperCppInstalled();
    executable = await resolveExecutable(executableCandidates);
  }
  if (!executable) {
    return null;
  }

  const model = await ensureSpeechModel(parakeetModelFileName, parakeetModelUrl, parakeetModelMinBytes);
  if (!model) {
    return null;
  }
  return { executable, model };
}

async function transcribeWithParakeet(wavFile, tempFiles) {
  const engine = await resolveParakeetEngine();
  if (!engine) {
    return null;
  }

  const outputBase = `${wavFile}.parakeet`;
  const outputTextFile = `${outputBase}.txt`;
  tempFiles.push(outputTextFile);
  logBridgeEvent("transcription_engine_started", {
    engine: "parakeet",
    model: path.basename(engine.model)
  });

  try {
    const result = await runProcessCapture(engine.executable, [
      "-m", engine.model,
      "-f", wavFile,
      "-t", String(whisperThreads),
      "-ng",
      "-np",
      "-otxt",
      "-of", outputBase
    ], { timeoutMs: transcriptionTimeoutMs });
    const raw = fs.existsSync(outputTextFile) ? fs.readFileSync(outputTextFile, "utf8") : result.stdout;
    return { text: sanitizeTranscriptText(raw) };
  } catch (error) {
    logBridgeEvent("transcription_engine_failed", {
      engine: "parakeet",
      error: truncateText(error.message || "", 200)
    });
    return null;
  }
}

// --- whisper-server (repli, modèle résident) ---

function ensureWhisperServer() {
  if (whisperServerState.promise) {
    return whisperServerState.promise;
  }
  const attempt = (async () => {
    let serverExe = findWhisperServerExecutable();
    if (!serverExe && shouldAutoInstallWhisperCpp()) {
      await ensureWhisperCppInstalled();
      serverExe = findWhisperServerExecutable();
    }
    if (!serverExe) {
      return null;
    }
    const model = await ensureSpeechModel(whisperCppModelFileName, whisperCppModelUrl, whisperCppModelMinBytes);
    if (!model) {
      return null;
    }
    const vadModel = whisperVadEnabled
      ? await ensureSpeechModel(whisperVadModelFileName, whisperVadModelUrl, whisperVadModelMinBytes)
      : "";
    let baseUrl = await startWhisperServer(serverExe, model, vadModel);
    if (!baseUrl && vadModel) {
      // Si le serveur refuse de démarrer avec le VAD (modèle corrompu...), on
      // retente sans : les filtres anti-hallucination aval restent actifs.
      baseUrl = await startWhisperServer(serverExe, model, "");
    }
    return baseUrl;
  })().catch(() => null).then((baseUrl) => {
    // Ne PAS mémoriser un échec (téléchargement KO, exe absent, serveur mort) :
    // une valeur nulle en cache désactiverait le repli pour toujours. On ne
    // garde la promesse en cache que si le serveur est réellement prêt ; sinon
    // la prochaine requête relance une tentative (réseau revenu, etc.).
    if (!baseUrl && whisperServerState.promise === attempt) {
      whisperServerState.promise = null;
    }
    return baseUrl;
  });
  whisperServerState.promise = attempt;
  return attempt;
}

async function startWhisperServer(executable, model, vadModel) {
  const baseUrl = `http://${whisperServerHost}:${whisperServerPort}`;
  if (await isWhisperServerHealthy(baseUrl)) {
    // Serveur déjà actif mais pas lancé par ce processus : on ne sait pas s'il
    // a le VAD, donc on reste prudent (filtres anti-hallucination stricts).
    if (!whisperServerState.process) {
      whisperServerState.vadActive = false;
    }
    return baseUrl;
  }

  const args = [
    "-m", model,
    "--host", whisperServerHost,
    "--port", String(whisperServerPort),
    "-t", String(whisperThreads),
    "-ng",
    "-l", "auto",
    "-nf",
    "-sns"
  ];
  if (vadModel) {
    args.push("--vad", "--vad-model", vadModel);
  }
  logBridgeEvent("whisper_server_starting", {
    model: path.basename(model),
    port: whisperServerPort,
    threads: whisperThreads,
    vad: Boolean(vadModel)
  });
  const child = spawn(executable, args, {
    env: {
      ...buildBridgeEnv(),
      CUDA_VISIBLE_DEVICES: "",
      HIP_VISIBLE_DEVICES: "",
      GGML_VK_VISIBLE_DEVICES: ""
    },
    windowsHide: true,
    stdio: ["ignore", "ignore", "ignore"]
  });
  whisperServerState.process = child;
  // Sans listener 'error', un échec de spawn (EACCES/ENOENT, exe mis en
  // quarantaine par l'antivirus...) émet un événement 'error' non géré qui tue
  // le processus Node entier. On l'absorbe : le serveur est simplement compté
  // comme indisponible et la transcription cascade vers le moteur suivant.
  child.on("error", (error) => {
    logBridgeEvent("whisper_server_spawn_failed", { error: truncateText(error.message || "", 200) });
    whisperServerState.process = null;
    whisperServerState.promise = null;
  });
  child.on("exit", () => {
    whisperServerState.process = null;
    whisperServerState.promise = null;
  });

  const ready = await waitForWhisperServer(baseUrl, 120000);
  if (!ready) {
    try { child.kill(); } catch (error) { /* best effort */ }
    whisperServerState.process = null;
    return null;
  }
  whisperServerState.vadActive = Boolean(vadModel);
  logBridgeEvent("whisper_server_ready", { url: baseUrl, port: whisperServerPort, vad: Boolean(vadModel) });
  return baseUrl;
}

async function isWhisperServerHealthy(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/`, { method: "GET" });
    return res.ok || res.status === 400 || res.status === 404;
  } catch (error) {
    return false;
  }
}

async function waitForWhisperServer(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isWhisperServerHealthy(baseUrl)) {
      return true;
    }
    await delay(600);
  }
  return false;
}

// whisper émet "..." / "[BLANK_AUDIO]" / "(silence)" pour un segment sans parole :
// on ne renvoie rien dans ce cas (sinon des "..." polluent la dictée).
function filterWhisperTranscript(text) {
  const value = cleanText(String(text || "").replace(/\s*\n\s*/g, " "));
  if (!value) {
    return "";
  }
  if (/^[\s.…·•\-–—_]*$/.test(value)) {
    return "";
  }
  if (/^[\[(<]?\s*(blank[_\s]?audio|silence|inaudible|music|musique|bruit|noise|no\s?speech|sans\sparole)\s*[\])>]?\.?$/i.test(value)) {
    return "";
  }
  return value;
}

// Hallucinations classiques de whisper sur un segment sans parole réelle
// (artefacts du corpus d'entraînement : remerciements et crédits de sous-titres
// YouTube). Les crédits sont toujours filtrés ; les formules courtes ne le sont
// que si le clip ne contient presque pas d'énergie vocale, pour ne jamais jeter
// un vrai « Merci. » dicté.
const whisperCreditHallucinationPattern = /(amara\.org|sous-?titr\w*\s+(?:réalisés?|par|faits?)|subtitles?\s+(?:by|made)|caption\w*\s+by|untertitel\w*\s+(?:von|des|im))/i;
const whisperShortHallucinationPatterns = [
  /^(?:thank you|thank you (?:all |so much )?for watching|thanks for watching|please subscribe|see you (?:next time|later|soon)|bye(?: bye)?|you|the end)[\s.!,]*$/i,
  /^(?:merci(?: beaucoup| à tous)?(?: d'avoir regardé(?: cette vidéo| la vidéo)?)?|au revoir|à bientôt|à la prochaine|abonnez-vous.{0,30})[\s.!,]*$/i,
  /^(?:vielen dank.{0,30}|danke.{0,20}|bis zum nächsten mal)[\s.!,]*$/i,
  /^(?:gracias por (?:ver|mirar).{0,20}|hasta la próxima|suscríbete.{0,30})[\s.!,]*$/i,
  /^(?:grazie.{0,30}|ciao(?: a tutti)?)[\s.!,]*$/i,
  /^(?:obrigado.{0,30}|até a próxima)[\s.!,]*$/i,
  /^(?:ご視聴ありがとうございました|ありがとうございました)[\s。！]*$/,
  /^(?:시청해\s?주셔서 감사합니다.{0,10})[\s.!]*$/
];

// Filtre final d'un transcript : `trusted` vaut true quand le moteur est
// structurellement fiable sur le silence (Parakeet, whisper avec VAD actif).
function filterTranscript(text, audioInfo, trusted) {
  const value = filterWhisperTranscript(text);
  if (!value) {
    return "";
  }
  if (whisperCreditHallucinationPattern.test(value)) {
    return "";
  }
  const speechMs = audioInfo ? audioInfo.speechMs : null;
  const lowSpeech = speechMs != null && speechMs < 400;
  if (!trusted && (lowSpeech || speechMs == null) && whisperShortHallucinationPatterns.some((pattern) => pattern.test(value))) {
    return "";
  }
  return value;
}

// Noms de langue renvoyés par whisper-server (verbose_json) -> codes ISO. La
// langue détectée est renvoyée à l'extension, qui l'épingle pour les requêtes
// suivantes de la même session (l'auto-détection coûte ~1 s par requête).
const whisperLanguageCodesByName = {
  english: "en", chinese: "zh", german: "de", spanish: "es", russian: "ru",
  korean: "ko", french: "fr", japanese: "ja", portuguese: "pt", turkish: "tr",
  polish: "pl", catalan: "ca", dutch: "nl", arabic: "ar", swedish: "sv",
  italian: "it", indonesian: "id", hindi: "hi", finnish: "fi", vietnamese: "vi",
  hebrew: "he", ukrainian: "uk", greek: "el", malay: "ms", czech: "cs",
  romanian: "ro", danish: "da", hungarian: "hu", tamil: "ta", norwegian: "no",
  thai: "th", urdu: "ur", croatian: "hr", bulgarian: "bg", lithuanian: "lt",
  latin: "la", maori: "mi", malayalam: "ml", welsh: "cy", slovak: "sk",
  telugu: "te", persian: "fa", latvian: "lv", bengali: "bn", serbian: "sr",
  azerbaijani: "az", slovenian: "sl", kannada: "kn", estonian: "et",
  macedonian: "mk", breton: "br", basque: "eu", icelandic: "is", armenian: "hy",
  nepali: "ne", mongolian: "mn", bosnian: "bs", kazakh: "kk", albanian: "sq",
  swahili: "sw", galician: "gl", marathi: "mr", punjabi: "pa", sinhala: "si",
  khmer: "km", shona: "sn", yoruba: "yo", somali: "so", afrikaans: "af",
  occitan: "oc", georgian: "ka", belarusian: "be", tajik: "tg", sindhi: "sd",
  gujarati: "gu", amharic: "am", yiddish: "yi", lao: "lo", uzbek: "uz",
  faroese: "fo", "haitian creole": "ht", pashto: "ps", turkmen: "tk",
  nynorsk: "nn", maltese: "mt", sanskrit: "sa", luxembourgish: "lb",
  myanmar: "my", tibetan: "bo", tagalog: "tl", malagasy: "mg", assamese: "as",
  tatar: "tt", hawaiian: "haw", lingala: "ln", hausa: "ha", bashkir: "ba",
  javanese: "jw", sundanese: "su"
};

function whisperLanguageNameToCode(value) {
  const name = cleanText(value).toLowerCase();
  if (!name) {
    return "";
  }
  return normalizeTranscriptionLanguage(whisperLanguageCodesByName[name] || name);
}

async function transcribeViaWhisperServer(wavFile, language, audioInfo) {
  const baseUrl = await ensureWhisperServer();
  if (!baseUrl) {
    return null;
  }

  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(wavFile)]), "audio.wav");
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");
  form.append("language", language || "auto");
  const audioCtx = whisperAudioCtxForDuration(audioInfo?.durationMs);
  if (audioCtx) {
    form.append("audio_ctx", String(audioCtx));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), transcriptionTimeoutMs);
  try {
    const res = await fetch(`${baseUrl}/inference`, {
      method: "POST",
      body: form,
      signal: controller.signal
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json().catch(() => null);
    if (!data || typeof data.text !== "string") {
      return null;
    }
    return {
      text: sanitizeTranscriptText(data.text),
      language: whisperLanguageNameToCode(data.language || ""),
      vadActive: whisperServerState.vadActive
    };
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Préchauffage de la dictée : binaires + modèle Parakeet, puis une inférence à
// vide pour amener le modèle dans le cache disque. Appelé (sans blocage) quand
// l'utilisateur ouvre le composeur, pour que le premier clic micro soit chaud.
function warmupTranscription() {
  if (transcriptionWarmupPromise) {
    return transcriptionWarmupPromise;
  }
  transcriptionWarmupPromise = (async () => {
    const engine = await resolveParakeetEngine();
    if (!engine) {
      ensureWhisperServer().catch(() => {});
      return;
    }
    const wavFile = path.join(os.tmpdir(), `xtension-bridge-warmup-${process.pid}-${Date.now()}.wav`);
    try {
      fs.writeFileSync(wavFile, buildSilenceWav(500));
      await runProcessCapture(engine.executable, [
        "-m", engine.model,
        "-f", wavFile,
        "-t", String(whisperThreads),
        "-ng",
        "-np"
      ], { timeoutMs: 60000 });
      logBridgeEvent("transcription_warmed", { engine: "parakeet" });
    } finally {
      cleanupFiles([wavFile]);
    }
  })().catch(() => {}).finally(() => {
    transcriptionWarmupPromise = null;
  });
  return transcriptionWarmupPromise;
}

function buildSilenceWav(durationMs) {
  const sampleRate = 16000;
  const samples = Math.max(1, Math.round((sampleRate * durationMs) / 1000));
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

async function resolveWhisperCppEngine() {
  const engine = await findWhisperCppEngine();
  if (engine) {
    return engine;
  }

  if (shouldAutoInstallWhisperCpp()) {
    await ensureWhisperCppInstalled();
    await ensureSpeechModel(whisperCppModelFileName, whisperCppModelUrl, whisperCppModelMinBytes);
    return findWhisperCppEngine();
  }

  return null;
}

async function findWhisperCppEngine() {
  const executableCandidates = [
    process.env.XTENSION_WHISPER_CPP_CLI,
    process.env.WHISPER_CPP_CLI,
    path.join(getBridgeDataDir(), "speech", "whisper.cpp", "whisper-cli.exe"),
    path.join(getBridgeDataDir(), "speech", "whisper.cpp", "main.exe"),
    "whisper-cli",
    "whisper-cli.exe"
  ].filter(Boolean);
  const modelCandidates = [
    process.env.XTENSION_WHISPER_MODEL,
    process.env.WHISPER_CPP_MODEL,
    path.join(getBridgeDataDir(), "speech", "models", whisperCppModelFileName),
    path.join(getBridgeDataDir(), "speech", "models", "ggml-small.bin"),
    path.join(getBridgeDataDir(), "speech", "models", "ggml-base.bin"),
    path.join(getBridgeDataDir(), "speech", "models", "ggml-tiny.bin"),
    path.join(getBridgeDataDir(), "speech", "models", "ggml-large-v3-turbo-q5_0.bin")
  ].filter(Boolean);
  const executable = await resolveExecutable(executableCandidates);
  const model = modelCandidates.find((candidate) => cleanText(candidate) && fs.existsSync(candidate));

  if (!executable || !model) {
    return null;
  }

  return { executable, model };
}

function shouldAutoInstallWhisperCpp() {
  if (process.env.XTENSION_TRANSCRIPTION_AUTO_INSTALL === "0") {
    return false;
  }

  return process.platform === "win32";
}

// Non-rejetante : un échec d'installation (téléchargement du zip binaire KO,
// extraction impossible) ne doit PAS remonter en exception. Ses appelants
// re-testent ensuite la présence de l'exécutable et gèrent l'absence en
// cascadant vers le moteur suivant ; une exception ici court-circuiterait
// toute la cascade et ferait échouer /transcribe alors qu'un autre moteur
// (faster-whisper) pourrait fonctionner.
function ensureWhisperCppInstalled() {
  if (!whisperCppInstallPromise) {
    whisperCppInstallPromise = installWhisperCppEngine().catch((error) => {
      logBridgeEvent("transcription_auto_install_failed", {
        component: "whisper.cpp",
        error: truncateText(error.message || "", 200)
      });
    }).finally(() => {
      whisperCppInstallPromise = null;
    });
  }

  return whisperCppInstallPromise;
}

// Installe uniquement les binaires (zip whisper.cpp, qui contient aussi
// parakeet-cli). Les modèles sont téléchargés à la demande par chaque moteur
// via ensureSpeechModel().
async function installWhisperCppEngine() {
  const speechDir = path.join(getBridgeDataDir(), "speech");
  const whisperDir = path.join(speechDir, "whisper.cpp");
  const downloadsDir = path.join(speechDir, "downloads");
  const zipFile = path.join(downloadsDir, "whisper-bin-x64-v1.9.1.zip");
  const extractDir = path.join(downloadsDir, "whisper-bin-x64-v1.9.1");

  fs.mkdirSync(whisperDir, { recursive: true });
  fs.mkdirSync(downloadsDir, { recursive: true });

  if (!fs.existsSync(path.join(whisperDir, "whisper-cli.exe"))) {
    logBridgeEvent("transcription_auto_install_started", {
      component: "whisper.cpp",
      url: whisperCppReleaseUrl
    });
    await downloadFileIfMissing(whisperCppReleaseUrl, zipFile, 1024 * 1024);
    await extractZip(zipFile, extractDir);
    const cliPath = findFileRecursive(extractDir, "whisper-cli.exe");
    if (!cliPath) {
      throw createBridgeError("Downloaded whisper.cpp package did not contain whisper-cli.exe.", {
        code: "transcription_unavailable",
        statusCode: 424
      });
    }

    fs.cpSync(path.dirname(cliPath), whisperDir, {
      recursive: true,
      force: true
    });
    fs.rmSync(extractDir, {
      recursive: true,
      force: true
    });
  }

  logBridgeEvent("transcription_auto_install_done", {
    executable: path.join(whisperDir, "whisper-cli.exe")
  });
}

async function downloadFileIfMissing(url, destination, minBytes) {
  if (fs.existsSync(destination) && fs.statSync(destination).size >= minBytes) {
    return;
  }

  const tempFile = `${destination}.tmp`;
  try {
    fs.unlinkSync(tempFile);
  } catch (error) {
    // No stale partial download.
  }

  const response = await fetch(url, {
    headers: {
      "user-agent": "Xtension Bridge"
    }
  });
  if (!response.ok || !response.body) {
    throw createBridgeError(`Unable to download local AI runtime (${response.status}).`, {
      code: "download_failed",
      statusCode: 424
    });
  }

  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(tempFile));
  const stats = fs.statSync(tempFile);
  if (stats.size < minBytes) {
    fs.unlinkSync(tempFile);
    throw createBridgeError("Downloaded local AI runtime is incomplete.", {
      code: "download_failed",
      statusCode: 424
    });
  }

  fs.renameSync(tempFile, destination);
}

async function extractZip(zipFile, destination) {
  try {
    fs.rmSync(destination, { recursive: true, force: true });
  } catch (error) {
    // No existing extraction.
  }

  fs.mkdirSync(destination, { recursive: true });
  await runProcessCapture("tar.exe", [
    "-xf",
    zipFile,
    "-C",
    destination
  ], {
    timeoutMs: 60000
  });
}

function findFileRecursive(directory, fileName) {
  const expected = cleanText(fileName).toLowerCase();
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === expected) {
      return fullPath;
    }
    if (entry.isDirectory()) {
      const found = findFileRecursive(fullPath, fileName);
      if (found) {
        return found;
      }
    }
  }

  return "";
}

async function transcribeWithWhisperCpp(engine, wavFile, language, tempFiles, audioInfo) {
  const outputBase = `${wavFile}.transcript`;
  const outputTextFile = `${outputBase}.txt`;
  tempFiles.push(outputTextFile);
  const args = [
    "-m", engine.model,
    "-f", wavFile,
    "-t", String(whisperThreads),
    "-ng",
    "-otxt",
    "-of", outputBase,
    "-nt",
    "-nf",
    "-l", language || "auto"
  ];

  const vadModel = whisperVadEnabled ? speechModelPath(whisperVadModelFileName) : "";
  const vadActive = Boolean(vadModel && fs.existsSync(vadModel));
  if (vadActive) {
    args.push("--vad", "--vad-model", vadModel);
  }
  const audioCtx = whisperAudioCtxForDuration(audioInfo?.durationMs);
  if (audioCtx) {
    args.push("-ac", String(audioCtx));
  }

  logBridgeEvent("transcription_engine_started", {
    engine: "whisper.cpp",
    executable: path.basename(engine.executable),
    model: path.basename(engine.model),
    language: language || "auto",
    vad: vadActive
  });
  try {
    const result = await runProcessCapture(engine.executable, args, {
      timeoutMs: transcriptionTimeoutMs
    });
    const text = sanitizeTranscriptText(
      fs.existsSync(outputTextFile)
        ? fs.readFileSync(outputTextFile, "utf8")
        : result.stdout
    );
    return { text, vadActive };
  } catch (error) {
    logBridgeEvent("transcription_engine_failed", {
      engine: "whisper.cpp",
      error: truncateText(error.message || "", 200)
    });
    return null;
  }
}

async function resolveFasterWhisperEngine() {
  const python = await resolveExecutable([
    process.env.XTENSION_PYTHON,
    "python"
  ].filter(Boolean));

  if (!python) {
    return null;
  }

  try {
    await runProcessCapture(python, ["-c", "import faster_whisper"], {
      timeoutMs: 10000
    });
  } catch (error) {
    return null;
  }

  return { executable: python };
}

async function transcribeWithFasterWhisper(engine, sourceFile, language) {
  const script = [
    "import json, os, sys",
    "from faster_whisper import WhisperModel",
    "audio_path = sys.argv[1]",
    "language = sys.argv[2] or None",
    "model_name = os.environ.get('XTENSION_TRANSCRIBE_MODEL', 'base')",
    "compute_type = os.environ.get('XTENSION_TRANSCRIBE_COMPUTE_TYPE', 'int8')",
    "model = WhisperModel(model_name, device='cpu', compute_type=compute_type)",
    "kwargs = {'beam_size': 1, 'vad_filter': True}",
    "if language:",
    "    kwargs['language'] = language",
    "segments, info = model.transcribe(audio_path, **kwargs)",
    "text = ' '.join(segment.text.strip() for segment in segments).strip()",
    "print(json.dumps({'text': text, 'language': getattr(info, 'language', '') or ''}, ensure_ascii=False))"
  ].join("\n");

  logBridgeEvent("transcription_engine_started", {
    engine: "faster-whisper",
    executable: path.basename(engine.executable),
    model: process.env.XTENSION_TRANSCRIBE_MODEL || "base",
    language: language || "auto"
  });
  const transcriberEnv = buildBridgeEnv();
  const transcriberHome = cleanText(transcriberEnv.XTENSION_BRIDGE_USER_HOME || transcriberEnv.USERPROFILE || transcriberEnv.HOME || os.homedir());
  const huggingFaceHome = path.join(transcriberHome || os.tmpdir(), ".cache", "huggingface");
  fs.mkdirSync(huggingFaceHome, { recursive: true });
  const result = await runProcessCapture(engine.executable, ["-c", script, sourceFile, language || ""], {
    timeoutMs: transcriptionTimeoutMs,
    env: {
      ...transcriberEnv,
      HF_HOME: huggingFaceHome,
      HF_HUB_CACHE: path.join(huggingFaceHome, "hub"),
      HUGGINGFACE_HUB_CACHE: path.join(huggingFaceHome, "hub"),
      HF_HUB_DISABLE_SYMLINKS_WARNING: "1"
    }
  });
  const parsed = tryParseJson(extractJsonObject(result.stdout)) || tryParseJson(result.stdout);
  const text = sanitizeTranscriptText(parsed?.text || result.stdout || "");

  return {
    text,
    engine: "faster-whisper",
    language: cleanText(parsed?.language || language || "")
  };
}

async function resolveFfmpegExecutable() {
  return resolveExecutable([
    process.env.XTENSION_FFMPEG,
    "ffmpeg",
    "ffmpeg.exe",
    "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe"
  ].filter(Boolean));
}

async function resolveExecutable(candidates) {
  for (const candidate of candidates || []) {
    const executable = cleanText(candidate || "");
    if (!executable) {
      continue;
    }

    if (path.isAbsolute(executable)) {
      if (fs.existsSync(executable)) {
        return executable;
      }
      continue;
    }

    if (await commandExists(executable)) {
      return executable;
    }
  }

  return "";
}

function getBridgeDataDir() {
  if (process.env.XTENSION_BRIDGE_DATA_DIR) {
    return process.env.XTENSION_BRIDGE_DATA_DIR;
  }

  return process.env.ProgramData
    ? path.join(process.env.ProgramData, "Xtension", "Bridge")
    : path.join(os.tmpdir(), "Xtension", "Bridge");
}

function audioExtensionFromMimeType(mimeType) {
  const value = cleanText(mimeType).toLowerCase();
  if (/wav|wave/.test(value)) {
    return "wav";
  }
  if (/webm/.test(value)) {
    return "webm";
  }
  if (/ogg|opus/.test(value)) {
    return "ogg";
  }
  if (/mp4|m4a|aac/.test(value)) {
    return "m4a";
  }
  return "webm";
}

function normalizeTranscriptionLanguage(value) {
  const language = cleanText(value).toLowerCase().replace("_", "-");
  const base = language.split("-")[0];
  if (!base || base === "auto" || base === "unknown") {
    return "";
  }

  const supported = new Set([
    "af", "am", "ar", "as", "az", "ba", "be", "bg", "bn", "bo", "br", "bs",
    "ca", "cs", "cy", "da", "de", "el", "en", "es", "et", "eu", "fa", "fi",
    "fo", "fr", "gl", "gu", "ha", "haw", "he", "hi", "hr", "ht", "hu", "hy",
    "id", "is", "it", "ja", "jw", "ka", "kk", "km", "kn", "ko", "la", "lb",
    "ln", "lo", "lt", "lv", "mg", "mi", "mk", "ml", "mn", "mr", "ms", "mt",
    "my", "ne", "nl", "nn", "no", "oc", "pa", "pl", "ps", "pt", "ro", "ru",
    "sa", "sd", "si", "sk", "sl", "sn", "so", "sq", "sr", "su", "sv", "sw",
    "ta", "te", "tg", "th", "tk", "tl", "tr", "tt", "uk", "ur", "uz", "vi",
    "yi", "yo", "zh"
  ]);

  return supported.has(base) ? base : "";
}

// ============================================================================
// Utilitaires processus / journalisation / texte
// ============================================================================

function buildBridgeEnv() {
  const env = { ...process.env };
  const home = cleanText(process.env.XTENSION_BRIDGE_USER_HOME || process.env.USERPROFILE || process.env.HOME || os.homedir());

  if (home) {
    env.USERPROFILE = home;
    env.HOME = home;
    env.APPDATA = path.join(home, "AppData", "Roaming");
    env.LOCALAPPDATA = path.join(home, "AppData", "Local");
  }

  return env;
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

function runProcessCapture(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    const timeoutMs = Math.max(1000, Number(options.timeoutMs || transcriptionTimeoutMs));
    const child = spawn(executable, args || [], {
      cwd: options.cwd || process.cwd(),
      env: options.env || buildBridgeEnv(),
      shell: process.platform === "win32" && /\.(?:cmd|bat)$/i.test(executable),
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (error, result) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    };

    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch (error) {
        // Best-effort timeout cleanup.
      }
      finish(createBridgeError("Local process timed out.", {
        code: "process_timeout",
        statusCode: 504
      }));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      finish(createBridgeError(`Local process failed: ${error.message}`, {
        code: "process_failed",
        statusCode: 500
      }));
    });
    child.on("exit", (code) => {
      if (settled) {
        return;
      }

      if (code !== 0) {
        finish(createBridgeError(`Local process failed: ${sanitizeProcessFailureText(stderr || stdout, 700)}`, {
          code: "process_failed",
          statusCode: 500
        }));
        return;
      }

      finish(null, { stdout, stderr });
    });
    child.stdin.end(options.stdin || "");
  });
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
      env: buildBridgeEnv(),
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
    // Logging must never break the bridge.
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

function createBridgeError(message, options = {}) {
  const error = new Error(message);
  if (options.code) {
    error.code = options.code;
  }
  if (options.statusCode) {
    error.statusCode = options.statusCode;
  }
  return error;
}

function sanitizeProcessFailureText(value, maxLength) {
  const lines = stripAnsi(String(value || ""))
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter(Boolean);
  const important = lines.find((line) => /(?:error|failed|denied|unauthorized|not inside|timed out)/i.test(line));
  return truncateText(important || lines.slice(-3).join(" ") || "Local process failed.", maxLength);
}

function stripAnsi(value) {
  return String(value || "").replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  return { text: value };
}

function unwrapStructuredValue(value, depth = 0) {
  if (!value || depth > 4) {
    return null;
  }

  if (typeof value === "string") {
    return { text: value };
  }

  if (typeof value !== "object") {
    return null;
  }

  if (typeof value.text === "string" || typeof value.correctedText === "string" || typeof value.translatedText === "string" || typeof value.generatedText === "string") {
    return value;
  }

  for (const key of ["result", "response", "output", "message", "content", "answer"]) {
    const nested = value[key];
    if (!nested) {
      continue;
    }

    const parsed = unwrapStructuredValue(nested, depth + 1);
    if (parsed) {
      return parsed;
    }
  }

  return null;
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

function sanitizeGeneratedReplyText(value) {
  return cleanDraftText(value).replace(prohibitedReplySymbolPattern, ",");
}

// Assainissement des TRANSCRIPTIONS : pas de conversion tiret cadratin -&gt;
// virgule (cette règle ne vaut que pour les tweets générés). Ainsi un artefact
// de silence « — » reste « — » et est bien capté par le filtre anti-silence,
// au lieu de devenir une virgule parasite insérée dans la dictée.
function sanitizeTranscriptText(value) {
  return cleanDraftText(value);
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
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function cleanDraftText(value) {
  return String(value || "")
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
