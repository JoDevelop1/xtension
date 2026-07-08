(() => {
  "use strict";

  const extensionApi = globalThis.chrome || globalThis.browser;
  const runtimeApi = extensionApi?.runtime;
  const i18nApi = extensionApi?.i18n;
  const storageApi = extensionApi?.storage?.local;

  const REPLY_AI_CONFIG_VERSION = 16;
  const DEFAULT_CODEX_BRIDGE_URL = "http://127.0.0.1:47623";
  const DEFAULT_REPLY_LANGUAGE_MODE = "tweet";

  const DEFAULT_GENERATE_PROMPT = "Write a punchy, natural X/Twitter post with a clear point of view. Keep it concise, about 1 to 3 sentences, unless the instruction asks for more.";

  const DEFAULT_CONFIG = {
    configVersion: REPLY_AI_CONFIG_VERSION,
    enabled: true,
    codexBridgeUrl: DEFAULT_CODEX_BRIDGE_URL,
    bridgeToken: "",
    replyLanguageMode: DEFAULT_REPLY_LANGUAGE_MODE,
    generatePrompt: DEFAULT_GENERATE_PROMPT,
    gpu: false
  };

  const form = document.querySelector("#reply-ai-form");
  const enabledInput = document.querySelector("#reply-ai-enabled");
  const codexBridgeUrlInput = document.querySelector("#reply-ai-codex-bridge-url");
  const bridgeTokenInput = document.querySelector("#reply-ai-bridge-token");
  const replyLanguageModeInput = document.querySelector("#reply-ai-language-mode");
  const generatePromptInput = document.querySelector("#reply-ai-generate-prompt");
  const gpuInput = document.querySelector("#reply-ai-gpu");
  const gpuStatusElement = document.querySelector("#reply-ai-gpu-status");
  const statusElement = document.querySelector("#reply-ai-status");
  const engineStatusElement = document.querySelector("#reply-ai-engine-status");
  const bridgeDownloadLink = document.querySelector("#reply-ai-bridge-download");
  const testButton = document.querySelector("#reply-ai-test");
  const logsRefreshButton = document.querySelector("#reply-ai-logs-refresh");
  const logsClearButton = document.querySelector("#reply-ai-logs-clear");
  const logsOutput = document.querySelector("#reply-ai-logs-output");
  const tabButtons = Array.from(document.querySelectorAll(".options-tab"));
  const tabPanels = Array.from(document.querySelectorAll(".settings-tab-panel"));
  const statusBaseClass = statusElement?.className || "options-status";

  document.addEventListener("DOMContentLoaded", start, { once: true });

  async function start() {
    localizePage();
    setupTabs();
    await loadConfig();
    refreshEngineStatusOnLoad();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await saveConfig();
    });

    testButton?.addEventListener("click", async () => {
      await prepareEngine();
    });

    gpuInput?.addEventListener("change", async () => {
      await saveConfig();
      await sendGpuModeToBridge(gpuInput.checked);
    });

    logsRefreshButton?.addEventListener("click", async () => {
      try {
        await loadDiagnosticLogs();
      } catch (error) {
        renderDiagnosticLogsError(error);
        showStatus(error?.message || localizedText("optionsLogsLoadFailed", "Unable to load logs."), "error");
      }
    });

    logsClearButton?.addEventListener("click", async () => {
      try {
        await clearDiagnosticLogs();
      } catch (error) {
        showStatus(error?.message || localizedText("optionsLogsClearFailed", "Unable to clear logs."), "error");
      }
    });
  }

  function localizePage() {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n");
      const message = localizedText(key, element.textContent);
      element.textContent = message;
    });

    document.querySelectorAll("[data-help-i18n]").forEach((element) => {
      const key = element.getAttribute("data-help-i18n");
      const fallback = element.getAttribute("data-help") || "";
      element.setAttribute("data-help", localizedText(key, fallback));
    });
  }

  async function loadConfig() {
    const stored = await storageGet({ replyAiConfig: null });
    const rawConfig = stored.replyAiConfig || null;
    const config = normalizeReplyAiConfig(rawConfig);

    if (shouldPersistReplyAiConfig(rawConfig, config)) {
      await storageSet({ replyAiConfig: config });
    }

    enabledInput.checked = Boolean(config.enabled);
    codexBridgeUrlInput.value = config.codexBridgeUrl || DEFAULT_CODEX_BRIDGE_URL;
    bridgeTokenInput.value = config.bridgeToken || "";
    replyLanguageModeInput.value = config.replyLanguageMode || DEFAULT_REPLY_LANGUAGE_MODE;
    if (generatePromptInput) {
      generatePromptInput.value = config.generatePrompt || DEFAULT_GENERATE_PROMPT;
    }
    if (gpuInput) {
      gpuInput.checked = Boolean(config.gpu);
    }
  }

  function setupTabs() {
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        activateSettingsTab(button.getAttribute("data-tab"));
      });
    });
  }

  function activateSettingsTab(tab) {
    const nextTab = tab || "replies";

    tabButtons.forEach((button) => {
      const active = button.getAttribute("data-tab") === nextTab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });

    tabPanels.forEach((panel) => {
      const active = panel.getAttribute("data-tab-panel") === nextTab;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });

    if (nextTab === "logs") {
      loadDiagnosticLogs().catch((error) => {
        renderDiagnosticLogsError(error);
      });
    }
  }

  async function saveConfig() {
    const config = getFormConfig();
    await storageSet({ replyAiConfig: config });
    showStatus(localizedText("optionsSaved", "Settings saved."), "success");
    return true;
  }

  // Prépare le moteur local : sauvegarde, déclenche le téléchargement/démarrage
  // du modèle (peut être long au premier usage), puis rafraîchit l'état.
  async function prepareEngine() {
    await saveConfig();
    const config = getFormConfig();
    setEngineStatus(localizedText("optionsEnginePreparing", "Preparing the local engine (first run may download the model, this can take a few minutes)..."));
    showStatus(localizedText("optionsEnginePreparing", "Preparing the local engine..."), "");

    try {
      const bridgeUrl = normalizeCodexBridgeUrl(config.codexBridgeUrl) || DEFAULT_CODEX_BRIDGE_URL;
      const response = await fetch(`${bridgeUrl}/warmup`, {
        method: "POST",
        headers: buildBridgeAuthHeaders(config)
      });
      if (!response.ok) {
        throw new Error(`${localizedText("optionsEngineFailed", "The local engine could not start.")} (${response.status})`);
      }
      await response.json().catch(() => ({}));
      setEngineStatus(localizedText("optionsEngineReady", "Local engine ready."));
      showStatus(localizedText("optionsEngineReady", "Local engine ready."), "success");
    } catch (error) {
      setEngineStatus(localizedText("optionsEngineMissing", "Local engine not detected. Install it, then try again."));
      showStatus(error?.message || localizedText("optionsEngineFailed", "The local engine could not start."), "error");
      activateSettingsTab("engine");
      bridgeDownloadLink?.focus();
    }
  }

  // Vérifie l'état du moteur au chargement (sans le démarrer).
  function refreshEngineStatusOnLoad() {
    const config = getFormConfig();
    const bridgeUrl = normalizeCodexBridgeUrl(config.codexBridgeUrl) || DEFAULT_CODEX_BRIDGE_URL;
    fetch(`${bridgeUrl}/health`, { method: "GET", headers: buildBridgeAuthHeaders(config) })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
      .then((data) => {
        const llm = data?.llm || {};
        if (llm.ready) {
          setEngineStatus(localizedText("optionsEngineReady", "Local engine ready."));
        } else if (llm.installed) {
          setEngineStatus(localizedText("optionsEngineIdle", "Local engine detected. Click \"Prepare engine\" to load the model."));
        } else {
          setEngineStatus(localizedText("optionsEngineNotInstalled", "The model will download on first use (~2.5 GB). Click \"Prepare engine\" to start."));
        }
        applyGpuStatusFromBridge(data);
      })
      .catch(() => {
        setEngineStatus(localizedText("optionsEngineMissing", "Local engine not detected. Install it, then try again."));
      });
  }

  function setEngineStatus(message) {
    if (engineStatusElement) {
      engineStatusElement.textContent = message || "";
    }
  }

  function setGpuStatus(message) {
    if (gpuStatusElement) {
      gpuStatusElement.textContent = message || "";
    }
  }

  // Envoie la préférence GPU/CPU au bridge (endpoint /config). Le bridge persiste
  // le choix, télécharge le moteur CUDA au premier passage en GPU, et redémarre
  // llama-server dans le nouveau mode.
  async function sendGpuModeToBridge(gpu) {
    const config = getFormConfig();
    const bridgeUrl = normalizeCodexBridgeUrl(config.codexBridgeUrl) || DEFAULT_CODEX_BRIDGE_URL;
    setGpuStatus(gpu
      ? localizedText("optionsGpuSwitching", "Switching to GPU — the CUDA engine (~500 MB) downloads on first use, this can take a few minutes...")
      : localizedText("optionsGpuSwitchingCpu", "Switching back to the CPU engine..."));
    try {
      const response = await fetch(`${bridgeUrl}/config`, {
        method: "POST",
        headers: { "content-type": "application/json", ...buildBridgeAuthHeaders(config) },
        body: JSON.stringify({ gpu: Boolean(gpu) })
      });
      if (!response.ok) {
        throw new Error(String(response.status));
      }
      const data = await response.json().catch(() => ({}));
      applyGpuStatusFromBridge(data);
      showStatus(localizedText("optionsSaved", "Settings saved."), "success");
    } catch (error) {
      setGpuStatus(localizedText("optionsGpuBridgeUnreachable", "Could not reach the local engine to change mode. Make sure it is running, then try again."));
      showStatus(localizedText("optionsGpuBridgeUnreachable", "Could not reach the local engine to change mode."), "error");
    }
  }

  // Met à jour la ligne d'état GPU depuis la réponse du bridge (/config ou /health).
  function applyGpuStatusFromBridge(data) {
    const mode = data?.mode || data?.llm?.mode || (data?.gpu || data?.llm?.gpu ? "gpu" : "cpu");
    if (mode === "gpu") {
      setGpuStatus(localizedText("optionsGpuStatusGpu", "Running on the GPU (CUDA)."));
    } else {
      setGpuStatus(localizedText("optionsGpuStatusCpu", "Running on the CPU."));
    }
  }

  function buildBridgeAuthHeaders(config) {
    const token = String(config?.bridgeToken || "").trim();
    return token ? { "x-xtension-bridge-token": token } : {};
  }

  async function loadDiagnosticLogs() {
    if (!logsOutput) {
      return;
    }

    logsOutput.textContent = localizedText("optionsLogsLoading", "Loading logs...");
    const response = await runtimeSendMessage({
      type: "xtension-get-diagnostic-logs"
    });

    if (!response?.ok) {
      throw new Error(response?.error || localizedText("optionsLogsLoadFailed", "Unable to load logs."));
    }

    renderDiagnosticLogs(response.logs || []);
  }

  async function clearDiagnosticLogs() {
    const response = await runtimeSendMessage({
      type: "xtension-clear-diagnostic-logs"
    });

    if (!response?.ok) {
      throw new Error(response?.error || localizedText("optionsLogsClearFailed", "Unable to clear logs."));
    }

    renderDiagnosticLogs([]);
    showStatus(localizedText("optionsLogsCleared", "Logs cleared."), "success");
  }

  function renderDiagnosticLogs(logs) {
    if (!logsOutput) {
      return;
    }

    if (!Array.isArray(logs) || logs.length === 0) {
      logsOutput.textContent = localizedText("optionsLogsEmpty", "No diagnostic logs yet.");
      return;
    }

    logsOutput.textContent = logs.map(formatDiagnosticLogEntry).join("\n");
  }

  function renderDiagnosticLogsError(error) {
    if (!logsOutput) {
      return;
    }

    logsOutput.textContent = error?.message || localizedText("optionsLogsLoadFailed", "Unable to load logs.");
  }

  function formatDiagnosticLogEntry(entry) {
    const details = { ...(entry || {}) };
    const time = details.time || "";
    const level = String(details.level || "info").toUpperCase();
    const event = details.event || "";
    const area = details.area || "";
    delete details.time;
    delete details.level;
    delete details.event;
    delete details.area;

    const compact = [
      details.operation ? `operation=${details.operation}` : "",
      details.route ? `route=${details.route}` : "",
      typeof details.ok === "boolean" ? `ok=${details.ok}` : "",
      Number.isFinite(details.durationMs) ? `durationMs=${details.durationMs}` : "",
      details.errorCode ? `errorCode=${details.errorCode}` : ""
    ].filter(Boolean);

    ["operation", "route", "ok", "durationMs", "errorCode"].forEach((key) => {
      delete details[key];
    });

    const extra = Object.keys(details).length ? ` ${JSON.stringify(details)}` : "";
    return `[${time}] ${level} ${area}/${event} ${compact.join(" ")}${extra}`.trim();
  }

  function getFormConfig() {
    return {
      configVersion: REPLY_AI_CONFIG_VERSION,
      enabled: enabledInput.checked,
      codexBridgeUrl: normalizeCodexBridgeUrl(codexBridgeUrlInput.value) || DEFAULT_CODEX_BRIDGE_URL,
      bridgeToken: bridgeTokenInput.value.trim(),
      replyLanguageMode: normalizeReplyLanguageMode(replyLanguageModeInput.value),
      generatePrompt: String(generatePromptInput?.value ?? DEFAULT_GENERATE_PROMPT).trim() || DEFAULT_GENERATE_PROMPT,
      gpu: Boolean(gpuInput?.checked)
    };
  }

  function normalizeReplyAiConfig(config) {
    const rawConfig = config && typeof config === "object" ? config : {};
    const normalized = {
      ...DEFAULT_CONFIG,
      ...rawConfig
    };

    normalized.configVersion = REPLY_AI_CONFIG_VERSION;
    normalized.enabled = typeof rawConfig.enabled === "boolean" ? rawConfig.enabled : true;
    normalized.codexBridgeUrl = normalizeCodexBridgeUrl(normalized.codexBridgeUrl) || DEFAULT_CODEX_BRIDGE_URL;
    normalized.bridgeToken = String(normalized.bridgeToken || "").trim();
    normalized.replyLanguageMode = normalizeReplyLanguageMode(normalized.replyLanguageMode);
    normalized.generatePrompt = String(normalized.generatePrompt || DEFAULT_GENERATE_PROMPT).trim() || DEFAULT_GENERATE_PROMPT;
    normalized.gpu = typeof rawConfig.gpu === "boolean" ? rawConfig.gpu : false;

    delete normalized.provider;
    delete normalized.codexModel;
    delete normalized.codexModelPreset;
    delete normalized.prompt;
    delete normalized.replyPromptProfiles;
    delete normalized.replyCount;
    delete normalized.replyStyle;
    delete normalized.baseUrl;
    delete normalized.model;
    delete normalized.apiKey;

    return normalized;
  }

  function shouldPersistReplyAiConfig(rawConfig, normalizedConfig) {
    if (!rawConfig || typeof rawConfig !== "object") {
      return true;
    }

    return JSON.stringify(rawConfig) !== JSON.stringify(normalizedConfig);
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

  function normalizeReplyLanguageMode(value) {
    return String(value || "").trim().toLowerCase() === "ui" ? "ui" : DEFAULT_REPLY_LANGUAGE_MODE;
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

  function runtimeSendMessage(message) {
    return new Promise((resolve, reject) => {
      if (!runtimeApi?.sendMessage) {
        reject(new Error(localizedText("optionsRuntimeUnavailable", "Extension runtime is unavailable.")));
        return;
      }

      try {
        const maybePromise = runtimeApi.sendMessage(message, (response) => {
          const error = runtimeApi?.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }
          resolve(response);
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(resolve, reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  function showStatus(message, type) {
    if (!statusElement) {
      return;
    }

    statusElement.className = statusBaseClass;
    if (type) {
      statusElement.classList.add(type);
    }
    statusElement.textContent = message || "";
  }

  function localizedText(key, fallback) {
    if (!key || !i18nApi?.getMessage) {
      return fallback || "";
    }

    return i18nApi.getMessage(key) || fallback || "";
  }
})();
